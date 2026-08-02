'use strict';

/**
 * Verification de bout en bout du client authentifie, contre le vrai controleur.
 *   node test-client.js
 *
 * Les identifiants sont saisis a l'execution et ne sont jamais ecrits sur disque.
 * Le compte rendu masque les alias RTSP, qui sont les seuls secrets protegeant les flux.
 * Conformement au choix retenu, AUCUN code a deux facteurs n'est affiche.
 */

const readline = require('node:readline');
const { ProtectClient } = require('./protect/client');
const { fromBootstrap, relayPaths } = require('./protect/discovery');
const { normalizeSecret } = require('./protect/totp');
const { ProtectError } = require('./protect/errors');

let failures = 0;

function ok(label, detail = '') { console.log(`  OK     ${label}${detail ? '  — ' + detail : ''}`); }
function ko(label, detail = '') { failures++; console.log(`  ECHEC  ${label}${detail ? '  — ' + detail : ''}`); }

function ask(question, { hidden = false, fallback = '' } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      const onData = (char) => {
        if (['\n', '\r', ''].includes(char.toString())) process.stdin.removeListener('data', onData);
        else {
          readline.moveCursor(process.stdout, -1, 0);
          process.stdout.write('*');
        }
      };
      process.stdin.on('data', onData);
    }
    rl.question(fallback ? `${question} [${fallback}] : ` : `${question} : `, (answer) => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer.trim() || fallback);
    });
  });
}

(async () => {
  console.log('=== Verification du client authentifie (2.0) ===\n');

  const host = await ask('Adresse du controleur', { fallback: process.env.PV_HOST });
  const username = await ask('Compte applicatif (e-mail)');
  const password = await ask('Mot de passe', { hidden: true });
  const totpSeed = await ask('Cle a deux facteurs (vide si aucune)', { hidden: true });

  console.log('');

  if (totpSeed) {
    const norm = normalizeSecret(totpSeed);
    if (!norm.ok) { ko('cle a deux facteurs', norm.error); process.exit(1); }
    ok('cle a deux facteurs valide', `${norm.value.length} caracteres`);
  }

  let discoveredPin = null;
  const client = new ProtectClient({
    host,
    pins: [],                       // premier appairage : on releve ce qu'on voit
    onFirstUse: (pin) => { discoveredPin = pin; },
  });
  client.setCredentials({ username, password, totpSeed: totpSeed || undefined });

  /* ---- 1. connexion ---- */
  try {
    await client.login();
    const jours = (client.session.expiresAt - Date.now()) / 86_400_000;
    ok('connexion acceptee', `session valable ${jours.toFixed(0)} jours`);
    ok('jeton anti-CSRF', client.session.csrf ? 'present' : 'ABSENT');
  } catch (e) {
    if (e instanceof ProtectError) {
      ko('connexion', e.userMessage);
      if (e.remedy) console.log(`         ${e.remedy}`);
      if (e.technical) console.log(`         detail : ${String(e.technical).slice(0, 160)}`);
    } else {
      ko('connexion', e.message);
    }
    process.exit(1);
  }

  if (discoveredPin) ok('empreinte de cle publique relevee', discoveredPin.slice(0, 16) + '…');
  if (Number.isFinite(client.clockOffsetSeconds)) {
    const d = Math.abs(client.clockOffsetSeconds);
    (d < 5 ? ok : ko)('horloge alignee sur le controleur', `ecart ${d.toFixed(1)} s`);
  }

  /* ---- 2. inventaire ---- */
  let inv;
  try {
    inv = fromBootstrap(await client.getBootstrap());
    ok('inventaire recupere', `${inv.nvrName} — Protect ${inv.protectVersion}`);
    ok('port RTSP lu du controleur', String(inv.rtspPort));
  } catch (e) {
    ko('inventaire', e instanceof ProtectError ? e.userMessage : e.message);
    process.exit(1);
  }

  /* ---- 3. correspondance des modeles ---- */
  console.log('\n=== Cameras decouvertes ===');
  let diffusables = 0;
  for (const cam of inv.cameras) {
    console.log(`  ${cam.name}   [${cam.model}]   ${cam.online ? 'en ligne' : 'HORS LIGNE'}`);
    for (const ch of cam.channels) {
      if (ch.rtspAlias) diffusables++;
      console.log(
        `      ${ch.quality.padEnd(7)} ${String(ch.width).padStart(5)}x${String(ch.height).padEnd(5)}` +
        ` ${String(ch.fps).padStart(3)} i/s  debit ${String(ch.bitrate).padStart(9)}` +
        `  rtsp=${ch.rtspAlias ? 'oui (alias masque)' : 'non'}`,
      );
    }
  }
  for (const w of inv.warnings) console.log(`  ATTENTION  ${w}`);

  /* ---- 4. chemins pour le relais ---- */
  const paths = relayPaths(inv.cameras, { host, rtspPort: inv.rtspPort });
  console.log(`\n  ${paths.length} chemin(s) a publier par le relais :`);
  for (const p of paths.slice(0, 6)) console.log(`      ${p.path}  <-  rtsp://${host}:${inv.rtspPort}/<alias>`);

  /* ---- 5. reutilisation de session ---- */
  console.log('\n=== Reutilisation de la session ===');
  const generationAvant = client.generation;
  try {
    await client.getBootstrap();
    ok('seconde requete acceptee');
    (client.generation === generationAvant ? ok : ko)(
      'aucune reconnexion inutile', `generation ${client.generation}`);
  } catch (e) {
    ko('seconde requete', e.message);
  }

  console.log('');
  const verdict = failures === 0 && inv.cameras.length > 0 && diffusables > 0;
  console.log(verdict
    ? `CHAINE COMPLETE VALIDEE — ${inv.cameras.length} camera(s), ${diffusables} canal/canaux diffusables`
    : 'VERIFICATION INCOMPLETE : voir les lignes ci-dessus');

  process.exit(verdict ? 0 : 1);
})();
