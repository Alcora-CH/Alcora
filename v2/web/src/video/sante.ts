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
    return `connexion ${etat.connexion}`;
  }

  if (!etat.demarre) {
    return etat.immobileMs > seuils.premiereImageMs ? 'aucune image reçue' : null;
  }
  return etat.immobileMs > seuils.gelMs ? 'plus d’image' : null;
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
