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

/**
 * Le chemin que la connexion a retenu : type et protocole du candidat local, adresse du relais.
 * C'est ce que disaient, à la lecture, les quinze lignes de candidats — en une seule.
 */
async function cheminRetenu(pc: RTCPeerConnection): Promise<string | null> {
  try {
    const stats = await pc.getStats();
    let paire: RTCIceCandidatePairStats | undefined;
    stats.forEach((s) => { if (s.type === 'transport' && s.selectedCandidatePairId) paire = stats.get(s.selectedCandidatePairId); });
    if (!paire) stats.forEach((s) => { if (s.type === 'candidate-pair' && s.nominated && s.state === 'succeeded') paire = s; });
    if (!paire) return null;
    const local = stats.get(paire.localCandidateId);
    const distant = stats.get(paire.remoteCandidateId);
    // Une adresse masquée (mDNS, côté navigateur) arrive vide : « ? » plutôt que « → :62967 ».
    return `${local?.candidateType || '?'} ${local?.protocol || '?'} → ${distant?.address || '?'}:${distant?.port ?? '?'}`;
  } catch {
    return null;
  }
}

export async function connectWhep(
  url: string,
  video: HTMLVideoElement,
  /** En-tete exige par le relais : sans lui, 401 (voir relais-config.js). */
  autorisation: string,
): Promise<WhepSession> {
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

  /*
   * Journalise l'ISSUE de la negociation, pas seulement son echec. Sans cela, une signalisation
   * reussie suivie d'une connexion qui n'aboutit jamais est indiscernable d'un succes : c'est
   * exactement ce qui a masque le probleme pendant des heures.
   *
   * Mais une ligne par connexion reussie, plus quinze : chaque candidat ICE et chaque etat
   * faisaient tourner le journal de 2 Mo en deux ou trois jours, emportant les gestes et le
   * reste (releve du 27.10.2026). Le detail — candidats des deux cotes — ne s'ecrit plus que
   * quand la connexion echoue, la ou il sert. En anglais, comme tout le journal.
   */
  const trace = (m: string) => console.log(`[whep] ${url.split('/').slice(-2, -1)[0]} ${m}`);
  const debut = performance.now();
  let distants: string[] = [];
  const locaux = () => (pc.localDescription?.sdp ?? '').split('\n')
    .filter((l) => l.startsWith('a=candidate')).map((l) => l.trim());
  pc.onconnectionstatechange = () => {
    const etat = pc.connectionState;
    if (etat === 'connected') {
      const duree = Math.round(performance.now() - debut);
      void cheminRetenu(pc).then((chemin) => trace(
        `connected in ${duree} ms${chemin ? ` via ${chemin}` : ''} (${distants.length} remote, ${locaux().length} local candidates)`));
    } else if (etat === 'disconnected' || etat === 'failed') {
      trace(`connection ${etat} (ICE ${pc.iceConnectionState})`);
      if (etat === 'failed') {
        for (const c of distants) trace(`remote ${c}`);
        for (const c of locaux()) trace(`local ${c}`);
      }
    }
  };
  pc.onicecandidateerror = (e) => {
    const err = e as RTCPeerConnectionIceErrorEvent;
    trace(`candidate error: ${err.errorCode} ${err.errorText}`);
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
      headers: { 'Content-Type': 'application/sdp', Authorization: autorisation },
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
  // Gardes pour le journal : ils ne s'ecrivent que si la connexion echoue.
  distants = sdp.split('\n').filter((l) => l.startsWith('a=candidate')).map((l) => l.trim());

  await pc.setRemoteDescription({ type: 'answer', sdp });

  return {
    pc,
    close() {
      // « keepalive » : la fermeture survient souvent au demontage de la page, ou une
      // requete ordinaire serait annulee avant d'etre partie.
      if (ressource) {
        void fetch(ressource, {
          method: 'DELETE', keepalive: true, headers: { Authorization: autorisation },
        }).catch(() => {});
      }
      pc.getReceivers().forEach((r) => r.track?.stop());
      pc.close();
      video.srcObject = null;
    },
  };
  }
}
