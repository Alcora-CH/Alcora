'use strict';

/**
 * Le decodeur du format temps reel de Protect, eprouve sur des trames fabriquees.
 *
 *   node test-updates.js
 *
 * Ce format n'est pas publie : ce qu'on en lit est OBSERVE. Deux consequences pour ces
 * verifications. D'abord elles fabriquent les trames selon la structure observee, ce qui
 * teste le decodeur, pas la specification. Ensuite — et c'est le plus important — elles
 * verifient surtout que tout ce qui ne se comprend pas est IGNORE proprement : sur une
 * liaison qui tourne des nuits entieres, un message inattendu ne doit produire ni fausse
 * alerte, ni plantage, ni journal noye.
 */

const zlib = require('node:zlib');
const {
  lireMessage, versDetection, paquets, contenu, TYPES_DETECTION, REPRISES_MS,
} = require('./protect/updates');

let echecs = 0;

function check(label, attendu, obtenu) {
  const ok = JSON.stringify(attendu) === JSON.stringify(obtenu);
  if (!ok) echecs++;
  console.log(`${ok ? '  OK  ' : ' ECHEC'}  ${label.padEnd(56)}`);
  if (!ok) {
    console.log(`          attendu = ${JSON.stringify(attendu)}`);
    console.log(`          obtenu  = ${JSON.stringify(obtenu)}`);
  }
}

function checkBool(label, condition) {
  if (!condition) echecs++;
  console.log(`${condition ? '  OK  ' : ' ECHEC'}  ${label}`);
}

/** Fabrique un paquet au format observe : huit octets d'en-tete, puis la charge. */
function paquet(type, valeur, { comprimee = false, format = 1 } = {}) {
  let charge = format === 1 ? Buffer.from(JSON.stringify(valeur), 'utf8')
             : format === 2 ? Buffer.from(String(valeur), 'utf8')
             : Buffer.from(valeur);
  if (comprimee) charge = zlib.deflateSync(charge);
  const tete = Buffer.alloc(8);
  tete[0] = type; tete[1] = format; tete[2] = comprimee ? 1 : 0;
  tete.writeUInt32BE(charge.length, 4);
  return Buffer.concat([tete, charge]);
}

const message = (action, donnees, opts) =>
  Buffer.concat([paquet(1, action, opts), paquet(2, donnees, opts)]);

console.log('=== Structure d’un message ===');
{
  const m = message({ action: 'add', modelKey: 'event', id: 'e1', newUpdateId: 'u9' },
                    { type: 'smartDetectZone', start: 1000, camera: 'c1' });
  check('deux paquets reperes', 2, paquets(m).length);
  const lu = lireMessage(m);
  check('action lue', 'add', lu.action.action);
  check('donnees lues', 'smartDetectZone', lu.donnees.type);
  check('point de reprise', 'u9', lu.action.newUpdateId);
}
{
  // Comprimee : c'est ainsi que voyagent les gros messages.
  const m = message({ action: 'update', modelKey: 'event', id: 'e2' },
                    { type: 'motion', end: 2000 }, { comprimee: true });
  const lu = lireMessage(m);
  check('message comprime : action', 'update', lu.action.action);
  check('message comprime : donnees', 2000, lu.donnees.end);
}
{
  // Ordre inverse : on cherche par TYPE, on ne suppose pas la position.
  const m = Buffer.concat([
    paquet(2, { type: 'motion', start: 5 }),
    paquet(1, { action: 'add', modelKey: 'event', id: 'e3' }),
  ]);
  const lu = lireMessage(m);
  checkBool('paquets dans l’ordre inverse : lus quand meme', lu?.action.id === 'e3');
}

console.log('\n=== Ce qui ne se comprend pas doit etre IGNORE, pas devine ===');
{
  check('tampon vide', null, lireMessage(Buffer.alloc(0)));
  check('octets quelconques', null, lireMessage(Buffer.from('ceci n’est pas un message')));
  check('en-tete seul, sans charge', null, lireMessage(Buffer.alloc(8)));
  check('un seul paquet', null, lireMessage(paquet(1, { action: 'add' })));
}
{
  // Taille annoncee plus grande que le contenu : structure incoherente.
  const t = paquet(1, { action: 'add', modelKey: 'event' });
  t.writeUInt32BE(99_999, 4);
  check('taille mensongere', null, lireMessage(Buffer.concat([t, paquet(2, {})])));
}
{
  // Annoncee comprimee mais ne l'est pas.
  const tete = Buffer.alloc(8);
  tete[0] = 1; tete[1] = 1; tete[2] = 1;
  const charge = Buffer.from('{"action":"add"}', 'utf8');
  tete.writeUInt32BE(charge.length, 4);
  check('fausse compression', null,
    lireMessage(Buffer.concat([tete, charge, paquet(2, {})])));
}
{
  // JSON casse dans la charge d'action.
  const tete = Buffer.alloc(8);
  tete[0] = 1; tete[1] = 1;
  const charge = Buffer.from('{"action": ', 'utf8');
  tete.writeUInt32BE(charge.length, 4);
  check('JSON tronque', null, lireMessage(Buffer.concat([tete, charge, paquet(2, {})])));
}
{
  // Donnees illisibles mais action valable : on garde l'action, donnees vides.
  const tete = Buffer.alloc(8);
  tete[0] = 2; tete[1] = 1;
  const charge = Buffer.from('{cassé', 'utf8');
  tete.writeUInt32BE(charge.length, 4);
  const lu = lireMessage(Buffer.concat([
    paquet(1, { action: 'add', modelKey: 'event', id: 'e4' }), tete, charge,
  ]));
  checkBool('action valable, donnees illisibles : l’action survit', lu?.action.id === 'e4');
  check('  et les donnees valent un objet vide', {}, lu.donnees);
}

console.log('\n=== Traduction en detection ===');
{
  const d = versDetection(lireMessage(message(
    { action: 'add', modelKey: 'event', id: 'e5' },
    { type: 'smartDetectZone', start: 1700, camera: 'cam1',
      smartDetectTypes: ['person'], score: 88 })));
  check('une detection qui COMMENCE', true, d.commence);
  check('  sujets', ['person'], d.sujets);
  check('  camera', 'cam1', d.camera);
  check('  score', 88, d.score);
  check('  debut', 1700, d.debut);
}
{
  // Fin d'evenement : utile pour la liste, jamais pour alerter — sinon on previendrait
  // deux fois du meme passage.
  const d = versDetection(lireMessage(message(
    { action: 'update', modelKey: 'event', id: 'e5' },
    { type: 'smartDetectZone', end: 1900 })));
  check('une detection qui SE TERMINE', false, d.commence);
  check('  sa fin est portee', 1900, d.fin);
}
{
  check('modele autre que « event » : ignore', null, versDetection(lireMessage(message(
    { action: 'update', modelKey: 'camera', id: 'c1' }, { name: 'G6' }))));
  check('type de console (armement) : ignore', null, versDetection(lireMessage(message(
    { action: 'add', modelKey: 'event', id: 'e6' }, { type: 'arming' }))));
  check('activite administrative : ignoree', null, versDetection(lireMessage(message(
    { action: 'add', modelKey: 'event', id: 'e7' }, { type: 'adminActivity' }))));
  check('acces : ignore', null, versDetection(lireMessage(message(
    { action: 'add', modelKey: 'event', id: 'e8' }, { type: 'access' }))));
}
{
  // Les trois types de camera passent, et eux seuls.
  for (const t of TYPES_DETECTION) {
    const d = versDetection(lireMessage(message(
      { action: 'add', modelKey: 'event', id: 'x' }, { type: t, start: 1 })));
    checkBool(`type « ${t} » retenu`, d !== null && d.type === t);
  }
}
{
  // Champs manquants : rien ne doit lever.
  const d = versDetection(lireMessage(message(
    { action: 'add', modelKey: 'event', id: 'e9' }, { type: 'motion' })));
  check('sans debut ni camera : debut nul', null, d.debut);
  check('  camera nulle', null, d.camera);
  check('  sujets = liste vide', [], d.sujets);
  check('  score nul', null, d.score);
}
{
  // smartDetectTypes qui n'est pas une liste : on ne le propage pas tel quel.
  const d = versDetection(lireMessage(message(
    { action: 'add', modelKey: 'event', id: 'e10' },
    { type: 'smartDetectZone', smartDetectTypes: 'person' })));
  check('sujets mal formes : liste vide', [], d.sujets);
}

console.log('\n=== Reprise apres coupure ===');
{
  checkBool('les attentes sont croissantes',
    REPRISES_MS.every((v, i) => i === 0 || v > REPRISES_MS[i - 1]));
  checkBool('et bornees a une minute et demie',
    REPRISES_MS[REPRISES_MS.length - 1] <= 90_000);
}

console.log('\n=== Charges non JSON ===');
{
  const brut = Buffer.from([1, 2, 3, 4]);
  const p = paquets(paquet(2, brut, { format: 3 }));
  checkBool('format « octets bruts » rendu tel quel', Buffer.isBuffer(contenu(p[0])));
  const t = paquets(paquet(2, 'bonjour', { format: 2 }));
  check('format « texte »', 'bonjour', contenu(t[0]));
}

console.log('\n' + (echecs === 0 ? 'TOUS LES TESTS PASSENT' : `${echecs} VERIFICATION(S) EN ECHEC`));
process.exit(echecs === 0 ? 0 : 1);
