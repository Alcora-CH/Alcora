'use strict';

/**
 * V-Alertes — la mesure qui precede le Lot 8 (alertes en direct).
 *
 *   node test-alertes.js
 *
 * Une alerte n'a de valeur que si elle arrive VITE. Savoir dix minutes apres qu'on a sonne
 * a la porte, ce n'est plus une alerte, c'est un journal. Toute la conception du lot depend
 * donc de ce que ce programme va montrer :
 *
 *   1. Le controleur expose-t-il un canal TEMPS REEL, et le compte applicatif y a-t-il
 *      droit ? Protect publie ses changements sur une liaison permanente
 *      (`/proxy/protect/ws/updates`). Si elle est fermee a ce compte, tout le lot bascule
 *      sur de l'interrogation reguliere, avec une latence de plusieurs secondes.
 *   2. Que recoit-on reellement, et a quel rythme ? Les trames de Protect sont binaires et
 *      leur format n'est pas publie : on mesure ce qui arrive avant d'ecrire un decodeur.
 *   3. Quelle LATENCE entre le passage devant la camera et la trame ? C'est le seul chiffre
 *      qui dise si une notification vaut la peine.
 *   4. A defaut, que coute l'interrogation reguliere de /events ?
 *
 * Lecture seule : rien n'est modifie sur le controleur. Les identifiants sont saisis a
 * l'execution et ne sont jamais ecrits sur disque. Aucun code a deux facteurs n'est
 * affiche, et le compte rendu ne montre ni alias RTSP, ni jeton, ni cookie.
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

const horloge = (ms) => new Date(ms).toLocaleTimeString('fr-CH');

/**
 * Cherche des identifiants d'evenement dans une trame binaire.
 *
 * On ne DECODE pas le format — il n'est pas publie et l'ecrire a l'aveugle serait
 * presomptueux. On cherche seulement les motifs qui trahissent un evenement de camera,
 * ce qui suffit a repondre a la question posee : « ce canal parle-t-il des detections ? »
 */
function indices(buf) {
  const texte = buf.toString('latin1');
  const trouve = new Set();
  for (const mot of ['smartDetectZone', 'smartAudioDetect', 'motion', 'add', 'update',
                     'camera', 'event', 'ring', 'smartDetectTypes']) {
    if (texte.includes(mot)) trouve.add(mot);
  }
  return [...trouve];
}

(async () => {
  console.log('=== V-Alertes : le contrôleur sait-il prévenir, et en combien de temps ? ===\n');
  console.log('Lecture seule. Aucune requête ne modifie quoi que ce soit sur le contrôleur.\n');

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

  /* ---- 1. de quoi s'accrocher au flux de changements ---- */
  console.log('\n--- 1. Point de reprise ---');
  let boot;
  try {
    boot = await client.getBootstrap();
    ok('inventaire lu');
  } catch (e) { ko('inventaire', String(e && e.message)); process.exit(1); }

  const dernier = boot.lastUpdateId;
  if (!dernier) {
    ko('« lastUpdateId » absent de l\'inventaire',
       'la liaison temps reel de Protect s\'y accroche : sans lui, il faudra interroger');
  } else {
    ok('point de reprise present');
  }
  const noms = new Map((boot.cameras ?? []).map((c) => [c.id, c.name]));
  info('cameras', `${noms.size}`);

  /* ---- 2. le repli, mesure AVANT d'ouvrir la liaison ---- */
  /*
   * Cette partie passe en premier a dessein. Ouvrir la liaison temps reel oblige a lever
   * la verification TLS pour tout le processus — le certificat du controleur est
   * auto-signe — et la restaurer ensuite laissait la connexion suivante sans certificat a
   * verifier : l'epinglage la refusait, et la sonde mourait apres avoir tout mesure. On
   * fait donc les requetes ordinaires TANT QUE l'epinglage est intact.
   */
  console.log('\n--- 2. Ce que couterait une simple interrogation ---');
  {
    const t0 = Date.now();
    const N = 5;
    for (let i = 0; i < N; i++) {
      await client.getEvents({ debut: Date.now() - 120_000, fin: Date.now(), limite: 10 });
    }
    const total = Date.now() - t0;
    ok(`${N} interrogations`, `${Math.round(total / N)} ms chacune`);
    info('  → toutes les 5 s', `latence moyenne 2,5 s, ${Math.round(86400 / 5)} requetes par jour`);
    info('  → toutes les 15 s', `latence moyenne 7,5 s, ${Math.round(86400 / 15)} requetes par jour`);
  }

  /* ---- 3. la liaison permanente ---- */
  console.log('\n--- 3. La liaison temps reel s\'ouvre-t-elle ? ---');
  const adresse = `wss://${host}/proxy/protect/ws/updates`
    + (dernier ? `?lastUpdateId=${encodeURIComponent(dernier)}` : '');

  // Le certificat du controleur est auto-signe : la verification standard echouerait
  // toujours. La sonde s'en dispense LOCALEMENT — et ne la retablit pas, car la basculer
  // en cours de route laissait la connexion suivante sans certificat a verifier. Plus
  // aucune requete epinglee ne suit ce point. L'application, elle, epingle la cle.
  // Sonde de DIAGNOSTIC, lancee a la main contre le controleur : rien de ceci n'est
  // embarque dans l'application, qui epingle la cle publique (protect/pinning.js).
  // codeql[js/disabling-certificate-validation]
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  let ws;
  const trames = [];
  const ouverte = await new Promise((resolve) => {
    let fini = false;
    const rendre = (v) => { if (!fini) { fini = true; resolve(v); } };
    try {
      ws = new WebSocket(adresse, {
        headers: {
          Cookie: client.session.cookieHeader ?? '',
          ...(client.session.csrf ? { 'X-CSRF-Token': client.session.csrf } : {}),
        },
      });
    } catch (e) { ko('ouverture impossible', String(e && e.message)); return rendre(false); }

    ws.binaryType = 'arraybuffer';
    ws.addEventListener('open', () => rendre(true));
    ws.addEventListener('error', () => rendre(false));
    ws.addEventListener('message', (ev) => {
      const buf = typeof ev.data === 'string'
        ? Buffer.from(ev.data, 'utf8')
        : Buffer.from(ev.data);
      trames.push({ t: Date.now(), taille: buf.length, mots: indices(buf) });
    });
    setTimeout(() => rendre(false), 12_000);
  });

  if (!ouverte) {
    ko('la liaison temps reel ne s\'est pas ouverte');
    info('  → consequence', 'le Lot 8 reposera sur l\'interrogation reguliere de /events');
  } else {
    ok('liaison temps reel ouverte', 'le compte applicatif y a droit');
  }

  /* ---- 4. la latence, mesuree SANS chronometre humain ---- */
  if (ouverte) {
    console.log('\n--- 4. Quelle latence, vraiment ? ---');
    console.log('');
    console.log('    La premiere version faisait chronometrer a la main. Mauvaise methode : avec');
    console.log('    ~266 detections par jour, des trames arrivent en permanence, et rien ne');
    console.log('    permettait d\'attribuer celle qu\'on voyait a son passage. On corrèle donc');
    console.log('    plutot : a l\'arrivee d\'une trame, on demande l\'evenement le plus recent');
    console.log('    et l\'on compare son DEBUT a l\'instant ou la trame est arrivee.');
    console.log('');
    console.log('    Rien a faire : laisse tourner. Bouge devant une camera si tu veux hater.');
    console.log('');

    trames.length = 0;
    const debutEcoute = Date.now();
    const LIMITE_MS = 180_000;
    let mesure = null;

    while (Date.now() - debutEcoute < LIMITE_MS && !mesure) {
      await new Promise((r) => setTimeout(r, 1500));
      const parlante = trames.find((t) => t.t > debutEcoute && t.mots.some(
        (m) => m === 'smartDetectZone' || m === 'smartAudioDetect' || m === 'motion'));
      if (!parlante) continue;

      // Une seule requete, juste apres : l'evenement le plus recent est presque surement
      // celui que la trame annonce.
      const recents = await client.getEvents({
        debut: parlante.t - 120_000, fin: Date.now() + 5_000, limite: 5,
      }).catch(() => []);
      const dernier = recents[0];
      if (dernier?.start) {
        mesure = { arrivee: parlante.t, debut: dernier.start, type: dernier.type,
                   camera: noms.get(dernier.camera) ?? '?' };
      } else {
        // Pas d'evenement a montrer : on continue d'ecouter plutot que de conclure.
        trames.length = 0;
      }
    }

    if (!mesure) {
      info('aucune detection pendant les trois minutes d\'ecoute',
           `${trames.length} trame(s) recue(s) au total`);
    } else {
      const ecart = (mesure.arrivee - mesure.debut) / 1000;
      ok('trame corrélée a un evenement', `${mesure.type} sur ${mesure.camera}`);
      info('  → debut de l\'evenement', horloge(mesure.debut));
      info('  → arrivee de la trame', horloge(mesure.arrivee));
      info('  → LATENCE', `${ecart.toFixed(1)} s`);
      info('  → lecture', ecart < 3
        ? 'assez rapide pour une notification qui a du sens'
        : 'a comparer avec l\'interrogation : le gain ne va peut-etre pas de soi');
    }

    const toutes = trames.length ? trames : [{ taille: 0, mots: [] }];
    const tailles = toutes.map((t) => t.taille).filter(Boolean);
    if (tailles.length) info('tailles observees', `${Math.min(...tailles)} a ${Math.max(...tailles)} octets`);
    const mots = new Set(toutes.flatMap((t) => t.mots));
    if (mots.size) info('motifs reperes dans les trames', [...mots].join(', '));
  }

  try { ws?.close(); } catch { /* deja fermee */ }

  console.log('\n=== Ce que cette mesure decide ===');
  console.log('  · liaison ouverte ET trames de detection  → alertes quasi instantanees, et');
  console.log('    il faudra ecrire un decodeur pour le format binaire de Protect ;');
  console.log('  · liaison ouverte mais rien sur les detections → la liaison sert a l\'etat');
  console.log('    (disque, cameras) et les alertes passent par l\'interrogation ;');
  console.log('  · liaison fermee                          → interrogation toutes les 5 a 15 s,');
  console.log('    beaucoup plus simple a ecrire, et sans doute assez pour un domicile.');
  console.log('');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
