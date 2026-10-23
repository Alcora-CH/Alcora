'use strict';

/**
 * L'historique des alertes (historique-alertes.js), et ce que le veilleur y inscrit.
 *
 *   node test-historique-alertes.js
 *
 * Ajoute le 23.10.2026 avec la fonction. Ce qui est garde : chaque bulle partie laisse une
 * ligne, chaque alerte tue par la retenue se compte sur la bonne, la fin d'une detection
 * complete sa ligne, 90 jours et pas un de plus, les « non vues » comptent juste, un fichier
 * abime ne bloque rien et n'est pas ecrase en silence, l'ecriture ne laisse jamais un
 * fichier tronque. Aucun Electron ici : la bulle est fabriquee.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { HistoriqueAlertes, GARDE_MS, MAX_ENTREES } = require('./historique-alertes');
const { Veilleur } = require('./veilleur');

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

const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'alcora-alertes-'));
const fichier = path.join(dossier, 'alertes.json');
const journal = { info() {}, alerte() {}, erreur() {} };
const JOUR = 86_400_000;
let maintenant = Date.UTC(2026, 9, 23, 21, 0, 0);
const horloge = () => maintenant;
const nouveau = (extra = {}) => new HistoriqueAlertes({ fichier, journal, horloge, delaiEcriture: 5, ...extra });
const det = (id, extra = {}) => ({ id, type: 'smartDetectZone', camera: 'cam1', debut: maintenant - 2000, fin: null,
  sujets: ['person'], score: 82, commence: true, ...extra });
const veille = { id: 'v1', nom: 'Une personne est détectée' };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  console.log('=== Une bulle partie laisse une ligne ===');
  {
    fs.rmSync(fichier, { force: true });
    const changes = [];
    const h = nouveau({ onChange: (e) => changes.push(e) });
    h.ajouter({ detection: det('e1'), cameraNom: 'Allée', veille, sujet: 'person', image: true, son: true });
    const [e] = h.liste();
    check('ce qui est garde', { id: 'e1', camera: 'Allée', veille: 'Une personne est détectée', sujet: 'person', image: true, son: true, retenues: 0 },
      { id: e.detection.id, camera: e.cameraNom, veille: e.veilleNom, sujet: e.sujet, image: e.image, son: e.son, retenues: e.retenues });
    check('la page est prevenue, avec le compte des non vues', [{ nonVues: 1 }], changes);
    await attendre(30);
    const relu = nouveau();
    check('ecrite sur le disque, relue a l ouverture', ['e1'], relu.liste().map((x) => x.detection.id));
    check('aucun fichier provisoire ne traine', ['alertes.json'], fs.readdirSync(dossier));
  }

  console.log('\n=== La retenue se compte sur la bonne ligne ===');
  {
    fs.rmSync(fichier, { force: true });
    const h = nouveau();
    // Une ancienne bulle de la meme veille, et une du meme sujet sous une autre veille : la
    // retenue doit viser la DERNIERE bulle de CETTE veille pour CE sujet, aucune autre.
    h.ajouter({ detection: det('a0'), cameraNom: 'Allée', veille, sujet: 'person', image: true, son: true });
    h.ajouter({ detection: det('c'), cameraNom: 'Allée', veille, sujet: 'animal', image: true, son: true });
    h.ajouter({ detection: det('a'), cameraNom: 'Allée', veille, sujet: 'person', image: true, son: true });
    h.ajouter({ detection: det('b'), cameraNom: 'Allée', veille: { id: 'v2', nom: 'Véhicules' }, sujet: 'vehicle', image: true, son: true });
    h.retenir({ veilleId: 'v1', sujet: 'person' });
    h.retenir({ veilleId: 'v1', sujet: 'person' });
    h.retenir({ veilleId: 'v2', sujet: 'vehicle' });
    check('deux sur la derniere personne, une sur le vehicule, rien ailleurs', [['a', 2], ['a0', 0], ['b', 1], ['c', 0]],
      h.liste().map((x) => [x.detection.id, x.retenues]).sort());
    check('une retenue sans bulle anterieure ne s accroche a rien', false, h.retenir({ veilleId: 'v9', sujet: 'person' }));
  }

  console.log('\n=== La fin d une detection complete sa ligne ===');
  {
    fs.rmSync(fichier, { force: true });
    const h = nouveau();
    h.ajouter({ detection: det('f1'), cameraNom: 'Allée', veille, sujet: 'person', image: true, son: true });
    h.terminer({ id: 'f1', fin: maintenant + 15_000 });
    h.terminer({ id: 'inconnue', fin: maintenant });
    check('la fin est posee', maintenant + 15_000, h.liste()[0].detection.fin);
  }

  console.log('\n=== 90 jours, et pas un de plus ===');
  {
    fs.rmSync(fichier, { force: true });
    const h = nouveau();
    h.ajouter({ detection: det('vieille'), cameraNom: 'Allée', veille, sujet: 'person', image: false, son: true });
    maintenant += GARDE_MS - JOUR;
    h.ajouter({ detection: det('recente'), cameraNom: 'Allée', veille, sujet: 'person', image: false, son: true });
    check('a 89 jours, les deux restent', 2, h.liste().length);
    maintenant += 2 * JOUR;
    h.ajouter({ detection: det('neuve'), cameraNom: 'Allée', veille, sujet: 'person', image: false, son: true });
    check('a 91 jours, la plus ancienne part', ['neuve', 'recente'], h.liste().map((x) => x.detection.id));
    h.ecrire();
    maintenant += 89 * JOUR;
    check('et a la relecture aussi', ['neuve'], nouveau().liste().map((x) => x.detection.id));
  }

  console.log('\n=== Les non vues ===');
  {
    fs.rmSync(fichier, { force: true });
    const h = nouveau();
    h.ajouter({ detection: det('n1'), cameraNom: 'Allée', veille, sujet: 'person', image: true, son: true });
    maintenant += 1000;
    h.ajouter({ detection: det('n2'), cameraNom: 'Allée', veille, sujet: 'person', image: true, son: true });
    check('deux non vues', 2, h.nonVues());
    maintenant += 1000;
    h.marquerVu();
    check('la visite les efface', 0, h.nonVues());
    maintenant += 1000;
    h.ajouter({ detection: det('n3'), cameraNom: 'Allée', veille, sujet: 'person', image: true, son: true });
    h.ecrire();
    check('une de plus apres la visite, et le compte survit a la relecture', [1, 1], [h.nonVues(), nouveau().nonVues()]);
  }

  console.log('\n=== Effacer ===');
  {
    const h = nouveau();
    h.effacer();
    h.ecrire();
    check('vide, sur le disque aussi', [0, 0], [h.liste().length, nouveau().liste().length]);
  }

  console.log('\n=== Un fichier abime ne bloque rien ===');
  {
    fs.writeFileSync(fichier, '{ pas du json');
    const h = nouveau();
    check('l historique repart vide', 0, h.liste().length);
    check('le fichier abime est mis de cote, pas ecrase', true, fs.existsSync(`${fichier}.illisible`));
    h.ajouter({ detection: det('apres'), cameraNom: 'Allée', veille, sujet: 'person', image: true, son: true });
    check('et les alertes suivantes s inscrivent', 1, h.liste().length);
    fs.rmSync(`${fichier}.illisible`, { force: true });
    fs.writeFileSync(fichier, JSON.stringify({ vu: 0, entrees: [{ envoye: 'hier' }, null, { envoye: maintenant, detection: { id: 'ok' } }] }));
    check('une entree invalide est ecartee, pas la suivante', ['ok'], nouveau().liste().map((x) => x.detection.id));
  }

  console.log('\n=== Le plafond ===');
  {
    fs.rmSync(fichier, { force: true });
    const h = nouveau();
    for (let i = 0; i < MAX_ENTREES + 3; i++) {
      h.ajouter({ detection: det(`p${i}`), cameraNom: 'Allée', veille, sujet: 'person', image: false, son: true });
    }
    check('jamais plus que le plafond, les plus anciennes partent', [MAX_ENTREES, 'p3'],
      [h.liste().length, h.liste()[h.liste().length - 1].detection.id]);
  }

  console.log('\n=== Ce que le veilleur y inscrit ===');
  {
    fs.rmSync(fichier, { force: true });
    const h = nouveau();
    const montrees = [];
    class Bulle {
      static isSupported() { return true; }
      constructor(o) { this.o = o; }
      on() {}
      show() { montrees.push(this.o.title); }
    }
    const config = { armee: false, veilles: [{ id: 'v1', nom: 'Une personne est détectée', actif: true, quand: 'toujours',
      sujets: ['person'], cameras: [], son: false, retenueMs: 300_000 }] };
    const v = new Veilleur({ config: () => config, client: () => null, nomCamera: () => 'Allée', dossier,
      journal, historique: h, Bulle });
    await v.recevoir(det('w1'));
    await v.recevoir(det('w2'));
    await v.recevoir(det('w3'));
    await v.recevoir({ ...det('w1'), commence: false, fin: maintenant + 20_000 });
    const [e] = h.liste();
    check('une seule bulle montree, une seule ligne', [1, 1], [montrees.length, h.liste().length]);
    check('les deux suivantes, tues par la retenue, sont comptees', 2, e.retenues);
    check('la veille est nommee, le son dit coupe, l image dite absente', ['Une personne est détectée', false, false],
      [e.veilleNom, e.son, e.image]);
    check('la fin de la detection est arrivee jusqu a la ligne', maintenant + 20_000, e.detection.fin);
    await v.recevoir(det('m1', { sujets: [], type: 'motion' }));
    check('une detection qu aucune veille ne guette : rien', 1, h.liste().length);
  }

  fs.rmSync(dossier, { recursive: true, force: true });
  console.log('\n' + (echecs === 0 ? 'TOUS LES TESTS PASSENT' : `${echecs} TEST(S) EN ECHEC`));
  process.exit(echecs === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
