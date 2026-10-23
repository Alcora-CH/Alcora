import { useEffect, type RefObject } from 'react';

const FOCALISABLES = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), '
  + 'textarea:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])';

/**
 * Le focus d'une fenêtre modale : il y entre, il y reste, il en ressort là où il était.
 *
 * Une fenêtre déclarée « aria-modal » cache le reste de l'écran aux lecteurs d'écran ; y
 * laisser le focus derrière, c'était le poser sur ce qu'ils annoncent indisponible. Et
 * concrètement : la séquence d'une détection s'ouvrait avec le focus sur la carte qu'on
 * venait de cliquer, si bien qu'Espace re-cliquait cette carte cachée au lieu de lancer la
 * lecture (revue du 23.10.2026).
 *
 * `initial` : l'élément à focaliser à l'ouverture ; à défaut, la fenêtre elle-même (qui doit
 * alors porter tabIndex={-1}) — c'est ce que veut un lecteur, dont les touches visent la
 * fenêtre et non un bouton.
 *
 * Une limite assumée : dans un cadre isolé (le guide), les touches appartiennent au cadre ;
 * ni Tab ni Échap n'y sont vus par cette page.
 */
export function usePiegeFocus(fenetre: RefObject<HTMLElement | null>, initial?: () => HTMLElement | null) {
  useEffect(() => {
    const avant = document.activeElement as HTMLElement | null;
    const el = fenetre.current;
    (initial?.() ?? el)?.focus();

    const clavier = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !el) return;
      const liste = [...el.querySelectorAll<HTMLElement>(FOCALISABLES)].filter((x) => x.offsetParent !== null);
      if (!liste.length) { e.preventDefault(); el.focus(); return; }
      const premier = liste[0];
      const dernier = liste[liste.length - 1];
      const ici = document.activeElement;
      if (e.shiftKey && (ici === premier || ici === el)) { e.preventDefault(); dernier.focus(); }
      else if (!e.shiftKey && ici === dernier) { e.preventDefault(); premier.focus(); }
      else if (!el.contains(ici)) { e.preventDefault(); premier.focus(); }
    };
    window.addEventListener('keydown', clavier, true);
    return () => {
      window.removeEventListener('keydown', clavier, true);
      // La fenêtre partie, le focus revient d'où il venait — s'il est encore là.
      if (avant && document.contains(avant)) avant.focus();
    };
    // Une fois, à l'ouverture : `initial` n'a pas à rejouer le piège.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
