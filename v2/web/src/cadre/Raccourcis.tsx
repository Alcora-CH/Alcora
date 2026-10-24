import { useEffect } from 'react';
import { X } from 'lucide-react';
import { t, useLangue } from '../i18n';
import { Bouton } from '../ui/Bouton';
import { Touche } from '../ui/Cadre';

/**
 * Le panneau des raccourcis — touche « ? », ou la barre d'état.
 *
 * Avant lui, les gestes du mur n'étaient dits nulle part : réorganiser à la souris, isoler
 * d'un double-clic ou d'un chiffre, zoomer à la molette, tout se découvrait par hasard ou
 * jamais (inventaire du 23.10.2026). Chaque ligne ci-dessous correspond à un geste RÉELLEMENT
 * câblé — App.tsx, RelectureScreen.tsx, LecteurExtrait.tsx, useZoomVideo.ts : un raccourci
 * annoncé qui ne fait rien serait pire que pas de liste.
 *
 * Un PANNEAU ancré à droite, plus une fenêtre posée par-dessus (décision de Thomas,
 * 24.10.2026 : « une fenêtre unique tout-en-un ») : le mur reste visible et vivant pendant
 * qu'on lit. Le groupe de l'écran où l'on se trouve vient en tête.
 */

function Groupe({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2.5 text-micro font-semibold uppercase tracking-[.06em] text-soft">{titre}</h3>
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

export function Raccourcis({ espace, onFermer }: { espace: string; onFermer: () => void }) {
  useLangue();

  /* En capture : l'écouteur général de l'application traite aussi « Échap » — il ferait
     sortir du plein écran en même temps que le panneau se referme. « ? » le referme aussi. */
  useEffect(() => {
    const auClavier = (e: KeyboardEvent) => {
      const saisie = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (e.key === 'Escape' || (e.key === '?' && !saisie)) { e.stopPropagation(); e.preventDefault(); onFermer(); }
    };
    window.addEventListener('keydown', auClavier, true);
    return () => window.removeEventListener('keydown', auClavier, true);
  }, [onFermer]);

  const fleches = <><Touche>←</Touche> <Touche>→</Touche></>;
  const zoom = <><Touche>+</Touche> <Touche>−</Touche></>;

  const direct = (
    <Groupe key="direct" titre={t('espace.direct')}>
      <Ligne geste={<><Touche>1</Touche> {t('raccourcis.a')} <Touche>9</Touche></>}>{t('raccourcis.isoler')}</Ligne>
      <Ligne geste={<Touche>0</Touche>}>{t('raccourcis.mosaique')}</Ligne>
      <Ligne geste={<><Touche>Ctrl</Touche> + <Touche>1</Touche> {t('raccourcis.a')} <Touche>9</Touche></>}>{t('raccourcis.disposition')}</Ligne>
      <Ligne geste={t('raccourcis.doubleClic')}>{t('raccourcis.doubleClicFait')}</Ligne>
      <Ligne geste={t('raccourcis.glisser')}>{t('raccourcis.glisserFait')}</Ligne>
      <Ligne geste={t('raccourcis.molette')}>{t('raccourcis.moletteFait')}</Ligne>
      <Ligne geste={zoom}>{t('raccourcis.zoomIsolee')}</Ligne>
      <Ligne geste={<Touche>F11</Touche>}>{t('video.pleinEcran')}</Ligne>
      <Ligne geste={<Touche>{t('touche.echap')}</Touche>}>{t('raccourcis.echapDirect')}</Ligne>
    </Groupe>
  );
  const relecture = (
    <Groupe key="relecture" titre={t('espace.relecture')}>
      <Ligne geste={<Touche>{t('touche.espace')}</Touche>}>{t('raccourcis.lecture')}</Ligne>
      <Ligne geste={fleches}>{t('raccourcis.dixSecondes')}</Ligne>
      <Ligne geste={zoom}>{t('raccourcis.zoomer')}</Ligne>
      <Ligne geste={t('raccourcis.molette')}>{t('raccourcis.moletteFait')}</Ligne>
      <Ligne geste={t('raccourcis.clicFrise')}>{t('raccourcis.clicFriseFait')}</Ligne>
      <Ligne geste={t('raccourcis.moletteFrise')}>{t('raccourcis.moletteFriseFait')}</Ligne>
      <Ligne geste={<Touche>I</Touche>}>{t('raccourcis.debutPlage')}</Ligne>
      <Ligne geste={<Touche>O</Touche>}>{t('raccourcis.finPlage')}</Ligne>
    </Groupe>
  );
  const sequence = (
    <Groupe key="sequence" titre={t('raccourcis.sequence')}>
      <Ligne geste={<Touche>{t('touche.espace')}</Touche>}>{t('raccourcis.lecture')}</Ligne>
      <Ligne geste={fleches}>{t('raccourcis.imageParImage')}</Ligne>
      <Ligne geste={zoom}>{t('raccourcis.zoomer')}</Ligne>
      <Ligne geste={t('raccourcis.molette')}>{t('raccourcis.moletteFait')}</Ligne>
      <Ligne geste={<Touche>{t('touche.echap')}</Touche>}>{t('commun.fermer')}</Ligne>
    </Groupe>
  );
  /* Le groupe de l'écran courant d'abord : c'est celui qu'on vient chercher. */
  const groupes = espace === 'relecture' ? [relecture, direct, sequence] : [direct, relecture, sequence];

  return (
    <aside aria-label={t('raccourcis.titre')}
           className="m-ecran flex w-[340px] shrink-0 flex-col border-l border-line bg-card">
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-line pl-5 pr-3">
        <h2 className="text-titre font-semibold">{t('raccourcis.titre')}</h2>
        <Touche>?</Touche>
        <Bouton variante="fantome" icone={X} titre={t('commun.fermerEchap')} onClick={onFermer} className="ml-auto" />
      </div>
      <div className="flex min-h-0 flex-col gap-[22px] overflow-y-auto px-5 pb-[22px] pt-[18px]">
        <Groupe titre={t('raccourcis.partout')}>
          <Ligne geste={<Touche>?</Touche>}>{t('raccourcis.afficher')}</Ligne>
        </Groupe>
        {groupes}
      </div>
    </aside>
  );
}
