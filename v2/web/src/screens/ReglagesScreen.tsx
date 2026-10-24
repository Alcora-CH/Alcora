import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, BookOpen, Check, ExternalLink, FileText, FolderOpen, Keyboard, Loader2, X } from 'lucide-react';
import { bridge } from '../lib/bridge';
import { Marque } from '../Marque';
import { changementsDe, plusRecente, VERSIONS } from '../versions';
import { CODES_LANGUE, definirLangue, LANGUES, t, useLangue, type CodeLangue } from '../i18n';
import { Bouton } from '../ui/Bouton';
import { Carte, EnTete, Rangee, Touche } from '../ui/Cadre';
import { CadreGuide } from '../cadre/CadreGuide';
import { Info } from '../ui/Info';
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

/*
 * L'état de la mise à jour, en PASTILLE — règle « Clarté avant texte » (24.10.2026). La
 * phrase qui expliquait la chaîne de mise à jour à chaque visite cède la place à son état :
 * à jour, en cours, prête, refusée. Le pourquoi d'un refus reste au survol du « i ».
 * Aucun état connu (rien n'a encore été vérifié) : rien plutôt qu'un « à jour » non prouvé.
 */
function PastilleVersion({ maj }: { maj: MajState | null }) {
  const base = 'm-surgit inline-flex h-[26px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-meta font-medium';
  const attente = `${base} bg-card2 text-muted`;
  if (!maj) return null;
  switch (maj.etat) {
    case 'aucune':
      return <span className={`${base} bg-ok-soft text-ok`}><Check size={14} aria-hidden />{t('reglages.etat.aJour')}</span>;
    case 'verification':
      return <span className={attente}><Loader2 size={14} className="animate-spin" aria-hidden />{t('reglages.etat.verification')}</span>;
    case 'controle':
      return <span className={attente}><Loader2 size={14} className="animate-spin" aria-hidden />{t('reglages.etat.controle', { version: maj.version ?? '' })}</span>;
    case 'application':
      return <span className={attente}><Loader2 size={14} className="animate-spin" aria-hidden />{t('reglages.etat.application')}</span>;
    case 'telechargement':
      return (
        <span className={attente}>
          <span className="font-mono">{maj.version}</span>
          <span className="barre-maj"><i style={{ transform: `scaleX(${(maj.pourcent ?? 0) / 100})` }} /></span>
          <span className="tabular-nums">{maj.pourcent ?? 0} %</span>
        </span>
      );
    case 'prete':
      return <span className={`${base} border border-accent-ligne bg-accent-soft text-accent`}>{t('reglages.etat.prete', { version: maj.version ?? '' })}</span>;
    case 'erreur':
      return maj.refusee ? (
        <>
          <span className={`${base} bg-bad-soft text-bad`}><X size={14} aria-hidden />{t('reglages.etat.refusee', { version: maj.refusee })}</span>
          <Info>{t('reglages.version.refuseeDetail')}</Info>
        </>
      ) : (
        <>
          <span className={`${base} bg-warn-soft text-warn`}>{t('reglages.etat.erreur')}</span>
          <Info>{t('reglages.version.erreurDetail')}</Info>
        </>
      );
    case 'manuelle':
      return <span className={attente}>{t('reglages.etat.manuelle')}</span>;
    default:
      return null;
  }
}

/** L'espacement se VOIT : une mosaïque de quatre tuiles, qui se resserre ou s'écarte. */
function ApercuMur({ espacement }: { espacement: number }) {
  const ecart = espacement / 4;   // 0 à 24 px dans l'application, 0 à 6 px dans l'aperçu
  const sx = (46 - ecart / 2) / 46;
  const sy = (26 - ecart / 2) / 26;
  return (
    <span aria-hidden className="apercu-mur">
      {[[0, 0], [1, 0], [0, 1], [1, 1]].map(([c, r]) => (
        <i key={`${c}${r}`} style={{
          left: c * 46, top: r * 26,
          transformOrigin: `${c ? 'right' : 'left'} ${r ? 'bottom' : 'top'}`,
          transform: `scale(${sx}, ${sy})`,
        }} />
      ))}
    </span>
  );
}

/** Le ciel animé se VOIT : il tourne et une étoile file — ou il reste immobile. */
const ETOILES = Array.from({ length: 16 }, (_, i) => ({ x: (i * 37) % 120, y: (i * 23) % 70, o: 0.3 + (i % 4) * 0.18 }));
function ApercuCiel({ anime }: { anime: boolean }) {
  return (
    <span aria-hidden className={cx('apercu-ciel', anime && 'anime')}>
      <span className="voute">
        {ETOILES.map((e, i) => <i key={i} style={{ left: e.x, top: e.y, opacity: e.o }} />)}
      </span>
      <span className="filante" />
    </span>
  );
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
  espacement, onEspacementChange, fondAnime, onFondAnimeChange, onReconfigurer, onRaccourcis,
  guideDemande, onGuideOuvert, notesDepuis, onNotesVues,
}: {
  espacement: number;
  onEspacementChange: (n: number) => void;
  fondAnime: boolean;
  onFondAnimeChange: (actif: boolean) => void;
  onReconfigurer: () => void;
  onRaccourcis: () => void;
  /** Un autre écran a demandé le guide (menu Caméras, Système) : il s'ouvre déplié. */
  guideDemande: boolean;
  /** La demande est servie : l'application l'oublie. */
  onGuideOuvert: () => void;
  /** Venu de l'avis de mise à jour : les versions plus récentes que celle-ci sont neuves. */
  notesDepuis: string | null;
  onNotesVues: () => void;
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
  /* Le guide se déplie DANS la carte Aide — plus de fenêtre par-dessus (24.10.2026). */
  const [guideOuvert, setGuideOuvert] = useState(guideDemande);
  /* Ce qui est neuf depuis la dernière version vue : gardé pour toute cette visite. */
  const [depuis] = useState(notesDepuis);
  useEffect(() => {
    if (!notesDepuis) return;
    onNotesVues();
    document.getElementById('reglages-historique')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    // Une seule fois, à l'arrivée.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!guideDemande) return;
    onGuideOuvert();
    document.getElementById('reglages-aide')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    // Une seule fois, à l'arrivée : la demande ne vaut que pour cette visite.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
      {/* Plus de sous-titre : il ne faisait que décrire ce que l'écran montre déjà. */}
      <EnTete titre={t('reglages.titre')} />

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
                    <span className="flex flex-wrap items-center gap-2.5">
                      <Marque taille={22} anime={fondAnime} />
                      <span className="font-mono text-titre text-accent-d">Alcora {actuelle ?? '…'}</span>
                      {/* La clé change avec l'état : chaque nouvel état arrive en fondu. */}
                      <span key={maj?.etat ?? 'inconnu'} className="flex items-center gap-1.5"><PastilleVersion maj={maj} /></span>
                    </span>
                  )}>
                  {/* Chaque état propose le geste qui lui va : redémarrer une version prête,
                      aller chercher la version à la main sans chaîne automatique (Linux),
                      vérifier sinon. */}
                  {maj?.etat === 'prete' ? (
                    <Bouton variante="primaire" onClick={() => { void bridge.majRedemarrer(); }}>{t('reglages.version.redemarrer')}</Bouton>
                  ) : maj?.etat === 'manuelle' ? (
                    <LienExterne href={SITE}>alcora.ch</LienExterne>
                  ) : (
                    <Bouton onClick={() => { void bridge.majVerifier(); }}
                            disabled={maj?.etat === 'verification' || maj?.etat === 'telechargement'
                              || maj?.etat === 'controle' || maj?.etat === 'application'}>
                      {t('reglages.version.verifier')}
                    </Bouton>
                  )}
                </Rangee>
              </Carte>
            </Bloc>

            {/* ---- langue ---- */}
            <Bloc id="langue" titre={t('reglages.langue.titre')}>
              <Carte>
                <div className="px-[18px] py-4">
                  {/* Les langues viennent du REGISTRE : en ajouter une n'exige rien ici.
                      Chaque nom s'ecrit dans sa propre langue — c'est ainsi qu'on retrouve
                      la sienne dans une interface qu'on ne comprend pas. « Automatique » dit
                      lui-même ce qu'il suit : la phrase qui l'expliquait n'a plus lieu d'être. */}
                  <Segment etiquette={t('reglages.langue.titre')} valeur={langueChoix}
                           onChange={(c) => { void changerLangue(c); }}
                           options={(['auto', ...CODES_LANGUE] as const).map((c) => ({
                             valeur: c,
                             libelle: c === 'auto'
                               ? <>{t('reglages.langue.auto')} <span className="text-micro text-soft">{t('reglages.langue.windows')}</span></>
                               : LANGUES[c].nom,
                           }))} />
                </div>
              </Carte>
            </Bloc>

            {/* ---- apparence ---- */}
            <Bloc id="apparence" titre={t('reglages.apparence.titre')}>
              <Carte>
                {/* Ce que font ces deux réglages se VOIT dans leur aperçu : plus besoin de
                    l'écrire (règle « Clarté avant texte », 24.10.2026). */}
                <div className="flex items-center gap-4 px-[18px] py-4">
                  <ApercuMur espacement={espacement} />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{t('reglages.apparence.espacement')}</div>
                    <input type="range" min={0} max={24} step={1} value={espacement}
                           onChange={(e) => onEspacementChange(Number(e.target.value))}
                           className="mt-1.5 w-full accent-[var(--accent)]"
                           aria-label={t('reglages.apparence.espacement')} />
                  </div>
                  <span className="w-14 text-right"><Valeur>{espacement === 0 ? t('reglages.apparence.aucun') : `${espacement} px`}</Valeur></span>
                </div>
                <div className="flex items-center gap-4 border-t border-line px-[18px] py-4">
                  <ApercuCiel anime={fondAnime} />
                  <div className="min-w-0 flex-1 font-medium">{t('reglages.apparence.fond')}</div>
                  <Interrupteur allume={fondAnime} onChange={onFondAnimeChange} etiquette={t('reglages.apparence.fond')} />
                </div>
              </Carte>
            </Bloc>

            {/* ---- démarrage ---- */}
            <Bloc id="demarrage" titre={t('reglages.demarrage.titre')}>
              <Carte>
                <Rangee titre={t('reglages.demarrage.ouvrir')}
                        explication={auto?.disponible === false ? t('reglages.demarrage.indisponible') : undefined}>
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
                        explication={<span className="block truncate font-mono text-soft" title={confort?.dossierCaptures}>{confort?.dossierCaptures ?? '…'}</span>}>
                  <Bouton icone={FolderOpen} onClick={() => { void bridge.choisirDossierCaptures().then(setConfort).catch(() => {}); }}>
                    {t('reglages.confort.changer')}
                  </Bouton>
                  <Bouton variante="fantome" onClick={() => { void bridge.ouvrirCaptures(); }}>{t('reglages.ouvrir')}</Bouton>
                </Rangee>
                <Rangee titre={t('reglages.confort.son')} explication={t('reglages.confort.sonSinon')}>
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
                  {infos?.appaire
                    ? <span className="text-ok" title={t('reglages.connexion.oui')}><Check size={16} aria-label={t('reglages.connexion.oui')} /></span>
                    : <span className="text-warn">{t('reglages.connexion.non')}</span>}
                </Rangee>
                <div className="border-t border-line px-[18px] py-4">
                  {!confirme ? (
                    <Bouton onClick={() => setConfirme(true)}>{t('reglages.connexion.modifier')}</Bouton>
                  ) : (
                    <>
                      <p className="flex gap-2.5 rounded-[9px] bg-bad-soft px-3 py-2.5 text-bad">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                        <span><b className="font-semibold">{t('reglages.connexion.avertissement')}</b> {t('reglages.connexion.avertissementSuite')}</span>
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
                <Rangee
                  titre={<span className="flex items-center gap-2"><FileText size={16} className="text-muted" aria-hidden />{t('reglages.probleme.journal')}</span>}
                  explication={<>{t('reglages.probleme.joindre')} · <span className="break-all font-mono text-soft">{infos?.journal ?? '…'}</span></>}>
                  <Bouton icone={FolderOpen} onClick={() => { void bridge.ouvrirJournal(); }}>{t('reglages.ouvrir')}</Bouton>
                </Rangee>
              </Carte>
            </Bloc>

            {/* ---- aide ---- */}
            <Bloc id="aide" titre={t('reglages.aide.titre')}>
              <Carte>
                <Rangee titre={<span className="flex items-center gap-2">{t('reglages.aide.raccourcis')} <Touche>?</Touche></span>}>
                  <Bouton icone={Keyboard} onClick={onRaccourcis}>{t('reglages.aide.voirRaccourcis')}</Bouton>
                </Rangee>
                <Rangee titre={t('reglages.aide.guide')} explication={t('reglages.aide.guideCourt')}>
                  <Bouton icone={BookOpen} aria-expanded={guideOuvert} onClick={() => setGuideOuvert((v) => !v)}>
                    {guideOuvert ? t('setup.guide.reduire') : t('reglages.aide.ouvrirGuide')}
                  </Bouton>
                </Rangee>
                {guideOuvert && (
                  <div className="m-surgit border-t border-line px-[18px] pb-4 pt-4"><CadreGuide hauteur={560} /></div>
                )}
              </Carte>
            </Bloc>

            {/* ---- à propos ---- */}
            <Bloc id="apropos" titre={t('reglages.apropos.titre')}>
              <Carte>
                <Rangee titre={<>Alcora <span className="font-mono text-soft">{actuelle ?? '…'}</span></>}
                        explication={t('reglages.apropos.ligne')}>
                  <LienExterne href={SITE}>alcora.ch</LienExterne>
                </Rangee>
                <Rangee titre={t('reglages.apropos.moteurRelais')}>
                  <Valeur>{infos ? `Electron ${infos.electron} · MediaMTX ${infos.relais}` : '…'}</Valeur>
                </Rangee>
                {/* La licence : le nom et l'auteur se lisent, l'obligation qui l'accompagne au survol. */}
                <Rangee titre={t('reglages.apropos.licenceTitre')}
                        explication={licencesAbsentes ? t('reglages.apropos.licencesAbsentes') : undefined}>
                  <Info>{t('reglages.apropos.licenceDetail')}</Info>
                  <LienExterne href={DEPOT}>{t('reglages.apropos.source')}</LienExterne>
                  <Bouton variante="fantome"
                          onClick={() => { void bridge.ouvrirLicences().then((ok) => setLicencesAbsentes(!ok)).catch(() => setLicencesAbsentes(true)); }}>
                    {t('reglages.apropos.voirLicences')}
                  </Bouton>
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
                        {depuis && plusRecente(v.version, depuis) && (
                          <span className="m-surgit rounded-md border border-accent-ligne px-2 py-0.5 text-micro font-semibold text-accent">
                            {t('nouveautes.nouveau')}
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
