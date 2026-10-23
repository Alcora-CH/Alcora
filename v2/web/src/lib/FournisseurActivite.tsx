import { useEffect, useMemo, useRef, useState } from 'react';
import { bridge } from './bridge';
import { Contexte } from './activiteJour';
import type { Detection, DetectionVive } from '../types/protect';

/**
 * L'activité du jour, tenue UNE fois pour toute l'application.
 *
 * Elle vivait dans la colonne d'état du panneau, monté en permanence. La direction
 * « Observatoire » (23.10.2026) la partage entre trois endroits : la colonne Activité du
 * direct, la page Système (dernière détection de chaque caméra) et, demain, d'autres. La
 * colonne Activité n'existe que sur le direct : si elle tenait ces données, un passage par
 * les réglages viderait la liste des détections récentes, que rien ne relit au retour.
 *
 * Un fournisseur plutôt qu'un état de l'application : quand une détection arrive, seuls
 * ceux qui la lisent se redessinent — pas le mur, ni ses flux.
 */

/** Combien de détections le contrôleur veut bien rendre d'un coup. Cinq fois le volume
 *  observé sur ce matériel (~205 par jour) : la troncature reste théorique. */
const LIMITE_JOUR = 1000;
/** Les détections récentes montrées en direct. */
const RECENTES = 5;
/** Relecture du jour, sans hâte : l'histogramme informe, il ne surveille pas. */
const RELECTURE_MS = 120_000;

export function FournisseurActivite({ children }: { children: React.ReactNode }) {
  const [dujour, setDujour] = useState<Detection[] | null>(null);
  const [partiel, setPartiel] = useState(false);
  const [vives, setVives] = useState<DetectionVive[]>([]);
  const dernieres = useRef<DetectionVive[]>([]);

  useEffect(() => {
    let vivant = true;
    const lire = () => {
      const minuit = new Date(); minuit.setHours(0, 0, 0, 0);
      bridge.evenements({ avant: Date.now(), jours: 1, limite: LIMITE_JOUR })
        .then((l) => {
          if (!vivant) return;
          const liste = l.filter((d) => (d.debut ?? 0) >= minuit.getTime());
          /*
           * Partiel, et non « tronqué » : atteindre la limite ne veut rien dire en soi.
           * Ce qui compte est de savoir si la journée est couverte JUSQU'À minuit. Si la
           * plus ancienne détection rendue est postérieure, alors il en manque avant elle.
           */
          const plusAncien = Math.min(...liste.map((d) => d.debut ?? Infinity));
          // Une heure entière : c'est la granularité de l'histogramme, donc le seuil en
          // dessous duquel il n'y a rien à signaler.
          setPartiel(l.length >= LIMITE_JOUR && plusAncien - minuit.getTime() >= 3_600_000);
          setDujour(liste);
        })
        .catch(() => { if (vivant) setDujour([]); });
    };
    lire();
    const id = setInterval(lire, RELECTURE_MS);
    return () => { vivant = false; clearInterval(id); };
  }, []);

  /*
   * Les détections récentes arrivent EN DIRECT — même liaison que les veilles.
   *
   * Les deux bouts sont utiles, et pour des raisons différentes. Le commencement fait
   * apparaître la ligne tout de suite ; la fin apporte la durée ET rend enfin disponible
   * la vignette de l'événement, que le contrôleur ne fabrique qu'à ce moment-là.
   */
  useEffect(() => bridge.onDetectionVive((d) => {
    const sans = dernieres.current.filter((x) => x.id !== d.id);
    if (d.commence) dernieres.current = [d, ...sans].slice(0, RECENTES);
    else if (sans.length !== dernieres.current.length) {
      // Fin d'une détection déjà listée : on la remplace sur place, l'ordre ne bouge pas.
      dernieres.current = dernieres.current.map((x) => (x.id === d.id ? { ...x, ...d } : x));
    } else return;
    // Trié sur l'HEURE, pas sur l'ordre d'arrivée : une reprise de liaison peut livrer
    // d'un coup des détections dans le désordre, et la plus récente doit rester en tête.
    dernieres.current.sort((a, b) => (b.debut ?? 0) - (a.debut ?? 0));
    setVives([...dernieres.current]);
  }), []);

  const valeur = useMemo(() => ({ dujour, partiel, vives }), [dujour, partiel, vives]);
  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}
