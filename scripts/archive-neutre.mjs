/**
 * L'archive Linux publiee ne doit porter aucun nom de compte.
 *
 * Construite dans WSL, tar inscrivait par defaut le compte de qui construit comme proprietaire de
 * chaque fichier (constate le 17.11.2026 sur les archives 2.25.0 a 2.29.0). « build-linux.mjs »
 * cree donc l'archive avec « --owner=0 --group=0 --numeric-owner », puis RELIT son contenu
 * (« tar tv ») et le passe ici : chaque entree doit montrer « 0/0 ».
 *
 * Module a part : build-linux.mjs lance la construction des qu'on l'importe, ce controle doit
 * pouvoir s'eprouver seul (scripts/test-archive-neutre.mjs).
 */
export function proprietaireNeutre(listage) {
  const lignes = listage.split('\n').map((l) => l.trim()).filter((l) => /^[-dl][rwxsStT-]{9}\s/.test(l));
  return lignes.length > 0 && lignes.every((l) => /^\S+\s+0\/0\s/.test(l));
}
