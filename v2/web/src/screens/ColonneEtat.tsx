import { useEffect, useMemo, useState } from 'react';
import { bridge } from '../lib/bridge';
import { localeDates, t, useLangue } from '../i18n';
import { parHeure, useActivite } from '../lib/activiteJour';
import {
  JOUR_MS, armementLisible, ceQuiAEteVu, dateCourte, duree, etatDisqueLisible, go, ilYa, to,
} from '../lib/lisible';
import type { DetectionVive, SystemeEtat } from '../types/protect';

/**
 * Colonne d'etat.
 *
 * Reprise du panneau de Protect, dont c'est la meilleure partie : des CHIFFRES, denses,
 * qu'on lit d'un coup d'oeil. La version precedente expliquait trop et montrait trop peu —
 * chaque bloc portait son paragraphe. Ici le texte ne reste que la ou son absence
 * tromperait : un disque a 98 % ressemble a une panne si rien ne dit que c'est normal.
 *
 * Les noms de champs viennent du journal du poste (30.07.2026), pas d'une supposition.
 * Ce qui manque disparait : jamais un zero a la place d'une valeur inconnue.
 */

const Titre = ({ children }: { children: React.ReactNode }) => (
  <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-soft">{children}</p>
);

const Ligne = ({ k, v, ton }: { k: string; v: string; ton?: string }) => (
  <div className="flex items-baseline gap-2 px-1 py-[3px] text-[12.5px]">
    <span className="truncate text-muted">{k}</span>
    <span className="ml-auto shrink-0 font-mono text-[12px]" style={ton ? { color: ton } : undefined}>{v}</span>
  </div>
);

const Sep = () => <div className="my-2.5 h-px bg-line" />;

export function ColonneEtat({ versionAlcora, onOuvrir }: {
  versionAlcora: string | null;
  /** Une detection recente a ete cliquee : la fenetre de lecture est tenue plus haut. */
  onOuvrir: (d: DetectionVive) => void;
}) {
  /* L'abonnement a la langue : la colonne entiere se redessine quand elle change,
     unites, sujets et etats compris. Le rendu du t() module reste ainsi a jour. */
  useLangue();
  const [systeme, setSysteme] = useState<SystemeEtat | null>(null);
  const [horloge, setHorloge] = useState(() => new Date());
  const { dujour, partiel, vives } = useActivite();

  useEffect(() => {
    let vivant = true;
    bridge.systeme().then((s) => { if (vivant) setSysteme(s); }).catch(() => {});
    return () => { vivant = false; };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setHorloge(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const { heures, depuis } = useMemo(() => parHeure(dujour ?? [], partiel), [dujour, partiel]);
  const maxi = Math.max(1, ...heures);

  const archive = useMemo(() => {
    const toutes = systeme?.archive ?? [];
    if (!toutes.length) return null;
    return {
      debut: Math.min(...toutes.map((a) => a.debut)),
      frontiere: toutes.every((a) => a.frontiere !== null)
        ? Math.min(...toutes.map((a) => a.frontiere as number)) : null,
      fin: Math.max(...toutes.map((a) => a.fin)),
    };
  }, [systeme]);

  const remplissage = systeme?.disque
    ? (systeme.disque.utilise / systeme.disque.total) * 100 : null;

  const etatDisque = systeme?.etatDisque ? etatDisqueLisible(systeme.etatDisque) : null;

  /**
   * La rétention annoncée, mais seulement lorsqu'elle contredit ce qu'on a mesuré.
   *
   * Répéter en deux formulations une valeur identique ferait douter sans rien apprendre.
   * L'écart, lui, dit quelque chose : le disque se remplit autrement que prévu.
   */
  const ecartRetention = useMemo(() => {
    const annonce = systeme?.retentionBasse;
    if (annonce == null || !archive) return null;
    const mesuree = (archive.fin - archive.debut) / JOUR_MS;
    return Math.abs(annonce - mesuree) > Math.max(7, mesuree * 0.1) ? annonce : null;
  }, [systeme, archive]);

  /** Même règle pour la pleine définition, qui a sa propre frontière et sa propre estimation. */
  const ecartHaute = useMemo(() => {
    const annonce = systeme?.retentionHaute;
    if (annonce == null || !archive || archive.frontiere === null) return null;
    const mesuree = (archive.fin - archive.frontiere) / JOUR_MS;
    return Math.abs(annonce - mesuree) > Math.max(7, mesuree * 0.1) ? annonce : null;
  }, [systeme, archive]);

  return (
    <>
      <Sep />

      {/* En un coup d'œil. Le compte de caméras n'est pas repris : la liste est juste
          au-dessus, et un doublon n'apprend rien. */}
      <Ligne k={t('colonne.controleur')} v={systeme?.nom ?? '—'} ton="var(--ok)" />
      <Ligne k={t('colonne.heure')} v={horloge.toLocaleTimeString(localeDates())} />
      {systeme?.armement && (
        <Ligne k="Protect" v={armementLisible(systeme.armement).texte}
               ton={armementLisible(systeme.armement).ton} />
      )}

      {/* ---- définitions, comme leurs badges ---- */}
      {systeme?.parDefinition && (
        <div className="mt-2 flex gap-1.5 px-1">
          {([['hd', 'HD'], ['2k', '2K'], ['4k', '4K']] as const).map(([cle, nom]) => {
            const n = systeme.parDefinition?.[cle] ?? 0;
            return (
              <span key={cle} className="rounded px-1.5 py-0.5 font-mono text-[10px]"
                    style={{ background: n ? 'var(--accent-soft)' : 'var(--card2)',
                             color: n ? 'var(--accent)' : 'var(--soft)' }}>
                {nom} ×{n}
              </span>
            );
          })}
        </div>
      )}

      {/* ---- détections récentes, en direct ---- */}
      {vives.length > 0 && (
        <>
          <Sep />
          <Titre>{t('colonne.detectionsRecentes')}</Titre>
          {vives.map((d) => (
            <button key={d.id ?? String(d.debut)} onClick={() => onOuvrir(d)}
                    disabled={!d.id || d.debut === null}
                    className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left transition-colors hover:bg-[var(--card2)] disabled:cursor-default disabled:hover:bg-transparent">
              <div className="h-[30px] w-[52px] shrink-0 overflow-hidden rounded"
                   style={{ background: 'var(--card2)' }}>
                {/*
                  Tant que la détection COURT, il n'existe aucune vignette : on montre
                  l'instantané de la caméra, daté du début pour que le navigateur le garde.
                  Une fois finie, la vraie vignette de l'événement prend la place.
                */}
                {(d.fin && d.id ? true : Boolean(d.camera)) && (
                  <img src={d.fin && d.id ? `/vignette/${d.id}` : `/instantane/${d.camera}?t=${d.debut ?? 0}`}
                       alt="" loading="lazy" className="h-full w-full object-cover"
                       onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px]">{ceQuiAEteVu(d)}</div>
                <div className="truncate font-mono text-[10px] text-soft">{d.cameraNom ?? ''}</div>
              </div>
              <span className="shrink-0 font-mono text-[10.5px] text-soft">
                {d.debut ? ilYa(d.debut) : ''}
              </span>
            </button>
          ))}
        </>
      )}

      {/* ---- activité du jour ---- */}
      {dujour !== null && (
        <>
          <Sep />
          <Titre>{t('colonne.aujourdhui')} · {partiel ? '≥ ' : ''}{dujour.length}</Titre>
          <div className="flex h-11 items-end gap-[2px] px-1">
            {heures.map((n, h) => {
              // Heure non couverte par la lecture : elle se dit inconnue, jamais vide.
              const su = h >= depuis;
              return (
                <div key={h} className="flex-1 rounded-t-sm"
                     title={su ? `${String(h).padStart(2, '0')}h — ${n}`
                              : `${String(h).padStart(2, '0')}h — ${t('colonne.nonLu')}`}
                     style={{ height: su ? `${Math.max(2, (n / maxi) * 100)}%` : '100%',
                              background: su ? 'var(--accent)' : 'var(--line)',
                              opacity: su ? (n ? 0.8 : 0.18) : 0.35 }} />
              );
            })}
          </div>
          <div className="mt-1 flex justify-between px-1 font-mono text-[9.5px] text-soft">
            <span>00</span><span>06</span><span>12</span><span>18</span><span>24</span>
          </div>
        </>
      )}

      {/* ---- enregistrements ---- */}
      {(archive || systeme?.disque) && (
        <>
          <Sep />
          <Titre>{t('colonne.enregistrements')}</Titre>
          {/*
            L'enregistrement suspendu passe AVANT tout le reste, et en rouge : sans cela,
            une profondeur de cinq mois et un disque à moitié plein donneraient toutes les
            apparences du bon fonctionnement pendant que plus rien ne s'écrit.
          */}
          {systeme?.enregistrementSuspendu && (
            <p className="mb-1.5 rounded-md px-2 py-1.5 text-[12px] leading-snug"
               style={{ background: 'rgba(180,72,63,.14)', color: 'var(--warn)' }}>
              {t('colonne.suspendu')}
            </p>
          )}
          {archive && (
            <>
              <Ligne k={t('colonne.plusAncien')} v={dateCourte(new Date(archive.debut))} />
              <Ligne k={t('colonne.profondeur')} v={duree(archive.fin - archive.debut)} />
              {archive.frontiere !== null && (
                <Ligne k={t('colonne.pleineDefinition')} v={duree(archive.fin - archive.frontiere)} ton="var(--warn)" />
              )}
              {/* Le controleur annonce des JOURS FLOTTANTS (393,163460… constate le
                  03.08) : on arrondit a l'affichage, la comparaison garde le brut. */}
              {ecartHaute !== null && (
                <Ligne k={t('colonne.pleineDefAnnoncee')} v={`${Math.round(ecartHaute)} ${t('unite.j')}`} ton="var(--warn)" />
              )}
            </>
          )}
          {ecartRetention !== null && (
            <Ligne k={t('colonne.retentionAnnoncee')} v={`${Math.round(ecartRetention)} ${t('unite.j')}`} ton="var(--warn)" />
          )}
          {/*
            Un disque qui n'est pas « ok » se dit — mais avec ce qu'il faut pour ne pas
            s'alarmer a tort. Le poste de reference rend « hddNotCompatible » : le disque n'est
            pas sur la liste d'Ubiquiti, ce qui n'empeche rien et n'a jamais rien empeche
            chez lui — 162 jours d'archive et 5,85 To ecrits. L'annoncer en rouge sans le
            dire serait inquieter pour rien.
          */}
          {etatDisque && (
            <>
              <Ligne k={t('colonne.etatDisque')} v={etatDisque.texte} ton={etatDisque.ton} />
              {etatDisque.detail && (
                <p className="px-1 text-[11px] leading-snug text-soft">{etatDisque.detail}</p>
              )}
            </>
          )}
          {systeme?.parJourHaute != null && (
            <Ligne k={t('colonne.ecritParJour')} v={go(systeme.parJourHaute + (systeme.parJourBasse ?? 0))} />
          )}

          {systeme?.disque && remplissage !== null && (
            <>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--card2)' }}>
                <div className="h-full rounded-full"
                     style={{ width: `${Math.min(100, remplissage)}%`,
                              background: 'linear-gradient(90deg,var(--accent),var(--accent-d))' }} />
              </div>
              <Ligne k={t('colonne.disque')} v={`${to(systeme.disque.utilise)} / ${to(systeme.disque.total)}`} />
              {/* La seule phrase qui reste : sans elle, 98 % ressemble a une panne. */}
              <p className="px-1 text-[11px] leading-snug text-soft">
                {t('colonne.rotation')}
              </p>
            </>
          )}
        </>
      )}

      {/* ---- versions ---- */}
      {systeme && (
        <>
          <Sep />
          <Titre>{t('colonne.versions')}</Titre>
          {versionAlcora && <Ligne k="Alcora" v={versionAlcora} ton="var(--ok)" />}
          {systeme.version && <Ligne k="Protect" v={systeme.version} />}
          {systeme.versionOs && <Ligne k="UniFi OS" v={systeme.versionOs} />}
          {systeme.versionDisponible && (
            <Ligne k={t('colonne.disponible')} v={systeme.versionDisponible} ton="var(--warn)" />
          )}
          {systeme.depuis != null && <Ligne k={t('colonne.allumeDepuis')} v={duree(Date.now() - systeme.depuis)} />}
        </>
      )}

      <Sep />
      <p className="px-1 text-[11.5px] leading-snug" style={{ color: 'var(--ok)' }}>
        {t('colonne.aucuneImage')}
      </p>
    </>
  );
}
