import { useSyncExternalStore } from 'react';
import { bridge, pontDisponible } from './bridge';

/**
 * Le compte des alertes « non vues » — arrivées depuis la dernière visite de l'historique —,
 * pour la pastille du rail, et un numéro qui change à chaque modification de l'historique :
 * l'onglet ouvert se relit quand il bouge. Hors des composants : le rail et l'écran Alertes
 * doivent lire le même compte.
 */

interface Etat { nonVues: number; version: number }

let etat: Etat = { nonVues: 0, version: 0 };
const abonnes = new Set<() => void>();
let branche = false;

function poser(nonVues: number) {
  etat = { nonVues, version: etat.version + 1 };
  for (const a of abonnes) a();
}

function brancher() {
  if (branche || !pontDisponible) return;
  branche = true;
  bridge.onAlertes((e) => poser(e.nonVues));
  void bridge.alertes().then((r) => poser(r.nonVues)).catch(() => { /* sans compte, pas de pastille */ });
}

function abonner(f: () => void) {
  brancher();
  abonnes.add(f);
  return () => { abonnes.delete(f); };
}

export const useAlertes = () => useSyncExternalStore(abonner, () => etat);
