'use strict';

/**
 * La recherche fine : correspondance tolerante, aplatissement, seuil.
 *
 *   node test-recherche.js
 *
 * Deux endroits ou l'erreur serait SILENCIEUSE, et c'est sur eux que porte l'essentiel :
 *
 *   1. le SEUIL applique aux sons. Ils valent zero par construction — 615 « parole » sur le
 *      poste de reference, toutes a zero — et les y soumettre les ferait disparaitre des le premier
 *      cran. Personne ne verrait d'erreur : juste une liste vide, qui ressemble a « il ne
 *      s'est rien passe » ;
 *   2. la correspondance de plaque. Le controleur ne rend pas UNE plaque mais une liste de
 *      lectures possibles, ou seuls les caracteres confondus par la lecture optique
 *      changent. Chercher le texte exact ne trouverait rien une fois sur deux.
 *
 * Toutes les plaques de ces verifications sont FICTIVES. Les vraies ont fui une fois par
 * une sonde mal masquee ; elles n'entreront pas ici.
 */

const {
  canon, correspond, attribut, objetsDe, textesDe, filtrer, recenser, CONFUSIONS,
} = require('./recherche');

let echecs = 0;

function check(label, attendu, obtenu) {
  const ok = JSON.stringify(attendu) === JSON.stringify(obtenu);
  if (!ok) echecs++;
  console.log(`${ok ? '  OK  ' : ' ECHEC'}  ${label.padEnd(56)}`);
  if (!ok) console.log(`          attendu ${JSON.stringify(attendu)} · obtenu ${JSON.stringify(obtenu)}`);
}

function checkBool(label, condition) {
  if (!condition) echecs++;
  console.log(`${condition ? '  OK  ' : ' ECHEC'}  ${label}`);
}

console.log('=== Forme canonique d’une plaque ===');
{
  check('majuscules et separateurs ignores', canon('ab 123-456'), canon('AB123456'));
  checkBool('O, Q et D se confondent avec 0',
    canon('AO1') === canon('A01') && canon('AQ1') === canon('A01') && canon('AD1') === canon('A01'));
  checkBool('I, L, T et 7 se confondent avec 1',
    canon('AI2') === canon('A12') && canon('AL2') === canon('A12')
    && canon('AT2') === canon('A12') && canon('A72') === canon('A12'));
  checkBool('Z se confond avec 2', canon('AZ3') === canon('A23'));
  checkBool('S avec 5, B avec 8, G avec 6',
    canon('AS') === canon('A5') && canon('AB') === canon('A8') && canon('AG') === canon('A6'));
  checkBool('deux textes reellement differents restent differents',
    canon('AB123456') !== canon('AB123457'));
  check('texte vide', '', canon(''));
  check('absent', '', canon(undefined));
}

console.log('\n=== Correspondance tolerante ===');
{
  // Ce que le controleur rend REELLEMENT pour une plaque : des variantes de lecture, ou
  // seuls les caracteres confondus changent. Plaques fictives.
  const candidats = ['AB123456', 'AB1Z3456', 'AB12345G', 'A8123456', 'AB1234S6'];

  checkBool('la plaque exacte est trouvee', correspond('AB123456', candidats));
  checkBool('avec des espaces et un tiret', correspond('ab 123-456', candidats));
  checkBool('en confondant Z et 2', correspond('AB1Z3456', candidats));
  checkBool('en confondant B et 8', correspond('A8123456', candidats));
  checkBool('en confondant G et 6', correspond('AB12345G', candidats));

  // Le cas qui compte a l'usage : on ne se souvient que de la fin.
  checkBool('les trois derniers chiffres suffisent', correspond('456', candidats));
  checkBool('le debut suffit aussi', correspond('AB1', candidats));

  checkBool('une plaque etrangere ne correspond pas', !correspond('XY999888', candidats));
  checkBool('requete vide : aucune correspondance', !correspond('', candidats));
  checkBool('aucun candidat', !correspond('AB123456', []));
  checkBool('candidats absents', !correspond('AB123456', undefined));
}

console.log('\n=== Aplatissement d’une detection en objets ===');
{
  const noms = new Map([['cam1', 'G6 Bullet']]);
  const evenement = {
    id: 'e1', camera: 'cam1', start: 1000, score: 70, thumbnail: 'x',
    smartDetectTypes: ['vehicle', 'person'],
    metadata: {
      detectedThumbnails: [
        { type: 'vehicle', objectId: 'o1', confidence: 82,
          attributes: { objectType: 'vehicle', vehicleType: { val: 'suv', confidence: 91 },
                        color: { val: 'gray', confidence: 69 } } },
        { type: 'person', objectId: 'o2', confidence: 65, attributes: { objectType: 'person' } },
      ],
    },
  };
  const objets = objetsDe(evenement, noms);
  check('une detection, DEUX objets', 2, objets.length);
  check('  le vehicule', 'vehicle', objets[0].type);
  check('  son type', 'suv', objets[0].vehicule.valeur);
  check('  la confiance de CE type', 91, objets[0].vehicule.confiance);
  check('  sa couleur', 'gray', objets[0].couleur.valeur);
  // Le point qui compte : la confiance de l'attribut n'est PAS celle de l'objet.
  check('  la confiance de la couleur diffère de celle de l’objet', 69, objets[0].couleur.confiance);
  check('  celle de l’objet', 82, objets[0].confiance);
  check('  la personne', 'person', objets[1].type);
  check('  sans attributs de vehicule', null, objets[1].vehicule);
  check('  le nom de camera est resolu', 'G6 Bullet', objets[0].cameraNom);
}
{
  // Sans vignette : la detection existe quand meme et ne doit pas se perdre.
  const objets = objetsDe({ id: 'e2', camera: 'c', start: 5, score: 0,
                            smartDetectTypes: ['alrmSpeak'], metadata: {} });
  check('detection sonore sans vignette : un objet quand meme', 1, objets.length);
  check('  son type', 'alrmSpeak', objets[0].type);
  check('  son score', 0, objets[0].confiance);
}
{
  check('detection vide', [], objetsDe({ id: 'e3' }));
  check('rien du tout', [], objetsDe(null));
}

console.log('\n=== Les textes reconnus ne quittent PAS le processus principal ===');
{
  const evenement = {
    id: 'e4', camera: 'c', start: 1,
    metadata: { detectedThumbnails: [{
      type: 'vehicle', objectId: 'o', confidence: 80,
      name: 'AB123456',
      attributes: { matchedName: 'AB123456',
                    topKCandidate: [{ name: 'AB123456', confidence: 0.9 },
                                    { name: 'AB1Z3456', confidence: 0.4 }] },
      group: { matchedName: 'AB123456' },
    }] },
  };
  const [objet] = objetsDe(evenement);
  const serialise = JSON.stringify(objet);
  checkBool('aucun texte reconnu dans l’objet rendu', !serialise.includes('AB123456'));
  checkBool('  ni sous forme confondue', !serialise.includes('AB1Z3456'));
  check('  mais l’objet SAIT qu’il est identifie', true, objet.identifie);

  const textes = textesDe(evenement.metadata.detectedThumbnails[0]);
  checkBool('les textes restent accessibles ici pour la recherche', textes.length >= 4);
  checkBool('  et la recherche tolerante les trouve', correspond('AB1Z3456', textes));
}

console.log('\n=== Le seuil, et le piege des sons ===');
{
  const objets = [
    { type: 'person', confiance: 10, camera: 'c' },
    { type: 'person', confiance: 65, camera: 'c' },
    { type: 'vehicle', confiance: 88, camera: 'c' },
    // Ceux-la valent zero PAR CONSTRUCTION : 615 « parole » sur le poste de reference, toutes a zero.
    { type: 'alrmSpeak', confiance: 0, camera: 'c' },
    { type: 'alrmBark', confiance: 0, camera: 'c' },
  ];

  check('sans seuil : tout passe', 5, filtrer(objets).length);
  check('seuil a 30 : la personne a 10 tombe', 4, filtrer(objets, { seuil: 30 }).length);
  check('seuil a 70 : il reste le vehicule et les deux sons', 3, filtrer(objets, { seuil: 70 }).length);

  // LE point de ce fichier : un seuil ne doit jamais faire taire les sons.
  const sons = filtrer(objets, { seuil: 90 }).filter((o) => o.type.startsWith('alrm'));
  check('seuil a 90 : les DEUX sons survivent', 2, sons.length);
  checkBool('  et aucun sujet visuel ne survit',
    filtrer(objets, { seuil: 90 }).every((o) => o.type.startsWith('alrm')));

  // Confiance absente sur un sujet visuel : on ne peut pas affirmer qu'elle depasse.
  check('sujet visuel sans confiance, avec seuil : ecarte', 0,
    filtrer([{ type: 'person', confiance: null }], { seuil: 1 }).length);
  check('  mais garde sans seuil', 1, filtrer([{ type: 'person', confiance: null }]).length);
}

console.log('\n=== Les autres criteres ===');
{
  const objets = [
    { type: 'vehicle', confiance: 80, camera: 'a', vehicule: { valeur: 'suv' }, couleur: { valeur: 'gray' } },
    { type: 'vehicle', confiance: 80, camera: 'b', vehicule: { valeur: 'car' }, couleur: { valeur: 'white' } },
    { type: 'person', confiance: 80, camera: 'a', vehicule: null, couleur: null },
  ];
  check('par sujet', 2, filtrer(objets, { sujets: ['vehicle'] }).length);
  check('par camera', 2, filtrer(objets, { cameras: ['a'] }).length);
  check('par type de vehicule', 1, filtrer(objets, { types: ['suv'] }).length);
  check('par couleur', 1, filtrer(objets, { couleurs: ['white'] }).length);
  check('une personne n’a pas de type de vehicule : ecartee', 0,
    filtrer([objets[2]], { types: ['suv'] }).length);
  check('criteres combines', 1, filtrer(objets, { sujets: ['vehicle'], cameras: ['a'] }).length);
}

console.log('\n=== Recensement : ne proposer que ce qui existe ===');
{
  const objets = [
    { type: 'vehicle', vehicule: { valeur: 'suv' }, couleur: { valeur: 'gray' } },
    { type: 'vehicle', vehicule: { valeur: 'suv' }, couleur: { valeur: 'white' } },
    { type: 'vehicle', vehicule: { valeur: 'car' }, couleur: { valeur: 'gray' } },
    { type: 'person', vehicule: null, couleur: null },
  ];
  const r = recenser(objets);
  check('sujets, du plus frequent au moins', [{ valeur: 'vehicle', n: 3 }, { valeur: 'person', n: 1 }], r.sujets);
  check('types de vehicule', [{ valeur: 'suv', n: 2 }, { valeur: 'car', n: 1 }], r.types);
  check('couleurs', [{ valeur: 'gray', n: 2 }, { valeur: 'white', n: 1 }], r.couleurs);
  // Ce qui n'est jamais passe ne doit PAS apparaitre : cocher un filtre vide est une impasse.
  checkBool('« camion » n’apparait pas : aucun n’est passe',
    !r.types.some((t) => t.valeur === 'truck'));
  check('rien a recenser', { sujets: [], types: [], couleurs: [] }, recenser([]));
}

console.log('\n=== Lecture d’un attribut, quelle que soit sa forme ===');
{
  check('objet avec val et confiance', { valeur: 'suv', confiance: 91 },
    attribut({ vehicleType: { val: 'suv', confidence: 91 } }, 'vehicleType'));
  check('valeur simple', { valeur: 'vehicle', confiance: null },
    attribut({ objectType: 'vehicle' }, 'objectType'));
  check('attribut absent', null, attribut({}, 'vehicleType'));
  check('attributs absents', null, attribut(undefined, 'vehicleType'));
  check('objet sans val', null, attribut({ x: { confidence: 5 } }, 'x'));
}

console.log('\n=== Les classes de confusion sont coherentes ===');
{
  const vus = new Set();
  let doublons = 0;
  for (const classe of CONFUSIONS) {
    for (const c of classe) { if (vus.has(c)) doublons++; vus.add(c); }
  }
  check('aucun caractere dans deux classes', 0, doublons);
  checkBool('chaque classe compte au moins deux caracteres',
    CONFUSIONS.every((c) => c.length >= 2));
}

console.log('\n' + (echecs === 0 ? 'TOUS LES TESTS PASSENT' : `${echecs} VERIFICATION(S) EN ECHEC`));
process.exit(echecs === 0 ? 0 : 1);
