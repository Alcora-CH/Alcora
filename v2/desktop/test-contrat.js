'use strict';

/**
 * Le contrat entre le processus principal et la page.
 *
 *   node test-contrat.js
 *
 * Ecrit le 30.07.2026, apres un defaut que RIEN ne pouvait voir. Six champs — définitions
 * HD/2K/4K, UniFi OS, écrit par jour, allumé depuis, armement de Protect, rétentions — ont
 * ete releves dans l'inventaire du controleur, calcules, declares dans l'interface
 * TypeScript `SystemeEtat`, et affiches par la colonne d'etat. Ils n'ont jamais paru : le
 * passe-plat IPC enumerait ses champs a la main et les jetait tous les six.
 *
 * Aucun outil ne pouvait le signaler. Le contrat TypeScript decrit ce que la page ATTEND ;
 * le processus principal est en JavaScript, ou il ne s'applique pas. Les deux cotes
 * pouvaient donc diverger indefiniment sans qu'une seule verification ne rougisse.
 *
 * Ce fichier ferme cette porte : il LIT le contrat TypeScript et compare ses champs a ceux
 * que la projection produit reellement. Une divergence, dans un sens ou dans l'autre, est
 * un echec — un champ oublie comme un champ envoye pour rien.
 */

const fs = require('node:fs');
const path = require('node:path');
const { camerasPourInterface, etatPourInterface, etatSysteme } = require('./protect/discovery');

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
 * Champs declares par une interface du contrat TypeScript.
 *
 * Lecture textuelle, volontairement : embarquer un compilateur TypeScript dans une
 * verification hors ligne du processus principal serait hors de proportion. On ne cherche
 * que les NOMS de champs de premier niveau, ce qui suffit exactement au defaut vise.
 */
const uniq = (a) => [...new Set(a)].sort();
const absents = (a, b) => a.filter((x) => !b.includes(x));

const lire = (...p) => fs.readFileSync(path.join(__dirname, ...p), 'utf8');
const CONTRAT = lire('..', 'web', 'src', 'types', 'protect.ts');
const PRELOAD = lire('preload.js');
const MAIN = lire('main.js');

/**
 * Corps d'une interface, accolades imbriquees comprises.
 *
 * Decoupe par COMPTAGE et non sur « la premiere accolade en debut de ligne » : une
 * interface contenant un objet imbrique dont l'accolade fermante tombe a gauche tromperait
 * la version naive, et le test se mettrait a mesurer autre chose sans rien signaler. Un
 * garde-fou qui se trompe de cible est pire qu'aucun garde-fou.
 */
function corpsInterface(nom) {
  const debut = CONTRAT.indexOf(`export interface ${nom} {`);
  if (debut < 0) throw new Error(`interface ${nom} introuvable dans le contrat`);
  let profondeur = 0;
  for (let i = CONTRAT.indexOf('{', debut); i < CONTRAT.length; i += 1) {
    if (CONTRAT[i] === '{') profondeur += 1;
    else if (CONTRAT[i] === '}') {
      profondeur -= 1;
      if (profondeur === 0) return CONTRAT.slice(debut, i);
    }
  }
  throw new Error(`fin de l'interface ${nom} introuvable`);
}

function champsDeLInterface(nom) {
  const champs = [];
  let profondeur = 0;
  for (const ligne of corpsInterface(nom).split('\n').slice(1)) {
    const nu = ligne.trim();
    if (!nu || nu.startsWith('*') || nu.startsWith('/*') || nu.startsWith('//')) continue;

    // Un champ de premier niveau seulement : on ignore l'interieur des objets imbriques.
    if (profondeur === 0) {
      const m = nu.match(/^'?([A-Za-z_][\w]*)'?\s*\??\s*:/);
      if (m) champs.push(m[1]);
    }
    profondeur += (nu.match(/\{/g) ?? []).length - (nu.match(/\}/g) ?? []).length;
  }
  return champs.sort();
}

/** Un inventaire de controleur factice, avec les noms de champs REELS releves au journal. */
function bootstrapFactice() {
  return {
    nvr: {
      name: 'Console-Essai',
      version: '7.1.87',
      availableVersion: null,
      ucoreVersion: '5.1.26',
      storageStats: { capacity: 5_940_000_000_000, used: 5_850_000_000_000 },
      estimatedHqRetentionDays: 29,
      estimatedLqRetentionDays: 162,
      totalHqBytesPerDay: 120_000_000_000,
      totalLqBytesPerDay: 9_000_000_000,
      // Forme REELLE relevee sur le poste le 31.07.2026 : un objet, pas une chaine.
      armMode: {
        status: 'disabled',
        armProfileId: 'p1',
        armedAt: null,
        breachEventCount: 0,
      },
      upSince: 1_750_000_000_000,
      hardDriveState: 'ok',
      isRecordingDisabled: false,
    },
    cameras: [
      { id: 'a', isAdopted: true, channels: [{ height: 2160 }, { height: 720 }] },
      { id: 'b', isAdopted: true, channels: [{ height: 1512 }] },
      { id: 'c', isAdopted: false, channels: [{ height: 1080 }] },   // pas a nous
    ],
  };
}

console.log('\n=== Le pont : aucun canal orphelin ===');
{
  /*
   * Le defaut que ceci empeche n'est pas theorique — c'est la meme famille que les six
   * champs perdus du 30.07.2026, une frontiere que rien ne verifiait. Ici : un canal
   * renomme d'un cote et pas de l'autre. Le compilateur ne voit rien, les types sont
   * justes des DEUX cotes, et le bouton ne fait simplement plus rien. Silencieux, et
   * decouvert par l'utilisateur.
   *
   * `envoyerPage()` est le passe-plat du processus principal vers la page : les envois
   * passent par lui, pas par `.send()` directement. Le chercher lui, et non `.send`, evite
   * de fabriquer des alertes fausses — ma premiere version en a produit quatre.
   */
  const traites = uniq([...MAIN.matchAll(/ipcMain\.handle\(\s*'([^']+)'/g)].map((m) => m[1]));
  // `.invoke` sans exiger `ipcRenderer` colle devant : le preload enchaine parfois sur la
  // ligne suivante, et ma premiere version avait declare mort un canal bien vivant.
  const invoques = uniq([...PRELOAD.matchAll(/\.invoke\(\s*'([^']+)'/g)].map((m) => m[1]));
  const emis = uniq([...MAIN.matchAll(/envoyerPage\(\s*'([^']+)'/g)].map((m) => m[1]));
  const ecoutes = uniq([...PRELOAD.matchAll(/ipcRenderer\.on\(\s*'([^']+)'/g)].map((m) => m[1]));

  checkBool('le pont a bien été lu', traites.length > 20 && invoques.length > 20);
  check('invoqués sans traitant (bouton mort)', [], absents(invoques, traites));
  check('traitants jamais invoqués (code mort)', [], absents(traites, invoques));
  check('émis sans écouteur (message perdu)', [], absents(emis, ecoutes));
  check('écoutés sans émetteur (jamais rien)', [], absents(ecoutes, emis));
}

console.log('\n=== Le pont : le contrat et le preload s’accordent ===');
{
  /*
   * Chaque methode que la page CROIT pouvoir appeler doit exister dans le preload. Une
   * absence ici ne se voit qu'a l'execution, sous la forme d'un « n'est pas une fonction ».
   */
  const declarees = uniq(
    [...corpsInterface('ProtectBridge').matchAll(/^ {2}([a-zA-Z][\w]*)\s*[(<]/gm)].map((m) => m[1]));
  const exposees = uniq(
    [...PRELOAD.matchAll(/^ {2}([a-zA-Z][\w]*)\s*:/gm)].map((m) => m[1]));

  checkBool('le contrat a bien été lu', declarees.length > 20);
  check('déclarées mais absentes du preload', [], absents(declarees, exposees));
  check('exposées mais hors contrat', [], absents(exposees, declarees));
}

console.log('\n=== Les deux côtés déclarent les MÊMES champs ===');
{
  /*
   * Le controle qui aurait suffi. Il compare les cles produites a celles declarees ;
   * l'egalite est exigee dans les deux sens.
   */
  const attendus = champsDeLInterface('SystemeEtat');
  const produits = Object.keys(
    etatPourInterface(etatSysteme(bootstrapFactice()), [], '9.9.9')).sort();

  check('champs du contrat = champs produits', attendus, produits);

  const manquants = attendus.filter((c) => !produits.includes(c));
  const enTrop = produits.filter((c) => !attendus.includes(c));
  check('aucun champ oublié par le processus principal', [], manquants);
  check('aucun champ envoyé pour rien', [], enTrop);
}

console.log('\n=== Le diagnostic ne part PAS vers la page ===');
{
  const etat = etatSysteme(bootstrapFactice());
  checkBool('« clesNvr » existe côté principal', Array.isArray(etat.clesNvr));
  checkBool('« brut » aussi', typeof etat.brut === 'object');
  const pont = etatPourInterface(etat, [], '9.9.9');
  checkBool('mais « clesNvr » ne franchit pas le pont', !('clesNvr' in pont));
  checkBool('ni « brut »', !('brut' in pont));
}

console.log('\n=== L’armement se lit sous ses DEUX formes ===');
{
  /*
   * Protect rend un objet sur ce controleur. Rien ne dit qu'il en va de meme partout, et la
   * lecture ne doit se casser sur aucune des deux formes — ni sur une troisieme.
   */
  const lire = (v) => etatSysteme({ nvr: { armMode: v }, cameras: [] }).armement;
  check('objet', 'disabled', lire({ status: 'disabled' }));
  check('chaîne', 'disarmed', lire('disarmed'));
  check('objet sans status', null, lire({ armProfileId: 'p1' }));
  check('nul', null, lire(null));
  check('absent', null, lire(undefined));
  check('nombre : refusé plutôt qu’inventé', null, lire(3));
}

console.log('\n=== L’aperçu d’un champ non lu dit sa FORME ===');
{
  /*
   * Le poste rendait « armement=absent » alors que `armMode` figurait bien parmi les champs
   * du controleur. Nul, vide, ou d'une forme inattendue : trois causes, trois corrections.
   * L'apercu doit les distinguer, et ne jamais deverser un inventaire entier au journal.
   */
  const forme = (v) => etatSysteme({ nvr: { armMode: v }, cameras: [] }).brut.armMode;
  check('absent', 'absent', forme(undefined));
  check('nul', 'null', forme(null));
  check('chaîne vide', '""', forme(''));
  check('objet', '{"mode":"disarmed"}', forme({ mode: 'disarmed' }));
  check('booléen', 'false', forme(false));
  checkBool('une valeur énorme est bornée', forme('x'.repeat(5000)).length < 260);
}

console.log('\n=== Les champs relevés au journal du poste sont bien lus ===');
{
  const e = etatPourInterface(etatSysteme(bootstrapFactice()), [], '9.9.9');
  check('nom', 'Console-Essai', e.nom);
  check('UniFi OS', '5.1.26', e.versionOs);
  check('armement de Protect, lu dans l’objet', 'disabled', e.armement);
  check('rétention haute', 29, e.retentionHaute);
  check('rétention basse', 162, e.retentionBasse);
  check('écrit par jour, haute', 120_000_000_000, e.parJourHaute);
  check('allumé depuis', 1_750_000_000_000, e.depuis);
  check('état du disque', 'ok', e.etatDisque);
  check('enregistrement suspendu', false, e.enregistrementSuspendu);
  check('disque', { total: 5_940_000_000_000, utilise: 5_850_000_000_000 }, e.disque);
  // La camera non adoptee ne compte pas : elle appartient a une autre console.
  check('définitions', { hd: 0, '2k': 1, '4k': 1 }, e.parDefinition);
}

console.log('\n=== Un contrôleur avare ne fabrique aucun chiffre ===');
{
  const e = etatPourInterface(etatSysteme({ nvr: {}, cameras: [] }), [], '9.9.9');
  check('aucun disque inventé', null, e.disque);
  check('aucune rétention inventée', null, e.retentionBasse);
  check('aucun armement inventé', null, e.armement);
  check('aucun UniFi OS inventé', null, e.versionOs);
  check('enregistrement suspendu par défaut faux', false, e.enregistrementSuspendu);
  check('définitions à zéro, pas nulles', { hd: 0, '2k': 0, '4k': 0 }, e.parDefinition);
}

console.log('\n=== Rien du tout ne fait pas tomber le pont ===');
{
  const e = etatPourInterface(null, [], '9.9.9');
  check('version d’Alcora conservée', '9.9.9', e.alcora);
  check('caméras à zéro', { total: 0, enLigne: 0 }, e.cameras);
  check('archive vide', [], e.archive);
}

console.log('\n=== Le compte des caméras vient des caméras, pas du contrôleur ===');
{
  const cams = [
    { online: true, archive: { debut: 1, frontiere: null, fin: 2 } },
    { online: false, archive: null },
    { online: true, archive: { debut: 3, frontiere: null, fin: 4 } },
  ];
  const e = etatPourInterface(etatSysteme(bootstrapFactice()), cams, '9.9.9');
  check('total', 3, e.cameras.total);
  check('en ligne', 2, e.cameras.enLigne);
  check('archives, sans les nulles', 2, e.archive.length);
}

console.log('\n=== L’alias RTSP ne quitte JAMAIS le processus principal ===');
{
  /*
   * L'alias est un mot de passe : le RTSP de Protect n'a aucune authentification, et
   * l'alias est le seul secret qui protege le flux. Jusqu'a la 2.27.0 l'inventaire
   * partait vers la page TEL QUEL, alias compris, alors que l'interface n'en a aucun
   * usage — le contrat `DiscoveredChannel` ne le declare meme pas.
   *
   * Ce test regarde la CHAINE ENTIERE serialisee plutot que les champs un a un : c'est
   * la seule facon de voir un alias qui reapparaitrait dans un champ ajoute plus tard,
   * ou imbrique quelque part.
   */
  const secret = 'aLiAsQuiNeDoitPasSortir42';
  const camerasBrutes = [{
    id: 'cam-1',
    name: 'Allee',
    online: true,
    channels: [
      { quality: 'high', width: 3840, height: 2160, fps: 30, bitrate: 16000000,
        rtspAlias: secret, streamable: true },
      { quality: 'low', width: 640, height: 360, fps: 30, bitrate: 300000,
        rtspAlias: null, streamable: false },
    ],
  }];

  const projete = camerasPourInterface(camerasBrutes);
  checkBool('l’alias est absent de tout ce qui traverse',
    !JSON.stringify(projete).includes(secret));
  checkBool('« streamable » survit, lui', projete[0].channels[0].streamable === true);
  checkBool('et reste faux quand il doit l’etre', projete[0].channels[1].streamable === false);
  check('les champs du canal, ni plus ni moins',
    ['bitrate', 'fps', 'height', 'quality', 'streamable', 'width'],
    Object.keys(projete[0].channels[0]).sort());
  check('le reste de la camera passe intact', 'Allee', projete[0].name);
}

console.log('\n=== Le dictionnaire du principal : memes cles dans TOUTES les langues ===');
{
  const { LANGUES, FR } = require('./i18n');
  const cfr = uniq(Object.keys(FR));
  checkBool(`au moins soixante cles (${cfr.length})`, cfr.length >= 60);
  checkBool(`au moins quatre langues (${Object.keys(LANGUES).length})`,
    Object.keys(LANGUES).length >= 4);
  for (const [code, { table }] of Object.entries(LANGUES)) {
    if (table === FR) continue;
    const cles = uniq(Object.keys(table));
    check(`cles absentes de ${code.toUpperCase()}`, [], absents(cfr, cles));
    check(`cles en trop dans ${code.toUpperCase()}`, [], absents(cles, cfr));
  }
}

console.log('\n=== L’historique des versions parle les deux langues, note pour note ===');
{
  /*
   * Lecture textuelle, comme le reste du fichier. Chaque entree de versions.ts doit
   * porter `fr:` ET `en:`, avec LE MEME NOMBRE de notes : une note ajoutee en francais
   * sans sa traduction — l'oubli le plus probable a chaque publication — rougit ici.
   * Une note (une chaine du tableau) se termine par `',` en fin de ligne ; ses lignes
   * de continuation se terminent par `' +` et ne comptent pas.
   */
  const VERSIONS_TS = lire('..', 'web', 'src', 'versions.ts');
  const entrees = VERSIONS_TS.split(/\n\s*version: '/).slice(1);
  checkBool('au moins dix entrées lues (le découpage fonctionne)', entrees.length >= 10);
  const notes = (bloc, langue) => {
    const m = new RegExp(`\\n\\s+${langue}: \\[([^\\]]*)\\]`).exec(bloc);
    if (!m) return -1;
    return (m[1].match(/',\s*$/gm) ?? []).length;
  };
  for (const bloc of entrees) {
    const numero = bloc.slice(0, bloc.indexOf("'"));
    const nfr = notes(bloc, 'fr');
    const nen = notes(bloc, 'en');
    checkBool(`${numero} : fr présent (${nfr} note${nfr > 1 ? 's' : ''})`, nfr > 0);
    checkBool(`${numero} : en présent et au complet (${nen}/${nfr})`, nen === nfr && nen > 0);
  }
}

console.log(echecs === 0 ? '\nTOUS LES TESTS PASSENT\n' : `\n${echecs} ÉCHEC(S)\n`);
process.exit(echecs === 0 ? 0 : 1);
