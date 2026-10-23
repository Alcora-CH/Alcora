/**
 * Les dispositions du mur (v2/web/src/lib/dispositions.ts), lues dans leur source même.
 *
 *   node test-dispositions.mjs
 *
 * Ajoutee le 23.10.2026 avec la fonction. Node 22 lit le TypeScript tel quel (types retires a
 * la volee) : c'est le code de la page qui est eprouve, pas une copie. Ce qui est garde : une
 * disposition montre exactement ce qu'on a enregistre, dans cet ordre ; une camera arrivee
 * depuis n'y entre pas ; une camera retiree est sautee et dite ; « modifiee » dit vrai ; un
 * stockage abime ne fait rien planter ; neuf au plus, aucun nom vide ni en double.
 */

import {
  AUCUNE, MAX_DISPOSITIONS, appliquer, decritLeMur, enregistrer, lireDispositions, mettreAJour, nomRefuse,
  renommer, supprimer,
} from '../web/src/lib/dispositions.ts';

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

const connues = ['allee', 'bureaux', 'portail'];

console.log('=== Appliquer : exactement ce qu on a enregistre ===');
{
  const nuit = { id: 'n', nom: 'Nuit', cameras: ['bureaux', 'allee'] };
  const r = appliquer(nuit, connues, ['allee', 'portail', 'bureaux']);
  check('les cameras affichees, dans l ordre de la disposition', ['bureaux', 'allee'], r.ordre.slice(0, 2));
  check('les autres sont masquees', ['portail'], r.masquees);
  check('et gardent derriere leur ordre d avant', ['bureaux', 'allee', 'portail'], r.ordre);
  check('rien d absent', [], r.absentes);
  const arrivee = appliquer(nuit, [...connues, 'jardin'], ['allee', 'bureaux']);
  check('une camera arrivee depuis n y entre pas : masquee', ['portail', 'jardin'], arrivee.masquees);
  const partie = appliquer({ id: 'x', nom: 'X', cameras: ['jardin', 'allee'] }, connues, []);
  check('une camera retiree du controleur est sautee, et dite', [['allee'], ['jardin']], [partie.ordre.slice(0, 1), partie.absentes]);
}

console.log('\n=== « Modifiee » dit vrai ===');
{
  const d = { id: 'd', nom: 'Tout', cameras: ['allee', 'bureaux'] };
  check('le mur tel qu enregistre : elle le decrit', true, decritLeMur(d, ['allee', 'bureaux'], connues));
  check('deux cameras echangees : modifiee', false, decritLeMur(d, ['bureaux', 'allee'], connues));
  check('une camera masquee : modifiee', false, decritLeMur(d, ['allee'], connues));
  check('une camera reaffichee : modifiee', false, decritLeMur(d, ['allee', 'bureaux', 'portail'], connues));
  check('une camera absente du controleur ne compte pas', true,
    decritLeMur({ ...d, cameras: ['allee', 'jardin', 'bureaux'] }, ['allee', 'bureaux'], connues));
}

console.log('\n=== Enregistrer, mettre a jour, renommer, supprimer ===');
{
  let e = enregistrer(AUCUNE, 'a', ' Nuit ', ['bureaux', 'allee']);
  check('enregistree, nom propre, et c est elle qui est en cours', [{ id: 'a', nom: 'Nuit', cameras: ['bureaux', 'allee'] }, 'a'], [e.liste[0], e.active]);
  check('un nom vide : refuse', 'vide', nomRefuse('   ', e));
  check('un nom deja pris, a la casse pres : refuse', 'doublon', nomRefuse('NUIT', e));
  check('et l enregistrement refuse ne change rien', e, enregistrer(e, 'b', 'nuit', ['allee']));
  e = enregistrer(e, 'b', 'Allée seule', ['allee']);
  e = mettreAJour(e, 'a', ['allee', 'bureaux']);
  check('mise a jour : nouvelles cameras, et elle redevient en cours', [['allee', 'bureaux'], 'a'], [e.liste[0].cameras, e.active]);
  check('renommer sur un autre nom pris : refuse', 'Allée seule', renommer(e, 'b', 'Nuit').liste[1].nom);
  check('renommer sur son propre nom, autrement ecrit : permis', 'NUIT', renommer(e, 'a', 'NUIT').liste[0].nom);
  const s = supprimer(e, 'a');
  check('supprimer celle en cours : plus aucune en cours', [['b'], null], [s.liste.map((d) => d.id), s.active]);
  let plein = AUCUNE;
  for (let i = 0; i < MAX_DISPOSITIONS + 2; i++) plein = enregistrer(plein, `p${i}`, `D${i}`, ['allee']);
  check('neuf au plus', MAX_DISPOSITIONS, plein.liste.length);
}

console.log('\n=== Le stockage relu ===');
{
  const e = enregistrer(enregistrer(AUCUNE, 'a', 'Nuit', ['bureaux']), 'b', 'Jour', ['allee']);
  check('ecrit puis relu : identique', e, lireDispositions(JSON.stringify(e)));
  check('rien d ecrit : aucune', AUCUNE, lireDispositions(null));
  check('pas du JSON : aucune, sans planter', AUCUNE, lireDispositions('{ abime'));
  check('les entrees mal formees sont ecartees, pas les autres', ['ok'],
    lireDispositions(JSON.stringify({ liste: [{ id: 1, nom: 'x', cameras: [] }, { id: 'ok', nom: 'Bien', cameras: ['a', 3, 'a'] }, { id: 'v', nom: '  ', cameras: [] }], active: 'ok' }))
      .liste.map((d) => d.id));
  check('une camera en double ou d un autre type est nettoyee', ['a'],
    lireDispositions(JSON.stringify({ liste: [{ id: 'ok', nom: 'Bien', cameras: ['a', 3, 'a'] }] })).liste[0].cameras);
  check('une disposition en cours qui n existe plus : aucune en cours', null,
    lireDispositions(JSON.stringify({ liste: e.liste, active: 'disparue' })).active);
}

console.log('\n' + (echecs === 0 ? 'TOUS LES TESTS PASSENT' : `${echecs} TEST(S) EN ECHEC`));
process.exit(echecs === 0 ? 0 : 1);
