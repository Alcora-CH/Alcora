import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Eye, EyeOff, LayoutGrid } from 'lucide-react';
import { t, useLangue } from '../i18n';
import { seuleVisible, titreMasquage } from '../lib/masquage';
import { bestChannel } from '../video/channel';
import { Bouton } from '../ui/Bouton';
import { cx } from '../ui/cx';
import type { DiscoveredCamera } from '../types/protect';

/**
 * Le menu « Caméras » du direct — maquette A du 23.10.2026.
 *
 * Il reprend la liste du panneau « Surveillance » : chaque caméra, en ligne ou non, sa
 * définition la plus fine ou « RTSP désactivé », et ce qu'il faut pour la masquer ou la
 * réafficher. Le remède du RTSP et le lien vers le guide suivent la liste, une seule fois.
 *
 * C'est un menu, pas une fenêtre de saisie : un clic ailleurs le referme.
 */
export function MenuCameras({ cameras, masquees, onBasculer, onGuide, sombre }: {
  cameras: DiscoveredCamera[];
  masquees: string[];
  onBasculer: (id: string) => void;
  onGuide: () => void;
  /** En plein écran, le bouton se pose sur l'image : il prend la matière des voiles. */
  sombre?: boolean;
}) {
  useLangue();
  const [ouvert, setOuvert] = useState(false);
  const zone = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e: PointerEvent) => {
      if (!zone.current?.contains(e.target as Node)) setOuvert(false);
    };
    /* En capture : « Échap » referme le menu, et seulement lui — sans quoi l'écouteur
       général ferait aussi sortir du plein écran ou de la caméra isolée. */
    const clavier = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); setOuvert(false); }
    };
    document.addEventListener('pointerdown', dehors);
    window.addEventListener('keydown', clavier, true);
    return () => {
      document.removeEventListener('pointerdown', dehors);
      window.removeEventListener('keydown', clavier, true);
    };
  }, [ouvert]);

  const visibles = cameras.filter((c) => !masquees.includes(c.id)).length;

  return (
    <div ref={zone} className="relative">
      <Bouton icone={LayoutGrid} aria-expanded={ouvert} aria-haspopup="true"
              onClick={() => setOuvert((o) => !o)}
              /* « veil » n'est pas dans une couche Tailwind : il l'emporte sur le fond du bouton. */
              className={cx(sombre && 'veil')} style={sombre ? { color: 'var(--on-1)' } : undefined}>
        {t('systeme.cameras')}
        <span className={cx('text-meta tabular-nums', sombre ? 'text-on-3' : 'text-soft')}>
          {visibles}/{cameras.length}
        </span>
        <ChevronDown className="h-4 w-4" aria-hidden />
      </Bouton>

      {ouvert && (
        <div role="menu" aria-label={t('systeme.cameras')}
             className="m-boite absolute right-0 top-[calc(100%+8px)] z-40 w-[360px] rounded-xl border border-line2 bg-card p-2 shadow-[0_30px_70px_-20px_rgba(0,0,0,.85)]">
          {cameras.length === 0 && (
            <p className="px-2.5 py-2 text-corps text-soft">{t('app.aucuneCamera')}</p>
          )}
          {cameras.map((c) => {
            const best = bestChannel(c);
            const masquee = masquees.includes(c.id);
            return (
              <div key={c.id}
                   className={cx('flex items-center gap-3 rounded-[9px] px-2.5 py-[9px] hover:bg-card2',
                     masquee && 'opacity-60')}>
                <span aria-hidden className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: c.online ? 'var(--ok)' : 'var(--soft)' }} />
                <div className="min-w-0 flex-1">
                  <div className="truncate">{c.name}</div>
                  {/* Sans canal diffusable, la CAUSE plutôt que le constat. */}
                  <div className={cx('text-meta tabular-nums', best ? 'text-muted' : 'text-warn')}>
                    {best ? `${best.width} × ${best.height}` : t('camera.rtspDesactive')}
                  </div>
                </div>
                <Bouton taille="petit" icone={masquee ? EyeOff : Eye} role="menuitemcheckbox"
                        aria-checked={!masquee}
                        disabled={seuleVisible(cameras, masquees, c.id)}
                        titre={titreMasquage(cameras, masquees, c.id)}
                        aria-label={masquee ? t('app.afficherCamera', { nom: c.name })
                          : t('app.masquerCamera', { nom: c.name })}
                        onClick={() => onBasculer(c.id)}>
                  {masquee ? t('systeme.masquee') : t('systeme.affichee')}
                </Bouton>
              </div>
            );
          })}
          {/* Le REMÈDE, une seule fois pour toutes les caméras concernées : le répéter sous
              chacune noierait la liste ; ne le dire nulle part laissait un nouvel
              utilisateur devant des caméras muettes sans le moindre geste à tenter. */}
          {cameras.some((c) => !bestChannel(c)) && (
            <div className="border-t border-line px-2.5 pb-1.5 pt-2.5">
              <p className="text-meta leading-normal text-warn">{t('camera.rtspRemede')}</p>
              <button type="button" onClick={() => { setOuvert(false); onGuide(); }}
                      className="m-pression mt-1.5 text-meta text-accent-d underline decoration-dotted underline-offset-2">
                {t('camera.guide')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
