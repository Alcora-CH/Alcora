import { useId } from 'react';
import { Info as IconeInfo } from 'lucide-react';
import { t, useLangue } from '../i18n';

/**
 * Le « i » : le détail qu'une rangée ne dit plus, au survol ou au clavier — règle « Clarté
 * avant texte » (CLAUDE.md, 24.10.2026) : le pourquoi n'occupe pas l'écran, il reste à portée.
 *
 * La bulle s'ouvre VERS LE BAS, et rien autour ne la rogne : sur la maquette, une bulle qui
 * montait sortait de sa carte et disparaissait (relevé de Thomas, 24.10.2026).
 */
export function Info({ children }: { children: string }) {
  useLangue();
  const id = useId();
  return (
    <span className="info-bulle relative inline-flex shrink-0">
      <button type="button" aria-describedby={id} aria-label={t('commun.plusInfo')}
              className="grid h-[18px] w-[18px] place-items-center rounded-full text-soft transition-colors hover:text-ink focus-visible:text-ink">
        <IconeInfo size={15} aria-hidden />
      </button>
      <span role="tooltip" id={id} className="info-bulle-texte">{children}</span>
    </span>
  );
}
