import { useEffect, useRef } from 'react';
import { Keyboard, X } from 'lucide-react';
import { t, useLangue } from '../i18n';
import { useFermetureAnimee } from '../lib/fermeture';
import { usePiegeFocus } from '../lib/piegeFocus';
import { Bouton } from '../ui/Bouton';
import { Touche } from '../ui/Cadre';

/**
 * La fenêtre des raccourcis — touche « ? », ou la barre d'état.
 *
 * Avant elle, les gestes du mur n'étaient dits nulle part : réorganiser à la souris,
 * isoler d'un double-clic ou d'un chiffre, zoomer à la molette, tout se découvrait par
 * hasard ou jamais (inventaire du 23.10.2026). Chaque ligne ci-dessous correspond à un
 * geste RÉELLEMENT câblé — App.tsx, RelectureScreen.tsx, LecteurExtrait.tsx,
 * useZoomVideo.ts : un raccourci annoncé qui ne fait rien serait pire que pas de liste.
 *
 * Elle ne fait que se lire : un clic à côté la referme, contrairement à une fenêtre de
 * saisie.
 */

function Groupe({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2.5 text-corps font-semibold">{titre}</h3>
      <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-2 text-corps">{children}</dl>
    </div>
  );
}

function Ligne({ geste, children }: { geste: React.ReactNode; children: React.ReactNode }) {
  return (
    <>
      <dt className="whitespace-nowrap">{geste}</dt>
      <dd className="text-muted">{children}</dd>
    </>
  );
}

export function Raccourcis({ onFermer }: { onFermer: () => void }) {
  useLangue();
  const { part, fermer, ref: voile } = useFermetureAnimee(onFermer);
  const boite = useRef<HTMLElement>(null);
  /* Le focus entre dans la fenêtre, y reste, et en ressort là où il était (lib/piegeFocus). */
  usePiegeFocus(boite, () => boite.current?.querySelector<HTMLElement>('button') ?? null);

  /* En capture : l'écouteur général de l'application traite aussi « Échap » — il ferait
     sortir du plein écran en même temps que la fenêtre se referme. */
  useEffect(() => {
    const auClavier = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === '?') { e.stopPropagation(); e.preventDefault(); fermer(); }
    };
    window.addEventListener('keydown', auClavier, true);
    return () => window.removeEventListener('keydown', auClavier, true);
  }, [fermer]);

  const fleches = <><Touche>←</Touche> <Touche>→</Touche></>;
  const zoom = <><Touche>+</Touche> <Touche>−</Touche></>;

  return (
    <div ref={voile}
         onClick={(e) => { if (e.target === e.currentTarget) fermer(); }}
         className={`m-voile absolute inset-0 z-50 grid place-items-center${part ? ' m-part' : ''}`}
         style={{ background: 'rgba(8,10,14,.72)' }}>
      <section ref={boite} role="dialog" aria-modal="true" aria-label={t('raccourcis.titre')}
               className={`m-boite flex max-h-[82vh] w-[min(880px,94vw)] flex-col overflow-hidden rounded-xl border border-line2 bg-card shadow-[0_40px_100px_-30px_rgba(0,0,0,.9)]${part ? ' m-part' : ''}`}>
        <div className="flex items-center gap-3 border-b border-line py-3.5 pl-5 pr-4">
          <Keyboard className="h-5 w-5 text-accent" aria-hidden />
          <h2 className="text-titre font-semibold">{t('raccourcis.titre')}</h2>
          <Bouton variante="fantome" icone={X} titre={t('commun.fermerEchap')} onClick={fermer} className="ml-auto" />
        </div>
        <div className="grid gap-x-7 gap-y-[22px] overflow-y-auto px-5 pb-[22px] pt-[18px] [grid-template-columns:repeat(auto-fit,minmax(250px,1fr))]">
          <Groupe titre={t('espace.direct')}>
            <Ligne geste={<><Touche>1</Touche> {t('raccourcis.a')} <Touche>9</Touche></>}>{t('raccourcis.isoler')}</Ligne>
            <Ligne geste={<Touche>0</Touche>}>{t('raccourcis.mosaique')}</Ligne>
            <Ligne geste={t('raccourcis.doubleClic')}>{t('raccourcis.doubleClicFait')}</Ligne>
            <Ligne geste={t('raccourcis.glisser')}>{t('raccourcis.glisserFait')}</Ligne>
            <Ligne geste={t('raccourcis.molette')}>{t('raccourcis.moletteFait')}</Ligne>
            <Ligne geste={zoom}>{t('raccourcis.zoomIsolee')}</Ligne>
            <Ligne geste={<Touche>F11</Touche>}>{t('video.pleinEcran')}</Ligne>
            <Ligne geste={<Touche>{t('touche.echap')}</Touche>}>{t('raccourcis.echapDirect')}</Ligne>
          </Groupe>
          <Groupe titre={t('espace.relecture')}>
            <Ligne geste={<Touche>{t('touche.espace')}</Touche>}>{t('raccourcis.lecture')}</Ligne>
            <Ligne geste={fleches}>{t('raccourcis.dixSecondes')}</Ligne>
            <Ligne geste={zoom}>{t('raccourcis.zoomer')}</Ligne>
            <Ligne geste={t('raccourcis.molette')}>{t('raccourcis.moletteFait')}</Ligne>
            <Ligne geste={t('raccourcis.clicFrise')}>{t('raccourcis.clicFriseFait')}</Ligne>
            <Ligne geste={t('raccourcis.moletteFrise')}>{t('raccourcis.moletteFriseFait')}</Ligne>
          </Groupe>
          <div className="flex flex-col gap-[22px]">
            <Groupe titre={t('raccourcis.sequence')}>
              <Ligne geste={<Touche>{t('touche.espace')}</Touche>}>{t('raccourcis.lecture')}</Ligne>
              <Ligne geste={fleches}>{t('raccourcis.imageParImage')}</Ligne>
              <Ligne geste={zoom}>{t('raccourcis.zoomer')}</Ligne>
              <Ligne geste={t('raccourcis.molette')}>{t('raccourcis.moletteFait')}</Ligne>
              <Ligne geste={<Touche>{t('touche.echap')}</Touche>}>{t('commun.fermer')}</Ligne>
            </Groupe>
            <Groupe titre={t('raccourcis.partout')}>
              <Ligne geste={<Touche>?</Touche>}>{t('raccourcis.afficher')}</Ligne>
            </Groupe>
          </div>
        </div>
      </section>
    </div>
  );
}
