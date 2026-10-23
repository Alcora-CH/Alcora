import { useSyncExternalStore } from 'react';
import { bridge, pontDisponible } from './bridge';
import type { EtatExport } from '../types/protect';

/**
 * L'export d'une plage, vu de la page (maquette docs/maquette-export-plage.html, variante 1).
 *
 * Deux choses vivent ici, HORS des composants : l'état poussé par le processus principal,
 * et la plage en cours de choix. L'export continue quand on quitte la relecture — la barre
 * d'état le suit —, et une plage posée attend qu'on revienne, comme on l'avait laissée.
 */

/** Les bornes choisies, en temps absolu. Une seule peut être posée. */
export interface Plage { debut: number | null; fin: number | null }

let etat: EtatExport = { etat: 'aucun' };
/** L'état terminal (terminé, erreur, annulé) déjà vu et écarté : on ne le remontre pas. */
let acquitte: EtatExport | null = null;
let plage: Plage = { debut: null, fin: null };
const abonnes = new Set<() => void>();
let branche = false;

const prevenir = () => { for (const a of abonnes) a(); };

function brancher() {
  if (branche || !pontDisponible) return;
  branche = true;
  bridge.onExportEtat((e) => { etat = e; prevenir(); });
  // Une page rechargée pendant un export le retrouve où il en est.
  void bridge.exportEtat()
    .then((e) => { if (etat.etat === 'aucun') { etat = e; prevenir(); } })
    .catch(() => { /* sans état connu, rien à montrer : c'est déjà le cas */ });
}

function abonner(f: () => void) {
  brancher();
  abonnes.add(f);
  return () => { abonnes.delete(f); };
}

/** L'état de l'export, ou « aucun » une fois un état terminal écarté. */
const instantane = (): EtatExport => (etat === acquitte ? AUCUN : etat);
const AUCUN: EtatExport = { etat: 'aucun' };

export const useEtatExport = () => useSyncExternalStore(abonner, instantane);
export const usePlage = () => useSyncExternalStore(abonner, () => plage);

export function poserPlage(p: Plage) {
  plage = p;
  prevenir();
}

/** L'avancement d'un export en cours, tous fichiers confondus, en pour cent. */
export function pourcentExport(e: Extract<EtatExport, { etat: 'encours' }>): number {
  const part = e.total > 0 ? Math.min(1, e.recu / e.total) : 0;
  return Math.round(((e.partie - 1 + part) / e.parties) * 100);
}

/** Écarte un état terminal : la ligne de la plage revient au choix des bornes. */
export function acquitterExport() {
  if (etat.etat === 'termine' || etat.etat === 'erreur' || etat.etat === 'annule') {
    acquitte = etat;
    prevenir();
  }
}
