import { useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { changementsDe, VERSIONS } from '../versions';
import { useFermetureAnimee } from '../lib/fermeture';
import { useLangue } from '../i18n';
import { Marque } from '../Marque';
import { Bouton } from '../ui/Bouton';
import type { Nouveautes } from '../types/protect';

/**
 * « Ce qui a change » — presente UNE fois apres chaque mise a jour.
 *
 * L'application se met a jour toute seule et redemarre : sans cet ecran, elle change de
 * visage sans un mot, et c'est exactement ce qui deroute quelqu'un qui ne l'a pas
 * developpee. L'ecran reprend l'historique deja tenu dans versions.ts — celui des
 * reglages — borne a ce qui est arrive DEPUIS la derniere version vue.
 *
 * Il ne parait jamais a la premiere installation : un nouvel utilisateur n'a pas de
 * « depuis », et l'accueillir par une liste de correctifs serait un contresens.
 */

/** Meme comparaison que le processus principal : champ par champ, numerique. */
function plusRecente(a: string, b: string): boolean {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  }
  return false;
}

export function NouveautesScreen({ nouveautes, onFermer }: {
  nouveautes: Nouveautes;
  onFermer: () => void;
}) {
  const t = useLangue();
  /* Elle s'ouvre et se referme animee : « onFermer » n'est appele qu'a la fin. */
  const { part, fermer, ref: voile } = useFermetureAnimee(onFermer);

  /* Les versions arrivees depuis la derniere vue, la plus recente en premier. */
  const entrees = useMemo(
    () => VERSIONS.filter((v) =>
      plusRecente(v.version, nouveautes.de) && !plusRecente(v.version, nouveautes.a)),
    [nouveautes],
  );

  useEffect(() => {
    const auClavier = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); fermer(); }
    };
    window.addEventListener('keydown', auClavier, true);
    return () => window.removeEventListener('keydown', auClavier, true);
  }, [fermer]);

  /* Rien a montrer — l'ecart existe mais l'historique n'en parle pas. On s'efface. */
  useEffect(() => { if (!entrees.length) onFermer(); }, [entrees, onFermer]);
  if (!entrees.length) return null;

  return (
    <div ref={voile}
         className={`m-voile absolute inset-0 z-50 grid place-items-center${part ? ' m-part' : ''}`}
         style={{ background: 'rgba(8,11,16,.72)' }}>
      {/* Une boîte pleine sur un voile sombre : plus de flou dessous (direction
          « Observatoire ») — la lisibilité n'en dépendait pas, le processus graphique si. */}
      <section role="dialog" aria-modal="true" aria-label={t('nouveautes.titre')}
               className={`m-boite flex max-h-[78vh] w-[min(580px,92vw)] flex-col overflow-hidden rounded-xl border border-line2 bg-card shadow-[0_40px_100px_-30px_rgba(0,0,0,.9)]${part ? ' m-part' : ''}`}>

        <div className="flex items-center gap-3 border-b border-line pb-3.5 pl-5 pr-4 pt-4">
          <Marque taille={28} />
          <div className="min-w-0 flex-1">
            <p className="text-titre font-semibold leading-tight">{t('nouveautes.titre')}</p>
            <p className="text-meta text-muted">{t('nouveautes.depuis', { version: nouveautes.de })}</p>
          </div>
          <Bouton variante="fantome" icone={X} titre={t('commun.fermerEchap')} onClick={fermer} />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {entrees.map((v) => (
            <div key={v.version} className="mb-4 last:mb-1">
              <h3 className="mb-2 flex items-baseline gap-2.5 font-semibold">
                <span className="font-mono text-accent-d">{v.version}</span>
                <span className="text-meta font-normal tabular-nums text-soft">{v.date}</span>
              </h3>
              <ul className="flex flex-col gap-1.5">
                {changementsDe(v).map((c, i) => (
                  <li key={i} className="flex gap-2 leading-relaxed text-muted">
                    <span aria-hidden className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-accent" />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex justify-end border-t border-line px-5 py-3.5">
          <Bouton variante="primaire" onClick={fermer}>{t('nouveautes.compris')}</Bouton>
        </div>
      </section>
    </div>
  );
}
