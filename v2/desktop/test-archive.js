'use strict';

/**
 * Bornes de l'archive — la lecture dont depend tout le dessin de la frise.
 *
 *   node test-archive.js
 *
 * Pourquoi ce test existe. La mesure du 29.07.2026 (V-Frise) a montre que les deux champs
 * de l'inventaire ne signifient PAS ce que leurs noms suggerent :
 *
 *   recordingStartLQ  = debut reel de l'archive     — 162 jours sur le materiel de reference
 *   recordingStart    = fin de la haute definition  —  29 jours seulement
 *
 * Se tromper de champ ampute la frise de 133 jours de video qui existe. C'est une erreur
 * silencieuse : rien ne planterait, l'utilisateur croirait simplement que ses images
 * anciennes ont disparu. Les cas tordus sont eprouves ici parce qu'aucun firmware ne me les
 * a encore montres, et qu'une frise a l'envers ou vide ne doit jamais atteindre l'ecran.
 */

const { bornesArchive } = require('./protect/discovery');

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

/** Instant fixe : un test qui depend de l'heure qu'il est n'est pas un test. */
const MAINTENANT = Date.UTC(2026, 6, 29, 0, 0, 0);
const JOUR = 86_400_000;
const cam = (video) => ({ stats: { video } });

console.log('=== Le cas reel, mesure le 29.07.2026 ===');
{
  // Valeurs relevees sur le materiel : archive de 162 j, haute definition sur 29 j.
  const debutLQ = MAINTENANT - 162 * JOUR;
  const debutHD = MAINTENANT - 29 * JOUR;
  const fin = MAINTENANT - 60_000;
  const b = bornesArchive(cam({
    recordingStart: debutHD, recordingStartLQ: debutLQ, recordingEnd: fin,
  }), MAINTENANT);

  check('bord gauche = recordingStartLQ, JAMAIS recordingStart',
    { debut: debutLQ, frontiere: debutHD, fin }, b);
  checkBool('l\'archive couvre bien 162 jours',
    Math.round((b.fin - b.debut) / JOUR) === 162);
  checkBool('la frontiere de qualite est a 29 jours',
    Math.round((b.fin - b.frontiere) / JOUR) === 29);
  checkBool('133 jours seraient perdus en suivant recordingStart',
    Math.round((b.frontiere - b.debut) / JOUR) === 133);
}

console.log('\n=== Les champs mentent, ou manquent ===');
{
  // Un seul champ : l'archive existe quand meme, sans frontiere a signaler.
  const t = MAINTENANT - 30 * JOUR;
  const b = bornesArchive(cam({ recordingStart: t, recordingEnd: MAINTENANT }), MAINTENANT);
  check('recordingStartLQ absent : on se rabat sur recordingStart',
    { debut: t, frontiere: null, fin: MAINTENANT }, b);
}
{
  const t = MAINTENANT - 30 * JOUR;
  const b = bornesArchive(cam({ recordingStartLQ: t }), MAINTENANT);
  check('recordingStart absent : pas de frontiere, fin = maintenant',
    { debut: t, frontiere: null, fin: MAINTENANT }, b);
}
{
  // Retentions egales : une seule qualite conservee, la barre doit rester unie.
  const t = MAINTENANT - 30 * JOUR;
  const b = bornesArchive(cam({ recordingStart: t, recordingStartLQ: t, recordingEnd: MAINTENANT }), MAINTENANT);
  check('retentions identiques : aucune frontiere a dessiner',
    { debut: t, frontiere: null, fin: MAINTENANT }, b);
}
{
  // Champs inverses par un firmware fantaisiste : le plus ancien gagne, jamais de frise
  // a l'envers. Ici recordingStart est le plus ancien : il devient le bord gauche, et il
  // n'y a plus de frontiere a montrer.
  const vieux = MAINTENANT - 100 * JOUR;
  const recent = MAINTENANT - 10 * JOUR;
  const b = bornesArchive(cam({
    recordingStart: vieux, recordingStartLQ: recent, recordingEnd: MAINTENANT,
  }), MAINTENANT);
  checkBool('champs inverses : le bord gauche reste le plus ancien', b.debut === vieux);
  checkBool('champs inverses : la frise n\'est pas a l\'envers', b.fin > b.debut);
  checkBool('champs inverses : pas de frontiere inventee', b.frontiere === null);
}

console.log('\n=== Rien d\'exploitable ===');
{
  check('aucun champ', null, bornesArchive(cam({}), MAINTENANT));
  check('objet vide', null, bornesArchive({}, MAINTENANT));
  check('camera absente', null, bornesArchive(null, MAINTENANT));
  check('valeurs nulles', null, bornesArchive(cam({ recordingStart: 0, recordingStartLQ: 0 }), MAINTENANT));
  check('valeurs non numeriques', null,
    bornesArchive(cam({ recordingStart: 'hier', recordingStartLQ: null }), MAINTENANT));
}

console.log('\n=== Fins incoherentes ===');
{
  const t = MAINTENANT - 30 * JOUR;
  // Une fin ANTERIEURE au debut donnerait une frise de largeur negative.
  const b = bornesArchive(cam({ recordingStartLQ: t, recordingEnd: t - JOUR }), MAINTENANT);
  checkBool('fin anterieure au debut : ramenee a maintenant', b.fin === MAINTENANT);
  checkBool('la frise garde une largeur positive', b.fin > b.debut);
}
{
  // Une camera eteinte depuis trois jours : la fin est reelle, on la respecte. Dessiner
  // jusqu'a maintenant promettrait trois jours de video qui n'existent pas.
  const t = MAINTENANT - 30 * JOUR;
  const fin = MAINTENANT - 3 * JOUR;
  const b = bornesArchive(cam({ recordingStartLQ: t, recordingEnd: fin }), MAINTENANT);
  checkBool('camera arretee : la fin reelle est conservee', b.fin === fin);
}
{
  // Frontiere hors des bornes : elle ne doit pas etre dessinee sur un bord.
  const t = MAINTENANT - 30 * JOUR;
  const b = bornesArchive(cam({
    recordingStart: MAINTENANT + JOUR, recordingStartLQ: t, recordingEnd: MAINTENANT,
  }), MAINTENANT);
  checkBool('frontiere dans le futur : ignoree', b.frontiere === null);
}

console.log('\n' + (echecs === 0 ? 'TOUS LES TESTS PASSENT' : `${echecs} VERIFICATION(S) EN ECHEC`));
process.exit(echecs === 0 ? 0 : 1);
