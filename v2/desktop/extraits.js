'use strict';

const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const { t } = require('./i18n');

/**
 * Extraits video : obtention, conservation, service local.
 *
 * Ce que la mesure du 28.07.2026 impose (voir docs/contraintes-verifiees.md) :
 *
 *  - le controleur IGNORE « Range » et place l'index (« moov ») en QUEUE de fichier :
 *    l'extrait doit donc etre obtenu ENTIER avant la premiere image, sans exception ;
 *  - mais il produit a 77 fois le temps reel, soit environ 4 Mo pour une detection
 *    ordinaire de quinze secondes. L'attente reelle se compte en fractions de seconde ;
 *  - « Content-Length » est annonce : la progression peut etre chiffree honnetement ;
 *  - une plage sans enregistrement rend 404, distinguable d'une vraie panne.
 *
 * Les plages sont en revanche servies ICI, sur le fichier local : c'est ce qui permet de
 * se deplacer dans la video, le lecteur les exigeant pour chercher une position.
 */

/**
 * Deux bornes, et la premiere atteinte l'emporte.
 *
 * Le NOMBRE garde le dossier lisible ; le POIDS garde la promesse. Borner au nombre seul
 * ne garantissait pas grand-chose : un extrait pese ~0,26 Mo par seconde, soit 4 Mo pour
 * une detection ordinaire de quinze secondes, mais jusqu'a 31 Mo pour une sequence de deux
 * minutes. Vingt-quatre fichiers pouvaient donc peser 100 Mo comme 750 Mo.
 */
const CONSERVES_MAX = 24;
const POIDS_MAX = 400 * 1024 * 1024;

/**
 * Quantum de la borne « maintenant » dans le decoupage des morceaux.
 *
 * Sans lui, le morceau EN COURS porte un nom qui change a chaque milliseconde, puisque sa
 * fin est l'instant present. Constate sur le poste le 29.07.2026 : deux telechargements de
 * 2,2 Mo en deux secondes pour la meme seconde de video, parce que deux clics voisins
 * avaient produit « ...-6210 » puis « ...-7682 ». L'alignement du debut ne sert a rien si
 * la fin, elle, derive.
 */
const QUANTUM_FIN_MS = 5_000;

/**
 * Corps de reponse a partir d'un fichier, sans jamais lancer d'exception fatale.
 *
 * Passer un flux Node directement a `Response` laisse undici le convertir lui-meme, et sa
 * conversion appelle `close()` sur un flux que l'abandon du destinataire a deja ferme :
 * « Invalid state: ReadableStream is already closed », levee dans une micro-tache que rien
 * ne rattrape. Le processus principal mourait donc — deux fois le 29.07.2026 — parce que le
 * lecteur video avait abandonne une requete, ce qu'il fait a CHAQUE deplacement.
 *
 * On construit donc le flux soi-meme : chaque fermeture est gardee, et l'abandon relache le
 * fichier au lieu de laisser un descripteur ouvert.
 */
function corpsFichier(chemin, options) {
  const lecture = fs.createReadStream(chemin, options);
  let termine = false;

  return new ReadableStream({
    start(controller) {
      lecture.on('data', (morceau) => {
        if (termine) return;
        try {
          controller.enqueue(new Uint8Array(morceau));
        } catch {
          // Le destinataire est parti : plus personne n'attend ces octets.
          termine = true;
          lecture.destroy();
          return;
        }
        if ((controller.desiredSize ?? 1) <= 0) lecture.pause();
      });
      lecture.on('end', () => {
        if (termine) return;
        termine = true;
        try { controller.close(); } catch { /* deja ferme : sans consequence */ }
      });
      lecture.on('error', (e) => {
        if (termine) return;
        termine = true;
        try { controller.error(e); } catch { /* deja ferme : sans consequence */ }
      });
    },
    pull() { lecture.resume(); },
    cancel() {
      termine = true;
      lecture.destroy();
    },
  });
}

class Extraits {
  /**
   * @param {object} o
   * @param {string} o.dossier
   * @param {() => object|null} o.client  rend le client authentifie du moment, ou null
   * @param {object} o.journal
   * @param {(e: object) => void} [o.onProgres]
   */
  constructor({ dossier, client, journal, onProgres }) {
    this.dossier = dossier;
    this.client = client;
    this.journal = journal;
    this.onProgres = onProgres || (() => {});
    /** Telechargements en vol, par jeton : deux clics sur la meme detection n'en font qu'un. */
    this.enVol = new Map();
    fs.mkdirSync(dossier, { recursive: true });
  }

  /** Nom de fichier deduit de la demande : la meme detection reutilise le meme extrait. */
  static jeton(cameraId, debut, fin) {
    const propre = String(cameraId).replace(/[^A-Za-z0-9]/g, '');
    return `${propre}-${Math.round(debut)}-${Math.round(fin)}`;
  }

  chemin(jeton) { return path.join(this.dossier, `${jeton}.mp4`); }

  /**
   * Morceau de frise contenant un instant, aligne sur une grille absolue.
   *
   * L'alignement est ce qui rend le cache utile. Sans lui, deux clics voisins dans la meme
   * seconde produiraient deux fenetres differentes, donc deux fichiers, donc deux
   * telechargements — et sur la G6 en 4K, un morceau de dix secondes pese 35 Mo. Aligne,
   * tout un voisinage retombe sur le meme extrait, deja sur le disque.
   *
   * La fin est bornee a l'instant present — au-dela il n'y a rien — mais ce plafond est
   * lui aussi QUANTIFIE. Une premiere version le posait a `Date.now()` exactement : le
   * morceau en cours changeait donc de nom a chaque milliseconde et se retelechargeait a
   * chaque clic, ce qui annulait tout le benefice de l'alignement du debut.
   *
   * Consequence assumee : les toutes dernieres secondes ne sont pas atteignables. Plutot
   * que d'opposer un refus a quelqu'un qui vise « il y a trois secondes », on rend alors le
   * dernier morceau COMPLET. L'horodatage affiche sur l'image dit la verite, donc ce recul
   * ne trompe personne — et c'est ce qu'on cherchait : ce qui vient de se passer.
   *
   * @returns {{debut: number, fin: number}|null} null s'il n'y a rien a demander
   */
  static morceau(instant, pas, maintenant = Date.now()) {
    if (!Number.isFinite(instant) || !Number.isFinite(pas) || pas <= 0) return null;
    if (!Number.isFinite(maintenant)) return null;

    const debut = Math.floor(instant / pas) * pas;
    const plafond = Math.floor(maintenant / QUANTUM_FIN_MS) * QUANTUM_FIN_MS;
    const fin = Math.min(debut + pas, plafond);
    if (fin > debut) return { debut, fin };

    // Trop pres du present : on recule d'un morceau, s'il est entierement enregistre.
    const precedent = debut - pas;
    return debut <= plafond ? { debut: precedent, fin: debut } : null;
  }

  /**
   * Morceau qui SUIT exactement un instant donne, sans passer par la grille.
   *
   * L'enchainement pendant la lecture ne doit laisser ni trou ni recouvrement : le morceau
   * suivant commence ou le precedent finit, point. La grille sert aux CLICS — pour qu'un
   * voisinage retombe sur un fichier deja obtenu — mais l'imposer ici forcerait a garder
   * partout la meme duree. Or c'est justement en allongeant les morceaux enchaines que l'on
   * espace les jointures, seules choses que l'oeil voit encore passer.
   *
   * @returns {{debut: number, fin: number}|null}
   */
  static suite(depuis, duree, maintenant = Date.now()) {
    if (!Number.isFinite(depuis) || !Number.isFinite(duree) || duree <= 0) return null;
    if (!Number.isFinite(maintenant)) return null;
    const plafond = Math.floor(maintenant / QUANTUM_FIN_MS) * QUANTUM_FIN_MS;
    const fin = Math.min(depuis + duree, plafond);
    return fin > depuis ? { debut: depuis, fin } : null;
  }

  /**
   * Efface les extraits les plus anciens au-dela du nombre conserve.
   *
   * Sans cela, une soiree passee a parcourir le journal laisse des centaines de mega-octets
   * dans le dossier de donnees, que personne n'ira jamais chercher.
   */
  balayer() {
    try {
      const fichiers = fs.readdirSync(this.dossier)
        .filter((f) => f.endsWith('.mp4'))
        .map((f) => {
          const p = path.join(this.dossier, f);
          const s = fs.statSync(p);
          return { p, vu: s.mtimeMs, octets: s.size };
        })
        .sort((a, b) => b.vu - a.vu);

      let cumul = 0;
      let efface = 0;
      let liberes = 0;
      for (let i = 0; i < fichiers.length; i++) {
        cumul += fichiers[i].octets;
        // « i > 0 » sur la borne de poids : le plus recent survit toujours, meme s'il
        // depasse a lui seul le budget. Sans cela, ouvrir une longue sequence l'effacerait
        // dans la foulee de son propre telechargement.
        if (i >= CONSERVES_MAX || (i > 0 && cumul > POIDS_MAX)) {
          // Un par un : Windows refuse d'effacer un fichier qu'un lecteur tient encore
          // ouvert, et cet echec-la ne doit pas empecher le balayage des suivants.
          try {
            fs.rmSync(fichiers[i].p, { force: true });
            efface++;
            liberes += fichiers[i].octets;
          } catch { /* encore en lecture : il partira au prochain balayage */ }
        }
      }
      if (efface) {
        this.journal?.info('clip',
          `${efface} old clip(s) deleted, ${(liberes / 1048576).toFixed(0)} MB freed`);
      }
    } catch { /* dossier illisible : sans consequence */ }
  }

  /**
   * Obtient l'extrait, ou rend celui deja present.
   * @returns {Promise<{jeton: string, octets: number}>}
   */
  obtenir({ cameraId, debut, fin }) {
    const jeton = Extraits.jeton(cameraId, debut, fin);
    const dejaEnVol = this.enVol.get(jeton);
    if (dejaEnVol) return dejaEnVol;

    const travail = this.telecharger({ jeton, cameraId, debut, fin })
      .finally(() => this.enVol.delete(jeton));
    this.enVol.set(jeton, travail);
    return travail;
  }

  async telecharger({ jeton, cameraId, debut, fin }) {
    const cible = this.chemin(jeton);

    // Deja obtenu : on le touche pour qu'il reste en tete du balayage, et on le rend.
    if (fs.existsSync(cible) && fs.statSync(cible).size > 0) {
      const maintenant = new Date();
      try { fs.utimesSync(cible, maintenant, maintenant); } catch { /* sans importance */ }
      return { jeton, octets: fs.statSync(cible).size };
    }

    const client = this.client();
    if (!client) throw new Error('Aucune session ouverte pour le moment.');

    this.balayer();
    const provisoire = `${cible}.${process.pid}.part`;
    const chemin = `/proxy/protect/api/video/export?camera=${encodeURIComponent(cameraId)}`
      + `&start=${Math.round(debut)}&end=${Math.round(fin)}`;

    this.onProgres({ jeton, etat: 'demande', pourcent: 0 });

    const octets = await new Promise((resolve, reject) => {
      const req = https.request({
        host: client.host, port: 443, path: chemin, method: 'GET', agent: client.agent,
        headers: {
          'User-Agent': 'Alcora/2.2',
          ...(client.session.cookieHeader ? { Cookie: client.session.cookieHeader } : {}),
          ...(client.session.csrf ? { 'X-CSRF-Token': client.session.csrf } : {}),
        },
      }, (res) => {
        if (res.statusCode === 404) {
          res.resume();
          const e = new Error(t('extraits.aucunEnregistrement'));
          e.vide = true;
          return reject(e);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(t('extraits.refuse', { status: res.statusCode })));
        }

        // « Content-Length » est annonce : on chiffre la progression plutot que de balayer.
        const total = Number(res.headers['content-length']) || 0;
        let recu = 0;
        let dernier = -1;
        const sortie = fs.createWriteStream(provisoire);

        res.on('data', (m) => {
          recu += m.length;
          if (!total) return;
          const pct = Math.min(100, Math.floor((recu / total) * 100));
          if (pct !== dernier) { dernier = pct; this.onProgres({ jeton, etat: 'obtention', pourcent: pct }); }
        });
        res.pipe(sortie);
        sortie.on('finish', () => resolve(recu));
        sortie.on('error', reject);
        res.on('error', reject);
      });
      req.on('error', reject);
      req.setTimeout(180_000, () => req.destroy(new Error(t('extraits.pasRepondu'))));
      req.end();
    }).catch((e) => {
      fs.rmSync(provisoire, { force: true });
      throw e;
    });

    if (octets === 0) {
      fs.rmSync(provisoire, { force: true });
      const e = new Error(t('extraits.aucunEnregistrement'));
      e.vide = true;
      throw e;
    }

    // Renommage : un fichier a moitie ecrit ne doit jamais passer pour un extrait complet.
    fs.renameSync(provisoire, cible);
    this.journal.info('clip', `${jeton} — ${(octets / 1048576).toFixed(1)} MB`);
    this.onProgres({ jeton, etat: 'pret', pourcent: 100 });
    return { jeton, octets };
  }

  /**
   * Sert le fichier local, en honorant « Range ».
   *
   * Le lecteur les EXIGE pour se deplacer dans la video : sans reponse 206, la barre de
   * lecture ne repond pas. Le controleur, lui, ne les accepte pas — c'est donc ici, sur le
   * fichier deja obtenu, que la chose se joue.
   */
  servir(jeton, entetePlage) {
    if (!/^[A-Za-z0-9-]{1,128}$/.test(jeton)) return new Response('', { status: 400 });
    const cible = this.chemin(jeton);
    let taille;
    try { taille = fs.statSync(cible).size; } catch { return new Response('', { status: 404 }); }

    const commun = { 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes' };

    const m = /^bytes=(\d*)-(\d*)$/.exec(entetePlage ?? '');
    if (!m) {
      return new Response(corpsFichier(cible), {
        headers: { ...commun, 'Content-Length': String(taille) },
      });
    }

    let debut = m[1] === '' ? null : Number(m[1]);
    let finInclus = m[2] === '' ? null : Number(m[2]);
    // « bytes=-500 » : les cinq cents DERNIERS octets. C'est ainsi que le lecteur va
    // chercher l'index en queue de fichier, que le controleur y a place.
    if (debut === null) { debut = Math.max(0, taille - (finInclus ?? 0)); finInclus = taille - 1; }
    if (finInclus === null || finInclus >= taille) finInclus = taille - 1;

    if (debut > finInclus || debut >= taille) {
      return new Response('', { status: 416, headers: { 'Content-Range': `bytes */${taille}` } });
    }

    return new Response(corpsFichier(cible, { start: debut, end: finInclus }), {
      status: 206,
      headers: {
        ...commun,
        'Content-Length': String(finInclus - debut + 1),
        'Content-Range': `bytes ${debut}-${finInclus}/${taille}`,
      },
    });
  }
}

module.exports = { Extraits, CONSERVES_MAX, POIDS_MAX, QUANTUM_FIN_MS, corpsFichier };
