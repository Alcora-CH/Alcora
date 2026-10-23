/**
 * Le vrai début d'un morceau exporté par le contrôleur.
 *
 * Mesuré le 23.10.2026 sur le poste de référence (relecture de deux caméras, cache de l'essai
 * lu boîte par boîte) : le contrôleur commence chaque export à l'image-clé QUI PRÉCÈDE le
 * début demandé, et s'arrête à la fin demandée. Le morceau dure donc plus que demandé — 3,0 s
 * de trop sur la G5 Turret Ultra, 4,4 s sur la G6 Bullet, d'un morceau à l'autre. Compter
 * depuis le début DEMANDÉ faisait avancer l'heure affichée de 3 à 4 s sur l'heure incrustée
 * par la caméra, décalait deux caméras d'une seconde entre elles, et rejouait ces secondes à
 * chaque relais entre deux morceaux.
 *
 * Le débordement se lit donc en fin de compte : fin demandée moins durée réelle. Un morceau
 * plus court que demandé (tout près de l'instant présent) garde son début demandé.
 */
export function debutReel(m: { debut: number; fin: number }, dureeSecondes: number): number {
  if (!Number.isFinite(dureeSecondes) || dureeSecondes <= 0) return m.debut;
  return Math.min(m.debut, m.fin - dureeSecondes * 1000);
}
