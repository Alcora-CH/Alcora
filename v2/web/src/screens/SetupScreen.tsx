import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen, Check, Eye, EyeOff, Loader2, Maximize2, Minimize2, Minus, RotateCcw, ShieldCheck, X,
} from 'lucide-react';
import { bridge, isMocked } from '../lib/bridge';
import { useLangue } from '../i18n';
import { Bouton } from '../ui/Bouton';
import { Carte, EnTete } from '../ui/Cadre';
import { Info } from '../ui/Info';
import { Interrupteur } from '../ui/Interrupteur';
import { Champ } from '../ui/Champ';
import { cx } from '../ui/cx';
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

/** L'état d'une étape de la vérification, dans une pastille ronde (maquette A). */
function StepIcon({ state }: { state: StepState }) {
  const rond = 'grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full';
  switch (state) {
    case 'reussi': return <span className={cx(rond, 'bg-ok-soft text-ok')}><Check className="h-3 w-3" strokeWidth={2.5} /></span>;
    case 'echoue': return <span className={cx(rond, 'bg-bad-soft text-bad')}><X className="h-3 w-3" strokeWidth={2.5} /></span>;
    case 'encours': return <span className={rond}><Loader2 className="h-4 w-4 animate-spin text-accent" /></span>;
    case 'ignore': return <span className={cx(rond, 'bg-card2 text-soft')}><Minus className="h-3 w-3" /></span>;
    default: return <span className={rond}><span className="h-1.5 w-1.5 rounded-full bg-soft" /></span>;
  }
}

/**
 * Le numéro d'une étape du formulaire — règle « Clarté avant texte » (24.10.2026) : on voit
 * où l'on en est au lieu de le lire. Coché quand l'étape est faite, doré quand c'est son tour.
 */
function Numero({ n, fait, courant }: { n: number; fait: boolean; courant: boolean }) {
  return (
    <span aria-hidden className={cx('grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full text-meta font-semibold transition-colors',
      fait ? 'bg-ok-soft text-ok' : courant ? 'bg-accent text-sur-accent' : 'bg-card3 text-muted')}>
      {fait ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : n}
    </span>
  );
}

/** Un bloc du formulaire : son titre, puis ses champs. */
function Bloc({ titre, children, className }: { titre?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <Carte className={cx('px-5 py-[18px]', className)}>
      {titre && <h2 className="mb-3.5 flex items-center gap-2.5 text-titre font-semibold">{titre}</h2>}
      {children}
    </Carte>
  );
}

/**
 * Le guide d'activation du RTSP, POSE dans l'ecran de connexion.
 *
 * Pas un lien, pas une fenetre : le guide se voit sans qu'on ait rien a demander, et
 * « agrandir » le deplie sur place. Une seconde fenetre etait une seconde page — ce que
 * cet ecran n'a aucune raison d'imposer. Direction « Observatoire » : il tient la colonne
 * de droite, toujours visible pendant la saisie.
 *
 * C'est un CADRE sur le fichier embarque (v2/web/public/guide-rtsp.html, copie depuis
 * site/ a la construction), et non un composant recrit : deux versions du meme guide
 * finiraient par diverger, et c'est celle qu'on ne relit pas qui resterait fausse. La
 * fenetre « Aide » des reglages (cadre/FenetreGuide.tsx) montre le meme fichier.
 *
 * « sandbox » sans « allow-same-origin » est le point qui compte : le cadre partagerait
 * sinon l'origine de l'interface et pourrait atteindre le pont vers le processus
 * principal. Prive de cette permission, il obtient une origine opaque — ses scripts
 * tournent, son animation vit, mais il ne voit rien de l'application. Le guide sait deja
 * se passer de stockage local, qui echoue dans ce cas.
 */
function GuideRtsp() {
  const t = useLangue();
  const [grand, setGrand] = useState(false);

  return (
    <Carte className="px-5 py-[18px]">
      {/* Le bouton à CÔTÉ du titre, pas dedans : un titre ne contient pas de commande. */}
      <div className="flex items-center gap-2.5">
        <BookOpen className="h-4 w-4 shrink-0 text-accent" aria-hidden />
        <h2 className="text-titre font-semibold">{t('setup.prealable.titre')}</h2>
        <Bouton taille="petit" icone={grand ? Minimize2 : Maximize2} aria-expanded={grand}
                onClick={() => setGrand((v) => !v)} className="ml-auto">
          {grand ? t('setup.guide.reduire') : t('setup.guide.agrandir')}
        </Bouton>
      </div>

      {/*
        La hauteur est la SEULE chose qui change entre les deux tailles, et elle est
        animee : le guide ne se recharge pas, son animation ne repart pas de zero.
        « 78vh » agrandi laisse voir le formulaire dessous — on reste dans la page.
      */}
      <div className="mt-3.5 overflow-hidden rounded-[10px] border border-line2"
           style={{ height: grand ? '78vh' : 340, background: '#0b1017',
                    transition: 'height var(--ample) var(--pose)' }}>
        <iframe
          src="guide-rtsp.html?integre=1"
          title={t('camera.guide')}
          sandbox="allow-scripts"
          className="h-full w-full"
          style={{ border: 0 }}
        />
      </div>

      {/* Les deux préalables, cochés comme une liste à suivre. Le second ne figure pas dans
          le guide, qui ne parle que du flux : le retirer l'aurait fait disparaître en silence. */}
      <ul className="mt-3.5 flex flex-col gap-1.5 text-meta text-muted">
        <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />{t('setup.prealable.rtsp')}</li>
        <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />{t('setup.prealable.compte')}</li>
      </ul>
    </Carte>
  );
}

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

  /* Où en est-on : chaque étape se coche, la première qui reste se dore. */
  const fait1 = Boolean(normalizedHost);
  const fait2 = Boolean(username.trim() && password);
  const fait3 = succeeded;
  const courante = !fait1 ? 1 : !fait2 ? 2 : !fait3 ? 3 : 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* L'en-tête du cadre, comme sur tout écran : la connexion n'est plus une page à part.
          La promesse de l'ancien sous-titre tient dans la pastille. */}
      <EnTete titre={t('setup.titre')}
              actions={(
                <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-card2 px-3 text-meta text-muted">
                  <ShieldCheck className="h-4 w-4" aria-hidden />{t('barre.prive')}
                </span>
              )} />
      <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[1120px] px-7 pt-6">

        {isMocked && (
          <p className="mb-3.5 rounded-lg bg-warn-soft px-3 py-2 text-meta text-warn">{t('setup.demo')}</p>
        )}

        <div className="grid grid-cols-[minmax(0,1fr)_440px] items-start gap-6 max-[1100px]:grid-cols-1">


          <div className="m-cascade flex flex-col gap-4">

            {/* ---- reprise ----
                Une remise à zéro met la connexion de côté plutôt que de la détruire. Tant
                qu'elle est reposable, tout ressaisir n'a aucun sens : on le propose d'abord. */}
            {sauvegarde?.existe && (
              /* La carte de reprise se teinte d'or : c'est le chemin qu'on propose d'abord. */
              <Bloc className="border-accent-ligne bg-[linear-gradient(rgba(220,169,92,.08),rgba(220,169,92,.08))]">
                <div className="flex items-center gap-3.5">
                  <RotateCcw className="h-4 w-4 shrink-0 text-accent" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div>
                      <b className="font-semibold">{t('setup.reprise.conservee')}</b>
                      {sauvegarde.host ? <> · <span className="font-mono">{sauvegarde.host}</span></> : null}
                    </div>
                    <div className={cx('text-meta', repriseEchouee ? 'text-warn' : 'text-soft')}>
                      {repriseEchouee ? t('setup.reprise.echec') : t('setup.reprise.detail')}
                    </div>
                  </div>
                  <Bouton variante="primaire" onClick={reprendre} disabled={reprise}>
                    {reprise ? t('setup.reprise.encours') : t('setup.reprise.bouton')}
                  </Bouton>
                </div>
              </Bloc>
            )}

            {/* ---- contrôleur ---- */}
            <Bloc titre={<><Numero n={1} fait={fait1} courant={courante === 1} />{t('colonne.controleur')}</>}>
              <Champ id="setup-hote" libelle={t('setup.adresse.label')} aide={t('setup.adresse.hint')}
                     value={host} onChange={(e) => setHost(e.target.value)}
                     placeholder="192.168.1.1" inputMode="url" spellCheck={false} autoComplete="off" />
            </Bloc>

            {/* ---- compte ---- */}
            <Bloc titre={<><Numero n={2} fait={fait2} courant={courante === 2} />{t('setup.compte.titre')}</>}>
              <div className="flex flex-col gap-3.5">
                <Champ id="setup-identifiant" libelle={t('setup.compte.identifiant')} aide={t('setup.compte.identifiantHint')}
                       value={username} onChange={(e) => setUsername(e.target.value)}
                       spellCheck={false} autoComplete="username" />

                <Champ id="setup-mdp" libelle={t('setup.compte.motDePasse')}
                       type={showPassword ? 'text' : 'password'}
                       value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password"
                       fin={(
                         <Bouton variante="fantome" taille="petit" icone={showPassword ? EyeOff : Eye}
                                 titre={showPassword ? t('setup.compte.masquerMdp') : t('setup.compte.afficherMdp')}
                                 onClick={() => setShowPassword((v) => !v)} />
                       )} />

                <div>
                  <Champ id="setup-cle" libelle={t('setup.compte.cle')} chasseFixe
                         type={showSeed ? 'text' : 'password'}
                         value={seed} onChange={(e) => setSeed(e.target.value)}
                         spellCheck={false} autoComplete="off" placeholder={t('setup.compte.clePlaceholder')}
                         fin={(
                           <Bouton variante="fantome" taille="petit" icone={showSeed ? EyeOff : Eye}
                                   titre={showSeed ? t('setup.compte.masquerCle') : t('setup.compte.afficherCle')}
                                   onClick={() => setShowSeed((v) => !v)} />
                         )} />
                  <details className="mt-2.5">
                    <summary className="cursor-pointer text-meta text-muted hover:text-ink">{t('setup.aide.question')}</summary>
                    <div className="mt-2 flex flex-col gap-2 rounded-[9px] bg-card2 px-3.5 py-3 leading-relaxed text-muted">
                      <p>{t('setup.aide.p1')}</p>
                      <p>{t('setup.aide.p2')}</p>
                    </div>
                  </details>
                </div>
              </div>
            </Bloc>

            {/* ---- vérification ---- */}
            <Bloc titre={<>
              <Numero n={3} fait={fait3} courant={courante === 3} />
              {t('setup.verification.titre')}
              {slow && <span className="text-meta font-normal text-soft">{t('setup.verification.lent')}</span>}
            </>}>
              <ul className="flex flex-col gap-2.5">
                {STEPS.map(({ id, cle }) => {
                  const r = results[id];
                  const state: StepState = r?.state ?? 'attente';
                  return (
                    <li key={id} className="flex gap-2.5">
                      <div className="mt-px"><StepIcon state={state} /></div>
                      <div className="min-w-0">
                        <div className={state === 'attente' ? 'text-soft' : 'text-ink'}>{t(cle)}</div>
                        {r?.message && <div className="text-meta text-soft">{r.message}</div>}
                        {r?.remedy && <div className="mt-1 text-meta text-warn">{r.remedy}</div>}
                        {r?.technical && (
                          <details className="mt-1">
                            <summary className="cursor-pointer text-meta text-soft">{t('setup.verification.detailTechnique')}</summary>
                            <code className="mt-1 block select-all text-meta text-muted">{r.technical}</code>
                          </details>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>

              {cameras.length > 0 && (
                <div className="mt-3.5 rounded-[9px] bg-card2 px-3.5 py-3">
                  <h3 className="mb-2 font-semibold">{t('setup.cameras.titre')}</h3>
                  <ul className="flex flex-col gap-1.5">
                    {cameras.map((c) => {
                      const best = c.channels.filter((ch) => ch.streamable)
                        .sort((a, b) => b.width - a.width)[0];
                      return (
                        <li key={c.id} className="flex items-center gap-2.5">
                          <span aria-hidden className="h-2 w-2 shrink-0 rounded-full"
                                style={{ background: c.online ? 'var(--ok)' : 'var(--soft)' }} />
                          <span>{c.name}</span>
                          <span className="text-meta tabular-nums text-muted">
                            {best ? `${best.width} × ${best.height}` : t('commun.aucunFlux')}
                          </span>
                          {!c.online && <span className="text-meta text-soft">{t('commun.horsLigne')}</span>}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </Bloc>

            {/* ---- divulgation ---- */}
            {/* Le compromis reste DIT, en une ligne : c'est une question de sécurité, pas une
                aide. Son explication complète est au survol du « i ». */}
            <Bloc>
              <div className="flex items-center gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 font-semibold">{t('setup.rester.titre')}<Info>{t('setup.rester.detail')}</Info></div>
                  <div className="text-meta text-soft">{t('setup.rester.p1')}</div>
                  {keepSignedIn && <div className="text-meta text-warn">{t('setup.rester.p2')}</div>}
                </div>
                <Interrupteur allume={keepSignedIn} onChange={setKeepSignedIn} etiquette={t('setup.rester.case')} />
              </div>
            </Bloc>

            {/* ---- actions ----
                Collantes : elles restent sous la main pendant qu'on fait défiler le
                formulaire, posées sur le ciel plutôt que sur un bandeau plein. */}
            <div className="sticky bottom-3 mb-6">
              <Carte className="flex items-center justify-end gap-2.5 px-5 py-3.5 shadow-[0_18px_40px_-18px_rgba(0,0,0,.7)]">
                {saveError && <p className="mr-auto text-meta text-bad">{saveError}</p>}
                <Bouton onClick={runTest} disabled={!canTest} icone={busy && !succeeded ? Loader2 : undefined}
                        className={busy && !succeeded ? '[&>svg]:animate-spin' : undefined}>
                  {t('setup.actions.tester')}
                </Bouton>
                <Bouton variante="primaire" onClick={save} disabled={!succeeded || busy}
                        icone={busy && succeeded ? Loader2 : undefined}
                        className={busy && succeeded ? '[&>svg]:animate-spin' : undefined}>
                  {t('setup.actions.enregistrer')}
                </Bouton>
              </Carte>
            </div>
          </div>

          {/* ---- le guide : à droite, toujours visible pendant la saisie ----
              Deux gestes se font sur la console, pas ici, et rien ne les rappelait :
              l'utilisateur remplissait le formulaire, se connectait avec succès, puis se
              retrouvait devant des caméras muettes. Sur une fenêtre étroite, il passe AVANT
              le formulaire : c'est ce qu'il faut avoir fait d'abord. */}
          <aside className="sticky top-5 max-[1100px]:static max-[1100px]:order-first">
            <GuideRtsp />
          </aside>
        </div>
      </div>
      </div>
    </div>
  );
}
