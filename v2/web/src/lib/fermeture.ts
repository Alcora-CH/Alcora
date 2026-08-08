import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Fermer une surface EN LA REGARDANT partir.
 *
 * Une fenetre qui s'ouvre en douceur puis disparait d'un coup se remarque plus
 * qu'une fenetre sans aucune animation : le desequilibre saute aux yeux. Mais
 * React n'attend rien avant de demonter un nœud — des que la condition tombe,
 * l'element quitte le document, animation ou pas.
 *
 * Ce crochet tient donc l'etat intermediaire : « en train de partir ». Le
 * composant ajoute la classe `m-part` tant que `part` est vrai, et l'appelant
 * n'est prevenu qu'a la FIN de l'animation.
 *
 * On ecoute `animationend` plutot que d'attendre un delai ecrit en dur : les
 * durees vivent dans des variables CSS, et un nombre recopie ici se
 * desaccorderait au premier redosage. Un garde-fou couvre le cas ou l'evenement
 * n'arrive jamais — animation coupee par « prefers-reduced-motion », ou nœud
 * rendu invisible avant la fin : sans lui, la surface resterait la pour toujours.
 */
export function useFermetureAnimee<T extends HTMLElement = HTMLDivElement>(
  onFermer: () => void,
) {
  const [part, setPart] = useState(false);
  const noeud = useRef<T | null>(null);
  const fini = useRef(false);

  const fermer = useCallback(() => setPart(true), []);

  useEffect(() => {
    if (!part) return;
    const partir = () => {
      if (fini.current) return;
      fini.current = true;
      onFermer();
    };
    const el = noeud.current;
    el?.addEventListener('animationend', partir);
    // Le garde-fou : large devant la plus longue de nos animations de sortie.
    const secours = setTimeout(partir, 600);
    return () => { el?.removeEventListener('animationend', partir); clearTimeout(secours); };
  }, [part, onFermer]);

  return { part, fermer, ref: noeud };
}
