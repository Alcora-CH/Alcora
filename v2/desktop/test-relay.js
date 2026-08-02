'use strict';

/**
 * Verification de la supervision du relais, sans Electron.
 *   node test-relay.js
 *
 * Ce qui est verifie : demarrage, flux reellement disponible, choix de ports libres,
 * RELANCE AUTOMATIQUE apres une mort brutale, et arret propre sans session orpheline.
 *
 * Les sources RTSP viennent de l'environnement, jamais du code : un alias RTSP est le
 * seul secret d'un flux sans authentification, et n'a rien a faire dans un depot public.
 *   PV_HOST=192.168.1.1 PV_RTSP=alias1,alias2 node test-relay.js
 */

const path = require('node:path');
const os = require('node:os');
const { execSync } = require('node:child_process');
const { RelaySupervisor } = require('./relay');

const HOST = process.env.PV_HOST;
const ALIAS = (process.env.PV_RTSP ?? '').split(',').map((a) => a.trim()).filter(Boolean);
const RTSP_PORT = process.env.PV_RTSP_PORT ?? '7447';

if (!HOST || ALIAS.length === 0) {
  console.error('Renseigner PV_HOST et PV_RTSP (alias separes par des virgules).');
  console.error('  exemple : PV_HOST=192.168.1.1 PV_RTSP=alias1,alias2 node test-relay.js');
  process.exit(2);
}

const CAMERAS = ALIAS.map((alias, i) => ({
  path: `cam${i + 1}`,
  url: `rtsp://${HOST}:${RTSP_PORT}/${alias}`,
}));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;

function check(label, ok, detail = '') {
  if (!ok) failures++;
  console.log(`${ok ? '  OK  ' : ' ECHEC'}  ${label}${detail ? '  — ' + detail : ''}`);
}

async function api(port, route) {
  const res = await fetch(`http://127.0.0.1:${port}${route}`);
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

(async () => {
  const sup = new RelaySupervisor({
    binary: path.resolve(__dirname, '..', 'relay', 'mediamtx.exe'),
    dataDir: path.join(os.tmpdir(), 'ProtectViewerRelayTest'),
    onState: (s) => console.log(`         etat : ${s.message}`),
  });

  console.log('=== Demarrage ===');
  await sup.start(CAMERAS);
  await sleep(4000);

  check('processus lance', sup.child !== null);
  check('ports attribues', sup.ports !== null,
    sup.ports ? `webrtc ${sup.ports.webrtc}, api ${sup.ports.api}` : '');

  console.log('\n=== Le flux est-il reellement disponible ? ===');
  // On force la mise en route : les chemins sont a la demande.
  try {
    await fetch(`${sup.webrtcBase}/g6/whep`, { method: 'OPTIONS' }).catch(() => {});
    await sleep(3000);
    const list = await api(sup.ports.api, '/v3/paths/list');
    const noms = list.items.map((i) => i.name).join(', ');
    check('les deux cameras sont publiees', list.items.length === 2, noms);
  } catch (e) {
    check('interrogation de l\'API du relais', false, e.message);
  }

  console.log('\n=== Relance automatique apres une mort brutale ===');
  const pidAvant = sup.child.pid;
  console.log(`         on tue le processus ${pidAvant}`);
  try { execSync(`taskkill /PID ${pidAvant} /F`, { stdio: 'ignore' }); } catch { /* deja mort */ }

  await sleep(6000);
  check('un nouveau processus a pris le relais', sup.child !== null && sup.child.pid !== pidAvant,
    sup.child ? `ancien ${pidAvant}, nouveau ${sup.child.pid}` : 'aucun processus');

  await sleep(2500);
  try {
    const list = await api(sup.ports.api, '/v3/paths/list');
    check('le service repond a nouveau', list.items.length === 2);
  } catch (e) {
    check('le service repond a nouveau', false, e.message);
  }

  console.log('\n=== Arret propre ===');
  sup.stop();
  await sleep(2500);
  check('processus termine', sup.child === null);

  const restantes = execSync(
    `powershell -NoProfile -Command "@(Get-NetTCPConnection -RemoteAddress ${HOST} -RemotePort ${RTSP_PORT} -State Established -ErrorAction SilentlyContinue).Count"`
  ).toString().trim();
  check('aucune session laissee sur le controleur', restantes === '0', `${restantes} session(s)`);

  console.log('\n' + (failures === 0 ? 'TOUS LES TESTS PASSENT' : `${failures} TEST(S) EN ECHEC`));
  process.exit(failures === 0 ? 0 : 1);
})();
