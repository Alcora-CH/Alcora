import type { InputHTMLAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cx } from './cx';

/**
 * Le champ de saisie, avec son libellé et son aide AU-DESSUS et EN DESSOUS — jamais dans
 * le champ seul : un exemple en filigrane disparaît dès la première lettre.
 *
 * `fin` reçoit ce qui se pose au bout du champ (l'œil qui montre un mot de passe).
 */
export function Champ({ libelle, aide, icone: Icone, fin, chasseFixe, className, id, ...reste }:
  InputHTMLAttributes<HTMLInputElement> & {
    libelle?: string;
    aide?: React.ReactNode;
    icone?: LucideIcon;
    fin?: React.ReactNode;
    /** Pour une clé ou un code : chaque caractère se lit. */
    chasseFixe?: boolean;
  }) {
  return (
    <label className={cx('block', className)} htmlFor={id}>
      {libelle && <span className="mb-[7px] block text-corps font-semibold">{libelle}</span>}
      <span className="flex h-9 items-center gap-2 rounded-lg border border-line2 bg-card2 px-3
                       transition-colors focus-within:border-accent-ligne">
        {Icone && <Icone className="h-4 w-4 shrink-0 text-soft" aria-hidden />}
        <input id={id}
               className={cx('min-w-0 flex-1 bg-transparent text-corps text-ink outline-none',
                             'placeholder:text-soft', chasseFixe && 'font-mono tracking-wide')}
               {...reste} />
        {fin}
      </span>
      {aide && <span className="mt-1.5 block text-meta leading-relaxed text-soft">{aide}</span>}
    </label>
  );
}
