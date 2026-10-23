import { useLayoutEffect, useRef, useState } from 'react';
import { Activity, Bell, History, ScanSearch, Settings, Video, type LucideIcon } from 'lucide-react';
import { Marque } from '../Marque';
import { useLangue } from '../i18n';
import { useAlertes } from '../lib/alertes';
import { cx } from '../ui/cx';
import type { Cle } from '../i18n/fr';

/**
 * Le rail — direction « Observatoire », maquette A du 23.10.2026.
 *
 * Les espaces y portent leur NOM sous leur icône : quatre pictogrammes nus, dont le sens
 * ne se lisait qu'en infobulle, faisaient partie de ce qui donnait à l'application son air
 * de jouet. L'ordre est celui du temps — maintenant, avant, chercher, prévenir — puis, en
 * pied, ce qui concerne l'outil lui-même : Système et Réglages.
 */

export type Espace = 'direct' | 'relecture' | 'detections' | 'alertes' | 'systeme' | 'reglages';

interface Entree { id: Espace; cle: Cle; Icone: LucideIcon }

const HAUT: Entree[] = [
  { id: 'direct', cle: 'espace.direct', Icone: Video },
  { id: 'relecture', cle: 'espace.relecture', Icone: History },
  { id: 'detections', cle: 'espace.detections', Icone: ScanSearch },
  { id: 'alertes', cle: 'espace.alertes', Icone: Bell },
];
const BAS: Entree[] = [
  { id: 'systeme', cle: 'espace.systeme', Icone: Activity },
  { id: 'reglages', cle: 'espace.reglages', Icone: Settings },
];

/** Le trait d'or est en retrait de l'entrée, en haut comme en bas (maquette : 12 px). */
const RETRAIT = 12;

export function Rail({ espace, onChoisir, marqueAnimee }: {
  espace: string;
  onChoisir: (id: Espace) => void;
  /** La marque ne tourne que si l'apparence animée est choisie (Réglages, « Fond animé »). */
  marqueAnimee: boolean;
}) {
  const t = useLangue();
  /* Les alertes arrivées depuis la dernière visite de l'historique : une bulle de Windows
     manquée (absent, écran verrouillé) se voit quand même en revenant. */
  const { nonVues } = useAlertes();
  const boutons = useRef(new Map<string, HTMLButtonElement>());
  const rail = useRef<HTMLElement>(null);

  /*
   * Le repère SUIT l'espace choisi au lieu de sauter : c'est ce détail qui relie deux
   * écrans. On ne déplace que la transformée du trait — animer « top » recalculerait la
   * mise en page à chaque image, pendant que les flux décodent. Mesuré avant de peindre
   * (useLayoutEffect) : jamais une image avec le trait au mauvais endroit.
   */
  const [repere, setRepere] = useState<{ y: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const mesurer = () => {
      const b = boutons.current.get(espace);
      setRepere(b ? { y: b.offsetTop, h: b.offsetHeight } : null);
    };
    mesurer();
    /* Système et Réglages sont poussés en pied par un ressort : leur place suit la hauteur
       de la fenêtre. Sans cet observateur, agrandir la fenêtre laissait le trait en l'air. */
    const ro = new ResizeObserver(mesurer);
    if (rail.current) ro.observe(rail.current);
    return () => ro.disconnect();
  }, [espace, t]);

  const entree = ({ id, cle, Icone }: Entree) => {
    const actif = espace === id;
    return (
      <button key={id} type="button" onClick={() => onChoisir(id)}
              aria-current={actif ? 'page' : undefined}
              ref={(el) => { if (el) boutons.current.set(id, el); else boutons.current.delete(id); }}
              className={cx(
                'm-pression relative flex flex-col items-center gap-[5px] whitespace-nowrap rounded-[10px] px-1.5 pb-2 pt-2.5 text-meta transition-colors',
                actif ? 'bg-card2 text-ink' : 'text-muted hover:bg-card2 hover:text-ink',
              )}>
        <Icone className={cx('h-5 w-5', actif && 'text-accent')} aria-hidden />
        {t(cle)}
        {id === 'alertes' && nonVues > 0 && (
          <>
            <span aria-hidden
                  className="absolute right-3 top-1 min-w-[17px] rounded-full bg-accent px-1 text-center text-[10.5px] font-bold leading-[17px] text-sur-accent">
              {nonVues > 99 ? '99+' : nonVues}
            </span>
            <span className="sr-only">{nonVues === 1 ? t('historique.uneNonVue') : t('historique.nonVues', { n: nonVues })}</span>
          </>
        )}
      </button>
    );
  };

  return (
    /* Largeur minimale de la maquette, mais pas maximale : « Einstellungen » et
       « Impostazioni » ne tiennent pas dans 84 px, et un libellé coupé ne se lit plus. */
    <nav ref={rail} aria-label={t('rail.espaces')}
         className="relative flex min-w-[84px] shrink-0 flex-col gap-0.5 border-r border-line bg-card px-2 py-3.5">
      {repere && (
        <span aria-hidden
              className="pointer-events-none absolute left-0 top-0 w-[3px] rounded-r-[3px] bg-accent"
              style={{ height: repere.h - 2 * RETRAIT,
                       transform: `translateY(${repere.y + RETRAIT}px)`,
                       transition: 'transform var(--douceur) var(--pose)' }} />
      )}
      <div className="mb-2.5 grid h-11 place-items-center" title="Alcora">
        <Marque taille={30} anime={marqueAnimee} />
      </div>
      {HAUT.map(entree)}
      <div className="flex-1" />
      {BAS.map(entree)}
    </nav>
  );
}
