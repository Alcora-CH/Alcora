'use strict';

/**
 * Verification du service local des extraits — sans controleur, sans reseau.
 *
 *   node test-extraits.js
 *
 * Pourquoi ce test existe : le controleur IGNORE l'en-tete « Range » et place l'index
 * (« moov ») en QUEUE de fichier. C'est donc l'application qui doit servir les plages sur
 * le fichier deja obtenu, sans quoi la barre de lecture ne repond pas et le lecteur ne
 * trouve jamais l'index. L'analyse d'une plage est courte mais pleine de cas limites —
 * forme suffixe, borne au-dela de la fin, plage impossible — et chacun d'eux se traduit
 * par une video muette plutot que par un message.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Extraits, CONSERVES_MAX, POIDS_MAX, QUANTUM_FIN_MS, corpsFichier } = require('./extraits');

let echecs = 0;

function check(label, attendu, obtenu) {
  const ok = String(attendu) === String(obtenu);
  if (!ok) echecs++;
  console.log(`${ok ? '  OK  ' : ' ECHEC'}  ${label.padEnd(46)} attendu=${String(attendu).padEnd(18)} obtenu=${obtenu}`);
}

function checkBool(label, condition) {
  if (!condition) echecs++;
  console.log(`${condition ? '  OK  ' : ' ECHEC'}  ${label}`);
}

/** Journal muet : ce test ne verifie pas la journalisation. */
const journal = { info() {}, erreur() {}, alerte() {} };

const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'alcora-extraits-'));
const extraits = new Extraits({ dossier, client: () => null, journal });

// Un contenu dont chaque octet est identifiable : une plage mal calculee se voit.
const TAILLE = 1000;
const contenu = Buffer.alloc(TAILLE);
for (let i = 0; i < TAILLE; i++) contenu[i] = i % 251;
fs.writeFileSync(extraits.chemin('cam-1-2'), contenu);

/** Lit entierement le corps d'une reponse, en octets. */
async function corps(reponse) {
  return Buffer.from(await reponse.arrayBuffer());
}

async function main() {
  console.log('=== Fichier entier, sans plage demandee ===');
  {
    const r = extraits.servir('cam-1-2', null);
    check('statut', 200, r.status);
    check('Content-Length', TAILLE, r.headers.get('Content-Length'));
    check('Accept-Ranges annonce', 'bytes', r.headers.get('Accept-Ranges'));
    check('type', 'video/mp4', r.headers.get('Content-Type'));
    const b = await corps(r);
    checkBool('contenu complet et identique', b.equals(contenu));
  }

  console.log('\n=== Plage ordinaire ===');
  {
    const r = extraits.servir('cam-1-2', 'bytes=100-199');
    check('statut', 206, r.status);
    check('Content-Range', `bytes 100-199/${TAILLE}`, r.headers.get('Content-Range'));
    check('Content-Length', 100, r.headers.get('Content-Length'));
    const b = await corps(r);
    checkBool('octets alignes sur la demande', b.equals(contenu.subarray(100, 200)));
  }

  console.log('\n=== Depuis une position, jusqu’a la fin ===');
  {
    const r = extraits.servir('cam-1-2', 'bytes=900-');
    check('statut', 206, r.status);
    check('Content-Range', `bytes 900-999/${TAILLE}`, r.headers.get('Content-Range'));
    check('Content-Length', 100, r.headers.get('Content-Length'));
  }

  console.log('\n=== Forme suffixe : la queue du fichier ===');
  console.log('    (c’est ainsi que le lecteur va chercher l’index que le contrôleur y place)');
  {
    const r = extraits.servir('cam-1-2', 'bytes=-64');
    check('statut', 206, r.status);
    check('Content-Range', `bytes 936-999/${TAILLE}`, r.headers.get('Content-Range'));
    const b = await corps(r);
    checkBool('ce sont bien les 64 derniers octets', b.equals(contenu.subarray(TAILLE - 64)));
  }
  {
    // Suffixe plus grand que le fichier : la reponse est le fichier entier, pas une erreur.
    const r = extraits.servir('cam-1-2', 'bytes=-5000');
    check('suffixe trop grand — statut', 206, r.status);
    check('suffixe trop grand — plage', `bytes 0-999/${TAILLE}`, r.headers.get('Content-Range'));
  }

  console.log('\n=== Bornes au-dela de la fin ===');
  {
    // Un lecteur demande volontiers « 0-1048575 » sans savoir la taille : la reponse doit
    // etre le fichier, ramene a sa vraie fin, et surtout pas une erreur.
    const r = extraits.servir('cam-1-2', 'bytes=0-1048575');
    check('statut', 206, r.status);
    check('fin ramenee a la taille reelle', `bytes 0-999/${TAILLE}`, r.headers.get('Content-Range'));
  }

  console.log('\n=== Plages impossibles ===');
  {
    const r = extraits.servir('cam-1-2', 'bytes=1000-1100');
    check('debut au-dela de la fin — statut', 416, r.status);
    check('taille annoncee', `bytes */${TAILLE}`, r.headers.get('Content-Range'));
  }
  {
    const r = extraits.servir('cam-1-2', 'bytes=500-100');
    check('bornes inversees — statut', 416, r.status);
  }
  {
    const r = extraits.servir('cam-1-2', 'bytes=-0');
    check('suffixe nul — statut', 416, r.status);
  }

  console.log('\n=== Demandes que l’on n’analyse pas ===');
  {
    // Plages multiples, unites exotiques : on rend le fichier entier. C'est autorise, et
    // c'est infiniment preferable a une reponse 206 dont le corps ne correspondrait pas.
    const r = extraits.servir('cam-1-2', 'bytes=0-99,200-299');
    check('plages multiples — statut', 200, r.status);
    const r2 = extraits.servir('cam-1-2', 'lignes=0-99');
    check('unite inconnue — statut', 200, r2.status);
  }

  console.log('\n=== Jetons refuses ===');
  {
    check('jeton absent du disque', 404, extraits.servir('cam-9-9', null).status);
    check('remontee de dossier', 400, extraits.servir('..\\..\\config', null).status);
    check('barre oblique', 400, extraits.servir('a/b', null).status);
    check('point', 400, extraits.servir('a.mp4', null).status);
    check('jeton vide', 400, extraits.servir('', null).status);
  }

  console.log('\n=== Nom de fichier deduit de la demande ===');
  {
    // La meme detection doit retomber sur le meme fichier, sinon chaque ouverture
    // retelechargerait la sequence.
    check('stable', Extraits.jeton('abc', 1000, 2000), Extraits.jeton('abc', 1000, 2000));
    checkBool('deux periodes differentes ne se confondent pas',
      Extraits.jeton('abc', 1000, 2000) !== Extraits.jeton('abc', 1000, 2001));
    checkBool('identifiant assaini',
      /^[A-Za-z0-9-]+$/.test(Extraits.jeton('../evil id', 1, 2)));
    check('millisecondes arrondies', Extraits.jeton('a', 1000, 2000), Extraits.jeton('a', 1000.4, 1999.6));
  }

  console.log('\n=== Morceaux de frise : l’alignement qui rend le cache utile ===');
  {
    const PAS = 10_000;
    const T = 1_800_000_000_000;          // instant fixe : un test ne depend pas de l'heure
    const APRES = T + 3600_000;           // « maintenant », loin devant

    const a = Extraits.morceau(T + 3_000, PAS, APRES);
    check('debut aligne sur la grille', T, a.debut);
    check('fin = debut + pas', T + PAS, a.fin);

    // Le coeur du sujet : tout le voisinage doit retomber sur le MEME fichier, sinon
    // chaque clic retelecharge 35 Mo sur la G6 en 4K.
    const jetons = new Set();
    for (const d of [0, 1, 999, 5_000, 9_999]) {
      const m = Extraits.morceau(T + d, PAS, APRES);
      jetons.add(Extraits.jeton('cam', m.debut, m.fin));
    }
    check('cinq instants du meme intervalle → un seul extrait', 1, jetons.size);

    const suivant = Extraits.morceau(T + PAS, PAS, APRES);
    checkBool('l’instant suivant bascule sur le morceau d’apres', suivant.debut === T + PAS);
    checkBool('les morceaux se touchent sans trou ni recouvrement', a.fin === suivant.debut);

    // Une seconde avant la borne : encore dans le morceau precedent.
    const avant = Extraits.morceau(T - 1, PAS, APRES);
    checkBool('un millieme de seconde avant : morceau precedent', avant.debut === T - PAS);
  }
  console.log('\n=== Le morceau EN COURS ne doit pas deriver (regression du 29.07.2026) ===');
  console.log('    Constate sur le poste : deux telechargements de 2,2 Mo en deux secondes,');
  console.log('    « ...-6210 » puis « ...-7682 » — meme debut, fin differente. La fin etait');
  console.log('    posee a Date.now() exactement, donc elle changeait a chaque milliseconde.');
  {
    const PAS = 10_000;
    const T0 = 1_800_000_000_000;
    // Deux clics separes de deux secondes, dans le morceau qui court.
    const a = Extraits.morceau(T0 + 6_000, PAS, T0 + 6_210);
    const b = Extraits.morceau(T0 + 7_000, PAS, T0 + 7_682);
    check('deux clics a deux secondes → le MEME extrait',
      Extraits.jeton('c', a.debut, a.fin), Extraits.jeton('c', b.debut, b.fin));
    checkBool('la fin est quantifiee, pas collee au present',
      a.fin % QUANTUM_FIN_MS === 0);
    checkBool('et elle ne depasse jamais le present', a.fin <= T0 + 6_210);
  }
  {
    const PAS = 10_000;
    const T0 = 1_800_000_000_000;
    // Le quantum franchi, la fin avance — c'est voulu : la sequence s'allonge.
    const avant = Extraits.morceau(T0 + 2_000, PAS, T0 + 4_999);
    const apres = Extraits.morceau(T0 + 2_000, PAS, T0 + 5_001);
    checkBool('au franchissement du quantum, le morceau s’allonge',
      apres !== null && (avant === null || apres.fin > avant.fin));
    checkBool('au plus un extrait nouveau par quantum', apres.fin === T0 + 5_000);
  }
  {
    const PAS = 10_000;
    const T0 = 1_800_000_000_000;
    // Viser les toutes dernieres secondes : plutot qu'un refus, le dernier morceau COMPLET.
    // L'horodatage affiche sur l'image dit la verite, donc ce recul ne trompe personne.
    const m = Extraits.morceau(T0 + 2_000, PAS, T0 + 3_000);
    checkBool('trop pres du present : on recule d’un morceau', m !== null);
    check('  et ce morceau precedent est complet', PAS, m.fin - m.debut);
    checkBool('  il se termine ou le morceau vise commence', m.fin === T0);
  }
  {
    const PAS = 10_000;
    const MAINTENANT = 1_800_000_000_000;
    check('instant tres au-dela du present : rien a demander', null,
      Extraits.morceau(MAINTENANT + 600_000, PAS, MAINTENANT));
    check('pas nul', null, Extraits.morceau(MAINTENANT - 1000, 0, MAINTENANT));
    check('instant non numerique', null, Extraits.morceau(NaN, PAS, MAINTENANT));
    check('present non numerique', null, Extraits.morceau(MAINTENANT - 1000, PAS, NaN));
  }

  console.log('\n=== Enchaînement : ni trou ni recouvrement entre deux morceaux ===');
  console.log('    La grille sert aux CLICS. Pendant la lecture, le morceau suivant doit');
  console.log('    reprendre EXACTEMENT ou le precedent s\'arrete, quelle que soit sa duree —');
  console.log('    c\'est en les allongeant qu\'on espace les jointures, seules encore visibles.');
  {
    const T0 = 1_800_000_000_000;
    const LOIN = T0 + 3600_000;

    const clic = Extraits.morceau(T0 + 4_000, 10_000, LOIN);
    const s1 = Extraits.suite(clic.fin, 30_000, LOIN);
    const s2 = Extraits.suite(s1.fin, 30_000, LOIN);

    checkBool('le 2e morceau reprend ou le 1er finit', s1.debut === clic.fin);
    checkBool('le 3e reprend ou le 2e finit', s2.debut === s1.fin);
    check('duree d’un morceau enchaine, en s', 30, (s1.fin - s1.debut) / 1000);
    checkBool('aucun recouvrement', s1.debut >= clic.fin && s2.debut >= s1.fin);
    // Trois morceaux couvrent bien la periode, sans manque.
    check('couverture totale, en s', 70, (s2.fin - clic.debut) / 1000);
  }
  {
    const T0 = 1_800_000_000_000;
    // Contre le present : la suite est tronquee, jamais inventee.
    const m = Extraits.suite(T0, 30_000, T0 + 12_000);
    checkBool('pres du present, la suite est raccourcie', m.fin - m.debut < 30_000);
    checkBool('et sa fin reste quantifiee', m.fin % QUANTUM_FIN_MS === 0);
    check('rien a lire au-dela du present', null, Extraits.suite(T0 + 60_000, 30_000, T0));
    check('duree nulle', null, Extraits.suite(T0, 0, T0 + 60_000));
    check('depart non numerique', null, Extraits.suite(NaN, 30_000, T0 + 60_000));
  }

  console.log('\n=== Le flux d’un fichier ne doit JAMAIS tuer le processus ===');
  console.log('    Le lecteur video abandonne ses requetes a CHAQUE deplacement. Undici');
  console.log('    refermait alors un flux deja ferme — exception fatale dans une micro-');
  console.log('    tache, et app.exit(1). L’application est morte deux fois le 29.07.2026.');
  {
    const gros = path.join(dossier, 'flux-test.mp4');
    fs.writeFileSync(gros, Buffer.alloc(3 * 1024 * 1024, 7));

    // Lecture complete : le contenu doit arriver entier.
    const entier = await new Response(corpsFichier(gros)).arrayBuffer();
    check('lecture complete, en octets', 3 * 1024 * 1024, entier.byteLength);

    // Plage : seuls les octets demandes.
    const plage = await new Response(corpsFichier(gros, { start: 10, end: 109 })).arrayBuffer();
    check('lecture d’une plage, en octets', 100, plage.byteLength);

    // L'abandon en cours de route relache le fichier au lieu de laisser un descripteur
    // ouvert : sans cela, parcourir une journee finit par epuiser les poignees du systeme.
    {
      const flux = corpsFichier(gros);
      const lecteur = flux.getReader();
      await lecteur.read();
      await lecteur.cancel();
      await new Promise((r) => setTimeout(r, 30));
      // Le fichier doit pouvoir etre efface : Windows le refuse s'il est encore ouvert.
      const jetable = path.join(dossier, 'jetable.mp4');
      fs.copyFileSync(gros, jetable);
      const f2 = corpsFichier(jetable);
      const l2 = f2.getReader();
      await l2.read();
      await l2.cancel();
      await new Promise((r) => setTimeout(r, 30));
      let efface = true;
      try { fs.rmSync(jetable); } catch { efface = false; }
      checkBool('l’abandon relache le fichier (effacable ensuite)', efface);
    }

    /*
     * LA regression, reproduite a son mecanisme exact.
     *
     * La trace du plantage nommait « ReadableByteStreamController.close ». Le scenario est
     * celui-ci, et il est deterministe : le destinataire abandonne, puis la source referme
     * derriere lui. Chez undici cette fermeture est NUE, elle leve donc dans une
     * micro-tache que rien ne rattrape — et le gestionnaire d'exception fatale appelait
     * app.exit(1). Ci-dessous, les deux formes cote a cote : sans la garde, l'exception
     * revient ; avec, elle est absorbee. Un test qui passerait dans les deux cas ne
     * prouverait rien.
     */
    const fermetureApresAbandon = async (garder) => {
      let ctrl;
      const flux = new ReadableStream({ type: 'bytes', start(c) { ctrl = c; }, cancel() {} });
      const lecteur = flux.getReader();
      ctrl.enqueue(new Uint8Array([1, 2, 3]));
      await lecteur.read();
      await lecteur.cancel();
      try {
        if (garder) { try { ctrl.close(); } catch { return null; } }
        else ctrl.close();
        return null;
      } catch (e) { return e.code || e.name; }
    };
    check('fermeture NUE apres abandon : leve bien', 'ERR_INVALID_STATE',
      await fermetureApresAbandon(false));
    check('fermeture GARDEE apres abandon : rien ne sort', null,
      await fermetureApresAbandon(true));
  }

  console.log('\n=== Conservation ===');
  {
    // Vingt-six extraits deposes, vingt-quatre doivent survivre : les deux plus anciens
    // partent. Sans cela le dossier de donnees enfle sans fin.
    const bac = fs.mkdtempSync(path.join(os.tmpdir(), 'alcora-balayage-'));
    const e2 = new Extraits({ dossier: bac, client: () => null, journal });
    for (let i = 0; i < 26; i++) {
      const p = e2.chemin(`x-${i}-0`);
      fs.writeFileSync(p, 'x');
      const t = new Date(Date.now() - (26 - i) * 60_000);
      fs.utimesSync(p, t, t);
    }
    e2.balayer();
    const restants = fs.readdirSync(bac).filter((f) => f.endsWith('.mp4'));
    check('extraits conserves', CONSERVES_MAX, restants.length);
    checkBool('le plus recent est reste', restants.includes('x-25-0.mp4'));
    checkBool('le plus ancien est parti', !restants.includes('x-0-0.mp4'));
    fs.rmSync(bac, { recursive: true, force: true });
  }

  console.log('\n=== Conservation : la borne de POIDS ===');
  console.log('    (le nombre seul ne garantit rien : de 4 a 31 Mo selon la duree)');
  {
    // Cinq extraits de 150 Mo : bien en-dessous des 24 fichiers, mais 750 Mo au total.
    // Seuls les DEUX premiers tiennent dans le budget de 400 Mo — le troisieme le porterait
    // a 450 Mo. C'est le nombre qui doit ceder ici, pas le poids.
    const bac = fs.mkdtempSync(path.join(os.tmpdir(), 'alcora-poids-'));
    const e3 = new Extraits({ dossier: bac, client: () => null, journal });
    const GROS = 150 * 1024 * 1024;
    const bloc = Buffer.alloc(1024 * 1024);
    for (let i = 0; i < 5; i++) {
      const p = e3.chemin(`y-${i}-0`);
      const fd = fs.openSync(p, 'w');
      for (let k = 0; k < GROS / bloc.length; k++) fs.writeSync(fd, bloc);
      fs.closeSync(fd);
      const t = new Date(Date.now() - (5 - i) * 60_000);
      fs.utimesSync(p, t, t);
    }
    e3.balayer();
    const restants = fs.readdirSync(bac).filter((f) => f.endsWith('.mp4'));
    const total = restants.reduce((s, f) => s + fs.statSync(path.join(bac, f)).size, 0);
    check('fichiers restants (5 x 150 Mo, budget 400 Mo)', 2, restants.length);
    check('poids conserve, en Mo', 300, Math.round(total / 1048576));
    checkBool('le total ne depasse plus le budget', total <= POIDS_MAX);
    checkBool('le plus recent est reste', restants.includes('y-4-0.mp4'));
    checkBool('le plus ancien est parti', !restants.includes('y-0-0.mp4'));
    fs.rmSync(bac, { recursive: true, force: true });
  }

  console.log('\n=== Un seul extrait plus lourd que le budget ===');
  {
    // Le cas qui effacerait l'extrait a peine telecharge. Il doit survivre : sans lui,
    // ouvrir une longue sequence la detruirait dans la foulee de son obtention.
    const bac = fs.mkdtempSync(path.join(os.tmpdir(), 'alcora-enorme-'));
    const e4 = new Extraits({ dossier: bac, client: () => null, journal });
    const p = e4.chemin('z-1-0');
    const fd = fs.openSync(p, 'w');
    const bloc = Buffer.alloc(1024 * 1024);
    for (let k = 0; k < 450; k++) fs.writeSync(fd, bloc);
    fs.closeSync(fd);
    e4.balayer();
    checkBool('l\'extrait le plus recent survit meme au-dela du budget', fs.existsSync(p));
    fs.rmSync(bac, { recursive: true, force: true });
  }

  fs.rmSync(dossier, { recursive: true, force: true });

  console.log('\n' + (echecs === 0 ? 'TOUS LES TESTS PASSENT' : `${echecs} VERIFICATION(S) EN ECHEC`));
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
