import { useEffect, useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { localeDates, t, useLangue } from '../i18n';
import { dernieres, enCoursDe, imageDe, useActivite } from '../lib/activiteJour';
import { pendantAbsence, resumeAbsence, type EtatAbsence } from '../lib/absence';
import { ceQuiAEteVu, ilYa } from '../lib/lisible';
import { PAS_CARTE, type Placement } from '../lib/placementBandeau';
import type { DetectionVive } from '../types/protect';

/**
 * Le bandeau d'activité du plein écran — maquette docs/maquette-bandeau-activite.html,
 * variante A « Pellicule », validée le 24.10.2026.
 *
 * En plein écran, la colonne Activité disparaît : c'était le seul endroit où l'on voyait ce
 * qui s'était passé. Le bandeau en est le prolongement, posé dans la place que la mosaïque
 * laisse libre (lib/placementBandeau.ts) — et il dit d'abord ce qui est arrivé PENDANT TON
 * ABSENCE (lib/absence.ts), en or, jusqu'à ce que tu le regardes.
 */

type Vive = DetectionVive & { vignette?: boolean };

/** La couleur du sujet : la même famille que le reste de l'application. */
function teinte(d: Vive): string {
  if (d.sujets.includes('person') || d.type === 'person') return 'var(--accent)';
  if (d.sujets.includes('vehicle') || d.type === 'vehicle') return 'var(--info)';
  if (d.sujets.includes('animal') || d.type === 'animal') return 'var(--ok)';
  return 'var(--soft)';
}

const heure = (ms: number) => new Intl.DateTimeFormat(localeDates(), { hour: '2-digit', minute: '2-digit' })
  .format(new Date(ms));

/** Assez pour ce que la pastille ouverte peut montrer ; le compte, lui, porte sur la journée. */
const CARTES_MAX = 12;

export function BandeauActivite({ placement, absence, largeurZone, bas, commandesVisibles, onOuvrir, onToutes, onVu }: {
  placement: Placement;
  absence: EtatAbsence;
  /** Pour la pastille ouverte : la largeur du mur. */
  largeurZone: number;
  /** Pour la pastille : sa distance au bas de l'écran (la barre d'état peut s'y poser). */
  bas: number;
  commandesVisibles: boolean;
  onOuvrir: (d: DetectionVive) => void;
  onToutes: () => void;
  /**
   * Tu as regardé : les marques de l'absence s'effacent. Au DÉPART du pointeur, pas à son
   * arrivée : les effacer à l'entrée les ferait disparaître au moment même où on les lit.
   */
  onVu: () => void;
}) {
  useLangue();
  const activite = useActivite();
  const [ouverte, setOuverte] = useState(false);

  /* « il y a 12 min » vieillit : sans ce battement, il ne serait vrai qu'une fois. */
  const [, setBattement] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setBattement((n) => n + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  const toutes = useMemo(() => dernieres(activite, Number.MAX_SAFE_INTEGER), [activite]);
  const resume = resumeAbsence(absence, toutes);
  const enCours = toutes.find(enCoursDe) ?? null;
  const duJour = activite.dujour === null ? null : `${activite.partiel ? '≥ ' : ''}${activite.dujour.length}`;
  const nouvelle = (d: Vive) => pendantAbsence(absence, d.debut);
  const ouvrir = (d: DetectionVive) => { onVu(); onOuvrir(d); };

  /* ---- le résumé, à gauche (dessus quand le bandeau est debout) ---- */
  const enAbsence = resume.nombre > 0;
  const plusieurs = absence.absences.filter((a) => toutes.some((d) => d.debut !== null
    && a.de <= d.debut && (a.a === null || d.debut <= a.a))).length > 1;
  const resumeBloc = (
    <>
      <span className="font-semibold">{t('activite.titre')}</span>
      {enCours ? (
        <span className="pastille-nv self-start">{t('bandeau.enCours', { camera: enCours.cameraNom ?? '' })}</span>
      ) : enAbsence ? (
        <span className="pastille-nv self-start">
          {t(plusieurs ? 'bandeau.enAbsences' : 'bandeau.enAbsence', { n: resume.nombre })}
        </span>
      ) : null}
      <span className="text-meta tabular-nums text-soft">
        {enAbsence && !enCours && resume.de !== null
          ? `${resume.a !== null ? t('bandeau.plage', { de: heure(resume.de), a: heure(resume.a) })
            : t('bandeau.plageOuverte', { de: heure(resume.de) })}${duJour !== null ? ` · ${t('bandeau.duJour', { n: duJour })}` : ''}`
          : duJour === null ? '…'
            : toutes.length === 0 ? t('activite.aucune')
              : `${t('bandeau.duJourMaj', { n: duJour })}${toutes[0].debut !== null && !enCours
                ? ` · ${t('bandeau.rienDepuis', { h: heure(toutes[0].debut) })}` : ''}`}
      </span>
    </>
  );

  const carte = (d: Vive) => {
    const src = imageDe(d);
    const nv = nouvelle(d);
    const court = enCoursDe(d);
    const quoi = ceQuiAEteVu(d);
    return (
      <button key={d.id ?? String(d.debut)} type="button" onClick={() => ouvrir(d)} disabled={!d.id || d.debut === null}
              aria-label={t('bandeau.ouvrir', { quoi, camera: d.cameraNom ?? '' })}
              className={`bandeau-carte relative flex shrink-0 items-center gap-2.5 rounded-[9px] border p-[7px] text-left transition-colors disabled:cursor-default${nv ? ' bandeau-nouvelle' : enAbsence ? ' opacity-80' : ''}`}>
        <span className="relative h-[52px] w-[92px] shrink-0 overflow-hidden rounded-md bg-card2">
          {src && (
            <img src={src} alt="" loading="lazy" className="h-full w-full object-cover"
                 onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
          )}
          {court && <i aria-hidden className="point-activite absolute left-[5px] top-[5px] h-2 w-2 rounded-full bg-accent" />}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="flex items-center gap-1.5 truncate">
            <span aria-hidden className="h-[7px] w-[7px] shrink-0 rounded-[2px]" style={{ background: teinte(d) }} />
            <span className="truncate">{quoi}</span>
          </span>
          <span className="truncate text-muted">{d.cameraNom ?? ''}</span>
          <span className="truncate text-meta tabular-nums text-soft">
            {court ? t('bandeau.enCoursCourt') : d.debut !== null ? `${heure(d.debut)} · ${ilYa(d.debut)}` : ''}
          </span>
        </span>
        {nv && <span aria-hidden className="absolute right-[9px] top-[9px] h-[7px] w-[7px] rounded-full bg-accent" />}
      </button>
    );
  };

  /* Les cartes, et le filet qui sépare ce que tu n'as pas vu de ce qui précède. */
  const cartes = (n: number, debout: boolean) => {
    const vues = toutes.slice(0, Math.min(n, CARTES_MAX));
    const sortie: React.ReactNode[] = [];
    vues.forEach((d, i) => {
      if (i > 0 && enAbsence && nouvelle(vues[i - 1]) && !nouvelle(d)) {
        sortie.push(<span key="filet" aria-hidden className={debout ? 'bandeau-filet-h' : 'bandeau-filet'} />);
      }
      sortie.push(carte(d));
    });
    return sortie;
  };

  const lienToutes = (
    <button type="button" onClick={() => { onVu(); onToutes(); }}
            className="m-pression inline-flex items-center gap-1.5 whitespace-nowrap text-accent hover:text-accent-d">
      {t('activite.toutes')} <ArrowRight size={14} aria-hidden />
    </button>
  );

  const horizontal = (n: number, style: React.CSSProperties, extra = '') => (
    <section aria-label={t('bandeau.region')} onPointerLeave={onVu} style={style}
             className={`bandeau m-surgit absolute z-20 flex h-[92px] items-stretch gap-3.5 rounded-xl px-3.5 py-3${extra}`}>
      <div className="flex w-[210px] shrink-0 flex-col justify-center gap-1.5 border-r border-line pr-3.5">{resumeBloc}</div>
      <div className="flex min-w-0 flex-1 gap-2.5 overflow-hidden">{cartes(n, false)}</div>
      <div className="flex shrink-0 items-center border-l border-line pl-3">{lienToutes}</div>
    </section>
  );

  if (placement.mode === 'dessous') {
    return horizontal(placement.cartes, { left: placement.x, top: placement.y, width: placement.largeur });
  }

  if (placement.mode === 'cote') {
    return (
      <section aria-label={t('bandeau.region')} onPointerLeave={onVu}
               style={{ left: placement.x, top: placement.y, width: placement.largeur, maxHeight: placement.hauteur }}
               className="bandeau m-surgit absolute z-20 flex flex-col gap-3 rounded-xl px-3.5 py-3">
        <div className="flex flex-col gap-1.5 border-b border-line pb-3">{resumeBloc}</div>
        <div className="flex min-h-0 flex-col gap-1 overflow-hidden [&>.bandeau-carte]:w-full">{cartes(placement.cartes, true)}</div>
        <div className="border-t border-line pt-3">{lienToutes}</div>
      </section>
    );
  }

  /*
   * La pastille : pas la place autour des images. Elle se montre quand il y a du nouveau, une
   * détection en cours, ou que la souris bouge — et s'ouvre au survol, PAR-DESSUS les images,
   * le temps du survol seulement.
   */
  const visible = enAbsence || enCours !== null || commandesVisibles || ouverte;
  if (!visible) return null;
  const premiere = toutes[0] ?? null;
  const largeur = Math.min(largeurZone - 80, 2200);
  return (
    /* Le conteneur couvre toute la largeur pour centrer : il laisse passer les clics, sans
       quoi le pied des images ne répondrait plus d'un bord à l'autre. */
    <div className="pointer-events-none absolute inset-x-0 z-30 flex justify-center" style={{ bottom: bas }}>
      <div className="pointer-events-auto"
           onPointerLeave={() => { if (ouverte) onVu(); setOuverte(false); }}
           onBlur={(e) => {
             if (!e.currentTarget.contains(e.relatedTarget as Node | null)) { if (ouverte) onVu(); setOuverte(false); }
           }}>
      {ouverte ? (
        horizontal(Math.max(1, Math.floor((largeur - 456) / PAS_CARTE)),
          { position: 'relative', width: largeur }, ' shadow-[0_18px_50px_rgba(0,0,0,.5)]')
      ) : (
        <button type="button" onPointerEnter={() => setOuverte(true)} onFocus={() => setOuverte(true)}
                aria-label={t('bandeau.region')}
                className="veil m-surgit flex h-[38px] items-center gap-3 rounded-full py-0 pl-2.5 pr-3.5 text-corps"
                style={{ color: 'var(--on-1)' }}>
          {enCours ? <span className="pastille-nv">{t('bandeau.enCours', { camera: enCours.cameraNom ?? '' })}</span>
            : enAbsence ? <span className="pastille-nv">{t(plusieurs ? 'bandeau.enAbsences' : 'bandeau.enAbsence', { n: resume.nombre })}</span>
              : <span className="font-semibold">{t('activite.titre')}</span>}
          {premiere && (
            <>
              {imageDe(premiere) && (
                <img src={imageDe(premiere)!} alt="" className="h-[29px] w-[52px] rounded-[5px] object-cover"
                     onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
              )}
              <span>{ceQuiAEteVu(premiere)} · {premiere.cameraNom ?? ''}</span>
              <span className="tabular-nums text-soft">
                {enCoursDe(premiere) ? t('bandeau.enCoursCourt') : premiere.debut !== null ? heure(premiere.debut) : ''}
              </span>
            </>
          )}
        </button>
      )}
      </div>
    </div>
  );
}
