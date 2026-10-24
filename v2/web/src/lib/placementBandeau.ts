import type { Grille } from '../video/grille';

/**
 * Où se pose le bandeau d'activité du plein écran — maquette du 24.10.2026, variante A.
 *
 * Règle tenue : le bandeau ne RÉTRÉCIT jamais les images. Une tuile plus petite ferait aussi
 * baisser la qualité demandée au contrôleur ; le bandeau prend donc la place laissée libre,
 * dans cet ordre :
 *   1. dessous, dans la bande que la mosaïque centrée laisse (deux caméras sur un 21:9) ;
 *   2. sur le côté, debout, si le dessous est plein mais les côtés libres (quatre caméras
 *      sur un 21:9) ;
 *   3. sinon une pastille, au-dessus de la barre d'état, que le survol ouvre.
 *
 * Module PUR : v2/desktop/test-absence.mjs le lit dans sa source.
 */

export const MARGE = 24;
export const HAUTEUR_BANDEAU = 92;
/** Le résumé à gauche, le lien à droite, les marges : ce qui n'est pas des cartes. */
const HORS_CARTES = 210 + 190 + 2 * 14 + 2 * 14;
export const PAS_CARTE = 272;
export const LARGEUR_COTE_MIN = 300;
export const LARGEUR_COTE_MAX = 340;
const TETE_COTE = 150;
/** Le bas des commandes du plein écran (App.tsx : « right-3 top-3 », boutons de 32 px). */
export const BAS_COMMANDES = 12 + 32;
export const PAS_CARTE_COTE = 74;

export type Placement =
  | { mode: 'dessous'; x: number; y: number; largeur: number; cartes: number }
  | { mode: 'cote'; x: number; y: number; largeur: number; hauteur: number; cartes: number }
  | { mode: 'pastille' };

/**
 * @param zone        la surface du mur (en plein écran : la fenêtre entière)
 * @param grille      la mosaïque telle que meilleureGrille l'a choisie
 * @param espacement  l'espace entre les tuiles
 * @param etiquette   la hauteur de l'en-tête de chaque tuile, au-dessus de l'image
 * @param barre       la hauteur de la barre d'état, qui peut se poser en bas
 */
export function placerBandeau(zone: { w: number; h: number }, grille: Grille, espacement: number,
  etiquette: number, barre: number): Placement {
  const totalW = grille.colonnes * grille.largeur + espacement * (grille.colonnes - 1);
  const totalH = grille.rangees * (grille.hauteur + etiquette) + espacement * (grille.rangees - 1);
  const x0 = (zone.w - totalW) / 2;
  const y0 = (zone.h - totalH) / 2;
  const bande = zone.h - (y0 + totalH);

  // Dessous : le bandeau, sa marge au-dessus, et de quoi laisser passer la barre d'état.
  if (bande >= MARGE + HAUTEUR_BANDEAU + 8 + barre) {
    return {
      mode: 'dessous',
      x: Math.round(x0), y: Math.round(y0 + totalH + MARGE), largeur: Math.round(totalW),
      cartes: Math.max(1, Math.floor((totalW - HORS_CARTES) / PAS_CARTE)),
    };
  }
  if (x0 >= LARGEUR_COTE_MIN + 2 * MARGE) {
    /*
     * Debout, il longe les images — mais sous les commandes du plein écran (en haut à droite,
     * au mouvement de la souris) et au-dessus de la barre d'état : mesuré le 24.10.2026 dans
     * la démo, une caméra isolée le faisait commencer pile sous les commandes, et sa hauteur
     * permise descendait jusque dans la barre.
     */
    const y = Math.max(y0 + etiquette, BAS_COMMANDES + 8);
    const hauteur = Math.min(y0 + totalH, zone.h - barre - 8) - y;
    return {
      mode: 'cote',
      x: Math.round(x0 + totalW + MARGE), y: Math.round(y),
      largeur: Math.round(Math.min(LARGEUR_COTE_MAX, x0 - 2 * MARGE)), hauteur: Math.round(hauteur),
      cartes: Math.max(1, Math.floor((hauteur - TETE_COTE) / PAS_CARTE_COTE)),
    };
  }
  return { mode: 'pastille' };
}
