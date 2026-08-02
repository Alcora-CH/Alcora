'use strict';

/**
 * V-Export — la mesure qui precede le Lot 6 (relecture d'un extrait).
 *
 *   node test-export.js
 *
 * C'est la verification la plus lourde de consequences du plan : elle decide si l'on peut
 * cliquer une detection pour voir ce qui s'est passe, et COMMENT. Six questions :
 *
 *   1. Le compte applicatif dedie peut-il appeler /video/export ? (un 403 condamne le lot)
 *   2. Le controleur annonce-t-il la TAILLE (Content-Length) ? Sans elle, aucune barre de
 *      progression honnete n'est possible — seulement un balayage.
 *   3. Accepte-t-il « Range » ? Sans lui, pas de reprise apres coupure, et pas de lecture
 *      qui commence avant la fin du telechargement.
 *   4. Ou se trouve l'atome « moov » ? En tete (faststart), la lecture peut commencer tout
 *      de suite ; en queue, il faut le fichier entier avant la premiere image.
 *   5. Combien de temps avant le PREMIER octet, et a quel debit ? Un extrait d'une heure
 *      produit plus lentement que le temps reel serait inutilisable.
 *   6. Que rend une plage VIDE ? Il faut une erreur typee, pas un 500 opaque.
 *
 * Les identifiants sont saisis a l'execution et ne sont jamais ecrits sur disque. Un seul
 * petit extrait est enregistre, dans le dossier temporaire, pour que tu puisses verifier
 * de tes yeux qu'il s'ouvre et se lit.
 */

const fs = require('node:fs');
const https = require('node:https');
const os = require('node:os');
const path = require('node:path');
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

const mo = (o) => (o / 1_048_576).toFixed(1);

/**
 * Requete brute, en FLUX : on ne met jamais l'extrait entier en memoire, et on veut
 * mesurer le delai du premier octet, ce qu'une lecture tamponnee effacerait.
 */
function flux(client, chemin, { entetes = {}, maxOctets = Infinity, maxMs = 120_000 } = {}) {
  return new Promise((resolve, reject) => {
    const debut = Date.now();
    const req = https.request({
      host: client.host, port: 443, path: chemin, method: 'GET', agent: client.agent,
      headers: {
        'User-Agent': 'Alcora/2.2',
        ...(client.session.cookieHeader ? { Cookie: client.session.cookieHeader } : {}),
        ...(client.session.csrf ? { 'X-CSRF-Token': client.session.csrf } : {}),
        ...entetes,
      },
    }, (res) => {
      let recu = 0;
      let premierOctetA = null;
      const debuts = [];          // les premiers morceaux, pour y chercher les atomes

      const fini = (raison) => {
        res.destroy();
        resolve({
          statut: res.statusCode, entetes: res.headers, recu, raison,
          msPremierOctet: premierOctetA === null ? null : premierOctetA - debut,
          msTotal: Date.now() - debut,
          tete: Buffer.concat(debuts).subarray(0, 65_536),
        });
      };

      const couperet = setTimeout(() => fini('délai'), maxMs);
      res.on('data', (m) => {
        if (premierOctetA === null) premierOctetA = Date.now();
        recu += m.length;
        if (Buffer.concat(debuts).length < 65_536) debuts.push(m);
        if (recu >= maxOctets) { clearTimeout(couperet); fini('assez'); }
      });
      res.on('end', () => { clearTimeout(couperet); fini('fin'); });
      res.on('error', (e) => { clearTimeout(couperet); reject(e); });
    });
    req.on('error', reject);
    req.end();
  });
}

/**
 * Parcourt les atomes de premier niveau d'un MP4 et rend leur ordre.
 *
 * Un atome est [4 octets de taille][4 octets de type]. Si « moov » precede « mdat », le
 * fichier est en « faststart » : la lecture peut commencer avant la fin du telechargement.
 */
function atomes(buf) {
  const vus = [];
  let p = 0;
  while (p + 8 <= buf.length && vus.length < 12) {
    let taille = buf.readUInt32BE(p);
    const type = buf.subarray(p + 4, p + 8).toString('latin1');
    if (!/^[a-zA-Z0-9 ]{4}$/.test(type)) break;
    vus.push(type);
    if (taille === 1) break;             // taille 64 bits : on ne va pas plus loin ici
    if (taille === 0) { vus.push('(jusqu’à la fin)'); break; }
    p += taille;
  }
  return vus;
}

(async () => {
  console.log('=== V-Export : production d’un extrait vidéo ===\n');

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
  try { await client.login(); ok('session ouverte'); }
  catch (e) { ko('session', e instanceof ProtectError ? e.userMessage : String(e)); process.exit(1); }

  const b = await client.getBootstrap();
  const cams = (b.cameras ?? []).filter((c) => c.isConnected !== false);
  if (!cams.length) { ko('aucune camera exploitable'); process.exit(1); }
  const cam = cams[0];
  ok('camera choisie', cam.name);

  // On vise une plage RECENTE mais close : la derniere minute peut ne pas etre encore
  // ecrite sur le disque du controleur.
  const fin = Date.now() - 120_000;
  const url = (debut, finPlage) =>
    `/proxy/protect/api/video/export?camera=${encodeURIComponent(cam.id)}`
    + `&start=${Math.round(debut)}&end=${Math.round(finPlage)}`;

  /* ------------------------------------------------- 1. l acces, sur dix secondes */
  console.log('\n--- Question 1 : le compte peut-il exporter ? ---');
  let court;
  try {
    court = await flux(client, url(fin - 10_000, fin), { maxMs: 90_000 });
  } catch (e) { ko('export', String(e.message ?? e)); process.exit(1); }

  if (court.statut === 403) {
    ko('export refuse (403)', 'donner au compte un role permettant l’export vidéo');
    console.log('\nLe Lot 6 repose entierement sur cet acces : rien ne sert de poursuivre.');
    process.exit(1);
  }
  if (court.statut !== 200) {
    ko(`export : HTTP ${court.statut}`, court.tete.subarray(0, 200).toString('utf8'));
    process.exit(1);
  }
  ok('export autorise', `${mo(court.recu)} Mo reçus en ${(court.msTotal / 1000).toFixed(1)} s`);
  info('type', String(court.entetes['content-type'] ?? 'non annoncé'));

  /* ------------------------------------------------------- 2. la taille annoncee */
  console.log('\n--- Question 2 : la taille est-elle annoncée ? ---');
  const taille = court.entetes['content-length'];
  if (taille) ok('Content-Length présent', `${mo(Number(taille))} Mo — barre de progression honnête possible`);
  else info('Content-Length ABSENT',
            `transfert ${court.entetes['transfer-encoding'] ?? 'sans taille'} — la barre devra balayer`);

  /* ----------------------------------------------------------- 3. les plages */
  console.log('\n--- Question 3 : « Range » est-il accepté ? ---');
  try {
    const r = await flux(client, url(fin - 10_000, fin),
                         { entetes: { Range: 'bytes=0-1023' }, maxMs: 60_000 });
    if (r.statut === 206) ok('Range accepté (206)', `${r.recu} octets — reprise et lecture anticipée possibles`);
    else if (r.statut === 200) info('Range IGNORÉ (200)', 'ni reprise après coupure, ni lecture avant la fin');
    else ko(`Range : HTTP ${r.statut}`);
    info('Accept-Ranges', String(r.entetes['accept-ranges'] ?? 'non annoncé'));
  } catch (e) { ko('Range', String(e.message ?? e)); }

  /* --------------------------------------------------------- 4. l ordre des atomes */
  console.log('\n--- Question 4 : où est l’atome « moov » ? ---');
  const ordre = atomes(court.tete);
  if (ordre.length) {
    info('atomes en tête', ordre.join(' → '));
    const iMoov = ordre.indexOf('moov');
    const iMdat = ordre.indexOf('mdat');
    if (iMoov !== -1 && (iMdat === -1 || iMoov < iMdat)) {
      ok('faststart', 'la lecture peut commencer avant la fin du téléchargement');
    } else if (iMdat !== -1) {
      info('« moov » N’EST PAS en tête',
           'le fichier entier sera nécessaire avant la première image');
    }
  } else {
    info('en-tête illisible', 'ce n’est peut-être pas du MP4');
  }

  /* ------------------------------------- 5. delai du premier octet, et debit reel */
  console.log('\n--- Question 5 : combien de temps avant la première image, et à quel débit ? ---');
  info('court (10 s de vidéo)', `premier octet à ${court.msPremierOctet} ms`);
  try {
    const DUREE = 300_000;   // cinq minutes de video demandees
    console.log('  (production de cinq minutes de vidéo, patience…)');
    const long = await flux(client, url(fin - DUREE, fin), { maxMs: 120_000 });
    if (long.statut !== 200) { ko(`plage longue : HTTP ${long.statut}`); }
    else {
      const debit = long.recu / (long.msTotal / 1000);
      ok('plage longue', `${mo(long.recu)} Mo en ${(long.msTotal / 1000).toFixed(1)} s`);
      info('premier octet', `${long.msPremierOctet} ms`);
      info('débit', `${mo(debit)} Mo/s`);
      if (long.raison === 'délai') {
        info('interrompu par la sonde après 120 s', 'l’extrait n’était pas terminé');
      }
      // Le rapport qui decide de tout : produire plus lentement que le temps reel rendrait
      // un extrait d'une heure inexploitable.
      const rapport = DUREE / long.msTotal;
      info('vitesse de production', `${rapport.toFixed(1)}× le temps réel`
        + (rapport < 1 ? '  — PLUS LENT que le direct, les longs extraits seront pénibles' : ''));
    }
  } catch (e) { ko('plage longue', String(e.message ?? e)); }

  /* ------------------------------------------------------------- 6. la plage vide */
  console.log('\n--- Question 6 : que rend une plage sans enregistrement ? ---');
  try {
    const vieux = Date.now() - 400 * 86_400_000;   // plus d’un an en arriere
    const r = await flux(client, url(vieux, vieux + 10_000), { maxMs: 30_000 });
    info(`HTTP ${r.statut}`, r.tete.subarray(0, 200).toString('utf8').replace(/\s+/g, ' ').trim()
      || `${r.recu} octets`);
    if (r.statut >= 400) ok('erreur distincte', 'un message clair pourra être affiché');
    else if (r.recu === 0) info('200 mais vide', 'il faudra détecter le vide nous-mêmes');
  } catch (e) { info('plage vide', String(e.message ?? e)); }

  /* ------------------------------------------- un extrait a ouvrir, pour de vrai */
  console.log('\n--- Un extrait à ouvrir toi-même ---');
  try {
    const cible = path.join(os.tmpdir(), `alcora-extrait-${Date.now()}.mp4`);
    const r = await flux(client, url(fin - 15_000, fin), { maxMs: 90_000 });
    if (r.statut === 200 && r.recu > 0) {
      // La sonde ne garde que le debut en memoire : on redemande en ecrivant sur disque.
      await new Promise((resolve, reject) => {
        const sortie = fs.createWriteStream(cible);
        https.request({
          host: client.host, port: 443, path: url(fin - 15_000, fin), method: 'GET',
          agent: client.agent,
          headers: {
            'User-Agent': 'Alcora/2.2',
            ...(client.session.cookieHeader ? { Cookie: client.session.cookieHeader } : {}),
            ...(client.session.csrf ? { 'X-CSRF-Token': client.session.csrf } : {}),
          },
        }, (res) => { res.pipe(sortie); sortie.on('finish', resolve); res.on('error', reject); })
          .on('error', reject).end();
      });
      ok('extrait enregistré', cible);
      info('à faire', 'ouvre-le : s’il se lit, la chaîne complète est prouvée');
    } else {
      info('pas d’extrait à enregistrer', `HTTP ${r.statut}`);
    }
  } catch (e) { ko('enregistrement', String(e.message ?? e)); }

  console.log('\n=== Fin. Colle ce compte rendu dans la conversation. ===');
  process.exit(0);
})().catch((e) => { console.error('\nInterrompu :', e); process.exit(1); });
