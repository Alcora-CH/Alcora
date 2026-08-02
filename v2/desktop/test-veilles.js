'use strict';

/**
 * Les veilles : quand faut-il prevenir, et quand faut-il se taire.
 *
 *   node test-veilles.js
 *
 * L'essentiel de ces verifications porte sur les HORAIRES, parce que c'est la que ce genre
 * de code se trompe toujours — et qu'une erreur y est silencieuse : une veille de nuit qui
 * ne se declenche jamais ne produit aucun message d'erreur, elle produit du silence, et le
 * silence ressemble a « rien ne s'est passe ».
 *
 * Le cas qui casse tout est la plage qui FRANCHIT MINUIT. « 22:00 -> 07:00 » un samedi
 * couvre le dimanche a trois heures du matin, et c'est le jour de DEBUT qui compte.
 */

const {
  sujetsDe, enMinutes, dansLaPlage, veilleActive, veillesDeclenchees, Retenue,
  veillesParDefaut, SUJETS,
} = require('./veilles');

let echecs = 0;

function check(label, attendu, obtenu) {
  const ok = JSON.stringify(attendu) === JSON.stringify(obtenu);
  if (!ok) echecs++;
  console.log(`${ok ? '  OK  ' : ' ECHEC'}  ${label.padEnd(58)}`);
  if (!ok) console.log(`          attendu ${JSON.stringify(attendu)} · obtenu ${JSON.stringify(obtenu)}`);
}

function checkBool(label, condition) {
  if (!condition) echecs++;
  console.log(`${condition ? '  OK  ' : ' ECHEC'}  ${label}`);
}

/** Un instant precis, sans dependre de l'heure qu'il est. Dimanche = 0. */
const quand = (jour, h, min = 0) => {
  // 04.01.2026 est un DIMANCHE : on cale la semaine dessus.
  const d = new Date(2026, 0, 4 + jour, h, min, 0, 0);
  return d;
};
const DIM = 0, LUN = 1, SAM = 6;

console.log('=== Traduction du vocabulaire ===');
{
  check('une personne', ['person'], sujetsDe({ type: 'smartDetectZone', sujets: ['person'] }));
  check('un visage compte comme une personne', ['person'],
    sujetsDe({ type: 'smartDetectZone', sujets: ['face'] }));
  check('une plaque compte comme un vehicule', ['vehicle'],
    sujetsDe({ type: 'smartDetectZone', sujets: ['licensePlate'] }));
  check('un aboiement', ['aboiement'], sujetsDe({ type: 'smartAudioDetect', sujets: ['alrmBark'] }));
  check('plusieurs sujets a la fois', ['person', 'vehicle'],
    sujetsDe({ type: 'smartDetectZone', sujets: ['person', 'vehicle'] }));
  check('mouvement sans sujet identifie', ['motion'], sujetsDe({ type: 'motion', sujets: [] }));
  // Le sujet l'emporte : prevenir « mouvement » quand on sait que c'est quelqu'un serait
  // perdre l'information au moment ou elle compte.
  check('mouvement AVEC un sujet : le sujet gagne', ['person'],
    sujetsDe({ type: 'motion', sujets: ['person'] }));
  check('sujet inconnu du vocabulaire', [], sujetsDe({ type: 'smartDetectZone', sujets: ['ovni'] }));
  check('detection vide', [], sujetsDe({}));
  checkBool('chaque sujet a un libelle lisible dans toutes les langues',
    SUJETS.every((s) => {
      const { LANGUES } = require('./i18n');
      return Object.values(LANGUES).every(({ table }) =>
        typeof table[`sujet.${s.id}`] === 'string' && table[`sujet.${s.id}`].length > 2);
    }));
}

console.log('\n=== Lecture des heures ===');
{
  check('07:30', 450, enMinutes('07:30'));
  check('00:00', 0, enMinutes('00:00'));
  check('24:00', 1440, enMinutes('24:00'));
  check('forme invalide', null, enMinutes('7h30'));
  check('minutes impossibles', null, enMinutes('07:99'));
  check('vide', null, enMinutes(''));
  check('absent', null, enMinutes(undefined));
}

console.log('\n=== Plage ordinaire, dans la journee ===');
{
  const p = { jours: [LUN], debut: '09:00', fin: '17:00' };
  checkBool('lundi midi : dedans', dansLaPlage(p, quand(LUN, 12)));
  checkBool('lundi 09:00 pile : dedans (borne incluse)', dansLaPlage(p, quand(LUN, 9, 0)));
  checkBool('lundi 17:00 pile : DEHORS (borne exclue)', !dansLaPlage(p, quand(LUN, 17, 0)));
  checkBool('lundi 08:59 : dehors', !dansLaPlage(p, quand(LUN, 8, 59)));
  checkBool('dimanche midi : dehors, mauvais jour', !dansLaPlage(p, quand(DIM, 12)));
}

console.log('\n=== Plage qui FRANCHIT MINUIT — le cas qui casse tout ===');
{
  // Le profil « Nuit » par defaut : 22:00 -> 07:00, tous les jours.
  const p = { jours: [0, 1, 2, 3, 4, 5, 6], debut: '22:00', fin: '07:00' };
  checkBool('samedi 23:00 : dedans', dansLaPlage(p, quand(SAM, 23)));
  checkBool('dimanche 03:00 : dedans — c’est la nuit du samedi', dansLaPlage(p, quand(DIM, 3)));
  checkBool('dimanche 06:59 : encore dedans', dansLaPlage(p, quand(DIM, 6, 59)));
  checkBool('dimanche 07:00 : dehors', !dansLaPlage(p, quand(DIM, 7, 0)));
  checkBool('dimanche 12:00 : dehors', !dansLaPlage(p, quand(DIM, 12)));
  checkBool('dimanche 21:59 : dehors', !dansLaPlage(p, quand(DIM, 21, 59)));
  checkBool('dimanche 22:00 : dedans', dansLaPlage(p, quand(DIM, 22)));
}
{
  // Un seul jour, et il franchit minuit : le lendemain matin compte, pas le meme matin.
  const p = { jours: [SAM], debut: '22:00', fin: '02:00' };
  checkBool('samedi 23:30 : dedans', dansLaPlage(p, quand(SAM, 23, 30)));
  checkBool('DIMANCHE 01:00 : dedans — nuit du samedi', dansLaPlage(p, quand(DIM, 1)));
  checkBool('samedi 01:00 : DEHORS — c’est la nuit du vendredi', !dansLaPlage(p, quand(SAM, 1)));
  checkBool('lundi 01:00 : dehors', !dansLaPlage(p, quand(LUN, 1)));
}
{
  const p = { jours: [LUN], debut: '00:00', fin: '00:00' };
  checkBool('debut = fin : journee entiere', dansLaPlage(p, quand(LUN, 13, 37)));
  checkBool('  mais pas les autres jours', !dansLaPlage(p, quand(DIM, 13, 37)));
}
{
  check('plage sans jours', false, dansLaPlage({ debut: '09:00', fin: '17:00' }, quand(LUN, 12)));
  check('plage malformee', false, dansLaPlage({ jours: [LUN], debut: 'x', fin: 'y' }, quand(LUN, 12)));
  check('plage absente', false, dansLaPlage(null, quand(LUN, 12)));
}

console.log('\n=== Les trois plannings ===');
{
  const config = {
    armee: true,
    profils: [{ id: 'nuit', nom: 'Nuit', plages: [{ jours: [0,1,2,3,4,5,6], debut: '22:00', fin: '07:00' }] }],
  };
  const nuit = { actif: true, quand: 'armee', profils: ['nuit'] };
  checkBool('« armée » la nuit : en service', veilleActive(nuit, config, quand(LUN, 2)));
  checkBool('« armée » en journee : au repos', !veilleActive(nuit, config, quand(LUN, 14)));
  checkBool('desarmee : au repos meme la nuit',
    !veilleActive(nuit, { ...config, armee: false }, quand(LUN, 2)));

  const toujours = { actif: true, quand: 'toujours' };
  checkBool('« toujours » : en service en journee', veilleActive(toujours, config, quand(LUN, 14)));
  checkBool('« toujours » : en service meme DESARMEE',
    veilleActive(toujours, { ...config, armee: false }, quand(LUN, 14)));

  const propre = { actif: true, quand: 'horaire',
                   plages: [{ jours: [LUN], debut: '08:00', fin: '09:00' }] };
  checkBool('horaire propre : dedans', veilleActive(propre, config, quand(LUN, 8, 30)));
  checkBool('horaire propre : dehors', !veilleActive(propre, config, quand(LUN, 10)));
  checkBool('horaire propre : independant de l’armement',
    veilleActive(propre, { ...config, armee: false }, quand(LUN, 8, 30)));

  checkBool('veille eteinte : jamais', !veilleActive({ ...toujours, actif: false }, config, quand(LUN, 14)));
  checkBool('armée sans aucun profil : en service en permanence',
    veilleActive({ actif: true, quand: 'armee', profils: [] }, { armee: true, profils: [] }, quand(LUN, 14)));
}

console.log('\n=== Ce qui declenche, et ce qui se tait ===');
{
  const config = {
    armee: true, profils: [],
    veilles: [
      { id: 'p', sujets: ['person'], cameras: [], quand: 'armee', actif: true },
      { id: 'g6', sujets: ['vehicle'], cameras: ['g6'], quand: 'armee', actif: true },
    ],
  };
  const t = quand(LUN, 14);

  const d1 = { commence: true, type: 'smartDetectZone', sujets: ['person'], camera: 'g5' };
  check('une personne declenche la veille « personne »', ['p'],
    veillesDeclenchees(d1, config, t).map((v) => v.id));

  // LE point qui compte : une detection qui SE TERMINE ne previent pas une seconde fois.
  check('la FIN de la meme detection ne declenche rien', [],
    veillesDeclenchees({ ...d1, commence: false }, config, t).map((v) => v.id));

  check('un vehicule sur la bonne camera', ['g6'],
    veillesDeclenchees({ commence: true, type: 'smartDetectZone', sujets: ['vehicle'], camera: 'g6' },
      config, t).map((v) => v.id));
  check('le meme vehicule sur une AUTRE camera : rien', [],
    veillesDeclenchees({ commence: true, type: 'smartDetectZone', sujets: ['vehicle'], camera: 'g5' },
      config, t).map((v) => v.id));
  check('un animal : aucune veille ne le guette', [],
    veillesDeclenchees({ commence: true, type: 'smartDetectZone', sujets: ['animal'], camera: 'g5' },
      config, t).map((v) => v.id));
  check('du mouvement seul : rien', [],
    veillesDeclenchees({ commence: true, type: 'motion', sujets: [], camera: 'g5' },
      config, t).map((v) => v.id));
  check('detection vide', [], veillesDeclenchees({ commence: true }, config, t));
  check('configuration vide', [], veillesDeclenchees(
    { commence: true, type: 'motion', sujets: ['person'] }, {}, t));
}

console.log('\n=== Anti-répétition ===');
{
  // Une personne qui reste dans le champ produit une detection toutes les quinze
  // secondes. Sans retenue, autant de bulles.
  const r = new Retenue();
  const t0 = 1_800_000_000_000;
  checkBool('la premiere passe', r.autorise('p', 'person', 300_000, t0));
  checkBool('quinze secondes apres : retenue', !r.autorise('p', 'person', 300_000, t0 + 15_000));
  checkBool('quatre minutes apres : retenue encore', !r.autorise('p', 'person', 300_000, t0 + 240_000));
  checkBool('cinq minutes apres : passe', r.autorise('p', 'person', 300_000, t0 + 300_000));
  checkBool('un AUTRE sujet passe aussitot', r.autorise('p', 'vehicle', 300_000, t0 + 15_000));
  checkBool('une AUTRE veille passe aussitot', r.autorise('urgences', 'person', 300_000, t0 + 15_000));
  r.oublier();
  checkBool('apres oubli, tout repasse', r.autorise('p', 'person', 300_000, t0 + 16_000));
}

console.log('\n=== Configuration de depart ===');
{
  const c = veillesParDefaut();
  const urgences = c.veilles.find((v) => v.id === 'urgences');
  const personne = c.veilles.find((v) => v.id === 'personne');

  checkBool('les urgences veillent TOUJOURS', urgences.quand === 'toujours');
  checkBool('  meme desarmé', veilleActive(urgences, { ...c, armee: false }, quand(LUN, 14)));
  checkBool('  et en pleine journee', veilleActive(urgences, c, quand(LUN, 14)));
  checkBool('les personnes : la nuit seulement', veilleActive(personne, c, quand(LUN, 2)));
  checkBool('  au repos a midi', !veilleActive(personne, c, quand(LUN, 12)));

  // Le volume : c'est tout l'interet du releve du 29.07. Une personne = 1 par jour.
  const d = { commence: true, type: 'smartDetectZone', sujets: ['person'], camera: 'g5' };
  check('une personne la nuit previent', ['personne'],
    veillesDeclenchees(d, c, quand(LUN, 3)).map((v) => v.id));
  check('  et 157 mouvements par jour ne previennent jamais', [],
    veillesDeclenchees({ commence: true, type: 'motion', sujets: [], camera: 'g5' }, c,
      quand(LUN, 3)).map((v) => v.id));
}

console.log('\n' + (echecs === 0 ? 'TOUS LES TESTS PASSENT' : `${echecs} VERIFICATION(S) EN ECHEC`));
process.exit(echecs === 0 ? 0 : 1);
