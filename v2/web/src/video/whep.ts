/**
 * Client WHEP minimal : negocie un flux WebRTC en lecture seule aupres du relais local.
 *
 * Le relais (mediamtx) tire le RTSP du controleur et le republie en WebRTC sans reencoder.
 * Une seule session RTSP est ouverte vers le controleur quel que soit le nombre de vues —
 * c'est le relais qui regroupe, pas nous.
 */

export interface WhepSession {
  readonly pc: RTCPeerConnection;
  close(): void;
}

/**
 * Borne de la negociation.
 *
 * Un relais qui accepte la connexion TCP mais ne repond jamais laissait la tuile en
 * « Connexion… » pour toujours : sans delai, aucune reprise ne peut etre declenchee,
 * puisque rien n'echoue jamais.
 */
const DELAI_NEGOCIATION_MS = 10_000;

export async function connectWhep(url: string, video: HTMLVideoElement): Promise<WhepSession> {
  const pc = new RTCPeerConnection({ iceServers: [] });
  /** Adresse de la session cote relais, pour la clore proprement (en-tete Location). */
  let ressource: string | null = null;

  /*
   * Tout echec ferme la connexion.
   *
   * Elle n'etait fermee que sur une reponse HTTP non-OK : un fetch qui echoue, un delai
   * depasse ou une description invalide laissaient une RTCPeerConnection vivante, avec ses
   * sockets et son thread de decodage. Chaque reprise en abandonnait une de plus.
   */
  try {
    return await negocier();
  } catch (e) {
    try { pc.close(); } catch { /* deja fermee */ }
    video.srcObject = null;
    throw e;
  }

  async function negocier(): Promise<WhepSession> {

  // Journalise la PROGRESSION de la negociation, pas seulement son echec. Sans cela, une
  // signalisation reussie suivie d'une connexion qui n'aboutit jamais est indiscernable
  // d'un succes : c'est exactement ce qui a masque le probleme pendant des heures.
  const trace = (m: string) => console.log(`[whep] ${url.split('/').slice(-2, -1)[0]} ${m}`);
  pc.oniceconnectionstatechange = () => trace(`ICE ${pc.iceConnectionState}`);
  pc.onconnectionstatechange = () => trace(`connexion ${pc.connectionState}`);
  pc.onicecandidateerror = (e) => {
    const err = e as RTCPeerConnectionIceErrorEvent;
    trace(`candidat en erreur : ${err.errorCode} ${err.errorText}`);
  };

  // Reception seule : on ne publie jamais rien.
  pc.addTransceiver('video', { direction: 'recvonly' });
  pc.addTransceiver('audio', { direction: 'recvonly' });

  pc.ontrack = (e) => {
    if (video.srcObject !== e.streams[0]) video.srcObject = e.streams[0];
    void video.play().catch(() => { /* lecture differee par le navigateur */ });
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  // On attend la collecte ICE, avec une borne : sur un reseau local elle est immediate,
  // et attendre indefiniment bloquerait l'affichage pour rien.
  await new Promise<void>((resolve) => {
    if (pc.iceGatheringState === 'complete') return resolve();
    const done = () => {
      if (pc.iceGatheringState === 'complete') {
        pc.removeEventListener('icegatheringstatechange', done);
        resolve();
      }
    };
    pc.addEventListener('icegatheringstatechange', done);
    setTimeout(resolve, 1500);
  });

  const abandon = new AbortController();
  const echeance = setTimeout(() => abandon.abort(), DELAI_NEGOCIATION_MS);
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/sdp' },
      body: pc.localDescription!.sdp,
      signal: abandon.signal,
    });
  } catch (e) {
    throw abandon.signal.aborted
      ? new Error('Le relais n’a pas répondu à temps.')
      : (e as Error);
  } finally {
    clearTimeout(echeance);
  }

  if (!response.ok) {
    throw new Error(`Le relais a refusé la connexion (${response.status}).`);
  }

  // Le relais designe la session par cet en-tete : sans DELETE a la fermeture, il la
  // garde ouverte et continue de tirer le flux du controleur pour personne.
  const lieu = response.headers.get('Location');
  if (lieu) ressource = new URL(lieu, url).toString();

  const sdp = await response.text();
  for (const ligne of sdp.split('\n').filter((l) => l.startsWith('a=candidate'))) {
    trace(`candidat distant ${ligne.trim()}`);
  }
  for (const ligne of pc.localDescription!.sdp.split('\n').filter((l) => l.startsWith('a=candidate'))) {
    trace(`candidat local ${ligne.trim()}`);
  }

  await pc.setRemoteDescription({ type: 'answer', sdp });

  return {
    pc,
    close() {
      // « keepalive » : la fermeture survient souvent au demontage de la page, ou une
      // requete ordinaire serait annulee avant d'etre partie.
      if (ressource) {
        void fetch(ressource, { method: 'DELETE', keepalive: true }).catch(() => {});
      }
      pc.getReceivers().forEach((r) => r.track?.stop());
      pc.close();
      video.srcObject = null;
    },
  };
  }
}
