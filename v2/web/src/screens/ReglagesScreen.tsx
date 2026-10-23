import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, BookOpen, ExternalLink, FolderOpen, Keyboard } from 'lucide-react';
import { bridge } from '../lib/bridge';
import { Marque } from '../Marque';
import { changementsDe, VERSIONS } from '../versions';
import { CODES_LANGUE, definirLangue, LANGUES, useLangue, type CodeLangue } from '../i18n';
import { Bouton } from '../ui/Bouton';
import { Carte, EnTete, Rangee } from '../ui/Cadre';
import { Interrupteur } from '../ui/Interrupteur';
import { Segment } from '../ui/Segment';
import { cx } from '../ui/cx';
import type { Cle } from '../i18n/fr';
import type { Confort, Infos, MajState } from '../types/protect';

/**
 * Reglages — direction « Observatoire », maquette A du 23.10.2026.
 *
 * Deux besoins qui se rejoignent : savoir quelle version tourne pour pouvoir la citer, et
 * disposer d'une porte de sortie quand la configuration est fautive. Cette porte etait
 * auparavant un simple bouton qui effacait tout au premier clic — sans confirmation, une
 * main qui derape deconnectait l'application.
 *
 * Une colonne de 640 px empilait huit sections ; un sommaire les montre toutes d'un coup
 * et mene a chacune. Toutes les rangees se ressemblent (ui/Cadre.tsx, « Rangee ») : ce que
 * c'est et ce que ca fait a gauche, la commande a droite. Deux sections s'ajoutent : Aide
 * (les raccourcis, le guide de la console) et A propos (ce qui fait tourner l'application,
 * sa licence, ses sources). « Ce qui a change » passe en dernier : c'est la plus longue.
 */

const SECTIONS: { id: string; cle: Cle }[] = [
  { id: 'version', cle: 'reglages.version.titre' },
  { id: 'langue', cle: 'reglages.langue.titre' },
  { id: 'apparence', cle: 'reglages.apparence.titre' },
  { id: 'demarrage', cle: 'reglages.demarrage.titre' },
  { id: 'confort', cle: 'reglages.confort.titre' },
  { id: 'connexion', cle: 'reglages.connexion.titre' },
  { id: 'probleme', cle: 'reglages.probleme.titre' },
  { id: 'aide', cle: 'reglages.aide.titre' },
  { id: 'apropos', cle: 'reglages.apropos.titre' },
  { id: 'historique', cle: 'reglages.historique.titre' },
];

/** Les adresses publiques du projet : le depot du code et le site. */
const DEPOT = 'https://github.com/Alcora-CH/Alcora';
const SITE = 'https://alcora.ch';

function Bloc({ id, titre, children }: { id: string; titre: string; children: React.ReactNode }) {
  return (
    <section id={`reglages-${id}`} className="scroll-mt-6">
      <h2 className="mb-2.5 text-titre font-semibold">{titre}</h2>
      {children}
    </section>
  );
}

/** Une valeur technique a droite d'une rangee : un nom d'hote, une version. */
function Valeur({ children, ton }: { children: React.ReactNode; ton?: string }) {
  return <span className="shrink-0 font-mono tabular-nums" style={ton ? { color: ton } : undefined}>{children}</span>;
}

/** Un lien externe : la fenetre le confie au navigateur (https seulement, main.js). */
function LienExterne({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer"
       className="m-pression inline-flex h-8 shrink-0 items-center gap-[7px] whitespace-nowrap rounded-lg border border-transparent px-3 text-muted transition-colors hover:bg-card2 hover:text-ink">
      <ExternalLink className="h-4 w-4" aria-hidden />{children}
    </a>
  );
}

export function ReglagesScreen({
  espacement, onEspacementChange, fondAnime, onFondAnimeChange, onReconfigurer, onRaccourcis, onGuide,
}: {
  espacement: number;
  onEspacementChange: (n: number) => void;
  fondAnime: boolean;
  onFondAnimeChange: (actif: boolean) => void;
  onReconfigurer: () => void;
  onRaccourcis: () => void;
  onGuide: () => void;
}) {
  const [infos, setInfos] = useState<Infos | null>(null);
  const [confirme, setConfirme] = useState(false);
  const [maj, setMaj] = useState<MajState | null>(null);
  const [auto, setAuto] = useState<{ actif: boolean; disponible: boolean } | null>(null);
  const [confort, setConfort] = useState<Confort | null>(null);
  const [langueChoix, setLangueChoix] = useState<CodeLangue | 'auto'>('auto');
  const [licencesAbsentes, setLicencesAbsentes] = useState(false);
  const [courante, setCourante] = useState(SECTIONS[0].id);
  const corps = useRef<HTMLDivElement>(null);
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

  /* Le sommaire suit la lecture : la section dont le titre a passé le haut de la zone. */
  useEffect(() => {
    const el = corps.current;
    if (!el) return;
    const suivre = () => {
      // La marge de défilement des sections est de 24 px : le seuil la dépasse un peu.
      const haut = el.getBoundingClientRect().top + 48;
      let id = SECTIONS[0].id;
      for (const s of SECTIONS) {
        const n = document.getElementById(`reglages-${s.id}`);
        if (n && n.getBoundingClientRect().top <= haut) id = s.id;
      }
      // Tout en bas, la derniere section est la courante, meme courte.
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) id = SECTIONS[SECTIONS.length - 1].id;
      setCourante(id);
    };
    el.addEventListener('scroll', suivre, { passive: true });
    return () => el.removeEventListener('scroll', suivre);
  }, []);

  const aller = (id: string) => {
    setCourante(id);
    document.getElementById(`reglages-${id}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  const actuelle = infos?.version;

  return (
    <div className="flex h-full flex-col">
      <EnTete titre={t('reglages.titre')} precision={t('reglages.sousTitre')} />

      <div ref={corps} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto grid max-w-[1080px] grid-cols-[190px_minmax(0,1fr)] gap-9 px-6 pb-12 pt-[22px] max-[1000px]:grid-cols-1">

          {/* ---- le sommaire ---- */}
          <nav aria-label={t('reglages.sommaire')} className="sticky top-[22px] flex flex-col self-start max-[1000px]:hidden">
            {SECTIONS.map((s) => (
              <button key={s.id} type="button" onClick={() => aller(s.id)}
                      aria-current={courante === s.id ? 'true' : undefined}
                      className={cx('rounded-lg px-3 py-[7px] text-left transition-colors',
                        courante === s.id ? 'bg-card2 text-ink' : 'text-muted hover:text-ink')}>
                {t(s.cle)}
              </button>
            ))}
          </nav>

          <div className="m-cascade flex flex-col gap-[26px]">

            {/* ---- version ---- */}
            <Bloc id="version" titre={t('reglages.version.titre')}>
              <Carte>
                <Rangee
                  titre={(
                    <span className="flex items-center gap-2.5">
                      <Marque taille={22} anime={fondAnime} />
                      <span className="font-mono text-titre text-accent-d">Alcora {actuelle ?? '…'}</span>
                    </span>
                  )}
                  explication={
                    maj?.etat === 'verification' ? t('reglages.version.verification')
                      : maj?.etat === 'telechargement' ? t('reglages.version.telechargement',
                          { version: maj.version ?? '', pourcent: maj.pourcent ?? 0 })
                      : maj?.etat === 'prete' ? t('reglages.version.prete', { version: maj.version ?? '' })
                      : maj?.etat === 'erreur' ? t('reglages.version.erreur')
                      : maj?.etat === 'manuelle' ? t('reglages.version.manuelle')
                      : t('reglages.version.repos')}>
                  {/* Sans chaine automatique, le bouton n'aurait rien a lancer : il disparait
                      plutot que de rester la sans effet. */}
                  {maj?.etat !== 'manuelle' && (
                    <Bouton onClick={() => { void bridge.majVerifier(); }}
                            disabled={maj?.etat === 'verification' || maj?.etat === 'telechargement'}>
                      {t('reglages.version.verifier')}
                    </Bouton>
                  )}
                </Rangee>
              </Carte>
            </Bloc>

            {/* ---- langue ---- */}
            <Bloc id="langue" titre={t('reglages.langue.titre')}>
              <Carte>
                <Rangee explication={t('reglages.langue.detail')}>
                  {/* Les langues viennent du REGISTRE : en ajouter une n'exige rien ici.
                      Chaque nom s'ecrit dans sa propre langue — c'est ainsi qu'on retrouve
                      la sienne dans une interface qu'on ne comprend pas. */}
                  <Segment etiquette={t('reglages.langue.titre')} valeur={langueChoix}
                           onChange={(c) => { void changerLangue(c); }}
                           options={(['auto', ...CODES_LANGUE] as const).map((c) => ({
                             valeur: c, libelle: c === 'auto' ? t('reglages.langue.auto') : LANGUES[c].nom,
                           }))} />
                </Rangee>
              </Carte>
            </Bloc>

            {/* ---- apparence ---- */}
            <Bloc id="apparence" titre={t('reglages.apparence.titre')}>
              <Carte>
                <div className="px-[18px] py-4">
                  <div className="flex items-baseline gap-6">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{t('reglages.apparence.espacement')}</div>
                      <p className="mt-[3px] text-meta leading-normal text-muted">{t('reglages.apparence.detail')}</p>
                    </div>
                    <Valeur>{espacement === 0 ? t('reglages.apparence.aucun') : `${espacement} px`}</Valeur>
                  </div>
                  <input type="range" min={0} max={24} step={1} value={espacement}
                         onChange={(e) => onEspacementChange(Number(e.target.value))}
                         className="mt-3 w-full accent-[var(--accent)]"
                         aria-label={t('reglages.apparence.espacement')} />
                </div>
                <div className="border-t border-line">
                  <Rangee titre={t('reglages.apparence.fond')} explication={t('reglages.apparence.fondDetail')}>
                    <Interrupteur allume={fondAnime} onChange={onFondAnimeChange} etiquette={t('reglages.apparence.fond')} />
                  </Rangee>
                </div>
              </Carte>
            </Bloc>

            {/* ---- démarrage ---- */}
            <Bloc id="demarrage" titre={t('reglages.demarrage.titre')}>
              <Carte>
                <Rangee titre={t('reglages.demarrage.ouvrir')}
                        explication={auto?.disponible === false
                          ? t('reglages.demarrage.indisponible') : t('reglages.demarrage.detail')}>
                  {/* L'etat affiche vient du REGISTRE, relu apres chaque bascule : le bouton ne
                      peut pas pretendre un demarrage automatique qui n'existe pas. */}
                  <Interrupteur allume={Boolean(auto?.actif)} desactive={!auto?.disponible}
                                etiquette={t('reglages.demarrage.ouvrir')}
                                onChange={(v) => {
                                  if (!auto?.disponible) return;
                                  void bridge.autoDemarrageChanger(v).then(setAuto).catch(() => {});
                                }} />
                </Rangee>
              </Carte>
            </Bloc>

            {/* ---- captures et son ---- */}
            <Bloc id="confort" titre={t('reglages.confort.titre')}>
              <Carte>
                {/* Le dossier des IMAGES de Windows, pas un recoin du dossier de donnees : une
                    capture se prend pour la montrer, elle doit se retrouver la ou l'on cherche. */}
                <Rangee titre={t('reglages.confort.dossier')}
                        explication={<span className="block truncate font-mono" title={confort?.dossierCaptures}>{confort?.dossierCaptures ?? '…'}</span>}>
                  <Bouton icone={FolderOpen} onClick={() => { void bridge.choisirDossierCaptures().then(setConfort).catch(() => {}); }}>
                    {t('reglages.confort.changer')}
                  </Bouton>
                  <Bouton variante="fantome" onClick={() => { void bridge.ouvrirCaptures(); }}>{t('commun.ouvrirDossier')}</Bouton>
                </Rangee>
                <Rangee titre={t('reglages.confort.son')} explication={t('reglages.confort.sonDetail')}>
                  <Interrupteur allume={Boolean(confort?.sonParDefaut)} etiquette={t('reglages.confort.son')}
                                onChange={() => {
                                  if (!confort) return;
                                  void bridge.confortEnregistrer({ ...confort, sonParDefaut: !confort.sonParDefaut })
                                    .then(setConfort).catch(() => {});
                                }} />
                </Rangee>
              </Carte>
            </Bloc>

            {/* ---- connexion ---- */}
            <Bloc id="connexion" titre={t('reglages.connexion.titre')}>
              <Carte>
                <Rangee titre={t('reglages.connexion.controleur')}><Valeur>{infos?.host ?? '—'}</Valeur></Rangee>
                <Rangee titre={t('reglages.connexion.compte')}><Valeur>{infos?.username || '—'}</Valeur></Rangee>
                <Rangee titre={t('reglages.connexion.identite')}>
                  <span className={infos?.appaire ? 'text-ok' : 'text-warn'}>
                    {infos?.appaire ? t('reglages.connexion.oui') : t('reglages.connexion.non')}
                  </span>
                </Rangee>
                <div className="border-t border-line px-[18px] py-4">
                  {!confirme ? (
                    <Bouton onClick={() => setConfirme(true)}>{t('reglages.connexion.modifier')}</Bouton>
                  ) : (
                    <>
                      <p className="flex gap-2.5 rounded-[9px] bg-bad-soft px-3 py-2.5 text-bad">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                        <span>{t('reglages.connexion.avertissement')}</span>
                      </p>
                      <div className="mt-3 flex gap-2">
                        <Bouton variante="danger" onClick={onReconfigurer}>{t('reglages.connexion.effacer')}</Bouton>
                        <Bouton variante="fantome" onClick={() => setConfirme(false)}>{t('reglages.connexion.annuler')}</Bouton>
                      </div>
                    </>
                  )}
                </div>
              </Carte>
            </Bloc>

            {/* ---- en cas de problème ---- */}
            <Bloc id="probleme" titre={t('reglages.probleme.titre')}>
              <Carte>
                <Rangee explication={(
                  <>
                    <span className="block text-corps text-muted">{t('reglages.probleme.detail')}</span>
                    <span className="mt-1.5 block break-all font-mono text-soft">{infos?.journal ?? '…'}</span>
                  </>
                )}>
                  <Bouton icone={FolderOpen} onClick={() => { void bridge.ouvrirJournal(); }}>{t('commun.ouvrirDossier')}</Bouton>
                </Rangee>
              </Carte>
            </Bloc>

            {/* ---- aide ---- */}
            <Bloc id="aide" titre={t('reglages.aide.titre')}>
              <Carte>
                <Rangee titre={t('raccourcis.titre')} explication={t('reglages.aide.raccourcisDetail')}>
                  <Bouton icone={Keyboard} onClick={onRaccourcis}>{t('reglages.aide.voirRaccourcis')}</Bouton>
                </Rangee>
                <Rangee titre={t('reglages.aide.guide')} explication={t('reglages.aide.guideDetail')}>
                  <Bouton icone={BookOpen} onClick={onGuide}>{t('reglages.aide.ouvrirGuide')}</Bouton>
                </Rangee>
              </Carte>
            </Bloc>

            {/* ---- à propos ---- */}
            <Bloc id="apropos" titre={t('reglages.apropos.titre')}>
              <Carte>
                <Rangee titre="Alcora" explication={t('reglages.apropos.alcora')}><Valeur>{actuelle ?? '…'}</Valeur></Rangee>
                <Rangee titre={t('reglages.apropos.moteur')}><Valeur>{infos ? `Electron ${infos.electron}` : '…'}</Valeur></Rangee>
                <Rangee titre={t('reglages.apropos.relais')}><Valeur>{infos ? `MediaMTX ${infos.relais}` : '…'}</Valeur></Rangee>
                <Rangee titre={t('reglages.apropos.licence')} explication={t('reglages.apropos.licenceDetail')}>
                  <LienExterne href={DEPOT}>{t('reglages.apropos.source')}</LienExterne>
                </Rangee>
                <Rangee titre={t('reglages.apropos.tiers')}
                        explication={licencesAbsentes ? t('reglages.apropos.licencesAbsentes') : t('reglages.apropos.tiersDetail')}>
                  <Bouton variante="fantome"
                          onClick={() => { void bridge.ouvrirLicences().then((ok) => setLicencesAbsentes(!ok)).catch(() => setLicencesAbsentes(true)); }}>
                    {t('reglages.apropos.voirLicences')}
                  </Bouton>
                </Rangee>
                <Rangee titre={t('reglages.apropos.site')}>
                  <LienExterne href={SITE}>alcora.ch</LienExterne>
                </Rangee>
              </Carte>
            </Bloc>

            {/* ---- ce qui a changé ---- */}
            <Bloc id="historique" titre={t('reglages.historique.titre')}>
              <Carte>
                {VERSIONS.map((v) => {
                  const enCours = v.version === actuelle;
                  return (
                    <article key={v.version} className="px-[18px] py-4 [&+&]:border-t [&+&]:border-line">
                      <div className="mb-2 flex items-baseline gap-2.5">
                        <span className={cx('font-mono', enCours ? 'text-accent-d' : 'text-ink')}>{v.version}</span>
                        <span className="text-meta tabular-nums text-soft">{v.date}</span>
                        {enCours && (
                          <span className="rounded-md bg-accent-soft px-2 py-0.5 text-micro font-semibold text-accent">
                            {t('reglages.historique.installee')}
                          </span>
                        )}
                      </div>
                      <ul className="flex flex-col gap-1.5">
                        {changementsDe(v).map((c, i) => (
                          <li key={i} className="flex gap-2 text-muted">
                            <span aria-hidden className="mt-[8px] h-1 w-1 shrink-0 rounded-full bg-soft" />
                            <span>{c}</span>
                          </li>
                        ))}
                      </ul>
                    </article>
                  );
                })}
              </Carte>
            </Bloc>
          </div>
        </div>
      </div>
    </div>
  );
}
