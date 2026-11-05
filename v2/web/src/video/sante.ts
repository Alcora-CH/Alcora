/**
 * Sante d'un flux : quand faut-il reprendre ?
 *
 * Extrait de la tuile pour etre eprouve seul. C'est la decision la plus lourde de
 * consequences de l'application : mal reglee, elle reconnecte en boucle un flux qui allait
 * bien, ou laisse une image figee passer pour du direct. La seconde faute est la pire —
 * dans un outil de surveillance, une panne qui ne se voit pas est une panne qui dure.
 */

export interface EtatFlux {
  /** connectionState de la RTCPeerConnection. */
  connexion: RTCPeerConnectionState;
  /** Vrai des la premiere image reellement decodee. */
  demarre: boolean;
  /** Temps ecoule depuis le dernier mouvement d'images, en millisecondes. */
  immobileMs: number;
  /** Faux quand la fenetre est masquee : le navigateur cesse alors de decoder. */
  visible: boolean;
}

export interface Seuils {
  /** Sans nouvelle image, au-dela : le flux est fige. */
  gelMs: number;
  /** Session ouverte n'ayant jamais rien livre, au-dela : elle ne livrera pas. */
  premiereImageMs: number;
}

/**
 * @returns la cause de la reprise, ou null s'il n'y a rien a faire.
 */
export function causeDeReprise(etat: EtatFlux, seuils: Seuils): string | null {
  // Fenetre masquee : ne rien conclure. Le decodage s'arrete legitimement, et reconnecter
  // une tuile que personne ne regarde ne ferait que charger le relais.
  if (!etat.visible) return null;

  if (etat.connexion === 'failed' || etat.connexion === 'closed') {
    return `connection ${etat.connexion}`;
  }

  if (!etat.demarre) {
    return etat.immobileMs > seuils.premiereImageMs ? 'no frame yet' : null;
  }
  return etat.immobileMs > seuils.gelMs ? 'frames stopped' : null;
}

/** Ce que le navigateur dit du flux video recu. */
export interface Decodage {
  decodees: number;
  recues: number;
  paquets: number;
  /** Type du flux (« video/H265 »), ou null tant que le navigateur ne l'a pas determine. */
  codec: string | null;
}

/**
 * Lit le flux video entrant dans un rapport getStats. Rend null si aucun n'y figure.
 *
 * Les compteurs absents valent zero plutot qu'une erreur : le navigateur ne les remplit
 * qu'au fil de la reception, et un rapport precoce ne doit pas faire conclure a une panne.
 */
export function lireDecodage(rapport: Pick<RTCStatsReport, 'forEach' | 'get'>): Decodage | null {
  let flux: (RTCInboundRtpStreamStats & { framesReceived?: number }) | null = null;
  rapport.forEach((s: RTCStats) => {
    const r = s as RTCInboundRtpStreamStats;
    if (r.type === 'inbound-rtp' && r.kind === 'video') flux = r;
  });
  if (!flux) return null;
  const f = flux as RTCInboundRtpStreamStats & { framesReceived?: number };
  const type = f.codecId ? (rapport.get(f.codecId) as { mimeType?: string } | undefined) : undefined;
  return {
    decodees: f.framesDecoded ?? 0,
    recues: f.framesReceived ?? 0,
    paquets: f.packetsReceived ?? 0,
    codec: type?.mimeType ?? null,
  };
}

/**
 * Images recues au moins, sans une seule decodee, pour accuser le decodeur. En dessous, le
 * flux demarre peut-etre encore : il faut une image cle, et la camera peut la faire attendre.
 */
const IMAGES_POUR_ACCUSER = 25;

/**
 * Des images arrivent et aucune n'est decodee : le decodeur manque.
 *
 * C'est la signature de la panne du 05.11.2026 — H.265 apres la perte du GPU. Le flux lui-meme
 * se porte bien, rouvrir la connexion ne changera rien, et « Connexion… » serait un mensonge.
 */
export function sansDecodeur(d: Decodage): boolean {
  return d.decodees === 0 && d.recues >= IMAGES_POUR_ACCUSER;
}

/** « video/H265 » devient « H.265 » : ce que Protect et les notices appellent ainsi. */
export function nomCodec(mime: string | null): string {
  const nu = (mime ?? '').replace(/^video\//i, '');
  const noms: Record<string, string> = { H264: 'H.264', H265: 'H.265' };
  return noms[nu.toUpperCase()] ?? (nu || '?');
}

/**
 * Le constat d'un flux sans image, pour le journal : tranche entre la source et le decodeur.
 *
 * « packets +0 » : plus rien n'arrive, c'est en amont — camera, console ou relais. Des paquets
 * et des images recues sans decodage : c'est ce poste. Sans cette ligne, soixante gels de la
 * G5 sont restes indiscernables le 05.11.2026. En anglais, comme tout le journal.
 */
export function constatDeGel(depuis: Decodage | null, maintenant: Decodage, ice: string): string {
  const plus = (a: number, b: number | undefined) => `+${Math.max(0, a - (b ?? 0))}`;
  return `packets ${plus(maintenant.paquets, depuis?.paquets)}, `
    + `received ${plus(maintenant.recues, depuis?.recues)}, `
    + `decoded ${plus(maintenant.decodees, depuis?.decodees)}, `
    + `codec ${nomCodec(maintenant.codec)}, ice ${ice}`;
}

/**
 * Attente avant la n-ieme reprise : croissante, bornee, et decalee d'une tuile a l'autre.
 *
 * La gigue n'est pas cosmetique : sans elle, toutes les tuiles se reconnectent au meme
 * instant apres une coupure et frappent le relais ensemble, ce qui reproduit la panne.
 */
export function attenteReprise(essai: number, paliers: readonly number[], gigue = Math.random): number {
  const rang = Math.min(Math.max(0, essai), paliers.length - 1);
  return Math.round(paliers[rang] + gigue() * 400);
}
