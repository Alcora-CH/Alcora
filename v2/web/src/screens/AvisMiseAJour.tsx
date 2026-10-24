import { ArrowRight, Sparkles, X } from 'lucide-react';
import { t, useLangue } from '../i18n';
import { Bouton } from '../ui/Bouton';

/**
 * « Alcora s'est mise à jour » — d'une ligne, dans le direct, une fois après chaque mise à
 * jour.
 *
 * L'application se met à jour toute seule et redémarre : sans un mot, elle changerait de
 * visage, et c'est exactement ce qui déroute quelqu'un qui ne l'a pas développée. C'était une
 * fenêtre posée par-dessus tout au lancement ; c'est désormais une ligne qui ne cache rien
 * (décision de Thomas, 24.10.2026 : « une fenêtre unique tout-en-un »). Les notes elles-mêmes
 * vivent dans les Réglages, où les versions arrivées depuis se marquent « Nouveau ».
 *
 * Elle ne paraît jamais à la première installation : un nouvel utilisateur n'a pas de
 * « depuis » (c'est le processus principal qui en décide).
 */
export function AvisMiseAJour({ version, onVoir, onFermer }: {
  version: string;
  /** Les notes : les Réglages, à « Ce qui a changé ». */
  onVoir: () => void;
  onFermer: () => void;
}) {
  useLangue();
  return (
    <div role="status"
         className="m-surgit mx-5 mt-4 flex shrink-0 items-center gap-2.5 rounded-[10px] border border-accent-ligne bg-accent-soft py-1.5 pl-3.5 pr-1.5">
      <Sparkles className="h-4 w-4 shrink-0 text-accent" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{t('nouveautes.installee', { version })}</span>
      <Bouton variante="fantome" taille="petit" onClick={onVoir}>
        {t('reglages.historique.titre')} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </Bouton>
      <Bouton variante="fantome" taille="petit" icone={X} titre={t('commun.fermer')} onClick={onFermer} />
    </div>
  );
}
