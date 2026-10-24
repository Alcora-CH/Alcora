import { useEffect, useRef } from 'react';

/**
 * Les gestes au journal : ce que la fenêtre montre, et pourquoi elle a changé.
 *
 * Le journal disait qu'une tuile s'était remontée — `largeur=0`, puis un nouvel appel au
 * relais —, jamais ce qui l'avait provoqué. Le 24.10.2026, deux reconnexions du mur n'ont pu
 * être rattachées à rien : changement d'écran, caméra isolée, plein écran ou séquence, il a
 * fallu le deviner d'après la largeur des tuiles. Chaque geste qui change ce que montre la
 * fenêtre laisse donc une ligne.
 *
 * Par la console : le processus principal recopie déjà tout ce qu'elle reçoit dans le journal
 * (main.js, « console-message »), sans canal de plus entre la page et lui. En ANGLAIS, comme
 * tout le journal, quelle que soit la langue de l'interface.
 */
/**
 * D'où vient une séquence : la colonne Activité, le bandeau du plein écran, une bulle de
 * Windows, l'historique des alertes, les Détections. Pour le journal seulement.
 */
export type OrigineSequence = 'column' | 'strip' | 'bubble' | 'alerts' | 'detections';

export function noterGeste(ligne: string) {
  console.log(`[gesture] ${ligne}`);
}

/**
 * Note chaque CHANGEMENT de `valeur` — jamais sa valeur de départ : au lancement, rien n'a
 * été fait, et « screen direct » à chaque démarrage ne dirait rien.
 *
 * `ligne` peut être réécrite à chaque rendu : seule la valeur décide qu'il y a quelque chose à
 * noter. `egale` compare autrement qu'à l'identité — une liste recréée à l'identique n'est pas
 * un geste.
 */
export function useGesteNote<T>(valeur: T, ligne: (v: T) => string,
  egale: (a: T, b: T) => boolean = Object.is) {
  const avant = useRef(valeur);
  useEffect(() => {
    if (egale(avant.current, valeur)) return;
    avant.current = valeur;
    noterGeste(ligne(valeur));
  });
}
