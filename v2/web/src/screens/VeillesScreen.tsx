import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Bell, BellOff, Check, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { bridge } from '../lib/bridge';
import { t, useLangue } from '../i18n';
import { Carte, EnTete } from '../ui/Cadre';
import { Interrupteur } from '../ui/Interrupteur';
import { Puce } from '../ui/Puce';
import { Segment } from '../ui/Segment';
import { cx } from '../ui/cx';
import type { Cle } from '../i18n/fr';
import type { ConfigVeilles, DiscoveredCamera, PlageHoraire, Veille } from '../types/protect';

/**
 * Les veilles : ce qui merite qu'on previenne, et quand.
 *
 * C'est la seule chose qu'Alcora fait et que Protect ne fait pas — prevenir SUR CE PC, sans
 * compte, sans nuage, sans Internet. Ubiquiti n'a pas d'application de bureau.
 *
 * La decision de dessin vient des VOLUMES releves sur le poste de reference le 29.07.2026 : 157
 * mouvements par jour, mais UNE personne. Le filtre elabore qu'on imaginait n'avait pas
 * lieu d'etre — la nature du sujet fait deja le tri. Ce que l'ecran doit faire, en revanche,
 * c'est DIRE ce volume avant qu'on ne coche : c'est la seule information qui empeche de se
 * noyer, et Protect ne la donne nulle part.
 */

/* Les identifiants font foi cote processus principal (veilles.js) ; ici on ne porte que
   les mots que l'on montre. Un ecran ne doit jamais afficher « smartDetectZone : person ». */
const SUJETS: { id: string; cle: Cle; urgence?: boolean }[] = [
  { id: 'person', cle: 'sujet.person' },
  { id: 'vehicle', cle: 'sujet.vehicle' },
  { id: 'animal', cle: 'sujet.animal' },
  { id: 'package', cle: 'sujet.package' },
  { id: 'verre', cle: 'sujet.alrmGlassBreak', urgence: true },
  { id: 'fumee', cle: 'sujet.alrmSmoke', urgence: true },
  { id: 'sirene', cle: 'sujet.sirene', urgence: true },
  { id: 'co', cle: 'sujet.monoxyde', urgence: true },
  { id: 'aboiement', cle: 'sujet.alrmBark' },
  { id: 'parole', cle: 'sujet.alrmSpeak' },
  { id: 'bebe', cle: 'sujet.pleurs' },
  { id: 'motion', cle: 'sujet.motion' },
];

const CLE_SUJET = new Map(SUJETS.map((s) => [s.id, s.cle]));
const libelleSujet = (id: string) => { const c = CLE_SUJET.get(id); return c ? t(c) : id; };
const jours = () => t('veilles.jours').split(' ');

const QUAND: { id: Veille['quand']; cle: Cle; aideCle: Cle }[] = [
  { id: 'toujours', cle: 'veilles.quand.toujours', aideCle: 'veilles.quand.toujoursAide' },
  { id: 'armee', cle: 'veilles.quand.armee', aideCle: 'veilles.quand.armeeAide' },
  { id: 'horaire', cle: 'veilles.quand.horaire', aideCle: 'veilles.quand.horaireAide' },
];

/** Volume attendu, dit en mots plutot qu'en nombre brut. */
function coutParJour(n: number | undefined): { texte: string; ton: string } {
  if (n === undefined) return { texte: '—', ton: 'var(--soft)' };
  if (n < 0.5) return { texte: t('veilles.presqueJamais'), ton: 'var(--ok)' };
  const texte = t('veilles.parJour', { n: Math.round(n) });
  if (n <= 3) return { texte, ton: 'var(--ok)' };
  if (n <= 20) return { texte, ton: 'var(--warn)' };
  return { texte, ton: 'var(--bad)' };
}

/** Coût total d'une veille : la somme de ses sujets. */
function coutVeille(v: Veille, volumes: Record<string, number> | null): number | undefined {
  if (!volumes) return undefined;
  return v.sujets.reduce((s, id) => s + (volumes[id] ?? 0), 0);
}

const RETENUES = [
  { ms: 60_000, libelle: '1 min' },
  { ms: 300_000, libelle: '5 min' },
  { ms: 900_000, libelle: '15 min' },
  { ms: 3_600_000, libelle: '1 h' },
];

export function VeillesScreen({ cameras }: { cameras: DiscoveredCamera[] }) {
  useLangue();
  const [config, setConfig] = useState<ConfigVeilles | null>(null);
  const [volumes, setVolumes] = useState<Record<string, number> | null>(null);
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [etat, setEtat] = useState<'lecture' | 'prete' | 'enregistre' | 'erreur'>('lecture');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let vivant = true;
    bridge.veilles()
      .then((c) => { if (vivant) { setConfig(c); setEtat('prete'); } })
      .catch((e) => { if (vivant) { setEtat('erreur'); setMessage(String(e?.message ?? e)); } });
    bridge.volumes().then((v) => { if (vivant) setVolumes(v); }).catch(() => {});
    return () => { vivant = false; };
  }, []);

  /* L'enregistrement suit le geste, sans bouton « Enregistrer » : un réglage qu'on croit
     posé et qui ne l'est pas est pire qu'un réglage qu'on doit confirmer. */
  const enregistrer = useCallback(async (suivante: ConfigVeilles) => {
    setConfig(suivante);
    try {
      const retenu = await bridge.veillesEnregistrer(suivante);
      setConfig(retenu);
      setEtat('enregistre');
      setTimeout(() => setEtat((e) => (e === 'enregistre' ? 'prete' : e)), 1600);
    } catch (e) {
      setEtat('erreur');
      setMessage(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const majVeille = useCallback((id: string, champs: Partial<Veille>) => {
    if (!config) return;
    void enregistrer({
      ...config,
      veilles: config.veilles.map((v) => (v.id === id ? { ...v, ...champs } : v)),
    });
  }, [config, enregistrer]);

  const profilActifNom = useMemo(() => {
    if (!config) return null;
    return config.profils.map((p) => p.nom).join(', ') || null;
  }, [config]);

  if (etat === 'lecture') {
    return (
      <div className="grid h-full place-items-center">
        <Loader2 className="h-5 w-5 animate-spin text-soft" aria-hidden />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="grid h-full place-items-center p-8">
        <Carte className="max-w-md p-5 text-center">
          <AlertCircle className="mx-auto mb-2 h-5 w-5 text-warn" aria-hidden />
          <p>{t('veilles.lectureEchouee')}</p>
          {message && <p className="mt-1 text-meta text-soft">{message}</p>}
        </Carte>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <EnTete
        titre={t('espace.alertes')}
        precision={t('veilles.precision')}
        actions={(
          <>
            {etat === 'enregistre' && (
              <span className="flex items-center gap-1.5 text-meta text-ok">
                <Check className="h-4 w-4" aria-hidden /> {t('veilles.enregistre')}
              </span>
            )}
            {etat === 'erreur' && <span className="max-w-xs truncate text-meta text-warn">{message}</span>}
            {/* L'interrupteur d'Alcora, en tête : c'est le geste du soir et du matin. */}
            <div className="flex items-center gap-3 rounded-[10px] border border-line2 bg-card2 py-1.5 pl-2.5 pr-3.5">
              <Interrupteur ton="vert" allume={config.armee}
                            etiquette={config.armee ? t('veilles.desactiver') : t('veilles.activer')}
                            onChange={(v) => { void enregistrer({ ...config, armee: v }); }} />
              <div className="leading-tight">
                <div className="font-medium">{config.armee ? t('veilles.active') : t('veilles.desactivee')}</div>
                {profilActifNom && <div className="text-meta text-soft">{t('veilles.profil', { nom: profilActifNom })}</div>}
              </div>
            </div>
          </>
        )}
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1100px] px-6 pb-10 pt-[22px]">
          {/* Deux interrupteurs sur le même mur : le dire plutôt que de laisser deviner. */}
          <p className="mb-[18px] max-w-[760px] leading-relaxed text-muted">{t('veilles.independant')}</p>

          {/* ---- les veilles : une liste, alignée en colonnes ---- */}
          <Carte className="@container m-cascade overflow-hidden">
            {config.veilles.map((v) => {
              const cout = coutParJour(coutVeille(v, volumes));
              const estOuverte = ouverte === v.id;
              return (
                <div key={v.id} className="[&+&]:border-t [&+&]:border-line">
                  {/* Une veille éteinte s'estompe, comme avant. */}
                  <div className={cx('grid grid-cols-[36px_minmax(0,1fr)_auto_auto_28px] items-center gap-4 px-4 py-3.5 transition-colors hover:bg-white/[.02]',
                    !v.actif && 'opacity-55')}>
                    <button type="button" onClick={() => majVeille(v.id, { actif: !v.actif })}
                            aria-pressed={v.actif} title={v.actif ? t('veilles.desactiverCourt') : t('veilles.activerCourt')}
                            aria-label={`${v.nom} — ${v.actif ? t('veilles.desactiverCourt') : t('veilles.activerCourt')}`}
                            className={cx('m-pression grid h-9 w-9 place-items-center rounded-[9px]',
                              v.actif ? 'bg-accent-soft text-accent' : 'bg-card2 text-soft')}>
                      {v.actif ? <Bell className="h-4 w-4" aria-hidden /> : <BellOff className="h-4 w-4" aria-hidden />}
                    </button>

                    <button type="button" onClick={() => setOuverte(estOuverte ? null : v.id)}
                            aria-expanded={estOuverte} className="min-w-0 text-left">
                      <span className="block truncate text-titre font-semibold">{v.nom}</span>
                      <span className="mt-0.5 block truncate text-meta text-muted">
                        {v.sujets.map(libelleSujet).join(', ')}
                        {' — '}
                        {v.cameras.length === 0
                          ? t('veilles.toutesCameras')
                          : v.cameras.map((id) => cameras.find((c) => c.id === id)?.name ?? '?').join(', ')}
                      </span>
                    </button>

                    <span className="whitespace-nowrap text-meta text-muted @max-[620px]:hidden">
                      {t(QUAND.find((q) => q.id === v.quand)?.cle ?? 'veilles.quand.toujours')}
                    </span>
                    {/* Le volume attendu, avant d'activer. Protect ne le dit nulle part. */}
                    <span className="whitespace-nowrap text-meta tabular-nums" style={{ color: cout.ton }}>
                      {cout.texte}
                    </span>
                    <button type="button" onClick={() => setOuverte(estOuverte ? null : v.id)}
                            aria-hidden tabIndex={-1} className="grid place-items-center text-soft">
                      {estOuverte ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>

                  {estOuverte && (
                    <Reglage veille={v} cameras={cameras} config={config} volumes={volumes}
                             onChange={(champs) => majVeille(v.id, champs)} />
                  )}
                </div>
              );
            })}
          </Carte>

          {volumes === null && (
            <p className="mt-4 text-meta text-soft">{t('veilles.volumesIndisponibles')}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Un titre de rubrique du détail. */
function Rubrique({ titre, suite, children }: { titre: string; suite?: boolean; children: React.ReactNode }) {
  return (
    <>
      <h3 className={cx('mb-2.5 text-corps font-semibold', suite && 'mt-[22px]')}>{titre}</h3>
      {children}
    </>
  );
}

/** Le détail d'une veille : ce qui la déclenche, où, quand, et ce qu'elle fait — sur deux colonnes. */
function Reglage({ veille, cameras, config, volumes, onChange }: {
  veille: Veille;
  cameras: DiscoveredCamera[];
  config: ConfigVeilles;
  volumes: Record<string, number> | null;
  onChange: (champs: Partial<Veille>) => void;
}) {
  const bascule = (liste: string[], id: string) =>
    liste.includes(id) ? liste.filter((x) => x !== id) : [...liste, id];

  return (
    <div className="grid grid-cols-2 gap-x-9 gap-y-[26px] pb-[22px] pl-[68px] pr-4 pt-1.5 @max-[760px]:grid-cols-1 @max-[760px]:pl-4">
      <div>
        <Rubrique titre={t('veilles.declenche')}>
          <div className="flex flex-wrap gap-1.5">
            {SUJETS.map((s) => {
              const n = volumes?.[s.id];
              const c = coutParJour(n);
              return (
                /* Les urgences (verre, fumée, sirène, monoxyde) portent un bord rougeâtre :
                   distinguées dans le code depuis toujours, elles ne l'étaient pas à l'écran. */
                <Puce key={s.id} allumee={veille.sujets.includes(s.id)} urgence={s.urgence}
                      onClick={() => onChange({ sujets: bascule(veille.sujets, s.id) })}
                      /* Le coût est collé au sujet : c'est là qu'on choisit, pas ailleurs. */
                      compte={n !== undefined && n > 3 ? `${Math.round(n)}/${t('unite.j')}` : undefined}
                      tonCompte={c.ton}>
                  {t(s.cle)}
                </Puce>
              );
            })}
          </div>
        </Rubrique>

        <Rubrique titre={t('veilles.surCameras')} suite>
          <div className="flex flex-wrap gap-1.5">
            <Puce allumee={veille.cameras.length === 0} onClick={() => onChange({ cameras: [] })}>
              {t('commun.toutes')}
            </Puce>
            {cameras.map((c) => (
              <Puce key={c.id} allumee={veille.cameras.includes(c.id)}
                    onClick={() => onChange({ cameras: bascule(veille.cameras, c.id) })}>
                {c.name}
              </Puce>
            ))}
          </div>
        </Rubrique>

        <Rubrique titre={t('veilles.ceQueCaFait')} suite>
          <div className="flex flex-wrap items-center gap-1.5">
            <Puce allumee={veille.son !== false} onClick={() => onChange({ son: veille.son === false })}>
              {t('veilles.son')}
            </Puce>
            <span className="mx-1 text-meta text-muted">{t('veilles.retenue')}</span>
            {RETENUES.map((r) => (
              <Puce key={r.ms} allumee={veille.retenueMs === r.ms} onClick={() => onChange({ retenueMs: r.ms })}>
                {r.libelle}
              </Puce>
            ))}
          </div>
          <p className="mt-1.5 text-meta leading-normal text-soft">{t('veilles.retenueDetail')}</p>
        </Rubrique>
      </div>

      <div>
        <Rubrique titre={t('veilles.quandTitre')}>
          <Segment etiquette={t('veilles.quandTitre')} valeur={veille.quand}
                   options={QUAND.map((q) => ({ valeur: q.id, libelle: t(q.cle) }))}
                   onChange={(q) => onChange({ quand: q })} />
          <p className="mt-1.5 text-meta text-soft">
            {t(QUAND.find((q) => q.id === veille.quand)?.aideCle ?? 'veilles.quand.toujoursAide')}
          </p>
        </Rubrique>

        {veille.quand === 'armee' && config.profils.length > 0 && (
          <Rubrique titre={t('veilles.selonHoraire')} suite>
            <div className="flex flex-wrap gap-1.5">
              <Puce allumee={veille.profils.length === 0} onClick={() => onChange({ profils: [] })}>
                {t('veilles.enPermanence')}
              </Puce>
              {config.profils.map((p) => (
                <Puce key={p.id} allumee={veille.profils.includes(p.id)}
                      onClick={() => onChange({ profils: bascule(veille.profils, p.id) })}>
                  {p.nom}
                </Puce>
              ))}
            </div>
            {config.profils
              .filter((p) => veille.profils.length === 0 || veille.profils.includes(p.id))
              .map((p) => <Semaine key={p.id} plages={p.plages} />)}
          </Rubrique>
        )}

        {veille.quand === 'horaire' && <Semaine plages={veille.plages ?? []} />}
      </div>
    </div>
  );
}

/** L'horaire hebdomadaire, dessiné plutôt qu'écrit. Une plage peut franchir minuit. */
function Semaine({ plages }: { plages: PlageHoraire[] }) {
  useLangue();
  const minutes = (hhmm: string) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? '');
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  };

  return (
    <div className="mt-3 grid grid-cols-[36px_1fr] items-center gap-x-2.5 gap-y-1 text-meta text-soft">
      {jours().map((nom, jour) => (
        <div key={jour} className="contents">
          <span>{nom}</span>
          <div className="relative h-3 overflow-hidden rounded-[3px] bg-card2">
            {plages.flatMap((p, i) => {
              const d = minutes(p.debut); const f = minutes(p.fin);
              if (d === null || f === null) return [];
              const jours = p.jours ?? [];
              const bandes: { g: number; l: number }[] = [];
              // Plage ordinaire.
              if (f > d && jours.includes(jour)) bandes.push({ g: d / 1440, l: (f - d) / 1440 });
              // Plage qui franchit minuit : deux morceaux, dont un appartenant à la veille.
              if (f < d) {
                if (jours.includes(jour)) bandes.push({ g: d / 1440, l: (1440 - d) / 1440 });
                if (jours.includes((jour + 6) % 7)) bandes.push({ g: 0, l: f / 1440 });
              }
              if (f === d && jours.includes(jour)) bandes.push({ g: 0, l: 1 });
              return bandes.map((b, k) => (
                <span key={`${i}-${k}`} className="absolute inset-y-0 rounded-[3px] bg-accent opacity-75"
                      style={{ left: `${b.g * 100}%`, width: `${b.l * 100}%` }} />
              ));
            })}
          </div>
        </div>
      ))}
      <div className="col-start-2 flex justify-between tabular-nums">
        {[0, 6, 12, 18, 24].map((h) => <span key={h}>{h} h</span>)}
      </div>
    </div>
  );
}
