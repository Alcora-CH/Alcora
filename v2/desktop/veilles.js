'use strict';

/**
 * Les veilles : ce qui merite qu'on previenne, et quand.
 *
 * Conception arretee apres lecture des six ecrans d'alarme de Protect (29.07.2026) et sur
 * les volumes REELS releves sur le poste de reference — colonne « Declenchements (24h) » de sa liste :
 *
 *   Motion 157 · Vehicle 40 · Animal 7 · Vehicle of interest 2 · Person 1 · Barking 1
 *
 * Ce chiffre a renverse la conception precedente. « Notifier chaque detection serait
 * intenable » n'est vrai que du MOUVEMENT : une personne detectee, c'est UNE bulle par
 * jour. Le filtre elabore qu'on imaginait n'a pas lieu d'etre — la nature du sujet fait
 * deja le tri, et c'est pour cela que l'interface affiche le volume attendu avant qu'on
 * n'active quoi que ce soit.
 *
 * Ce qui est repris de Protect : le perimetre par appareils, les profils horaires nommes
 * (leur « Nuit » 00:00-06:00 dit bien mieux les choses qu'un interrupteur), les trois
 * plannings, l'anti-repetition. Ce qui est laisse : le « ET » entre declencheurs, les
 * actions materielles, les destinataires — il y a un utilisateur, devant un PC.
 *
 * Tout ce fichier est PUR : aucune horloge lue en douce, aucun acces au disque. C'est ce
 * qui permet d'eprouver les horaires, ou ce genre de code se trompe toujours.
 * (i18n.js est pur aussi : une table de mots et une variable.)
 */

const { t } = require('./i18n');

/**
 * Vocabulaire d'Alcora, et sa traduction depuis celui du controleur.
 *
 * On ne montre jamais « smartDetectZone : person » a quelqu'un : le nom du champ appartient
 * au controleur, la phrase appartient a celui qui regarde.
 */
/* Le mot montre pour chaque sujet vit dans i18n.js (cles sujet.*) : l'identifiant est
   aussi la cle de traduction, et la bulle part dans la langue du moment. */
const SUJETS = [
  { id: 'person',  depuis: ['person', 'face'] },
  { id: 'vehicle', depuis: ['vehicle', 'licensePlate'] },
  { id: 'animal',  depuis: ['animal'] },
  { id: 'package', depuis: ['package'] },
  { id: 'verre',   depuis: ['alrmGlassBreak', 'glassBreak'] },
  { id: 'fumee',   depuis: ['alrmSmoke', 'smoke'] },
  { id: 'sirene',  depuis: ['alrmSiren', 'siren'] },
  { id: 'co',      depuis: ['alrmCo', 'co'] },
  { id: 'aboiement', depuis: ['alrmBark'] },
  { id: 'parole',  depuis: ['alrmSpeak'] },
  { id: 'bebe',    depuis: ['alrmBabyCry'] },
];

/** Les sujets d'une detection, dans le vocabulaire d'Alcora. */
function sujetsDe(detection) {
  const bruts = Array.isArray(detection?.sujets) ? detection.sujets : [];
  const trouves = SUJETS.filter((s) => s.depuis.some((d) => bruts.includes(d))).map((s) => s.id);
  // Une detection de mouvement SANS sujet identifie reste du mouvement. Avec un sujet, le
  // sujet l'emporte : prevenir « mouvement » quand on sait que c'est une personne serait
  // perdre l'information au moment ou elle compte.
  if (trouves.length === 0 && detection?.type === 'motion') return ['motion'];
  return trouves;
}


/** « 07:30 » vaut 450. Rend null si la forme n'est pas celle attendue. */
function enMinutes(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm ?? ''));
  if (!m) return null;
  const h = Number(m[1]); const min = Number(m[2]);
  if (h > 24 || min > 59) return null;
  return h * 60 + min;
}

/**
 * Cet instant tombe-t-il dans cette plage ?
 *
 * Le cas qui casse tout : une plage qui FRANCHIT MINUIT. « 22:00 -> 02:00 » un samedi
 * couvre aussi le dimanche a une heure du matin — et c'est le jour de DEBUT qui compte,
 * pas celui ou l'on se trouve. Une implementation naive dit « dimanche 01:00 n'est pas
 * dans la plage du samedi », et la veille de nuit ne se declenche jamais.
 */
function dansLaPlage(plage, quand) {
  const debut = enMinutes(plage?.debut);
  const fin = enMinutes(plage?.fin);
  if (debut === null || fin === null) return false;
  const jours = Array.isArray(plage?.jours) ? plage.jours : [];
  if (!jours.length) return false;

  const jour = quand.getDay();
  const minute = quand.getHours() * 60 + quand.getMinutes();

  // Plage ordinaire, dans la journee.
  if (fin > debut) return jours.includes(jour) && minute >= debut && minute < fin;

  // Plage qui franchit minuit : deux morceaux, et le second appartient au jour PRECEDENT.
  if (fin < debut) {
    if (jours.includes(jour) && minute >= debut) return true;
    const veille = (jour + 6) % 7;
    return jours.includes(veille) && minute < fin;
  }

  // debut === fin : journee entiere, par convention (comme « All Day » chez Protect).
  return jours.includes(jour);
}

/** Un profil est actif si l'une de ses plages contient cet instant. */
function profilActif(profil, quand) {
  const plages = Array.isArray(profil?.plages) ? profil.plages : [];
  return plages.some((p) => dansLaPlage(p, quand));
}

/**
 * La veille est-elle en service a cet instant ?
 *
 * Trois plannings, repris de Protect parce que ce sont les trois cas reels :
 *   toujours  — quoi qu'il arrive, meme desarme. Pour le bris de verre et la fumee.
 *   armee     — quand la veille d'Alcora est active ET qu'un profil couvre l'instant.
 *   horaire   — un horaire propre a cette veille, independant de l'armement.
 */
function veilleActive(veille, config, quand) {
  if (!veille?.actif) return false;

  if (veille.quand === 'toujours') return true;

  if (veille.quand === 'horaire') {
    return profilActif({ plages: veille.plages }, quand);
  }

  // « armee » : l'interrupteur d'Alcora d'abord, puis les profils qui lui sont attaches.
  if (!config?.armee) return false;
  const profils = Array.isArray(config?.profils) ? config.profils : [];
  const retenus = Array.isArray(veille.profils) && veille.profils.length
    ? profils.filter((p) => veille.profils.includes(p.id))
    : profils;
  // Armee sans aucun profil : la veille vaut en permanence. Un armement sans horaire est
  // un armement, pas une absence de regle.
  if (!retenus.length) return true;
  return retenus.some((p) => profilActif(p, quand));
}

/**
 * Les veilles que cette detection declenche.
 *
 * Une detection qui SE TERMINE ne declenche rien : prevenir a la fin previendrait une
 * seconde fois du meme passage. Seul son commencement compte.
 */
function veillesDeclenchees(detection, config, quand = new Date()) {
  if (!detection?.commence) return [];
  const sujets = sujetsDe(detection);
  if (!sujets.length) return [];

  const veilles = Array.isArray(config?.veilles) ? config.veilles : [];
  return veilles.filter((v) => {
    const vus = Array.isArray(v.sujets) ? v.sujets : [];
    if (!sujets.some((s) => vus.includes(s))) return false;
    // Perimetre vide = toutes les cameras. C'est le cas le plus courant, et exiger de
    // toutes les cocher serait un piege silencieux a l'ajout d'une camera.
    const cams = Array.isArray(v.cameras) ? v.cameras : [];
    if (cams.length && detection.camera && !cams.includes(detection.camera)) return false;
    return veilleActive(v, config, quand);
  });
}

/**
 * Anti-repetition.
 *
 * « Ignorer les Actions Repetees » chez Protect, dit ici en clair : au plus une bulle par
 * veille et par sujet sur une duree donnee. Sans cela, une personne qui reste dans le champ
 * produit une detection toutes les quinze secondes, et autant de bulles.
 */
class Retenue {
  constructor() { this.derniers = new Map(); }

  /** @returns {boolean} vrai si l'on peut prevenir maintenant */
  autorise(cleVeille, sujet, delaiMs, quand) {
    const cle = `${cleVeille}|${sujet}`;
    const precedent = this.derniers.get(cle);
    if (precedent !== undefined && quand - precedent < delaiMs) return false;
    this.derniers.set(cle, quand);
    return true;
  }

  oublier() { this.derniers.clear(); }
}

/** Configuration de depart : ce qui compte, et rien qui noie. */
function veillesParDefaut() {
  return {
    armee: true,
    profils: [
      // Les noms sont semes dans la langue du moment de la PREMIERE ouverture, puis
      // appartiennent a l'utilisateur : changer de langue ne les renomme pas, pas plus
      // qu'un nom qu'il aurait choisi lui-meme.
      { id: 'nuit', nom: t('veilles.profilNuit'),
        plages: [{ jours: [0, 1, 2, 3, 4, 5, 6], debut: '22:00', fin: '07:00' }] },
    ],
    veilles: [
      { id: 'personne', nom: t('veilles.nomPersonne'), actif: true,
        sujets: ['person'], cameras: [], quand: 'armee', profils: ['nuit'],
        son: true, retenueMs: 300_000 },
      // Urgences : hors de tout horaire et de tout armement. Une fumee a quinze heures
      // compte autant qu'a trois heures du matin.
      { id: 'urgences', nom: t('veilles.nomUrgences'), actif: true,
        sujets: ['verre', 'fumee', 'sirene', 'co'], cameras: [], quand: 'toujours',
        profils: [], son: true, retenueMs: 60_000 },
    ],
  };
}

module.exports = {
  SUJETS, sujetsDe, enMinutes, dansLaPlage, profilActif, veilleActive,
  veillesDeclenchees, Retenue, veillesParDefaut,
};
