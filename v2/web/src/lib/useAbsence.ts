import { useCallback, useEffect, useRef, useState } from 'react';
import { INACTIVITE_MS, auLancement, enCours, partir, revenir, vu, type EtatAbsence } from './absence';

/**
 * Tient les absences (lib/absence.ts) d'après les signes de la fenêtre : un geste (souris,
 * clavier, molette) dit « je suis là » ; la fenêtre qui perd l'attention, ou deux minutes
 * sans geste, disent le contraire.
 *
 * L'état ne change qu'aux TRANSITIONS : un mouvement de souris pendant qu'on est là ne
 * touche à rien. Le contraire relancerait le rendu de tout le mur à chaque pixel parcouru.
 * La dernière présence se note donc à part, et se garde toutes les trente secondes : c'est
 * elle qui, au prochain lancement, dira depuis quand Alcora était fermée.
 */

const CLE = 'alcora.absences';
const GARDE_MS = 30_000;

function lire(): unknown {
  try { return JSON.parse(localStorage.getItem(CLE) ?? 'null'); } catch { return null; }
}

export function useAbsence(): { etat: EtatAbsence; marquerVu: () => void } {
  const [etat, setEtat] = useState<EtatAbsence>(() => auLancement(lire(), Date.now()));
  const actuel = useRef(etat);
  const dernierGeste = useRef(0);

  useEffect(() => {
    actuel.current = etat;
    try {
      localStorage.setItem(CLE, JSON.stringify({
        absences: etat.absences,
        derniereVue: enCours(etat) ? etat.derniereVue : Date.now(),
      }));
    } catch { /* stockage plein ou refusé : l'absence vaut pour cette session */ }
  }, [etat]);

  useEffect(() => {
    dernierGeste.current = Date.now();
    const geste = () => {
      dernierGeste.current = Date.now();
      if (enCours(actuel.current)) setEtat((e) => revenir(e, Date.now()));
    };
    const perdu = () => {
      if (!enCours(actuel.current)) setEtat((e) => partir(e, Date.now()));
    };
    const visibilite = () => (document.hidden ? perdu() : geste());
    const garder = () => {
      const e = actuel.current;
      if (enCours(e)) return;
      try { localStorage.setItem(CLE, JSON.stringify({ absences: e.absences, derniereVue: Date.now() })); } catch { /* idem */ }
    };
    const veille = setInterval(() => {
      // L'absence commence au dernier geste : les deux minutes d'attente en font partie.
      if (!enCours(actuel.current) && Date.now() - dernierGeste.current >= INACTIVITE_MS) {
        const depuis = dernierGeste.current;
        setEtat((e) => partir(e, depuis));
      }
    }, 10_000);
    const garde = setInterval(garder, GARDE_MS);

    const options = { passive: true, capture: true } as const;
    for (const type of ['pointermove', 'pointerdown', 'keydown', 'wheel'] as const) {
      window.addEventListener(type, geste, options);
    }
    window.addEventListener('focus', geste);
    window.addEventListener('blur', perdu);
    window.addEventListener('pagehide', garder);
    document.addEventListener('visibilitychange', visibilite);
    return () => {
      clearInterval(veille);
      clearInterval(garde);
      for (const type of ['pointermove', 'pointerdown', 'keydown', 'wheel'] as const) {
        window.removeEventListener(type, geste, options);
      }
      window.removeEventListener('focus', geste);
      window.removeEventListener('blur', perdu);
      window.removeEventListener('pagehide', garder);
      document.removeEventListener('visibilitychange', visibilite);
    };
  }, []);

  /* Rien à effacer : le même objet, pour ne rien redessiner. */
  const marquerVu = useCallback(() => {
    setEtat((e) => (e.absences.some((a) => a.a !== null) ? vu(e) : e));
  }, []);

  return { etat, marquerVu };
}
