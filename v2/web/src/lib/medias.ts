/**
 * Les adresses des images et extraits que la page demande au processus principal
 * (/vignette/…, /instantane/…) et de la mire de demonstration (/demo-extrait.mp4).
 *
 * Dans l'application, elles restent telles quelles : le processus principal les sert.
 *
 * Dans la DEMONSTRATION PUBLIQUE (construite avec VITE_DEMO_PUBLIQUE=1, servie sous /demo/ par
 * le site alcora.ch, demande de Thomas du 17.11.2026), il n'y a ni processus principal ni relais :
 * chaque adresse mene a un fichier de demonstration pose a cote de la page (medias/), et le
 * direct de chaque camera est une video en boucle. Le drapeau est lu a la construction : dans
 * l'application, ces branches n'existent pas.
 */
type Env = Record<string, string | boolean | undefined>;
const ENV: Env = (import.meta as unknown as { env?: Env }).env ?? {};

export const DEMO_PUBLIQUE = ENV.VITE_DEMO_PUBLIQUE === '1';
const BASE = typeof ENV.BASE_URL === 'string' ? ENV.BASE_URL : '/';

/** La version affichee par la demonstration publique : celle qu'elle montre, pas « 0.0.0 ». */
export const VERSION_DEMO = typeof ENV.VITE_VERSION_ALCORA === 'string' && ENV.VITE_VERSION_ALCORA
  ? ENV.VITE_VERSION_ALCORA : '0.0.0-démo';

/** Nombre de vignettes de demonstration (medias/vignettes/0.jpg a 11.jpg). */
export const VIGNETTES_DEMO = 12;

const hacher = (s: string) => {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
};

/** Les cameras de demonstration : la G5 filme les bureaux, toute autre l'allee. */
const scene = (camera: string) => (camera.startsWith('g5') ? 'bureaux' : 'allee');

/** La video en boucle qui tient lieu de flux pour une camera de demonstration. */
export function videoDemo(camera: string, base = BASE): string {
  return `${base}medias/${scene(camera)}.mp4`;
}

/** L'adresse a demander pour un media, selon qu'on est dans la demonstration publique ou non. */
export function adresseMedia(chemin: string, demo: boolean, base: string): string {
  if (!demo) return chemin;
  const fin = chemin.search(/[?#]/);
  const p = fin < 0 ? chemin : chemin.slice(0, fin);
  if (p.startsWith('/vignette/')) return `${base}medias/vignettes/${hacher(p.slice('/vignette/'.length)) % VIGNETTES_DEMO}.jpg`;
  if (p.startsWith('/instantane/')) return `${base}medias/instantanes/${scene(p.slice('/instantane/'.length))}.jpg`;
  if (p === '/demo-extrait.mp4') return `${base}demo-extrait.mp4${fin < 0 ? '' : chemin.slice(fin)}`;
  return chemin;
}

export const urlMedia = (chemin: string) => adresseMedia(chemin, DEMO_PUBLIQUE, BASE);
