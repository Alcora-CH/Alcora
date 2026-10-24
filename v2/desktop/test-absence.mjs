/**
 * Le bandeau d'activité du plein écran : les absences (v2/web/src/lib/absence.ts) et la
 * place du bandeau (v2/web/src/lib/placementBandeau.ts), lues dans leur source même.
 *
 *   node test-absence.mjs
 *
 * Ajoutee le 24.10.2026 avec le bandeau. Ce qui est garde : une detection tombee pendant
 * une absence reste marquee jusqu'a ce qu'on regarde, et seulement elle ; un aller-retour
 * eclair n'est pas une absence ; Alcora fermee compte comme une absence ; un stockage abime
 * ne fait rien planter ; le bandeau prend la place libre — dessous, puis sur le cote, puis
 * une pastille — et ne retrecit jamais les images.
 */

import {
  ABSENCES_MAX, ABSENCE_MIN_MS, auLancement, enCours, partir, pendantAbsence, resumeAbsence, revenir, vu,
} from '../web/src/lib/absence.ts';
import { BAS_COMMANDES, HAUTEUR_BANDEAU, MARGE, placerBandeau } from '../web/src/lib/placementBandeau.ts';
import { meilleureGrille } from '../web/src/video/grille.ts';

let echecs = 0;
function check(label, attendu, obtenu) {
  const ok = JSON.stringify(attendu) === JSON.stringify(obtenu);
  if (!ok) echecs++;
  console.log(`${ok ? '  OK  ' : ' ECHEC'}  ${label}`);
  if (!ok) {
    console.log(`          attendu = ${JSON.stringify(attendu)}`);
    console.log(`          obtenu  = ${JSON.stringify(obtenu)}`);
  }
}

const MIN = 60_000;
const T = Date.UTC(2026, 9, 24, 2, 0);   // une nuit fictive
const vide = { absences: [], derniereVue: T };

console.log('=== Partir, revenir ===');
{
  const a = partir(vide, T + 31 * MIN);
  check('partir ouvre une absence en cours', true, enCours(a));
  check('repartir pendant qu on est absent ne change rien', a, partir(a, T + 40 * MIN));
  const b = revenir(a, T + 52 * MIN);
  check('revenir la ferme', [{ de: T + 31 * MIN, a: T + 52 * MIN }], b.absences);
  check('et note la presence', T + 52 * MIN, b.derniereVue);
  check('un aller-retour eclair n est pas une absence', [],
    revenir(partir(vide, T), T + ABSENCE_MIN_MS - 1).absences);
  check('… le seuil compris', 1, revenir(partir(vide, T), T + ABSENCE_MIN_MS).absences.length);
  const reprise = partir(b, T + 50 * MIN);
  check('repartir avant la fin de la precedente : la meme absence reprend',
    [{ de: T + 31 * MIN, a: null }], reprise.absences);
  check('revenir sans etre parti : la presence seulement', [], revenir(vide, T + MIN).absences);
}

console.log('\n=== Ce qui tombe pendant une absence ===');
{
  const e = revenir(partir(vide, T + 31 * MIN), T + 52 * MIN);
  check('une detection pendant l absence : marquee', true, pendantAbsence(e, T + 47 * MIN));
  check('aux bornes : marquee', [true, true], [pendantAbsence(e, T + 31 * MIN), pendantAbsence(e, T + 52 * MIN)]);
  check('avant ou apres : non', [false, false], [pendantAbsence(e, T + 30 * MIN), pendantAbsence(e, T + 53 * MIN)]);
  check('sans heure : non', false, pendantAbsence(e, null));
  const ds = [T + 47 * MIN, T + 40 * MIN, T + 33 * MIN, T + 18 * MIN, T + 55 * MIN].map((debut) => ({ debut }));
  check('le resume : trois, de 02:31 a 02:52', { nombre: 3, de: T + 31 * MIN, a: T + 52 * MIN }, resumeAbsence(e, ds));
  check('rien dedans : zero, sans bornes', { nombre: 0, de: null, a: null }, resumeAbsence(e, [{ debut: T }]));
  const encore = partir(vide, T + 31 * MIN);
  check('pendant une absence qui dure : marquee, fin inconnue', { nombre: 1, de: T + 31 * MIN, a: null },
    resumeAbsence(encore, [{ debut: T + 40 * MIN }]));
  const deux = revenir(partir(revenir(partir(vide, T + 10 * MIN), T + 20 * MIN), T + 40 * MIN), T + 50 * MIN);
  check('deux absences : les deux comptent, de la premiere a la seconde',
    { nombre: 2, de: T + 10 * MIN, a: T + 50 * MIN }, resumeAbsence(deux, [{ debut: T + 15 * MIN }, { debut: T + 45 * MIN }, { debut: T + 30 * MIN }]));
  check('vu : plus rien n est marque', false, pendantAbsence(vu(e), T + 47 * MIN));
  check('vu garde une absence en cours', 1, vu(encore).absences.length);
}

console.log('\n=== Une journee de va-et-vient ===');
{
  let e = vide;
  for (let i = 0; i < ABSENCES_MAX + 6; i++) e = revenir(partir(e, T + i * 10 * MIN), T + i * 10 * MIN + 5 * MIN);
  check(`au plus ${ABSENCES_MAX} absences`, ABSENCES_MAX, e.absences.length);
  check('la plus ancienne n est pas perdue : fondue avec la suivante', T, e.absences[0].de);
  check('ce qui y tombait reste marque', true, pendantAbsence(e, T + 2 * MIN));
}

console.log('\n=== Au lancement ===');
{
  const maintenant = T + 8 * 60 * MIN;
  check('rien de garde (premier lancement) : aucune absence', [], auLancement(null, maintenant).absences);
  check('Alcora fermee depuis la derniere presence : une absence', [{ de: T, a: maintenant }],
    auLancement({ absences: [], derniereVue: T }, maintenant).absences);
  check('relance aussitot : pas d absence', [], auLancement({ absences: [], derniereVue: maintenant - 5000 }, maintenant).absences);
  check('une absence en cours a la fermeture dure jusqu a maintenant', [{ de: T + MIN, a: maintenant }],
    auLancement({ absences: [{ de: T + MIN, a: null }], derniereVue: T }, maintenant).absences);
  check('les absences non regardees se gardent', 2,
    auLancement({ absences: [{ de: T - 60 * MIN, a: T - 50 * MIN }], derniereVue: T }, maintenant).absences.length);
  for (const [nom, stocke] of [
    ['un texte', 'abime'], ['un tableau', []], ['des absences qui n en sont pas', { absences: [1, null, { de: 'x' }, { de: 5, a: 2 }], derniereVue: T }],
    ['une date future', { absences: [], derniereVue: maintenant + 3_600_000 }],
  ]) {
    const e = auLancement(stocke, maintenant);
    check(`stockage abime (${nom}) : rien ne plante, rien d impossible`, true,
      e.derniereVue === maintenant && e.absences.every((a) => a.de <= (a.a ?? maintenant) && (a.a ?? 0) <= maintenant));
  }
  check('une absence vieille de trois jours ne sert plus', [],
    auLancement({ absences: [{ de: T - 3 * 1440 * MIN, a: T - 3 * 1440 * MIN + MIN }], derniereVue: maintenant - 1000 }, maintenant).absences);
}

console.log('\n=== Ou se pose le bandeau ===');
{
  const poser = (w, h, n, espacement = 8) => {
    const g = meilleureGrille(w, h, n, 16 / 9, espacement, 44);
    return placerBandeau({ w, h }, g, espacement, 44, 34);
  };
  const ultra = poser(3440, 1440, 2);
  check('34" 3440x1440, deux cameras : dessous', 'dessous', ultra.mode);
  const g2 = meilleureGrille(3440, 1440, 2, 16 / 9, 8, 44);
  const basMosaique = (1440 + g2.rangees * (g2.hauteur + 44) + 8 * (g2.rangees - 1)) / 2;
  check('… aux bords de la mosaique, sous elle, sans toucher les images', [0, true],
    [ultra.x, ultra.y >= basMosaique + MARGE - 1]);
  check('… sans deborder ni toucher la barre d etat', true, ultra.y + HAUTEUR_BANDEAU <= 1440 - 34 - 8);
  check('… avec la place de plusieurs cartes', true, ultra.cartes >= 8);
  check('24" 1920x1080, deux cameras : dessous', 'dessous', poser(1920, 1080, 2).mode);
  // Une bande de 136 px : de quoi poser le bandeau, pas de quoi laisser passer la barre d'etat.
  check('bande trop juste pour le bandeau ET la barre d etat : pas dessous', 'pastille', poser(1720, 800, 2).mode);
  const quatre = poser(3440, 1440, 4);
  check('3440x1440, quatre cameras : sur le cote', 'cote', quatre.mode);
  const g4 = meilleureGrille(3440, 1440, 4, 16 / 9, 8, 44);
  const droite = (3440 + (g4.colonnes * g4.largeur + 8 * (g4.colonnes - 1))) / 2;
  check('… a droite de la mosaique, sans la chevaucher, dans l ecran', true,
    quatre.x >= droite + MARGE - 1 && quatre.x + quatre.largeur <= 3440);
  check('1920x1080, quatre cameras : une pastille', 'pastille', poser(1920, 1080, 4).mode);
  check('une seule camera sur 21:9 : sur le cote', 'cote', poser(3440, 1440, 1).mode);
  // Mesure du 24.10.2026 dans la demo : une camera isolee, fenetre basse.
  const isolee = poser(1720, 620, 1, 0);
  check('camera isolee, fenetre basse : sur le cote', 'cote', isolee.mode);
  check('… sous les commandes du plein ecran, avec du jeu', true, isolee.y >= BAS_COMMANDES + 8);
  check('… au-dessus de la barre d etat', true, isolee.y + isolee.hauteur <= 620 - 34 - 8);
  check('… et une carte au moins', true, isolee.cartes >= 1);
  // La regle tenue : la mosaique est la meme avec ou sans bandeau — il ne la recalcule jamais.
  check('le bandeau ne change pas la grille', meilleureGrille(3440, 1440, 2, 16 / 9, 8, 44),
    (() => { const g = meilleureGrille(3440, 1440, 2, 16 / 9, 8, 44); placerBandeau({ w: 3440, h: 1440 }, g, 8, 44, 34); return g; })());
}

console.log('\n' + (echecs === 0 ? 'TOUS LES TESTS PASSENT' : `${echecs} TEST(S) EN ECHEC`));
process.exit(echecs === 0 ? 0 : 1);
