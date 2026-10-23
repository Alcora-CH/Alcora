import { useEffect, useMemo, useState } from 'react';
import { PanelRightClose } from 'lucide-react';
import { t, useLangue } from '../i18n';
import { parHeure, useActivite } from '../lib/activiteJour';
import { ceQuiAEteVu, ilYa } from '../lib/lisible';
import { Bouton } from '../ui/Bouton';
import type { DetectionVive } from '../types/protect';

/**
 * La colonne Activité du direct — maquette A du 23.10.2026.
 *
 * Ce que le panneau « Surveillance » disait de l'activité : combien aujourd'hui, heure par
 * heure, et les dernières détections, qu'un clic ouvre. Elle ne vit QUE sur le direct, à
 * droite du mur : c'est là qu'on regarde ce qui se passe ; sur les autres écrans elle ne
 * faisait que prendre de la place.
 *
 * Les récentes ne partent plus de rien au lancement : celles du jour remplissent la liste
 * jusqu'à ce que le direct en apporte de nouvelles.
 */

const RECENTES = 5;

export function ColonneActivite({ onOuvrir, onToutes, onMasquer }: {
  /** Une détection a été cliquée : le lecteur est tenu plus haut. */
  onOuvrir: (d: DetectionVive) => void;
  onToutes: () => void;
  onMasquer: () => void;
}) {
  useLangue();
  const { dujour, partiel, vives } = useActivite();

  /* « il y a 12 s » vieillit : sans ce battement, il ne serait vrai qu'une fois. */
  const [, setBattement] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setBattement((n) => n + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  const { heures, depuis } = useMemo(() => parHeure(dujour ?? [], partiel), [dujour, partiel]);
  const maxi = Math.max(1, ...heures);

  /* Les vives d'abord (elles portent l'état de la détection en cours), puis celles du jour
     que le direct n'a pas apportées. Triées sur l'heure : la plus récente en tête. */
  const recentes = useMemo(() => {
    const vues = new Set(vives.map((d) => d.id));
    const dujourVives: (DetectionVive & { vignette?: boolean })[] = (dujour ?? [])
      .filter((d) => !vues.has(d.id))
      .map((d) => ({ ...d, commence: false }));
    return [...vives, ...dujourVives]
      .sort((a, b) => (b.debut ?? 0) - (a.debut ?? 0))
      .slice(0, RECENTES);
  }, [dujour, vives]);

  return (
    <aside aria-label={t('activite.titre')}
           className="flex w-[312px] shrink-0 flex-col border-l border-line bg-card">
      <div className="flex h-16 shrink-0 items-center border-b border-line pl-5 pr-3">
        <h2 className="text-titre font-semibold">{t('activite.titre')}</h2>
        <Bouton variante="fantome" icone={PanelRightClose} titre={t('activite.masquer')}
                onClick={onMasquer} className="ml-auto" />
      </div>

      {/* ---- aujourd'hui, heure par heure ---- */}
      {dujour !== null && (
        <div className="border-b border-line px-5 py-[18px]">
          <h3 className="mb-3 flex items-baseline gap-2 text-corps font-semibold">
            {t('colonne.aujourdhui')}
            <span className="ml-auto font-normal tabular-nums text-muted">
              {partiel ? '≥ ' : ''}{dujour.length}
            </span>
          </h3>
          <div className="flex h-14 items-end gap-[2px]">
            {heures.map((n, h) => {
              // Heure non couverte par la lecture : elle se dit inconnue, jamais vide.
              const su = h >= depuis;
              const heure = `${String(h).padStart(2, '0')}h`;
              return (
                <div key={h} className="flex-1 rounded-t-[2px]"
                     title={su ? `${heure} — ${n}` : `${heure} — ${t('colonne.nonLu')}`}
                     style={su
                       ? { height: n ? `${Math.max(4, (n / maxi) * 100)}%` : '2px',
                           background: n ? 'var(--accent)' : 'var(--card3)' }
                       : { height: '100%',
                           background: 'repeating-linear-gradient(135deg, var(--card2) 0 3px, var(--card3) 3px 6px)' }} />
              );
            })}
          </div>
          <div className="mt-1.5 flex justify-between text-micro tabular-nums text-soft">
            {[0, 6, 12, 18, 24].map((h) => <span key={h}>{h} h</span>)}
          </div>
        </div>
      )}

      {/* ---- les dernières ---- */}
      <h3 className="px-5 pb-1.5 pt-[18px] text-corps font-semibold">{t('activite.recentes')}</h3>
      {recentes.length === 0 ? (
        <p className="px-5 py-2 text-meta text-soft">
          {dujour === null ? '…' : t('activite.aucune')}
        </p>
      ) : (
        <ul className="min-h-0 overflow-y-auto px-2.5 py-1.5">
          {recentes.map((d) => {
            /*
             * Tant que la détection COURT, il n'existe aucune vignette : on montre l'instantané
             * de la caméra, daté du début pour que le navigateur le garde. Finie, la vraie
             * vignette de l'événement prend la place — si le contrôleur en a fait une.
             */
            const finie = Boolean(d.fin && d.id);
            const aVignette = finie && (d as { vignette?: boolean }).vignette !== false;
            const src = aVignette ? `/vignette/${d.id}`
              : !finie && d.camera ? `/instantane/${d.camera}?t=${d.debut ?? 0}` : null;
            return (
              <li key={d.id ?? String(d.debut)}>
                <button type="button" onClick={() => onOuvrir(d)} disabled={!d.id || d.debut === null}
                        className="flex w-full items-center gap-3 rounded-[9px] px-2.5 py-2 text-left transition-colors hover:bg-card2 disabled:cursor-default disabled:hover:bg-transparent">
                  <span className="h-10 w-[72px] shrink-0 overflow-hidden rounded-md bg-card2">
                    {src && (
                      <img src={src} alt="" loading="lazy" className="h-full w-full object-cover"
                           onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{ceQuiAEteVu(d)}</span>
                    <span className="block truncate text-meta text-muted">{d.cameraNom ?? ''}</span>
                  </span>
                  <span className="shrink-0 text-meta tabular-nums text-soft">
                    {d.debut ? ilYa(d.debut) : ''}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <button type="button" onClick={onToutes}
              className="m-pression mx-5 mb-4 mt-1 self-start text-corps text-accent hover:text-accent-d">
        {t('activite.toutes')}
      </button>
    </aside>
  );
}
