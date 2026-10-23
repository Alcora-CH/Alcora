'use strict';

/**
 * L'export d'une plage de la relecture (export-plage.js).
 *
 *   node test-export-plage.js
 *
 * Ajoute le 23.10.2026 avec la fonction. Ce qui est garde ici, ce sont les promesses faites
 * a l'utilisateur et au controleur : une heure au plus par demande et jamais deux a la
 * fois, jamais un fichier tronque sous le nom choisi, une heure vide sautee sans condamner
 * les autres, la place verifiee avant le premier octet, un seul export a la fois. Aucun
 * controleur ici : les reponses sont fabriquees.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');
const { ExportPlage, ErreurExport, decouper, nomPropre, nomParDefaut, nomTranche, HEURE_MS } = require('./export-plage');
const i18n = require('./i18n');

let echecs = 0;
function check(label, attendu, obtenu) {
  const ok = JSON.stringify(attendu) === JSON.stringify(obtenu);
  if (!ok) echecs++;
  console.log(`${ok ? '  OK  ' : ' ECHEC'}  ${label}`);
  if (!ok) {
    console.log(`          attendu = ${JSON.stringify(attendu)}`);
    console.log(`          obtenu  = ${JSON.stringify(obtenu)}`);
  }
}

const H = HEURE_MS;
const T0 = Date.UTC(2026, 9, 23, 19, 40, 0);
const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'alcora-export-'));
const journal = { info() {}, erreur() {}, alerte() {} };
const gabarit = (base, i, n) => `${base} (${i} sur ${n})`;

/** Un corps de reponse : des morceaux, puis une fin — ou une panne apres quelques uns. */
function corps(morceaux, { panne = null, attente = 0, avant = null } = {}) {
  let i = 0;
  return new Readable({
    read() {
      setTimeout(() => {
        if (avant) avant(i);
        if (i < morceaux.length) return this.push(Buffer.from(morceaux[i++]));
        if (panne) return this.destroy(panne);
        this.push(null);
      }, attente);
    },
  });
}

/** Un controleur fabrique : il note chaque demande et combien sont en vol a la fois. */
function controleur(reponse) {
  const c = { demandes: [], enVol: 0, maxEnVol: 0 };
  c.ouvrir = async (p) => {
    c.demandes.push({ debut: p.debut, fin: p.fin });
    c.enVol += 1;
    c.maxEnVol = Math.max(c.maxEnVol, c.enVol);
    try {
      await new Promise((r) => setTimeout(r, 5));
      const r = reponse(c.demandes.length - 1, p);
      if (r instanceof Error) throw r;
      r.flux.on('close', () => { c.enVol -= 1; });
      return r;
    } catch (e) {
      c.enVol -= 1;
      throw e;
    }
  };
  return c;
}

function exporteur(c, extra = {}) {
  const etats = [];
  const x = new ExportPlage({ ouvrir: c.ouvrir, journal, onEtat: (e) => etats.push(e), gabaritTranche: gabarit,
    place: async () => null, ...extra });
  return { x, etats, dernier: () => etats[etats.length - 1] };
}

const fichier = (nom) => path.join(dossier, nom);
const restes = () => fs.readdirSync(dossier).sort();
const vider = () => { for (const f of fs.readdirSync(dossier)) fs.rmSync(path.join(dossier, f), { force: true }); };
// Ce que rend ouvrirDepuisClient sur un 404 : une erreur NOMMEE, pas une erreur quelconque.
const vide404 = () => new ErreurExport('vide', 'HTTP 404');

(async () => {
  console.log('=== Une heure au plus par tranche ===');
  check('2 h 10 min : trois tranches, contigues, la derniere courte',
    [[0, H], [H, 2 * H], [2 * H, 2 * H + 600_000]],
    decouper(0, 2 * H + 600_000).map((t) => [t.debut, t.fin]));
  check('exactement une heure : une seule tranche', 1, decouper(0, H).length);
  check('fin avant debut, ou bornes absurdes : rien', [[], [], []],
    [decouper(10, 5), decouper(5, 5), decouper(NaN, 5)]);

  console.log('\n=== Le nom du fichier ===');
  check('les accents restent (« All_e » etait un defaut)', 'Allée 23-52-40', nomPropre('Allée 23-52-40'));
  check('ce que Windows refuse part', 'a_b_c_d_e', nomPropre('a<b>c:d|e'));
  check('ni point ni espace final', 'Garage', nomPropre('Garage. '));
  check('ni caractere de controle', 'a_b_c', nomPropre(`a${String.fromCharCode(1)}b${String.fromCharCode(31)}c`));
  check('un nom reserve de Windows est detourne', 'CON_', nomPropre('con'.toUpperCase()));
  check('rien d utilisable : un nom quand meme', 'Alcora', nomPropre('  '));
  {
    // Heures locales, construites en local : le test tient sous n'importe quel fuseau.
    const a = new Date(2026, 9, 23, 23, 52, 40).getTime();
    i18n.definirLangue('fr');
    check('le nom propose : camera, jour, heures locales', 'Allée 2026-10-23 de 23-52-40 à 23-56-10',
      nomParDefaut('Allée', a, a + 210_000, i18n.t));
    check('une plage qui passe minuit nomme ses deux jours', 'Allée 2026-10-23 23-52-40 à 2026-10-24 00-06-10',
      nomParDefaut('Allée', a, a + 13.5 * 60_000, i18n.t));
    i18n.definirLangue('en');
    check('dans la langue du moment', 'Allée 2026-10-23 from 23-52-40 to 23-56-10',
      nomParDefaut('Allée', a, a + 210_000, i18n.t));
    check('une camera au nom hostile reste un nom de fichier', 'a_b 2026-10-23 from 23-52-40 to 23-56-10',
      nomParDefaut('a/b', a, a + 210_000, i18n.t));
    i18n.definirLangue('fr');
  }
  check('une tranche seule garde le nom choisi', fichier('a.mp4'), nomTranche(fichier('a.mp4'), 1, 1, gabarit));
  check('sinon : « nom (2 sur 3).mp4 », a cote', fichier('a (2 sur 3).mp4'), nomTranche(fichier('a.mp4'), 2, 3, gabarit));

  console.log('\n=== Une plage courte, du premier octet au fichier ===');
  {
    vider();
    let pendant = null;
    // Releve fait AU MOMENT du dernier morceau, pas apres un delai devine : le fichier
    // provisoire est forcement ouvert, deux morceaux y sont deja ecrits.
    const c = controleur(() => ({ total: 9, flux: corps(['abc', 'def', 'ghi'], {
      attente: 5, avant: (i) => { if (i === 2) pendant = restes(); } }) }));
    const { x, dernier } = exporteur(c);
    const r = await x.lancer({ cameraId: 'cam1', camera: 'Allée', debut: T0, fin: T0 + 210_000, fichier: fichier('Allée.mp4') });
    await x.travail;
    check('pendant le transfert, seul le « .part » existe', ['Allée.mp4.part'], pendant);
    check('une seule demande, aux bornes exactes', [{ debut: T0, fin: T0 + 210_000 }], c.demandes);
    check('le fichier porte tous les octets, et le « .part » est parti', ['abcdefghi', ['Allée.mp4']],
      [fs.readFileSync(fichier('Allée.mp4'), 'utf8'), restes()]);
    check('l etat final dit termine, le nom et le poids', { etat: 'termine', fichiers: ['Allée.mp4'], octets: 9 },
      { etat: dernier().etat, fichiers: dernier().fichiers, octets: dernier().octets });
    check('lancer rend les noms qui seront ecrits', ['Allée.mp4'], r.fichiers);
  }

  console.log('\n=== Plus d une heure : des tranches, l une apres l autre ===');
  {
    vider();
    const c = controleur((i) => ({ total: 2, flux: corps([`p${i}`], { attente: 15 }) }));
    const { x, dernier } = exporteur(c);
    await x.lancer({ cameraId: 'cam1', camera: 'Allée', debut: T0, fin: T0 + 2 * H + 600_000, fichier: fichier('nuit.mp4') });
    await x.travail;
    check('jamais deux demandes en vol a la fois', 1, c.maxEnVol);
    check('trois demandes, contigues', [[T0, T0 + H], [T0 + H, T0 + 2 * H], [T0 + 2 * H, T0 + 2 * H + 600_000]],
      c.demandes.map((d) => [d.debut, d.fin]));
    check('trois fichiers, nommes par tranche', ['nuit (1 sur 3).mp4', 'nuit (2 sur 3).mp4', 'nuit (3 sur 3).mp4'], restes());
    check('termine, trois fichiers', ['termine', 3], [dernier().etat, dernier().fichiers.length]);
  }

  console.log('\n=== Une heure vide au milieu : sautee, les autres restent ===');
  {
    vider();
    const c = controleur((i) => (i === 1 ? vide404() : { total: 2, flux: corps([`p${i}`]) }));
    const { x, dernier } = exporteur(c);
    await x.lancer({ cameraId: 'cam1', camera: 'Allée', debut: T0, fin: T0 + 3 * H, fichier: fichier('n.mp4') });
    await x.travail;
    check('deux fichiers ecrits, la tranche vide absente', ['n (1 sur 3).mp4', 'n (3 sur 3).mp4'], restes());
    check('termine, et le saut est dit', ['termine', 1], [dernier().etat, dernier().vides]);
  }

  console.log('\n=== Rien d enregistre ===');
  {
    vider();
    const { x, dernier } = exporteur(controleur(() => vide404()));
    await x.lancer({ cameraId: 'cam1', camera: 'Allée', debut: T0, fin: T0 + 60_000, fichier: fichier('v.mp4') });
    await x.travail;
    check('une plage vide : erreur nommee « vide », aucun fichier', [['erreur', 'vide'], []],
      [[dernier().etat, dernier().raison], restes()]);
    vider();
    const { x: y, dernier: d2 } = exporteur(controleur(() => ({ total: 0, flux: corps([]) })));
    await y.lancer({ cameraId: 'cam1', camera: 'Allée', debut: T0, fin: T0 + 60_000, fichier: fichier('v.mp4') });
    await y.travail;
    check('un corps de zero octet aussi', [['erreur', 'vide'], []], [[d2().etat, d2().raison], restes()]);
    vider();
    const { x: z, dernier: d3 } = exporteur(controleur(() => vide404()));
    await z.lancer({ cameraId: 'cam1', camera: 'Allée', debut: T0, fin: T0 + 2 * H, fichier: fichier('v.mp4') });
    await z.travail;
    check('toutes les heures vides : erreur « vide », pas un faux « termine »', ['erreur', 'vide'], [d3().etat, d3().raison]);
  }

  console.log('\n=== Coupure en cours de route ===');
  {
    vider();
    const c = controleur((i) => (i === 0 ? { total: 2, flux: corps(['ok']) }
      : { total: 9, flux: corps(['abc'], { panne: Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' }) }) }));
    const { x, dernier } = exporteur(c);
    await x.lancer({ cameraId: 'cam1', camera: 'Allée', debut: T0, fin: T0 + 2 * H, fichier: fichier('c.mp4') });
    await x.travail;
    check('erreur « interrompu », sur la tranche 2, une deja faite', { etat: 'erreur', raison: 'interrompu', partie: 2, faits: 1 },
      { etat: dernier().etat, raison: dernier().raison, partie: dernier().partie, faits: dernier().faits });
    check('le partiel est efface, la tranche complete reste', ['c (1 sur 2).mp4'], restes());
  }

  console.log('\n=== Annuler ===');
  {
    vider();
    const c = controleur(() => ({ total: 30, flux: corps(['a', 'b', 'c', 'd', 'e', 'f'], { attente: 20 }) }));
    const { x, dernier } = exporteur(c);
    await x.lancer({ cameraId: 'cam1', camera: 'Allée', debut: T0, fin: T0 + 60_000, fichier: fichier('a.mp4') });
    await new Promise((ok) => setTimeout(ok, 40));
    check('annuler pendant le transfert repond oui', true, x.annuler());
    await x.travail;
    check('etat « annule », rien n est garde', [['annule', 0], []], [[dernier().etat, dernier().faits], restes()]);
    check('plus rien a annuler ensuite', false, x.annuler());
  }

  console.log('\n=== Ce qui se refuse avant le premier octet ===');
  {
    vider();
    const c = controleur(() => ({ total: 2, flux: corps(['ok']) }));
    const { x } = exporteur(c, { place: async () => 500 * 1024 * 1024 });
    const refus = await x.lancer({ cameraId: 'cam1', camera: 'Allée', debut: T0, fin: T0 + 60_000,
      fichier: fichier('p.mp4'), estimation: 740 * 1024 * 1024 }).catch((e) => e.raison);
    check('place insuffisante : refuse, et le controleur n est meme pas sollicite', ['place', 0], [refus, c.demandes.length]);
    const sansEstimation = await x.lancer({ cameraId: 'cam1', camera: 'Allée', debut: T0, fin: T0 + 60_000,
      fichier: fichier('p.mp4') }).then(() => 'parti', (e) => e.raison);
    await x.travail;
    check('sans estimation, on ne refuse pas sur une supposition', 'parti', sansEstimation);

    vider();
    fs.writeFileSync(fichier('q (2 sur 2).mp4'), 'ancien');
    const existe = await x.lancer({ cameraId: 'cam1', camera: 'Allée', debut: T0, fin: T0 + 2 * H, fichier: fichier('q.mp4') })
      .catch((e) => [e.raison, e.fichier]);
    check('une tranche voisine existe deja : refuse, rien n est ecrase', [['existe', 'q (2 sur 2).mp4'], 'ancien'],
      [existe, fs.readFileSync(fichier('q (2 sur 2).mp4'), 'utf8')]);
    vider();
    fs.writeFileSync(fichier('q (1 sur 2).mp4'), 'ancien');
    const premiere = await x.lancer({ cameraId: 'cam1', camera: 'Allée', debut: T0, fin: T0 + 2 * H, fichier: fichier('q.mp4') })
      .catch((e) => e.raison);
    check('la PREMIERE tranche non plus : Windows n a confirme que « q.mp4 »', ['existe', 'ancien'],
      [premiere, fs.readFileSync(fichier('q (1 sur 2).mp4'), 'utf8')]);
    vider();
    fs.writeFileSync(fichier('seul.mp4'), 'ancien');
    const seul = await x.lancer({ cameraId: 'cam1', camera: 'Allée', debut: T0, fin: T0 + 60_000, fichier: fichier('seul.mp4') })
      .then(() => x.travail).then(() => 'parti', (e) => e.raison);
    check('une tranche seule remplace le fichier que Windows a fait confirmer', ['parti', 'ok'],
      [seul, fs.readFileSync(fichier('seul.mp4'), 'utf8')]);

    const bornes = await x.lancer({ cameraId: 'cam1', camera: 'Allée', debut: T0 + 5, fin: T0, fichier: fichier('r.mp4') })
      .catch((e) => e.raison);
    check('une plage vide ou inversee : refusee', 'plage', bornes);
  }

  console.log('\n=== Un seul export a la fois ===');
  {
    vider();
    const c = controleur(() => ({ total: 6, flux: corps(['a', 'b', 'c'], { attente: 20 }) }));
    const { x } = exporteur(c);
    await x.lancer({ cameraId: 'cam1', camera: 'Allée', debut: T0, fin: T0 + 60_000, fichier: fichier('s.mp4') });
    const second = await x.lancer({ cameraId: 'cam2', camera: 'Bureaux', debut: T0, fin: T0 + 60_000, fichier: fichier('t.mp4') })
      .catch((e) => e.raison);
    check('un second export pendant le premier : « occupe »', 'occupe', second);
    await x.travail;
    check('le premier, lui, va au bout', ['s.mp4'], restes());
    check('et une fois fini, la place est libre', false, x.occupe);
  }

  console.log('\n=== Les pannes de fichier ont un nom ===');
  {
    vider();
    const plein = Object.assign(new Error('no space left on device'), { code: 'ENOSPC' });
    const { x, dernier } = exporteur(controleur(() => ({ total: 9, flux: corps(['abc'], { panne: plein }) })));
    await x.lancer({ cameraId: 'cam1', camera: 'Allée', debut: T0, fin: T0 + 60_000, fichier: fichier('d.mp4') });
    await x.travail;
    check('disque plein en cours de route : « place », partiel efface', [['erreur', 'place'], []],
      [[dernier().etat, dernier().raison], restes()]);
  }

  fs.rmSync(dossier, { recursive: true, force: true });
  console.log('\n' + (echecs === 0 ? 'TOUS LES TESTS PASSENT' : `${echecs} TEST(S) EN ECHEC`));
  process.exit(echecs === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
