/**
 * La cadence des animations sans fin (v2/web/src/lib/cadence.ts), lue dans sa source meme.
 *
 *   node test-cadence.mjs
 *
 * Ajoutee le 05.11.2026 : sur un ecran a 360 Hz, le ciel anime tenait le compositeur a 360
 * images/s pour un ciel qui fait un tour par heure. Ce qui est garde : seules les animations
 * sans fin sont prises ; chacune garde son horloge ; une animation annulee ne revit jamais ; et
 * sans rien a cadencer, plus aucun reveil.
 */

import { creerCadence, IMAGES_PAR_SECONDE } from '../web/src/lib/cadence.ts';

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

/** Une fausse animation : on regarde si elle a ete mise en pause, et ou en est son horloge. */
function animation({ iterations = Infinity, currentTime = 0, playbackRate = 1, playState = 'running' } = {}) {
  return {
    playState,
    playbackRate,
    currentTime,
    pauses: 0,
    effect: { getComputedTiming: () => ({ iterations }) },
    pause() { this.pauses += 1; this.playState = 'paused'; },
  };
}

function banc() {
  const b = { t: 1000, cachee: false, minuteurs: 0, poses: [], retraits: 0 };
  b.cadence = creerCadence({
    maintenant: () => b.t,
    masquee: () => b.cachee,
    poser: (_rappel, ms) => { b.minuteurs += 1; b.poses.push(ms); return b.poses.length; },
    retirer: () => { b.minuteurs -= 1; b.retraits += 1; },
  });
  return b;
}

console.log('=== Seules les animations sans fin sont prises ===');
{
  const b = banc();
  const ciel = animation();
  const geste = animation({ iterations: 1 });
  const trois = animation({ iterations: 3 });
  b.cadence.prendre([ciel, geste, trois]);
  check('une animation sans fin est mise en pause', ['paused', 1], [ciel.playState, ciel.pauses]);
  check('l\'animation d\'un geste continue d\'elle-meme', ['running', 0], [geste.playState, geste.pauses]);
  check('une animation qui finit, meme en plusieurs tours, aussi', 'running', trois.playState);
  check('une seule est suivie', 1, b.cadence.etat().suivies);
  check('la cadence annoncee', 30, IMAGES_PAR_SECONDE);
  check('la minuterie bat a cette cadence', [1000 / 30], b.poses);
}

console.log('\n=== Chacune garde son horloge ===');
{
  const b = banc();
  const a = animation({ currentTime: 9000 });
  const lente = animation({ currentTime: 500, playbackRate: 0.5 });
  b.cadence.prendre([a, lente]);
  b.t += 2000;
  b.cadence.battre();
  check('elle repart d\'ou elle en etait, pas de zero', 11000, a.currentTime);
  check('sa vitesse propre est respectee', 1500, lente.currentTime);
  b.t += 33;
  b.cadence.battre();
  check('et avance au battement suivant', 11033, a.currentTime);
}

console.log('\n=== Prendre deux fois ne remet rien a zero ===');
{
  const b = banc();
  const a = animation({ currentTime: 100 });
  b.cadence.prendre([a]);
  b.t += 1000;
  b.cadence.battre();
  b.cadence.prendre([a]);
  b.t += 1000;
  b.cadence.battre();
  check('l\'horloge n\'a pas saute', 2100, a.currentTime);
  check('une seule pause', 1, a.pauses);
  check('une seule minuterie', 1, b.minuteurs);
}

console.log('\n=== Une animation annulee ne revit jamais ===');
{
  const b = banc();
  const a = animation({ currentTime: 100 });
  const reste = animation();
  b.cadence.prendre([a, reste]);
  a.playState = 'idle';
  a.currentTime = null;
  b.t += 1000;
  b.cadence.battre();
  check('on ne lui redonne pas d\'horloge', null, a.currentTime);
  check('elle n\'est plus suivie', 1, b.cadence.etat().suivies);
  check('la minuterie reste pour les autres', true, b.cadence.etat().minuteur);
  const annulee = animation({ playState: 'idle' });
  b.cadence.prendre([annulee]);
  check('une animation deja annulee n\'est pas prise', [0, 1], [annulee.pauses, b.cadence.etat().suivies]);
}

console.log('\n=== Sans rien a cadencer, plus aucun reveil ===');
{
  const b = banc();
  check('rien a prendre : aucune minuterie', 0, (b.cadence.prendre([]), b.minuteurs));
  check('une animation qui finit ne pose pas de minuterie', 0, (b.cadence.prendre([animation({ iterations: 1 })]), b.minuteurs));
  const a = animation();
  b.cadence.prendre([a]);
  check('la premiere sans fin la pose', 1, b.minuteurs);
  a.playState = 'idle';
  b.cadence.battre();
  check('la derniere partie, la minuterie s\'arrete', [0, false], [b.minuteurs, b.cadence.etat().minuteur]);
  const c = animation();
  b.cadence.prendre([c]);
  check('une nouvelle la repose', 1, b.minuteurs);
}

console.log('\n=== Page masquee : rien a calculer, et le temps se rattrape ===');
{
  const b = banc();
  const a = animation({ currentTime: 0 });
  b.cadence.prendre([a]);
  b.cachee = true;
  b.t += 60_000;
  b.cadence.battre();
  check('masquee : l\'horloge ne bouge pas', 0, a.currentTime);
  b.cachee = false;
  b.cadence.battre();
  check('au retour, elle est a l\'heure', 60_000, a.currentTime);
}

console.log(`\n${echecs === 0 ? 'TOUS LES TESTS PASSENT' : `${echecs} TEST(S) EN ECHEC`}`);
process.exit(echecs === 0 ? 0 : 1);
