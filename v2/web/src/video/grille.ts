/**
 * Choix de la grille de la mosaique.
 *
 * Le nombre de colonnes ne peut pas dependre du seul nombre de cameras : deux tuiles cote
 * a cote sur un ecran en portrait donnent deux timbres-poste, alors que la meme paire
 * empilee occupe quatre fois la surface. La forme de la zone compte autant que le compte.
 *
 * On essaie donc chaque nombre de colonnes et on garde celui qui rend la tuile la plus
 * grande, a proportion conservee. C'est aussi ce que fait UniFi Protect — verifie le
 * 22.07.2026 sur quatre captures : 2 colonnes en fenetre large, 1 seule en portrait, et
 * jamais d'image etiree pour combler le vide.
 */

export interface Grille {
  colonnes: number;
  rangees: number;
  /** Taille d'une tuile, en pixels, proportion respectee. */
  largeur: number;
  hauteur: number;
}

/** Espace entre deux tuiles, en pixels. */
export const ESPACE = 8;

/**
 * @param zoneW   largeur disponible
 * @param zoneH   hauteur disponible
 * @param nombre  nombre de tuiles a placer
 * @param ratio   proportion d'une tuile, largeur sur hauteur
 */
export function meilleureGrille(
  zoneW: number,
  zoneH: number,
  nombre: number,
  ratio = 16 / 9,
  espace = ESPACE,
  /** Hauteur occupee par l'etiquette au-dessus de chaque vue, hors de l'image. */
  etiquette = 0,
): Grille | null {
  if (nombre < 1 || zoneW <= 0 || zoneH <= 0) return null;

  let meilleure: Grille | null = null;

  for (let colonnes = 1; colonnes <= nombre; colonnes++) {
    const rangees = Math.ceil(nombre / colonnes);
    const celluleW = (zoneW - espace * (colonnes - 1)) / colonnes;
    const celluleH = (zoneH - espace * (rangees - 1)) / rangees;
    if (celluleW <= 0 || celluleH <= 0) continue;

    // L'etiquette se sert AVANT l'image : c'est ce qui l'empeche de la rogner.
    const dispoH = celluleH - etiquette;
    if (dispoH <= 0) continue;

    // Le plus grand rectangle a la bonne proportion tenant dans la cellule. On ne remplit
    // jamais la cellule en etirant : une image de surveillance deformee ment.
    const largeur = Math.min(celluleW, dispoH * ratio);
    const hauteur = largeur / ratio;

    if (!meilleure || largeur * hauteur > meilleure.largeur * meilleure.hauteur) {
      meilleure = { colonnes, rangees, largeur, hauteur };
    }
  }

  return meilleure;
}
