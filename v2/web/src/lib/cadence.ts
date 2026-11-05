/**
 * Les animations sans fin tournent a 30 images par seconde, quel que soit l'ecran.
 *
 * Laissee au compositeur, une animation CSS est recalculee a CHAQUE rafraichissement : 360 fois
 * par seconde sur un ecran a 360 Hz. Une seule suffit a tenir tout le compositeur a cette
 * cadence, pour un ciel qui fait un tour par heure ou un logo qui en met seize secondes.
 *
 * Mesure du 05.11.2026, sur un mur a deux cameras : ciel anime 54 % de la page et 62 % du GPU,
 * ciel fixe 15 % et 17 %. Au banc, a 361 images/s : animations CSS 67-81 % et 73 %, cadencees a
 * 30 images/s 13 % et 18 %. Au-dessous de 30, on ne gagne plus rien.
 *
 * On les met donc en pause, et l'on avance leur horloge a la main. Chacune garde son dessin, sa
 * duree et son decalage : seule change la frequence a laquelle on la recalcule. Les animations
 * d'un geste, qui finissent, ne sont pas touchees : leur fluidite est tout leur sens.
 *
 * Pur pour l'essentiel : horloge, minuterie et visibilite sont fournies. Eprouve par
 * v2/desktop/test-cadence.mjs.
 */

export const IMAGES_PAR_SECONDE = 30;

export interface OptionsCadence<M = unknown> {
  maintenant?: () => number;
  /** Vrai quand la page est masquee : rien ne se voit, et le temps se rattrape au retour. */
  masquee?: () => boolean;
  poser?: (rappel: () => void, ms: number) => M;
  retirer?: (minuteur: M) => void;
}

export function creerCadence<M = ReturnType<typeof setInterval>>({
  maintenant = () => performance.now(),
  masquee = () => false,
  poser = ((rappel: () => void, ms: number) => setInterval(rappel, ms)) as unknown as (rappel: () => void, ms: number) => M,
  retirer = ((m: M) => clearInterval(m as ReturnType<typeof setInterval>)) as unknown as (m: M) => void,
}: OptionsCadence<M> = {}) {
  /** Pour chaque animation : son horloge au moment de la prise, et l'instant de cette prise. */
  const suivies = new Map<Animation, { base: number; prise: number }>();
  let minuteur: M | undefined;

  const battre = () => {
    if (masquee()) return;
    const t = maintenant();
    for (const [animation, { base, prise }] of suivies) {
      // Annulee par le style ou par le demontage de son element : elle n'est plus a nous, et lui
      // redonner une horloge la ferait revivre.
      if (animation.playState === 'idle') {
        suivies.delete(animation);
        continue;
      }
      animation.currentTime = base + (t - prise) * animation.playbackRate;
    }
    // Plus rien a cadencer : plus aucun reveil, un ciel fixe ne doit rien couter.
    if (suivies.size === 0 && minuteur !== undefined) {
      retirer(minuteur);
      minuteur = undefined;
    }
  };

  return {
    /** Prend en charge celles qui sont sans fin ; les autres continuent d'elles-memes. */
    prendre(animations: Iterable<Animation>) {
      for (const animation of animations) {
        if (suivies.has(animation)) continue;
        if (animation.playState === 'idle') continue;
        if (animation.effect?.getComputedTiming().iterations !== Infinity) continue;
        animation.pause();
        suivies.set(animation, { base: Number(animation.currentTime ?? 0), prise: maintenant() });
      }
      if (suivies.size > 0 && minuteur === undefined) {
        minuteur = poser(battre, 1000 / IMAGES_PAR_SECONDE);
      }
    },
    battre,
    /** Pour les verifications. */
    etat: () => ({ suivies: suivies.size, minuteur: minuteur !== undefined }),
  };
}

/**
 * Tient toutes les animations sans fin de la page, presentes et a venir.
 *
 * Un point unique, sans rien demander aux composants : le ciel, le logo, le point d'activite,
 * un chargement, et celles qu'on ajoutera sans penser a cela.
 */
export function cadencerLaPage(page: Document = document) {
  const cadence = creerCadence({ masquee: () => page.visibilityState === 'hidden' });
  page.addEventListener('animationstart', (e) => {
    const cible = e.target as Element | null;
    if (cible?.getAnimations) cadence.prendre(cible.getAnimations({ subtree: true }));
  });
  cadence.prendre(page.getAnimations());
}
