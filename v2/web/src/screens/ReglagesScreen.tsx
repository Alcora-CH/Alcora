import { useEffect, useState } from 'react';
import { AlertTriangle, FolderOpen } from 'lucide-react';
import { bridge } from '../lib/bridge';
import { Marque } from '../Marque';
import { changementsDe, VERSIONS } from '../versions';
import { CODES_LANGUE, definirLangue, LANGUES, useLangue, type CodeLangue } from '../i18n';
import type { Confort, Infos, MajState } from '../types/protect';

/**
 * Reglages.
 *
 * Deux besoins qui se rejoignent : savoir quelle version tourne pour pouvoir la citer, et
 * disposer d'une porte de sortie quand la configuration est fautive. Cette porte etait
 * auparavant un simple bouton qui effacait tout au premier clic — sans confirmation, une
 * main qui derape deconnectait l'application.
 */
export function ReglagesScreen({ espacement, onEspacementChange, onReconfigurer }: {
  espacement: number;
  onEspacementChange: (n: number) => void;
  onReconfigurer: () => void;
}) {
  const [infos, setInfos] = useState<Infos | null>(null);
  const [confirme, setConfirme] = useState(false);
  const [maj, setMaj] = useState<MajState | null>(null);
  const [auto, setAuto] = useState<{ actif: boolean; disponible: boolean } | null>(null);
  const [confort, setConfort] = useState<Confort | null>(null);
  const [langueChoix, setLangueChoix] = useState<CodeLangue | 'auto'>('auto');
  const t = useLangue();

  useEffect(() => { bridge.langue().then((l) => setLangueChoix(l.choix)).catch(() => {}); }, []);

  /* Le changement s'applique SUR-LE-CHAMP : le principal grave le choix et rend la
     langue effective, l'ecran s'y accorde sans redemarrer ni rien perdre. */
  const changerLangue = async (choix: CodeLangue | 'auto') => {
    setLangueChoix(choix);
    try {
      const l = await bridge.langueChanger(choix);
      definirLangue(l.effective);
    } catch { /* demonstration sans pont : rien a graver */ }
  };

  useEffect(() => { bridge.infos().then(setInfos).catch(() => {}); }, []);
  useEffect(() => { bridge.autoDemarrage().then(setAuto).catch(() => {}); }, []);
  useEffect(() => { bridge.confort().then(setConfort).catch(() => {}); }, []);
  useEffect(() => bridge.onMajState(setMaj), []);

  // La confirmation ne reste pas armee : s'eloigner doit suffire a l'annuler.
  useEffect(() => {
    if (!confirme) return;
    const t = setTimeout(() => setConfirme(false), 6000);
    return () => clearTimeout(t);
  }, [confirme]);

  const actuelle = infos?.version;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-[640px] flex-col gap-8 px-6 py-9">

        <header>
          <h1 className="text-[19px] font-semibold">{t('reglages.titre')}</h1>
          <p className="mt-1 text-[13px] text-muted">
            {t('reglages.sousTitre')}
          </p>
        </header>

        {/* ---- version ---- */}
        <section>
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-soft">
            {t('reglages.version.titre')}
          </h2>
          <div className="rounded-lg border border-line bg-card p-4">
            <div className="flex items-center gap-3">
              <Marque taille={28} anime />
              <p className="font-mono text-[17px]" style={{ color: 'var(--accent-d)' }}>
                Alcora {actuelle ?? '…'}
              </p>
            </div>
            <p className="mt-1 text-[12.5px] text-soft">
              {maj?.etat === 'verification' ? t('reglages.version.verification')
                : maj?.etat === 'telechargement' ? t('reglages.version.telechargement',
                    { version: maj.version ?? '', pourcent: maj.pourcent ?? 0 })
                : maj?.etat === 'prete' ? t('reglages.version.prete', { version: maj.version ?? '' })
                : maj?.etat === 'erreur' ? t('reglages.version.erreur')
                : t('reglages.version.repos')}
            </p>
            <button onClick={() => { void bridge.majVerifier(); }}
                    disabled={maj?.etat === 'verification' || maj?.etat === 'telechargement'}
                    className="mt-3 rounded-md border border-line px-3 py-1.5 text-[13px] text-muted transition-colors hover:border-line2 hover:text-ink disabled:opacity-40">
              {t('reglages.version.verifier')}
            </button>
          </div>
        </section>

        {/* ---- langue ---- */}
        <section>
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-soft">
            {t('reglages.langue.titre')}
          </h2>
          <div className="rounded-lg border border-line bg-card p-4">
            <div className="flex items-center justify-between gap-4">
              <p className="text-[12.5px] text-soft">{t('reglages.langue.detail')}</p>
              {/* Les langues viennent du REGISTRE : en ajouter une n'exige rien ici.
                  Chaque nom s'ecrit dans sa propre langue — c'est ainsi qu'on retrouve
                  la sienne dans une interface qu'on ne comprend pas. */}
              <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                {(['auto', ...CODES_LANGUE] as const).map((c) => (
                  <button key={c} onClick={() => { void changerLangue(c); }}
                          aria-pressed={langueChoix === c}
                          className="rounded-md border px-3 py-1 text-[12.5px] transition-colors"
                          style={langueChoix === c
                            ? { borderColor: 'var(--accent)', color: 'var(--accent-d)', background: 'var(--accent-soft)' }
                            : { borderColor: 'var(--line2)', color: 'var(--muted)' }}>
                    {c === 'auto' ? t('reglages.langue.auto') : LANGUES[c].nom}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ---- apparence ---- */}
        <section>
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-soft">
            {t('reglages.apparence.titre')}
          </h2>
          <div className="rounded-lg border border-line bg-card p-4">
            <div>
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-[14px]">{t('reglages.apparence.espacement')}</span>
                <span className="font-mono text-[12px] text-soft">
                  {espacement === 0 ? t('reglages.apparence.aucun') : `${espacement} px`}
                </span>
              </div>
              <input type="range" min={0} max={24} step={1} value={espacement}
                     onChange={(e) => onEspacementChange(Number(e.target.value))}
                     className="mt-2 w-full" style={{ accentColor: 'var(--accent)' }}
                     aria-label={t('reglages.apparence.espacement')} />
              <p className="mt-1 text-[12.5px] text-soft">
                {t('reglages.apparence.detail')}
              </p>
            </div>
          </div>
        </section>

        {/* ---- démarrage ---- */}
        <section>
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-soft">
            {t('reglages.demarrage.titre')}
          </h2>
          <div className="rounded-lg border border-line bg-card p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[14px]">{t('reglages.demarrage.ouvrir')}</p>
                <p className="mt-1 text-[12.5px] text-soft">
                  {auto?.disponible === false
                    ? t('reglages.demarrage.indisponible')
                    : t('reglages.demarrage.detail')}
                </p>
              </div>
              {/* L'etat affiche vient du REGISTRE, relu apres chaque bascule : le bouton ne
                  peut pas pretendre un demarrage automatique qui n'existe pas. */}
              <button
                onClick={() => {
                  if (!auto?.disponible) return;
                  void bridge.autoDemarrageChanger(!auto.actif).then(setAuto).catch(() => {});
                }}
                disabled={!auto?.disponible}
                role="switch" aria-checked={Boolean(auto?.actif)}
                aria-label={t('reglages.demarrage.ouvrir')}
                className="relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40"
                style={{ background: auto?.actif ? 'var(--accent)' : 'var(--line2)' }}
              >
                <span className="absolute top-0.5 h-5 w-5 rounded-full transition-all"
                      style={{ left: auto?.actif ? 22 : 2, background: '#20242a' }} />
              </button>
            </div>
          </div>
        </section>

        {/* ---- confort ---- */}
        <section>
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-soft">
            {t('reglages.confort.titre')}
          </h2>
          <div className="rounded-lg border border-line bg-card p-4">
            <p className="text-[14px]">{t('reglages.confort.dossier')}</p>
            {/* Le dossier des IMAGES de Windows, pas un recoin du dossier de donnees : une
                capture se prend pour la montrer, elle doit se retrouver la ou l'on cherche. */}
            <p className="mt-1 truncate font-mono text-[12px] text-soft" title={confort?.dossierCaptures}>
              {confort?.dossierCaptures ?? '…'}
            </p>
            <div className="mt-2.5 flex gap-2">
              <button onClick={() => { void bridge.choisirDossierCaptures().then(setConfort).catch(() => {}); }}
                      className="flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-[12.5px] text-muted transition-colors hover:border-line2 hover:text-ink">
                <FolderOpen className="h-3.5 w-3.5" /> {t('reglages.confort.changer')}
              </button>
              <button onClick={() => { void bridge.ouvrirCaptures(); }}
                      className="rounded-md border border-line px-3 py-1.5 text-[12.5px] text-muted transition-colors hover:border-line2 hover:text-ink">
                {t('commun.ouvrirDossier')}
              </button>
            </div>

            <div className="my-3.5 h-px bg-line" />

            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[14px]">{t('reglages.confort.son')}</p>
                <p className="mt-1 text-[12.5px] text-soft">
                  {t('reglages.confort.sonDetail')}
                </p>
              </div>
              <button
                onClick={() => {
                  if (!confort) return;
                  void bridge.confortEnregistrer({ ...confort, sonParDefaut: !confort.sonParDefaut })
                    .then(setConfort).catch(() => {});
                }}
                role="switch" aria-checked={Boolean(confort?.sonParDefaut)}
                aria-label={t('reglages.confort.son')}
                className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
                style={{ background: confort?.sonParDefaut ? 'var(--accent)' : 'var(--line2)' }}
              >
                <span className="absolute top-0.5 h-5 w-5 rounded-full transition-all"
                      style={{ left: confort?.sonParDefaut ? 22 : 2, background: '#20242a' }} />
              </button>
            </div>
          </div>
        </section>

        {/* ---- historique ---- */}
        <section>
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-soft">
            {t('reglages.historique.titre')}
          </h2>
          <div className="flex flex-col gap-3">
            {VERSIONS.map((v) => {
              const enCours = v.version === actuelle;
              return (
                <article key={v.version}
                         className="rounded-lg border bg-card p-4"
                         style={{ borderColor: enCours ? 'var(--accent)' : 'var(--line)' }}>
                  <div className="mb-2 flex items-baseline gap-2.5">
                    <span className="font-mono text-[13.5px]"
                          style={{ color: enCours ? 'var(--accent-d)' : 'var(--ink)' }}>
                      {v.version}
                    </span>
                    <span className="font-mono text-[11.5px] text-soft">{v.date}</span>
                    {enCours && (
                      <span className="rounded px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide"
                            style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                        {t('reglages.historique.installee')}
                      </span>
                    )}
                  </div>
                  <ul className="flex flex-col gap-1.5">
                    {changementsDe(v).map((c, i) => (
                      <li key={i} className="flex gap-2 text-[13px] text-muted">
                        <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full"
                              style={{ background: 'var(--soft)' }} />
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        </section>

        {/* ---- connexion ---- */}
        <section>
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-soft">
            {t('reglages.connexion.titre')}
          </h2>
          <div className="rounded-lg border border-line bg-card p-4">
            <dl className="flex flex-col gap-2 text-[13px]">
              <div className="flex justify-between gap-4">
                <dt className="text-soft">{t('reglages.connexion.controleur')}</dt>
                <dd className="font-mono">{infos?.host ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-soft">{t('reglages.connexion.compte')}</dt>
                <dd className="truncate font-mono">{infos?.username || '—'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-soft">{t('reglages.connexion.identite')}</dt>
                <dd style={{ color: infos?.appaire ? 'var(--ok)' : 'var(--warn)' }}>
                  {infos?.appaire ? t('reglages.connexion.oui') : t('reglages.connexion.non')}
                </dd>
              </div>
            </dl>

            <div className="my-4 h-px bg-line" />

            {!confirme ? (
              <button onClick={() => setConfirme(true)}
                      className="rounded-md border border-line px-3 py-1.5 text-[13px] text-muted transition-colors hover:border-line2 hover:text-ink">
                {t('reglages.connexion.modifier')}
              </button>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="flex gap-2 text-[13px]" style={{ color: 'var(--warn)' }}>
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{t('reglages.connexion.avertissement')}</span>
                </p>
                <div className="flex gap-2">
                  <button onClick={onReconfigurer}
                          className="rounded-md px-3 py-1.5 text-[13px] font-semibold"
                          style={{ background: 'var(--bad)', color: '#20242a' }}>
                    {t('reglages.connexion.effacer')}
                  </button>
                  <button onClick={() => setConfirme(false)}
                          className="rounded-md border border-line px-3 py-1.5 text-[13px] text-muted transition-colors hover:border-line2">
                    {t('reglages.connexion.annuler')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ---- diagnostic ---- */}
        <section>
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-soft">
            {t('reglages.probleme.titre')}
          </h2>
          <div className="rounded-lg border border-line bg-card p-4">
            <p className="text-[13px] text-muted">
              {t('reglages.probleme.detail')}
            </p>
            <p className="mt-2 break-all font-mono text-[11.5px] text-soft">
              {infos?.journal ?? '…'}
            </p>
            <button onClick={() => { void bridge.ouvrirJournal(); }}
                    className="mt-3 flex items-center gap-2 rounded-md border border-line px-3 py-1.5 text-[13px] text-muted transition-colors hover:border-line2 hover:text-ink">
              <FolderOpen className="h-4 w-4" /> {t('commun.ouvrirDossier')}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
