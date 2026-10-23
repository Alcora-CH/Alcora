/**
 * Les dispositions du mur — maquette docs/maquette-dispositions.html, décisions du 23.10.2026.
 *
 * Une disposition garde ce que montre le mur : les caméras affichées, et leur ordre. C'est
 * tout ce que le mur retient aujourd'hui (l'ordre à la souris, les caméras masquées) ; la
 * caméra isolée est un geste passager, l'espacement un réglage commun à tout.
 *
 * Elle montre EXACTEMENT ce qu'on a enregistré : une caméra arrivée depuis sur le contrôleur
 * n'y entre pas d'elle-même (décision du 23.10.2026) — on l'ajoute par « Caméras », puis
 * « Mettre à jour ». Une caméra retirée du contrôleur est sautée, et cela se dit.
 *
 * Ce module ne touche à rien : il calcule. La page garde l'état et l'écrit dans le
 * navigateur, avec l'ordre et les caméras masquées d'aujourd'hui (test-dispositions.mjs).
 */

export interface Disposition { id: string; nom: string; cameras: string[] }
export interface Dispositions { liste: Disposition[]; active: string | null }

/** Ctrl + 1 à 9 : au-delà, plus de raccourci, et une liste qu'on ne lit plus d'un coup d'œil. */
export const MAX_DISPOSITIONS = 9;
export const NOM_MAX = 40;
export const AUCUNE: Dispositions = { liste: [], active: null };

const chaine = (x: unknown): x is string => typeof x === 'string';

/** Relu du stockage : ce qui n'a pas la bonne forme est écarté, rien ne fait planter. */
export function lireDispositions(brut: string | null): Dispositions {
  if (!brut) return AUCUNE;
  let doc: unknown;
  try { doc = JSON.parse(brut); } catch { return AUCUNE; }
  if (!doc || typeof doc !== 'object') return AUCUNE;
  const { liste, active } = doc as { liste?: unknown; active?: unknown };
  const vues = new Set<string>();
  const propres: Disposition[] = [];
  for (const d of Array.isArray(liste) ? liste : []) {
    if (!d || typeof d !== 'object') continue;
    const { id, nom, cameras } = d as { id?: unknown; nom?: unknown; cameras?: unknown };
    if (!chaine(id) || !chaine(nom) || !nom.trim() || vues.has(id) || !Array.isArray(cameras)) continue;
    vues.add(id);
    propres.push({ id, nom: nom.trim().slice(0, NOM_MAX), cameras: [...new Set(cameras.filter(chaine))] });
    if (propres.length === MAX_DISPOSITIONS) break;
  }
  return { liste: propres, active: chaine(active) && propres.some((d) => d.id === active) ? active : null };
}

/** Pourquoi un nom ne convient pas, ou null. Deux dispositions du même nom se confondraient. */
export function nomRefuse(nom: string, etat: Dispositions, sauf?: string): 'vide' | 'doublon' | null {
  const propre = nom.trim().toLocaleLowerCase();
  if (!propre) return 'vide';
  if (etat.liste.some((d) => d.id !== sauf && d.nom.toLocaleLowerCase() === propre)) return 'doublon';
  return null;
}

/** Ce que le mur montre maintenant, enregistré sous un nom ; elle devient la disposition en cours. */
export function enregistrer(etat: Dispositions, id: string, nom: string, visibles: string[]): Dispositions {
  if (nomRefuse(nom, etat) || etat.liste.length >= MAX_DISPOSITIONS || etat.liste.some((d) => d.id === id)) return etat;
  const d: Disposition = { id, nom: nom.trim().slice(0, NOM_MAX), cameras: [...new Set(visibles)] };
  return { liste: [...etat.liste, d], active: id };
}

export function mettreAJour(etat: Dispositions, id: string, visibles: string[]): Dispositions {
  if (!etat.liste.some((d) => d.id === id)) return etat;
  return { liste: etat.liste.map((d) => (d.id === id ? { ...d, cameras: [...new Set(visibles)] } : d)), active: id };
}

export function renommer(etat: Dispositions, id: string, nom: string): Dispositions {
  if (nomRefuse(nom, etat, id)) return etat;
  return { ...etat, liste: etat.liste.map((d) => (d.id === id ? { ...d, nom: nom.trim().slice(0, NOM_MAX) } : d)) };
}

export function supprimer(etat: Dispositions, id: string): Dispositions {
  return { liste: etat.liste.filter((d) => d.id !== id), active: etat.active === id ? null : etat.active };
}

/**
 * Ce que le mur doit devenir pour montrer une disposition : l'ordre et les caméras masquées.
 * Les caméras qu'elle ne montre pas gardent, derrière, leur ordre d'avant : réafficher l'une
 * d'elles la remet là où elle était.
 */
export function appliquer(d: Disposition, connues: string[], ordreActuel: string[]): {
  ordre: string[]; masquees: string[]; absentes: string[];
} {
  const visibles = d.cameras.filter((id) => connues.includes(id));
  const absentes = d.cameras.filter((id) => !connues.includes(id));
  const reste = [...ordreActuel, ...connues].filter((id, i, t) => !visibles.includes(id) && t.indexOf(id) === i);
  return { ordre: [...visibles, ...reste], masquees: connues.filter((id) => !visibles.includes(id)), absentes };
}

/**
 * La disposition décrit-elle encore le mur ? Une caméra déplacée, masquée ou réaffichée, et
 * c'est non : la disposition se dit « modifiée ». Une caméra absente du contrôleur ne compte
 * pas — elle n'est plus là pour être montrée.
 */
export function decritLeMur(d: Disposition, visibles: string[], connues: string[]): boolean {
  const attendues = d.cameras.filter((id) => connues.includes(id));
  return attendues.length === visibles.length && attendues.every((id, i) => visibles[i] === id);
}
