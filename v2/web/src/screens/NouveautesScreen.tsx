import { useEffect, useMemo } from 'react';
import { Sparkles, X } from 'lucide-react';
import { changementsDe, VERSIONS } from '../versions';
import { useFermetureAnimee } from '../lib/fermeture';
import { useLangue } from '../i18n';
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
         style={{ background: 'rgba(12,14,18,.72)', backdropFilter: 'blur(3px)' }}>
      {/* La boite est un ilot de verre : le voile sombre en dessous garantit la
          lisibilite quelle que soit la scene. */}
      <div className={`m-boite ilot flex max-h-[78vh] w-[min(560px,92vw)] flex-col overflow-hidden${part ? ' m-part' : ''}`}>

        <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
          <Sparkles className="h-4 w-4 shrink-0" style={{ color: 'var(--accent-d)' }} />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold leading-tight">{t('nouveautes.titre')}</p>
            <p className="text-[11.5px] text-soft">
              {t('nouveautes.depuis', { version: nouveautes.de })}
            </p>
          </div>
          <button onClick={fermer} aria-label={t('commun.fermerEchap')} title={t('commun.fermerEchap')}
                  className="grid h-7 w-7 place-items-center rounded-md text-soft transition-colors hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {entrees.map((v) => (
            <div key={v.version} className="mb-4 last:mb-1">
              <div className="mb-1.5 flex items-baseline gap-2">
                <span className="font-mono text-[12.5px]" style={{ color: 'var(--accent-d)' }}>
                  {v.version}
                </span>
                <span className="text-[11px] text-soft">{v.date}</span>
              </div>
              <ul className="flex flex-col gap-1.5">
                {changementsDe(v).map((c, i) => (
                  <li key={i} className="flex gap-2 text-[12.5px] leading-relaxed text-muted">
                    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full"
                          style={{ background: 'var(--accent)' }} />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-line px-4 py-3">
          <button onClick={fermer}
                  className="m-pression w-full rounded-lg py-2 text-[13px] font-semibold transition-opacity hover:opacity-90"
                  style={{ background: 'var(--accent)', color: '#1b1e23' }}>
            {t('nouveautes.compris')}
          </button>
        </div>
      </div>
    </div>
  );
}
