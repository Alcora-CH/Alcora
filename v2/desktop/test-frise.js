'use strict';

/**
 * V-Frise — la mesure qui precede le Lot 7 (relecture etendue, frise temporelle).
 *
 *   node test-frise.js
 *
 * Une frise qui pretend couvrir une journee doit savoir OU il y a reellement de la video.
 * Dessiner une barre pleine sur vingt-quatre heures alors que la camera n'enregistre que
 * sur detection, c'est promettre des images qui n'existent pas : l'utilisateur clique dans
 * un trou et ne comprend pas pourquoi rien ne vient. Cinq questions, donc :
 *
 *   1. Quel MODE d'enregistrement par camera — continu, detections seulement, jamais ?
 *   2. Depuis QUAND y a-t-il de la video, et jusqu'ou remonte la retention ?
 *   3. Le controleur sait-il DIRE ou il y a de la video, par une route dediee ?
 *   4. Sinon, peut-on le determiner en sondant l'export, et a quel cout ?
 *   5. Un extrait demande a cheval sur un trou : refus franc, ou video tronquee en silence ?
 *
 * Lecture seule : uniquement des GET. Rien n'est modifie sur le controleur.
 * Les identifiants sont saisis a l'execution et ne sont jamais ecrits sur disque. Aucun
 * code a deux facteurs n'est affiche. Le compte rendu ne montre ni alias RTSP, ni jeton.
 */

const readline = require('node:readline');
const https = require('node:https');
const { ProtectClient } = require('./protect/client');
const { createPinnedAgent } = require('./protect/pinning');
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
const HEURE = 3600_000;
const JOUR = 24 * HEURE;

/** Duree lisible, depuis un nombre de millisecondes. */
function duree(ms) {
  if (!ms || ms < 0) return '—';
  const j = Math.floor(ms / JOUR);
  const h = Math.round((ms % JOUR) / HEURE);
  return j ? `${j} j ${h} h` : `${Math.round(ms / HEURE)} h`;
}

/**
 * Empreinte de cle publique du controleur, apprise au premier contact et exigee ensuite.
 *
 * Elle est retenue ICI plutot que dans l'agent du client : chaque sondage utilise un agent
 * NEUF (voir plus bas), et sans cette variable chaque connexion repartirait en « premier
 * appairage », c'est-a-dire sans verification du tout.
 */
let pinConnu = null;

/**
 * Interroge une route et rend son code, SANS lire le corps.
 *
 * On coupe des les en-tetes recus : sonder l'export sur trente instants en telechargeant
 * chaque fois la video ferait passer des centaines de mega-octets pour une reponse qui
 * tient dans un code a trois chiffres.
 *
 * Un agent NEUF par sondage, et jete aussitot. La premiere version partageait l'agent du
 * client, persistant et mutualise : couper brutalement la reponse y laissait des sockets a
 * demi mortes que le sondage suivant reprenait, et la verification d'empreinte n'y trouvait
 * plus de certificat. Les deux tiers des sondages echouaient sur « empreinte differente »
 * alors que le controleur, lui, repondait parfaitement. Un agent jetable rend cette
 * pollution impossible : chaque sondage a sa propre connexion, qui meurt avec lui.
 */
function sonder(client, chemin) {
  return new Promise((resolve) => {
    const debutMs = Date.now();
    const agent = createPinnedAgent({
      pins: pinConnu ? [pinConnu] : [],
      onFirstUse: (p) => { pinConnu = p; },
    });

    let rendu = false;
    const fini = (r) => {
      if (rendu) return;
      rendu = true;
      try { agent.destroy(); } catch { /* deja ferme */ }
      resolve(r);
    };

    const req = https.request({
      host: client.host, port: 443, path: chemin, method: 'GET', agent,
      headers: {
        'User-Agent': 'Alcora-sonde/1.0',
        ...(client.session.cookieHeader ? { Cookie: client.session.cookieHeader } : {}),
        ...(client.session.csrf ? { 'X-CSRF-Token': client.session.csrf } : {}),
      },
    }, (res) => {
      const r = {
        code: res.statusCode,
        type: res.headers['content-type'] || '',
        taille: Number(res.headers['content-length']) || null,
        plages: res.headers['accept-ranges'] || null,
        ms: Date.now() - debutMs,
      };
      res.destroy();
      fini(r);
    });
    req.on('error', (e) => fini({ code: 0, erreur: e.message, ms: Date.now() - debutMs }));
    req.setTimeout(20_000, () => { req.destroy(); fini({ code: 0, erreur: 'delai depasse', ms: 20_000 }); });
    req.end();
  });
}

/** Telecharge entierement une reponse, dans la limite indiquee. */
function telechargerTout(client, chemin, maxOctets = 12 * 1024 * 1024) {
  return new Promise((resolve) => {
    const agent = createPinnedAgent({
      pins: pinConnu ? [pinConnu] : [], onFirstUse: (p) => { pinConnu = p; },
    });
    let rendu = false;
    const fini = (r) => { if (!rendu) { rendu = true; try { agent.destroy(); } catch {} resolve(r); } };
    const req = https.request({
      host: client.host, port: 443, path: chemin, method: 'GET', agent,
      headers: {
        'User-Agent': 'Alcora-sonde/1.0',
        ...(client.session.cookieHeader ? { Cookie: client.session.cookieHeader } : {}),
        ...(client.session.csrf ? { 'X-CSRF-Token': client.session.csrf } : {}),
      },
    }, (res) => {
      if (res.statusCode !== 200) { res.resume(); return fini({ code: res.statusCode }); }
      const type = res.headers['content-type'] || '';
      const morceaux = [];
      let recu = 0;
      res.on('data', (m) => {
        morceaux.push(m); recu += m.length;
        if (recu >= maxOctets) { res.destroy(); }
      });
      res.on('end', () => fini({ code: 200, type, buf: Buffer.concat(morceaux) }));
      res.on('close', () => fini({ code: 200, type, buf: Buffer.concat(morceaux), tronque: true }));
      res.on('error', () => fini({ code: 0 }));
    });
    req.on('error', (e) => fini({ code: 0, erreur: e.message }));
    req.setTimeout(120_000, () => { req.destroy(); fini({ code: 0, erreur: 'delai depasse' }); });
    req.end();
  });
}

/**
 * Descend l'arborescence de boites d'un MP4 jusqu'au chemin demande.
 *
 * Une boite vaut [4 octets de taille][4 octets de type][contenu]. Certaines contiennent
 * d'autres boites, d'autres des donnees ; seule la connaissance du format dit lesquelles,
 * d'ou la liste explicite des conteneurs traverses.
 */
const CONTENEURS = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl']);

/**
 * Lit l'en-tete d'une boite : sa taille reelle, son type, et ou commence son contenu.
 *
 * Deux formes echappaient a la premiere version, et c'est ce qui a fait echouer huit
 * lectures sur huit :
 *
 *   · taille = 0 signifie « jusqu'a la fin du fichier ». Je calculais bien le cas, mais le
 *     garde-fou « taille < 8 » qui suivait le rejetait aussitot : le code etait mort ;
 *   · taille = 1 signifie que la VRAIE taille suit sur 64 bits. C'est la forme employee
 *     des qu'une boite peut depasser quatre gigaoctets — « mdat » en tete. La rencontrer
 *     arretait net le parcours, avant meme d'atteindre « moov ».
 */
function enTete(buf, p, fin) {
  if (p + 8 > fin) return null;
  const brut = buf.readUInt32BE(p);
  const type = buf.toString('latin1', p + 4, p + 8);
  if (brut === 1) {
    if (p + 16 > fin) return null;
    const grand = Number(buf.readBigUInt64BE(p + 8));
    if (grand < 16 || p + grand > fin) return null;
    return { type, corps: p + 16, suivant: p + grand };
  }
  if (brut === 0) return { type, corps: p + 8, suivant: fin };
  if (brut < 8 || p + brut > fin) return null;
  return { type, corps: p + 8, suivant: p + brut };
}

function trouverBoite(buf, chemin, debut = 0, fin = buf.length) {
  const [voulu, ...reste] = chemin;
  let p = debut;
  while (p + 8 <= fin) {
    const b = enTete(buf, p, fin);
    if (!b) break;
    if (b.type === voulu) {
      if (!reste.length) return { debut: p, corps: b.corps, fin: b.suivant };
      if (CONTENEURS.has(b.type)) {
        const t = trouverBoite(buf, reste, b.corps, b.suivant);
        if (t) return t;
      }
    }
    if (b.suivant <= p) break;
    p = b.suivant;
  }
  return null;
}

/** Suite des boites de premier niveau, pour dire ce qu'on a recu quand la lecture echoue. */
function sommaire(buf, debut = 0, fin = buf.length) {
  const vus = [];
  let p = debut;
  while (p + 8 <= fin && vus.length < 12) {
    const b = enTete(buf, p, fin);
    if (!b) { vus.push('(illisible)'); break; }
    vus.push(`${b.type}:${b.suivant - p}`);
    if (b.suivant <= p) break;
    p = b.suivant;
  }
  return vus.join(' ');
}

const CODECS_VIDEO = new Set(['avc1', 'avc3', 'hvc1', 'hev1', 'av01', 'vp09']);

/**
 * Resolution et codec de la piste VIDEO.
 *
 * On parcourt les pistes une a une au lieu de prendre la premiere « stsd » venue : un MP4
 * en porte plusieurs, et celle du SON arrive souvent en tete. Ses champs de largeur et de
 * hauteur existent au meme endroit, mais ne veulent rien dire — on lirait une definition
 * inventee avec l'aplomb d'une mesure.
 */
function resolution(buf) {
  const moov = trouverBoite(buf, ['moov']);
  if (!moov) return null;

  let p = moov.corps;
  while (p + 8 <= moov.fin) {
    const b = enTete(buf, p, moov.fin);
    if (!b) break;
    if (b.type === 'trak') {
      const stsd = trouverBoite(buf, ['mdia', 'minf', 'stbl', 'stsd'], b.corps, b.suivant);
      if (stsd) {
        // Corps de stsd : 4 octets version/indicateurs, 4 octets de compte, puis les entrees.
        const e = stsd.corps + 8;
        if (e + 36 <= buf.length) {
          const codec = buf.toString('latin1', e + 4, e + 8);
          if (CODECS_VIDEO.has(codec)) {
            // VisualSampleEntry : en-tete de 8 octets, puis 24 reserves avant la taille.
            return { codec, largeur: buf.readUInt16BE(e + 32), hauteur: buf.readUInt16BE(e + 34) };
          }
        }
      }
    }
    if (b.suivant <= p) break;
    p = b.suivant;
  }
  return null;
}

/** Route d'export sur une fenetre donnee. */
const routeExport = (id, debut, fin) =>
  `/proxy/protect/api/video/export?camera=${encodeURIComponent(id)}`
  + `&start=${Math.round(debut)}&end=${Math.round(fin)}`;

(async () => {
  console.log('=== V-Frise : ou y a-t-il reellement de la video ? ===\n');
  console.log('Lecture seule. Aucune requete ne modifie quoi que ce soit sur le controleur.\n');

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

  /* ---- 1. mode d'enregistrement, par camera ---- */
  console.log('\n--- 1. Que fait chaque camera, et depuis quand ? ---');
  let boot;
  try {
    boot = await client.getBootstrap();
    ok('inventaire lu');
  } catch (e) {
    ko('inventaire', String(e && e.message));
    process.exit(1);
  }

  const cameras = (boot.cameras || []).map((c) => ({
    id: c.id,
    nom: c.name,
    modele: c.type,
    // Le nom du champ a change selon les versions de Protect : on prend le premier present
    // plutot que d'en supposer un seul et de rendre « inconnu » sur un materiel recent.
    mode: c.recordingSettings?.mode
       ?? c.smartDetectSettings?.mode
       ?? c.recordingSchedulesV2?.[0]?.mode
       ?? '(champ absent)',
    // Protect garde DEUX flux, haute et basse definition, dont les retentions different.
    // Les confondre ferait promettre du 4K la ou il ne reste qu'un flux degrade.
    debutVideo: c.stats?.video?.recordingStart ?? null,
    debutVideoBD: c.stats?.video?.recordingStartLQ ?? null,
    finVideo: c.stats?.video?.recordingEnd ?? null,
    finVideoBD: c.stats?.video?.recordingEndLQ ?? null,
    preRoll: c.recordingSettings?.prePaddingSecs ?? null,
    postRoll: c.recordingSettings?.postPaddingSecs ?? null,
    retentionJours: c.recordingSettings?.retentionDurationMs
      ? Math.round(c.recordingSettings.retentionDurationMs / JOUR) : null,
  }));

  if (!cameras.length) { ko('aucune camera dans l\'inventaire'); process.exit(1); }

  for (const c of cameras) {
    console.log(`\n  ${c.nom}  (${c.modele})`);
    info('mode d\'enregistrement', String(c.mode));
    info('haute definition, depuis', quand(c.debutVideo)
      + (c.debutVideo ? `  (${duree(Date.now() - c.debutVideo)})` : ''));
    info('basse definition, depuis', quand(c.debutVideoBD)
      + (c.debutVideoBD ? `  (${duree(Date.now() - c.debutVideoBD)})` : ''));
    if (c.debutVideo && c.debutVideoBD) {
      const ecart = c.debutVideo - c.debutVideoBD;
      if (Math.abs(ecart) > HEURE) {
        info('  → les deux retentions DIFFERENT', `${duree(Math.abs(ecart))} d'ecart`);
        info('  → conséquence pour la frise',
          'au-dela de la frontiere, annoncer honnetement la basse definition');
      } else {
        info('  → retentions identiques', 'la frise n\'a qu\'une seule profondeur a montrer');
      }
    }
    if (c.finVideo) info('video la plus recente', quand(c.finVideo));
    if (c.retentionJours !== null) info('retention annoncee', `${c.retentionJours} j`);
    if (c.preRoll !== null || c.postRoll !== null) {
      info('marges de la camera', `avant ${c.preRoll ?? '?'} s / apres ${c.postRoll ?? '?'} s`);
      // Elles gouvernent la fabrication de CLIPS en mode detection. En enregistrement
      // continu il n'y a pas de clip : tout est enregistre, et elles n'ont pas d'objet.
      info('  → sous « always »', 'sans objet : la marge de 3 s d\'Alcora ne fait pas double emploi');
    }
  }

  // Ce que raconte l'espace disque : une frise doit savoir jusqu'ou reculer.
  const stockage = boot.nvr?.storageInfo || boot.nvr?.systemInfo?.storage;
  if (stockage) {
    console.log('\n  Stockage du controleur');
    if (stockage.totalSize) info('capacite', `${Math.round(stockage.totalSize / 1e9)} Go`);
    if (stockage.totalSpaceUsed) info('occupe', `${Math.round(stockage.totalSpaceUsed / 1e9)} Go`);
  }

  /* ---- 2. le controleur sait-il DIRE ou il y a de la video ? ---- */
  console.log('\n--- 2. Existe-t-il une route qui donne les plages enregistrees ? ---');
  console.log('    (uniquement des GET ; une route absente rend 404, ce qui est une reponse)');

  const cam = cameras[0];
  const fin = Date.now();
  const debut = fin - JOUR;
  const candidates = [
    ['segments video', `/proxy/protect/api/video/segments?camera=${cam.id}&start=${debut}&end=${fin}`],
    ['segments de camera', `/proxy/protect/api/cameras/${cam.id}/recording-segments?start=${debut}&end=${fin}`],
    ['frise', `/proxy/protect/api/timeline?camera=${cam.id}&start=${debut}&end=${fin}`],
    ['enregistrements', `/proxy/protect/api/recordings?camera=${cam.id}&start=${debut}&end=${fin}`],
    ['fiche camera', `/proxy/protect/api/cameras/${cam.id}`],
  ];

  let routeTrouvee = null;
  for (const [nom, chemin] of candidates) {
    const r = await sonder(client, chemin);
    const detail = `HTTP ${r.code}${r.taille ? `, ${r.taille} octets` : ''}, ${r.ms} ms`;
    if (r.code === 200) { ok(nom, detail); if (!routeTrouvee && !nom.startsWith('fiche')) routeTrouvee = nom; }
    else if (r.code === 404) info(`${nom} : absente`, detail);
    else ko(nom, detail + (r.erreur ? ` — ${r.erreur}` : ''));
  }

  /* ---- 3. jusqu'ou remonte reellement la video ? ---- */
  console.log('\n--- 3. Ou s\'arrete VRAIMENT la video la plus ancienne ? ---');
  console.log('    Le passage precedent avait tort : j\'avais decrete « il y a 120 jours =');
  console.log('    certainement rien » sans le verifier. Tous les sondages ayant repondu 200,');
  console.log('    la recherche a converge vers sa propre borne de depart et j\'ai pris ce');
  console.log('    bord de fenetre pour une frontiere. Cette fois la borne vide est PROUVEE.');

  let borneVideo = null;
  {
    // On recule jusqu'a obtenir un vrai 404 : sans cette preuve, toute dichotomie ment.
    let vide = null;
    for (const jours of [200, 400, 800, 1600]) {
      const t = Date.now() - jours * JOUR;
      const r = await sonder(client, routeExport(cam.id, t, t + 1000));
      if (r.code === 404) { vide = t; ok(`borne vide prouvee a ${jours} jours`, 'HTTP 404'); break; }
      info(`a ${jours} jours il y a ENCORE de la video`, `HTTP ${r.code}`);
    }

    if (vide === null) {
      ko('aucune borne vide trouvee jusqu\'a 1600 jours', 'dichotomie impossible');
    } else {
      let pleine = Date.now() - HEURE;
      let tours = 0;
      while (pleine - vide > 3 * HEURE && tours < 20) {
        const milieu = Math.round((vide + pleine) / 2);
        const r = await sonder(client, routeExport(cam.id, milieu, milieu + 1000));
        if (r.code === 200) pleine = milieu;
        else if (r.code === 404) vide = milieu;
        else break;
        tours++;
      }
      borneVideo = pleine;
      ok(`frontiere trouvee en ${tours} sondages`, quand(pleine));
      info('profondeur reellement disponible', duree(Date.now() - pleine));
      info('  → ce que « recordingStart » annoncait', quand(cam.debutVideo));
      info('  → ce que « recordingStartLQ » annoncait', quand(cam.debutVideoBD));
      const dHD = cam.debutVideo ? Math.abs(cam.debutVideo - pleine) : null;
      const dLQ = cam.debutVideoBD ? Math.abs(cam.debutVideoBD - pleine) : null;
      if (dLQ !== null && (dHD === null || dLQ < dHD)) {
        ok('c\'est « recordingStartLQ » qui dit vrai', `${duree(dLQ)} d'ecart`);
        info('  → bord gauche de la frise', 'recordingStartLQ, JAMAIS recordingStart');
      } else if (dHD !== null && dHD < 12 * HEURE) {
        ok('c\'est « recordingStart » qui dit vrai', `${duree(dHD)} d'ecart`);
      } else {
        ko('aucun champ de l\'inventaire ne correspond',
          'le bord gauche devra etre cherche par sondage au demarrage');
      }
    }
  }

  /* ---- 4. une demande a cheval sur un trou ---- */
  console.log('\n--- 4. Une fenetre a cheval sur un trou : refus franc, ou silence ? ---');
  console.log('    (une heure il y a un an : il ne peut RIEN y avoir)');
  {
    const t = Date.now() - 365 * JOUR;
    const r = await sonder(client, routeExport(cam.id, t, t + HEURE));
    if (r.code === 404) ok('refus franc sur une periode vide', `HTTP 404, ${r.ms} ms`);
    else if (r.code === 200) {
      ko('le controleur accepte une periode vide', `HTTP 200, ${r.taille ?? '?'} octets annonces`);
      info('  → consequence', 'la frise ne peut PAS se fier au code seul, il faudra mesurer la duree obtenue');
    } else info('reponse inattendue', `HTTP ${r.code}`);
  }

  /* ---- 5. la RESOLUTION reelle selon l'age ---- */
  console.log('\n--- 5. La definition baisse-t-elle avec l\'age ? ---');
  console.log('    Le poids en octets ne peut pas y repondre : il varie d\'un facteur dix avec');
  console.log('    le CONTENU (une nuit immobile se comprime a rien, du feuillage au vent est');
  console.log('    lourd). C\'est ce qui m\'a fait conclure a tort a une degradation. Seule la');
  console.log('    resolution ecrite dans le fichier tranche : on la lit dans la boite « stsd ».');

  {
    const points = [['1 h', HEURE], ['20 j', 20 * JOUR], ['45 j', 45 * JOUR], ['100 j', 100 * JOUR]];
    for (const c of cameras) {
      console.log(`\n  ${c.nom}`);
      for (const [libelle, recul] of points) {
        const t = Date.now() - recul;
        if (borneVideo && t < borneVideo) { info(`${libelle.padEnd(6)} au-dela de la retention`); continue; }
        const r = await telechargerTout(client, routeExport(c.id, t, t + 1000));
        if (r.code !== 200 || !r.buf?.length) {
          info(`${libelle.padEnd(6)} pas de video`, `HTTP ${r.code}`);
          continue;
        }
        const res = resolution(r.buf);
        if (!res) {
          // Se taire serait le pire : on dit ce qu'on a recu, pour savoir QUOI corriger.
          ko(`${libelle.padEnd(6)} definition illisible`,
            `${(r.buf.length / 1048576).toFixed(2)} Mo${r.tronque ? ', tronque' : ''}, type « ${r.type || '?'} »`);
          info('    boites de premier niveau', sommaire(r.buf) || '(aucune)');
          const m = trouverBoite(r.buf, ['moov']);
          info('    « moov »', m ? `trouve, ${m.fin - m.debut} octets` : 'ABSENT du fichier recu');
          if (m) info('    boites dans « moov »', sommaire(r.buf, m.corps, m.fin) || '(aucune)');
          continue;
        }
        ok(`${libelle.padEnd(6)} ${String(res.largeur).padStart(4)} x ${String(res.hauteur).padEnd(4)}`,
          `codec ${res.codec}, ${(r.buf.length / 1048576).toFixed(1)} Mo pour 1 s`);
      }
    }
  }

  console.log('\n=== Ce que cette mesure decide ===');
  console.log('  · « always » sur les deux cameras : la frise est une BARRE PLEINE, et les');
  console.log('    detections sont des reperes poses dessus. Aucun balayage a l\'usage.');
  console.log('  · Le bord gauche vient du champ que la partie 3 a designe — surtout PAS de');
  console.log('    « recordingStart », qui annonce 29 jours quand il y en a au moins 120.');
  console.log('  · Si la definition chute (partie 5), la frise marque la frontiere et le');
  console.log('    lecteur annonce la definition obtenue, au lieu de laisser croire au 4K.');
  console.log('  · Si elle ne chute pas, il n\'y a rien a signaler : une barre uniforme suffit.');
  console.log('');
})().catch((e) => { console.error(e); process.exit(1); });
