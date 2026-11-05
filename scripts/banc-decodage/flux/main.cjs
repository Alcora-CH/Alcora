'use strict';

/* Le mecanisme seul, sans l'interface : deux flux WHEP et le processus GPU qu'on abat. */

const { app, BrowserWindow, protocol, net } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

// La meme origine que l'application : le relais refuse les autres (403).
protocol.registerSchemesAsPrivileged([{
  scheme: 'app',
  privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true },
}]);

const scenario = process.argv[process.argv.length - 1];
const SORTIE = process.env.BANC_SORTIE;
// Hors de tout ecran : sans cela, Chromium tient la fenetre pour cachee et ne peint plus rien.
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
app.setPath('userData', path.join(SORTIE, 'profil-flux'));

const JOURNAL = path.join(SORTIE, 'resultat.txt');
fs.writeFileSync(JOURNAL, '');
const noter = (m) => fs.appendFileSync(JOURNAL, `${new Date().toISOString().slice(11, 23)} ${m}\n`);
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const abattreLeGpu = () => {
  const gpu = app.getAppMetrics().find((m) => m.type === 'GPU');
  noter(`[main] >>> GPU abattu, pid ${gpu?.pid}`);
  process.kill(gpu.pid);
};

app.on('child-process-gone', (_e, d) => noter(`[main] child gone ${d.type} ${d.reason}`));

app.whenReady().then(async () => {
  noter(`[main] Electron ${process.versions.electron}, Chromium ${process.versions.chrome}, scenario ${scenario}`);
  protocol.handle('app', (req) => net.fetch(pathToFileURL(path.join(__dirname, new URL(req.url).pathname)).toString()));
  const w = new BrowserWindow({
    width: 640, height: 200, x: -30000, y: -30000, show: false, frame: false, skipTaskbar: true,
    webPreferences: { backgroundThrottling: false },
  });
  w.webContents.on('console-message', (e) => noter(`[page] ${e.message}`));
  await w.loadURL(`app://viewer/page.html?s=${scenario}`);
  w.showInactive();

  if (scenario === 'gpu') {
    await dormir(18_000);
    abattreLeGpu();
    await dormir(45_000);
    noter('[main] >>> page rechargee');
    w.webContents.reload();
    await dormir(30_000);
  } else if (scenario === 'abattage') {
    w.webContents.on('render-process-gone', (_e, d) => {
      noter(`[main] renderer gone: ${d.reason}, on recharge`);
      w.webContents.reload();
    });
    await dormir(12_000);
    abattreLeGpu();
    await dormir(5_000);
    noter('[main] >>> page abattue');
    w.webContents.forcefullyCrashRenderer();
    await dormir(25_000);
  } else {
    await dormir(60_000);
  }
  noter('[main] fin');
  app.quit();
});
