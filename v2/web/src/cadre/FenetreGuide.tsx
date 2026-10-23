import { useEffect, useRef } from 'react';
import { BookOpen, X } from 'lucide-react';
import { t, useLangue } from '../i18n';
import { useFermetureAnimee } from '../lib/fermeture';
import { Bouton } from '../ui/Bouton';

/**
 * Le guide d'activation du RTSP, hors de l'écran de connexion.
 *
 * Il ne vivait QUE là : un lien « Voir le guide » ailleurs menait aux réglages, d'où
 * « Modifier la connexion » y menait à son tour — après avoir effacé le mot de passe.
 * C'est le même fichier embarqué (guide-rtsp.html), dans le même cadre isolé :
 * « sandbox » sans « allow-same-origin », il ne voit rien de l'application.
 *
 * Une fenêtre qui ne fait que se lire : un clic à côté la referme.
 */
export function FenetreGuide({ onFermer }: { onFermer: () => void }) {
  useLangue();
  const { part, fermer, ref: voile } = useFermetureAnimee(onFermer);
  const boite = useRef<HTMLElement>(null);

  useEffect(() => {
    const avant = document.activeElement as HTMLElement | null;
    boite.current?.querySelector<HTMLElement>('button')?.focus();
    // En capture : « Échap » ne doit fermer qu'elle, pas aussi le plein écran.
    const clavier = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); fermer(); }
    };
    window.addEventListener('keydown', clavier, true);
    return () => { window.removeEventListener('keydown', clavier, true); avant?.focus?.(); };
  }, [fermer]);

  return (
    <div ref={voile}
         onClick={(e) => { if (e.target === e.currentTarget) fermer(); }}
         className={`m-voile absolute inset-0 z-50 grid place-items-center${part ? ' m-part' : ''}`}
         style={{ background: 'rgba(8,10,14,.72)' }}>
      <section ref={boite} role="dialog" aria-modal="true" aria-label={t('setup.prealable.titre')}
               className={`m-boite flex h-[min(820px,88vh)] w-[min(1100px,94vw)] flex-col overflow-hidden rounded-xl border border-line2 bg-card shadow-[0_40px_100px_-30px_rgba(0,0,0,.9)]${part ? ' m-part' : ''}`}>
        <div className="flex items-center gap-3 border-b border-line py-3.5 pl-5 pr-4">
          <BookOpen className="h-5 w-5 text-accent" aria-hidden />
          <div className="min-w-0">
            <h2 className="text-titre font-semibold">{t('setup.prealable.titre')}</h2>
            <p className="truncate text-meta text-muted">{t('setup.prealable.rtsp')}</p>
          </div>
          <Bouton variante="fantome" icone={X} titre={t('commun.fermerEchap')} onClick={fermer} className="ml-auto" />
        </div>
        <iframe src="guide-rtsp.html?integre=1" title={t('camera.guide')} sandbox="allow-scripts"
                className="min-h-0 w-full flex-1" style={{ border: 0, background: 'rgba(10,12,16,.35)' }} />
      </section>
    </div>
  );
}
