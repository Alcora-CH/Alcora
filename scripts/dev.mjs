/**
 * Lance l'application en developpement : serveur d'interface puis coquille Electron.
 *
 *   npm run dev        depuis la racine du depot, quel que soit le dossier courant
 *
 * Attend que le serveur reponde avant de lancer Electron — sans quoi la fenetre
 * s'ouvrirait sur une page d'erreur. Arrete les deux ensemble.
 */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL_DEV = 'http://localhost:5180/';
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const enfants = [];

function lancer(nom, commande, args, options = {}) {
  const p = spawn(commande, args, { stdio: 'inherit', shell: process.platform === 'win32', ...options });
  p.on('error', (e) => console.error(`[${nom}] ${e.message}`));
  enfants.push(p);
  return p;
}

function arreterTout(code = 0) {
  for (const p of enfants) {
    if (!p.killed) p.kill();
  }
  process.exit(code);
}

process.on('SIGINT', () => arreterTout(0));
process.on('SIGTERM', () => arreterTout(0));

async function attendreServeur(url, delaiMax = 60_000) {
  const limite = Date.now() + delaiMax;
  while (Date.now() < limite) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(1500) });
      if (res.ok) return true;
    } catch {
      // pas encore pret
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

console.log('→ démarrage du serveur d\'interface…');
lancer('web', npm, ['--prefix', path.join(racine, 'v2', 'web'), 'run', 'dev']);

if (!(await attendreServeur(URL_DEV))) {
  console.error(`\nLe serveur d'interface n'a pas répondu sur ${URL_DEV}.`);
  arreterTout(1);
}

console.log(`→ interface prête sur ${URL_DEV}, lancement de l'application…\n`);

// On lance le binaire Electron DIRECTEMENT, sans passer par npm.
// La chaine « cmd → npm → node → electron » fait que la sortie d'un maillon intermediaire
// est prise pour la fermeture de l'application, ce qui arretait tout aussitot.
const dossierDesktop = path.join(racine, 'v2', 'desktop');
const require = createRequire(path.join(dossierDesktop, 'package.json'));
const binaireElectron = require('electron');

const electron = spawn(binaireElectron, ['.'], {
  cwd: dossierDesktop,
  stdio: 'inherit',
  env: { ...process.env, PROTECTVIEWER_DEV_URL: URL_DEV },
});
electron.on('error', (e) => console.error(`[electron] ${e.message}`));
enfants.push(electron);

// Fermer la fenetre arrete aussi le serveur : pas de processus fantome a nettoyer.
electron.on('exit', () => arreterTout(0));
