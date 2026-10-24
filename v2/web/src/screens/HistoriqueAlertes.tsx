import { useEffect, useMemo, useState } from 'react';
import { Bell, History, ImageOff, Play, ShieldCheck, Trash2, Volume2, VolumeX } from 'lucide-react';
import { bridge } from '../lib/bridge';
import { useAlertes } from '../lib/alertes';
import { ilYa } from '../lib/lisible';
import { localeDates, nombre, t, useLangue } from '../i18n';
import { Bouton } from '../ui/Bouton';
import { Carte } from '../ui/Cadre';
import { Puce } from '../ui/Puce';
import { cx } from '../ui/cx';
import type { DetectionVive, EntreeAlerte } from '../types/protect';

/**
 * L'historique des alertes — variante 1 « onglet » de docs/maquette-historique-alertes.html,
 * retenue le 23.10.2026.
 *
 * Chaque bulle partie, la plus récente d'abord, groupée par jour : la vignette de la
 * détection, l'heure, le sujet et la caméra, la veille qui a prévenu, et ce qui s'est passé
 * autour — le son, une bulle partie sans image, les alertes que la retenue a tues ensuite.
 * « Revoir » mène à la relecture à cet instant, « Séquence » ouvre le lecteur d'extrait.
 */

const JOUR_MS = 86_400_000;
const minuit = (ms: number) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
const heureMin = (ms: number) => new Intl.DateTimeFormat(localeDates(), { hour: '2-digit', minute: '2-digit' })
  .format(new Date(ms));

function nomDuJour(debutJour: number): string {
  const ecart = Math.round((minuit(Date.now()) - debutJour) / JOUR_MS);
  if (ecart === 0) return t('colonne.aujourdhui');
  if (ecart === 1) return t('relecture.hier');
  const d = new Date(debutJour);
  return new Intl.DateTimeFormat(localeDates(), {
    weekday: 'long', day: 'numeric', month: 'long',
    ...(d.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' as const } : {}),
  }).format(d);
}

/** Une vignette d'événement n'existe qu'après sa fin : en son absence, une cloche. */
function Vignette({ id }: { id: string | null }) {
  const [rate, setRate] = useState(false);
  if (!id || rate) {
    return (
      <span className="grid h-[63px] w-28 shrink-0 place-items-center rounded-[7px] bg-card2 text-soft">
        <Bell className="h-5 w-5" aria-hidden />
      </span>
    );
  }
  return (
    <img src={`/vignette/${id}`} alt="" loading="lazy" onError={() => setRate(true)}
         className="h-[63px] w-28 shrink-0 rounded-[7px] bg-black object-cover" />
  );
}

function Badge({ ton, titre, carre, children }: {
  ton?: 'or' | 'orange'; titre?: string;
  /** Une icône seule : le badge devient un rond. */
  carre?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span title={titre}
          className={cx('inline-flex h-5 items-center gap-[5px] rounded-full border text-[11.5px]',
            carre ? 'w-5 justify-center' : 'px-[7px]',
            ton === 'or' ? 'border-accent-ligne text-accent'
              : ton === 'orange' ? 'border-[rgba(224,162,60,.4)] text-warn' : 'border-line2 text-muted')}>
      {children}
    </span>
  );
}

export function HistoriqueAlertes({ libelleSujet, estUrgence, onOuvrir, onRevoir }: {
  /** Le nom d'un sujet, dans la langue du moment — celui de l'écran des veilles. */
  libelleSujet: (id: string) => string;
  estUrgence: (id: string) => boolean;
  onOuvrir: (d: DetectionVive) => void;
  onRevoir: (camera: string | null, t: number) => void;
}) {
  useLangue();
  const { version, nonVues } = useAlertes();
  const [entrees, setEntrees] = useState<EntreeAlerte[] | null>(null);
  const [filtre, setFiltre] = useState<string | null>(null);
  const [confirmer, setConfirmer] = useState(false);

  /* Relue à chaque changement poussé par le principal. Ce qui est sous les yeux est vu : la
     visite efface la pastille, et une alerte arrivée pendant la lecture aussi. La visite ne
     part que s'il reste des non vues : elle pousse elle-même un changement, et sans cette
     condition chaque visite en rappellerait une autre, sans fin. */
  useEffect(() => {
    let vivant = true;
    bridge.alertes()
      .then((r) => { if (vivant) setEntrees(r.entrees); })
      .catch(() => { if (vivant) setEntrees([]); });
    if (nonVues > 0) void bridge.alertesVues().catch(() => {});
    return () => { vivant = false; };
  }, [version, nonVues]);

  /* Les veilles qui ont prévenu, avec leur compte — le nom le plus récent l'emporte. */
  const veilles = useMemo(() => {
    const m = new Map<string, { nom: string; n: number }>();
    for (const e of entrees ?? []) {
      const id = e.veilleId ?? '?';
      const v = m.get(id);
      if (v) v.n += 1; else m.set(id, { nom: e.veilleNom ?? '—', n: 1 });
    }
    return [...m.entries()];
  }, [entrees]);

  if (entrees === null) return null;

  const affichees = entrees.filter((e) => filtre === null || (e.veilleId ?? '?') === filtre);
  const jours: { debut: number; liste: EntreeAlerte[] }[] = [];
  for (const e of affichees) {
    const j = minuit(e.envoye);
    const dernier = jours[jours.length - 1];
    if (dernier && dernier.debut === j) dernier.liste.push(e); else jours.push({ debut: j, liste: [e] });
  }

  if (entrees.length === 0) {
    return (
      <Carte className="px-6 py-[34px] text-center text-muted">
        <Bell className="mx-auto mb-2 h-[22px] w-[22px] text-soft" aria-hidden />
        <p className="mb-1 text-titre font-semibold text-ink">{t('historique.vide')}</p>
        <p>{t('historique.videDetail')}</p>
      </Carte>
    );
  }

  return (
    <div>
      <div role="group" aria-label={t('historique.filtre')} className="mb-3 flex flex-wrap items-center gap-1.5">
        <Puce allumee={filtre === null} onClick={() => setFiltre(null)}>
          {t('historique.toutes')} <span className="text-meta text-soft">{entrees.length}</span>
        </Puce>
        {veilles.map(([id, v]) => (
          <Puce key={id} allumee={filtre === id} onClick={() => setFiltre(id)}>
            {v.nom} <span className="text-meta text-soft">{v.n}</span>
          </Puce>
        ))}
        <span className="ml-auto text-meta text-muted">
          {affichees.length === 1 ? t('historique.uneAlerte') : t('historique.alertes', { n: nombre(affichees.length, 0) })}
        </span>
      </div>

      <Carte className="m-cascade overflow-hidden">
        {jours.map((j) => (
          <section key={j.debut} aria-label={nomDuJour(j.debut)}>
            <h3 className="flex items-baseline gap-2 border-t border-line bg-card2 px-4 pb-2 pt-2.5 text-meta text-muted first:border-t-0">
              <span className="text-corps font-semibold text-ink first-letter:uppercase">{nomDuJour(j.debut)}</span>
              {j.liste.length === 1 ? t('historique.uneAlerte') : t('historique.alertes', { n: j.liste.length })}
            </h3>
            {j.liste.map((e, i) => {
              const d = e.detection;
              const ouvrable = Boolean(d.id) && d.debut !== null;
              return (
                <div key={`${e.envoye}-${i}`}
                     className={cx('relative grid grid-cols-[112px_70px_minmax(0,1fr)_auto] items-center gap-3.5 border-t border-line px-4 py-2.5 transition-colors hover:bg-white/[.02]',
                       estUrgence(e.sujet) && 'before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-bad')}>
                  <Vignette id={d.id} />
                  <div>
                    <div className="font-mono text-[15px] font-medium leading-tight tabular-nums text-ink">{heureMin(e.envoye)}</div>
                    <div className="mt-0.5 text-meta text-soft">{t('historique.ilYa', { duree: ilYa(e.envoye) })}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-titre font-semibold">
                      {libelleSujet(e.sujet)}{e.cameraNom ? ` — ${e.cameraNom}` : ''}
                    </div>
                    <div className="mt-0.5 truncate text-meta text-muted">{e.veilleNom ?? '—'}</div>
                    <div className="mt-1.5 flex flex-wrap gap-[5px]">
                      {/* Le haut-parleur suffit ; son nom au survol, et pour le lecteur d'écran — « avec
                          son » s'écrivait sur chaque alerte (clarté, 24.10.2026). */}
                      <Badge carre titre={e.son ? t('historique.avecSon') : t('historique.sansSon')}>
                        {e.son ? <Volume2 className="h-3 w-3" aria-hidden /> : <VolumeX className="h-3 w-3" aria-hidden />}
                        <span className="sr-only">{e.son ? t('historique.avecSon') : t('historique.sansSon')}</span>
                      </Badge>
                      {!e.image && (
                        <Badge ton="orange" titre={t('historique.sansImageTitre')}>
                          <ImageOff className="h-3 w-3" aria-hidden />{t('historique.sansImage')}
                        </Badge>
                      )}
                      {e.retenues > 0 && (
                        <Badge ton="or" titre={t('historique.retenuesTitre')}>
                          {e.retenues === 1 ? t('historique.uneRetenue') : t('historique.retenues', { n: e.retenues })}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <Bouton taille="petit" icone={History} titre={t('historique.revoirTitre')} disabled={d.debut === null}
                            onClick={() => { if (d.debut !== null) onRevoir(d.camera, d.debut); }}>
                      {t('historique.revoir')}
                    </Bouton>
                    <Bouton taille="petit" icone={Play} titre={t('historique.sequenceTitre')} disabled={!ouvrable}
                            onClick={() => {
                              if (!ouvrable) return;
                              onOuvrir({ id: d.id, commence: false, type: d.type ?? 'smartDetectZone', camera: d.camera,
                                cameraNom: e.cameraNom, debut: d.debut, fin: d.fin, sujets: d.sujets, score: d.score });
                            }}>
                      {t('historique.sequence')}
                    </Bouton>
                  </div>
                </div>
              );
            })}
          </section>
        ))}
      </Carte>

      {confirmer ? (
        <div role="alert" className="mt-3 flex flex-wrap items-center gap-2.5 rounded-[9px] border border-[rgba(227,115,95,.35)] bg-bad-soft px-3 py-2.5">
          <span>{t('historique.confirmer', { n: entrees.length })}</span>
          <span className="ml-auto flex gap-2">
            <Bouton taille="petit" onClick={() => setConfirmer(false)}>{t('historique.annuler')}</Bouton>
            <Bouton taille="petit" variante="danger" icone={Trash2}
                    onClick={() => { setConfirmer(false); void bridge.alertesEffacer(); }}>
              {t('historique.effacer')}
            </Bouton>
          </span>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2.5 text-meta text-soft">
          <ShieldCheck className="h-4 w-4" aria-hidden />
          {t('historique.garde')}
          <Bouton taille="petit" variante="fantome" icone={Trash2} className="ml-auto" onClick={() => setConfirmer(true)}>
            {t('historique.effacerTout')}
          </Bouton>
        </div>
      )}
    </div>
  );
}
