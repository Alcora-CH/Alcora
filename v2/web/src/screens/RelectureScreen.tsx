import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle, ChevronLeft, ChevronRight, Pause, Play, Radio, SkipBack, SkipForward, ZoomOut,
} from 'lucide-react';
import { bridge } from '../lib/bridge';
import { CameraTile } from '../video/CameraTile';
import { CommandesVideo } from '../video/CommandesVideo';
import { imageDeLaVideo, useSonVideo } from '../video/outils';
import { useZoomVideo } from '../video/useZoomVideo';
import { localeDates, nombre, t, useLangue } from '../i18n';
import type { Cle } from '../i18n/fr';
import type { Archive, Detection, DiscoveredCamera } from '../types/protect';

/**
 * Relecture : parcourir une journee entiere, et pas seulement les detections.
 *
 * Tout ce dessin repose sur la mesure du 29.07.2026 (docs/contraintes-verifiees.md,
 * section V-Frise), et rien n'y est suppose :
 *
 *  · les cameras enregistrent en CONTINU (« always ») : la barre est pleine, et les
 *    detections ne sont que des reperes poses dessus ;
 *  · l'archive couvre 162 jours, bornee par `recordingStartLQ`. Suivre `recordingStart`
 *    l'aurait amputee de 133 jours de video qui existe et se lit ;
 *  · au-dela de `frontiere`, l'export rend 640 x 360 la ou il rendait 3840 x 2160 ;
 *  · le controleur refuse franchement (404) une periode vide.
 *
 * La video arrive par morceaux de dix secondes : une seconde de G6 en 4K pese 3,5 Mo, une
 * minute d'un coup ferait deux cents mega-octets. Ces morceaux sont lus par DEUX lecteurs
 * qui se relaient — voir plus bas pourquoi.
 */

const JOUR_MS = 86_400_000;
/**
 * Deux durees, et c'est un compromis assume.
 *
 * Le PREMIER morceau est court : c'est lui qui fait l'attente apres un clic, et sur la G6
 * en 4K dix secondes pesent deja 35 Mo. Les SUIVANTS sont longs : chaque changement de
 * fichier laisse une jointure visible — deux MP4 independants produits separement par le
 * controleur ne se recollent jamais parfaitement — et l'allongement est le seul levier qui
 * l'espace vraiment. Trente secondes, c'est trois fois moins de jointures, pour 105 Mo
 * telecharges pendant qu'on en lit trente : le controleur produit a dix-neuf mega-octets
 * par seconde, il a cinq fois le temps qu'il faut.
 */
const PAS_MS = 10_000;
const PAS_SUITE_MS = 30_000;
/** Un pas d'image, a trente images par seconde. */
const PAS_IMAGE = 1 / 30;
const VITESSES = [0.25, 0.5, 1, 2] as const;
/** Fenetre la plus serree de la frise : au-dela, viser devient un exercice d'orfevre. */
const ZOOM_MIN_MS = 60_000;

const jourLong = (d: Date) => new Intl.DateTimeFormat(
  localeDates(), { weekday: 'long', day: 'numeric', month: 'long' }).format(d);
const heureMin = (d: Date) => new Intl.DateTimeFormat(
  localeDates(), { hour: '2-digit', minute: '2-digit' }).format(d);

const minuit = (ms: number) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };

function hms(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
       + `:${String(d.getSeconds()).padStart(2, '0')}`;
}

function nomDuJour(ms: number): string {
  const ecart = Math.round((minuit(Date.now()) - minuit(ms)) / JOUR_MS);
  if (ecart === 0) return t('colonne.aujourdhui');
  if (ecart === 1) return t('relecture.hier');
  return jourLong(new Date(ms));
}

/** Jour d'un horodatage au format que réclame un champ « date ». */
function pourChampDate(ms: number): string {
  return new Date(ms - new Date(ms).getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function genre(d: Detection): 'person' | 'vehicle' | 'animal' | 'son' | 'motion' {
  if (d.sujets.includes('person') || d.sujets.includes('face')) return 'person';
  if (d.sujets.includes('vehicle') || d.sujets.includes('licensePlate')) return 'vehicle';
  if (d.sujets.includes('animal')) return 'animal';
  if (d.type === 'smartAudioDetect') return 'son';
  return 'motion';
}

const TEINTE: Record<string, string> = {
  person: 'var(--accent-d)', vehicle: '#7fa8c9', animal: 'var(--ok)',
  son: '#b98fc9', motion: '#5c626c',
};

const ETIQUETTE_CLE: Record<string, Cle> = {
  person: 'sujet.person', vehicle: 'sujet.vehicle', animal: 'sujet.animal',
  son: 'sujet.son', motion: 'sujet.motion',
};
const etiquette = (g: string) => t(ETIQUETTE_CLE[g] ?? 'sujet.motion');

const FILTRES = [
  { id: 'tout', cle: 'relecture.filtre.tout' }, { id: 'person', cle: 'relecture.filtre.personnes' },
  { id: 'vehicle', cle: 'relecture.filtre.vehicules' }, { id: 'animal', cle: 'relecture.filtre.animaux' },
  { id: 'son', cle: 'relecture.filtre.sons' },
] as const;

/** Graduations lisibles quelle que soit la fenetre : de la journee au quart d'heure. */
const PALIERS = [60_000, 300_000, 900_000, 1_800_000, 3_600_000, 10_800_000, 21_600_000];
function pasGraduation(duree: number): number {
  return PALIERS.find((p) => duree / p <= 14) ?? 21_600_000;
}
function etiquetteGraduation(ms: number, pas: number): string {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return pas >= 3_600_000 ? `${hh}h` : `${hh}:${mm}`;
}

type Morceau = { url: string; debut: number; fin: number };

export function RelectureScreen({ cameras, relayBase, cameraInitiale }: {
  cameras: DiscoveredCamera[];
  relayBase: string | null;
  /** Camera visee par un bouton du direct : on arrive sur elle. */
  cameraInitiale?: string | null;
}) {
  useLangue();
  const [cameraId, setCameraId] = useState<string>(() => cameraInitiale ?? cameras[0]?.id ?? '');
  const camera = cameras.find((c) => c.id === cameraId) ?? cameras[0];
  const archive: Archive | null = camera?.archive ?? null;

  const [jour, setJour] = useState<number>(() => minuit(Date.now()));
  /** Position de lecture, en temps ABSOLU. C'est la verite ; le reste s'en deduit. */
  const [instant, setInstant] = useState<number | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enLecture, setEnLecture] = useState(false);
  const [vitesse, setVitesse] = useState<number>(1);
  const [definition, setDefinition] = useState<string | null>(null);

  const [detections, setDetections] = useState<Detection[]>([]);
  const [filtre, setFiltre] = useState<string>('tout');

  /*
   * DEUX lecteurs qui se relaient.
   *
   * Un seul lecteur imposait, tous les dix secondes, de remplacer sa source : telechargement,
   * puis remise a zero du decodeur. Le retour d'usage l'a decrit exactement — « une coupure et reprise
   * toutes les 10 secondes ». Ici, pendant que l'un joue, l'autre a DEJA charge et decode le
   * morceau suivant ; le relais n'est plus qu'un echange d'element.
   */
  const lecteurs = [useRef<HTMLVideoElement>(null), useRef<HTMLVideoElement>(null)];
  /*
   * Le lecteur A L'ANTENNE, pour le zoom, le son et la capture.
   *
   * Deux lecteurs se relaient toutes les trente secondes ; les commandes doivent suivre
   * celui qu'on regarde, pas l'autre. Cette reference le designe et change avec lui, ce qui
   * suffit au crochet — il relit `current` a chaque image peinte.
   */
  const aLAntenne = useRef<HTMLVideoElement>(null);
  const [largeurVue, setLargeurVue] = useState(0);
  const [morceaux, setMorceaux] = useState<[Morceau | null, Morceau | null]>([null, null]);
  const [actif, setActif] = useState(0);
  /** Instant absolu a viser dans chaque case, ou null pour « depuis le debut ». */
  const cibles = useRef<[number | null, number | null]>([null, null]);
  const lectureVoulue = useRef(true);
  const morceauxRef = useRef(morceaux);
  morceauxRef.current = morceaux;
  /*
   * La reference suit le lecteur a l'antenne — dans un EFFET, jamais pendant le rendu.
   *
   * C'etait la moitie du defaut livre en 2.18.0 : recopiee pendant le rendu, la reference
   * lisait `lecteurs[actif].current` AVANT que React n'attache les references aux elements
   * qui venaient de monter. Elle valait donc null au moment precis ou le zoom demarrait.
   * Un effet sans dependances s'execute apres CHAQUE commit, les references une fois
   * posees : c'est le seul moment ou cette lecture est sure.
   */
  useEffect(() => {
    aLAntenne.current = lecteurs[actif].current;
  });

  const vue = useZoomVideo(aLAntenne, largeurVue, Boolean(morceaux[actif]));
  const son = useSonVideo(aLAntenne, Boolean(morceaux[actif]));

  /*
   * Capture de l'instant regarde.
   *
   * La definition est celle de l'EXPORT, pas celle de la camera : au-dela de vingt-neuf
   * jours d'archive le controleur ne rend plus que 640 x 360 (mesure V-Frise). Le nom du
   * fichier porte donc l'instant, seul repere qui vaille pour s'y retrouver ensuite.
   */
  const [capture, setCapture] = useState<string | null>(null);
  const capturerImage = useCallback(async () => {
    const image = await imageDeLaVideo(aLAntenne.current);
    if (!image) { setCapture(t('video.imageIndisponible')); return; }
    try {
      const quand = new Date(instant ?? Date.now());
      const nom = `${camera.name} ${quand.toLocaleString(localeDates()).replace(/[/:]/g, '-')}`;
      setCapture(t('video.imageEnregistree',
        { chemin: await bridge.capturer(nom, await image.arrayBuffer()) }));
    } catch (e) {
      setCapture(e instanceof Error ? e.message : String(e));
    }
  }, [camera.name, instant]);

  /* La confirmation s'efface d'elle-même : elle informe, elle n'encombre pas. */
  useEffect(() => {
    if (!capture) return;
    const id = setTimeout(() => setCapture(null), 6000);
    return () => clearTimeout(id);
  }, [capture]);
  /*
   * Numéro de la demande en cours.
   *
   * Deux clics rapprochés sur la frise lancent deux extractions. Sans ce compteur, la plus
   * LENTE gagne : elle écrase la case au moment où elle revient, et l'on se retrouve à
   * l'instant qu'on n'a pas demandé. C'est d'autant plus vicieux que les deux réussissent.
   */
  const demande = useRef(0);

  const courant = morceaux[actif];

  /* ---- bornes du jour affiche ---- */
  const premierJour = archive ? minuit(archive.debut) : null;
  const dernierJour = archive ? minuit(archive.fin) : minuit(Date.now());
  const peutReculer = premierJour !== null && jour > premierJour;
  const peutAvancer = jour < dernierJour;

  /* ---- detections du jour ---- */
  useEffect(() => {
    let vivant = true;
    setDetections([]);
    bridge.evenements({ avant: jour + JOUR_MS, jours: 1, limite: 400 })
      .then((liste) => {
        if (!vivant) return;
        setDetections(liste.filter((d) =>
          d.camera === cameraId && d.debut !== null && d.debut >= jour && d.debut < jour + JOUR_MS));
      })
      .catch(() => { /* le journal n'est pas la frise : son echec ne doit pas la vider */ });
    return () => { vivant = false; };
  }, [jour, cameraId]);

  const affichees = useMemo(
    () => detections.filter((d) => filtre === 'tout' || genre(d) === filtre),
    [detections, filtre],
  );

  /** Place un lecteur sur l'instant vise, une fois sa source reellement prete. */
  const poser = useCallback((i: number) => {
    const v = lecteurs[i].current;
    const m = morceauxRef.current[i];
    if (!v || !m) return;
    const t = cibles.current[i];
    v.currentTime = t === null ? 0 : Math.max(0, Math.min((m.fin - m.debut) / 1000, (t - m.debut) / 1000));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Charge un morceau dans une case, sans le jouer. `valide` annule une pose devenue caduque. */
  const charger = useCallback(async (
    i: number, cible: number, viser: number | null, valide?: () => boolean,
  ) => {
    if (!camera) return null;
    // `viser` non nul = un clic, donc la grille et un morceau court. Nul = un enchainement,
    // donc la suite exacte du precedent et un morceau long.
    const s = viser !== null
      ? await bridge.sequence({ camera: camera.id, instant: cible, duree: PAS_MS })
      : await bridge.sequence({ camera: camera.id, depuis: cible, duree: PAS_SUITE_MS });
    if (valide && !valide()) return null;
    cibles.current[i] = viser;
    setMorceaux((m) => {
      const n: [Morceau | null, Morceau | null] = [m[0], m[1]];
      n[i] = s;
      return n;
    });
    return s;
  }, [camera]);

  /* ---- viser un instant : c'est le geste principal ---- */
  const allerA = useCallback(async (cible: number, { lecture = true } = {}) => {
    if (!camera) return;
    const n = ++demande.current;
    lectureVoulue.current = lecture;
    setErreur(null);
    setChargement(true);
    setInstant(cible);
    try {
      const i = actif;
      const dejaLa = morceauxRef.current[i];
      const s = await charger(i, cible, cible, () => n === demande.current);
      if (!s) return;                            // un clic plus récent a pris la main
      // Meme morceau que celui deja en place : la source ne change pas, donc
      // « loadedmetadata » ne se declenchera pas — on se deplace ici.
      if (dejaLa?.url === s.url) {
        const v = lecteurs[i].current;
        if (v) { poser(i); if (lecture) void v.play().catch(() => {}); }
      }
      // La case d'a cote prend une longueur d'avance.
      void charger(1 - i, s.fin, null).catch(() => {});
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    } finally {
      setChargement(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, actif, charger, poser]);

  /** Fin d'un morceau : on passe la main a la case voisine, deja prete. */
  const relayer = useCallback(() => {
    const i = actif;
    const j = 1 - i;
    const ici = morceauxRef.current[i];
    const la = morceauxRef.current[j];
    if (!ici) return;

    if (la && la.debut === ici.fin) {
      setActif(j);
      const v = lecteurs[j].current;
      if (v) { v.currentTime = 0; v.playbackRate = vitesse; void v.play().catch(() => {}); }
      // La case qu'on vient de quitter va chercher la suite.
      void charger(i, la.fin, null).catch(() => {});
      setInstant(la.debut);
      return;
    }
    // Le voisin n'a pas suivi : on reprend le chemin ordinaire.
    if (ici.fin < Date.now()) void allerA(ici.fin, { lecture: true });
    else setEnLecture(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actif, vitesse, charger, allerA]);

  /* ---- changer de jour ou de camera repart de zero ---- */
  useEffect(() => {
    setMorceaux([null, null]);
    setActif(0);
    cibles.current = [null, null];
    setInstant(null);
    setDefinition(null);
    setErreur(null);
    setEnLecture(false);
  }, [jour, cameraId]);

  const basculer = useCallback(() => {
    const v = lecteurs[actif].current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => {}); else v.pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actif]);

  const pas = useCallback((sens: number) => {
    const v = lecteurs[actif].current;
    if (!v) return;
    v.pause();
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + sens * PAS_IMAGE));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actif]);

  const sauter = useCallback((secondes: number) => {
    if (instant === null) return;
    void allerA(instant + secondes * 1000, { lecture: enLecture });
  }, [instant, enLecture, allerA]);

  const revenirAuDirect = useCallback(() => {
    setMorceaux([null, null]);
    setActif(0);
    setInstant(null);
    setDefinition(null);
    setErreur(null);
    setEnLecture(false);
  }, []);

  /*
   * Le clavier de la relecture — les memes gestes que les boutons du transport.
   *
   * Rien quand un controle a le focus : espace actionne un bouton, les fleches deplacent
   * un curseur, et le champ de date a besoin de ses chiffres. Leur voler ces touches
   * rendrait l'ecran inutilisable au clavier — la raison meme de ces raccourcis.
   */
  useEffect(() => {
    const auClavier = (e: KeyboardEvent) => {
      const cible = e.target as HTMLElement | null;
      if (cible && /^(BUTTON|INPUT|SELECT|TEXTAREA)$/.test(cible.tagName)) return;

      if (e.key === ' ') { e.preventDefault(); basculer(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); sauter(-10); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); sauter(10); }
      else if (e.key === '+' || e.key === '=') { e.preventDefault(); vue.zoomer(1.25); }
      else if (e.key === '-') { e.preventDefault(); vue.zoomer(1 / 1.25); }
    };
    window.addEventListener('keydown', auClavier);
    return () => window.removeEventListener('keydown', auClavier);
  });

  const reduite = archive?.frontiere != null && instant !== null && instant < archive.frontiere;

  if (!camera) {
    return <div className="grid h-full place-items-center text-[13px] text-soft">{t('relecture.aucuneCamera')}</div>;
  }

  return (
    <div className="flex h-full flex-col gap-3 p-4">

      {/* ---- navigation par jour : posée sur le ciel, sans mur ---- */}
      <div className="flex items-center gap-2 px-1">
        <span className="text-[13px] text-muted">{camera.name}</span>
        {courant && (
          <button onClick={revenirAuDirect}
                  className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] transition-colors"
                  style={{ color: 'var(--ok)' }} title={t('relecture.revenirDirectTitre')}>
            <Radio className="h-3.5 w-3.5" /> {t('relecture.revenirDirect')}
          </button>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => setJour((j) => j - JOUR_MS)} disabled={!peutReculer}
                  aria-label={t('relecture.jourPrecedent')} title={t('relecture.jourPrecedent')}
                  className="grid h-7 w-7 place-items-center rounded-md text-soft transition-colors hover:text-ink disabled:opacity-25">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <input type="date" value={pourChampDate(jour)}
                 min={premierJour ? pourChampDate(premierJour) : undefined}
                 max={pourChampDate(dernierJour)}
                 onChange={(e) => { const v = e.target.valueAsNumber;
                   if (Number.isFinite(v)) setJour(minuit(v + new Date(v).getTimezoneOffset() * 60_000)); }}
                 aria-label={t('relecture.jourARelire')}
                 className="champ-ciel rounded-md border px-2 py-1 font-mono text-[12px] text-ink" />
          <span className="ml-1 min-w-[104px] text-[12.5px] text-soft">{nomDuJour(jour)}</span>
          <button onClick={() => setJour((j) => j + JOUR_MS)} disabled={!peutAvancer}
                  aria-label={t('relecture.jourSuivant')} title={t('relecture.jourSuivant')}
                  className="grid h-7 w-7 place-items-center rounded-md text-soft transition-colors hover:text-ink disabled:opacity-25">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ---- image et liste des caméras ---- */}
      <div className="flex min-h-0 flex-1 gap-3">
        <div className="flex min-w-0 flex-1 flex-col">
          {/* « select-none » n'est pas cosmetique : sans lui, un glisser cree une SELECTION
              invisible, et le glisser suivant par-dessus demarre un glisser-depose natif qui
              tue le panoramique par pointercancel. Mesure sur le poste le 02.08.2026. */}
          {/* L'image flotte comme une tuile du direct : même bord, même ombre. */}
          <div
            className="tuile-flottante relative min-h-0 flex-1 select-none overflow-hidden rounded-xl border bg-black"
            ref={(el) => { if (el) setLargeurVue(el.clientWidth); }}
            style={{ cursor: vue.agrandi ? 'grab' : 'default' }}
            {...vue.gestes}
          >

            {/* Tant que rien n'est visé, on montre le DIRECT. Un rectangle noir en attendant
                un clic laissait croire que l'écran ne fonctionnait pas. */}
            {/* Le relais peut ne pas être prêt : sans lui, pas de direct à montrer, et
                l'invitation à cliquer suffit. */}
            {!courant && !erreur && relayBase && (
              <div className="absolute inset-0">
                <CameraTile camera={camera} relayBase={relayBase} cadre={false} hauteurEtiquette={0} />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-3">
                  <span className="rounded-md px-3 py-1.5 text-[12.5px]"
                        style={{ background: 'rgba(10,12,15,.62)', color: 'var(--muted)' }}>
                    {t('relecture.inviteDirect')}
                  </span>
                </div>
              </div>
            )}

            {/* Les deux lecteurs sont empilés : celui qui n'est pas à l'antenne a déjà
                chargé et décodé la suite, il ne reste qu'à échanger. */}
            {[0, 1].map((i) => morceaux[i] && (
              <video
                key={i}
                ref={lecteurs[i]}
                src={morceaux[i]!.url}
                preload="auto"
                className="absolute inset-0 h-full w-full"
                style={{ objectFit: 'contain', opacity: actif === i ? 1 : 0,
                         pointerEvents: actif === i ? undefined : 'none' }}
                onLoadedMetadata={(e) => {
                  poser(i);
                  if (actif === i) {
                    setDefinition(`${e.currentTarget.videoWidth} × ${e.currentTarget.videoHeight}`);
                    e.currentTarget.playbackRate = vitesse;
                    if (lectureVoulue.current) void e.currentTarget.play().catch(() => {});
                  } else {
                    /* Amorçage du décodeur de la case EN ATTENTE.
                     *
                     * Charger les octets ne suffit pas : tant qu'on ne lui a rien demandé,
                     * l'élément n'a décodé aucune image, et le tout premier décodage d'un
                     * flux 4K se voit au moment de la bascule. Un aller-retour lecture/pause
                     * force la première image à être décodée et peinte, à l'avance. */
                    const v = e.currentTarget;
                    v.muted = true;
                    void v.play().then(() => { v.pause(); v.currentTime = 0; v.muted = false; })
                      .catch(() => { v.muted = false; });
                  }
                }}
                onPlay={() => { if (actif === i) setEnLecture(true); }}
                onPause={() => { if (actif === i) setEnLecture(false); }}
                onEnded={() => { if (actif === i) relayer(); }}
                onTimeUpdate={(e) => {
                  const m = morceaux[i];
                  if (actif === i && m) setInstant(m.debut + e.currentTarget.currentTime * 1000);
                }}
                onError={() => { if (actif === i) setErreur(t('video.sequenceIllisible')); }}
              />
            ))}

            {/* Le canevas recadre dans les pixels de la source, comme en direct. Il se pose
                par-dessus les DEUX lecteurs : il ne montre que celui à l'antenne. */}
            <canvas ref={vue.canvasRef}
                    className="absolute inset-0 h-full w-full object-contain"
                    style={{ display: vue.agrandi ? 'block' : 'none' }} />

            {morceaux[actif] && (
              <CommandesVideo
                zoom={vue.zoom}
                onReinitialiserZoom={vue.reinitialiser}
                aDuSon={son.aDuSon}
                sonActif={son.sonActif}
                onSon={son.basculer}
                onCapture={() => { void capturerImage(); }}
              />
            )}

            {vue.agrandi && (
              <div className="veil pointer-events-none absolute bottom-3 left-3 rounded-lg px-2.5 py-1">
                <span className="font-mono text-[11px]"
                      style={{ color: vue.interpole ? 'var(--bad)' : 'var(--on-1)' }}>
                  {nombre(vue.zoom, 2)}×{vue.interpole ? ` · ${t('video.interpole')}` : ''}
                </span>
              </div>
            )}

            {/* Au CENTRE, comme en direct : discrète dans un coin, elle laissait douter que
                quelque chose ait été enregistré. */}
            {capture && (
              <div className="m-surgit pointer-events-none absolute inset-x-0 bottom-14 z-20 flex justify-center">
                <span className="max-w-[86%] truncate rounded-lg px-3 py-1.5 text-[12.5px]"
                      style={{ background: 'rgba(14,17,22,.92)', color: '#eae5db',
                               border: '1px solid rgba(255,255,255,.16)' }}>
                  {capture}
                </span>
              </div>
            )}

            {instant !== null && (
              <span className="pointer-events-none absolute left-3 top-3 rounded-md px-2.5 py-1 font-mono text-[12px]"
                    style={{ background: 'rgba(10,12,15,.62)', color: '#c9c3b8' }}>
                {new Date(instant).toLocaleDateString(localeDates())}&nbsp;&nbsp;{hms(instant)}
              </span>
            )}

            {/* La définition est LUE dans le flux, pas déduite : c'est la seule mesure honnête. */}
            {definition && courant && (
              <span className="pointer-events-none absolute right-3 top-3 rounded-md px-2.5 py-1 text-[11px]"
                    style={{ background: 'rgba(10,12,15,.62)',
                             color: reduite ? 'var(--warn)' : 'var(--muted)' }}>
                {definition}{reduite ? ` · ${t('relecture.definitionReduite')}` : ''}
              </span>
            )}

            {!courant && !erreur && !relayBase && (
              <div className="absolute inset-0 grid place-items-center p-8 text-center">
                <p className="max-w-sm text-[13px] text-soft">
                  {t('relecture.inviteSansRelais')}
                </p>
              </div>
            )}

            {chargement && !courant && (
              <div className="absolute inset-0 grid place-items-center">
                <p className="rounded-md px-3 py-1.5 text-[13px]"
                   style={{ background: 'rgba(10,12,15,.62)', color: 'var(--muted)' }}>{t('relecture.extraction')}</p>
              </div>
            )}

            {erreur && (
              <div className="absolute inset-0 grid place-items-center bg-black/70 p-8">
                <div className="max-w-md text-center">
                  <AlertCircle className="mx-auto mb-2 h-5 w-5" style={{ color: 'var(--warn)' }} />
                  <p className="text-[13.5px]">{erreur}</p>
                  <button onClick={revenirAuDirect}
                          className="mt-3 rounded-md border border-line px-3 py-1.5 text-[12.5px] text-muted transition-colors hover:text-ink">
                    {t('relecture.revenirDirect')}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ---- transport : un bandeau de verre détaché ---- */}
          <div className="ilot mt-3 flex items-center gap-2 px-4 py-2">
            <button onClick={basculer} disabled={!courant} aria-label={enLecture ? t('video.pause') : t('video.lecture')}
                    className="grid h-8 w-8 place-items-center rounded-md disabled:opacity-30"
                    style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
              {enLecture ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </button>
            <button onClick={() => sauter(-10)} disabled={instant === null}
                    className="rounded-md px-2 py-1 font-mono text-[11.5px] text-soft transition-colors hover:text-ink disabled:opacity-30">
              −10 s
            </button>
            <button onClick={() => sauter(10)} disabled={instant === null}
                    className="rounded-md px-2 py-1 font-mono text-[11.5px] text-soft transition-colors hover:text-ink disabled:opacity-30">
              +10 s
            </button>
            <button onClick={() => pas(-1)} disabled={!courant} aria-label={t('video.imagePrecedente')}
                    className="grid h-7 w-7 place-items-center rounded-md text-soft transition-colors hover:text-ink disabled:opacity-30">
              <SkipBack className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => pas(1)} disabled={!courant} aria-label={t('video.imageSuivante')}
                    className="grid h-7 w-7 place-items-center rounded-md text-soft transition-colors hover:text-ink disabled:opacity-30">
              <SkipForward className="h-3.5 w-3.5" />
            </button>
            <div className="ml-auto flex items-center gap-1">
              {VITESSES.map((v) => (
                <button key={v} onClick={() => {
                  setVitesse(v);
                  for (const l of lecteurs) if (l.current) l.current.playbackRate = v;
                }}
                        aria-pressed={vitesse === v}
                        className="rounded px-2 py-1 font-mono text-[11.5px] transition-colors"
                        style={vitesse === v
                          ? { background: 'var(--accent-soft)', color: 'var(--accent)' }
                          : { color: 'var(--soft)' }}>
                  {v}×
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ---- caméras : en changer sans perdre l'instant ---- */}
        {cameras.length > 1 && (
          <div className="flex w-[160px] shrink-0 flex-col gap-2.5">
            {cameras.map((c) => (
              <button key={c.id} onClick={() => setCameraId(c.id)}
                      className="carte-flottante overflow-hidden rounded-lg text-left transition-colors"
                      style={c.id === cameraId ? { borderColor: 'var(--accent)' } : undefined}>
                <div className="aspect-video" style={{ background: 'rgba(255,255,255,.06)' }} />
                <div className="px-1.5 py-1 text-center text-[11px]"
                     style={{ color: c.id === cameraId ? 'var(--accent)' : 'var(--soft)' }}>
                  {c.name}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <Frise
        jour={jour}
        archive={archive}
        instant={instant}
        detections={affichees}
        onViser={(t) => { void allerA(t); }}
      />

      {/* ---- ce que la journée a vu : filtres et pellicule sur le ciel ---- */}
      <div className="px-1">
        <div className="mb-2 flex items-center gap-2">
          {FILTRES.map((f) => (
            <button key={f.id} onClick={() => setFiltre(f.id)} aria-pressed={filtre === f.id}
                    className="rounded-full px-2.5 py-0.5 text-[11.5px] transition-colors"
                    style={filtre === f.id
                      ? { background: 'var(--accent-soft)', color: 'var(--accent)' }
                      : { color: 'var(--soft)' }}>
              {t(f.cle)}
            </button>
          ))}
          <span className="ml-auto font-mono text-[11px] text-soft">
            {affichees.length} {affichees.length > 1 ? t('relecture.detectionPlusieurs') : t('relecture.detectionUne')}
          </span>
        </div>

        <div className="flex gap-2.5 overflow-x-auto pb-3 pt-1">
          {affichees.length === 0 && (
            <p className="py-3 text-[12.5px] text-soft">{t('relecture.rienDetecte')}</p>
          )}
          {affichees.map((d) => {
            const g = genre(d);
            const enCours = instant !== null && d.debut !== null
              && Math.abs(instant - d.debut) < PAS_MS;
            return (
              <button key={d.id} onClick={() => { if (d.debut !== null) void allerA(d.debut); }}
                      title={`${etiquette(g)} — ${d.debut ? hms(d.debut) : ''}`}
                      className="carte-flottante relative w-[112px] shrink-0 overflow-hidden rounded-lg"
                      style={enCours ? { borderColor: 'var(--accent)' } : undefined}>
                <div className="aspect-video">
                  {d.vignette && (
                    <img src={`/vignette/${d.id}`} alt="" loading="lazy"
                         className="h-full w-full object-cover"
                         onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
                  )}
                </div>
                <span className="absolute left-1 top-1 rounded px-1.5 py-0.5 font-mono text-[9.5px]"
                      style={{ background: 'rgba(10,12,15,.66)', color: '#bdb7ac' }}>
                  {d.debut ? heureMin(new Date(d.debut)) : '—'}
                </span>
                <span className="absolute bottom-1 left-1 rounded px-1.5 py-0.5 text-[9px]"
                      style={{ background: 'rgba(10,12,15,.66)', color: TEINTE[g] }}>
                  {etiquette(g)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * La barre du temps.
 *
 * Cliquable SUR TOUTE SA LARGEUR : les reperes ne sont pas des boutons a viser. Mais quand
 * le curseur en approche un, c'est LUI qui est vise — sinon, a l'echelle d'une journee, une
 * detection de quinze secondes occupe moins d'un pixel et resterait inatteignable.
 *
 * La molette resserre la fenetre autour du curseur, de la journee entiere a la minute.
 */
function Frise({ jour, archive, instant, detections, onViser }: {
  jour: number;
  archive: Archive | null;
  instant: number | null;
  detections: Detection[];
  onViser: (t: number) => void;
}) {
  useLangue();
  const barre = useRef<HTMLDivElement>(null);
  const [vue, setVue] = useState({ debut: jour, duree: JOUR_MS });
  const [survol, setSurvol] = useState<{ t: number; x: number; d: Detection | null } | null>(null);

  useEffect(() => { setVue({ debut: jour, duree: JOUR_MS }); }, [jour]);

  const fin = vue.debut + vue.duree;
  const enFraction = (t: number) => (t - vue.debut) / vue.duree;

  const instantSous = (clientX: number) => {
    const r = barre.current?.getBoundingClientRect();
    if (!r || r.width === 0) return null;
    const f = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    return { t: vue.debut + f * vue.duree, x: f * r.width, largeur: r.width };
  };

  /** Detection assez proche du curseur pour qu'on la vise a sa place. */
  const detectionSous = (t: number, largeur: number): Detection | null => {
    if (!largeur) return null;
    const tolerance = (vue.duree / largeur) * 7;      // sept pixels, quel que soit le zoom
    let proche: Detection | null = null;
    let ecart = Infinity;
    for (const d of detections) {
      if (d.debut === null) continue;
      const e = Math.abs(d.debut - t);
      if (e < tolerance && e < ecart) { ecart = e; proche = d; }
    }
    return proche;
  };

  const auSurvol = (e: React.MouseEvent) => {
    const p = instantSous(e.clientX);
    if (!p) return;
    setSurvol({ t: p.t, x: p.x, d: detectionSous(p.t, p.largeur) });
  };

  const auClic = (e: React.MouseEvent) => {
    const p = instantSous(e.clientX);
    if (!p) return;
    const d = detectionSous(p.t, p.largeur);
    onViser(d?.debut ?? p.t);
  };

  /** Molette : on resserre autour du curseur, pas autour du centre. */
  const auZoom = (e: React.WheelEvent) => {
    const p = instantSous(e.clientX);
    if (!p) return;
    const facteur = e.deltaY < 0 ? 0.72 : 1 / 0.72;
    const duree = Math.max(ZOOM_MIN_MS, Math.min(JOUR_MS, vue.duree * facteur));
    // L'instant sous le curseur reste sous le curseur : c'est ce qui rend le zoom lisible.
    const part = (p.t - vue.debut) / vue.duree;
    const debut = Math.max(jour, Math.min(jour + JOUR_MS - duree, p.t - part * duree));
    setVue({ debut, duree });
  };

  const pasG = pasGraduation(vue.duree);
  const graduations: number[] = [];
  for (let t = Math.ceil(vue.debut / pasG) * pasG; t <= fin; t += pasG) graduations.push(t);

  const finReelle = archive ? Math.min(archive.fin, jour + JOUR_MS) : jour + JOUR_MS;
  const zoome = vue.duree < JOUR_MS;

  return (
    /* La frise entière vit dans un îlot : toutes ses couches — graduations, zones
       enregistré/futur, repères, tête, survol — restent exactement ce qu'elles étaient. */
    <div className="ilot px-4 pb-1 pt-2.5">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="font-mono text-[10.5px] text-soft">
          {zoome ? `${hms(vue.debut)} → ${hms(fin)}` : t('relecture.journeeEntiere')}
        </span>
        {zoome && (
          <button onClick={() => setVue({ debut: jour, duree: JOUR_MS })}
                  className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10.5px] text-soft transition-colors hover:text-ink"
                  title={t('relecture.revoirJournee')}>
            <ZoomOut className="h-3 w-3" /> {t('relecture.toutVoir')}
          </button>
        )}
        <span className="ml-auto text-[10.5px] text-soft">{t('relecture.molette')}</span>
      </div>

      <div ref={barre}
           onMouseMove={auSurvol}
           onMouseLeave={() => setSurvol(null)}
           onClick={auClic}
           onWheel={auZoom}
           className="relative h-11 cursor-crosshair overflow-hidden rounded-md"
           style={{ background: 'var(--card2)' }}>

        {/* Enregistrement continu : plein jusqu'à l'instant présent. */}
        <div className="absolute inset-y-0"
             style={{ left: `${Math.max(0, enFraction(jour)) * 100}%`,
                      right: `${Math.max(0, 1 - enFraction(finReelle)) * 100}%`,
                      background: 'repeating-linear-gradient(90deg,' +
                        'rgba(210,162,99,.13) 0 2px, rgba(210,162,99,.09) 2px 4px)' }} />

        {/* Avant la frontière : seule la basse définition subsiste. */}
        {archive?.frontiere != null && archive.frontiere > vue.debut && (
          <div className="absolute inset-y-0 left-0"
               style={{ right: `${Math.max(0, 1 - enFraction(Math.min(archive.frontiere, fin))) * 100}%`,
                        background: 'repeating-linear-gradient(135deg, transparent 0 6px,' +
                          'rgba(208,162,21,.13) 6px 12px)' }} />
        )}

        {/* Après l'instant présent : rien n'est encore enregistré. */}
        {finReelle < fin && (
          <div className="absolute inset-y-0" style={{ left: `${enFraction(finReelle) * 100}%`, right: 0,
            background: 'repeating-linear-gradient(135deg, transparent 0 5px,' +
              'rgba(255,255,255,.045) 5px 10px)' }} />
        )}

        {graduations.map((t) => (
          <div key={t} className="pointer-events-none absolute inset-y-0 w-px"
               style={{ left: `${enFraction(t) * 100}%`, background: 'rgba(255,255,255,.12)' }} />
        ))}
        {graduations.map((t, i) => (graduations.length <= 10 || i % 2 === 0) && (
          <span key={`e${t}`} className="pointer-events-none absolute bottom-0.5 font-mono text-[9.5px]"
                style={{ left: `${enFraction(t) * 100}%`, transform: 'translateX(-50%)', color: 'var(--soft)' }}>
            {etiquetteGraduation(t, pasG)}
          </span>
        ))}

        {detections.map((d) => d.debut === null || d.debut < vue.debut || d.debut > fin ? null : (
          <div key={d.id} className="pointer-events-none absolute rounded-sm"
               style={{ left: `${enFraction(d.debut) * 100}%`,
                        top: genre(d) === 'motion' ? 12 : 5,
                        height: genre(d) === 'motion' ? 8 : 15,
                        width: survol?.d?.id === d.id ? 5 : 3,
                        marginLeft: survol?.d?.id === d.id ? -1 : 0,
                        background: TEINTE[genre(d)],
                        boxShadow: survol?.d?.id === d.id ? `0 0 8px ${TEINTE[genre(d)]}` : undefined }} />
        ))}

        {instant !== null && instant >= vue.debut && instant <= fin && (
          <div className="pointer-events-none absolute -inset-y-0.5 w-0.5"
               style={{ left: `${enFraction(instant) * 100}%`, background: 'var(--accent)',
                        boxShadow: '0 0 9px rgba(210,162,99,.75)' }} />
        )}

        {/* Ce que l'on va viser, dit avant le clic. */}
        {survol && (
          <div className="pointer-events-none absolute -top-0.5 bottom-0 w-px"
               style={{ left: survol.x, background: 'rgba(255,255,255,.35)' }} />
        )}
      </div>

      <div className="mt-1 flex h-4 items-center justify-center gap-2 text-[11px]">
        {survol ? (
          <>
            <span className="font-mono text-soft">{hms(survol.t)}</span>
            {survol.d && (
              <span style={{ color: TEINTE[genre(survol.d)] }}>
                {etiquette(genre(survol.d))}
                {survol.d.sujets.length > 0 && survol.d.score !== null ? ` · ${survol.d.score} %` : ''}
                <span className="text-soft"> — {t('relecture.cliquerPourVoir')}</span>
              </span>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
