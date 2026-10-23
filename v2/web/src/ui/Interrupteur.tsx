import { cx } from './cx';

/**
 * L'interrupteur : un réglage qui s'applique tout de suite, sans bouton « Enregistrer ».
 * Vert pour ce qui VEILLE (la veille d'Alcora), or pour le reste.
 */
export function Interrupteur({ allume, onChange, etiquette, ton = 'or', desactive }: {
  allume: boolean;
  onChange: (v: boolean) => void;
  /** Nom du réglage pour le lecteur d'écran. */
  etiquette: string;
  ton?: 'or' | 'vert';
  desactive?: boolean;
}) {
  return (
    <button type="button" role="switch" aria-checked={allume} aria-label={etiquette}
            disabled={desactive} onClick={() => onChange(!allume)}
            className={cx(
              'relative h-[22px] w-10 shrink-0 rounded-full transition-colors disabled:opacity-40',
              allume ? (ton === 'vert' ? 'bg-ok' : 'bg-accent') : 'bg-card3',
            )}>
      <span aria-hidden
            className={cx('absolute top-[3px] h-4 w-4 rounded-full transition-[left] duration-150',
                          allume ? 'left-[21px] bg-sur-accent' : 'left-[3px] bg-[#5d6676]')} />
    </button>
  );
}
