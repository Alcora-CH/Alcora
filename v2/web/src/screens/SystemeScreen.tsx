import { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, FolderOpen, RotateCw, ShieldCheck } from 'lucide-react';
import { bridge } from '../lib/bridge';
import { localeDates, t, useLangue } from '../i18n';
import { derniereParCamera, useActivite } from '../lib/activiteJour';
import {
  JOUR_MS, archiveGlobale, armementLisible, ceQuiAEteVu, dateCourte, duree, etatDisqueLisible, go, ilYa, to,
} from '../lib/lisible';
import { seuleVisible, titreMasquage } from '../lib/masquage';
import { Horloge } from '../cadre/Horloge';
import { Bouton } from '../ui/Bouton';
import { Carte, EnTete } from '../ui/Cadre';
import { cx } from '../ui/cx';
import type { Cle } from '../i18n/fr';
import type { DiscoveredCamera, DiscoveredChannel, RelayState, SystemeEtat } from '../types/protect';

/**
 * La page Système — direction « Observatoire », maquette A du 23.10.2026.
 *
 * Elle recueille ce que le panneau « Surveillance » affichait sur TOUS les écrans : l'état
 * du flux, le contrôleur, les enregistrements, les versions. Le panneau mangeait 292 pixels
 * de chaque écran pour des chiffres qu'on lit une fois par jour ; la barre d'état en garde
 * l'essentiel sous les yeux et mène ici pour le reste.
 *
 * Elle ajoute ce que le panneau n'avait pas la place de dire : pour chaque caméra, ses
 * flux (définition, images par seconde, débit), son archive et sa dernière détection.
 *
 * Les règles de la colonne d'état valent toujours : ce qui manque disparaît, jamais un zéro
 * à la place d'une valeur inconnue ; une valeur jamais observée passe brute.
 */

const LIBELLE_CANAL: Record<DiscoveredChannel['quality'], Cle> = {
  high: 'canal.haute', medium: 'canal.moyenne', low: 'canal.basse', package: 'canal.colis',
};

/** La plus fine d'abord ; le canal « colis » des sonnettes vient en dernier, à part. */
const ORDRE_CANAL: DiscoveredChannel['quality'][] = ['high', 'medium', 'low', 'package'];

/** Le débit en Mbit/s : une décimale au plus sous 10, aucune au-delà — « 0,3 », « 2 », « 16 ». */
const mbits = (bps: number) => new Intl.NumberFormat(localeDates(), {
  maximumFractionDigits: bps < 1e7 ? 1 : 0, useGrouping: false,
}).format(bps / 1e6);

function Ligne({ k, v, ton, chasseFixe }: { k: string; v: React.ReactNode; ton?: string; chasseFixe?: boolean }) {
  return (
    <div className="flex items-baseline gap-2.5 py-1 text-corps">
      <span className="text-muted">{k}</span>
      <span className={cx('ml-auto text-right tabular-nums', chasseFixe && 'font-mono')}
            style={ton ? { color: ton } : undefined}>{v}</span>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-meta leading-normal text-soft">{children}</p>;
}

function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <Carte className="px-[18px] pb-[18px] pt-4">
      <h2 className="mb-3 text-titre font-semibold">{titre}</h2>
      {children}
    </Carte>
  );
}

export function SystemeScreen({
  systeme, relay, cameras, masquees, onBasculerMasquee, versionAlcora, onGuide,
}: {
  systeme: SystemeEtat | null;
  relay: RelayState;
  cameras: DiscoveredCamera[];
  masquees: string[];
  onBasculerMasquee: (id: string) => void;
  versionAlcora: string | null;
  /** Le guide de la console vit dans l'écran de connexion, atteint par les réglages. */
  onGuide: () => void;
}) {
  useLangue();
  const activite = useActivite();
  const dernieres = useMemo(() => derniereParCamera(activite), [activite]);

  /* « il y a 12 s » vieillit : sans ce battement, il resterait vrai une seule fois. */
  const [, setBattement] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setBattement((n) => n + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  const archive = useMemo(() => archiveGlobale(systeme?.archive), [systeme]);

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

  const armement = systeme?.armement ? armementLisible(systeme.armement) : null;

  return (
    <div className="flex h-full flex-col">
      <EnTete
        titre={t('espace.systeme')}
        precision={t('systeme.precision')}
        actions={(
          <Bouton variante="fantome" icone={FolderOpen} titre={t('systeme.journalTitre')}
                  onClick={() => { void bridge.ouvrirJournal(); }}>
            {t('systeme.journal')}
          </Bouton>
        )}
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1240px] px-6 pb-10 pt-[22px]">
          <div className="grid gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(270px,1fr))]">

            {/* ---- le contrôleur ---- */}
            <Bloc titre={t('colonne.controleur')}>
              {/* L'état du flux EN TÊTE : la première chose qu'on vient vérifier. Le remède
                  et « Réessayer » le suivent — le message seul laisse sans prise. */}
              <div className="mb-3 flex items-start gap-2.5 rounded-[9px] bg-card2 px-3 py-2.5">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                      style={{ background: relay.running ? 'var(--ok)' : 'var(--warn)' }} />
                <div className="min-w-0">
                  <p>{relay.message}</p>
                  {relay.remedy && <p className="mt-1 text-meta text-warn">{relay.remedy}</p>}
                  {/* La reprise est automatique : le bouton n'apparaît que lorsque réessayer
                      seul ne servirait à rien — mot de passe refusé, identité changée. */}
                  {!relay.running && relay.permanent && (
                    <Bouton taille="petit" icone={RotateCw} className="mt-2"
                            onClick={() => { void bridge.retry(); }}>
                      {t('app.reessayer')}
                    </Bouton>
                  )}
                </div>
              </div>
              <Ligne k={t('colonne.controleur')} v={systeme?.nom ?? '—'} ton="var(--ok)" />
              <Ligne k={t('colonne.heure')} v={<Horloge />} chasseFixe />
              {armement && <Ligne k="Protect" v={armement.texte} ton={armement.ton} />}
              {systeme && systeme.cameras.total > 0 && (
                <Ligne k={t('systeme.cameras')}
                       v={systeme.cameras.enLigne >= systeme.cameras.total
                         ? t('systeme.toutesEnLigne', { n: String(systeme.cameras.total) })
                         : t('systeme.dontHorsLigne', {
                           n: String(systeme.cameras.total),
                           h: String(systeme.cameras.total - systeme.cameras.enLigne),
                         })}
                       ton={systeme.cameras.enLigne < systeme.cameras.total ? 'var(--warn)' : undefined} />
              )}
              {/* Les définitions, comme les badges de Protect. */}
              {systeme?.parDefinition && (
                <div className="mt-2.5 flex gap-1.5">
                  {([['hd', 'HD'], ['2k', '2K'], ['4k', '4K']] as const).map(([cle, nom]) => {
                    const n = systeme.parDefinition?.[cle] ?? 0;
                    return (
                      <span key={cle}
                            className={cx('rounded-md px-2 py-0.5 text-meta tabular-nums',
                              n ? 'bg-accent-soft text-accent' : 'bg-card2 text-soft')}>
                        {nom} ×{n}
                      </span>
                    );
                  })}
                </div>
              )}
              <p className="mt-3.5 flex items-center gap-2 text-meta text-ok">
                <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
                {t('colonne.aucuneImage')}
              </p>
            </Bloc>

            {/* ---- les enregistrements ---- */}
            {(archive || systeme?.disque || systeme?.enregistrementSuspendu) && (
              <Bloc titre={t('colonne.enregistrements')}>
                {/* L'enregistrement suspendu passe AVANT tout le reste : sans lui, cinq mois
                    d'archive et un disque à moitié plein auraient l'air de fonctionner. */}
                {systeme?.enregistrementSuspendu && (
                  <p className="mb-2 rounded-lg bg-bad-soft px-3 py-2 text-meta leading-snug text-bad">
                    {t('colonne.suspendu')}
                  </p>
                )}
                {archive && (
                  <>
                    <Ligne k={t('colonne.plusAncien')} v={dateCourte(new Date(archive.debut))} />
                    <Ligne k={t('colonne.profondeur')} v={duree(archive.fin - archive.debut)} />
                    {archive.frontiere !== null && (
                      <Ligne k={t('colonne.pleineDefinition')} v={duree(archive.fin - archive.frontiere)}
                             ton="var(--warn)" />
                    )}
                    {/* Le contrôleur annonce des JOURS FLOTTANTS (393,163460… constaté le
                        03.08) : on arrondit à l'affichage, la comparaison garde le brut. */}
                    {ecartHaute !== null && (
                      <Ligne k={t('colonne.pleineDefAnnoncee')}
                             v={`${Math.round(ecartHaute)} ${t('unite.j')}`} ton="var(--warn)" />
                    )}
                  </>
                )}
                {ecartRetention !== null && (
                  <Ligne k={t('colonne.retentionAnnoncee')}
                         v={`${Math.round(ecartRetention)} ${t('unite.j')}`} ton="var(--warn)" />
                )}
                {/* Un disque qui n'est pas « ok » se dit — avec ce qu'il faut pour ne pas
                    s'alarmer à tort : « non homologué » n'empêche rien. */}
                {etatDisque && (
                  <>
                    <Ligne k={t('colonne.etatDisque')} v={etatDisque.texte} ton={etatDisque.ton} />
                    {etatDisque.detail && <Note>{etatDisque.detail}</Note>}
                  </>
                )}
                {systeme?.parJourHaute != null && (
                  <Ligne k={t('colonne.ecritParJour')} v={go(systeme.parJourHaute + (systeme.parJourBasse ?? 0))} />
                )}
                {systeme?.disque && remplissage !== null && (
                  <>
                    <div className="mb-1.5 mt-2.5 h-1.5 overflow-hidden rounded-full bg-card3">
                      <div className="h-full rounded-full"
                           style={{ width: `${Math.min(100, remplissage)}%`,
                                    background: 'linear-gradient(90deg,var(--accent),var(--accent-d))' }} />
                    </div>
                    <Ligne k={t('colonne.disque')} v={`${to(systeme.disque.utilise)} / ${to(systeme.disque.total)}`} />
                    {/* La seule phrase qui reste : sans elle, 98 % ressemble à une panne. */}
                    <Note>{t('colonne.rotation')}</Note>
                  </>
                )}
              </Bloc>
            )}

            {/* ---- les versions ---- */}
            {systeme && (
              <Bloc titre={t('colonne.versions')}>
                {versionAlcora && <Ligne k="Alcora" v={versionAlcora} ton="var(--ok)" />}
                {systeme.version && <Ligne k="Protect" v={systeme.version} />}
                {systeme.versionOs && <Ligne k="UniFi OS" v={systeme.versionOs} />}
                {systeme.versionDisponible && (
                  <Ligne k={t('colonne.disponible')} v={systeme.versionDisponible} ton="var(--warn)" />
                )}
                {systeme.depuis != null && (
                  <Ligne k={t('colonne.allumeDepuis')} v={duree(Date.now() - systeme.depuis)} />
                )}
              </Bloc>
            )}
          </div>

          {/* ---- chaque caméra ---- */}
          {cameras.length > 0 && (
            <Carte className="mt-[18px] overflow-x-auto">
              <h2 className="px-[18px] pb-3 pt-4 text-titre font-semibold">{t('systeme.cameras')}</h2>
              <table className="w-full border-collapse text-corps">
                <thead>
                  <tr className="text-left text-meta text-soft">
                    {(['systeme.colCamera', 'systeme.colEtat', 'systeme.colFlux', 'systeme.colArchive',
                      'systeme.colDetection', 'systeme.colMosaique'] as const).map((cle) => (
                      <th key={cle} className="border-y border-line px-[18px] py-2 font-medium">{t(cle)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cameras.map((c) => {
                    const flux = c.channels.filter((x) => x.streamable)
                      .sort((a, b) => ORDRE_CANAL.indexOf(a.quality) - ORDRE_CANAL.indexOf(b.quality));
                    const masquee = masquees.includes(c.id);
                    const derniere = dernieres.get(c.id);
                    return (
                      <tr key={c.id} className="align-top [&:not(:last-child)>td]:border-b [&>td]:border-line">
                        <td className="px-[18px] py-3">
                          <div className="font-semibold">{c.name}</div>
                          {c.model && <div className="mt-0.5 text-meta text-soft">{c.model}</div>}
                        </td>
                        <td className="whitespace-nowrap px-[18px] py-3">
                          <span className="mr-2 inline-block h-2 w-2 rounded-full"
                                style={{ background: c.online ? 'var(--ok)' : 'var(--soft)' }} />
                          {c.online ? t('systeme.enLigne') : t('systeme.horsLigne')}
                        </td>
                        <td className="px-[18px] py-3">
                          {flux.length ? flux.map((x) => (
                            <div key={x.quality} className="whitespace-nowrap tabular-nums [&+&]:mt-[3px]">
                              <span className="inline-block w-[72px] font-medium">{t(LIBELLE_CANAL[x.quality])}</span>
                              {x.width} × {x.height}
                              {x.fps > 0 && <span className="ml-2 text-soft">{x.fps} {t('unite.ips')}</span>}
                              {x.bitrate > 0 && <span className="ml-2 text-soft">{mbits(x.bitrate)} {t('unite.mbits')}</span>}
                            </div>
                          )) : (
                            /* Sans canal diffusable, la CAUSE plutôt que le constat : il manque
                               un interrupteur sur la console, pas une panne. */
                            <>
                              <span className="text-warn">{t('camera.rtspDesactive')}</span>
                              <p className="mt-0.5 max-w-[360px] text-meta text-soft">{t('camera.rtspRemede')}</p>
                              <button type="button" onClick={onGuide}
                                      className="m-pression mt-1 text-meta text-accent-d underline decoration-dotted underline-offset-2">
                                {t('camera.guide')}
                              </button>
                            </>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-[18px] py-3">
                          {c.archive ? (
                            <>
                              {t('systeme.depuisLe', { date: dateCourte(new Date(c.archive.debut)) })}
                              {c.archive.frontiere !== null && (
                                <div className="mt-0.5 text-meta text-soft">
                                  {t('systeme.pleineDef', { duree: duree(c.archive.fin - c.archive.frontiere) })}
                                </div>
                              )}
                            </>
                          ) : <span className="text-soft">{t('systeme.inconnue')}</span>}
                        </td>
                        <td className="px-[18px] py-3">
                          {derniere ? (
                            <>
                              {ceQuiAEteVu(derniere)}
                              <div className="mt-0.5 text-meta text-soft">
                                {t('systeme.ilYa', { duree: ilYa(derniere.debut) })}
                              </div>
                            </>
                          ) : (
                            <span className="text-soft">{activite.dujour === null ? '…' : t('systeme.aucuneAujourdhui')}</span>
                          )}
                        </td>
                        <td className="px-[18px] py-3">
                          {/* Le masquage retire l'image de la mosaïque, RIEN d'autre. */}
                          <Bouton taille="petit" icone={masquee ? EyeOff : Eye}
                                  disabled={seuleVisible(cameras, masquees, c.id)}
                                  titre={titreMasquage(cameras, masquees, c.id)}
                                  aria-label={masquee ? t('app.afficherCamera', { nom: c.name })
                                    : t('app.masquerCamera', { nom: c.name })}
                                  onClick={() => onBasculerMasquee(c.id)}>
                            {masquee ? t('systeme.masquee') : t('systeme.affichee')}
                          </Bouton>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Carte>
          )}
        </div>
      </div>
    </div>
  );
}
