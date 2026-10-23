import { cx } from './cx';

/**
 * Le sélecteur segmenté : un choix parmi quelques-uns, tous visibles (période, vitesse,
 * langue, « quand » d'une veille). Au-delà de six options, c'est une liste qu'il faut.
 */
export function Segment<V extends string | number>({ options, valeur, onChange, etiquette, className }: {
  options: ReadonlyArray<{ valeur: V; libelle: React.ReactNode; titre?: string }>;
  valeur: V;
  onChange: (v: V) => void;
  /** Nom du groupe pour le lecteur d'écran. */
  etiquette: string;
  className?: string;
}) {
  return (
    <div role="group" aria-label={etiquette}
         className={cx('inline-flex w-fit shrink-0 rounded-[9px] border border-line2 bg-card2 p-[3px]', className)}>
      {options.map((o) => (
        <button key={String(o.valeur)} type="button" title={o.titre}
                aria-pressed={o.valeur === valeur}
                onClick={() => onChange(o.valeur)}
                className="h-[26px] whitespace-nowrap rounded-md px-[11px] text-meta tabular-nums text-muted
                           transition-colors hover:text-ink aria-pressed:bg-accent-soft aria-pressed:text-accent">
          {o.libelle}
        </button>
      ))}
    </div>
  );
}
