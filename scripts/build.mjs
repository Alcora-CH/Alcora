/**
 * Produit l'installeur.
 *
 *   npm run build        depuis la racine du depot
 *
 * Enchaine : interface -> application empaquetee -> installeur Velopack.
 * Chaque etape verifie son resultat avant de passer a la suivante : un installeur produit
 * a partir d'une etape ratee est bien pire qu'une erreur franche.
 */

import { spawnSync } from 'node:child_process';
import {
  cpSync, existsSync, mkdirSync, readdirSync, rmSync, readFileSync, statSync, writeFileSync,
} from 'node:fs';
import { construireNotices } from './notices.mjs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const web = path.join(racine, 'v2', 'web');
const desktop = path.join(racine, 'v2', 'desktop');
const relay = path.join(racine, 'v2', 'relay');
const sortie = path.join(racine, 'v2', 'dist');
const releases = path.join(racine, 'v2', 'releases');

/*
 * Identite du produit — un seul endroit.
 *
 * Ce nom se retrouve dans l'identifiant du paquet, le nom de l'executable, le titre de
 * l'installeur et celui des artefacts publies. L'eparpiller en litteraux, c'est se
 * condamner a en oublier un le jour ou il change : c'est exactement ce qui est arrive au
 * passage de ProtectViewer a Alcora, le 28.07.2026.
 *
 * PACK_ID est aussi le canal de mise a jour. En changer ROMPT le lien avec les
 * installations existantes, qui ne verront plus jamais de nouvelle version : elles doivent
 * etre reinstallees a la main. A ne toucher qu'en connaissance de cause.
 */
const manifeste = JSON.parse(readFileSync(path.join(desktop, 'package.json'), 'utf8'));
const PACK_ID = manifeste.packId;
const EXE = `${PACK_ID}.exe`;
const ICONE = path.join(racine, 'v2', 'desktop', 'assets', 'alcor.ico');

const version = manifeste.version;

function etape(titre) { console.log(`\n=== ${titre} ===`); }

// Pas de shell : il decoupe les chemins sur les espaces, ce que « Program Files » et
// « Windows Kits » garantissent. Les executables sont donc toujours designes en absolu.
/**
 * @param {object} [o]
 * @param {boolean} [o.tolerant]  rend false au lieu d'arreter la construction
 * @param {number}  [o.essais]    tentatives avant d'abandonner
 */
function lancer(commande, args, cwd, { tolerant = false, essais = 1 } = {}) {
  for (let n = 1; n <= essais; n += 1) {
    const res = spawnSync(commande, args, { cwd, stdio: 'inherit' });
    if (res.status === 0) return true;
    if (n < essais) {
      console.log(`\n  échec — nouvelle tentative (${n + 1} sur ${essais})`);
      // Une pause : ce qui echoue ici est presque toujours passager, et reessayer
      // dans la milliseconde retomberait sur la meme indisponibilite.
      const fin = Date.now() + 4000;
      while (Date.now() < fin) { /* attente franche, sans dependance */ }
    }
  }
  if (tolerant) return false;
  console.error(`\nÉchec : ${commande} ${args.join(' ')}`);
  process.exit(1);
}

function exigerFichier(chemin, quoi) {
  if (!existsSync(chemin)) {
    console.error(`\nManquant après construction : ${quoi}\n  ${chemin}`);
    process.exit(1);
  }
}

/**
 * Reunit de quoi signer, ou rien si le certificat n'a pas ete cree sur ce poste.
 *
 * Une construction non signee reste possible et utilisable : elle declenche seulement les
 * avertissements de Windows. Mieux vaut cela qu'une chaine qui refuse de produire quoi que
 * ce soit sur une machine ou le certificat n'existe pas.
 */
function signature() {
  const empreinteFichier = path.join(racine, 'signature', 'empreinte.txt');
  if (!existsSync(empreinteFichier)) return null;

  const base = 'C:\\Program Files (x86)\\Windows Kits\\10\\bin';
  if (!existsSync(base)) return null;
  const outil = readdirSync(base)
    .filter((v) => v.startsWith('10.'))
    .sort()
    .reverse()
    .map((v) => path.join(base, v, 'x64', 'signtool.exe'))
    .find(existsSync);
  if (!outil) return null;

  return { outil, empreinte: readFileSync(empreinteFichier, 'utf8').trim() };
}

/**
 * Services d'horodatage, essayes dans l'ordre.
 *
 * L'horodatage atteste la date de la signature : sans lui, tout ce qui a ete signe
 * cesserait d'etre reconnu le jour ou le certificat expire.
 *
 * Il en faut PLUSIEURS : le 30.07.2026, celui de DigiCert etait injoignable et la 2.16.0
 * est partie sans horodatage — c'est-a-dire condamnee a cesser d'etre reconnue le jour ou
 * le certificat expire, alors qu'une signature horodatee reste valable indefiniment. Un
 * seul service est un point de defaillance unique pour quelque chose qu'on ne peut pas
 * rattraper apres coup.
 */
const HORODATEURS = [
  'http://timestamp.digicert.com',
  'http://timestamp.sectigo.com',
  'http://time.certum.pl',
  'http://timestamp.globalsign.com/tsa/r6advanced1',
];

/**
 * Celui qui a repondu.
 *
 * `vpk` signe lui-meme les executables qu'il ajoute, et il ne sait pas reessayer : on lui
 * passe donc le service qui vient de fonctionner, pas le premier de la liste.
 */
let horodateurVivant = HORODATEURS[0];

function argumentsSignature(sig, horodateur = HORODATEURS[0]) {
  return [
    'sign', '/sha1', sig.empreinte, '/fd', 'SHA256',
    ...(horodateur ? ['/tr', horodateur, '/td', 'SHA256'] : []),
  ];
}

/** Signe des fichiers, en essayant chaque horodateur avant de renoncer a l'horodatage. */
function signer(sig, fichiers, quoi) {
  if (!fichiers.length) return;
  for (const h of HORODATEURS) {
    if (lancer(sig.outil, [...argumentsSignature(sig, h), ...fichiers], racine, { tolerant: true })) {
      horodateurVivant = h;
      console.log(`  ${quoi} signé(s), horodatés par ${new URL(h).host}`);
      return;
    }
    console.log(`  ${new URL(h).host} injoignable`);
  }
  // Dernier recours, et il se DIT : la signature reste valable, mais elle a une date de
  // peremption — celle du certificat.
  horodateurVivant = null;
  lancer(sig.outil, [...argumentsSignature(sig, null), ...fichiers], racine);
  console.log(`  ⚠ ${quoi} signé(s) SANS horodatage — aucun service n'a répondu`);
}

/* ---- 1. interface ---- */
etape('Contrôle des types');
/*
 * Vite ne verifie PAS les types : il efface les annotations et empaquette. Sans cette
 * etape, une application dont les types sont faux se construisait, se signait, et partait
 * en ligne — c'est exactement ce qui est arrive, quatre erreurs ayant survecu a des
 * semaines de constructions reussies. Le controle passe donc AVANT, et il est bloquant.
 */
{
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const tsc = spawnSync(npx, ['tsc', '-b', '--force'], {
    cwd: web, stdio: 'inherit', shell: process.platform === 'win32',
  });
  if (tsc.status !== 0) {
    console.error('\n  Les types de l\'interface sont en défaut : rien n\'a été construit.');
    console.error('  Corriger les erreurs ci-dessus, puis relancer.');
    process.exit(1);
  }
  console.log('  types conformes');

  /*
   * Les regles que le compilateur ne voit pas — « react/rules-of-hooks » en tete.
   *
   * Un crochet pose sous une sortie anticipee compile parfaitement, passe les types, et
   * produit un ecran NOIR au lancement : React compte un nombre de crochets different d'un
   * rendu a l'autre et refuse de continuer. C'est parti en ligne en 2.10.0. La regle
   * existait ; rien ne la lancait. Elle est maintenant bloquante, comme les types.
   */
  const lint = spawnSync(npx, ['oxlint', 'src', '--deny-warnings'], {
    cwd: web, stdio: 'inherit', shell: process.platform === 'win32',
  });
  if (lint.status !== 0) {
    console.error('\n  Les règles de l\'interface sont en défaut : rien n\'a été construit.');
    process.exit(1);
  }

  /*
   * Et le PROCESSUS PRINCIPAL, qui n'etait analyse par rien jusqu'au 31.07.2026 — neuf
   * mille quatre cents lignes, dont la chaine de mise a jour. Bloquant comme le reste :
   * une regle qu'on n'applique pas a la moitie du code est une regle a moitie appliquee.
   */
  const lintPrincipal = spawnSync(npx, ['oxlint', 'v2/desktop', 'scripts', '--deny-warnings'], {
    cwd: racine, stdio: 'inherit', shell: process.platform === 'win32',
  });
  if (lintPrincipal.status !== 0) {
    console.error('\n  Les règles du processus principal sont en défaut : rien n\'a été construit.');
    process.exit(1);
  }
  console.log('  règles respectées');
}

etape('Construction de l\'interface');
// On appelle l'outil par sa bibliotheque, jamais par son lanceur « .cmd » : celui-ci
// exigerait un shell, qui redecouperait les chemins sur les espaces.
const requireWeb = createRequire(path.join(web, 'package.json'));
const vite = await import(pathToFileURL(requireWeb.resolve('vite')).href);
await vite.build({ root: web, logLevel: 'warn' });
exigerFichier(path.join(web, 'dist', 'index.html'), 'la page de l\'interface');

// L'interface est embarquee dans l'application : aucun serveur n'est necessaire a l'usage.
const ui = path.join(desktop, 'ui');
rmSync(ui, { recursive: true, force: true });
cpSync(path.join(web, 'dist'), ui, { recursive: true });
console.log(`  interface copiée dans ${path.relative(racine, ui)}`);

/* ---- 2. application ---- */
etape('Empaquetage de l\'application');
rmSync(sortie, { recursive: true, force: true });
mkdirSync(sortie, { recursive: true });

/*
 * On prepare un dossier ne contenant QUE le binaire du relais.
 *
 * Livrer directement « v2/relay » embarquerait tout ce que le relais y a ecrit en
 * developpement : sa cle privee, son journal, et surtout la configuration engendree, qui
 * contient l'adresse du controleur et les alias RTSP des cameras en clair. Ces alias sont
 * ce qui donne acces aux flux : ils n'ont rien a faire dans un installeur.
 *
 * Constate le 22.07.2026 dans un installeur reellement produit.
 */
const scene = path.join(sortie, '_ressources', 'relay');
mkdirSync(scene, { recursive: true });
const binaireRelais = path.join(relay, 'mediamtx.exe');
exigerFichier(binaireRelais, 'le binaire du relais');
cpSync(binaireRelais, path.join(scene, 'mediamtx.exe'));

// On appelle la bibliotheque directement plutot que son executable : passer par le shell
// coupe les chemins contenant des espaces, ce que « Program Files » garantit.
const requireDesktop = createRequire(path.join(desktop, 'package.json'));
const { packager } = requireDesktop('@electron/packager');

const chemins = await packager({
  dir: desktop,
  name: path.basename(EXE, '.exe'),
  platform: 'win32',
  arch: 'x64',
  out: sortie,
  overwrite: true,
  appVersion: version,
  icon: ICONE,
  // Le relais est livre en ressource externe : un binaire ne s'execute pas depuis
  // l'archive dans laquelle le code est enferme. On livre le SEUL binaire, depuis un
  // dossier prepare — voir la note sur « scene » plus haut.
  extraResource: [scene],
  ignore: [/^\/test-/, /^\/node_modules/, /^\/dev.*\.log$/, /^\/ui\/\.vite/],
  quiet: false,
});

const empaquetee = chemins[0];
exigerFichier(path.join(empaquetee, EXE), 'l\'exécutable');
exigerFichier(path.join(empaquetee, 'resources', 'relay', 'mediamtx.exe'), 'le relais vidéo');

// Garde-fou : rien d'autre que le binaire ne doit se retrouver livre. Une regression ici
// redistribuerait une cle privee et les alias des cameras a chaque utilisateur.
const livres = readdirSync(path.join(empaquetee, 'resources', 'relay'));
if (livres.length !== 1 || livres[0] !== 'mediamtx.exe') {
  console.error(`\nLe dossier du relais livré contient autre chose que le binaire :\n  ${livres.join(', ')}`);
  process.exit(1);
}

const taille = (p) => (statSync(p).size / 1024 / 1024).toFixed(1);
console.log(`  exécutable : ${taille(path.join(empaquetee, EXE))} Mo`);

/* ---- 2 bis. notices de licence ---- */
etape('Licences des composants de tiers');
const { texte: notices, manquants } = construireNotices(web);
if (manquants.length) {
  // Une notice absente n'est pas un detail : c'est une condition de licence non tenue.
  console.error(`\nLicence introuvable pour : ${manquants.join(', ')}`);
  console.error('  Relancer « npm install » dans v2/web, puis reconstruire.');
  process.exit(1);
}
writeFileSync(path.join(empaquetee, 'NOTICES-TIERS.txt'), notices, 'utf8');
console.log(`  ${(notices.length / 1024).toFixed(0)} Ko écrits dans NOTICES-TIERS.txt`);

/* ---- 2 ter. signature ---- */
const sig = signature();
if (!sig) {
  console.log('\n=== Signature ===');
  console.log('  aucun certificat sur ce poste — construction non signée');
  console.log('  (le créer une fois avec : powershell -File scripts\\certificat.ps1)');
} else {
  etape('Signature');
  // Les deux binaires qui sortent sur le reseau, donc les deux que les suites de securite
  // examinent. Le reste est du code de Chromium, deja connu d'elles.
  signer(sig, [
    path.join(empaquetee, EXE),
    path.join(empaquetee, 'resources', 'relay', 'mediamtx.exe'),
  ], 'application et relais');
}

/* ---- 3. installeur ---- */
etape('Construction de l\'installeur');
const vpk = path.join(process.env.USERPROFILE ?? '', '.dotnet', 'tools', 'vpk.exe');
if (!existsSync(vpk)) {
  console.error(`\nOutil d'empaquetage introuvable : ${vpk}\n  Installer avec : dotnet tool install -g vpk`);
  process.exit(1);
}

// L'outil refuse de reconstruire une version deja presente dans le dossier. Tant qu'une
// version n'est pas publiee, la reconstruire est normal : on retire ses artefacts. Une
// version deja diffusee doit au contraire etre incrementee, jamais remplacee.
const dejaPubliee = existsSync(path.join(releases, `${PACK_ID}-${version}-full.nupkg`));
if (dejaPubliee) {
  if (!process.argv.includes('--remplacer')) {
    console.error(
      `\nLa version ${version} existe déjà dans ${path.relative(racine, releases)}.\n` +
      `  Incrémenter la version dans v2/desktop/package.json,\n` +
      `  ou relancer avec --remplacer si elle n'a jamais été diffusée.`);
    process.exit(1);
  }
  for (const f of readdirSync(releases)) {
    if (f.includes(`-${version}-`)) rmSync(path.join(releases, f));
  }
  console.log(`  artefacts ${version} remplacés`);
}

/*
 * L'empaquetage, retente en CHANGEANT de service d'horodatage.
 *
 * L'outil signe lui-meme les executables qu'il ajoute — celui qui applique les mises a jour,
 * notamment, qui sans cela resterait le seul maillon non signe. Mais il les signe avec une
 * concurrence de dix, et un service d'horodatage gratuit refuse volontiers dix demandes
 * simultanees : le 30.07.2026, DigiCert a repondu a notre signature a nous, puis a rejete
 * celle de l'outil trois fois de suite. Reessayer sur le MEME service ne servait donc a
 * rien. On change d'interlocuteur a chaque tentative, ce qui traite la vraie cause.
 */
{
  const args = (horodateur) => [
    'pack',
    '--packId', PACK_ID,
    '--packVersion', version,
    '--packDir', empaquetee,
    '--mainExe', EXE,
    '--packTitle', PACK_ID,
    '--packAuthors', 'Thomas',
    '--icon', ICONE,
    '--outputDir', releases,
    ...(sig ? ['--signParams', argumentsSignature(sig, horodateur).slice(1).join(' ')] : []),
  ];

  // Sans signature, une seule tentative suffit : il n'y a plus de service distant en jeu.
  const tentatives = sig ? [horodateurVivant, ...HORODATEURS.filter((h) => h !== horodateurVivant)]
    : [null];

  let empaquete = false;
  for (const h of tentatives) {
    // La derniere tentative n'est plus tolerante : son echec doit arreter la construction.
    const dernier = h === tentatives[tentatives.length - 1];
    if (lancer(vpk, args(h), racine, { tolerant: !dernier })) { empaquete = true; break; }
    console.log(`\n  ${new URL(h).host} a refusé — nouvelle tentative sur un autre service`);
    // Les artefacts partiels d'une tentative ratee empecheraient la suivante d'ecrire.
    for (const f of readdirSync(releases)) {
      if (f.includes(`-${version}-`)) rmSync(path.join(releases, f));
    }
  }
  if (!empaquete) process.exit(1);
}

const installeur = path.join(releases, `${PACK_ID}-win-Setup.exe`);
exigerFichier(installeur, 'l\'installeur');

// L'installeur est produit apres la signature des fichiers qu'il contient : il porte
// donc lui-meme la sienne en dernier. C'est le fichier que l'utilisateur double-clique,
// et celui sur lequel Windows se prononce en premier.
if (sig) signer(sig, [installeur], 'installeur');

console.log(`\nInstalleur prêt : ${path.relative(racine, installeur)}  (${taille(installeur)} Mo)`);
if (!sig) console.log('ATTENTION : non signé — Windows affichera un avertissement.');
