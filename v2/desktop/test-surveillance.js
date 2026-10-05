'use strict';

/**
 * Garder la page en vie : quand l'abattre, quand la recharger, quand s'arreter.
 *
 *   node test-surveillance.js
 *
 * Le 05.10.2026, la page est restee bloquee trente-cinq minutes dans pc.close() apres la
 * mort du service reseau de Chromium (voir surveillance.js). Ces verifications tiennent
 * les trois decisions qui l'en sortent — et surtout celles qui l'empecheraient de
 * tourner en rond.
 */

const s = require('./surveillance');

let failures = 0;
function checkBool(label, condition) {
  if (!condition) failures++;
  console.log(`${condition ? '  OK  ' : ' ECHEC'}  ${label}`);
}

// Les champs tels qu'Electron les documente. Le serviceName est celui RELEVE le 05.10.2026
// sur la ligne de commande du processus remplacant ; le journal de l'epoque, lui, ne
// l'enregistrait pas — c'est l'un des trous que ce correctif bouche.
const RESEAU = { type: 'Utility', reason: 'crashed',
  serviceName: 'network.mojom.NetworkService', name: 'Network Service' };
const AUDIO = { type: 'Utility', reason: 'crashed', serviceName: 'audio.mojom.AudioService', name: 'Audio Service' };

console.log('=== Le journal NOMME le processus mort ===');
checkBool('le service reseau est nomme',
  s.nomDuProcessus(RESEAU) === 'Utility (network.mojom.NetworkService)');
checkBool('a defaut de serviceName, le nom lisible',
  s.nomDuProcessus({ type: 'Utility', name: 'Network Service' }) === 'Utility (Network Service)');
checkBool('un processus sans nom garde au moins son type', s.nomDuProcessus({ type: 'GPU' }) === 'GPU');
checkBool('des details absents ne font pas planter le journal', s.nomDuProcessus(undefined) === 'unknown process');

console.log('\n=== Abattre la page : seulement pour le service reseau ===');
checkBool('le service reseau qui plante : on abat', s.faireTomberLaPage(RESEAU));
checkBool('reconnu aussi par son nom lisible seul',
  s.faireTomberLaPage({ type: 'Utility', reason: 'crashed', name: 'Network Service' }));
checkBool('tue par le systeme (memoire) : on abat aussi',
  s.faireTomberLaPage({ ...RESEAU, reason: 'oom' }));
// Abattre pour un service qui ne porte aucune image couterait un ecran noir pour rien.
checkBool('le service AUDIO qui plante : on NE touche PAS a la page', !s.faireTomberLaPage(AUDIO));
checkBool('le GPU qui plante : pas cette regle-ci (le battement veille)',
  !s.faireTomberLaPage({ type: 'GPU', reason: 'crashed' }));
checkBool('une sortie propre n\'est jamais une panne',
  !s.faireTomberLaPage({ ...RESEAU, reason: 'clean-exit' }));
checkBool('des details absents : on ne fait rien', !s.faireTomberLaPage(null));

console.log('\n=== Recharger une page disparue ===');
checkBool('page plantee : on recharge', s.fautIlRecharger({ reason: 'crashed' }, false));
checkBool('page abattue par nous : on recharge', s.fautIlRecharger({ reason: 'killed' }, false));
checkBool('fermeture normale : on ne recharge pas', !s.fautIlRecharger({ reason: 'clean-exit' }, false));
// Recharger une fenetre qu'on ferme la ferait renaitre sous les doigts de l'utilisateur.
checkBool('application en train de quitter : on ne recharge JAMAIS',
  !s.fautIlRecharger({ reason: 'crashed' }, true));

console.log('\n=== Le budget : jamais de boucle serree ===');
const T = 1_800_000_000_000;
let h = [];
let r;
for (let i = 0; i < 3; i++) {
  r = s.rechargement(h, T + i * 1_000);
  h = r.historique;
  checkBool(`essai ${i + 1} sur trois en cinq minutes : permis`, r.permis);
}
r = s.rechargement(h, T + 3_000);
checkBool('quatrieme essai dans la meme fenetre : REFUSE', !r.permis);
checkBool('le refus dit quand une place se libere (au plus ancien + 5 min)',
  r.attenteMs === T + s.FENETRE_RECHARGEMENTS_MS - (T + 3_000));
checkBool('le refus ne consomme pas de place', r.historique.length === 3);
r = s.rechargement(h, T + s.FENETRE_RECHARGEMENTS_MS + 1);
checkBool('une fois la plus ancienne sortie de la fenetre : permis a nouveau', r.permis);
checkBool('un historique corrompu ne bloque rien', s.rechargement([NaN, undefined, 'x'], T).permis);
checkBool('une date venue du futur (horloge corrigee) ne compte pas',
  s.rechargement([T + 10 * 60_000, T + 11 * 60_000, T + 12 * 60_000], T).permis);
checkBool('l attente n est jamais nulle ni negative',
  s.rechargement([T - 299_999, T - 299_999, T - 299_999], T).attenteMs >= 1_000);

console.log('\n=== Le battement : seulement des silences CONSECUTIFS ===');
let b = s.apresSonde(0, false);
checkBool('un premier silence ne suffit pas', !b.abattre && b.rates === 1);
b = s.apresSonde(b.rates, false);
checkBool('deux silences d\'affilee : on abat', b.abattre);
checkBool('apres l\'abattage, le compte repart de zero', b.rates === 0);
b = s.apresSonde(1, true);
checkBool('une reponse efface le silence precedent', !b.abattre && b.rates === 0);
// Quelques lenteurs isolees sur une journee ne doivent jamais additionner leurs effets.
let rates = 0, abattue = false;
for (let i = 0; i < 50; i++) {
  const x = s.apresSonde(rates, i % 2 === 0);
  rates = x.rates;
  abattue = abattue || x.abattre;
}
checkBool('cinquante silences isoles, intercales de reponses : jamais abattue', !abattue);
checkBool('un compte corrompu repart proprement', s.apresSonde(NaN, false).rates === 1);

console.log('\n=== Les delais tiennent ensemble ===');
checkBool('la sonde rend la main avant la suivante',
  s.DELAI_REPONSE_MS <= s.PERIODE_BATTEMENT_MS);
checkBool('une page bloquee est abattue en moins d\'une minute',
  s.RATES_AVANT_ABATTAGE * s.PERIODE_BATTEMENT_MS + s.DELAI_REPONSE_MS <= 60_000);

console.log('\n' + (failures === 0 ? 'TOUS LES TESTS PASSENT' : `${failures} TEST(S) EN ECHEC`));
process.exit(failures === 0 ? 0 : 1);
