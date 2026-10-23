'use strict';

const fs = require('node:fs');
const path = require('node:path');

/**
 * L'historique des alertes : ce que les veilles ont envoye, garde sur ce PC.
 *
 * Avant lui (2.33.0), une bulle partie ne laissait aucune trace, hors la ligne « bubble
 * shown » du journal : une alerte manquee — absent, ecran verrouille — etait perdue.
 * Maquette docs/maquette-historique-alertes.html, decisions du 23.10.2026 : un onglet de
 * l'ecran Alertes, une pastille « non vues » au rail, 90 jours de conservation.
 *
 * Rien n'y est copie du controleur hormis l'identifiant de la detection : la vignette et la
 * sequence se redemandent a la lecture, comme partout ailleurs. Le fichier ne contient donc
 * ni image ni video — des heures, des noms, des identifiants.
 */

const JOUR_MS = 86_400_000;
const GARDE_MS = 90 * JOUR_MS;
/** Plafond de securite : une veille mal reglee ne doit pas faire grossir le fichier sans fin. */
const MAX_ENTREES = 5000;
/** L'ecriture attend un instant : une rafale d'alertes ne fait qu'une ecriture. */
const DELAI_ECRITURE_MS = 2000;

/** Ce qu'on garde d'une detection : de quoi la revoir et rouvrir sa sequence. */
function detectionGardee(d) {
  return {
    id: d.id ?? null,
    type: d.type ?? null,
    camera: d.camera ?? null,
    debut: Number.isFinite(d.debut) ? d.debut : null,
    fin: Number.isFinite(d.fin) ? d.fin : null,
    sujets: Array.isArray(d.sujets) ? d.sujets.filter((s) => typeof s === 'string').slice(0, 12) : [],
    score: Number.isFinite(d.score) ? d.score : null,
  };
}

/** Une entree relue du disque, ou null si elle n'en est pas une : on ne fait confiance a rien. */
function entreeValide(e) {
  if (!e || typeof e !== 'object' || !Number.isFinite(e.envoye) || !e.detection) return null;
  return {
    envoye: e.envoye,
    detection: detectionGardee(e.detection),
    cameraNom: typeof e.cameraNom === 'string' ? e.cameraNom : null,
    veilleId: typeof e.veilleId === 'string' ? e.veilleId : null,
    veilleNom: typeof e.veilleNom === 'string' ? e.veilleNom : null,
    sujet: typeof e.sujet === 'string' ? e.sujet : 'motion',
    image: e.image === true,
    son: e.son !== false,
    retenues: Number.isInteger(e.retenues) && e.retenues > 0 ? e.retenues : 0,
  };
}

class HistoriqueAlertes {
  /**
   * @param {object} o
   * @param {string} o.fichier          alertes.json, dans le dossier de donnees
   * @param {object} [o.journal]
   * @param {(etat: {nonVues: number}) => void} [o.onChange]
   * @param {() => number} [o.horloge]
   * @param {number} [o.delaiEcriture]
   */
  constructor({ fichier, journal, onChange, horloge = Date.now, delaiEcriture = DELAI_ECRITURE_MS }) {
    this.fichier = fichier;
    this.journal = journal;
    this.onChange = onChange || (() => {});
    this.horloge = horloge;
    this.delaiEcriture = delaiEcriture;
    this.entrees = [];
    /** Instant de la derniere visite de l'historique : ce qui suit est « non vu ». */
    this.vu = 0;
    this.minuterie = null;
    this.charger();
  }

  charger() {
    let brut;
    try {
      brut = fs.readFileSync(this.fichier, 'utf8');
    } catch (e) {
      if (e?.code !== 'ENOENT') this.journal?.alerte('alerts', `history unreadable: ${e.message}`);
      return;
    }
    try {
      const doc = JSON.parse(brut);
      this.vu = Number.isFinite(doc?.vu) ? doc.vu : 0;
      this.entrees = (Array.isArray(doc?.entrees) ? doc.entrees : []).map(entreeValide).filter(Boolean);
      this.elaguer();
    } catch (e) {
      // Un fichier abime ne doit ni bloquer les alertes ni etre ecrase sans trace : on le met
      // de cote, et l'historique repart vide.
      this.journal?.alerte('alerts', `history corrupt, set aside: ${e.message}`);
      try { fs.renameSync(this.fichier, `${this.fichier}.illisible`); } catch { /* tant pis */ }
      this.entrees = [];
    }
  }

  /** Retire ce qui a plus de 90 jours, et ce qui depasse le plafond (les plus anciennes). */
  elaguer() {
    const limite = this.horloge() - GARDE_MS;
    this.entrees = this.entrees.filter((e) => e.envoye >= limite);
    if (this.entrees.length > MAX_ENTREES) this.entrees = this.entrees.slice(-MAX_ENTREES);
  }

  /** Une bulle vient de partir. */
  ajouter({ detection, cameraNom, veille, sujet, image, son }) {
    this.entrees.push(entreeValide({
      envoye: this.horloge(), detection, cameraNom,
      veilleId: veille?.id, veilleNom: veille?.nom, sujet, image, son, retenues: 0,
    }));
    this.elaguer();
    this.changer();
  }

  /**
   * La retenue a tu une alerte : elle se compte sur la DERNIERE bulle de cette veille pour ce
   * sujet — c'est elle que la retenue protegeait. Sans bulle anterieure (historique efface
   * entre-temps), rien a quoi la rattacher.
   */
  retenir({ veilleId, sujet }) {
    for (let i = this.entrees.length - 1; i >= 0; i--) {
      const e = this.entrees[i];
      if (e.veilleId === veilleId && e.sujet === sujet) {
        e.retenues += 1;
        this.changer();
        return true;
      }
    }
    return false;
  }

  /** La detection d'une alerte s'est terminee : sa fin rend la vignette et la sequence exactes. */
  terminer(detection) {
    if (!detection?.id || !Number.isFinite(detection.fin)) return;
    let touche = false;
    for (const e of this.entrees) {
      if (e.detection.id === detection.id && e.detection.fin === null) {
        e.detection.fin = detection.fin;
        touche = true;
      }
    }
    if (touche) this.changer();
  }

  /** La plus recente d'abord. */
  liste() {
    return [...this.entrees].reverse();
  }

  nonVues() {
    return this.entrees.filter((e) => e.envoye > this.vu).length;
  }

  marquerVu() {
    this.vu = this.horloge();
    this.changer();
  }

  effacer() {
    const n = this.entrees.length;
    this.entrees = [];
    this.journal?.info('alerts', `history cleared (${n} alert(s))`);
    this.changer();
  }

  /** Une modification : on previent la page, et l'on ecrit bientot. */
  changer() {
    this.onChange({ nonVues: this.nonVues() });
    if (this.minuterie) return;
    this.minuterie = setTimeout(() => { this.minuterie = null; this.ecrire(); }, this.delaiEcriture);
  }

  /** Ecrit tout de suite — a la fermeture, ou quand le delai expire. */
  ecrire() {
    if (this.minuterie) { clearTimeout(this.minuterie); this.minuterie = null; }
    // Fichier provisoire puis renommage : une coupure en pleine ecriture laisse l'ancien
    // historique entier, jamais un fichier tronque.
    const provisoire = `${this.fichier}.${process.pid}.tmp`;
    try {
      fs.mkdirSync(path.dirname(this.fichier), { recursive: true });
      fs.writeFileSync(provisoire, JSON.stringify({ version: 1, vu: this.vu, entrees: this.entrees }));
      fs.renameSync(provisoire, this.fichier);
    } catch (e) {
      try { fs.rmSync(provisoire, { force: true }); } catch { /* deja parti */ }
      this.journal?.erreur('alerts', `history not saved: ${e.message}`);
    }
  }
}

module.exports = { HistoriqueAlertes, GARDE_MS, MAX_ENTREES, entreeValide };
