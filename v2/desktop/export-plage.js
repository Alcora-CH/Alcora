'use strict';

const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const { pipeline } = require('node:stream/promises');

/**
 * Exporter une plage de la relecture en fichiers video.
 *
 * Tout ce qui suit vient de la mesure (docs/contraintes-verifiees.md, V-Export) :
 *
 *  - le controleur exporte par « /video/export », une heure au plus par demande, et JAMAIS
 *    deux demandes a la fois : des campagnes d'export ont deja fait redemarrer des UDM Pro.
 *    Une plage plus longue part donc en tranches d'une heure, l'une apres l'autre, un
 *    fichier par tranche (decision du 23.10.2026, maquette docs/maquette-export-plage.html) ;
 *  - il annonce la taille (« Content-Length ») : la progression se chiffre honnetement ;
 *  - il IGNORE « Range » : une coupure ne se reprend pas, le fichier partiel s'efface ;
 *  - une periode sans enregistrement rend 404, distincte d'une vraie panne.
 *
 * Contrairement aux extraits de la relecture, rien ne passe par le cache : une heure de
 * G6 en 4K pese ~12 Go. Les octets vont droit au fichier choisi, ecrit sous « .part » puis
 * renomme — jamais un fichier tronque sous le nom que l'utilisateur a donne.
 */

const HEURE_MS = 3_600_000;
/** Silence du controleur au-dela duquel on renonce : la reponse des extraits a le meme. */
const SILENCE_MS = 180_000;
/** Une progression par quart de seconde suffit a l'oeil, et epargne le pont. */
const CADENCE_MS = 250;
/** Marge exigee en plus de l'estimation : elle n'est qu'un debit observe, pas une promesse. */
const MARGE_PLACE = 1.1;
const MARGE_PLACE_FIXE = 64 * 1024 * 1024;

/** Les raisons d'un echec, nommees : la page en tire le texte et le remede. */
const RAISONS = ['occupe', 'plage', 'session', 'place', 'existe', 'vide', 'refuse', 'interrompu', 'ecriture'];

class ErreurExport extends Error {
  constructor(raison, detail = raison, extra = {}) {
    super(detail);
    this.raison = raison;
    Object.assign(this, extra);
  }
}

/**
 * Decoupe [debut, fin] en tranches contigues d'une heure au plus, la derniere plus courte.
 * Rien a decouper (bornes absurdes ou vides) : liste vide.
 */
function decouper(debut, fin, max = HEURE_MS) {
  if (!Number.isFinite(debut) || !Number.isFinite(fin) || !(max > 0) || fin <= debut) return [];
  const tranches = [];
  for (let d = debut; d < fin; d += max) tranches.push({ debut: d, fin: Math.min(d + max, fin) });
  return tranches;
}

/*
 * Un nom venu d'un nom de camera doit devenir un nom de fichier Windows, et rien d'autre.
 *
 * Les lettres accentuees RESTENT : l'enregistrement des extraits les remplacait par « _ »
 * (« Allee » devenait « All_e »). Seuls partent les caracteres que Windows refuse, les
 * caracteres de controle, et le point ou l'espace final qu'il retire en silence.
 */
const INTERDITS = /[<>:"/\\|?*\p{Cc}]/gu;
const RESERVES = /^(con|prn|aux|nul|com\d|lpt\d)$/i;

function nomPropre(brut, max = 120) {
  let s = String(brut ?? '').normalize('NFC').replace(INTERDITS, '_').replace(/\s+/g, ' ').trim();
  s = s.slice(0, max).replace(/[. ]+$/, '');
  if (RESERVES.test(s)) s = `${s}_`;
  return s || 'Alcora';
}

/**
 * Le nom propose a Windows : la camera, le jour et les heures LOCALES, dans la langue du
 * moment (`t` est celui d'i18n.js). Une plage qui passe minuit nomme ses deux jours.
 */
function nomParDefaut(camera, debut, fin, t) {
  const p = (n) => String(n).padStart(2, '0');
  const jour = (x) => `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`;
  const heure = (x) => `${p(x.getHours())}-${p(x.getMinutes())}-${p(x.getSeconds())}`;
  const d = new Date(debut);
  const f = new Date(fin);
  return nomPropre(jour(d) === jour(f)
    ? t('main.exportNom', { camera, jour: jour(d), debut: heure(d), fin: heure(f) })
    : t('main.exportNomDeuxJours', { camera, jour: jour(d), debut: heure(d), jourFin: jour(f), fin: heure(f) }));
}

/** Le nom de la tranche i sur n, a cote du fichier choisi : « nom (2 sur 3).mp4 ». */
function nomTranche(fichier, i, n, gabarit) {
  if (n <= 1) return fichier;
  const ext = path.extname(fichier) || '.mp4';
  const base = path.basename(fichier, path.extname(fichier));
  return path.join(path.dirname(fichier), `${gabarit(base, i, n)}${ext}`);
}

/** Place disponible sous un dossier, en octets ; null si le systeme ne sait pas le dire. */
async function placeLibre(dossier) {
  try {
    const s = await fs.promises.statfs(dossier);
    return Number(s.bavail) * Number(s.bsize);
  } catch {
    return null;
  }
}

/**
 * Ouvre la demande d'export aupres du controleur. Rend la reponse, ou une erreur nommee.
 * `client()` rend le client authentifie du moment (le meme que les extraits).
 */
function ouvrirDepuisClient(client) {
  return ({ cameraId, debut, fin, signal }) => new Promise((resolve, reject) => {
    const c = client();
    if (!c) return reject(new ErreurExport('session', 'no session open'));
    const chemin = `/proxy/protect/api/video/export?camera=${encodeURIComponent(cameraId)}`
      + `&start=${Math.round(debut)}&end=${Math.round(fin)}`;
    const req = https.request({
      host: c.host, port: 443, path: chemin, method: 'GET', agent: c.agent, signal,
      headers: {
        'User-Agent': 'Alcora/2.2',
        ...(c.session.cookieHeader ? { Cookie: c.session.cookieHeader } : {}),
        ...(c.session.csrf ? { 'X-CSRF-Token': c.session.csrf } : {}),
      },
    }, (res) => {
      if (res.statusCode === 404) { res.resume(); return reject(new ErreurExport('vide', 'HTTP 404')); }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new ErreurExport('refuse', `HTTP ${res.statusCode}`, { statut: res.statusCode }));
      }
      // Le silence se surveille aussi PENDANT le transfert : une reponse commencee puis
      // figee ne doit pas tenir l'export ouvert pour toujours.
      res.setTimeout(SILENCE_MS, () => res.destroy(new ErreurExport('interrompu', 'controller silent')));
      resolve({ total: Number(res.headers['content-length']) || 0, flux: res });
    });
    req.setTimeout(SILENCE_MS, () => req.destroy(new ErreurExport('interrompu', 'controller silent')));
    req.on('error', (e) => reject(e));
    req.end();
  });
}

/** Ce qu'une panne de fichier ou de reseau veut dire pour l'utilisateur. */
function nommer(e, signal) {
  if (signal?.aborted) return new ErreurExport('annule', 'cancelled');
  if (e instanceof ErreurExport) return e;
  if (e?.code === 'ENOSPC') return new ErreurExport('place', e.message);
  if (['EACCES', 'EPERM', 'EROFS', 'EISDIR', 'ENOENT', 'EBUSY'].includes(e?.code)) {
    return new ErreurExport('ecriture', e.message);
  }
  return new ErreurExport('interrompu', e?.message ?? String(e));
}

/**
 * L'export en cours — un seul a la fois, quelle que soit la camera.
 *
 * `lancer` verifie ce qui peut l'etre AVANT le premier octet (plage, place, fichiers deja
 * presents), puis rend la main : la suite est poussee par `onEtat`, que la page suive
 * l'ecran de la relecture ou non.
 */
class ExportPlage {
  /**
   * @param {object} o
   * @param {(p: object) => Promise<{total: number, flux: NodeJS.ReadableStream}>} o.ouvrir
   * @param {object} o.journal
   * @param {(e: object) => void} [o.onEtat]
   * @param {(dossier: string) => Promise<number|null>} [o.place]
   * @param {(base: string, i: number, n: number) => string} [o.gabaritTranche]
   * @param {() => number} [o.horloge]
   */
  constructor({ ouvrir, journal, onEtat, place = placeLibre, gabaritTranche, horloge = Date.now }) {
    this.ouvrir = ouvrir;
    this.journal = journal;
    this.onEtat = onEtat || (() => {});
    this.place = place;
    this.gabarit = gabaritTranche || ((base, i, n) => `${base} (${i}-${n})`);
    this.horloge = horloge;
    this.travail = null;
    this.controle = null;
    /** Le dernier etat pousse : la page qui revient le redemande. */
    this.etat = { etat: 'aucun' };
    /** Les fichiers ECRITS par le dernier export — seuls a pouvoir etre montres. */
    this.ecrits = [];
    /** Le fichier partiel en cours d'ecriture, pour l'abandon a la fermeture. */
    this.provisoire = null;
  }

  get occupe() { return this.travail !== null; }

  pousser(e) {
    this.etat = e;
    this.onEtat(e);
  }

  /**
   * @param {object} p
   * @param {string} p.cameraId
   * @param {string} p.camera     nom lisible, pour le journal
   * @param {number} p.debut
   * @param {number} p.fin
   * @param {string} p.fichier    chemin choisi par l'utilisateur (premiere tranche)
   * @param {number} [p.estimation] octets attendus, d'apres le debit observe ; 0 = inconnu
   * @returns {Promise<{fichiers: string[]}>} des que l'export est parti
   */
  async lancer({ cameraId, camera, debut, fin, fichier, estimation = 0 }) {
    if (this.travail) throw new ErreurExport('occupe', 'an export is already running');
    const tranches = decouper(debut, fin);
    if (!tranches.length || !fichier) throw new ErreurExport('plage', 'empty or inverted range');

    const fichiers = tranches.map((_, i) => nomTranche(fichier, i + 1, tranches.length, this.gabarit));
    // Une tranche seule porte le nom choisi, que la boite de Windows a deja fait confirmer.
    // Decoupee, AUCUNE ne le porte : « nom (1 sur 3) » non plus n'a ete confirme par personne.
    const deja = (tranches.length > 1 ? fichiers : []).find((f) => fs.existsSync(f));
    if (deja) throw new ErreurExport('existe', deja, { fichier: path.basename(deja) });

    if (estimation > 0) {
      const libre = await this.place(path.dirname(fichier));
      const besoin = estimation * MARGE_PLACE + MARGE_PLACE_FIXE;
      if (libre !== null && libre < besoin) {
        throw new ErreurExport('place', `${libre} bytes free for ~${Math.round(estimation)}`, { libre, besoin: estimation });
      }
    }

    this.controle = new AbortController();
    this.ecrits = [];
    this.journal.info('export', `range ${new Date(debut).toISOString()} → ${new Date(fin).toISOString()}`
      + ` on ${camera}: ${tranches.length} part(s) → ${path.dirname(fichier)}`);
    const commun = { camera, debut, fin, parties: tranches.length, estimation };
    this.pousser({ etat: 'encours', ...commun, partie: 1, recu: 0, total: 0, recuAvant: 0 });

    // Filet : une exception imprevue dans l'export ne doit ni rester sans etat a l'ecran, ni
    // devenir un rejet non traite dans le processus principal, qui l'abattrait.
    this.travail = this.executer(tranches, fichiers, commun, cameraId, this.controle.signal)
      .catch((e) => {
        this.journal.erreur('export', `failed (unexpected): ${e?.stack ?? e}`);
        this.pousser({ etat: 'erreur', ...commun, raison: 'interrompu', faits: this.ecrits.length });
      })
      .finally(() => { this.travail = null; this.controle = null; });
    return { fichiers: fichiers.map((f) => path.basename(f)) };
  }

  annuler() {
    if (!this.controle) return false;
    this.controle.abort();
    return true;
  }

  /**
   * L'application se ferme : on renonce, et le fichier partiel part TOUT DE SUITE. La suite
   * asynchrone de l'annulation n'aura peut-etre pas le temps de s'executer, et un « .part »
   * resterait alors dans le dossier choisi. Windows l'efface meme encore ouvert : Node ouvre
   * ses fichiers en partage de suppression, il disparait a la fermeture du descripteur.
   */
  abandonner() {
    if (!this.controle) return;
    this.controle.abort();
    if (this.provisoire) {
      try { fs.rmSync(this.provisoire, { force: true }); } catch { /* deja parti */ }
    }
  }

  async executer(tranches, fichiers, commun, cameraId, signal) {
    let recuAvant = 0;
    let vides = 0;
    const debutTravail = this.horloge();
    for (let i = 0; i < tranches.length; i++) {
      const cible = fichiers[i];
      const provisoire = `${cible}.part`;
      this.provisoire = provisoire;
      try {
        const { total, flux } = await this.ouvrir({ cameraId, ...tranches[i], signal });
        let recu = 0;
        let dernier = 0;
        flux.on('data', (m) => {
          recu += m.length;
          const t = this.horloge();
          if (t - dernier < CADENCE_MS) return;
          dernier = t;
          this.pousser({ etat: 'encours', ...commun, partie: i + 1, recu, total, recuAvant,
            debit: (recuAvant + recu) / Math.max(1, (t - debutTravail) / 1000) });
        });
        await pipeline(flux, fs.createWriteStream(provisoire), { signal });
        if (recu === 0) throw new ErreurExport('vide', 'empty body');
        await fs.promises.rename(provisoire, cible);
        this.provisoire = null;
        this.ecrits.push(cible);
        recuAvant += recu;
        this.journal.info('export', `part ${i + 1}/${tranches.length}: ${(recu / 1048576).toFixed(1)} MB`);
      } catch (brute) {
        await fs.promises.rm(provisoire, { force: true }).catch(() => {});
        this.provisoire = null;
        const e = nommer(brute, signal);
        // Une heure sans enregistrement au milieu d'une nuit (camera hors ligne) ne
        // condamne pas les autres : on la saute, et on le dit a la fin.
        if (e.raison === 'vide' && tranches.length > 1) {
          vides += 1;
          this.journal.info('export', `part ${i + 1}/${tranches.length}: no recording, skipped`);
          continue;
        }
        if (e.raison === 'annule') {
          this.journal.info('export', `cancelled after ${this.ecrits.length} complete part(s)`);
          this.pousser({ etat: 'annule', ...commun, faits: this.ecrits.length });
        } else {
          this.journal.erreur('export', `failed (${e.raison}) on part ${i + 1}/${tranches.length}: ${e.message}`);
          this.pousser({ etat: 'erreur', ...commun, raison: e.raison, statut: e.statut, partie: i + 1,
            faits: this.ecrits.length });
        }
        return;
      }
    }
    if (this.ecrits.length === 0) {
      this.journal.erreur('export', 'failed (vide): no recording over the whole range');
      this.pousser({ etat: 'erreur', ...commun, raison: 'vide', partie: tranches.length, faits: 0 });
      return;
    }
    this.journal.info('export', `done: ${this.ecrits.length} file(s), ${(recuAvant / 1048576).toFixed(1)} MB`);
    this.pousser({ etat: 'termine', ...commun, octets: recuAvant, vides,
      fichiers: this.ecrits.map((f) => path.basename(f)), dossier: path.dirname(this.ecrits[0]) });
  }
}

module.exports = {
  ExportPlage, ErreurExport, RAISONS, decouper, nomPropre, nomParDefaut, nomTranche, ouvrirDepuisClient, placeLibre,
  HEURE_MS, MARGE_PLACE, MARGE_PLACE_FIXE,
};
