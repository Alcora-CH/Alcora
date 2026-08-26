'use strict';

/**
 * Ce qu'un refus de connexion VEUT DIRE, et quand une session se reutilise.
 *
 *   node test-connexion.js
 *
 * POURQUOI CETTE SUITE EXISTE. Le 26.08.2026, configurer Alcora sur une console en
 * Protect 7.2.105 echouait en 503 alors que « Vérifier la connexion » venait de reussir.
 * Deux defauts se combinaient : l'enregistrement se reauthentifiait DEUX fois de plus en
 * moins de cinq secondes, et le message affiche accusait les droits du compte — qui
 * n'avaient jamais manque. Le pire n'est pas l'echec : c'est le message poli qui envoie
 * chercher au mauvais endroit.
 *
 * Aucun reseau ici : la requete est remplacee, et la fonction de reprise est pure.
 */

const { ProtectClient, reussiteRecente, _fixerDerniereReussite } = require('./protect/client');
const { essaiUtilisable } = require('./protect/essai');

let failures = 0;

function checkBool(label, condition) {
  if (!condition) failures++;
  console.log(`${condition ? '  OK  ' : ' ECHEC'}  ${label}`);
}

/** Un client dont la requete rend le code voulu, sans jamais toucher au reseau. */
function clientQuiRepond(status, { headers = {}, body = '', graine } = {}) {
  const c = new ProtectClient({ host: 'console.invalide' });
  c.setCredentials({ username: 'compte', password: 'motdepasse', totpSeed: graine });
  c.request = async () => ({ status, headers, body: Buffer.from(body, 'utf8') });
  return c;
}

/** Le nom de l'erreur levee, ou 'AUCUNE' si l'appel a abouti. */
async function nomErreur(client) {
  try {
    await client.login();
    return 'AUCUNE';
  } catch (e) {
    return e.name;
  }
}

const MAINTENANT = 1_800_000_000_000;

(async () => {
  console.log('=== 403 : deux causes opposees sous un meme code ===');

  _fixerDerniereReussite(null);
  checkBool('sans authentification recente, un 403 accuse les DROITS',
    (await nomErreur(clientQuiRepond(403))) === 'ForbiddenError');

  _fixerDerniereReussite(Date.now());
  checkBool('apres une authentification recente, un 403 parle de CADENCE',
    (await nomErreur(clientQuiRepond(403))) === 'RateLimitedError');

  console.log('\n=== 503 : le code vu chez l ami, meme lecture ===');

  _fixerDerniereReussite(null);
  checkBool('sans authentification recente, un 503 reste une erreur de controleur',
    (await nomErreur(clientQuiRepond(503))) === 'ApiError');

  _fixerDerniereReussite(Date.now());
  checkBool('apres une authentification recente, un 503 parle de CADENCE',
    (await nomErreur(clientQuiRepond(503))) === 'RateLimitedError');

  console.log('\n=== 429 : toujours une cadence, avec ou sans reussite recente ===');

  for (const quand of [null, Date.now()]) {
    _fixerDerniereReussite(quand);
    checkBool(`429 rend RateLimitedError (reussite recente : ${quand !== null})`,
      (await nomErreur(clientQuiRepond(429))) === 'RateLimitedError');
  }

  _fixerDerniereReussite(null);
  let e429;
  try { await clientQuiRepond(429, { headers: { 'retry-after': '120' } }).login(); } catch (e) { e429 = e; }
  checkBool("l'en-tete Retry-After est respecte", e429?.retryAfterSeconds === 120);
  try { await clientQuiRepond(429).login(); } catch (e) { e429 = e; }
  checkBool('sans en-tete, on retombe sur 30 s', e429?.retryAfterSeconds === 30);

  console.log('\n=== les autres codes ne changent pas de sens ===');

  // La nuance ne vaut QUE pour les codes de bridage : un mot de passe faux reste faux,
  // qu'une session ait ete ouverte trente secondes plus tot ou jamais.
  for (const quand of [null, Date.now()]) {
    _fixerDerniereReussite(quand);
    checkBool(`401 accuse les identifiants (reussite recente : ${quand !== null})`,
      (await nomErreur(clientQuiRepond(401, { body: 'invalid credentials' }))) === 'CredentialsError');
    checkBool(`499 sans graine exige un second facteur (reussite recente : ${quand !== null})`,
      (await nomErreur(clientQuiRepond(499))) === 'TotpRequiredError');
    checkBool(`499 avec graine dit qu il est REFUSE (reussite recente : ${quand !== null})`,
      (await nomErreur(clientQuiRepond(499, { graine: 'JBSWY3DPEHPK3PXP' }))) === 'TotpError');
    checkBool(`500 reste une erreur de controleur (reussite recente : ${quand !== null})`,
      (await nomErreur(clientQuiRepond(500))) === 'ApiError');
  }

  console.log('\n=== la fenetre de cinq minutes ===');

  _fixerDerniereReussite(MAINTENANT);
  checkBool('a 4 min 59, la reussite est encore recente', reussiteRecente(MAINTENANT + 299_000));
  checkBool('a 5 min 01, elle ne l est plus', !reussiteRecente(MAINTENANT + 301_000));
  _fixerDerniereReussite(null);
  checkBool('sans aucune reussite, jamais recente', !reussiteRecente(MAINTENANT));

  console.log('\n=== une connexion acceptee MARQUE la reussite ===');

  const ok = clientQuiRepond(200);
  ok.session.setCookie('TOKEN', 'valeur-de-session');
  _fixerDerniereReussite(null);
  await ok.login();
  checkBool('apres un 200, la reussite est enregistree', reussiteRecente());

  console.log('\n=== reprise du test : a quelles conditions ===');

  const faux = (utilisable, mdp = 'motdepasse', graine = undefined) =>
    ({ session: { usable: utilisable }, credentials: { username: 'compte', password: mdp, totpSeed: graine } });
  const base = { host: 'console-a', username: 'compte', a: MAINTENANT, pin: 'p', client: faux(true) };
  const ident = { host: 'console-a', username: 'compte', password: 'motdepasse' };

  checkBool('meme console, meme compte, session vivante : on reprend',
    essaiUtilisable(base, ident, MAINTENANT) === base);
  checkBool('AUTRE console : on ne reprend pas',
    essaiUtilisable({ ...base, host: 'console-b' }, ident, MAINTENANT) === null);
  checkBool('AUTRE compte : on ne reprend pas',
    essaiUtilisable({ ...base, username: 'quelqu-un-d-autre' }, ident, MAINTENANT) === null);
  checkBool('session expirante : on ne reprend pas',
    essaiUtilisable({ ...base, client: faux(false) }, ident, MAINTENANT) === null);
  // Le verdict du test ne se reinitialise PAS quand un champ change : sans ces deux
  // controles, un mot de passe modifie apres coup serait enregistre sans etre eprouve.
  checkBool('MOT DE PASSE modifie depuis le test : on ne reprend pas',
    essaiUtilisable({ ...base, client: faux(true, 'un-autre-mot-de-passe') }, ident, MAINTENANT) === null);
  checkBool('GRAINE ajoutee depuis le test : on ne reprend pas',
    essaiUtilisable(base, { ...ident, totpSeed: 'JBSWY3DPEHPK3PXP' }, MAINTENANT) === null);
  checkBool('graine identique de part et d autre : on reprend',
    essaiUtilisable({ ...base, client: faux(true, 'motdepasse', 'JBSWY3DPEHPK3PXP') },
                    { ...ident, totpSeed: 'JBSWY3DPEHPK3PXP' }, MAINTENANT) !== null);
  checkBool('essai vieux de plus de dix minutes : on ne reprend pas',
    essaiUtilisable(base, ident, MAINTENANT + 601_000) === null);
  checkBool('essai de neuf minutes : on reprend encore',
    essaiUtilisable(base, ident, MAINTENANT + 540_000) === base);
  checkBool('aucun essai : rien a reprendre',
    essaiUtilisable(null, ident, MAINTENANT) === null);

  console.log('\n' + (failures === 0 ? 'TOUS LES TESTS PASSENT' : `${failures} TEST(S) EN ECHEC`));
  process.exit(failures === 0 ? 0 : 1);
})();
