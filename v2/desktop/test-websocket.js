'use strict';

/**
 * Le lecteur de trames WebSocket, eprouve sur ce qui casse reellement ce genre de code.
 *
 *   node test-websocket.js
 *
 * Ce n'est pas l'analyse d'une trame isolee qui pose probleme : c'est que le reseau livre
 * les octets en morceaux ARBITRAIRES. Une trame peut arriver en dix paquets, dix trames
 * dans un seul, et un ping s'intercaler au milieu d'un message fragmente. Ces cas ne se
 * produisent pas au premier essai — ils se produisent une nuit, au bout de six heures.
 *
 * On ecrit donc ce client soi-meme (l'application n'a aucune dependance d'execution, et
 * Electron 33 embarque un Node sans objet WebSocket), et on le paie en verifications.
 */

const { LecteurTrames, OP } = require('./protect/websocket');

let echecs = 0;

function check(label, attendu, obtenu) {
  const ok = String(attendu) === String(obtenu);
  if (!ok) echecs++;
  console.log(`${ok ? '  OK  ' : ' ECHEC'}  ${label.padEnd(54)} attendu=${String(attendu).padEnd(12)} obtenu=${obtenu}`);
}

function checkBool(label, condition) {
  if (!condition) echecs++;
  console.log(`${condition ? '  OK  ' : ' ECHEC'}  ${label}`);
}

/** Fabrique une trame SERVEUR (jamais masquee), telle que le controleur l'emet. */
function trame(op, donnees, { fin = true } = {}) {
  const n = donnees.length;
  const tete = n < 126 ? 2 : n < 65536 ? 4 : 10;
  const t = Buffer.allocUnsafe(tete + n);
  t[0] = (fin ? 0x80 : 0) | op;
  if (n < 126) t[1] = n;
  else if (n < 65536) { t[1] = 126; t.writeUInt16BE(n, 2); }
  else { t[1] = 127; t.writeBigUInt64BE(BigInt(n), 2); }
  donnees.copy(t, tete);
  return t;
}

/** Trame masquee : un serveur n'en emet pas, mais on ne doit pas rendre du charabia. */
function trameMasquee(op, donnees) {
  const n = donnees.length;
  const cle = Buffer.from([0x37, 0xfa, 0x21, 0x3d]);
  const t = Buffer.allocUnsafe(2 + 4 + n);
  t[0] = 0x80 | op;
  t[1] = 0x80 | n;
  cle.copy(t, 2);
  for (let i = 0; i < n; i += 1) t[6 + i] = donnees[i] ^ cle[i & 3];
  return t;
}

const texte = (s) => Buffer.from(s, 'utf8');

console.log('=== Un message simple ===');
{
  const l = new LecteurTrames();
  const m = l.ajouter(trame(OP.BINAIRE, texte('bonjour')));
  check('un message rendu', 1, m.length);
  check('son contenu', 'bonjour', m[0].donnees.toString());
  check('son type', OP.BINAIRE, m[0].op);
}

console.log('\n=== Le reseau decoupe n’importe comment ===');
{
  // Octet par octet : le cas le plus hostile, et le plus revelateur.
  const l = new LecteurTrames();
  const t = trame(OP.BINAIRE, texte('découpé octet par octet'));
  let rendus = [];
  for (const o of t) rendus = rendus.concat(l.ajouter(Buffer.from([o])));
  check('livree octet par octet : un seul message', 1, rendus.length);
  check('  contenu intact', 'découpé octet par octet', rendus[0].donnees.toString());
}
{
  // Trois trames dans un seul paquet.
  const l = new LecteurTrames();
  const m = l.ajouter(Buffer.concat([
    trame(OP.BINAIRE, texte('un')), trame(OP.BINAIRE, texte('deux')), trame(OP.BINAIRE, texte('trois')),
  ]));
  check('trois trames en un paquet', 3, m.length);
  check('  dans l’ordre', 'un,deux,trois', m.map((x) => x.donnees.toString()).join(','));
}
{
  // Une trame a cheval sur deux paquets, coupee en plein milieu de l'en-tete etendu.
  const l = new LecteurTrames();
  const t = trame(OP.BINAIRE, Buffer.alloc(300, 65));
  check('coupee dans l’en-tete : rien avant la fin', 0, l.ajouter(t.subarray(0, 3)).length);
  const m = l.ajouter(t.subarray(3));
  check('  puis le message entier', 1, m.length);
  check('  taille', 300, m[0].donnees.length);
}

console.log('\n=== Messages fragmentes ===');
{
  const l = new LecteurTrames();
  let m = l.ajouter(trame(OP.BINAIRE, texte('pre'), { fin: false }));
  check('premier fragment : rien encore', 0, m.length);
  m = l.ajouter(trame(OP.SUITE, texte('mier '), { fin: false }));
  check('deuxieme fragment : rien encore', 0, m.length);
  m = l.ajouter(trame(OP.SUITE, texte('message')));
  check('trame finale : le message assemble', 1, m.length);
  check('  contenu recolle', 'premier message', m[0].donnees.toString());
  check('  type = celui du PREMIER fragment', OP.BINAIRE, m[0].op);
}
{
  // Un ping s'intercale au milieu d'un message fragmente : c'est autorise, et c'est
  // exactement la ou un lecteur naif melange tout.
  const l = new LecteurTrames();
  l.ajouter(trame(OP.BINAIRE, texte('debut '), { fin: false }));
  const m1 = l.ajouter(trame(OP.PING, texte('ping')));
  check('le ping passe devant', 1, m1.length);
  check('  et c’est bien un ping', OP.PING, m1[0].op);
  const m2 = l.ajouter(trame(OP.SUITE, texte('et fin')));
  check('le message se termine ensuite', 1, m2.length);
  check('  sans avoir avale le ping', 'debut et fin', m2[0].donnees.toString());
}

console.log('\n=== Tailles etendues ===');
{
  const l = new LecteurTrames();
  const gros = Buffer.alloc(15_186, 88);       // la plus grosse trame vue sur le poste de reference
  const m = l.ajouter(trame(OP.BINAIRE, gros));
  check('15 186 octets (taille 16 bits)', 15_186, m[0].donnees.length);
}
{
  const l = new LecteurTrames();
  const enorme = Buffer.alloc(70_000, 90);     // au-dela de 65 535 : longueur sur 64 bits
  const t = trame(OP.BINAIRE, enorme);
  check('  en-tete en forme 64 bits', 127, t[1]);
  // Livree en trois morceaux inegaux, pour faire bonne mesure.
  let r = l.ajouter(t.subarray(0, 5));
  r = r.concat(l.ajouter(t.subarray(5, 40_000)));
  r = r.concat(l.ajouter(t.subarray(40_000)));
  check('70 000 octets reassembles', 70_000, r[0]?.donnees.length);
}

console.log('\n=== Cas tordus ===');
{
  const l = new LecteurTrames();
  const m = l.ajouter(trameMasquee(OP.BINAIRE, texte('masque par erreur')));
  check('trame masquee : demasquee au lieu de charabia', 'masque par erreur', m[0].donnees.toString());
}
{
  const l = new LecteurTrames();
  // Une trame de SUITE sans debut : on ignore plutot que de rendre un message ampute.
  const m = l.ajouter(trame(OP.SUITE, texte('orpheline')));
  check('suite sans debut : ignoree', 0, m.length);
}
{
  const l = new LecteurTrames();
  check('tampon vide', 0, l.ajouter(Buffer.alloc(0)).length);
  check('un seul octet', 0, l.ajouter(Buffer.from([0x82])).length);
}
{
  const l = new LecteurTrames();
  const m = l.ajouter(trame(OP.FERMETURE, Buffer.alloc(0)));
  check('fermeture rendue comme telle', OP.FERMETURE, m[0].op);
}
{
  // Message vide : legitime, et il ne doit pas se perdre.
  const l = new LecteurTrames();
  const m = l.ajouter(trame(OP.BINAIRE, Buffer.alloc(0)));
  check('message de taille nulle', 1, m.length);
}
{
  // Le tampon ne doit pas grossir indefiniment : apres lecture, il est vide.
  const l = new LecteurTrames();
  l.ajouter(Buffer.concat([trame(OP.BINAIRE, texte('a')), trame(OP.BINAIRE, texte('b'))]));
  checkBool('le tampon est rendu apres lecture', l.tampon.length === 0);
}

console.log('\n=== Mille trames d’affilee, decoupees au hasard reproductible ===');
{
  // Six heures de liaison, c'est des milliers de trames et autant de decoupages
  // differents. On en simule mille, avec un hasard REPRODUCTIBLE : un test qui echoue
  // une fois sur dix sans qu'on puisse le rejouer ne sert a rien.
  let graine = 20260729;
  const hasard = () => (graine = (graine * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

  const attendus = [];
  const morceaux = [];
  for (let i = 0; i < 1000; i += 1) {
    const contenu = texte(`message numero ${i} ` + 'x'.repeat(Math.floor(hasard() * 400)));
    attendus.push(contenu.toString());
    morceaux.push(trame(OP.BINAIRE, contenu));
  }
  const flux = Buffer.concat(morceaux);

  const l = new LecteurTrames();
  const recus = [];
  let p = 0;
  while (p < flux.length) {
    const taille = 1 + Math.floor(hasard() * 900);
    for (const m of l.ajouter(flux.subarray(p, p + taille))) recus.push(m.donnees.toString());
    p += taille;
  }
  check('mille messages recus', 1000, recus.length);
  checkBool('tous identiques a l’emission', recus.join('|') === attendus.join('|'));
  checkBool('rien ne reste dans le tampon', l.tampon.length === 0);
}

console.log('\n' + (echecs === 0 ? 'TOUS LES TESTS PASSENT' : `${echecs} VERIFICATION(S) EN ECHEC`));
process.exit(echecs === 0 ? 0 : 1);
