import type { HTMLAttributes } from 'react';
import { cx } from './cx';

/**
 * Les pièces du cadre commun à tous les écrans (maquette A, 23.10.2026).
 *
 *   EnTete  — le titre de l'écran, sa précision, ses actions à droite ;
 *   Carte   — la surface de l'instrument, sur laquelle tout se pose ;
 *   Section — un titre de section et ce qu'il regroupe ;
 *   Rangee  — une ligne de réglage : ce que c'est et ce que ça fait à gauche, la commande
 *             à droite. Toutes les rangées se ressemblent : c'est ce qui rend un écran de
 *             réglages lisible d'un coup d'œil ;
 *   Touche  — une touche du clavier, dans un texte ou dans la fenêtre des raccourcis.
 */

export function EnTete({ titre, precision, actions, children }: {
  titre: string;
  precision?: React.ReactNode;
  actions?: React.ReactNode;
  /** Ce qui suit le titre, à sa droite (les puces de caméras de la relecture). */
  children?: React.ReactNode;
}) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-line bg-card pl-6 pr-5">
      <h1 className="text-ecran font-semibold">{titre}</h1>
      {precision && <span className="truncate text-corps text-muted">{precision}</span>}
      {children}
      {actions && <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Carte({ className, ...reste }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('rounded-xl border border-line2 bg-card', className)} {...reste} />;
}

export function Section({ titre, children, className, id }: {
  titre: string;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={className}>
      <h2 className="mb-2.5 text-titre font-semibold">{titre}</h2>
      {children}
    </section>
  );
}

export function Rangee({ titre, explication, children }: {
  titre?: React.ReactNode;
  explication?: React.ReactNode;
  /** La commande, à droite. */
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-6 px-[18px] py-4 [&+&]:border-t [&+&]:border-line">
      <div className="min-w-0 flex-1">
        {titre && <div className="text-corps font-medium">{titre}</div>}
        {explication && <p className="mt-[3px] text-meta leading-normal text-muted">{explication}</p>}
      </div>
      {children}
    </div>
  );
}

export function Touche({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-[5px] border border-line2 px-[5px] font-mono text-micro leading-[18px] text-soft">
      {children}
    </kbd>
  );
}
