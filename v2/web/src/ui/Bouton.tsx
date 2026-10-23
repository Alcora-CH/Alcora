import type { ButtonHTMLAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cx } from './cx';

/**
 * LE bouton de l'application — direction « Observatoire », maquette A du 23.10.2026.
 *
 * L'inventaire du même jour comptait 63 boutons stylés un par un, sur neuf hauteurs.
 * Celui-ci en a deux (32 et 28 px) et une poignée de variantes, chacune pour un rôle :
 *   normal   — l'action ordinaire ;
 *   primaire — l'action que l'écran attend (une par écran, au plus) ;
 *   fantome  — l'action discrète, qui ne prend pas le regard (barres d'outils) ;
 *   actif    — l'état allumé d'une bascule (le son coupé ou non, le zoom) ;
 *   vert     — revenir au direct, la seule action « vivante » ;
 *   danger   — l'action qui efface.
 *
 * Un bouton sans libellé visible (`icone` seule) DOIT porter `titre` : c'est son nom pour le
 * lecteur d'écran et son infobulle. Le type l'exige.
 */
type Variante = 'normal' | 'primaire' | 'fantome' | 'actif' | 'vert' | 'danger';

type Commun = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'title'> & {
  variante?: Variante;
  taille?: 'normal' | 'petit';
  icone?: LucideIcon;
};
type AvecLibelle = Commun & { children: React.ReactNode; titre?: string };
type IconeSeule = Commun & { children?: undefined; icone: LucideIcon; titre: string };

const VARIANTES: Record<Variante, string> = {
  normal: 'border-line2 bg-card2 text-ink hover:bg-card3',
  primaire: 'border-accent bg-accent font-semibold text-sur-accent hover:brightness-110',
  fantome: 'border-transparent bg-transparent text-muted hover:bg-card2 hover:text-ink',
  actif: 'border-accent-ligne bg-accent-soft text-accent',
  vert: 'border-[rgba(116,196,148,.35)] bg-ok-soft text-ok hover:brightness-110',
  danger: 'border-bad bg-bad font-semibold text-sur-bad hover:brightness-110',
};

export function Bouton({
  variante = 'normal', taille = 'normal', icone: Icone, titre, children, className, type, ...reste
}: AvecLibelle | IconeSeule) {
  const petit = taille === 'petit';
  const seule = children === undefined;
  return (
    <button
      type={type ?? 'button'}
      title={titre}
      aria-label={seule ? titre : undefined}
      className={cx(
        'm-pression inline-flex shrink-0 items-center justify-center whitespace-nowrap border',
        'transition-colors disabled:cursor-default disabled:opacity-35',
        petit ? 'h-7 gap-1.5 rounded-[7px] text-meta' : 'h-8 gap-[7px] rounded-lg text-corps',
        seule ? (petit ? 'w-7' : 'w-8') : (petit ? 'px-[9px]' : 'px-3'),
        VARIANTES[variante],
        className,
      )}
      {...reste}
    >
      {Icone && <Icone className="h-4 w-4 shrink-0" aria-hidden />}
      {children}
    </button>
  );
}
