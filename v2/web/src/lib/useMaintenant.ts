import { useEffect, useState } from 'react';

/**
 * L'heure qu'il est, tenue en état et rafraîchie à intervalle : ce qu'un rendu peut lire sans
 * appeler l'horloge lui-même (règle react/purity, rallumée le 24.10.2026). Pour une durée
 * qui se compte en heures ou en jours, une minute suffit.
 */
export function useMaintenant(intervalle = 60_000): number {
  const [maintenant, setMaintenant] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setMaintenant(Date.now()), intervalle);
    return () => clearInterval(id);
  }, [intervalle]);
  return maintenant;
}
