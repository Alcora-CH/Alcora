'use strict';

/**
 * La mesure de charge consignee au journal (mesure.js).
 *
 *   node test-mesure.js
 *
 * Ajoutee le 23.10.2026 avec le chantier UX : chaque gain de performance annonce devra etre
 * un avant/apres lu dans ces lignes. Si elles mentent — un role mal compte, des kilo-octets
 * pris pour des mega-octets, un contexte qui deborde sur le suivant —, chaque comparaison
 * mentira avec elles. Aucun Electron ici : les metriques sont fabriquees.
 */

const { Mesure, resumer, normaliser, ligne, role } = require('./mesure');

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

// Des chiffres a l'image de la mesure du 23.10.2026 (Get-Process), en kilo-octets comme
// app.getAppMetrics() les rend.
const POSTE = [
  { type: 'Browser', cpu: { percentCPUUsage: 0.2 }, memory: { privateBytes: 79 * 1024, workingSetSize: 120 * 1024 } },
  { type: 'GPU', cpu: { percentCPUUsage: 28.9 }, memory: { privateBytes: 914 * 1024 } },
  { type: 'Tab', cpu: { percentCPUUsage: 27.8 }, memory: { privateBytes: 147 * 1024 } },
  { type: 'Utility', serviceName: 'network.mojom.NetworkService', cpu: { percentCPUUsage: 1.4 }, memory: { privateBytes: 16 * 1024 } },
  { type: 'Utility', serviceName: 'audio.mojom.AudioService', cpu: { percentCPUUsage: 0.6 }, memory: { privateBytes: 10 * 1024 } },
];

console.log('=== Chaque processus a son role ===');
check('principal, graphique, page', ['main', 'gpu', 'renderer'], POSTE.slice(0, 3).map(role));
check('reseau et son distingues des autres utilitaires', ['network', 'audio'], POSTE.slice(3).map(role));
check('un utilitaire inconnu', 'other', role({ type: 'Utility', serviceName: 'storage.mojom.StorageService' }));

console.log('\n=== Les sommes, et les unites ===');
{
  const r = resumer(POSTE);
  check('processus graphique : 28,9 %, 914 Mo', { cpu: 28.9, mo: 914, n: 1 }, r.gpu);
  check('les octets PRIVES priment sur l ensemble de travail', 79, r.main.mo);
  const deux = resumer([...POSTE, { type: 'Tab', cpu: { percentCPUUsage: 2.2 }, memory: { privateBytes: 53 * 1024 } }]);
  check('deux pages s additionnent', { cpu: 30, mo: 200, n: 2 }, deux.renderer);
  check('sans octets prives (hors Windows) : l ensemble de travail', 50,
    resumer([{ type: 'GPU', cpu: {}, memory: { workingSetSize: 50 * 1024 } }]).gpu.mo);
  check('rien a lire ne fait rien planter', {}, resumer(undefined));
}

console.log('\n=== Le processeur se lit au temps CUMULE, pas au pourcentage d Electron ===');
{
  /*
   * Releve reel du 23.10.2026 sous Electron 45 : une page qui calcule 90 % du temps annonce
   * percentCPUUsage = 2,74 (rapporte aux 32 fils de la machine) pour 4,43 s de processeur
   * en 5 s. Seul le second chiffre dit la verite.
   */
  const page = { type: 'Tab', pid: 7, cpu: { percentCPUUsage: 2.74, cumulativeCPUUsage: 4.43 }, memory: {} };
  check('la page qui calcule pese 88,6 % d un coeur, pas 2,7', '88.6',
    resumer([page], new Map([[7, 0]]), 5000).renderer.cpu.toFixed(1));
  const repos = { type: 'Utility', pid: 9, cpu: { percentCPUUsage: -0.04, cumulativeCPUUsage: 0.061 }, memory: {} };
  check('un pourcentage negatif ne passe pas : au repos, zero', '0.0',
    resumer([repos], new Map([[9, 0.061]]), 5000).other.cpu.toFixed(1));
  const ne = { type: 'Tab', pid: 11, cpu: { cumulativeCPUUsage: 1.5 }, memory: {} };
  check('un processus ne pendant l intervalle : tout son temps lui revient', '15.0',
    resumer([ne], new Map(), 10_000).renderer.cpu.toFixed(1));
  const recycle = { type: 'Tab', pid: 7, cpu: { cumulativeCPUUsage: 0.5 }, memory: {} };
  check('un identifiant redonne a un processus neuf : son temps, pas un negatif', '5.0',
    resumer([recycle], new Map([[7, 2]]), 10_000).renderer.cpu.toFixed(1));

  let t = 0;
  const releves = [
    [{ type: 'Tab', pid: 3, cpu: { cumulativeCPUUsage: 1 }, memory: {} }],
    [{ type: 'Tab', pid: 3, cpu: { cumulativeCPUUsage: 4 }, memory: {} }],
    [{ type: 'Tab', pid: 3, cpu: { cumulativeCPUUsage: 5.5 }, memory: {} }],
  ];
  const lignes = [];
  const m = new Mesure({
    obtenir: () => releves.shift(), etatFenetre: () => ({ visible: true }),
    journal: { info: (_q, l) => lignes.push(l) }, periodeMs: 60 * 60_000, horloge: () => t,
  });
  m.demarrer();
  m.contexte({ espace: 'direct', tuiles: 1 });
  t = 30_000;
  m.consigner();
  check('le compteur compare au releve du depart : 3 s en 30 s = 10 %', true,
    lignes.length === 1 && lignes[0].includes('renderer 10.0%'));
  t = 60_000;
  m.consigner();
  check('puis au releve PRECEDENT, pas a celui du depart : 1,5 s en 30 s = 5 %', true,
    lignes.length === 2 && lignes[1].includes('renderer 5.0%'));
  m.arreter();
}

console.log('\n=== Ce que la page annonce est filtre ===');
check('un contexte complet passe', { espace: 'direct', tuiles: 2, ciel: 'fixe' },
  normaliser({ espace: 'direct', tuiles: 2, ciel: 'fixe', autre: 'jete' }));
check('un ecran inconnu : refuse', null, normaliser({ espace: 'piratage', tuiles: 2 }));
check('un saut de ligne ne fabrique pas de fausse ligne', null, normaliser({ espace: 'direct\n12:00 info fausse' }));
check('des tuiles invraisemblables : tues, l ecran reste', { espace: 'direct', tuiles: null, ciel: null },
  normaliser({ espace: 'direct', tuiles: 1e9, ciel: 'arc-en-ciel' }));
check('pas un objet : refuse', null, normaliser('direct'));

console.log('\n=== La ligne du journal ===');
check('format', 'load over 300 s [screen=direct tiles=2 window=visible sky=fixe]: '
  + 'main 0.2% 79 MB, renderer 27.8% 147 MB, gpu 28.9% 914 MB, network 1.4% 16 MB, audio 0.6% 10 MB '
  + '(CPU in % of one core)',
  ligne(resumer(POSTE), { espace: 'direct', tuiles: 2, ciel: 'fixe' }, { visible: true, focus: true }, 300_000));
check('deux pages : le nombre est dit, en ASCII', true,
  ligne(resumer([POSTE[2], POSTE[2]]), { espace: 'direct' }, { visible: true }, 60_000)
    .includes('renderer x2 55.6% 294 MB'));
check('une fenetre reduite se dit', true,
  ligne({}, { espace: 'direct' }, { visible: true, minimisee: true }, 60_000).includes('window=minimized'));

console.log('\n=== Les intervalles et leurs contextes ===');
{
  let t = 0;
  let appels = 0;
  const lignes = [];
  const m = new Mesure({
    obtenir: () => { appels += 1; return POSTE; },
    etatFenetre: () => ({ visible: true, focus: true }),
    journal: { info: (_q, l) => lignes.push(l) },
    periodeMs: 60 * 60_000,
    horloge: () => t,
  });
  m.demarrer();
  check('le depart amorce le compteur, sans rien ecrire', [1, 0], [appels, lignes.length]);
  m.contexte({ espace: 'direct', tuiles: 2, ciel: 'fixe' });
  t = 45_000;
  m.contexte({ espace: 'reglages', ciel: 'fixe' });
  check('changer d ecran apres 45 s ecrit l intervalle de L ECRAN QUITTE', true,
    lignes.length === 1 && lignes[0].startsWith('load over 45 s [screen=direct tiles=2'));
  t = 50_000;
  m.contexte({ espace: 'direct', tuiles: 2, ciel: 'fixe' });
  check('un passage de 5 s n ecrit rien', 1, lignes.length);
  t = 50_000 + 40_000;
  m.contexte({ espace: 'direct', tuiles: 2, ciel: 'fixe' });
  check('le meme contexte annonce deux fois : rien', 1, lignes.length);
  m.consigner();
  check('la periode ecrit l intervalle courant', true, lignes.length === 2 && lignes[1].startsWith('load over 45 s [screen=direct'));
  check('un contexte refuse ne change rien', false, m.contexte({ espace: 'inconnu' }));
  m.arreter();
}

console.log('\n=== L etat de la fenetre est celui du DEBUT de l intervalle ===');
{
  let t = 0;
  let etat = { visible: true };
  const lignes = [];
  const m = new Mesure({
    obtenir: () => POSTE, etatFenetre: () => etat,
    journal: { info: (_q, l) => lignes.push(l) }, periodeMs: 60 * 60_000, horloge: () => t,
  });
  m.demarrer();
  m.contexte({ espace: 'direct', tuiles: 2 });
  t = 300_000;
  etat = { visible: true, minimisee: true };
  m.fenetreChangee();
  check('cinq minutes de direct visible, puis reduction : la ligne dit visible', true,
    lignes.length === 1 && lignes[0].includes('window=visible'));
  t = 400_000;
  m.consigner();
  check('l intervalle suivant, lui, dit reduite', true, lignes.length === 2 && lignes[1].includes('window=minimized'));
  m.arreter();
}

console.log('\n' + (echecs === 0 ? 'TOUS LES TESTS PASSENT' : `${echecs} TEST(S) EN ECHEC`));
process.exit(echecs === 0 ? 0 : 1);
