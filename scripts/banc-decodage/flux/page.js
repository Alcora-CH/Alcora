const BASE = 'http://127.0.0.1:28889';
const scenario = new URLSearchParams(location.search).get('s');
const noter = (m) => console.log(m);
const moment = () => Math.round(performance.now());
noter(`--- page chargee (${scenario})`);

async function ouvrir(nom, video) {
  const pc = new RTCPeerConnection({ iceServers: [] });
  pc.addTransceiver('video', { direction: 'recvonly' });
  pc.addTransceiver('audio', { direction: 'recvonly' });
  const session = { pc, flux: null, lieu: null };
  pc.ontrack = (e) => {
    session.flux = e.streams[0];
    if (video.srcObject !== e.streams[0]) {
      video.srcObject = e.streams[0];
      video.play().catch(() => {});
    }
  };
  await pc.setLocalDescription(await pc.createOffer());
  await new Promise((r) => {
    if (pc.iceGatheringState === 'complete') return r();
    pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') r(); });
    setTimeout(r, 1500);
  });
  const url = `${BASE}/${nom}/whep`;
  const reponse = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/sdp' }, body: pc.localDescription.sdp });
  if (!reponse.ok) throw new Error(`whep ${reponse.status}`);
  const lieu = reponse.headers.get('Location');
  if (lieu) session.lieu = new URL(lieu, url).toString();
  await pc.setRemoteDescription({ type: 'answer', sdp: await reponse.text() });
  session.fermer = () => {
    if (session.lieu) fetch(session.lieu, { method: 'DELETE', keepalive: true }).catch(() => {});
    pc.close();
  };
  return session;
}

async function mesurer(pc) {
  const rapport = await pc.getStats();
  let r = {};
  rapport.forEach((x) => { if (x.type === 'inbound-rtp' && x.kind === 'video') r = x; });
  const type = r.codecId ? rapport.get(r.codecId) : null;
  return {
    decodees: r.framesDecoded ?? -1, recues: r.framesReceived ?? -1, paquets: r.packetsReceived ?? -1,
    codec: type?.mimeType || '?',
  };
}

function tuile(nom) {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.style.width = '100%';
  document.getElementById('z').append(video);
  const t = { nom, session: null };
  let vues = -1;
  let dernier = 0;
  let demarre = false;
  let tic = 0;
  let debut = 0;
  const peinte = (etiquette, depuis) => video.requestVideoFrameCallback(
    () => noter(`${nom} ${etiquette} : premiere image peinte en ${moment() - depuis} ms`));

  t.connecter = async () => {
    debut = moment();
    vues = -1;
    demarre = false;
    dernier = performance.now();
    noter(`${nom} appel`);
    try {
      t.session = await ouvrir(nom, video);
      peinte('session neuve', debut);
    } catch (e) {
      noter(`${nom} echec ${e.message}`);
      setTimeout(t.connecter, 2000);
    }
  };
  t.detacher = () => { video.srcObject = null; };
  t.rattacher = () => {
    const d = moment();
    video.srcObject = t.session.flux;
    video.play().catch(() => {});
    peinte('flux garde, rattache', d);
  };

  setInterval(async () => {
    if (!t.session) return;
    const m = await mesurer(t.session.pc);
    if (++tic % 4 === 0) noter(`${nom} decodees=${m.decodees} recues=${m.recues} paquets=${m.paquets} codec=${m.codec}`);
    if (m.decodees > vues) {
      vues = m.decodees;
      dernier = performance.now();
      if (m.decodees > 0) demarre = true;
      return;
    }
    const immobile = performance.now() - dernier;
    if ((demarre && immobile > 6000) || (!demarre && immobile > 12000)) {
      noter(`${nom} ${demarre ? 'PLUS D IMAGE' : 'AUCUNE IMAGE'} apres ${Math.round(immobile)} ms, decodees=${m.decodees} recues=${m.recues} codec=${m.codec}`);
      const a = t.session;
      t.session = null;
      a.fermer();
      setTimeout(t.connecter, 1000);
    }
  }, 1000);
  return t;
}

(async () => {
  const a = tuile('mire264');
  const b = tuile('mire265');
  await Promise.all([a.connecter(), b.connecter()]);
  if (scenario === 'retour') {
    await new Promise((r) => setTimeout(r, 15000));
    for (const t of [a, b]) { noter(`${t.nom} >>> detache`); t.detacher(); }
    await new Promise((r) => setTimeout(r, 30000));
    for (const t of [a, b]) {
      const m = await mesurer(t.session.pc);
      noter(`${t.nom} pendant la visite : decodees=${m.decodees}`);
    }
    for (const t of [a, b]) { noter(`${t.nom} >>> rattache`); t.rattacher(); }
  }
})();
