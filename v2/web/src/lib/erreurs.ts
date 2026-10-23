/**
 * Le message d'une erreur venue du processus principal, sans son emballage.
 *
 * Electron transmet un rejet sous la forme « Error invoking remote method 'protect:x':
 * Error: <le vrai message> ». Affiché tel quel, et coupé à la largeur d'un en-tête, il ne
 * montrait que l'emballage — la cause disparaissait (revue du 23.10.2026). Même règle que
 * l'écran de connexion, qui l'enlevait déjà.
 */
export function messageLisible(e: unknown): string {
  const brut = e instanceof Error ? e.message : String((e as { message?: unknown })?.message ?? e);
  return brut.replace(/^Error invoking remote method '[^']+':\s*/, '').replace(/^Error:\s*/, '');
}
