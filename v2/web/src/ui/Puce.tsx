import { cx } from './cx';

/**
 * La puce : un filtre qu'on allume ou qu'on éteint (sujet, caméra, couleur, filtre de la
 * pellicule). Le compte réel se colle au choix — c'est ce que Protect ne dit nulle part,
 * et ce qui évite de cocher une impasse.
 *
 * `echantillon` pose une pastille de couleur devant le libellé (couleur d'un véhicule).
 * `urgence` distingue les sujets qui ne se négligent pas (verre, fumée, sirène, monoxyde).
 */
export function Puce({ allumee, onClick, children, compte, tonCompte, echantillon, urgence, titre, className }: {
  allumee: boolean;
  onClick: () => void;
  children: React.ReactNode;
  compte?: React.ReactNode;
  /** Couleur du compte quand elle porte un sens (volume attendu d'une veille). */
  tonCompte?: string;
  echantillon?: string;
  urgence?: boolean;
  titre?: string;
  className?: string;
}) {
  return (
    <button type="button" aria-pressed={allumee} onClick={onClick} title={titre}
            className={cx(
              'inline-flex h-7 shrink-0 items-center gap-[7px] rounded-full border px-[11px] text-meta',
              'transition-colors hover:text-ink aria-pressed:border-accent-ligne aria-pressed:bg-accent-soft',
              'aria-pressed:text-accent',
              urgence ? 'border-[rgba(227,115,95,.4)] text-muted' : 'border-line2 text-muted',
              className,
            )}>
      {echantillon && (
        <span aria-hidden className="h-2.5 w-2.5 rounded-full border border-white/25"
              style={{ background: echantillon }} />
      )}
      {children}
      {compte !== undefined && (
        <span className="text-micro tabular-nums opacity-75" style={tonCompte ? { color: tonCompte } : undefined}>
          {compte}
        </span>
      )}
    </button>
  );
}
