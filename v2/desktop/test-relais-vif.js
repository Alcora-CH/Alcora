'use strict';

/**
 * Le relais, EN VRAI : le binaire epingle, lance avec notre configuration, attaque comme le
 * ferait une page web etrangere ou un autre appareil du reseau.
 *
 *   node test-relais-vif.js
 *
 * test-relais-config.js prouve ce que nous ECRIVONS ; seul ce test prouve ce que MediaMTX
 * en FAIT. L'audit du 22.10.2026 l'a montre : la configuration ne disait rien de MoQ, et le
 * binaire l'ecoutait pourtant sur toutes les interfaces. Aucune camera n'est necessaire —
 * le chemin publie pointe vers une source inexistante, et ce sont les reponses du relais,
 * pas les images, que l'on eprouve.
 *
 * Windows seulement pour l'inventaire des ports (Get-NetTCPConnection). Si le binaire
 * manque — il vit hors depot, dans v2/relay —, le test le DIT et echoue : un garde-fou qui
 * saute en silence est exactement un angle mort.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { RelaySupervisor } = require('./relay');

let failures = 0;
function checkBool(label, condition) {
  if (!condition) failures++;
  console.log(`${condition ? '  OK  ' : ' ECHEC'}  ${label}`);
}
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

const BINAIRE = path.resolve(__dirname, '..', 'relay', process.platform === 'win32' ? 'mediamtx.exe' : 'mediamtx-linux-x64');
const CHEMIN = 'essai_fictif';
const ORIGINE = 'app://viewer';
const ETRANGERE = 'https://site-etranger.example';
// Une offre SDP minimale mais invalide : on ne veut pas de session, seulement la reponse
// du relais. 400 dit « authentifie, mais requete mal formee » ; 401 dit « refuse ».
const SDP = 'v=0\r\n';

function ecoutes(pid) {
  if (process.platform !== 'win32') return null;
  const ps = [
    `Get-NetTCPConnection -OwningProcess ${pid} -State Listen -EA SilentlyContinue | ForEach-Object { 'TCP ' + $_.LocalAddress + ' ' + $_.LocalPort }`,
    `Get-NetUDPEndpoint -OwningProcess ${pid} -EA SilentlyContinue | ForEach-Object { 'UDP ' + $_.LocalAddress + ' ' + $_.LocalPort }`,
  ].join('; ');
  return execFileSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8' })
    .split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    .map((l) => { const [proto, adresse, port] = l.split(' '); return { proto, adresse, port: Number(port) }; });
}

async function requete(url, { methode = 'POST', origine, autorisation, corps } = {}) {
  const headers = { 'Content-Type': 'application/sdp' };
  if (origine) headers.Origin = origine;
  if (autorisation) headers.Authorization = autorisation;
  try {
    const options = { method: methode, headers };
    if (methode === 'POST') options.body = corps ?? SDP;
    const r = await fetch(url, options);
    return { statut: r.status, origineAdmise: r.headers.get('access-control-allow-origin') };
  } catch (e) {
    return { statut: 0, erreur: e.cause?.code ?? e.message };
  }
}

(async () => {
  console.log(`=== Le binaire : ${BINAIRE} ===`);
  if (!fs.existsSync(BINAIRE)) {
    checkBool('le binaire du relais est present (v2/relay, hors depot)', false);
    console.log(`\n${failures} TEST(S) EN ECHEC`);
    process.exit(1);
  }
  const version = execFileSync(BINAIRE, ['--version'], { encoding: 'utf8' }).trim();
  const { VERSION_RELAIS, autorisation } = require('./relais-config');
  checkBool(`le binaire est en ${VERSION_RELAIS} (lu : ${version})`, version === VERSION_RELAIS);

  console.log('\n=== La sonde de port voit ce que le relais verra ===');
  {
    // Un autre programme tient deja un port UDP en double pile, comme le ferait une seconde
    // copie d'Alcora. La sonde doit le declarer pris, sinon le relais redemarre en boucle.
    const dgram = require('node:dgram');
    const occupant = dgram.createSocket({ type: 'udp6', ipv6Only: false });
    const port = await new Promise((r) => occupant.bind(0, '::', () => r(occupant.address().port)));
    const trouve = await RelaySupervisor.freePort(port, { udp: true, adresse: '0.0.0.0' });
    checkBool(`port ${port} tenu en double pile : la sonde passe au suivant (${trouve})`, trouve !== port);
    occupant.close();
  }

  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'alcora-relais-vif-'));
  const sup = new RelaySupervisor({ binary: BINAIRE, dataDir: dossier, origines: [ORIGINE] });
  try {
    await sup.start([{ path: CHEMIN, url: 'rtsp://127.0.0.1:9/inexistant' }]);
    let pret = false;
    for (let i = 0; i < 40 && !pret; i++) {
      await dormir(250);
      pret = (await requete(`${sup.webrtcBase}/${CHEMIN}/whep`, { methode: 'OPTIONS', origine: ORIGINE })).statut > 0;
    }
    checkBool('le relais demarre et repond', pret);
    const whep = `${sup.webrtcBase}/${CHEMIN}/whep`;
    const bon = autorisation(sup.identifiant);

    console.log('\n=== Ce qui ecoute vraiment ===');
    // Un relais mort entre-temps (port deja pris, configuration refusee) ne doit pas faire
    // PLANTER l'inventaire : une premiere reinjection a ainsi passe pour detectee alors que
    // le test s'etait simplement effondre (22.10.2026).
    checkBool('le relais est toujours vivant au moment de l inventaire', Boolean(sup.child));
    const e = sup.child ? ecoutes(sup.child.pid) : [];
    if (e) {
      for (const x of e) console.log(`         ${x.proto} ${x.adresse}:${x.port}`);
      const autorise = (x) => x.adresse === '127.0.0.1'
        || (x.proto === 'UDP' && x.port === sup.ports.ice);
      checkBool('rien n ecoute ailleurs qu en boucle locale, sauf le chemin ICE en UDP', e.every(autorise));
      for (const port of [8892, 8893, 9997, 8554, 1935, 8888, 8890, 9996]) {
        checkBool(`aucun serveur sur ${port} (MoQ, API, RTSP, RTMP, HLS, SRT, relecture)`, !e.some((x) => x.port === port));
      }
      checkBool('le port de l API reserve n ecoute pas', !e.some((x) => x.port === sup.ports.api));
    }

    console.log('\n=== Une page etrangere ===');
    const pre = await requete(whep, { methode: 'OPTIONS', origine: ETRANGERE });
    checkBool(`le pre-vol CORS ne lui accorde rien (Allow-Origin : ${pre.origineAdmise ?? 'absent'})`,
      pre.origineAdmise !== '*' && pre.origineAdmise !== ETRANGERE);
    /*
     * Le formulaire piege : une requete « simple » (text/plain), que le navigateur envoie
     * SANS pre-vol — c'est le chemin de l'avis critique GHSA-w334. Elle doit etre refusee.
     *
     * On ne teste PAS une page etrangere munie du mot de passe : elle ne peut pas l'avoir,
     * et un POST en application/sdp ne part de toute facon pas sans pre-vol accorde. Un
     * programme local, lui, forge l'en-tete Origin a volonte : contre lui, c'est le mot de
     * passe qui protege, pas l'origine. (Premiere version de ce test, 22.10.2026 : elle
     * exigeait ce refus, et se trompait de menace.)
     */
    const formulaire = await fetch(whep, {
      method: 'POST', headers: { Origin: ETRANGERE, 'Content-Type': 'text/plain' }, body: SDP,
    }).then((r) => r.status, () => 0);
    // 400 et non 401, mesure le 22.10.2026 : un formulaire ne peut pas envoyer le type
    // application/sdp qu'exige WHEP, et le relais l'ecarte avant meme le mot de passe. Ce
    // qui compte est qu'AUCUNE session ne s'ouvre — un 2xx serait la faille.
    checkBool(`le formulaire piege, sans pre-vol, n ouvre aucune session (${formulaire})`,
      formulaire >= 400 && formulaire < 500);
    const api = await requete(`http://127.0.0.1:${sup.ports.api}/v3/paths/list`, { methode: 'GET', origine: ETRANGERE });
    checkBool(`l API n existe pas (${api.statut || api.erreur})`, api.statut === 0);

    console.log('\n=== Un programme local sans le mot de passe ===');
    const anonyme = await requete(whep, { origine: ORIGINE });
    checkBool(`sans en-tete : refuse (${anonyme.statut})`, anonyme.statut === 401);
    const faux = await requete(whep, { origine: ORIGINE, autorisation: autorisation({ utilisateur: 'alcora', motDePasse: 'devine' }) });
    checkBool(`mauvais mot de passe : refuse (${faux.statut})`, faux.statut === 401);
    const anyUser = await requete(whep, { origine: ORIGINE, autorisation: autorisation({ utilisateur: 'any', motDePasse: '' }) });
    checkBool(`l ancien utilisateur « any » : refuse (${anyUser.statut})`, anyUser.statut === 401);

    console.log('\n=== Alcora, elle, passe ===');
    const ok = await requete(whep, { origine: ORIGINE, autorisation: bon });
    checkBool(`bonne origine et bon mot de passe : authentifie (${ok.statut}, l offre vide est ensuite rejetee)`,
      ok.statut !== 401 && ok.statut !== 403 && ok.statut !== 0);
    const preOk = await requete(whep, { methode: 'OPTIONS', origine: ORIGINE });
    checkBool(`le pre-vol accorde l origine d Alcora (${preOk.origineAdmise})`, preOk.origineAdmise === ORIGINE);
  } finally {
    await sup.stop({ definitif: true });
    fs.rmSync(dossier, { recursive: true, force: true });
  }

  console.log('\n' + (failures === 0 ? 'TOUS LES TESTS PASSENT' : `${failures} TEST(S) EN ECHEC`));
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
