import { createContext, useContext } from 'react';
import type { Detection, DetectionVive } from '../types/protect';

/**
 * L'activite du jour : sa forme, sa lecture, et ce qu'on en tire. Le fournisseur qui la
 * tient vit a cote (FournisseurActivite.tsx) : un fichier de composants ne doit exporter
 * que des composants, sinon le rechargement a chaud du developpement ne suit plus.
 */

export interface ActiviteJour {
  /** Les détections du jour, ou null tant qu'elles n'ont pas été lues. */
  dujour: Detection[] | null;
  /** La lecture ne remonte pas jusqu'à minuit : les premières heures manquent. */
  partiel: boolean;
  /** Les plus récentes, arrivées en direct, la plus récente en tête. */
  vives: DetectionVive[];
}

export const Contexte = createContext<ActiviteJour>({ dujour: null, partiel: false, vives: [] });

export const useActivite = () => useContext(Contexte);

/**
 * Combien de détections, heure par heure.
 *
 * Le contrôleur rend les plus RÉCENTES en premier et s'arrête à la limite demandée. Si elle
 * est atteinte, les premières heures du jour manquent — et un histogramme vide au petit
 * matin serait un mensonge de la même famille que ceux qu'on chasse ailleurs. On rend donc
 * aussi la première heure réellement couverte, pour que le dessin s'arrête là où il sait.
 */
export function parHeure(liste: Detection[], partiel: boolean) {
  const h = new Array(24).fill(0) as number[];
  let plusAncien = Infinity;
  for (const d of liste) {
    if (!d.debut) continue;
    h[new Date(d.debut).getHours()] += 1;
    plusAncien = Math.min(plusAncien, d.debut);
  }
  /*
   * L'heure qui CONTIENT la plus ancienne détection lue est elle-même incomplète : on la
   * grise aussi. Une barre à moitié vraie serait pire qu'une barre qui se dit inconnue.
   */
  const depuis = partiel && Number.isFinite(plusAncien)
    ? Math.min(24, new Date(plusAncien).getHours() + 1) : 0;
  return { heures: h, depuis };
}

/**
 * Les dernières détections, pour la colonne Activité et le bandeau du plein écran : les
 * vives d'abord (elles portent l'état de la détection en cours), puis celles du jour que le
 * direct n'a pas apportées. Triées sur l'heure : la plus récente en tête.
 */
export function dernieres({ dujour, vives }: ActiviteJour, n: number): (DetectionVive & { vignette?: boolean })[] {
  const vues = new Set(vives.map((d) => d.id));
  const dujourVives: (DetectionVive & { vignette?: boolean })[] = (dujour ?? [])
    .filter((d) => !vues.has(d.id))
    .map((d) => ({ ...d, commence: false }));
  return [...vives, ...dujourVives]
    .sort((a, b) => (b.debut ?? 0) - (a.debut ?? 0))
    .slice(0, n);
}

/**
 * L'image d'une détection. Tant qu'elle COURT, il n'existe aucune vignette : on montre
 * l'instantané de la caméra, daté du début pour que le navigateur le garde. Finie, la vraie
 * vignette de l'événement prend la place — si le contrôleur en a fait une.
 */
export function imageDe(d: DetectionVive & { vignette?: boolean }): string | null {
  const finie = Boolean(d.fin && d.id);
  if (finie && d.vignette !== false) return `/vignette/${d.id}`;
  return !finie && d.camera ? `/instantane/${d.camera}?t=${d.debut ?? 0}` : null;
}

/** La détection court encore : commencée, pas finie. */
export const enCoursDe = (d: DetectionVive) => !d.fin && d.debut !== null;

/**
 * La dernière détection de chaque caméra, pour la page Système : la plus récente entre
 * celles du jour et celles arrivées en direct depuis la dernière lecture.
 */
export function derniereParCamera({ dujour, vives }: ActiviteJour) {
  const m = new Map<string, { sujets: string[]; type: string; debut: number }>();
  for (const d of [...(dujour ?? []), ...vives]) {
    if (!d.camera || !d.debut) continue;
    const deja = m.get(d.camera);
    if (!deja || d.debut > deja.debut) m.set(d.camera, { sujets: d.sujets, type: d.type, debut: d.debut });
  }
  return m;
}
