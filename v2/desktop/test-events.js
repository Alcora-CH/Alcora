'use strict';

/**
 * V-Events — la mesure qui precede le Lot 4 (journal des detections).
 *
 *   node test-events.js
 *
 * Sept questions auxquelles le code ne peut pas repondre, et dont depend toute la
 * conception de l'ecran Detections :
 *
 *   1. Le compte applicatif dedie peut-il seulement LIRE /events ? (un role Protect trop
 *      etroit rendrait 403, et le lot entier tomberait)
 *   2. Dans quel ORDRE arrivent-ils — du plus recent au plus ancien, ou l'inverse ?
 *   3. « limit » et « start/end » sont-ils honores, ou ignores en silence ?
 *   4. Quel VOLUME par jour ? Cent evenements se listent ; cinquante mille se paginent.
 *   5. Quels TYPES existent reellement sur ce materiel ?
 *   6. Un evenement EN COURS apparait-il, et avec quelle marque (« end » nul) ?
 *   7. Les vignettes sont-elles servies, et le sont-elles pendant l'evenement ?
 *
 * Les identifiants sont saisis a l'execution et ne sont jamais ecrits sur disque. Aucun
 * code a deux facteurs n'est affiche. Le compte rendu ne montre ni alias RTSP, ni jeton.
 */

const readline = require('node:readline');
const { ProtectClient } = require('./protect/client');
const { normalizeSecret } = require('./protect/totp');
const { ProtectError } = require('./protect/errors');

function ok(l, d = '') { console.log(`  OK      ${l}${d ? '  — ' + d : ''}`); }
function ko(l, d = '') { console.log(`  ECHEC   ${l}${d ? '  — ' + d : ''}`); }
function info(l, d = '') { console.log(`  ·       ${l}${d ? '  — ' + d : ''}`); }

function ask(question, { hidden = false, fallback = '' } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      const onData = (char) => {
        if (['\n', '\r', ''].includes(char.toString())) process.stdin.removeListener('data', onData);
        else {
          readline.moveCursor(process.stdout, -1, 0);
          process.stdout.write('*');
        }
      };
      process.stdin.on('data', onData);
    }
    rl.question(fallback ? `${question} [${fallback}] : ` : `${question} : `, (a) => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(a.trim() || fallback);
    });
  });
}

const quand = (ms) => (ms ? new Date(ms).toLocaleString('fr-CH') : '—');

(async () => {
  console.log('=== V-Events : lecture du journal des detections ===\n');

  const host = await ask('Adresse du controleur', { fallback: process.env.PV_HOST });
  const username = await ask('Compte applicatif (e-mail)');
  const password = await ask('Mot de passe', { hidden: true });
  const totpSeed = await ask('Cle a deux facteurs (vide si aucune)', { hidden: true });
  console.log('');

  if (totpSeed) {
    const n = normalizeSecret(totpSeed);
    if (!n.ok) { ko('cle a deux facteurs', n.error); process.exit(1); }
  }

  const client = new ProtectClient({ host, pins: [], onFirstUse: () => {} });
  client.setCredentials({ username, password, totpSeed: totpSeed || undefined });

  try {
    await client.login();
    ok('session ouverte');
  } catch (e) {
    ko('session', e instanceof ProtectError ? e.userMessage : String(e));
    process.exit(1);
  }

  /* ------------------------------------------------------- 1. acces et inventaire */
  let cameras = new Map();
  try {
    const b = await client.getBootstrap();
    cameras = new Map((b.cameras ?? []).map((c) => [c.id, c.name]));
    ok('inventaire lu', `${cameras.size} camera(s)`);
  } catch (e) {
    ko('inventaire', String(e.message ?? e));
  }

  const JOUR = 86_400_000;
  const maintenant = Date.now();

  async function evenements(params, etiquette) {
    const q = new URLSearchParams(params).toString();
    try {
      const r = await client.getJson(`/proxy/protect/api/events?${q}`);
      if (!Array.isArray(r)) { ko(etiquette, 'la reponse n est pas une liste'); return null; }
      return r;
    } catch (e) {
      const m = e instanceof ProtectError ? `${e.userMessage} ${e.technical ?? ''}` : String(e.message ?? e);
      ko(etiquette, m.trim());
      return null;
    }
  }

  /* ------------------------------------------------------------ 2. lecture de base */
  console.log('\n--- Question 1 : le compte peut-il lire /events ? ---');
  const base = await evenements(
    { start: maintenant - JOUR, end: maintenant, limit: 200 }, 'lecture de /events');
  if (!base) {
    console.log('\nRien ne sert de poursuivre : le Lot 4 repose entierement sur cet acces.');
    console.log('Si la cause est un 403, donner au compte un role Protect permettant la');
    console.log('lecture des cameras ET de l historique, puis relancer.');
    process.exit(1);
  }
  ok('lecture autorisee', `${base.length} evenement(s) sur 24 h`);

  if (base.length === 0) {
    info('aucun evenement sur 24 h', 'refaire la mesure apres avoir declenche une detection');
  }

  /* ------------------------------------------------------------------- 3. ordre */
  console.log('\n--- Question 2 : dans quel ordre ? ---');
  if (base.length >= 2) {
    const debuts = base.map((e) => e.start ?? 0);
    const decroissant = debuts.every((v, i) => i === 0 || debuts[i - 1] >= v);
    const croissant = debuts.every((v, i) => i === 0 || debuts[i - 1] <= v);
    if (decroissant) ok('du plus RECENT au plus ancien', 'la liste s affiche telle quelle');
    else if (croissant) ok('du plus ANCIEN au plus recent', 'il faudra inverser a l affichage');
    else ko('ordre non monotone', 'il faudra trier nous-memes');
    info('premier', quand(base[0].start));
    info('dernier', quand(base[base.length - 1].start));
  } else {
    info('pas assez d evenements pour conclure');
  }

  /* -------------------------------------------------------- 4. bornes et pagination */
  console.log('\n--- Question 3 : « limit » et les bornes sont-ils honores ? ---');
  const petit = await evenements(
    { start: maintenant - JOUR, end: maintenant, limit: 3 }, 'limit=3');
  if (petit) {
    if (petit.length <= 3) ok('« limit » honore', `${petit.length} rendu(s)`);
    else ko('« limit » IGNORE', `${petit.length} rendus pour 3 demandes — pagination a revoir`);
  }

  const fenetre = await evenements(
    { start: maintenant - 3 * JOUR, end: maintenant - 2 * JOUR, limit: 500 }, 'fenetre J-3 → J-2');
  if (fenetre) {
    const dehors = fenetre.filter(
      (e) => e.start < maintenant - 3 * JOUR - 60_000 || e.start > maintenant - 2 * JOUR + 60_000);
    if (dehors.length === 0) ok('bornes respectees', `${fenetre.length} evenement(s) dans la fenetre`);
    else ko('bornes IGNOREES', `${dehors.length} evenement(s) hors plage`);
  }

  /* ------------------------------------------------------------------ 5. volume */
  console.log('\n--- Question 4 : quel volume ? ---');
  for (const jours of [1, 7]) {
    const l = await evenements(
      { start: maintenant - jours * JOUR, end: maintenant, limit: 5000 }, `volume ${jours} j`);
    if (l) {
      const parJour = (l.length / jours).toFixed(0);
      ok(`${jours} jour(s)`, `${l.length} evenement(s), soit ~${parJour}/jour`);
      if (l.length >= 5000) info('plafond atteint', 'la pagination sera indispensable');
    }
  }

  /* ------------------------------------------------------------------- 6. types */
  console.log('\n--- Question 5 : quels types existent ici ? ---');
  const semaine = await evenements(
    { start: maintenant - 7 * JOUR, end: maintenant, limit: 5000 }, 'types sur 7 j');
  if (semaine && semaine.length) {
    const parType = new Map();
    for (const e of semaine) parType.set(e.type, (parType.get(e.type) ?? 0) + 1);
    for (const [t, n] of [...parType].sort((a, b) => b[1] - a[1])) {
      info(t, `${n} evenement(s)`);
    }
    const parCamera = new Map();
    for (const e of semaine) {
      if (e.camera) parCamera.set(e.camera, (parCamera.get(e.camera) ?? 0) + 1);
    }
    console.log('');
    for (const [id, n] of parCamera) info(cameras.get(id) ?? id, `${n} evenement(s)`);

    // Les detections intelligentes portent leurs sujets a part : c'est ce qui permettra
    // de filtrer « personne » ou « vehicule » plutot que « mouvement ».
    const sujets = new Set();
    for (const e of semaine) for (const s of e.smartDetectTypes ?? []) sujets.add(s);
    if (sujets.size) ok('sujets de detection intelligente', [...sujets].join(', '));
    else info('aucun sujet intelligent', 'seulement du mouvement, semble-t-il');
  }

  /* --------------------------------------------------------- 7. evenement en cours */
  console.log('\n--- Question 6 : un evenement EN COURS est-il visible ? ---');
  const recents = await evenements(
    { start: maintenant - 3600_000, end: maintenant + 60_000, limit: 200 }, 'derniere heure');
  if (recents) {
    const enCours = recents.filter((e) => e.end === null || e.end === undefined);
    if (enCours.length) {
      ok('evenement en cours visible', `${enCours.length}, « end » est nul`);
    } else {
      info('aucun evenement en cours a cet instant',
           'refaire en passant devant une camera pour trancher');
    }
    const champs = recents.length ? Object.keys(recents[0]).sort().join(', ') : '';
    if (champs) info('champs disponibles', champs);
  }

  /* ------------------------------------------------------------------ 8. vignettes */
  console.log('\n--- Question 7 : les vignettes sont-elles servies ? ---');
  const avecVignette = (semaine ?? []).find((e) => e.thumbnail);
  if (avecVignette) {
    try {
      const r = await client.authed('GET', `/proxy/protect/api/events/${avecVignette.id}/thumbnail`);
      const type = r.headers?.['content-type'] ?? '';
      if (String(type).startsWith('image/')) ok('vignette servie', type);
      else ko('vignette', `type inattendu : ${type || 'inconnu'}`);
    } catch (e) {
      ko('vignette', String(e.message ?? e));
    }
  } else {
    info('aucun evenement ne porte de vignette', 'a reverifier apres une vraie detection');
  }

  console.log('\n=== Fin. Colle ce compte rendu dans la conversation. ===');
  process.exit(0);
})().catch((e) => { console.error('\nInterrompu :', e); process.exit(1); });
