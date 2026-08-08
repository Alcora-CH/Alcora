import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell, Clapperboard, Eye, EyeOff, Maximize2, Minimize2, PanelLeftClose, PanelLeftOpen, RotateCw,
  Search, Settings, Video,
} from 'lucide-react';
import { CameraTile } from './video/CameraTile';
import { SetupScreen } from './screens/SetupScreen';
import { ReglagesScreen } from './screens/ReglagesScreen';
import { RechercheScreen } from './screens/RechercheScreen';
import { RelectureScreen } from './screens/RelectureScreen';
import { LecteurExtrait } from './screens/LecteurExtrait';
import { NouveautesScreen } from './screens/NouveautesScreen';
import { CielScreen } from './screens/CielScreen';
import { ColonneEtat } from './screens/ColonneEtat';
import { VeillesScreen } from './screens/VeillesScreen';
import { Marque } from './Marque';
import { Planetarium } from './Planetarium';
import { bestChannel } from './video/channel';
import { meilleureGrille } from './video/grille';
import { bridge, pontDisponible } from './lib/bridge';
import { definirLangue, t, useLangue } from './i18n';
import { nomSujet } from './i18n/sujets';
import type {
  Detection, DetectionVive, DiscoveredCamera, MajState, Nouveautes, Progression, RelayState,
} from './types/protect';

const ESPACES = [
  { id: 'direct', cle: 'espace.direct', Icon: Video },
  { id: 'detections', cle: 'espace.detections', Icon: Search },
  { id: 'relecture', cle: 'espace.relecture', Icon: Clapperboard },
  { id: 'alertes', cle: 'espace.alertes', Icon: Bell },
] as const;

/** Le repli du panneau survit au redemarrage : le replier chaque fois userait. */
const CLE_PANNEAU = 'protectviewer.panneau';
/** Le fond anime (Planetarium) : un choix d'apparence, actif par defaut. */
const CLE_FOND = 'protectviewer.fond';
/**
 * Hauteur du bandeau pose AU-DESSUS de chaque vue, hors de l'image.
 *
 * Passe de 26 a 34 px le 29.07.2026 : il porte desormais les quatre commandes de la
 * camera, sorties de l'image ou elles se fondaient dans la scene. Le cout en hauteur
 * d'image est negligeable ; le gain est qu'il n'y a plus rien a decouvrir.
 */
const H_ETIQUETTE = 34;
/** Espace entre les vues, en pixels. Zero est un choix legitime : images bord a bord. */
const CLE_ESPACE = 'protectviewer.espace';
/** Ordre des cameras choisi a la souris. Liste d'identifiants, jamais elaguee : une
 *  camera momentanement hors ligne retrouve sa place a son retour. */
const CLE_ORDRE = 'protectviewer.ordre';
/** Cameras masquees de la mosaique. On cache une IMAGE, pas une camera : les veilles et
 *  les detections continuent, et la relecture reste accessible. */
const CLE_MASQUEES = 'protectviewer.masquees';

/**
 * Duree au-dela de laquelle un halo d'activite s'eteint de lui-meme.
 *
 * La trame de FIN peut ne jamais arriver — liaison coupee, controleur redemarre, evenement
 * clos pendant une reprise. Deux minutes couvrent tres largement une detection reelle (les
 * plus longues observees sur le poste de reference tiennent en quelques dizaines de secondes) sans laisser
 * un cadre allume indefiniment.
 */
const ACTIVITE_MAX_MS = 120_000;

/** Ce que le halo annonce. Protect dit qu'il se passe quelque chose ; nous disons QUOI.
 *  Appele au RENDU, pas a la detection : l'etiquette change de langue avec le reste. */
function libelleSujets(sujets: string[], type: string): string {
  const nommes = sujets.map(nomSujet).filter(Boolean);
  if (nommes.length) return nommes.join(', ');
  return type === 'smartAudioDetect' ? t('sujet.sonDetecte') : t('sujet.motion');
}

/** Largeurs de la bande d'icones et du panneau — celles des classes w-14 et w-[292px]. */
const L_RAIL = 56;
const L_PANNEAU = 292;

/**
 * Ecran de dernier recours.
 *
 * Il ne s'affiche que si la liaison avec le processus principal manque — cas ou plus rien
 * d'autre ne peut fonctionner. Mieux vaut cet ecran, qui dit ou regarder, qu'une interface
 * d'apparence normale alimentee par des donnees inventees.
 */
function PontManquant() {
  /* Sans pont, la langue choisie est hors d'atteinte : cet ecran reste dans la langue
     par defaut. C'est un ecran de panne — dire ou regarder passe avant tout. */
  const t = useLangue();
  return (
    <div className="grid h-full place-items-center p-8">
      <div className="max-w-md text-center">
        <p className="mb-2 text-[15px] font-semibold">{t('app.pontTitre')}</p>
        <p className="text-[13px] text-muted">
          {t('app.pontDetail1')} <span className="font-mono text-[12px]">journal.txt</span>,
          {' '}{t('app.pontDetail2')} <span className="font-mono text-[12px]">%APPDATA%\Alcora</span>.
        </p>
      </div>
    </div>
  );
}

/**
 * Mesure d'un element, sans amortissement.
 *
 * La grille doit suivre le geste : c'est la decision de QUALITE, prise dans la tuile, qui
 * attend la stabilisation. Amortir aussi la disposition donnerait une mosaique en retard
 * sur la fenetre.
 */
function useTaille<T extends HTMLElement>() {
  const [taille, setTaille] = useState({ w: 0, h: 0 });
  const observateur = useRef<ResizeObserver | null>(null);

  /*
   * Reference-fonction, et non un effet au montage.
   *
   * L'element mesure n'apparait qu'une fois la configuration faite et les flux prets : un
   * effet pose au montage de l'application ne trouverait rien a observer, et n'y
   * reviendrait jamais. La mosaique restait alors vide, sans la moindre erreur.
   * Une reference-fonction est rappelee a chaque apparition et disparition de l'element.
   */
  const ref = useCallback((el: T | null) => {
    observateur.current?.disconnect();
    observateur.current = null;
    if (!el) return;

    const lire = () => setTaille({ w: el.clientWidth, h: el.clientHeight });
    lire();
    observateur.current = new ResizeObserver(lire);
    observateur.current.observe(el);
  }, []);

  return { ref, taille };
}

export default function App() {
  const t = useLangue();
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [cameras, setCameras] = useState<DiscoveredCamera[]>([]);
  const [relayBase, setRelayBase] = useState<string | null>(null);
  const [relay, setRelay] = useState<RelayState>({ running: false, message: 'Démarrage…' });
  const [espace, setEspace] = useState('direct');
  const [panneauOuvert, setPanneauOuvert] = useState(
    () => localStorage.getItem(CLE_PANNEAU) !== 'reduit',
  );
  const [pleinEcran, setPleinEcran] = useState(false);
  /** Caméra isolée : une seule image, sur toute la zone. */
  const [isolee, setIsolee] = useState<string | null>(null);
  /** Caméras masquées de la mosaïque. Persiste : un choix d'affichage se garde. */
  const [masquees, setMasquees] = useState<string[]>(() => {
    try {
      const v = JSON.parse(localStorage.getItem(CLE_MASQUEES) ?? '[]');
      return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
    } catch { return []; }
  });

  const basculerMasquee = useCallback((id: string) => {
    setMasquees((v) => {
      const suite = v.includes(id) ? v.filter((x) => x !== id) : [...v, id];
      localStorage.setItem(CLE_MASQUEES, JSON.stringify(suite));
      return suite;
    });
    // Masquer la caméra isolée ramènerait un écran vide : on rend d'abord la mosaïque.
    setIsolee((v) => (v === id ? null : v));
  }, []);
  const [indice, setIndice] = useState(false);
  const [espacement, setEspacement] = useState(() => {
    const brut = localStorage.getItem(CLE_ESPACE);
    const n = Number(brut);
    // Zero par defaut : les images se touchent, un seul mur.
    return brut !== null && Number.isFinite(n) ? Math.min(24, Math.max(0, n)) : 0;
  });
  /* Le Planetarium, actif par defaut : le verre a besoin d'un ciel a refracter. */
  const [fondAnime, setFondAnime] = useState(
    () => localStorage.getItem(CLE_FOND) !== 'fige',
  );
  useEffect(() => {
    localStorage.setItem(CLE_FOND, fondAnime ? 'anime' : 'fige');
  }, [fondAnime]);
  const [maj, setMaj] = useState<MajState | null>(null);
  const [progression, setProgression] = useState<Progression>({ etape: 'demarrage' });
  /** L'introduction ne se joue qu'une fois par session : jamais au retour des reglages. */
  const [introFinie, setIntroFinie] = useState(false);
  const [ordre, setOrdre] = useState<string[]>(() => {
    try {
      const v = JSON.parse(localStorage.getItem(CLE_ORDRE) ?? '[]');
      return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
    } catch { return []; }
  });
  /** Identifiant de la camera en cours de deplacement, pour le retour visuel. */
  const [glisse, setGlisse] = useState<string | null>(null);
  /** Panneau revele au survol du bord. Etat passager : jamais conserve. */
  const [survole, setSurvole] = useState(false);
  /**
   * Le repere du rail, qui SUIT l'espace choisi au lieu de sauter.
   *
   * C'est ce detail qui relie deux ecrans : sans lui, le basculement reste une
   * coupure, si douce soit la page qui arrive. On mesure le bouton vise et l'on
   * ne deplace que la transformee du trait — animer « top » recalculerait la
   * mise en page a chaque image.
   */
  const boutonsRail = useRef(new Map<string, HTMLButtonElement>());
  const [repere, setRepere] = useState<number | null>(null);
  /** Version installee, pour la colonne d'etat. Tiree une fois : elle ne change pas. */
  const [infosVersion, setInfosVersion] = useState<string | null>(null);
  /**
   * Camera visee par une navigation venue d'une tuile.
   *
   * Les boutons du direct emmenent vers la relecture ou les detections DE CETTE camera :
   * y arriver sur une autre serait un contresens.
   */
  const [cameraCible, setCameraCible] = useState<string | null>(null);
  /** Une seule camera parle a la fois : deux flux ensemble donnent une bouillie. */
  const [sonSur, setSonSur] = useState<string | null>(null);
  /**
   * Sequence ouverte par-dessus tout le reste.
   *
   * Tenue ICI, et non dans un ecran, parce que ses deux origines n'ont pas d'ecran commun :
   * une bulle de Windows cliquee alors que l'application est sur le direct, et une detection
   * recente de la colonne d'etat, qui est visible depuis n'importe quel espace.
   */
  const [sequence, setSequence] = useState<Detection | null>(null);
  /** Détections en cours, par identifiant de caméra. Alimente le halo des tuiles. */
  const [activite, setActivite] = useState<Record<string, { sujets: string[]; type: string }>>({});
  /** Nouveautés d'une mise à jour, à présenter une fois l'intro passée. */
  const [nouveautes, setNouveautes] = useState<Nouveautes | null>(null);

  useEffect(() => {
    bridge.nouveautes().then(setNouveautes).catch(() => {});
    // La langue AVANT tout affichage durable : le processus principal la resout —
    // choix de l'utilisateur, ou celle de Windows — et l'ecran s'y accorde.
    bridge.langue().then((l) => definirLangue(l.effective)).catch(() => {});
  }, []);
  const [confort, setConfort] = useState<{ dossierCaptures: string; sonParDefaut: boolean } | null>(null);

  useEffect(() => {
    if (!pontDisponible) return;
    bridge.confort().then(setConfort).catch(() => {});
  }, []);

  /**
   * Une detection vive devient une sequence lisible.
   *
   * Une detection qui COURT n'a pas encore de fin : le lecteur la borne alors lui-meme.
   */
  const ouvrirDetection = useCallback((d: DetectionVive) => {
    if (!d.id || d.debut === null) return;
    setSequence({
      id: d.id, type: d.type, camera: d.camera ?? '', cameraNom: d.cameraNom,
      debut: d.debut, fin: d.fin, sujets: d.sujets, score: d.score, vignette: Boolean(d.fin),
    });
  }, []);

  /* Clic sur une bulle Windows. Vivait dans le Journal ; le Journal n'existe plus. */
  useEffect(() => {
    if (!pontDisponible) return;
    return bridge.onOuvrirDetection(ouvrirDetection);
  }, [ouvrirDetection]);

  /*
   * Les détections EN COURS, par caméra — ce qui allume le halo des tuiles.
   *
   * Tenu ici parce que la liaison temps réel est unique et que plusieurs écrans s'en
   * servent. La tuile, elle, ne fait qu'afficher ce qu'on lui donne.
   *
   * Le garde-fou des deux minutes n'est pas un ornement : la trame de FIN peut ne jamais
   * arriver — liaison coupée, contrôleur redémarré, événement clos pendant une reprise. Un
   * halo allumé toute la nuit sur une caméra où il ne se passe rien serait pire que pas de
   * halo du tout : il apprendrait à ne plus le croire.
   */
  useEffect(() => {
    if (!pontDisponible) return;
    const minuteurs = new Map<string, ReturnType<typeof setTimeout>>();

    const eteindre = (camera: string) => {
      clearTimeout(minuteurs.get(camera));
      minuteurs.delete(camera);
      setActivite((v) => {
        if (!v[camera]) return v;
        const suite = { ...v };
        delete suite[camera];
        return suite;
      });
    };

    const off = bridge.onDetectionVive((d) => {
      if (!d.camera) return;
      if (!d.commence) { eteindre(d.camera); return; }

      setActivite((v) => ({ ...v, [d.camera as string]: { sujets: d.sujets, type: d.type } }));
      clearTimeout(minuteurs.get(d.camera));
      minuteurs.set(d.camera, setTimeout(() => eteindre(d.camera as string), ACTIVITE_MAX_MS));
    });

    return () => { off(); minuteurs.forEach(clearTimeout); };
  }, []);

  /** Les quatre commandes du bandeau de chaque camera. */
  const actionsTuile = useMemo(() => ({
    onRelecture: (id: string) => { setCameraCible(id); setEspace('relecture'); },
    onDetections: (id: string) => { setCameraCible(id); setEspace('detections'); },
    onCapture: (nom: string, octets: ArrayBuffer) => bridge.capturer(nom, octets),
    onSon: (id: string) => setSonSur(id),
    sonSur,
    sonParDefaut: confort?.sonParDefaut ?? false,
  }), [sonSur, confort]);

  /*
   * ATTENTION — tout crochet doit rester AU-DESSUS des sorties anticipees de ce composant
   * (pont manquant, configuration non lue, ecran de connexion). Places en-dessous, ils ne
   * s'executent pas a tous les rendus : React compte alors dix-sept crochets au premier
   * passage puis vingt-deux au suivant, refuse de continuer, et l'application n'affiche
   * plus RIEN. C'est arrive en 2.10.0. « npm test » lance desormais oxlint, dont la regle
   * « react/rules-of-hooks » designe exactement ce defaut.
   */

  /*
   * Revelation du bord, avec un delai a la fermeture.
   *
   * La bande d'icones et le panneau sont deux elements voisins : passer de l'une a l'autre
   * declenche une « sortie » suivie d'une « entree », et sans ce delai le panneau
   * clignotait dans l'intervalle.
   */
  const fermeture = useRef<number | null>(null);
  const revelerBord = useCallback(() => {
    if (fermeture.current) clearTimeout(fermeture.current);
    setSurvole(true);
  }, []);
  const masquerBord = useCallback(() => {
    if (fermeture.current) clearTimeout(fermeture.current);
    fermeture.current = window.setTimeout(() => setSurvole(false), 180);
  }, []);

  /*
   * Commandes du plein ecran : elles reviennent au moindre mouvement, puis s'effacent.
   *
   * Sans elles, « Echap » etait la SEULE sortie et rien ne le disait passe les premieres
   * secondes. Une image plein ecran sans aucune commande visible ressemble a une
   * application bloquee, pas a un choix.
   */
  const [commandes, setCommandes] = useState(false);
  useEffect(() => {
    if (!pleinEcran) { setCommandes(false); return; }
    let minuteur: number | undefined;
    const bouge = () => {
      setCommandes(true);
      clearTimeout(minuteur);
      minuteur = window.setTimeout(() => setCommandes(false), 2600);
    };
    bouge();
    window.addEventListener('pointermove', bouge);
    return () => { window.removeEventListener('pointermove', bouge); clearTimeout(minuteur); };
  }, [pleinEcran]);

  const { ref: zoneRef, taille } = useTaille<HTMLDivElement>();
  const grilleRef = useRef<HTMLDivElement>(null);
  const ordonneesRef = useRef<DiscoveredCamera[]>([]);
  const geometrieRef = useRef<{ colonnes: number; rangees: number; largeur: number; hauteur: number } | null>(null);
  /** Instant de fin du dernier glissement : un double-clic juste apres ne doit pas isoler. */
  const finGlisse = useRef(0);

  useEffect(() => {
    localStorage.setItem(CLE_PANNEAU, panneauOuvert ? 'ouvert' : 'reduit');
  }, [panneauOuvert]);

  /*
   * Le repere se replace quand l'espace change — et SEULEMENT alors.
   *
   * Les references sont attachees avant que les effets ne s'executent : au premier
   * rendu la mesure est deja possible. La disposition du rail, elle, ne bouge
   * jamais (le plein ecran le fait glisser par transformation, ce qui ne change
   * aucun « offsetTop »), donc rien d'autre ne peut invalider la mesure.
   *
   * Surtout : PAS d'effet sans liste de dependances ici. Un effet qui pose un etat
   * a chaque rendu est le defaut qui a produit un ecran noir en 2.10.0, et la regle
   * « react-hooks/exhaustive-deps » le refuse maintenant — a juste titre.
   */
  useEffect(() => {
    const cible = boutonsRail.current.get(espace);
    setRepere(cible ? cible.offsetTop : null);
    // « configured » compte autant que l'espace : au tout premier rendu le rail
    // n'existe pas encore — l'ecran de connexion occupe seul la fenetre — et sans
    // cette dependance le repere resterait absent pour toute la session.
  }, [espace, configured]);

  // L'effet verre est desormais l'apparence de l'application, non plus une option.
  useEffect(() => {
    document.documentElement.classList.add('theme-verre');
  }, []);

  useEffect(() => {
    if (!pontDisponible) return;
    bridge.infos().then((i) => setInfosVersion(i.version)).catch(() => {});
  }, []);

  useEffect(() => {
    localStorage.setItem(CLE_ESPACE, String(espacement));
  }, [espacement]);

  useEffect(() => {
    localStorage.setItem(CLE_ORDRE, JSON.stringify(ordre));
  }, [ordre]);

  /*
   * Les deux etats sont TIRES au montage, puis suivis.
   *
   * S'abonner ne suffit pas : entre le chargement de la page et cet abonnement, tout
   * message est perdu. Le relais pouvait diffuser pendant que le panneau affichait encore
   * « Démarrage… », sans jamais se corriger.
   */
  useEffect(() => {
    if (!pontDisponible) return;
    bridge.etats().then(({ relais, maj: m, progression: p, fenetre }) => {
      setRelay(relais); setMaj(m); if (p) setProgression(p);
      // La fenetre peut rouvrir en plein ecran (etat memorise) : sans cette lecture, le
      // premier F11 croirait partir de la fenetre normale et ne ferait rien de visible.
      if (fenetre?.pleinEcran) setPleinEcran(true);
    }).catch(() => {});
    const offMaj = bridge.onMajState(setMaj);
    const offProg = bridge.onProgression(setProgression);
    return () => { offMaj(); offProg(); };
  }, []);

  useEffect(() => {
    if (!pontDisponible) return;
    bridge.isConfigured().then(setConfigured).catch(() => setConfigured(false));
  }, []);

  const basculerPleinEcran = () => {
    void bridge.pleinEcran(!pleinEcran).then(setPleinEcran).catch(() => {});
  };

  /*
   * Raccourcis. « Échap » doit toujours ramener en arriere d'un cran — c'est le reflexe
   * universel, et le seul dont on soit sur qu'il sera tente quand plus rien n'est visible.
   *
   * Les CHIFFRES isolent une camera par sa place dans la mosaique : « 1 » la premiere,
   * le meme chiffre a nouveau — ou « 0 » — ramene la mosaique. Ils suivent l'ordre
   * AFFICHE, celui que l'utilisateur a choisi a la souris, pas l'ordre de l'inventaire.
   * Uniquement dans le direct : ailleurs, les chiffres appartiennent aux champs de saisie.
   */
  useEffect(() => {
    const auClavier = (e: KeyboardEvent) => {
      if (e.key === 'F11') { e.preventDefault(); basculerPleinEcran(); }
      else if (e.key === 'Escape') {
        if (isolee) setIsolee(null);
        else if (pleinEcran) basculerPleinEcran();
      } else if (espace === 'direct' && /^[0-9]$/.test(e.key)
                 && !(e.target instanceof HTMLInputElement)
                 && !(e.target instanceof HTMLTextAreaElement)) {
        if (e.key === '0') { setIsolee(null); return; }
        const cible = ordonneesRef.current[Number(e.key) - 1];
        if (cible) setIsolee((v) => (v === cible.id ? null : cible.id));
      }
    };
    window.addEventListener('keydown', auClavier);
    return () => window.removeEventListener('keydown', auClavier);
  });

  /** Le rappel s'efface seul : en plein ecran, rien ne doit rester en travers de l'image. */
  useEffect(() => {
    if (!pleinEcran && !isolee) return;
    setIndice(true);
    const t = setTimeout(() => setIndice(false), 2600);
    return () => clearTimeout(t);
  }, [pleinEcran, isolee]);

  // L'inventaire et le relais sont prets a des instants differents : on suit les deux.
  useEffect(() => {
    if (!configured) return;

    let alive = true;
    const charger = async () => {
      const [cams, base] = await Promise.all([bridge.getCameras(), bridge.relayBase()]);
      if (!alive) return;
      console.log(`[inventaire] ${cams.length} caméra(s), relais ${base ?? 'indisponible'}`);
      setCameras(cams);
      setRelayBase(base);
    };

    // Un rejet ici laissait l'ecran fige sans un mot : on le rend visible et reessayable.
    const chargerSurement = () => charger().catch((e: unknown) => {
      if (!alive) return;
      console.error(`[inventaire] échec : ${e instanceof Error ? e.message : String(e)}`);
      setRelay({ running: false, message: "L'inventaire des caméras n'a pas pu être lu." });
    });

    void chargerSurement();
    const unsubscribe = bridge.onRelayState((s) => {
      setRelay(s);
      if (s.running) void chargerSurement();   // le relais vient de (re)publier : rafraichir
    });

    return () => { alive = false; unsubscribe(); };
  }, [configured]);

  if (!pontDisponible) return <PontManquant />;

  const pret = relayBase !== null && cameras.length > 0;

  /*
   * L'introduction : la constellation, par-dessus tout le reste.
   *
   * Elle couvre la sequence d'ouverture entiere — y compris une mise a jour au lancement,
   * qu'elle relate dans son texte. La mosaique vit DESSOUS pendant ce temps : les flux se
   * connectent sous le voile, et la fin de l'introduction decouvre des images deja en
   * mouvement. Elle s'efface d'elle-meme des qu'un echec demande l'attention : l'etat et
   * son remede ne se lisent pas a travers un ciel etoile.
   */
  const echecOuverture = !relay.running && Boolean(relay.permanent || relay.remedy);
  const intro = !introFinie && !echecOuverture && (configured !== false || maj?.demarrage) ? (
    <CielScreen maj={maj} relay={relay} progression={progression} pret={pret}
                onFini={() => setIntroFinie(true)} />
  ) : null;

  if (configured === null || (!configured && maj?.demarrage)) {
    return <div className="relative h-full">{intro}</div>;
  }
  // La premiere configuration a son propre recit d'etapes : pas d'introduction par-dessus.
  // Le ciel l'accompagne des le premier ecran : c'est la premiere image qu'on ait
  // d'Alcora, elle doit deja etre la sienne. Meme scene isolee qu'ailleurs — sans
  // « isolate », le Planetarium en z:-1 passerait sous le fond et disparaitrait.
  if (!configured) {
    return (
      <div className="app-scene isolate relative h-full">
        {fondAnime && <Planetarium />}
        <SetupScreen onDone={() => { setConfigured(true); setIntroFinie(true); }} />
      </div>
    );
  }

  // L'ordre choisi a la souris s'applique d'abord ; les cameras inconnues de la liste
  // (nouvelles, ou jamais deplacees) suivent, dans leur ordre d'inventaire. Les masquees
  // sortent de la mosaique — et d'elle seulement : le panneau les liste toujours.
  const rang = new Map(ordre.map((id, i) => [id, i]));
  const ordonnees = cameras.filter((c) => !masquees.includes(c.id)).sort(
    (a, b) => (rang.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rang.get(b.id) ?? Number.MAX_SAFE_INTEGER),
  );
  ordonneesRef.current = ordonnees;

  // Une caméra isolée occupe seule toute la zone ; sinon, la mosaïque complète.
  const affichees = isolee ? ordonnees.filter((c) => c.id === isolee) : ordonnees;
  const grille = meilleureGrille(taille.w, taille.h, affichees.length, 16 / 9, espacement, H_ETIQUETTE);
  geometrieRef.current = grille;

  /*
   * Reorganisation a la souris.
   *
   * Le geste demarre sur la tuile mais ne devient un deplacement qu'au-dela de quelques
   * pixels : un clic ou un double-clic n'y ressemblent jamais. Pendant le deplacement, on
   * REORDONNE LA LISTE — jamais le nœud video lui-meme, dont le demontage arreterait la
   * boucle de recadrage. La grille se recompose d'elle-meme, et l'aimantation a la case
   * survolee donne le retour visuel.
   */
  const commencerGeste = (e: React.PointerEvent, id: string) => {
    if (e.button !== 0 || isolee || affichees.length < 2) return;
    const depart = { x: e.clientX, y: e.clientY };
    let actif = false;

    const caseSous = (cx: number, cy: number) => {
      const el = grilleRef.current;
      const g = geometrieRef.current;
      if (!el || !g) return null;
      const r = el.getBoundingClientRect();
      const totalW = g.colonnes * g.largeur + espacement * (g.colonnes - 1);
      const totalH = g.rangees * g.hauteur + espacement * (g.rangees - 1);
      const x = cx - r.left - (r.width - totalW) / 2;
      const y = cy - r.top - (r.height - totalH) / 2;
      const col = Math.min(g.colonnes - 1, Math.max(0, Math.floor(x / (g.largeur + espacement))));
      const ligne = Math.min(g.rangees - 1, Math.max(0, Math.floor(y / (g.hauteur + espacement))));
      return Math.min(ordonneesRef.current.length - 1, ligne * g.colonnes + col);
    };

    const bouge = (ev: PointerEvent) => {
      if (!actif) {
        if (Math.hypot(ev.clientX - depart.x, ev.clientY - depart.y) < 8) return;
        actif = true;
        setGlisse(id);
      }
      const idx = caseSous(ev.clientX, ev.clientY);
      if (idx === null) return;
      const ids = ordonneesRef.current.map((c) => c.id);
      if (ids[idx] === id) return;
      const sans = ids.filter((x) => x !== id);
      sans.splice(idx, 0, id);
      setOrdre(sans);
    };

    const fin = () => {
      window.removeEventListener('pointermove', bouge);
      window.removeEventListener('pointerup', fin);
      if (actif) {
        finGlisse.current = performance.now();
        setGlisse(null);
      }
    };

    window.addEventListener('pointermove', bouge);
    window.addEventListener('pointerup', fin);
  };

  // En plein écran, plus aucun ornement POSÉ : ni bande d'icônes, ni panneau, ni marge.
  // Mais « effacé » ne doit pas vouloir dire « inatteignable » — voir la lisière plus bas.
  const habille = !pleinEcran;

  /*
   * La bande d'icones et le panneau FLOTTENT au-dessus de la video : le contenu de
   * « main » doit s'ecarter de lui-meme, sinon boutons et mosaique passent dessous.
   *
   * Le decalage ne suit QUE l'etat epingle, jamais le survol : un panneau revele se pose
   * PAR-DESSUS l'image sans la deplacer. S'il la repoussait, chaque passage de souris
   * changerait la largeur des tuiles, donc la qualite demandee au controleur, donc une
   * renegociation complete du flux — l'image se figerait a chaque survol.
   */
  const panneauVisible = survole || (habille && panneauOuvert);
  /* En plein écran la bande revient AVEC le panneau : la révéler seule ne servirait à rien,
     puisque c'est l'état et les caméras qu'on vient y chercher. */
  const railVisible = habille || survole;
  const decalVerre = habille ? L_RAIL + (panneauOuvert ? L_PANNEAU : 0) : 0;

  return (
    <div className="relative flex h-full">
      {/* La bande d'icones ne se replie jamais : c'est le seul point d'ancrage qui reste
          quand tout le reste est masque. Le plein ecran, lui, efface aussi celle-ci. */}
      {/* La bande n'est plus DÉMONTÉE en plein écran, seulement glissée hors du cadre :
          c'est ce qui lui permet de revenir en douceur au lieu de surgir. */}
      <nav onPointerEnter={revelerBord} onPointerLeave={masquerBord}
           className="app-rail flex w-14 shrink-0 flex-col items-center gap-1 border-r border-line py-3"
           style={{
             transform: railVisible ? 'none' : `translateX(-${L_RAIL}px)`,
             opacity: railVisible ? 1 : 0,
             pointerEvents: railVisible ? undefined : 'none',
             transition: 'transform var(--ample) var(--pose), opacity var(--douceur) var(--douce)',
           }}>
        {/* La marque signe l'application, animee en permanence — elle manquait des que les
            cameras s'affichaient. L'icone Windows, elle, reste figee : ici c'est l'ecran. */}
        {/* Le trait qui suit l'espace choisi. Absent tant que rien n'est mesure :
            mieux vaut pas de repere qu'un repere au mauvais endroit le temps d'une image. */}
        {repere !== null && (
          <span aria-hidden
                className="pointer-events-none absolute left-0 h-10 w-[3px] rounded-r"
                style={{ top: 0, background: 'var(--accent)',
                         transform: `translateY(${repere}px)`,
                         transition: 'transform var(--douceur) var(--pose)' }} />
        )}
        <div className="mb-2 grid h-10 w-10 place-items-center" title="Alcora">
          <Marque taille={26} anime />
        </div>
        {ESPACES.map(({ id, cle, Icon }) => (
          /* La bande d'icones OUBLIE la camera visee : elle ne vient d'aucune image en
             particulier. Sans cela, une visite aux Detections restait filtree sur la derniere
             camera dont on avait cliqué le bouton, sans que rien ne l'indique. */
          <button key={id} title={t(cle)} onClick={() => { setCameraCible(null); setEspace(id); }}
                  aria-current={espace === id}
                  ref={(el) => { if (el) boutonsRail.current.set(id, el); else boutonsRail.current.delete(id); }}
                  className="m-pression grid h-10 w-10 place-items-center rounded-md transition-colors"
                  style={espace === id
                    ? { background: 'var(--accent-soft)', color: 'var(--accent)' }
                    : { color: 'var(--soft)' }}>
            <Icon className="h-5 w-5" />
          </button>
        ))}
        <div className="flex-1" />
        {/* Reglages : version installee, et seule porte de sortie d'une configuration
            fautive. Cette porte demande confirmation — ouvrir un ecran ne detruit rien. */}
        <button title={t('espace.reglages')} onClick={() => setEspace('reglages')}
                aria-current={espace === 'reglages'}
                ref={(el) => { if (el) boutonsRail.current.set('reglages', el); else boutonsRail.current.delete('reglages'); }}
                className="m-pression grid h-10 w-10 place-items-center rounded-md transition-colors"
                style={espace === 'reglages'
                  ? { background: 'var(--accent-soft)', color: 'var(--accent)' }
                  : { color: 'var(--soft)' }}>
          <Settings className="h-5 w-5" />
        </button>
      </nav>

      {/* Lisière de révélation : invisible, au bord gauche. Elle n'existe que lorsque le
          panneau est absent — sinon elle intercepterait des clics destinés à l'image.
          En plein écran elle part du bord de la dalle, puisque la bande y est effacée :
          c'est la seule façon de retrouver l'état et les caméras sans tout quitter. */}
      {!panneauVisible && (
        <div
          onPointerEnter={revelerBord}
          className="absolute top-0 bottom-0 z-30"
          style={{ left: pleinEcran ? 0 : L_RAIL, width: pleinEcran ? 22 : 16 }}
          aria-hidden
        />
      )}

      {(
        <aside
          onPointerEnter={revelerBord}
          onPointerLeave={masquerBord}
          aria-hidden={!panneauVisible}
          className="app-panel relative w-[292px] shrink-0 overflow-y-auto border-r border-line bg-card p-4"
          style={{
            transform: panneauVisible ? 'none' : `translateX(-${L_RAIL + L_PANNEAU}px)`,
            opacity: panneauVisible ? 1 : 0,
            pointerEvents: panneauVisible ? undefined : 'none',
            transition: 'transform var(--ample) var(--pose), opacity var(--douceur) var(--douce)',
          }}>
          <h1 className="mb-4 text-[15px] font-semibold">{t('app.titrePanneau')}</h1>

          {/* L'état passe EN TÊTE : c'est la première chose qu'on veut savoir en ouvrant
              l'application — est-ce que ça marche ? La liste des caméras vient après. */}
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-soft">{t('app.etat')}</p>
          <div className="mb-4 flex items-start gap-2.5 px-2 text-[12.5px]">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: relay.running ? 'var(--ok)' : 'var(--warn)' }} />
            <div className="min-w-0">
              <p className="text-muted">{relay.message}</p>
              {/* Le remede etait calcule puis jete. C'est pourtant la seule partie qui dit
                  quoi faire — le message seul laisse l'utilisateur sans prise. */}
              {relay.remedy && (
                <p className="mt-1 text-[12px]" style={{ color: 'var(--warn)' }}>{relay.remedy}</p>
              )}
              {/* La reprise est automatique : le bouton n'apparait que lorsque reessayer
                  seul ne servirait a rien — mot de passe refuse, identite du controleur
                  changee. Sinon, l'application se debrouille. */}
              {!relay.running && relay.permanent && (
                <button onClick={() => { void bridge.retry(); }}
                        className="mt-2 flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-[12px] text-muted transition-colors hover:border-line2">
                  <RotateCw className="h-3 w-3" /> {t('app.reessayer')}
                </button>
              )}
            </div>
          </div>

          <div className="my-3 h-px bg-line" />

          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-soft">{t('app.cameras')}</p>
          {cameras.length === 0 && (
            <p className="text-[12.5px] text-soft">{t('app.aucuneCamera')}</p>
          )}
          {cameras.map((c) => {
            const best = bestChannel(c);
            const masquee = masquees.includes(c.id);
            const derniere = !masquee && cameras.length - masquees.length <= 1;
            return (
              <div key={c.id} className="group/cam flex items-center gap-2.5 rounded-md px-2 py-1.5"
                   style={masquee ? { opacity: 0.45 } : undefined}>
                <span className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: c.online ? 'var(--ok)' : 'var(--soft)' }} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px]">{c.name}</div>
                  {/* Sans canal diffusable, la CAUSE plutot que le constat : « aucun
                      flux » laissait croire a une panne alors qu'il manque un
                      interrupteur sur la console. */}
                  <div className="font-mono text-[10.5px]"
                       style={{ color: best ? 'var(--soft)' : 'var(--warn)' }}>
                    {best ? `${best.width} × ${best.height}` : t('camera.rtspDesactive')}
                  </div>
                </div>
                {/* Le masquage retire l'image de la mosaique, RIEN d'autre : les veilles
                    et les detections continuent — on cache une image, pas une camera. */}
                <button
                  onClick={() => basculerMasquee(c.id)}
                  disabled={derniere}
                  aria-label={masquee ? t('app.afficherCamera', { nom: c.name }) : t('app.masquerCamera', { nom: c.name })}
                  title={derniere ? t('app.derniereCamera')
                    : masquee ? t('app.reafficher') : t('app.masquerMosaique')}
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-soft opacity-0 transition-opacity hover:text-ink focus-visible:opacity-100 group-hover/cam:opacity-100 disabled:cursor-default disabled:hover:text-soft"
                  style={masquee ? { opacity: 1 } : undefined}
                >
                  {masquee ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            );
          })}

          {/* Le REMEDE, une seule fois pour toutes les cameras concernees.
              Le repeter sous chacune noierait le panneau ; ne le dire nulle part —
              ce qui etait le cas jusqu'a la 2.27.0 — laissait un nouvel utilisateur
              devant des cameras muettes sans le moindre geste a tenter. Le message
              existait pourtant deja, mais seul un script de developpement le lisait. */}
          {cameras.some((c) => !bestChannel(c)) && (
            <div className="mt-2 px-2">
              <p className="text-[11.5px] leading-relaxed" style={{ color: 'var(--warn)' }}>
                {t('camera.rtspRemede')}
              </p>
              {/* Le guide vit dans l'ecran de CONNEXION, ou l'on prepare la console —
                  et cet ecran s'atteint par « Modifier la connexion » dans les reglages.
                  On y renvoie plutot que d'ouvrir une seconde page : l'application n'en
                  a qu'une. */}
              <button onClick={() => { setCameraCible(null); setEspace('reglages'); }}
                      className="m-pression mt-1.5 text-[11.5px] underline decoration-dotted
                                 underline-offset-2"
                      style={{ color: 'var(--accent-d)' }}>
                {t('camera.guide')}
              </button>
            </div>
          )}

          {/* Détections en direct, stockage, rétention, activité du jour, versions. Sorti
              dans son propre fichier : le panneau devenait trop long pour rester lisible ici. */}
          <ColonneEtat versionAlcora={infosVersion} onOuvrir={ouvrirDetection} />

        </aside>
      )}
      {/* Le panneau reste MONTÉ en permanence : c'est ce qui lui permet de glisser au lieu
          d'apparaître d'un bloc, et cela évite de reconstruire son contenu à chaque survol. */}

      <main className="app-scene isolate relative min-w-0 flex-1"
            style={{ paddingLeft: decalVerre || undefined }}>
        {/* Le ciel vit SOUS tout le contenu de la scene (z negatif, scene isolee) :
            derriere les tuiles, derriere le texte des ecrans, sous le verre du
            panneau qui le floute. Le demonter est un reglage d'apparence. */}
        {fondAnime && <Planetarium />}
        {/* Ces deux boutons agissent sur l'IMAGE : replier le panneau pour la dégager,
            l'étendre à toute la dalle. Hors du direct ils n'ont pas d'objet, et ils se
            posaient sur la barre de filtres des Détections, masquant le premier d'entre
            eux. La bande d'icônes reste, elle, toujours accessible. */}
        {habille && espace === 'direct' && (
          /* Position explicite : un enfant absolu ignore la marge interieure du parent,
             il faut donc lui redonner le meme decalage qu'au contenu. */
          /* Le décalage suit le panneau VISIBLE, survol compris : sinon le panneau révélé
             se posait par-dessus ces deux boutons, et l'on ne pouvait plus l'épingler ni
             passer en plein écran sans d'abord écarter la souris. Le contenu de la scène,
             lui, continue de ne suivre que l'état épinglé — le déplacer au survol
             changerait la largeur des tuiles, donc la qualité demandée au contrôleur. */
          <div className="absolute top-2 z-30 flex gap-1.5"
               style={{ left: L_RAIL + (panneauVisible ? L_PANNEAU : 0) + 8,
                        transition: 'left var(--ample) var(--pose)' }}>
            {/* Toujours visible, au-dessus de la video : c'est ce qui rend le repli
                reversible sans rien deviner. Discret par defaut, car lorsque la mosaique
                remplit exactement la zone il se pose sur le coin d'une tuile, la ou figure
                deja son nom. */}
            <button
              onClick={() => { setPanneauOuvert((o) => !o); setSurvole(false); }}
              title={panneauOuvert ? t('app.reduirePanneau') : t('app.epinglerPanneau')}
              aria-label={panneauOuvert ? t('app.reduirePanneau') : t('app.epinglerPanneau')}
              className="veil grid h-7 w-7 place-items-center rounded-md opacity-55 transition-opacity hover:opacity-100 focus-visible:opacity-100"
              style={{ color: 'var(--on-2)' }}
            >
              {panneauOuvert ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            </button>

            <button
              onClick={basculerPleinEcran}
              title={t('app.pleinEcranF11')} aria-label={t('video.pleinEcran')}
              className="veil grid h-7 w-7 place-items-center rounded-md opacity-55 transition-opacity hover:opacity-100 focus-visible:opacity-100"
              style={{ color: 'var(--on-2)' }}
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Une nouvelle version est prete : on INVITE a redemarrer, on n'impose rien.
            Le telechargement s'est fait en silence, appliquer attend le bon moment. */}
        {maj?.etat === 'prete' && (
          <div className="veil m-surgit absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-xl px-4 py-2 text-[13px]"
               style={{ color: 'var(--on-1)' }}>
            <span>{t('app.versionPrete', { version: maj.version ?? '' })}</span>
            <button onClick={() => { void bridge.majRedemarrer(); }}
                    className="rounded-md px-2.5 py-1 text-[12.5px] font-semibold"
                    style={{ background: 'var(--accent)', color: '#20242a' }}>
              {t('app.redemarrerMaintenant')}
            </button>
            <button onClick={() => setMaj(null)} className="text-[12.5px]"
                    style={{ color: 'var(--on-3)' }}>
              {t('app.plusTard')}
            </button>
          </div>
        )}

        {/* Rappel fugace : en plein écran plus rien n'indique comment revenir. */}
        {indice && (
          <div className="veil m-surgit pointer-events-none absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-md px-3 py-1.5 text-[12.5px]"
               style={{ color: 'var(--on-2)' }}>
            {t('app.echapRevenir')}
          </div>
        )}

        {/* Commandes du plein écran : elles reviennent au moindre mouvement de souris et
            s'effacent d'elles-mêmes. « Échap » restait la seule sortie, et rien ne le
            disait passé les premières secondes — une image sans commande ressemble à une
            application bloquée. Placées à DROITE, loin de la lisière qui révèle le panneau
            à gauche : sans quoi vouloir l'un déclencherait l'autre. */}
        {pleinEcran && (
          <div className="absolute right-3 top-3 z-30 flex gap-1.5"
               style={{ opacity: commandes ? 1 : 0,
                        pointerEvents: commandes ? undefined : 'none',
                        transition: 'opacity var(--ample) var(--douce)' }}>
            <button
              onClick={() => { setPanneauOuvert(true); revelerBord(); }}
              title={t('app.afficherPanneau')} aria-label={t('app.afficherPanneau')}
              className="veil grid h-8 w-8 place-items-center rounded-md transition-opacity"
              style={{ color: 'var(--on-1)' }}>
              <PanelLeftOpen className="h-4 w-4" />
            </button>
            <button
              onClick={basculerPleinEcran}
              title={t('app.quitterPleinEcranEchap')} aria-label={t('video.quitterPleinEcran')}
              className="veil flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[12.5px]"
              style={{ color: 'var(--on-1)' }}>
              <Minimize2 className="h-4 w-4" />
              {t('app.quitter')}
            </button>
          </div>
        )}

        {/*
          * L'ecran qui arrive se pose au lieu de surgir.
          *
          * La cle porte le nom de l'espace : en changer remonte le nœud, et
          * l'animation se rejoue d'elle-meme — sans etat, sans minuteur. Le
          * remontage n'est pas un cout ajoute ici : chaque espace etait DEJA
          * demonte en quittant, ces branches s'excluant l'une l'autre.
          */}
        <div key={espace} className="m-ecran h-full">
        {espace === 'reglages' ? (
          <ReglagesScreen
            espacement={espacement}
            onEspacementChange={setEspacement}
            fondAnime={fondAnime}
            onFondAnimeChange={setFondAnime}
            onReconfigurer={() => {
              void bridge.reconfigure().then(() => { setEspace('direct'); setConfigured(false); });
            }}
          />
        ) : espace === 'detections' ? (
          <RechercheScreen cameras={cameras} cameraInitiale={cameraCible} />
        ) : espace === 'relecture' ? (
          <RelectureScreen cameras={cameras} relayBase={relayBase} cameraInitiale={cameraCible} />
        ) : espace === 'alertes' ? (
          <VeillesScreen cameras={cameras} />
        ) : espace !== 'direct' ? (
          <div className="grid h-full place-items-center text-[13px] text-soft">
            {t('espace.prochainLot')}
          </div>
        ) : !pret ? (
          /*
           * L'etat et son remede AU CENTRE, hors du panneau.
           *
           * Ils n'existaient que dans l'aside : panneau replie ou plein ecran, il ne restait
           * qu'une ligne de message nue, sans le remede qui dit quoi faire ni le bouton qui
           * permet d'agir. C'est pourtant exactement dans ces deux etats qu'une panne se
           * decouvre — la mosaique occupe alors tout l'ecran.
           */
          <div className="grid h-full place-items-center p-8">
            <div className="max-w-md text-center">
              <p className="text-[14px]">{relay.message}</p>
              {relay.remedy && (
                <p className="mt-2 text-[13px]" style={{ color: 'var(--warn)' }}>{relay.remedy}</p>
              )}
              {!relay.running && relay.permanent && (
                <button onClick={() => { void bridge.retry(); }}
                        className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-[13px] text-muted transition-colors hover:border-line2 hover:text-ink">
                  <RotateCw className="h-3.5 w-3.5" /> {t('app.reessayer')}
                </button>
              )}
            </div>
          </div>
        ) : (
          /* La marge est portee par le parent : l'element mesure ne doit en avoir aucune,
             car « clientHeight » l'inclurait et la grille deborderait d'autant.
             En plein ecran elle disparait : « intégralement » veut dire jusqu'au bord. */
          <div className={habille ? 'h-full w-full p-2' : 'h-full w-full'}>
           <div ref={zoneRef} className="h-full w-full overflow-hidden">
            {grille && (
              /* Centree sur les deux axes : le vide se repartit autour des images plutot
                 que de s'accumuler sous elles. */
              <div
                ref={grilleRef}
                className="grid h-full w-full"
                style={{
                  gridTemplateColumns: `repeat(${grille.colonnes}, ${grille.largeur}px)`,
                  gridAutoRows: `${grille.hauteur + H_ETIQUETTE}px`,
                  gap: `${espacement}px`,
                  justifyContent: 'center',
                  alignContent: 'center',
                }}
              >
                {affichees.map((c) => (
                  <div key={c.id} data-id={c.id} className="h-full w-full"
                       onPointerDown={(e) => commencerGeste(e, c.id)}
                       onDoubleClick={() => {
                         // Un double-clic dans la foulee d'un deplacement est un accident.
                         if (performance.now() - finGlisse.current < 500) return;
                         setIsolee((v) => (v === c.id ? null : c.id));
                       }}
                       style={{
                         cursor: !isolee && affichees.length > 1 ? 'grab' : undefined,
                         opacity: glisse === c.id ? 0.6 : undefined,
                         outline: glisse === c.id ? '2px solid var(--accent)' : undefined,
                         outlineOffset: glisse === c.id ? -2 : undefined,
                         transition: 'opacity .15s',
                       }}
                       title={isolee ? t('app.revenirMosaique') : t('app.glisserIsoler')}>
                    <CameraTile camera={c} relayBase={relayBase!} cadre={espacement > 0}
                                hauteurEtiquette={H_ETIQUETTE} actions={actionsTuile}
                                activite={activite[c.id]
                                  ? { libelle: libelleSujets(activite[c.id].sujets, activite[c.id].type) }
                                  : null}
                                zoomClavier={isolee === c.id} />
                  </div>
                ))}
              </div>
            )}
           </div>
          </div>
        )}
        </div>
      </main>

      {/* Par-dessus tout : une bulle cliquée doit montrer sa séquence sans rien déranger. */}
      {sequence && (
        <LecteurExtrait detection={sequence} onFermer={() => setSequence(null)} />
      )}

      {/* « Ce qui a changé » — après l'intro, jamais par-dessus elle, et une seule fois. */}
      {introFinie && nouveautes && (
        <NouveautesScreen
          nouveautes={nouveautes}
          onFermer={() => {
            setNouveautes(null);
            void bridge.nouveautesVues();
          }}
        />
      )}

      {intro}
    </div>
  );
}
