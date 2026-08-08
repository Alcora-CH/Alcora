import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Bell, BellOff, Check, Loader2 } from 'lucide-react';
import { bridge } from '../lib/bridge';
import { t, useLangue } from '../i18n';
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
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--soft)' }} />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="grid h-full place-items-center p-8">
        <p className="flex max-w-md gap-2 text-center text-[13.5px]" style={{ color: 'var(--warn)' }}>
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{t('veilles.lectureEchouee')} {message}</span>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto h-full w-full max-w-[880px] overflow-y-auto px-5 py-5">

      {/* ---- l'interrupteur d'Alcora : l'îlot de tête ---- */}
      <div className="ilot flex items-center gap-3 px-4 py-3">
        <button
          onClick={() => { void enregistrer({ ...config, armee: !config.armee }); }}
          aria-pressed={config.armee}
          aria-label={config.armee ? t('veilles.desactiver') : t('veilles.activer')}
          className="relative h-[22px] w-10 shrink-0 rounded-full transition-colors"
          style={{ background: config.armee ? 'var(--ok)' : 'var(--card2)' }}>
          <span className="absolute top-[3px] h-4 w-4 rounded-full transition-all"
                style={{ left: config.armee ? 21 : 3,
                         background: config.armee ? '#151a12' : '#5a5f68' }} />
        </button>
        <div className="min-w-0">
          <p className="text-[13.5px]">{config.armee ? t('veilles.active') : t('veilles.desactivee')}</p>
          {profilActifNom && (
            <p className="font-mono text-[11px] text-soft">{t('veilles.profil', { nom: profilActifNom })}</p>
          )}
        </div>
        {etat === 'enregistre' && (
          <span className="ml-auto flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--ok)' }}>
            <Check className="h-3.5 w-3.5" /> {t('veilles.enregistre')}
          </span>
        )}
        {etat === 'erreur' && (
          <span className="ml-auto text-[12px]" style={{ color: 'var(--warn)' }}>{message}</span>
        )}
      </div>

      {/* Deux interrupteurs sur le même mur : le dire plutôt que de laisser deviner. */}
      <p className="mt-2 px-1 text-[11.5px] leading-relaxed text-soft">
        {t('veilles.independant')}
      </p>

      {/* ---- les veilles ---- */}
      <div className="m-cascade mt-5 flex flex-col gap-3.5">
        {config.veilles.map((v) => {
          const cout = coutParJour(coutVeille(v, volumes));
          const estOuverte = ouverte === v.id;
          return (
            /* Chaque veille est un îlot ; une veille éteinte s'estompe, comme avant. */
            <div key={v.id} className="ilot"
                 style={{ opacity: v.actif ? 1 : 0.55 }}>

              <div className="flex items-center gap-3 px-4 py-3">
                <button onClick={() => majVeille(v.id, { actif: !v.actif })}
                        aria-pressed={v.actif} aria-label={v.actif ? t('veilles.desactiverCourt') : t('veilles.activerCourt')}
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-md"
                        style={{ background: v.actif ? 'var(--accent-soft)' : 'var(--card2)',
                                 color: v.actif ? 'var(--accent)' : 'var(--soft)' }}>
                  {v.actif ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
                </button>

                <button onClick={() => setOuverte(estOuverte ? null : v.id)}
                        className="min-w-0 flex-1 text-left">
                  <p className="truncate text-[13.5px]">{v.nom}</p>
                  <p className="truncate font-mono text-[11px] text-soft">
                    {v.sujets.map(libelleSujet).join(' · ')}
                    {' — '}
                    {v.cameras.length === 0
                      ? t('veilles.toutesCameras')
                      : v.cameras.map((id) => cameras.find((c) => c.id === id)?.name ?? '?').join(', ')}
                  </p>
                </button>

                <span className="shrink-0 text-[11.5px] text-muted">
                  {t(QUAND.find((q) => q.id === v.quand)?.cle ?? 'veilles.quand.toujours')}
                </span>
                {/* Le volume attendu, avant d'activer. Protect ne le dit nulle part. */}
                <span className="shrink-0 font-mono text-[11px]" style={{ color: cout.ton }}>
                  {cout.texte}
                </span>
              </div>

              {estOuverte && (
                <Reglage veille={v} cameras={cameras} config={config} volumes={volumes}
                         onChange={(champs) => majVeille(v.id, champs)} />
              )}
            </div>
          );
        })}
      </div>

      {volumes === null && (
        <p className="mt-4 px-1 text-[11.5px] text-soft">
          {t('veilles.volumesIndisponibles')}
        </p>
      )}
    </div>
  );
}

/** Le détail d'une veille : ce qui la déclenche, où, quand, et ce qu'elle fait. */
function Reglage({ veille, cameras, config, volumes, onChange }: {
  veille: Veille;
  cameras: DiscoveredCamera[];
  config: ConfigVeilles;
  volumes: Record<string, number> | null;
  onChange: (champs: Partial<Veille>) => void;
}) {
  const bascule = (liste: string[], id: string) =>
    liste.includes(id) ? liste.filter((x) => x !== id) : [...liste, id];

  const Puce = ({ on, onClick, children, ton }: {
    on: boolean; onClick: () => void; children: React.ReactNode; ton?: string;
  }) => (
    <button onClick={onClick} aria-pressed={on}
            className="rounded-full border px-3 py-1 text-[12.5px] transition-colors"
            style={on
              ? { background: 'var(--accent-soft)', color: ton ?? 'var(--accent)', borderColor: 'transparent' }
              : { color: 'var(--soft)', borderColor: 'var(--line)' }}>
      {children}
    </button>
  );

  const Titre = ({ children }: { children: React.ReactNode }) => (
    <p className="mb-2 mt-4 text-[10.5px] font-semibold uppercase tracking-wider text-soft">{children}</p>
  );

  return (
    <div className="border-t border-line px-4 pb-4">
      <Titre>{t('veilles.declenche')}</Titre>
      <div className="flex flex-wrap gap-1.5">
        {SUJETS.map((s) => {
          const n = volumes?.[s.id];
          const c = coutParJour(n);
          return (
            <Puce key={s.id} on={veille.sujets.includes(s.id)}
                  onClick={() => onChange({ sujets: bascule(veille.sujets, s.id) })}>
              {t(s.cle)}
              {/* Le coût est collé au sujet : c'est là qu'on choisit, pas ailleurs. */}
              {n !== undefined && n > 3 && (
                <span className="ml-1.5 font-mono text-[10px]" style={{ color: c.ton }}>
                  {Math.round(n)}/{t('unite.j')}
                </span>
              )}
            </Puce>
          );
        })}
      </div>

      <Titre>{t('veilles.surCameras')}</Titre>
      <div className="flex flex-wrap gap-1.5">
        <Puce on={veille.cameras.length === 0} onClick={() => onChange({ cameras: [] })}>
          {t('commun.toutes')}
        </Puce>
        {cameras.map((c) => (
          <Puce key={c.id} on={veille.cameras.includes(c.id)}
                onClick={() => onChange({ cameras: bascule(veille.cameras, c.id) })}>
            {c.name}
          </Puce>
        ))}
      </div>

      <Titre>{t('veilles.quandTitre')}</Titre>
      <div className="flex flex-wrap gap-1.5">
        {QUAND.map((q) => (
          <Puce key={q.id} on={veille.quand === q.id} onClick={() => onChange({ quand: q.id })}>
            {t(q.cle)}
          </Puce>
        ))}
      </div>
      <p className="mt-1.5 text-[11.5px] text-soft">
        {t(QUAND.find((q) => q.id === veille.quand)?.aideCle ?? 'veilles.quand.toujoursAide')}
      </p>

      {veille.quand === 'armee' && config.profils.length > 0 && (
        <>
          <Titre>{t('veilles.selonHoraire')}</Titre>
          <div className="flex flex-wrap gap-1.5">
            <Puce on={veille.profils.length === 0} onClick={() => onChange({ profils: [] })}>
              {t('veilles.enPermanence')}
            </Puce>
            {config.profils.map((p) => (
              <Puce key={p.id} on={veille.profils.includes(p.id)}
                    onClick={() => onChange({ profils: bascule(veille.profils, p.id) })}>
                {p.nom}
              </Puce>
            ))}
          </div>
          {config.profils
            .filter((p) => veille.profils.length === 0 || veille.profils.includes(p.id))
            .map((p) => <Semaine key={p.id} plages={p.plages} />)}
        </>
      )}

      {veille.quand === 'horaire' && <Semaine plages={veille.plages ?? []} />}

      <Titre>{t('veilles.ceQueCaFait')}</Titre>
      <div className="flex flex-wrap items-center gap-1.5">
        <Puce on={veille.son !== false} onClick={() => onChange({ son: veille.son === false })}>
          {t('veilles.son')}
        </Puce>
        <span className="ml-2 text-[12px] text-soft">{t('veilles.retenue')}</span>
        {RETENUES.map((r) => (
          <Puce key={r.ms} on={veille.retenueMs === r.ms} onClick={() => onChange({ retenueMs: r.ms })}>
            {r.libelle}
          </Puce>
        ))}
      </div>
      <p className="mt-1.5 text-[11.5px] leading-relaxed text-soft">
        {t('veilles.retenueDetail')}
      </p>
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
    <div className="mt-3">
      <div className="flex flex-col gap-[3px]">
        {jours().map((nom, jour) => (
          <div key={jour} className="flex items-center gap-2">
            <span className="w-7 text-[10px] text-soft">{nom}</span>
            <div className="relative h-3.5 flex-1 overflow-hidden rounded-sm"
                 style={{ background: 'var(--card2)' }}>
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
                  <span key={`${i}-${k}`} className="absolute inset-y-0 rounded-sm"
                        style={{ left: `${b.g * 100}%`, width: `${b.l * 100}%`,
                                 background: 'var(--accent)', opacity: 0.7 }} />
                ));
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between pl-9 font-mono text-[9.5px] text-soft">
        <span>00h</span><span>06h</span><span>12h</span><span>18h</span><span>24h</span>
      </div>
    </div>
  );
}
