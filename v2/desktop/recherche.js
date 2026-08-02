'use strict';

/**
 * Recherche fine dans les detections.
 *
 * Tout ce fichier est PUR : aucun reseau, aucune horloge, aucun disque. C'est ce qui permet
 * d'eprouver la correspondance tolerante, qui est la partie delicate.
 *
 * Conception arretee sur la mesure V-Attributs du 29.07.2026 :
 *
 *  · les attributs vivent dans `metadata.detectedThumbnails[]`, UN PAR OBJET. Une detection
 *    peut en porter plusieurs — 1405 objets pour 1242 detections sur le poste de reference — et les fondre
 *    perdrait la deuxieme voiture ou le pieton qui passait derriere ;
 *  · le controleur filtre par SUJET (honore) mais pas par SCORE (ignore). Le premier part
 *    donc au controleur, le second se calcule ici ;
 *  · les sujets SONORES ont un score de zero. Un seuil applique a eux les ferait tous
 *    disparaitre des le premier cran, sans un mot.
 */

/** Sujets qui portent un score exploitable. Les autres valent zero par construction. */
const SUJETS_VISUELS = new Set(['person', 'vehicle', 'animal', 'face', 'licensePlate']);

/** Types d'objet qu'on sait presenter. */
const TYPES_OBJET = new Set(['person', 'vehicle', 'animal', 'face', 'licensePlate']);

/**
 * Classes de caracteres que la lecture optique confond.
 *
 * Relevees dans les CANDIDATS reels rendus par le controleur : pour une meme plaque il
 * propose des variantes ou seuls ces caracteres changent. Chercher le texte exact ne
 * trouverait donc rien une fois sur deux — la recherche doit ramener toutes ces formes a
 * une seule avant de comparer.
 */
const CONFUSIONS = ['0OQD', '1ILT7', '2Z', '5S', '8B', '6G', '4A'];

const VERS_CANON = new Map();
for (const classe of CONFUSIONS) {
  for (const c of classe) VERS_CANON.set(c, classe[0]);
}

/**
 * Forme canonique d'un texte de plaque : majuscules, sans separateur, confusions reduites.
 * « VD 352-174 », « VO352I74 » et « V0352l74 » donnent tous la meme chaine.
 */
function canon(texte) {
  const brut = String(texte ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  let out = '';
  for (const c of brut) out += VERS_CANON.get(c) ?? c;
  return out;
}

/**
 * La requete correspond-elle a l'une des lectures proposees ?
 *
 * On accepte une correspondance PARTIELLE : taper les trois derniers chiffres d'une plaque
 * doit suffire. Quelqu'un qui cherche se souvient rarement de la plaque entiere.
 */
function correspond(requete, candidats) {
  const q = canon(requete);
  if (!q) return false;
  for (const c of candidats ?? []) {
    if (canon(c).includes(q)) return true;
  }
  return false;
}

/** Valeur et confiance d'un attribut, quelle que soit la forme qu'il prend. */
function attribut(attrs, nom) {
  const v = attrs?.[nom];
  if (v === undefined || v === null) return null;
  if (typeof v === 'object') {
    const valeur = v.val ?? v.value;
    if (valeur === undefined || valeur === null) return null;
    return { valeur: String(valeur), confiance: Number.isFinite(v.confidence) ? v.confidence : null };
  }
  return { valeur: String(v), confiance: null };
}

/**
 * Aplatit une detection en OBJETS.
 *
 * `sujets` porte les textes sensibles — plaque reconnue, nom associe. Ils ne sont JAMAIS
 * inclus dans l'objet rendu : la page ne doit pas les recevoir sans qu'on l'ait voulu. Ils
 * sortent a part, pour que la recherche se fasse cote processus principal.
 */
function objetsDe(evenement, noms) {
  const vignettes = evenement?.metadata?.detectedThumbnails;
  const debut = Number.isFinite(evenement?.start) ? evenement.start : null;

  // Aucune vignette : la detection existe quand meme, on la rend comme un objet unique.
  if (!Array.isArray(vignettes) || !vignettes.length) {
    const type = (evenement?.smartDetectTypes ?? [])[0] ?? evenement?.type ?? null;
    if (!type) return [];
    return [{
      id: evenement.id ?? null,
      objectId: `${evenement.id ?? '?'}#0`,
      camera: evenement.camera ?? null,
      cameraNom: noms?.get(evenement.camera) ?? null,
      debut,
      type,
      confiance: Number.isFinite(evenement.score) ? evenement.score : null,
      vehicule: null, couleur: null,
      identifie: false,
      vignette: Boolean(evenement.thumbnail),
    }];
  }

  return vignettes.map((v, i) => {
    const attrs = v.attributes ?? {};
    const type = String(v.type ?? attribut(attrs, 'objectType')?.valeur ?? 'inconnu');
    // Les textes reconnus : gardes hors de l'objet, et seulement resumes par un booleen.
    const identifie = Boolean(v.name || attrs.matchedName || v.group?.matchedName);
    return {
      id: evenement.id ?? null,
      objectId: String(v.objectId ?? `${evenement.id ?? '?'}#${i}`),
      camera: evenement.camera ?? null,
      cameraNom: noms?.get(evenement.camera) ?? null,
      debut,
      type,
      confiance: Number.isFinite(v.confidence) ? v.confidence : null,
      vehicule: attribut(attrs, 'vehicleType'),
      couleur: attribut(attrs, 'color'),
      /** Un nom ou une plaque a ete reconnu. Le TEXTE ne quitte pas le processus principal. */
      identifie,
      vignette: Boolean(evenement.thumbnail),
    };
  });
}

/** Textes reconnus d'un objet, pour la recherche cote processus principal. */
function textesDe(vignette) {
  const attrs = vignette?.attributes ?? {};
  const sortie = [];
  if (vignette?.name) sortie.push(vignette.name);
  if (attrs.matchedName) sortie.push(attrs.matchedName);
  if (vignette?.group?.matchedName) sortie.push(vignette.group.matchedName);
  for (const c of attrs.topKCandidate ?? []) if (c?.name) sortie.push(c.name);
  for (const n of attrs.namesTopK ?? []) if (typeof n === 'string') sortie.push(n);
  return sortie;
}

/**
 * Applique les criteres qui ne peuvent pas partir au controleur.
 *
 * Le SEUIL est le point delicat : il ne s'applique qu'aux sujets visuels. Les detections
 * sonores valent zero par construction — mesure du 29.07 : 615 « parole », toutes a zero —
 * et les soumettre au seuil les supprimerait toutes des le premier cran.
 */
function filtrer(objets, criteres = {}) {
  const { seuil = 0, types = [], couleurs = [], cameras = [], sujets = [] } = criteres;

  return (objets ?? []).filter((o) => {
    if (sujets.length && !sujets.includes(o.type)) return false;
    if (cameras.length && o.camera && !cameras.includes(o.camera)) return false;

    // Le seuil epargne ce qui n'a pas de score a offrir.
    if (seuil > 0 && SUJETS_VISUELS.has(o.type)) {
      if (o.confiance === null || o.confiance < seuil) return false;
    }

    if (types.length && !(o.vehicule && types.includes(o.vehicule.valeur))) return false;
    if (couleurs.length && !(o.couleur && couleurs.includes(o.couleur.valeur))) return false;
    return true;
  });
}

/**
 * Compte ce qui existe REELLEMENT, pour peupler les filtres.
 *
 * C'est le seul endroit ou l'on fait mieux que Protect : leurs listes proposent des choix
 * theoriques — berline, camion, fourgonnette… — sans dire lesquels sont passes. Cocher un
 * filtre vide est une impasse qu'on peut eviter.
 */
function recenser(objets) {
  const compter = (m, k) => { if (k) m.set(k, (m.get(k) ?? 0) + 1); };
  const sujets = new Map(); const types = new Map(); const couleurs = new Map();
  for (const o of objets ?? []) {
    compter(sujets, o.type);
    compter(types, o.vehicule?.valeur);
    compter(couleurs, o.couleur?.valeur);
  }
  const trier = (m) => [...m].sort((a, b) => b[1] - a[1]).map(([valeur, n]) => ({ valeur, n }));
  return { sujets: trier(sujets), types: trier(types), couleurs: trier(couleurs) };
}

module.exports = {
  canon, correspond, attribut, objetsDe, textesDe, filtrer, recenser,
  SUJETS_VISUELS, TYPES_OBJET, CONFUSIONS,
};
