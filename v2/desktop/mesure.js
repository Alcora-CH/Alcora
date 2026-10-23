'use strict';

/**
 * La charge de l'application, MESUREE et consignee dans le journal — avec son contexte.
 *
 * Le chantier UX (docs/plan-ux.md) vise un PC modeste et ne promet aucun gain sans un
 * avant/apres chiffre. La premiere mesure, le 23.10.2026, a ete prise de l'exterieur
 * (Get-Process sur le poste de reference) : page 28 % d'un coeur, processus graphique 29 %
 * et 914 Mo. Elle ne disait pas ce que montrait la fenetre, ni si elle etait visible — deux
 * conditions qui changent tout, puisque Chromium ralentit une page cachee. Ces lignes le
 * disent, et deux journaux se comparent alors ligne a ligne, sur le poste de reference comme sur un PC
 * plus faible.
 *
 * Une ligne couvre un INTERVALLE : la periode reguliere, ou ce qui precede un changement de
 * contexte (on passe du direct aux reglages). Chaque chiffre est la moyenne de cet
 * intervalle, en pourcentage d'UN coeur (Chromium : « peut depasser 100 % »), la memoire en
 * octets prives, en Mo. Le relais (mediamtx) n'y est pas : ce n'est pas un processus
 * d'Electron, et le mesurer demanderait d'interroger Windows a chaque tour.
 */

const PERIODE_MS = 5 * 60_000;
/** En dessous, un intervalle ne dit rien : un changement d'ecran tous les trois clics. */
const DUREE_MIN_MS = 30_000;

/** Les contextes que la page peut annoncer — tout le reste est refuse, pas recopie. */
const ESPACES = ['direct', 'detections', 'relecture', 'alertes', 'reglages', 'systeme', 'connexion'];

/**
 * Le role d'un processus d'Electron, d'apres app.getAppMetrics().
 * `type` : Browser, Tab, GPU, Utility… ; `serviceName` precise les utilitaires.
 */
function role(m) {
  if (m.type === 'Browser') return 'main';
  if (m.type === 'Tab') return 'renderer';
  if (m.type === 'GPU') return 'gpu';
  if (m.type === 'Utility' && /network/i.test(m.serviceName ?? '')) return 'network';
  if (m.type === 'Utility' && /audio/i.test(m.serviceName ?? '')) return 'audio';
  return 'other';
}

const ORDRE = ['main', 'renderer', 'gpu', 'network', 'audio', 'other'];

/**
 * Le processeur d'un processus sur l'intervalle, en % d'UN coeur.
 *
 * Calcule par DIFFERENCE de temps processeur cumule (secondes), jamais lu dans
 * « percentCPUUsage ». Mesure du 23.10.2026 sous Electron 45 : une page qui calcule 90 % du
 * temps y valait 2,74 — le chiffre est rapporte a TOUTE la machine (88 % / 32 fils = 2,75)
 * et sort meme negatif pour un utilitaire au repos (-0,04). Le temps cumule, lui, disait
 * 4,43 s en 5 s. Lu tel quel, chaque avant/apres aurait ete faux d'un facteur trente-deux.
 *
 * Un processus absent du releve precedent est ne pendant l'intervalle : tout son temps
 * cumule lui appartient. De meme si son temps RECULE : Windows a redonne son identifiant a
 * un processus neuf. Sans temps cumule (ancienne version), on retombe sur l'autre chiffre,
 * faute de mieux.
 */
function processeur(m, avant, dureeMs) {
  const cumul = Number(m.cpu?.cumulativeCPUUsage);
  if (!Number.isFinite(cumul) || !(dureeMs > 0)) return Number(m.cpu?.percentCPUUsage) || 0;
  const precedent = avant?.get(m.pid) ?? 0;
  const ecoule = cumul >= precedent ? cumul - precedent : cumul;
  return ecoule / (dureeMs / 1000) * 100;
}

/**
 * Additionne par role. La memoire d'Electron est en kilo-octets ; « privateBytes » n'existe
 * que sous Windows, on se rabat sinon sur l'ensemble de travail.
 *
 * @param {Map<number, number>} [avant]  temps cumule de chaque processus au releve precedent
 * @param {number} [dureeMs]             duree de l'intervalle
 * @returns {Record<string, { cpu: number, mo: number, n: number }>}
 */
function resumer(metriques, avant, dureeMs) {
  const r = {};
  for (const m of metriques ?? []) {
    const cle = role(m);
    const cpu = processeur(m, avant, dureeMs);
    const ko = Number(m.memory?.privateBytes ?? m.memory?.workingSetSize) || 0;
    r[cle] ??= { cpu: 0, mo: 0, n: 0 };
    r[cle].cpu += cpu;
    r[cle].mo += ko / 1024;
    r[cle].n += 1;
  }
  return r;
}

/** Le temps cumule de chaque processus d'un releve, pour le releve suivant. */
function cumuls(metriques) {
  const c = new Map();
  for (const m of metriques ?? []) {
    const v = Number(m.cpu?.cumulativeCPUUsage);
    if (Number.isFinite(v)) c.set(m.pid, v);
  }
  return c;
}

/**
 * Le contexte annonce par la page, reduit a ce qu'on accepte d'ecrire au journal : il vient
 * d'un processus moins fiable que celui-ci, et rien de ce qu'il envoie ne doit pouvoir
 * fabriquer une ligne trompeuse.
 */
function normaliser(c) {
  if (!c || typeof c !== 'object') return null;
  const espace = ESPACES.includes(c.espace) ? c.espace : null;
  const tuiles = Number.isInteger(c.tuiles) && c.tuiles >= 0 && c.tuiles <= 64 ? c.tuiles : null;
  const ciel = c.ciel === 'anime' || c.ciel === 'fixe' || c.ciel === 'aucun' ? c.ciel : null;
  if (espace === null) return null;
  return { espace, tuiles, ciel };
}

/*
 * Ce qui change la charge, et seulement cela : Chromium ralentit une page cachee ou
 * reduite, pas une fenetre visible qui a perdu le focus. Distinguer le focus ecrirait une
 * ligne a chaque clic dans une autre application, pour rien.
 */
function fenetre(e) {
  if (!e) return 'unknown';
  if (e.minimisee) return 'minimized';
  return e.visible ? 'visible' : 'hidden';
}

/** La ligne du journal — en anglais, comme tout le journal. */
function ligne(resume, contexte, etatFenetre, dureeMs) {
  const ctx = [
    `screen=${contexte?.espace ?? 'unknown'}`,
    ...(contexte?.tuiles != null ? [`tiles=${contexte.tuiles}`] : []),
    `window=${fenetre(etatFenetre)}`,
    ...(contexte?.ciel ? [`sky=${contexte.ciel}`] : []),
  ].join(' ');
  const parts = ORDRE.filter((k) => resume[k]).map((k) => {
    const x = resume[k];
    return `${k}${x.n > 1 ? ` x${x.n}` : ''} ${x.cpu.toFixed(1)}% ${Math.round(x.mo)} MB`;
  });
  return `load over ${Math.round(dureeMs / 1000)} s [${ctx}]: ${parts.join(', ')} (CPU in % of one core)`;
}

/**
 * Le compteur. `obtenir` lit app.getAppMetrics() ; le releve du depart sert de point de
 * reference, et chaque fin d'intervalle compare le temps processeur cumule de chaque
 * processus a celui du releve precedent (voir `processeur`).
 */
class Mesure {
  constructor({ obtenir, etatFenetre, journal, periodeMs = PERIODE_MS, horloge = Date.now }) {
    this.obtenir = obtenir;
    this.etatFenetre = etatFenetre;
    this.journal = journal;
    this.periodeMs = periodeMs;
    this.horloge = horloge;
    this.ctx = null;
    this.depuis = null;
    /** Temps processeur cumule de chaque processus, au releve precedent. */
    this.avant = new Map();
    this.etat = null;
    this.minuterie = null;
  }

  demarrer() {
    this.avant = cumuls(this.obtenir());  // amorce : le point de depart des differences
    this.depuis = this.horloge();
    this.etat = this.etatFenetre();
    this.minuterie = setInterval(() => this.consigner(), this.periodeMs);
  }

  /**
   * La page a change d'ecran, de nombre de tuiles ou de ciel : on clot l'intervalle.
   *
   * Un passage de moins de trente secondes n'est pas consigne seul : il s'ajoute a
   * l'intervalle suivant, et compte donc pour le contexte suivant. Mieux vaut cette
   * imprecision bornee qu'une ligne par clic.
   */
  contexte(brut) {
    const c = normaliser(brut);
    if (!c) return false;
    if (this.ctx && JSON.stringify(c) === JSON.stringify(this.ctx)) return true;
    this.consigner();
    this.ctx = c;
    return true;
  }

  /**
   * Ecrit l'intervalle ecoule s'il est assez long, et en ouvre un nouveau.
   *
   * L'etat de la fenetre est celui du DEBUT de l'intervalle : releve a la fin, une fenetre
   * reduite il y a une seconde ferait passer cinq minutes de direct pour une fenetre
   * reduite. Le principal appelle `fenetreChangee()` a chaque reduction ou restauration,
   * si bien qu'un intervalle n'a jamais qu'un seul etat.
   */
  consigner() {
    if (this.depuis === null) return;
    const maintenant = this.horloge();
    const duree = maintenant - this.depuis;
    if (duree < DUREE_MIN_MS) return;
    const metriques = this.obtenir();
    this.journal.info('metrics', ligne(resumer(metriques, this.avant, duree), this.ctx, this.etat, duree));
    this.avant = cumuls(metriques);
    this.depuis = maintenant;
    this.etat = this.etatFenetre();
  }

  /** La fenetre vient d'etre reduite, restauree, cachee ou montree. */
  fenetreChangee() {
    this.consigner();
    this.etat = this.etatFenetre();
  }

  arreter() {
    if (this.minuterie) clearInterval(this.minuterie);
    this.minuterie = null;
  }
}

module.exports = { Mesure, resumer, cumuls, normaliser, ligne, role, PERIODE_MS, DUREE_MIN_MS, ESPACES };
