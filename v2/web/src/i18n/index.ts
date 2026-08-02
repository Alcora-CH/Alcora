import { useSyncExternalStore } from 'react';
import { fr, type Cle } from './fr';
import { en } from './en';
import { de } from './de';
import { it } from './it';

/**
 * L'internationalisation, sans dependance.
 *
 * Un magasin minuscule : la langue courante, des abonnes, et t(). Les composants
 * s'abonnent par useLangue() — via useSyncExternalStore, l'outil que React fournit
 * exactement pour cela — et se redessinent au changement de langue, sans recharger
 * l'application ni perdre le moindre etat.
 *
 * La VERITE de la langue vit dans config.json, cote processus principal : c'est lui qui
 * envoie les notifications Windows, et l'ecran et les bulles doivent parler d'une seule
 * voix. Ici on ne fait que refleter ce qu'il a decide.
 *
 * AJOUTER UNE LANGUE : voir docs/i18n.md. En bref — copier en.ts, traduire, puis une
 * entree dans LANGUES ci-dessous et une dans son jumeau v2/desktop/i18n.js. Le
 * compilateur et test-contrat.js refusent tout dictionnaire incomplet.
 */

export const LANGUES = {
  fr: { dictionnaire: fr, locale: 'fr-CH', nom: 'Français' },
  en: { dictionnaire: en, locale: 'en-GB', nom: 'English' },
  de: { dictionnaire: de, locale: 'de-CH', nom: 'Deutsch' },
  it: { dictionnaire: it, locale: 'it-CH', nom: 'Italiano' },
} as const;

export type CodeLangue = keyof typeof LANGUES;
export const CODES_LANGUE = Object.keys(LANGUES) as CodeLangue[];

let courante: CodeLangue = 'fr';
const abonnes = new Set<() => void>();

export function definirLangue(langue: string) {
  const propre: CodeLangue = langue in LANGUES ? (langue as CodeLangue) : 'fr';
  if (propre === courante) return;
  courante = propre;
  abonnes.forEach((a) => a());
}

export function langueCourante(): CodeLangue {
  return courante;
}

/** La locale des dates et des heures suit la langue — plus jamais de fr-CH fige. */
export function localeDates(): string {
  return LANGUES[courante].locale;
}

/**
 * Un nombre a decimales, ecrit dans la langue courante : « 4,10 » en francais,
 * « 4.10 » en anglais — le separateur vient de la locale, pas d'une table a nous.
 * Pour les nombres entiers, inutile — ils s'ecrivent pareil.
 */
export function nombre(n: number, decimales: number): string {
  return new Intl.NumberFormat(localeDates(), {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
    useGrouping: false,
  }).format(n);
}

/**
 * Traduit une cle, en remplacant les parametres `{nom}`.
 *
 * Toute cle passe par le type `Cle` : une cle inconnue est une erreur de compilation,
 * il n'existe donc pas de chemin ou t() ne trouve rien a l'execution.
 */
export function t(cle: Cle, params?: Record<string, string | number>): string {
  let texte: string = LANGUES[courante].dictionnaire[cle];
  if (params) {
    for (const [nom, valeur] of Object.entries(params)) {
      texte = texte.replace(`{${nom}}`, String(valeur));
    }
  }
  return texte;
}

/**
 * L'abonnement d'un composant : il se redessine quand la langue change.
 * Rend t, pour que l'appelant ecrive simplement `const t = useLangue()`.
 */
export function useLangue(): typeof t {
  useSyncExternalStore(
    (rappel) => { abonnes.add(rappel); return () => abonnes.delete(rappel); },
    () => courante,
  );
  return t;
}
