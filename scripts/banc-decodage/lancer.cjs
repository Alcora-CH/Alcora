'use strict';

/**
 * Le banc du decodage video : ce que Chromium fait d'un flux quand son GPU tombe.
 *
 *   node scripts/banc-decodage/lancer.cjs gpu        perte du GPU, puis rechargement de la page
 *   node scripts/banc-decodage/lancer.cjs abattage   le chemin de l'application : perte du GPU,
 *                                                    5 s, page abattue, page rechargee
 *   node scripts/banc-decodage/lancer.cjs retour     flux garde sans video, puis rattache
 *   node scripts/banc-decodage/lancer.cjs tuile      la vraie interface (lancer `npm run web`
 *                                                    d'abord) : navigation, isolement, masquage,
 *                                                    perte du GPU
 *
 * Exige ffmpeg dans le PATH (libx264, libx265), Windows et un GPU qui decode H.265. Aucune
 * camera : deux mires. Le resultat s'ecrit dans le dossier temporaire, chemin affiche a la fin.
 *
 * Hors de `npm test` : il faut un vrai GPU, et il dure jusqu'a deux minutes. A REJOUER A CHAQUE
 * MONTEE D'ELECTRON : ce qu'il tient est un comportement de Chromium, que rien d'autre ne garde
 * (constat du 05.11.2026 dans docs/contraintes-verifiees.md).
 */

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ici = __dirname;
const racine = path.resolve(ici, '..', '..');
const scenario = process.argv[2] || 'gpu';
const tuile = scenario === 'tuile';

const sortie = path.join(os.tmpdir(), 'alcora-banc-decodage');
fs.mkdirSync(sortie, { recursive: true });

const BINAIRE = path.join(racine, 'v2', 'relay', 'mediamtx.exe');
const ELECTRON = path.join(racine, 'v2', 'desktop', 'node_modules', 'electron', 'dist', 'electron.exe');
for (const f of [BINAIRE, ELECTRON]) {
  if (!fs.existsSync(f)) { console.error(`introuvable : ${f}`); process.exit(2); }
}

const enfants = [];
const lance = (exe, args, journal) => {
  const p = spawn(exe, args, { stdio: ['ignore', journal, journal], windowsHide: true });
  enfants.push(p);
  return p;
};
const finir = (code) => {
  for (const p of enfants) { try { p.kill(); } catch { /* deja mort */ } }
  console.log(`resultat : ${path.join(sortie, 'resultat.txt')}`);
  process.exit(code);
};

lance(BINAIRE, [path.join(ici, tuile ? 'relais-tuile.yml' : 'relais.yml')], fs.openSync(path.join(sortie, 'relais.log'), 'w'));

/* Une image cle toutes les 5 s pour la tuile, comme les vraies cameras ; 2 s ailleurs. */
const CLE = tuile ? 125 : 50;
const mire = ['-hide_banner', '-loglevel', 'error', '-re', '-f', 'lavfi',
  '-i', 'testsrc2=size=1280x720:rate=25', '-an', '-pix_fmt', 'yuv420p', '-b:v', '4M'];
setTimeout(() => {
  const journal = fs.openSync(path.join(sortie, 'ffmpeg.log'), 'w');
  lance('ffmpeg', [...mire, '-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency',
    '-profile:v', 'baseline', '-g', String(CLE), '-f', 'rtsp', '-rtsp_transport', 'tcp',
    'rtsp://127.0.0.1:28554/mire264'], journal);
  lance('ffmpeg', [...mire, '-c:v', 'libx265', '-preset', 'ultrafast', '-tune', 'zerolatency',
    '-x265-params', `keyint=${CLE}:min-keyint=${CLE}:bframes=0:repeat-headers=1:log-level=error`,
    '-f', 'rtsp', '-rtsp_transport', 'tcp', 'rtsp://127.0.0.1:28554/mire265'], journal);
}, 1500);

setTimeout(() => {
  const env = { ...process.env, BANC_SORTIE: sortie };
  delete env.ELECTRON_RUN_AS_NODE;
  const e = spawn(ELECTRON, [path.join(ici, tuile ? 'tuile' : 'flux'), scenario], { stdio: 'ignore', env });
  e.on('exit', (c) => finir(c ?? 0));
}, 5000);

setTimeout(() => finir(9), 300_000);
