/**
 * Les adresses des medias (v2/web/src/lib/medias.ts), lues dans leur source meme.
 *
 *   node test-medias.mjs
 *
 * Ajoutee le 17.11.2026 avec la demonstration publique du site alcora.ch : la meme page tourne
 * dans l'application (le processus principal sert /vignette/… et /instantane/…) et sous /demo/
 * sur le site, ou rien de tout cela n'existe. Ce qui est garde : dans l'application, AUCUNE
 * adresse ne change ; dans la demonstration, chacune mene a un fichier pose sous la base.
 */

import { adresseMedia, videoDemo, VIGNETTES_DEMO } from '../web/src/lib/medias.ts';

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

console.log('=== Dans l application : rien ne change ===');
for (const c of ['/vignette/abc', '/instantane/g6?t=12', '/demo-extrait.mp4#5', '/autre.png']) {
  check(`${c} reste tel quel`, c, adresseMedia(c, false, '/demo/'));
}

console.log('=== Dans la demonstration publique ===');
const v = adresseMedia('/vignette/evt-42', true, '/demo/');
check('une vignette mene a un fichier de demonstration', true, /^\/demo\/medias\/vignettes\/\d+\.jpg$/.test(v));
check('la meme detection a toujours la meme vignette', v, adresseMedia('/vignette/evt-42', true, '/demo/'));
const n = Number((v.match(/(\d+)\.jpg$/) || [])[1] ?? -1);
check('le numero reste dans les vignettes existantes', true, n >= 0 && n < VIGNETTES_DEMO);
check('l instantane de la G5 montre les bureaux', '/demo/medias/instantanes/bureaux.jpg', adresseMedia('/instantane/g5?t=99', true, '/demo/'));
check('celui de la G6 montre l allee', '/demo/medias/instantanes/allee.jpg', adresseMedia('/instantane/g6?t=99', true, '/demo/'));
check('la mire garde son instant de depart', '/demo/demo-extrait.mp4#1234', adresseMedia('/demo-extrait.mp4#1234', true, '/demo/'));
check('la mire sans instant', '/demo/demo-extrait.mp4', adresseMedia('/demo-extrait.mp4', true, '/demo/'));
check('une adresse inconnue ne change pas', '/autre.png', adresseMedia('/autre.png', true, '/demo/'));

console.log('=== Le direct de demonstration ===');
check('la G5 lit les bureaux en boucle', '/demo/medias/bureaux.mp4', videoDemo('g5_medium', '/demo/'));
check('la G6 lit l allee en boucle', '/demo/medias/allee.mp4', videoDemo('g6_high', '/demo/'));

if (echecs) {
  console.error(`\n${echecs} echec(s)`);
  process.exit(1);
}
console.log('\nAdresses des medias : application inchangee, demonstration servie a cote de la page');
