/**
 * Produit la version Linux.
 *
 *   npm run build:linux        depuis la racine du depot
 *
 * Pourquoi un script separe de « build.mjs » plutot qu'un drapeau : les deux chaines n'ont
 * presque rien en commun passe l'empaquetage d'Electron. Windows sort un installeur
 * Velopack signe, qui porte la mise a jour automatique ; Linux sort une archive et une
 * AppImage, sans chaine de mise a jour — Velopack publie ici des .nupkg et confie
 * l'application a Update.exe, deux choses qui n'existent pas ailleurs. Le processus
 * principal le sait (voir « AUTO_DEMARRAGE_POSSIBLE » et la creation du gestionnaire de
 * mise a jour dans main.js) et l'ecran des reglages l'annonce.
 *
 * Les DROITS D'EXECUTION sont le piege de cette chaine : construite depuis Windows, elle
 * ecrit sur du NTFS, qui n'a pas de bit « executable ». Une archive faite ici livrerait un
 * lanceur que Linux refuserait de demarrer. L'archive est donc fabriquee DANS WSL, apres
 * un passage explicite de chmod — et le script verifie le mode relu dans l'archive
 * produite, plutot que de supposer qu'il a ete pose.
 */

import { spawnSync } from 'node:child_process';
import {
  chmodSync, cpSync, existsSync, mkdirSync, readdirSync, rmSync, readFileSync, statSync,
  writeFileSync,
} from 'node:fs';
import { construireNotices } from './notices.mjs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const web = path.join(racine, 'v2', 'web');
const desktop = path.join(racine, 'v2', 'desktop');
const relay = path.join(racine, 'v2', 'relay');
const sortie = path.join(racine, 'v2', 'dist-linux');
const releases = path.join(racine, 'v2', 'releases');

const manifeste = JSON.parse(readFileSync(path.join(desktop, 'package.json'), 'utf8'));
const PACK_ID = manifeste.packId;
const version = manifeste.version;
const ARCH = 'x64';

function etape(titre) { console.log(`\n=== ${titre} ===`); }

function exigerFichier(chemin, quoi) {
  if (!existsSync(chemin)) {
    console.error(`\nManquant après construction : ${quoi}\n  ${chemin}`);
    process.exit(1);
  }
}

/** Lance une commande DANS WSL et rend sa sortie. Sortie non nulle = on s'arrete. */
function dansWsl(script, { tolerant = false } = {}) {
  const res = spawnSync('wsl.exe', ['-d', 'Ubuntu', '-e', 'bash', '-lc', script],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  // WSL rend de l'UTF-16 sur certaines configurations : on nettoie les octets nuls.
  const texte = `${res.stdout ?? ''}${res.stderr ?? ''}`.replace(/\0/g, '');
  if (res.status !== 0 && !tolerant) {
    console.error(`\nÉchec dans WSL :\n${texte}`);
    process.exit(1);
  }
  return { ok: res.status === 0, texte };
}

/* ---- 0. WSL est-il la ? ---- */
etape('Atelier Linux');
{
  const { ok, texte } = dansWsl('echo pret', { tolerant: true });
  if (!ok) {
    console.error('\nWSL (Ubuntu) est nécessaire pour poser les droits d\'exécution.');
    console.error('  Installer avec : wsl --install -d Ubuntu');
    process.exit(1);
  }
  console.log(`  WSL répond : ${texte.trim()}`);
}

/* ---- 1. interface ---- */
etape('Contrôle des types et des règles');
{
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const passe = (args, cwd, quoi) => {
    const r = spawnSync(npx, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
    if (r.status !== 0) {
      console.error(`\n  ${quoi} en défaut : rien n'a été construit.`);
      process.exit(1);
    }
  };
  passe(['tsc', '-b', '--force'], web, 'Les types de l\'interface');
  passe(['oxlint', 'src', '--deny-warnings'], web, 'Les règles de l\'interface');
  passe(['oxlint', 'v2/desktop', 'scripts', '--deny-warnings'], racine, 'Les règles du processus principal');
  console.log('  types conformes, règles respectées');
}

/* Le guide voyage aussi dans la version Linux — meme source unique, meme raison :
   l'application ne depend d'aucun acces a Internet. Voir scripts/build.mjs. */
etape('Guide embarqué');
{
  const source = path.join(racine, 'site', 'guide-rtsp.html');
  exigerFichier(source, 'le guide d\'activation du RTSP (site/guide-rtsp.html)');
  cpSync(source, path.join(web, 'public', 'guide-rtsp.html'));
  console.log(`  guide embarqué (${(statSync(source).size / 1024).toFixed(0)} Ko)`);
}

etape('Construction de l\'interface');
const requireWeb = createRequire(path.join(web, 'package.json'));
const vite = await import(pathToFileURL(requireWeb.resolve('vite')).href);
await vite.build({ root: web, logLevel: 'warn' });
exigerFichier(path.join(web, 'dist', 'index.html'), 'la page de l\'interface');

const ui = path.join(desktop, 'ui');
rmSync(ui, { recursive: true, force: true });
cpSync(path.join(web, 'dist'), ui, { recursive: true });
console.log(`  interface copiée dans ${path.relative(racine, ui)}`);

/* ---- 2. le relais, version Linux ---- */
etape('Relais vidéo');
const binaireLinux = path.join(relay, `mediamtx-linux-${ARCH}`);
if (!existsSync(binaireLinux)) {
  console.error(`\nBinaire du relais Linux absent :\n  ${binaireLinux}`);
  console.error('  Le télécharger depuis les versions de mediamtx (même version que celle');
  console.error('  de Windows), le renommer ainsi, puis relancer.');
  process.exit(1);
}
// Le nom livre est « mediamtx », sans suffixe : c'est ce que cherche main.js hors Windows.
const scene = path.join(sortie, '_ressources', 'relay');
rmSync(sortie, { recursive: true, force: true });
mkdirSync(scene, { recursive: true });
cpSync(binaireLinux, path.join(scene, 'mediamtx'));
console.log(`  mediamtx (${(statSync(binaireLinux).size / 1024 / 1024).toFixed(1)} Mo) prêt à être livré`);

/* ---- 3. empaquetage ---- */
etape('Empaquetage de l\'application');
const requireDesktop = createRequire(path.join(desktop, 'package.json'));
const { packager } = requireDesktop('@electron/packager');

const chemins = await packager({
  dir: desktop,
  name: PACK_ID,
  platform: 'linux',
  arch: ARCH,
  out: sortie,
  overwrite: true,
  appVersion: version,
  extraResource: [scene],
  ignore: [/^\/test-/, /^\/node_modules/, /^\/dev.*\.log$/, /^\/ui\/\.vite/],
  quiet: false,
});

const empaquetee = chemins[0];
exigerFichier(path.join(empaquetee, PACK_ID), 'l\'exécutable');
exigerFichier(path.join(empaquetee, 'resources', 'relay', 'mediamtx'), 'le relais vidéo');

// Meme garde-fou que sous Windows : rien d'autre que le binaire ne doit partir. Une
// regression ici redistribuerait la cle privee du relais et les alias des cameras.
const livres = readdirSync(path.join(empaquetee, 'resources', 'relay'));
if (livres.length !== 1 || livres[0] !== 'mediamtx') {
  console.error(`\nLe dossier du relais livré contient autre chose que le binaire :\n  ${livres.join(', ')}`);
  process.exit(1);
}

/* ---- 3 bis. de quoi apparaitre dans un menu ---- */
const icone = path.join(racine, 'docs', 'marque-alcor-512.png');
exigerFichier(icone, 'l\'icône 512 px (node scripts/icone.mjs)');
cpSync(icone, path.join(empaquetee, 'alcora.png'));

// Le raccourci de bureau, au format freedesktop. « Exec » est reecrit a l'installation par
// le script d'accompagnement : le chemin depend de l'endroit ou l'archive est deployee.
writeFileSync(path.join(empaquetee, 'alcora.desktop'), [
  '[Desktop Entry]',
  'Type=Application',
  `Name=${PACK_ID}`,
  'Comment=Local client for UniFi Protect',
  'Exec=AppRun',
  'Icon=alcora',
  'Categories=AudioVideo;Video;Utility;',
  'Terminal=false',
  '',
].join('\n'), 'utf8');

/* ---- 3 ter. notices de licence ---- */
etape('Licences des composants de tiers');
{
  const { texte, manquants } = construireNotices(web);
  if (manquants.length) {
    console.error(`\nLicence introuvable pour : ${manquants.join(', ')}`);
    process.exit(1);
  }
  writeFileSync(path.join(empaquetee, 'NOTICES-TIERS.txt'), texte, 'utf8');
  console.log(`  ${(texte.length / 1024).toFixed(0)} Ko écrits dans NOTICES-TIERS.txt`);
}

/* ---- 4. archive, fabriquee dans WSL pour les droits ---- */
etape('Archive');
mkdirSync(releases, { recursive: true });
const nomDossier = `${PACK_ID}-${version}-linux-${ARCH}`;
const archive = `${nomDossier}.tar.gz`;

// Les chemins Windows vus depuis WSL. On passe par le systeme de fichiers NATIF de WSL :
// sur /mnt/c, chmod ne tient pas sans l'option de montage « metadata », qui n'est pas
// garantie. Copier coute quelques secondes et rend le resultat certain.
const versWsl = (p) => `/mnt/${p[0].toLowerCase()}${p.slice(2).replace(/\\/g, '/')}`;
const source = versWsl(empaquetee);
const cibleReleases = versWsl(releases);

// Les binaires qui DOIVENT etre executables : le lanceur, le relais, et les aides
// d'Electron. « chrome-sandbox » veut en plus le bit setuid, sinon Chromium refuse de
// demarrer sans --no-sandbox.
const { texte: sortieWsl } = dansWsl([
  'set -e',
  'atelier=$(mktemp -d)',
  `cp -r "${source}" "$atelier/${nomDossier}"`,
  `cd "$atelier/${nomDossier}"`,
  `chmod 755 "${PACK_ID}"`,
  'chmod 755 resources/relay/mediamtx',
  'for f in chrome_crashpad_handler libEGL.so libGLESv2.so libffmpeg.so libvk_swiftshader.so libvulkan.so.1; do',
  '  [ -e "$f" ] && chmod 755 "$f" || true',
  'done',
  '[ -e chrome-sandbox ] && chmod 4755 chrome-sandbox || true',
  'cd "$atelier"',
  `tar czf "${cibleReleases}/${archive}" "${nomDossier}"`,
  // On RELIT l'archive : le bit d'execution du lanceur est la seule chose qui separe une
  // livraison utilisable d'un fichier que Linux refuse d'ouvrir.
  `tar tvzf "${cibleReleases}/${archive}" | grep -E "${nomDossier}/(${PACK_ID}|resources/relay/mediamtx)$"`,
  'rm -rf "$atelier"',
].join('\n'));

console.log(sortieWsl.trim().split('\n').map((l) => `  ${l}`).join('\n'));

const cheminArchive = path.join(releases, archive);
exigerFichier(cheminArchive, 'l\'archive Linux');

// Le controle qui compte : le lanceur doit etre marque executable DANS l'archive.
if (!/rwxr-xr-x.*\/(Alcora|mediamtx)$/m.test(sortieWsl)) {
  console.error('\nL\'archive ne porte pas les droits d\'exécution attendus.');
  process.exit(1);
}
console.log('  droits d\'exécution vérifiés dans l\'archive');

const taille = (p) => (statSync(p).size / 1024 / 1024).toFixed(1);
console.log(`\nArchive prête : ${path.relative(racine, cheminArchive)}  (${taille(cheminArchive)} Mo)`);
console.log('\nÀ l\'usage :  tar xzf ' + archive + ' && ./' + nomDossier + '/' + PACK_ID);
console.log('Pas de mise à jour automatique sur cette plateforme — l\'application le dit.');

// Le mode de l'icone n'a pas d'importance, mais son absence en aurait : sans elle, le
// raccourci de bureau pointe dans le vide.
chmodSync(path.join(empaquetee, 'alcora.png'), 0o644);
