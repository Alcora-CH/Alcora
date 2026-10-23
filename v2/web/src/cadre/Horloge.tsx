import { useEffect, useState } from 'react';
import { localeDates, useLangue } from '../i18n';

/**
 * L'heure, a la seconde.
 *
 * Son propre composant, et c'est tout son interet : la colonne d'etat portait l'horloge
 * dans son etat, et se redessinait donc ENTIERE chaque seconde, pour un seul chiffre.
 */
export function Horloge({ className }: { className?: string }) {
  useLangue();
  const [maintenant, setMaintenant] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setMaintenant(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return <span className={className}>{maintenant.toLocaleTimeString(localeDates())}</span>;
}
