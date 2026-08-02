import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check, ChevronDown, Eye, EyeOff, Loader2, Minus, RotateCcw, ShieldCheck, X,
} from 'lucide-react';
import { bridge, isMocked } from '../lib/bridge';
import { useLangue } from '../i18n';
import type {
  DiscoveredCamera, Sauvegarde, StepId, StepResult, StepState,
} from '../types/protect';

const STEPS = [
  { id: 'reseau', cle: 'setup.etape.reseau' },
  { id: 'certificat', cle: 'setup.etape.certificat' },
  { id: 'identifiants', cle: 'setup.etape.identifiants' },
  { id: 'inventaire', cle: 'setup.etape.inventaire' },
  { id: 'flux', cle: 'setup.etape.flux' },
] as const satisfies readonly { id: StepId; cle: string }[];

function StepIcon({ state }: { state: StepState }) {
  const base = 'h-4 w-4 shrink-0';
  switch (state) {
    case 'reussi': return <Check className={base} style={{ color: 'var(--ok)' }} />;
    case 'echoue': return <X className={base} style={{ color: 'var(--bad)' }} />;
    case 'encours': return <Loader2 className={`${base} animate-spin`} style={{ color: 'var(--accent)' }} />;
    case 'ignore': return <Minus className={base} style={{ color: 'var(--soft)' }} />;
    default: return <span className="block h-1.5 w-1.5 translate-x-1 translate-y-1.5 rounded-full" style={{ background: 'var(--soft)' }} />;
  }
}

function Field({
  label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-soft">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1.5 block text-[11.5px] text-soft">{hint}</span>}
    </label>
  );
}

const inputClass =
  'h-9 w-full rounded-md border border-line2 bg-card2 px-3 text-[13.5px] text-ink ' +
  'outline-none transition-colors placeholder:text-soft focus:border-accent';

export function SetupScreen({ onDone }: { onDone: () => void }) {
  const t = useLangue();

  // Champ vide : aucune adresse par defaut. Une valeur pre-remplie serait a la fois une
  // donnee reelle a ne pas livrer et un mauvais indice — chaque installation a la sienne.
  const [host, setHost] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [seed, setSeed] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showSeed, setShowSeed] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);

  // Connexion mise de cote par une precedente remise a zero, s'il y en a une.
  const [sauvegarde, setSauvegarde] = useState<Sauvegarde | null>(null);
  const [reprise, setReprise] = useState(false);
  const [repriseEchouee, setRepriseEchouee] = useState(false);

  useEffect(() => { bridge.sauvegarde().then(setSauvegarde).catch(() => {}); }, []);

  const reprendre = useCallback(async () => {
    setReprise(true);
    setRepriseEchouee(false);
    try {
      if (await bridge.restaurer()) { onDone(); return; }
      setRepriseEchouee(true);
    } catch {
      setRepriseEchouee(true);
    } finally {
      setReprise(false);
    }
  }, [onDone]);

  const [results, setResults] = useState<Record<string, StepResult>>({});
  const [busy, setBusy] = useState(false);
  const [cameras, setCameras] = useState<DiscoveredCamera[]>([]);
  const [succeeded, setSucceeded] = useState(false);
  const [slow, setSlow] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const slowTimer = useRef<number | undefined>(undefined);

  const normalizedHost = useMemo(
    () => host.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '').split(':')[0],
    [host],
  );

  // La garde porte sur l'hote NORMALISE, pas sur la saisie brute : « https:// » seul est
  // une saisie non vide mais un hote vide, et activerait le test sans cible.
  const canTest = !busy && Boolean(normalizedHost) && username.trim() && password;

  const runTest = useCallback(async () => {
    setBusy(true);
    setSucceeded(false);
    setCameras([]);
    setResults({});
    setSlow(false);
    slowTimer.current = window.setTimeout(() => setSlow(true), 3000);

    try {
      const outcome = await bridge.testConnection(
        { host: normalizedHost, username: username.trim(), password, totpSeed: seed || undefined },
        (r) => {
          // Trace cote page : c'est le seul moyen de savoir quelles etapes sont REELLEMENT
          // parvenues jusqu'a l'affichage, par opposition a celles qui ont ete envoyees.
          console.log(`[test] reçu ${r.step} = ${r.state}`);
          setResults((prev) => ({ ...prev, [r.step]: r }));
        },
      );
      if (outcome.ok) {
        setCameras(outcome.cameras);
        setSucceeded(true);
      }
    } catch {
      setResults((prev) => ({
        ...prev,
        reseau: { step: 'reseau', state: 'echoue', message: t('setup.verification.echecTest') },
      }));
    } finally {
      window.clearTimeout(slowTimer.current);
      setSlow(false);
      setBusy(false);
    }
  }, [normalizedHost, username, password, seed, t]);

  /*
   * L'enregistrement peut echouer, et il prend du temps : il ouvre une session, releve
   * l'empreinte du controleur, puis demarre le relais. Sans retour, le clic semblait sans
   * effet et l'utilisateur recommencait.
   */
  const save = useCallback(async () => {
    setBusy(true);
    setSaveError(null);
    try {
      await bridge.save(
        { host: normalizedHost, username: username.trim(), password, totpSeed: seed || undefined },
        keepSignedIn,
      );
      onDone();
    } catch (e: unknown) {
      setSaveError(
        e instanceof Error && e.message
          ? e.message.replace(/^Error invoking remote method '[^']+':\s*/, '')
          : t('setup.actions.echecEnregistrement'),
      );
    } finally {
      setBusy(false);
    }
  }, [normalizedHost, username, password, seed, keepSignedIn, onDone, t]);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-[620px] flex-col gap-7 px-6 py-10">

        <header className="flex flex-col gap-2">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-5 w-5" style={{ color: 'var(--accent)' }} />
            <h1 className="text-[19px] font-semibold">{t('setup.titre')}</h1>
          </div>
          <p className="text-[13.5px] text-muted">
            {t('setup.sousTitre')}
          </p>
          {isMocked && (
            <p className="rounded-md px-3 py-2 text-[12px]"
               style={{ background: 'var(--warn-soft)', color: 'var(--warn)' }}>
              {t('setup.demo')}
            </p>
          )}
        </header>

        {/* ---- reprise ----
            Une remise a zero met la connexion de cote plutot que de la detruire. Tant
            qu'elle est reposable, tout ressaisir n'a aucun sens : on le propose d'abord. */}
        {sauvegarde?.existe && (
          <section className="rounded-lg border p-4"
                   style={{ borderColor: 'var(--accent)', background: 'var(--accent-soft)' }}>
            <p className="flex gap-2 text-[13px]">
              <RotateCcw className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--accent)' }} />
              <span>
                {t('setup.reprise.conservee')}
                {sauvegarde.host ? <> (<span className="font-mono">{sauvegarde.host}</span>)</> : null}
                {'. '}
                {t('setup.reprise.detail')}
              </span>
            </p>
            <div className="mt-3 flex items-center gap-3">
              <button onClick={reprendre} disabled={reprise}
                      className="rounded-md px-3 py-1.5 text-[13px] font-semibold disabled:opacity-50"
                      style={{ background: 'var(--accent)', color: '#20242a' }}>
                {reprise ? t('setup.reprise.encours') : t('setup.reprise.bouton')}
              </button>
              {repriseEchouee && (
                <span className="text-[12.5px]" style={{ color: 'var(--warn)' }}>
                  {t('setup.reprise.echec')}
                </span>
              )}
            </div>
          </section>
        )}

        {/* ---- contrôleur ---- */}
        <section className="flex flex-col gap-4">
          <Field label={t('setup.adresse.label')}
                 hint={t('setup.adresse.hint')}>
            <input className={inputClass} value={host} onChange={(e) => setHost(e.target.value)}
                   placeholder="192.168.1.1" inputMode="url"
                   spellCheck={false} autoComplete="off" />
          </Field>
        </section>

        {/* ---- compte ---- */}
        <section className="flex flex-col gap-4">
          <h2 className="text-[15px] font-semibold">{t('setup.compte.titre')}</h2>

          <Field label={t('setup.compte.identifiant')}
                 hint={t('setup.compte.identifiantHint')}>
            <input className={inputClass} value={username} onChange={(e) => setUsername(e.target.value)}
                   spellCheck={false} autoComplete="username" />
          </Field>

          <Field label={t('setup.compte.motDePasse')}>
            <div className="relative">
              <input className={`${inputClass} pr-10`} type={showPassword ? 'text' : 'password'}
                     value={password} onChange={(e) => setPassword(e.target.value)}
                     autoComplete="current-password" />
              <button type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? t('setup.compte.masquerMdp') : t('setup.compte.afficherMdp')}
                      className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded text-soft hover:text-ink">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>

          <Field label={t('setup.compte.cle')}>
            <div className="relative">
              <input className={`${inputClass} pr-10 font-mono tracking-wide`}
                     type={showSeed ? 'text' : 'password'}
                     value={seed} onChange={(e) => setSeed(e.target.value)}
                     spellCheck={false} autoComplete="off"
                     placeholder={t('setup.compte.clePlaceholder')} />
              <button type="button"
                      onClick={() => setShowSeed((v) => !v)}
                      aria-label={showSeed ? t('setup.compte.masquerCle') : t('setup.compte.afficherCle')}
                      className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded text-soft hover:text-ink">
                {showSeed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>

          <div>
            <button type="button" onClick={() => setHelpOpen((v) => !v)}
                    className="flex items-center gap-1.5 text-[12px] text-soft hover:text-muted">
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${helpOpen ? 'rotate-180' : ''}`} />
              {t('setup.aide.question')}
            </button>
            {helpOpen && (
              <div className="mt-2.5 flex flex-col gap-2.5 rounded-md border border-line bg-card p-3 text-[13px] text-muted">
                <p>{t('setup.aide.p1')}</p>
                <p>{t('setup.aide.p2')}</p>
              </div>
            )}
          </div>
        </section>

        {/* ---- vérification ---- */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-[15px] font-semibold">{t('setup.verification.titre')}</h2>
            {slow && <span className="text-[12px] text-soft">{t('setup.verification.lent')}</span>}
          </div>

          <ul className="flex flex-col gap-2.5">
            {STEPS.map(({ id, cle }) => {
              const r = results[id];
              const state: StepState = r?.state ?? 'attente';
              return (
                <li key={id} className="flex gap-2.5">
                  <div className="mt-0.5"><StepIcon state={state} /></div>
                  <div className="min-w-0">
                    <div className="text-[13px]"
                         style={{ color: state === 'attente' ? 'var(--soft)' : 'var(--ink)' }}>
                      {t(cle)}
                    </div>
                    {r?.message && (
                      <div className="text-[11.5px] text-soft">{r.message}</div>
                    )}
                    {r?.remedy && (
                      <div className="mt-1 text-[11.5px]" style={{ color: 'var(--warn)' }}>
                        {r.remedy}
                      </div>
                    )}
                    {r?.technical && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-[11px] text-soft">{t('setup.verification.detailTechnique')}</summary>
                        <code className="mt-1 block select-all text-[11px] text-muted">{r.technical}</code>
                      </details>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          {cameras.length > 0 && (
            <div className="mt-1 rounded-md border border-line bg-card p-3.5">
              <p className="mb-2 text-[13px] font-semibold">{t('setup.cameras.titre')}</p>
              <ul className="flex flex-col gap-1.5">
                {cameras.map((c) => {
                  const best = c.channels.filter((ch) => ch.streamable)
                    .sort((a, b) => b.width - a.width)[0];
                  return (
                    <li key={c.id} className="flex items-center gap-2.5 text-[13px]">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ background: c.online ? 'var(--ok)' : 'var(--soft)' }} />
                      <span>{c.name}</span>
                      <span className="font-mono text-[11.5px] text-soft">
                        {best ? `${best.width} × ${best.height}` : t('commun.aucunFlux')}
                      </span>
                      {!c.online && <span className="text-[11.5px] text-soft">{t('commun.horsLigne')}</span>}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>

        {/* ---- divulgation ---- */}
        <section className="flex flex-col gap-3 border-t border-line pt-6">
          <h2 className="text-[15px] font-semibold">{t('setup.rester.titre')}</h2>
          <div className="flex flex-col gap-2.5 text-[13px] leading-relaxed text-muted">
            <p>{t('setup.rester.p1')}</p>
            <p>{t('setup.rester.p2')}</p>
          </div>

          <label className="mt-1 flex cursor-pointer items-center gap-2.5 text-[13px]">
            <input type="checkbox" checked={keepSignedIn}
                   onChange={(e) => setKeepSignedIn(e.target.checked)}
                   className="h-4 w-4 accent-[var(--accent)]" />
            {t('setup.rester.case')}
          </label>
        </section>

        {/* ---- actions ---- */}
        <div className="sticky bottom-0 -mx-6 flex items-center justify-end gap-2.5 border-t border-line bg-bg px-6 py-4">
          <button type="button" onClick={runTest} disabled={!canTest}
                  className="flex h-9 items-center gap-2 rounded-md border border-line2 px-4 text-[13px] disabled:opacity-40">
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {t('setup.actions.tester')}
          </button>
          <button type="button" onClick={save} disabled={!succeeded || busy}
                  className="flex h-9 items-center gap-2 rounded-md px-4 text-[13px] font-semibold disabled:opacity-40"
                  style={{ background: 'var(--accent)', color: '#20242a' }}>
            {busy && succeeded && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {t('setup.actions.enregistrer')}
          </button>
        </div>

        {saveError && (
          <p className="text-[13px]" style={{ color: 'var(--bad)' }}>{saveError}</p>
        )}
      </div>
    </div>
  );
}
