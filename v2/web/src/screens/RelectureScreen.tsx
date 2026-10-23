import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle, CalendarDays, Camera, ChevronLeft, ChevronRight, Pause, Play, Radio, SkipBack, SkipForward,
  Volume2, VolumeX, ZoomOut,
} from 'lucide-react';
import { bridge } from '../lib/bridge';
import { CameraTile } from '../video/CameraTile';
import { BoutonBandeau } from '../video/BoutonBandeau';
import { imageDeLaVideo, useSonVideo } from '../video/outils';
import { useZoomVideo } from '../video/useZoomVideo';
import { localeDates, nombre, t, useLangue } from '../i18n';
import { Bouton } from '../ui/Bouton';
import { Carte, EnTete } from '../ui/Cadre';
import { Puce } from '../ui/Puce';
import { Segment } from '../ui/Segment';
import { cx } from '../ui/cx';
import type { Cle } from '../i18n/fr';
import type { Archive, Detection, DiscoveredCamera, RelaisAcces } from '../types/protect';

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

/* L'année se dit dès qu'elle n'est plus la nôtre : l'archive remonte assez loin pour qu'un
   « jeudi 31 décembre » soit ambigu en janvier. */
const jourLong = (d: Date) => new Intl.DateTimeFormat(localeDates(), {
  weekday: 'long', day: 'numeric', month: 'long',
  ...(d.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' as const } : {}),
}).format(d);
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

/* Les teintes des genres, celles de la palette « Observatoire » : l'or pour les personnes. */
const TEINTE: Record<string, string> = {
  person: 'var(--accent)', vehicle: 'var(--info)', animal: 'var(--ok)',
  son: '#b997d6', motion: '#6b7480',
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

export function RelectureScreen({ cameras, relais, cameraInitiale, instantInitial }: {
  cameras: DiscoveredCamera[];
  relais: RelaisAcces | null;
  /** Camera visee par un bouton du direct : on arrive sur elle. */
  cameraInitiale?: string | null;
  /**
   * L'instant vise par « Revoir a cet instant » (une detection de l'Activite, une sequence).
   * Un objet et non un nombre : viser deux fois le meme instant doit se rejouer.
   */
  instantInitial?: { t: number } | null;
}) {
  useLangue();
  /* Une caméra visée mais inconnue (retirée du contrôleur) : on part de la première, sans
     garder un identifiant qu'aucune puce ne montrerait. */
  const [cameraId, setCameraId] = useState<string>(() => (cameraInitiale && cameras.some((c) => c.id === cameraInitiale)
    ? cameraInitiale : cameras[0]?.id ?? ''));
  const camera = cameras.find((c) => c.id === cameraId) ?? cameras[0];
  const archive: Archive | null = camera?.archive ?? null;

  const [jour, setJour] = useState<number>(() => minuit(instantInitial?.t ?? Date.now()));
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
  /** Le champ de date, invisible : le bouton du jour ouvre son calendrier. */
  const champDate = useRef<HTMLInputElement>(null);
  /** Instant d'ouverture : les miniatures des caméras ne se rechargent pas à chaque rendu. */
  const [montage] = useState(() => Date.now());
  /**
   * Les puces des caméras : la molette les fait défiler de côté quand elles débordent. Sans
   * cela, une souris ne pouvait atteindre une quatrième caméra hors de vue (revue du
   * 23.10.2026) — Chromium ne change pas la molette verticale en défilement horizontal.
   */
  const puces = useRef<HTMLDivElement>(null);
  const aUneCamera = Boolean(camera);
  useEffect(() => {
    const el = puces.current;
    if (!el) return;
    const roue = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener('wheel', roue, { passive: false });
    return () => el.removeEventListener('wheel', roue);
  }, [aUneCamera]);

  /*
   * Viser un instant APRES une remise a zero (autre camera, autre jour).
   *
   * La remise a zero repasse la case active a 0 ; viser dans le meme passage chargerait le
   * morceau dans l'ancienne case, qui ne serait plus a l'antenne : un ecran vide. L'instant
   * attend donc dans `enAttente`, la remise a zero le confie a `aViser`, et la visee se fait
   * au rendu suivant, case 0 en place.
   */
  const enAttente = useRef<{ t: number; lecture: boolean } | null>(null);
  const [aViser, setAViser] = useState<{ t: number; lecture: boolean } | null>(null);
  /**
   * Génération des chargements : chaque remise à zéro la change, et un morceau demandé avant
   * est jeté à son retour. Sans elle, le préchargement de l'ANCIENNE caméra, plus lent,
   * pouvait se poser dans la case d'attente — et la relève jouait trente secondes de
   * l'ancienne caméra sous le nom de la nouvelle (revue du 23.10.2026).
   */
  const generation = useRef(0);

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
    const g = generation.current;
    // `viser` non nul = un clic, donc la grille et un morceau court. Nul = un enchainement,
    // donc la suite exacte du precedent et un morceau long.
    const s = viser !== null
      ? await bridge.sequence({ camera: camera.id, instant: cible, duree: PAS_MS })
      : await bridge.sequence({ camera: camera.id, depuis: cible, duree: PAS_SUITE_MS });
    if (g !== generation.current) return null;      // une remise a zero est passee entre-temps
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
    generation.current += 1;
    setMorceaux([null, null]);
    setActif(0);
    cibles.current = [null, null];
    setInstant(null);
    setDefinition(null);
    setErreur(null);
    setEnLecture(false);
    if (enAttente.current !== null) { setAViser(enAttente.current); enAttente.current = null; }
  }, [jour, cameraId]);

  useEffect(() => {
    if (!aViser) return;
    setAViser(null);
    void allerA(aViser.t, { lecture: aViser.lecture });
  }, [aViser, allerA]);

  /* « Revoir a cet instant » : la bonne camera, le bon jour, puis l'instant. */
  useEffect(() => {
    if (!instantInitial) return;
    // Une caméra inconnue — retirée du contrôleur, ou que la détection ne nomme pas : on ne
    // vise rien. Montrer à cette heure les images d'une AUTRE caméra serait pire que rien.
    if (!cameraInitiale || !cameras.some((c) => c.id === cameraInitiale)) return;
    const cam = cameraInitiale;
    const j = minuit(instantInitial.t);
    if (cam !== cameraId || j !== jour) {
      enAttente.current = { t: instantInitial.t, lecture: true };
      setCameraId(cam);
      setJour(j);
    } else setAViser({ t: instantInitial.t, lecture: true });
    // Seule la demande compte : la camera et le jour courants ne doivent pas la rejouer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instantInitial]);

  /** Changer de camera GARDE l'instant regarde, et la pause : c'est ce qu'on veut comparer. */
  const changerCamera = (id: string) => {
    if (id === cameraId) return;
    enAttente.current = instant !== null ? { t: instant, lecture: enLecture } : null;
    setCameraId(id);
  };

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
    generation.current += 1;
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
    return <div className="grid h-full place-items-center text-soft">{t('relecture.aucuneCamera')}</div>;
  }

  /* « Aujourd'hui » ou « Hier » à côté de la date ; au-delà, la date se suffit. */
  const ecartJours = Math.round((minuit(Date.now()) - jour) / JOUR_MS);

  return (
    <div className="flex h-full flex-col">
      {/* ---- l'en-tête : les caméras, le retour au direct, le jour ---- */}
      <EnTete
        titre={t('espace.relecture')}
        actions={(
          <>
            {courant && (
              <Bouton variante="vert" icone={Radio} titre={t('relecture.revenirDirectTitre')} onClick={revenirAuDirect}>
                <span className="max-[1100px]:hidden">{t('relecture.revenirDirect')}</span>
              </Bouton>
            )}
            <div className="flex items-center gap-1">
              <Bouton variante="fantome" icone={ChevronLeft} titre={t('relecture.jourPrecedent')}
                      disabled={!peutReculer} onClick={() => setJour((j) => j - JOUR_MS)} />
              {/* Le jour se choisit au calendrier du système : le champ reste là, invisible,
                  et le bouton l'ouvre. Il garde ses bornes (premier et dernier jour enregistrés). */}
              <div className="relative">
                {/* Nommé par la date qu'on lit ; « Jour à relire » en infobulle. */}
                <Bouton icone={CalendarDays} titre={t('relecture.jourARelire')}
                        onClick={() => {
                          const c = champDate.current;
                          if (!c) return;
                          try { c.showPicker(); } catch { c.focus(); }
                        }}>
                  <span className="first-letter:uppercase">{jourLong(new Date(jour))}</span>
                  {ecartJours <= 1 && <span className="text-soft max-[1000px]:hidden">{nomDuJour(jour)}</span>}
                </Bouton>
                <input ref={champDate} type="date" value={pourChampDate(jour)} tabIndex={-1} aria-hidden
                       min={premierJour ? pourChampDate(premierJour) : undefined}
                       max={pourChampDate(dernierJour)}
                       onChange={(e) => { const v = e.target.valueAsNumber;
                         if (Number.isFinite(v)) setJour(minuit(v + new Date(v).getTimezoneOffset() * 60_000)); }}
                       className="pointer-events-none absolute bottom-0 left-0 h-px w-px opacity-0" />
              </div>
              <Bouton variante="fantome" icone={ChevronRight} titre={t('relecture.jourSuivant')}
                      disabled={!peutAvancer} onClick={() => setJour((j) => j + JOUR_MS)} />
            </div>
          </>
        )}
      >
        {/* Changer de caméra GARDE l'instant : c'est ce qu'on vient comparer. */}
        {/* Sur une fenêtre étroite, les miniatures cèdent la place aux noms. */}
        <div ref={puces} role="group" aria-label={t('systeme.cameras')}
             className="flex min-w-0 gap-1.5 overflow-x-auto [scrollbar-width:thin]">
          {cameras.map((c) => (
            <button key={c.id} type="button" onClick={() => changerCamera(c.id)}
                    aria-pressed={c.id === cameraId}
                    className={cx('m-pression inline-flex h-9 shrink-0 items-center gap-2 rounded-[9px] border pl-1 pr-3 transition-colors max-[1180px]:pl-3',
                      c.id === cameraId ? 'border-accent-ligne bg-accent-soft text-accent'
                        : 'border-line2 bg-card2 text-ink hover:bg-card3')}>
              <span className="h-[26px] w-11 shrink-0 overflow-hidden rounded-[5px] bg-black max-[1180px]:hidden">
                <img src={`/instantane/${c.id}?t=${montage}`} alt="" loading="lazy" className="h-full w-full object-cover"
                     onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
              </span>
              {c.name}
            </button>
          ))}
        </div>
      </EnTete>

      {/* Une fenêtre basse ne doit pas écraser l'image : passé sa hauteur minimale, c'est la
          page qui défile, la console et la pellicule restent entières. */}
      <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-5 pb-4 pt-[18px]">

        {/* ---- le lecteur : un bandeau hors de l'image, comme au direct ---- */}
        <Carte className="@container flex min-h-[260px] flex-1 flex-col overflow-hidden">
          <div className="flex h-11 shrink-0 items-center gap-2.5 pl-3.5 pr-2">
            {instant !== null ? (
              <span className="whitespace-nowrap font-mono text-titre tabular-nums">
                {new Date(instant).toLocaleDateString(localeDates())}&nbsp;&nbsp;{hms(instant)}
              </span>
            ) : relais ? (
              /* « Direct » seulement s'il y a un direct : sans relais, l'image est noire. */
              <span className="inline-flex items-center gap-1.5 text-meta text-ok">
                <span aria-hidden className="h-[7px] w-[7px] rounded-full bg-current" />{t('espace.direct')}
              </span>
            ) : null}
            {/* La définition est LUE dans le flux, pas déduite : c'est la seule mesure honnête. */}
            {definition && courant && (
              <span className="whitespace-nowrap text-meta tabular-nums text-muted">
                {definition}
                {reduite && <span className="text-warn"> · {t('relecture.definitionReduite')}</span>}
              </span>
            )}
            {courant && (
              <div className="ml-auto flex shrink-0 items-center gap-1">
                {vue.agrandi && (
                  <BoutonBandeau titre={t('video.revenirImage', { zoom: nombre(vue.zoom, 2) })}
                                 court={t('video.imageEntiere')} icone={ZoomOut} actif
                                 onClick={vue.reinitialiser} />
                )}
                <BoutonBandeau
                  titre={son.aDuSon === false ? t('video.pasDeSon')
                    : son.sonActif ? t('video.couperSon') : t('video.activerSon')}
                  court={t('tuile.sonCourt')} icone={son.sonActif ? Volume2 : VolumeX}
                  desactive={son.aDuSon === false} actif={son.sonActif} onClick={son.basculer} />
                <BoutonBandeau titre={t('video.capturer')} court={t('tuile.imageCourt')} icone={Camera}
                               onClick={() => { void capturerImage(); }} />
              </div>
            )}
          </div>

          {/* « select-none » n'est pas cosmetique : sans lui, un glisser cree une SELECTION
              invisible, et le glisser suivant par-dessus demarre un glisser-depose natif qui
              tue le panoramique par pointercancel. Mesure sur le poste le 02.08.2026. */}
          <div
            className="relative min-h-0 flex-1 select-none overflow-hidden bg-black"
            ref={(el) => { if (el) setLargeurVue(el.clientWidth); }}
            style={{ cursor: vue.agrandi ? 'grab' : 'default' }}
            {...vue.gestes}
          >

            {/* Tant que rien n'est visé, on montre le DIRECT. Un rectangle noir en attendant
                un clic laissait croire que l'écran ne fonctionnait pas. */}
            {/* Le relais peut ne pas être prêt : sans lui, pas de direct à montrer, et
                l'invitation à cliquer suffit. */}
            {!courant && !erreur && relais && (
              <div className="absolute inset-0">
                <CameraTile camera={camera} relais={relais} cadre={false} hauteurEtiquette={0} />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-3">
                  <span className="rounded-lg px-3 py-1.5" style={{ background: 'rgba(12,15,20,.78)', color: 'var(--on-2)' }}>
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

            {vue.agrandi && (
              <div className="veil pointer-events-none absolute bottom-2.5 left-2.5 flex h-6 items-center gap-1.5 rounded-md px-2.5 text-meta tabular-nums"
                   style={{ color: 'var(--on-1)' }}>
                {nombre(vue.zoom, 2)}×
                {vue.interpole && <span className="text-bad">{t('video.interpole')}</span>}
              </div>
            )}

            {/* Au CENTRE, comme en direct : discrète dans un coin, elle laissait douter que
                quelque chose ait été enregistré. */}
            {capture && (
              <div className="m-surgit pointer-events-none absolute inset-x-0 bottom-12 z-20 flex justify-center">
                <span className="max-w-[86%] truncate rounded-[9px] border border-line2 px-3.5 py-2"
                      style={{ background: 'rgba(12,15,20,.92)', color: '#f2efe8' }}>
                  {capture}
                </span>
              </div>
            )}

            {!courant && !erreur && !relais && (
              <div className="absolute inset-0 grid place-items-center p-8 text-center">
                <p className="max-w-sm text-soft">{t('relecture.inviteSansRelais')}</p>
              </div>
            )}

            {chargement && !courant && (
              <div className="absolute inset-0 grid place-items-center">
                <p className="rounded-lg px-3 py-1.5" style={{ background: 'rgba(12,15,20,.78)', color: 'var(--on-2)' }}>
                  {t('relecture.extraction')}
                </p>
              </div>
            )}

            {erreur && (
              <div className="absolute inset-0 grid place-items-center bg-black/70 p-8">
                <div className="max-w-md text-center">
                  <AlertCircle className="mx-auto mb-2 h-5 w-5 text-warn" />
                  <p>{erreur}</p>
                  <Bouton className="mt-3" onClick={revenirAuDirect}>{t('relecture.revenirDirect')}</Bouton>
                </div>
              </div>
            )}
          </div>
        </Carte>

        {/* ---- la console : le transport, l'heure lue, la frise ---- */}
        <Carte className="shrink-0 px-4 pb-2.5 pt-3">
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={basculer} disabled={!courant}
                    aria-label={enLecture ? t('video.pause') : t('video.lecture')}
                    title={enLecture ? t('video.pause') : t('video.lecture')}
                    className="m-pression grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-accent text-sur-accent transition hover:brightness-110 disabled:opacity-35">
              {enLecture ? <Pause className="h-[18px] w-[18px] fill-current" aria-hidden />
                : <Play className="h-[18px] w-[18px] fill-current" aria-hidden />}
            </button>
            {/* L'heure regardée, en grand : la frise la montre, mais il fallait la viser. */}
            <span className="ml-2.5 mr-3.5 font-mono text-titre tabular-nums text-ink">
              {instant !== null ? hms(instant) : '––:––:––'}
            </span>
            <Bouton variante="fantome" taille="petit" className="tabular-nums" disabled={instant === null}
                    onClick={() => sauter(-10)}>−10 s</Bouton>
            <Bouton variante="fantome" taille="petit" className="tabular-nums" disabled={instant === null}
                    onClick={() => sauter(10)}>+10 s</Bouton>
            <Bouton variante="fantome" taille="petit" icone={SkipBack} titre={t('video.imagePrecedente')}
                    disabled={!courant} onClick={() => pas(-1)} />
            <Bouton variante="fantome" taille="petit" icone={SkipForward} titre={t('video.imageSuivante')}
                    disabled={!courant} onClick={() => pas(1)} />
            <Segment
              className="ml-auto" etiquette={t('relecture.vitesse')} valeur={vitesse}
              options={VITESSES.map((v) => ({ valeur: v, libelle: `${nombre(v, v === 0.25 ? 2 : v === 0.5 ? 1 : 0)}×` }))}
              onChange={(v) => {
                setVitesse(v);
                for (const l of lecteurs) if (l.current) l.current.playbackRate = v;
              }}
            />
          </div>

          <Frise
            jour={jour}
            archive={archive}
            instant={instant}
            detections={affichees}
            onViser={(t) => { void allerA(t); }}
          />
        </Carte>

        {/* ---- ce que la journée a vu : filtres et pellicule ---- */}
        <div className="shrink-0">
          <div className="mb-2.5 flex items-center gap-1.5">
            {FILTRES.map((f) => (
              <Puce key={f.id} allumee={filtre === f.id} onClick={() => setFiltre(f.id)}>{t(f.cle)}</Puce>
            ))}
            <span className="ml-auto text-meta tabular-nums text-muted">
              {affichees.length} {affichees.length > 1 ? t('relecture.detectionPlusieurs') : t('relecture.detectionUne')}
            </span>
          </div>

          <div className="flex gap-2.5 overflow-x-auto pb-1">
            {affichees.length === 0 && (
              <p className="py-3 text-soft">{t('relecture.rienDetecte')}</p>
            )}
            {affichees.map((d) => {
              const g = genre(d);
              const enCours = instant !== null && d.debut !== null
                && Math.abs(instant - d.debut) < PAS_MS;
              return (
                <button key={d.id} type="button" onClick={() => { if (d.debut !== null) void allerA(d.debut); }}
                        title={`${etiquette(g)} — ${d.debut ? hms(d.debut) : ''}`}
                        aria-current={enCours ? 'true' : undefined}
                        className={cx('m-pression w-[132px] shrink-0 overflow-hidden rounded-[9px] border bg-card text-left transition-colors',
                          enCours ? 'border-accent' : 'border-line2 hover:border-line2 hover:bg-card2')}>
                  <div className="aspect-video bg-black">
                    {d.vignette && (
                      <img src={`/vignette/${d.id}`} alt="" loading="lazy"
                           className="h-full w-full object-cover"
                           onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
                    )}
                  </div>
                  <div className="flex items-baseline justify-between gap-1.5 px-2 py-1.5 text-meta">
                    <span className="tabular-nums text-muted">{d.debut ? heureMin(new Date(d.debut)) : '—'}</span>
                    <span className="truncate" style={{ color: TEINTE[g] }}>{etiquette(g)}</span>
                  </div>
                </button>
              );
            })}
          </div>
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

  /* La molette sur la frise zoome, et ne fait RIEN d'autre : la page peut défiler dans une
     fenêtre basse, et la frise filerait sous le curseur au milieu du geste. L'écouteur de
     React est passif ; celui-ci ne l'est pas. */
  useEffect(() => {
    const el = barre.current;
    if (!el) return;
    const bloquer = (e: WheelEvent) => e.preventDefault();
    el.addEventListener('wheel', bloquer, { passive: false });
    return () => el.removeEventListener('wheel', bloquer);
  }, []);

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
    /* La frise vit dans la console, sous le transport : toutes ses couches — graduations,
       zones enregistré/futur, repères, tête, survol — restent exactement ce qu'elles étaient. */
    <div>
      <div className="mb-1.5 mt-3 flex items-center gap-2.5 text-meta text-muted">
        <span className={zoome ? 'font-mono tabular-nums' : undefined}>
          {zoome ? `${hms(vue.debut)} → ${hms(fin)}` : t('relecture.journeeEntiere')}
        </span>
        {zoome && (
          <Bouton variante="fantome" taille="petit" icone={ZoomOut} titre={t('relecture.revoirJournee')}
                  onClick={() => setVue({ debut: jour, duree: JOUR_MS })}>
            {t('relecture.toutVoir')}
          </Bouton>
        )}
        <span className="ml-auto text-soft">{t('relecture.molette')}</span>
      </div>

      <div ref={barre}
           onMouseMove={auSurvol}
           onMouseLeave={() => setSurvol(null)}
           onClick={auClic}
           onWheel={auZoom}
           className="relative h-[52px] cursor-crosshair overflow-hidden rounded-lg bg-card2">

        {/* Enregistrement continu : plein jusqu'à l'instant présent. */}
        <div className="absolute inset-y-0"
             style={{ left: `${Math.max(0, enFraction(jour)) * 100}%`,
                      right: `${Math.max(0, 1 - enFraction(finReelle)) * 100}%`,
                      background: 'repeating-linear-gradient(90deg,' +
                        'rgba(220,169,92,.13) 0 2px, rgba(220,169,92,.09) 2px 4px)' }} />

        {/* Avant la frontière : seule la basse définition subsiste. */}
        {archive?.frontiere != null && archive.frontiere > vue.debut && (
          <div className="absolute inset-y-0 left-0"
               style={{ right: `${Math.max(0, 1 - enFraction(Math.min(archive.frontiere, fin))) * 100}%`,
                        background: 'repeating-linear-gradient(135deg, transparent 0 6px,' +
                          'rgba(224,162,60,.13) 6px 12px)' }} />
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
          <span key={`e${t}`} className="pointer-events-none absolute bottom-[3px] text-micro tabular-nums text-soft"
                style={{ left: `${enFraction(t) * 100}%`, transform: 'translateX(-50%)' }}>
            {etiquetteGraduation(t, pasG)}
          </span>
        ))}

        {detections.map((d) => d.debut === null || d.debut < vue.debut || d.debut > fin ? null : (
          <div key={d.id} className="pointer-events-none absolute rounded-sm"
               style={{ left: `${enFraction(d.debut) * 100}%`,
                        top: genre(d) === 'motion' ? 18 : 8,
                        height: genre(d) === 'motion' ? 10 : 20,
                        width: survol?.d?.id === d.id ? 5 : 3,
                        marginLeft: survol?.d?.id === d.id ? -1 : 0,
                        background: TEINTE[genre(d)],
                        boxShadow: survol?.d?.id === d.id ? `0 0 8px ${TEINTE[genre(d)]}` : undefined }} />
        ))}

        {instant !== null && instant >= vue.debut && instant <= fin && (
          <div className="pointer-events-none absolute -inset-y-0.5 w-0.5"
               style={{ left: `${enFraction(instant) * 100}%`, background: 'var(--accent)',
                        boxShadow: '0 0 10px rgba(220,169,92,.8)' }} />
        )}

        {/* Ce que l'on va viser, dit avant le clic. */}
        {survol && (
          <div className="pointer-events-none absolute -top-0.5 bottom-0 w-px"
               style={{ left: survol.x, background: 'rgba(255,255,255,.4)' }} />
        )}
      </div>

      <div className="mt-1 flex h-5 items-center justify-center gap-2 text-meta">
        {survol ? (
          <>
            <span className="font-mono tabular-nums text-muted">{hms(survol.t)}</span>
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
