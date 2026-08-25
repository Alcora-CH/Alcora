'use strict';

/**
 * La configuration et les secrets.
 *
 *   node test-store.js
 *
 * Ce module garde l'adresse du controleur, le compte, le mot de passe, la cle a deux
 * facteurs et l'empreinte de cle publique qui garantit qu'on parle bien AU controleur. Ses
 * commentaires racontent trois incidents survenus sur le poste reel — une copie perimee qui
 * a efface les identifiants, un fichier tronque qui a fait perdre l'empreinte, une reprise
 * de dossier qui a rendu les secrets illisibles — et rien ne verifiait qu'ils ne peuvent
 * plus se reproduire.
 *
 * Aucun Electron ici : `safeStorage` est remplace par un chiffrement factice mais
 * REVERSIBLE, ce qui permet d'eprouver les allers-retours, le refus d'ecrire en clair, et
 * le cas du secret chiffre sous un autre compte Windows.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');

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

function checkBool(label, condition) {
  if (!condition) echecs++;
  console.log(`${condition ? '  OK  ' : ' ECHEC'}  ${label}`);
}

/**
 * Vrai si le texte porte un caractere de controle AUTRE que ceux qu'un texte legitime
 * peut contenir : tabulation, sauts de ligne, retour chariot (0x09 a 0x0D).
 *
 * Ecrit en clair plutot qu'en classe d'expression reguliere, et ce n'est pas une
 * preference de style. La version d'avant le 19.08.2026 portait ces bornes en octets
 * LITTERAUX : le fichier passait pour binaire aux yeux de grep, et oxlint ne voyait
 * rien — sa regle « no-control-regex » ne reconnait que les echappements. Le defaut
 * dormait donc sous un garde-fou actif. L'ecrire ainsi le met hors de portee des deux
 * problemes. Signale par l'analyse de code de GitHub (js/overly-large-range).
 *
 * Laisser passer 0x09 a 0x0D EST le point delicat : les rejeter ferait echouer le faux
 * coffre la ou le vrai reussit, et le test mentirait dans le sens le plus trompeur —
 * en passant au vert.
 */
function porteDesCaracteresDeControle(texte) {
  for (const c of texte) {
    const n = c.codePointAt(0);
    if (n < 0x20 && (n < 0x09 || n > 0x0d)) return true;
  }
  return false;
}

/**
 * Un faux `safeStorage`.
 *
 * `cle` represente la cle tiree par Electron POUR CE DOSSIER : en changer simule un secret
 * chiffre par une autre installation, ou sous un autre compte Windows. `disponible`
 * simule un systeme ou le chiffrement n'existe pas.
 */
const faux = {
  disponible: true,
  cle: 7,
  isEncryptionAvailable() { return faux.disponible; },
  encryptString(texte) {
    return Buffer.from([...Buffer.from(String(texte), 'utf8')].map((o) => o ^ faux.cle));
  },
  decryptString(octets) {
    if (!Buffer.isBuffer(octets) || !octets.length) throw new Error('vide');
    const clair = Buffer.from([...octets].map((o) => o ^ faux.cle)).toString('utf8');
    // Un dechiffrement avec la mauvaise cle ne rend pas du texte lisible : on le refuse,
    // comme le ferait le vrai safeStorage.
    if (porteDesCaracteresDeControle(clair)) throw new Error('cle etrangere');
    return clair;
  },
};

const vraiCharger = Module._load;
Module._load = function charger(demande, parent, principal) {
  if (demande === 'electron') return { safeStorage: faux };
  return vraiCharger.call(this, demande, parent, principal);
};

const { Store, comparerVersions, reprendreDossier } = require('./store');

const dossierNeuf = () => fs.mkdtempSync(path.join(os.tmpdir(), 'alcora-store-'));

console.log('\n=== Comparaison des versions ===');
{
  check('2.10.0 > 2.9.1', 1, comparerVersions('2.10.0', '2.9.1'));
  check('2.9.1 < 2.10.0', -1, comparerVersions('2.9.1', '2.10.0'));
  check('égales', 0, comparerVersions('2.17.5', '2.17.5'));
  check('2.17 vaut 2.17.0', 0, comparerVersions('2.17', '2.17.0'));
  // Une forme inconnue vaut 0.0.0 : elle ne doit jamais passer pour la plus recente.
  check('forme inconnue vs 1.0.0', -1, comparerVersions('inconnue', '1.0.0'));
  check('rien vs rien', 0, comparerVersions(undefined, null));
}

console.log('\n=== La copie périmée est reconnue et arrêtée ===');
{
  /*
   * L'incident du 23.07.2026 : une 2.0.0 restee dans un dossier oublie, lancee par un
   * raccourci perime, partageait ce dossier de donnees et y a efface les identifiants.
   */
  const s = new Store(dossierNeuf());
  s.marquerVersion('2.17.5');
  check('une copie ANCIENNE est démasquée', '2.17.5', s.versionPlusRecente('2.0.0'));
  check('la version courante passe', null, s.versionPlusRecente('2.17.5'));
  check('une plus récente passe', null, s.versionPlusRecente('2.18.0'));

  s.marquerVersion('2.1.0');
  check('marquer n’abaisse JAMAIS la version notée', '2.17.5', s.readConfig().derniereVersion);
  s.marquerVersion('2.18.0');
  check('mais elle monte', '2.18.0', s.readConfig().derniereVersion);
}

console.log('\n=== Une configuration illisible est mise de côté, jamais effacée ===');
{
  /*
   * L'incident du fichier tronque : « absent » et « illisible » etaient confondus, la
   * configuration paraissait vierge, et le premier enregistrement suivant ECRASAIT
   * l'empreinte de cle publique du controleur — la seule garantie qu'on parle bien a lui.
   */
  const d = dossierNeuf();
  const s = new Store(d);
  fs.writeFileSync(path.join(d, 'config.json'), '{"host":"10.0.0.1","pins":["abc"');  // tronqué

  const config = s.readConfig();
  check('on repart d’une configuration vierge', false, config.configured);
  checkBool('l’original est mis de côté', fs.existsSync(`${path.join(d, 'config.json')}.illisible`));
  checkBool('et le chemin en est retenu', typeof s.illisible === 'string');
  check('le contenu mis de côté est INTACT',
    '{"host":"10.0.0.1","pins":["abc"',
    fs.readFileSync(`${path.join(d, 'config.json')}.illisible`, 'utf8'));
}

console.log('\n=== L’écriture de la configuration est tout ou rien ===');
{
  const d = dossierNeuf();
  const s = new Store(d);
  s.writeConfig({ ...s.configVierge(), host: '10.0.0.1', pins: ['empreinte'] });
  check('relue à l’identique', ['empreinte'], s.readConfig().pins);
  checkBool('aucun fichier provisoire ne subsiste',
    !fs.existsSync(path.join(d, 'config.json.tmp')));
  // Une seconde ecriture remplace, sans laisser de trace intermediaire.
  s.writeConfig({ ...s.readConfig(), host: '10.0.0.2' });
  check('remplacée', '10.0.0.2', s.readConfig().host);
  check('les autres champs survivent', ['empreinte'], s.readConfig().pins);
}

console.log('\n=== Les secrets ===');
{
  const s = new Store(dossierNeuf());
  s.writeSecret('password', 'motdepasse-fictif');
  check('aller-retour', 'motdepasse-fictif', s.readSecret('password'));

  checkBool('rien n’est écrit en clair',
    !fs.readFileSync(s.secretPath('password')).includes('motdepasse-fictif'));

  check('un secret absent rend null, sans lever', null, s.readSecret('session'));

  // Chiffre par une AUTRE installation : illisible, mais l'application ne tombe pas.
  faux.cle = 42;
  check('secret d’un autre compte : null, pas une exception', null, s.readSecret('password'));
  faux.cle = 7;
  check('et redevient lisible avec la bonne clé', 'motdepasse-fictif', s.readSecret('password'));

  s.writeSecret('totp', 'ABCDEF');
  s.clearSecrets();
  check('tout est effacé', [null, null], [s.readSecret('password'), s.readSecret('totp')]);
}

console.log('\n=== Sans chiffrement, on refuse d’écrire — on n’écrit pas en clair ===');
{
  const s = new Store(dossierNeuf());
  faux.disponible = false;
  let leve = null;
  try { s.writeSecret('password', 'motdepasse-fictif'); } catch (e) { leve = e.message; }
  faux.disponible = true;

  checkBool('l’écriture est refusée', leve !== null);
  checkBool('et AUCUN fichier n’a été créé', !fs.existsSync(s.secretPath('password')));
}

console.log('\n=== Reprise du dossier de l’ancien nom ===');
{
  /*
   * L'incident du 28.07.2026, au renommage en Alcora. Copier config et secrets ne suffit
   * PAS : Electron tire une cle AES au hasard PAR DOSSIER et la range dans « Local State ».
   * Sans ce fichier, les secrets recopies ne s'ouvrent plus, et l'ecran de connexion
   * reapparait malgre la copie.
   */
  const ancien = dossierNeuf();
  const nouveau = path.join(dossierNeuf(), 'neuf');
  fs.writeFileSync(path.join(ancien, 'config.json'), '{"host":"10.0.0.1"}');
  fs.writeFileSync(path.join(ancien, 'Local State'), 'la-cle-du-dossier');
  fs.mkdirSync(path.join(ancien, 'secrets'), { recursive: true });
  fs.writeFileSync(path.join(ancien, 'secrets', 'password.bin'), Buffer.from([1, 2, 3]));

  check('la reprise annonce le dossier repris', ancien, reprendreDossier(ancien, nouveau));
  checkBool('la configuration a suivi', fs.existsSync(path.join(nouveau, 'config.json')));
  checkBool('« Local State » AUSSI — sans lui les secrets sont morts',
    fs.existsSync(path.join(nouveau, 'Local State')));
  checkBool('les secrets ont suivi',
    fs.existsSync(path.join(nouveau, 'secrets', 'password.bin')));

  check('une seconde reprise ne refait rien', null, reprendreDossier(ancien, nouveau));
}

console.log('\n=== La reprise n’écrase JAMAIS ce qui est déjà en place ===');
{
  const ancien = dossierNeuf();
  const nouveau = dossierNeuf();
  fs.writeFileSync(path.join(ancien, 'config.json'), '{"host":"ancien"}');
  fs.writeFileSync(path.join(nouveau, 'config.json'), '{"host":"en-place"}');

  check('rien n’est fait', null, reprendreDossier(ancien, nouveau));
  check('la configuration en place est intacte',
    '{"host":"en-place"}', fs.readFileSync(path.join(nouveau, 'config.json'), 'utf8'));
}

console.log('\n=== Une clé déjà présente n’est jamais remplacée ===');
{
  /*
   * Cas limite mais destructeur : le nouveau dossier n'a pas encore de config mais possede
   * DEJA sa cle et ses secrets. Recopier « Local State » par-dessus rendrait illisibles les
   * secrets qui s'y trouvent — on detruirait ce qu'on venait sauver.
   */
  const ancien = dossierNeuf();
  const nouveau = dossierNeuf();
  fs.writeFileSync(path.join(ancien, 'config.json'), '{"host":"ancien"}');
  fs.writeFileSync(path.join(ancien, 'Local State'), 'cle-ancienne');
  fs.writeFileSync(path.join(nouveau, 'Local State'), 'cle-en-place');

  reprendreDossier(ancien, nouveau);
  check('la clé en place a survécu',
    'cle-en-place', fs.readFileSync(path.join(nouveau, 'Local State'), 'utf8'));
}

console.log('\n=== Une reprise impossible ne fait pas tomber l’application ===');
{
  const nouveau = dossierNeuf();
  check('source inexistante', null, reprendreDossier(path.join(nouveau, 'nulle-part'), nouveau));
  check('même dossier des deux côtés', null, reprendreDossier(nouveau, nouveau));
}

console.log('\n=== La connexion mise de côté avant une remise à zéro ===');
{
  const s = new Store(dossierNeuf());
  s.writeConfig({ ...s.configVierge(), host: '10.0.0.1', username: 'compte', configured: true });
  s.writeSecret('password', 'motdepasse-fictif');
  s.writeSecret('totp', 'ABCDEF');

  check('archivée', true, s.archiverConfiguration());
  check('elle est proposable', true, s.sauvegarde().existe);
  check('avec son adresse', '10.0.0.1', s.sauvegarde().host);

  // La remise a zero.
  s.clearSecrets();
  s.writeConfig(s.configVierge());
  check('tout est bien effacé', null, s.readSecret('password'));

  check('reposée', true, s.restaurerSauvegarde());
  check('le mot de passe est revenu', 'motdepasse-fictif', s.readSecret('password'));
  check('la clé à deux facteurs aussi', 'ABCDEF', s.readSecret('totp'));
  check('et l’adresse', '10.0.0.1', s.readConfig().host);
}

console.log('\n=== Une SECONDE remise à zéro ne détruit pas la sauvegarde ===');
{
  /*
   * Le piege : apres la premiere remise a zero la configuration est vide. Archiver de
   * nouveau ecraserait la bonne sauvegarde par du vide — et le seul exemplaire reposable
   * disparaitrait au moment ou l'on en a le plus besoin.
   */
  const s = new Store(dossierNeuf());
  s.writeConfig({ ...s.configVierge(), host: '10.0.0.1', configured: true });
  s.writeSecret('password', 'motdepasse-fictif');
  s.archiverConfiguration();

  s.clearSecrets();
  s.writeConfig(s.configVierge());

  check('la seconde archive est REFUSÉE', false, s.archiverConfiguration());
  check('la bonne sauvegarde est toujours là', '10.0.0.1', s.sauvegarde().host);
  s.restaurerSauvegarde();
  check('et reste reposable', 'motdepasse-fictif', s.readSecret('password'));
}

console.log('\n=== Les nouveautés d’une mise à jour ===');
{
  /*
   * Le contrat : l'ecran ne parait QUE pour une mise a jour. Jamais a la premiere
   * installation, jamais deux fois, jamais pour une copie plus ancienne.
   */
  const s = new Store(dossierNeuf());

  check('première installation : rien à présenter', null, s.nouveautesAPresenter('2.19.0'));
  check('et elle est marquée en silence', '2.19.0', s.readConfig().versionPresentee);
  check('relancer la même version : toujours rien', null, s.nouveautesAPresenter('2.19.0'));

  check('mise à jour : l’écart exact',
    { de: '2.19.0', a: '2.20.0' }, s.nouveautesAPresenter('2.20.0'));
  check('pas encore vues : représentées au prochain lancement',
    { de: '2.19.0', a: '2.20.0' }, s.nouveautesAPresenter('2.20.0'));

  s.marquerPresentee('2.20.0');
  check('vues : plus rien', null, s.nouveautesAPresenter('2.20.0'));

  check('une copie PLUS ANCIENNE ne présente rien', null, s.nouveautesAPresenter('2.18.0'));
  check('et ne recule pas la version vue', '2.20.0', s.readConfig().versionPresentee);
}

console.log('\n=== Un poste installé AVANT cette fonctionnalité ===');
{
  /*
   * Le poste de reference : derniereVersion existe, versionPresentee non. La premiere mise a
   * jour qui suit doit presenter ses nouveautes depuis derniereVersion, pas se taire.
   */
  const s = new Store(dossierNeuf());
  s.writeConfig({ ...s.configVierge(), derniereVersion: '2.18.2', versionPresentee: '' });

  check('l’écart part de la dernière version AYANT TOURNÉ',
    { de: '2.18.2', a: '2.19.0' }, s.nouveautesAPresenter('2.19.0'));

  // Et l'ordre reel du demarrage — nouveautes PUIS marquage — ne perd rien.
  s.marquerVersion('2.19.0');
  check('marquerVersion après coup ne casse pas l’écart en attente',
    { de: '2.18.2', a: '2.19.0' }, s.nouveautesAPresenter('2.19.0'));
}

console.log('\n=== Rien à reposer : on le dit, on ne prétend pas ===');
{
  const s = new Store(dossierNeuf());
  check('aucune sauvegarde', false, s.sauvegarde().existe);
  check('la restauration échoue franchement', false, s.restaurerSauvegarde());
}

console.log(echecs === 0 ? '\nTOUS LES TESTS PASSENT\n' : `\n${echecs} ÉCHEC(S)\n`);
process.exit(echecs === 0 ? 0 : 1);
