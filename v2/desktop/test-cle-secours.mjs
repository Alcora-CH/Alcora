/**
 * Le script de la cle de secours (scripts/cle-secours.mjs), joue de bout en bout.
 *
 *   node test-cle-secours.mjs
 *
 * Ajoute le 24.10.2026 : le premier vrai lancement est tombe APRES le rangement de la note
 * dans Proton Pass, sur une ligne que rien n'avait jamais executee (la cle publique ecrite
 * a la fin). Les fonctions etaient testees, le script non. Ici, une copie du script tourne
 * dans un dossier jetable, avec un faux presse-papiers et un faux Proton Pass : chaque
 * scenario y rejoue les gestes d'une personne, y compris ceux qui ont echoue ce soir-la.
 * Rien ne touche le vrai presse-papiers ni signature/.
 */

import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ici = path.dirname(fileURLToPath(import.meta.url));
const SCRIPTS = path.resolve(ici, '..', '..', 'scripts');
const s = await import(pathToFileURL(path.join(SCRIPTS, 'secours.mjs')).href);

let echecs = 0;
function check(label, condition, detail = '') {
  if (!condition) echecs++;
  console.log(`${condition ? '  OK  ' : ' ECHEC'}  ${label}${detail && !condition ? ` — ${detail}` : ''}`);
}

/*
 * Le faux module de saisie. Chaque « Entree » attendue joue le geste suivant du scenario :
 *   ranger       coller le presse-papiers dans la note (sous un titre), enregistrer
 *   copier-note  copier tout le contenu de la note (titre compris)
 *   copier-titre copier le seul titre (l'erreur du 24.10.2026)
 *   rien         ne rien faire
 *   R            taper R (remettre la cle dans le presse-papiers)
 * Les phrases de passe tapees sont prises dans l'ordre.
 */
const FAUSSE_SAISIE = `
import fs from 'node:fs';
const scenario = JSON.parse(process.env.ALCORA_SCENARIO);
const fichierNote = process.env.ALCORA_NOTE;
let pressePapiers = '';
const note = () => (fs.existsSync(fichierNote) ? fs.readFileSync(fichierNote, 'utf8') : '');
export async function demanderCache() {
  if (!scenario.phrases.length) throw new Error('scenario : plus de phrase de passe');
  return scenario.phrases.shift();
}
export async function attendreEntree() {
  const geste = scenario.gestes.shift();
  if (geste === undefined) throw new Error('scenario : plus de geste');
  if (geste === 'ranger') fs.writeFileSync(fichierNote, 'Alcora — clé de secours\\n\\n' + pressePapiers + '\\n');
  if (geste === 'copier-note') pressePapiers = note();
  if (geste === 'copier-titre') pressePapiers = 'alcora-secours-1 - Clé de secours d’Alcora';
  return geste === 'R' ? 'R' : '';
}
export function copier(texte) { pressePapiers = texte; }
export const lirePressePapiers = () => pressePapiers.trim();
export function viderPressePapiers() { pressePapiers = ''; }
`;

const PHRASE = 'phrase fictive des essais';

/** Joue un scenario dans un dossier jetable ; rend la sortie, le code, la note et la cle publique ecrites. */
function jouer({ phrases, gestes, args = [], noteDeDepart = null, pemDeDepart = null }) {
  const atelier = fs.mkdtempSync(path.join(os.tmpdir(), 'alcora-cle-secours-'));
  try {
    fs.mkdirSync(path.join(atelier, 'scripts'));
    fs.mkdirSync(path.join(atelier, 'signature'));
    for (const f of ['cle-secours.mjs', 'secours.mjs']) fs.copyFileSync(path.join(SCRIPTS, f), path.join(atelier, 'scripts', f));
    fs.writeFileSync(path.join(atelier, 'scripts', 'saisie.mjs'), FAUSSE_SAISIE);
    const fichierNote = path.join(atelier, 'note-proton-pass.txt');
    if (noteDeDepart) fs.writeFileSync(fichierNote, noteDeDepart);
    const pem = path.join(atelier, 'signature', 'cle-secours-publique.pem');
    if (pemDeDepart) fs.writeFileSync(pem, pemDeDepart);
    const r = spawnSync(process.execPath, [path.join(atelier, 'scripts', 'cle-secours.mjs'), ...args], {
      env: { ...process.env, ALCORA_SCENARIO: JSON.stringify({ phrases, gestes }), ALCORA_NOTE: fichierNote },
      encoding: 'utf8', timeout: 120_000,
    });
    return {
      code: r.status,
      sortie: `${r.stdout}${r.stderr}`,
      note: fs.existsSync(fichierNote) ? fs.readFileSync(fichierNote, 'utf8') : null,
      pem: fs.existsSync(pem) ? fs.readFileSync(pem, 'utf8') : null,
    };
  } finally {
    fs.rmSync(atelier, { recursive: true, force: true });
  }
}

/** La cle publique ecrite est-elle celle de la note rangee, dechiffree avec la phrase ? */
function concorde({ note, pem }, phrase = PHRASE) {
  if (!note || !pem) return false;
  try {
    return s.pemPublique(s.dechiffrerCleDeSecours(s.extraireNote(note), phrase)) === pem;
  } catch {
    return false;
  }
}
const resume = (r) => `code ${r.code} — ${r.sortie.trim().split('\n').slice(-3).join(' / ')}`;

console.log('=== Creation ===');
{
  const r = jouer({ phrases: [PHRASE, PHRASE, PHRASE], gestes: ['ranger', 'copier-note'] });
  check('les gestes attendus : la cle publique est ecrite, le script finit a 0', r.code === 0 && r.pem !== null, resume(r));
  check('… et c est celle de la note rangee', concorde(r));
  check('… annoncee avec son empreinte', /Empreinte\s+: [0-9A-F]{4}( [0-9A-F]{4}){15}/.test(r.sortie), resume(r));
}
{
  // Le 24.10.2026 : Entree sans rien coller, puis le titre copie au lieu de la cle.
  const r = jouer({ phrases: [PHRASE, PHRASE, PHRASE], gestes: ['rien', 'copier-titre', 'R', 'ranger', 'copier-note'] });
  check('note oubliee puis titre copie : le diagnostic le dit, R remet la cle, la suite aboutit',
    r.code === 0 && concorde(r) && /pas dans ce qui a été copié/.test(r.sortie), resume(r));
}
{
  const r = jouer({ phrases: [PHRASE, PHRASE, 'autre phrase fictive', PHRASE], gestes: ['ranger', 'copier-note', 'copier-note'] });
  check('phrase fausse a la relecture : refusee, puis acceptee au tour suivant',
    r.code === 0 && concorde(r) && /phrase de passe fausse/.test(r.sortie), resume(r));
}
{
  const r = jouer({ phrases: [PHRASE, PHRASE], gestes: ['rien', ...Array.from({ length: 5 }, () => ['rien', '']).flat()] });
  check('note jamais rangee : rien n est ecrit, le script finit en erreur', r.code === 1 && r.pem === null, resume(r));
}
{
  const r = jouer({ phrases: ['courte', 'courte2', 'courte3'], gestes: [] });
  check('trois phrases trop courtes : rien n est cree', r.code === 1 && r.pem === null && r.note === null, resume(r));
}
{
  const r = jouer({ phrases: [PHRASE, 'une autre phrase fictive', PHRASE, PHRASE, PHRASE], gestes: ['ranger', 'copier-note'] });
  check('confirmation differente : redemandee, puis tout aboutit', r.code === 0 && concorde(r), resume(r));
}
{
  const ancienne = crypto.generateKeyPairSync('ed25519').publicKey.export({ type: 'spki', format: 'pem' });
  const r = jouer({ phrases: [PHRASE, PHRASE, PHRASE], gestes: ['ranger', 'copier-note'], pemDeDepart: ancienne });
  check('une cle de secours existe deja : refus, rien n est remplace', r.code === 1 && r.pem === ancienne && r.note === null, resume(r));
}

console.log('\n=== Reprise (--reprendre) ===');
const rangee = `Alcora — clé de secours\n\n${s.chiffrerCleDeSecours(crypto.generateKeyPairSync('ed25519').privateKey, PHRASE)}\n`;
{
  const r = jouer({ args: ['--reprendre'], phrases: [PHRASE], gestes: ['copier-note'], noteDeDepart: rangee });
  check('la note rangee relue : sa cle publique est ecrite', r.code === 0 && concorde({ note: rangee, pem: r.pem }), resume(r));
  check('… sans rien creer : la note est intacte', r.note === rangee);
}
{
  const r = jouer({ args: ['--reprendre'], phrases: [PHRASE], gestes: ['copier-titre', 'copier-note'], noteDeDepart: rangee });
  check('le titre copie d abord : refuse, puis la note', r.code === 0 && concorde({ note: rangee, pem: r.pem })
    && /pas dans ce qui a été copié/.test(r.sortie), resume(r));
}
{
  const r = jouer({ args: ['--reprendre'], phrases: ['fausse phrase fictive', 'fausse encore', 'fausse toujours'],
    gestes: ['copier-note', 'copier-note', 'copier-note'], noteDeDepart: rangee });
  check('phrase toujours fausse : rien n est ecrit', r.code === 1 && r.pem === null, resume(r));
}

console.log('\n' + (echecs === 0 ? 'TOUS LES TESTS PASSENT' : `${echecs} TEST(S) EN ECHEC`));
process.exit(echecs === 0 ? 0 : 1);
