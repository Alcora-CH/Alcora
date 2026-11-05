'use strict';

/*
 * La VRAIE interface (serveur de developpement, cameras fictives) et de vrais flux WebRTC (relais
 * de test, mires), dans le meme Electron que l'application. Mesure ce qui se voit : le temps avant
 * la premiere image, et combien de temps « Connexion… » reste a l'ecran. Les valeurs saisies dans
 * le formulaire sont fictives : le pont de demonstration simule la connexion.
 */

const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const SORTIE = process.env.BANC_SORTIE;
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
app.setPath('userData', path.join(SORTIE, 'profil-tuile'));

const JOURNAL = path.join(SORTIE, 'resultat.txt');
fs.writeFileSync(JOURNAL, '');
const noter = (m) => fs.appendFileSync(JOURNAL, `${new Date().toISOString().slice(11, 23)} ${m}\n`);
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

const ENREGISTREUR = `
  window.__banc = { visibleMs: 0, dernier: performance.now() };
  (function boucle() {
    const b = window.__banc, n = performance.now();
    const vus = [...document.querySelectorAll('p')].filter((p) => p.textContent === 'Connexion…');
    if (vus.some((p) => parseFloat(getComputedStyle(p.closest('.m-surgit') || p).opacity) > 0.05)) b.visibleMs += n - b.dernier;
    b.dernier = n;
    requestAnimationFrame(boucle);
  })();
  const fermer = RTCPeerConnection.prototype.close;
  RTCPeerConnection.prototype.close = function () { console.log('[banc] pc.close'); return fermer.call(this); };
  0`;

app.on('child-process-gone', (_e, d) => noter(`[main] child gone ${d.type} ${d.reason}`));

app.whenReady().then(async () => {
  noter(`[main] Electron ${process.versions.electron}`);
  const w = new BrowserWindow({
    width: 1400, height: 800, x: -30000, y: -30000, show: false, frame: false, skipTaskbar: true,
    webPreferences: { backgroundThrottling: false },
  });
  const lignes = [];
  w.webContents.on('console-message', (e) => {
    if (/\[tuile|\[banc\]|connected in|Uncaught/.test(e.message)) {
      lignes.push(e.message);
      noter(`[page] ${e.message.slice(0, 180)}`);
    }
  });
  const js = (code) => w.webContents.executeJavaScript(code, true);
  const cliquer = (texte, dans = 'document') => js(`(() => {
    const b = [...${dans}.querySelectorAll('button,a,[role=button]')].find((x) => x.textContent.trim().startsWith(${JSON.stringify(texte)}) && !x.disabled);
    if (b) b.click();
    return Boolean(b);
  })()`);
  const attendre = async (condition, ms, quoi) => {
    const fin = Date.now() + ms;
    while (Date.now() < fin) {
      if (await condition()) return true;
      await dormir(200);
    }
    noter(`[main] DELAI DEPASSE : ${quoi}`);
    return false;
  };
  const photo = async (nom) => fs.writeFileSync(path.join(SORTIE, `${nom}.png`), (await w.webContents.capturePage()).toPNG());
  const tuiles = () => js(`[...document.querySelectorAll('[data-id]')].map((t) => t.dataset.id + ': ' + t.innerText.replace(/\\s+/g, ' ').slice(0, 60)).join(' | ')`);
  const phase = async (nom, geste, attente = 3000) => {
    await js('window.__banc.visibleMs = 0; 0');
    const depart = lignes.length;
    noter(`[main] --- ${nom}`);
    await geste();
    await dormir(attente);
    const visible = await js('Math.round(window.__banc.visibleMs)');
    const images = lignes.slice(depart).filter((l) => l.includes('first frame painted'))
      .map((l) => l.replace(/^\[tuile ([^\]]+)\] first frame painted in /, '$1 ')).join(' ; ');
    noter(`[main] RESULTAT ${nom} : mot visible ${visible} ms ; images : ${images || 'aucune'} ; fermetures : ${lignes.slice(depart).filter((l) => l.includes('pc.close')).length}`);
  };

  await w.loadURL('http://localhost:5180/');
  w.showInactive();
  await js(ENREGISTREUR);

  await attendre(() => js("Boolean(document.getElementById('setup-hote'))"), 15000, 'formulaire');
  await js(`(() => {
    const poser = (id, v) => { const e = document.getElementById(id); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(e, v); e.dispatchEvent(new Event('input', { bubbles: true })); };
    poser('setup-hote', '192.0.2.10'); poser('setup-identifiant', 'demo'); poser('setup-mdp', 'demo-demo');
  })()`);
  await dormir(300);
  await cliquer('Tester');
  await attendre(() => js("[...document.querySelectorAll('button')].some((b) => b.textContent.trim().startsWith('Enregistrer') && !b.disabled)"), 25000, 'test de connexion');
  await cliquer('Enregistrer');
  await attendre(() => js("document.querySelectorAll('[data-id]').length >= 2"), 25000, 'tuiles');

  await js('window.__banc.visibleMs = 0; 0');
  noter('[main] --- premiere ouverture');
  await attendre(() => lignes.filter((l) => l.includes('first frame painted')).length >= 2, 25000, 'premieres images');
  noter(`[main] RESULTAT premiere ouverture : mot visible ${await js('Math.round(window.__banc.visibleMs)')} ms`);
  await dormir(3000);
  noter(`[main] tuiles : ${await tuiles()}`);

  const rail = "document.querySelector('nav')";
  await phase('quitter le direct', () => cliquer('Détections', rail), 5000);
  await phase('retour au direct apres 5 s', () => cliquer('Direct', rail));
  noter(`[main] tuiles : ${await tuiles()}`);
  await phase('quitter le direct, longue visite', () => cliquer('Réglages', rail), 25000);
  await phase('retour au direct apres 25 s', () => cliquer('Direct', rail));
  noter(`[main] tuiles : ${await tuiles()}`);

  const ids = await js("[...document.querySelectorAll('[data-id]')].map((t) => t.dataset.id)");
  const doubleClic = (id) => js(`document.querySelector('[data-id=${JSON.stringify(id)}]').dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); 0`);
  await phase('isoler une camera', async () => {
    await doubleClic(ids[0]);
    await dormir(1800);
    await photo('changement-de-canal');
  }, 8000);
  noter(`[main] tuiles : ${await tuiles()}`);
  await phase('retour a la mosaique', () => doubleClic(ids[0]));
  noter(`[main] tuiles : ${await tuiles()}`);
  noter(`[main] toiles figees (opacite/largeur) : ${await js("[...document.querySelectorAll('canvas[aria-hidden]')].map((c) => getComputedStyle(c).opacity + '/' + c.width).join(' ')")}`);

  const basculerG6 = async () => {
    await cliquer('Caméras');
    await dormir(400);
    await js("(() => { const b = [...document.querySelectorAll('button,[role=menuitemcheckbox],label')].find((x) => x.textContent.includes('G6 Bullet') && !x.closest('[data-id]')); if (b) b.click(); return Boolean(b); })()");
    await dormir(400);
    await cliquer('Caméras');
  };
  await phase('masquer une camera', basculerG6, 1500);
  noter(`[main] tuiles : ${await tuiles()}`);
  await phase('demasquer', basculerG6, 7000);
  noter(`[main] tuiles : ${await tuiles()}`);

  // Dans ce banc, personne ne relance la page (le pont de demonstration refuse) : on doit voir la
  // tuile nommer la cause, et le journal dire ou ca coince.
  const gpu = app.getAppMetrics().find((m) => m.type === 'GPU');
  noter(`[main] >>> GPU abattu, pid ${gpu?.pid}`);
  process.kill(gpu.pid);
  const nomme = await attendre(() => js("document.body.innerText.includes('H.265 illisible')"), 70000, 'H.265 illisible');
  noter(`[main] RESULTAT panne : « H.265 illisible » ${nomme ? 'affiche' : 'ABSENT'}`);
  noter(`[main] tuiles : ${await tuiles()}`);
  await photo('panne');

  noter('[main] fin');
  app.quit();
});
