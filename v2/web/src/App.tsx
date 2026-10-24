import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, Minimize2, PanelRightOpen, RotateCw } from 'lucide-react';
import { CameraTile } from './video/CameraTile';
import { SetupScreen } from './screens/SetupScreen';
import { ReglagesScreen } from './screens/ReglagesScreen';
import { RechercheScreen } from './screens/RechercheScreen';
import { RelectureScreen } from './screens/RelectureScreen';
import { LecteurExtrait } from './screens/LecteurExtrait';
import { NouveautesScreen } from './screens/NouveautesScreen';
import { CielScreen } from './screens/CielScreen';
import { ColonneActivite } from './screens/ColonneActivite';
import { BandeauActivite } from './screens/BandeauActivite';
import { VeillesScreen } from './screens/VeillesScreen';
import { SystemeScreen } from './screens/SystemeScreen';
import { BarreEtat } from './cadre/BarreEtat';
import { Raccourcis } from './cadre/Raccourcis';
import { FenetreGuide } from './cadre/FenetreGuide';
import { Rail, type Espace } from './cadre/Rail';
import { MenuCameras } from './cadre/MenuCameras';
import { MenuDispositions } from './cadre/MenuDispositions';
import {
  appliquer, decritLeMur, enregistrer, lireDispositions, mettreAJour, renommer, supprimer,
  type Disposition, type Dispositions,
} from './lib/dispositions';
import { Bouton } from './ui/Bouton';
import { EnTete, Touche } from './ui/Cadre';
import { Planetarium } from './Planetarium';
import { meilleureGrille } from './video/grille';
import { placerBandeau } from './lib/placementBandeau';
import { useAbsence } from './lib/useAbsence';
import { bridge, pontDisponible } from './lib/bridge';
import { FournisseurActivite } from './lib/FournisseurActivite';
import { definirLangue, t, useLangue } from './i18n';
import { nomSujet } from './i18n/sujets';
import type { RelaisAcces,
  Detection, DetectionVive, DiscoveredCamera, MajState, Nouveautes, Progression, RelayState,
  SystemeEtat,
} from './types/protect';

/** Le retrait de la colonne Activite survit au redemarrage : la retirer chaque fois userait. */
const CLE_ACTIVITE = 'alcora.activite';
/**
 * Le fond anime (Planetarium) : un choix d'apparence, ETEINT par defaut depuis la direction
 * « Observatoire » (23.10.2026) — le ciel reste, mais fixe.
 *
 * Nouvelle cle, et c'est voulu : l'ancienne (« protectviewer.fond ») etait ecrite des le
 * premier lancement, choix ou pas. Tous les postes la portaient donc a « anime » sans que
 * personne l'ait decide, et changer seulement la valeur par defaut n'aurait touche personne.
 */
const CLE_FOND = 'alcora.fond';
/**
 * Hauteur du bandeau pose AU-DESSUS de chaque vue, hors de l'image.
 *
 * Passe de 26 a 34 px le 29.07.2026 : il porte desormais les quatre commandes de la
 * camera, sorties de l'image ou elles se fondaient dans la scene. Le cout en hauteur
 * d'image est negligeable ; le gain est qu'il n'y a plus rien a decouvrir.
 *
 * Puis 44 px avec la direction « Observatoire » (23.10.2026) : les commandes portent leur
 * nom a cote de l'icone, et le nom de la camera se lit d'un coup d'oeil.
 */
const H_ETIQUETTE = 44;
/** La barre d'état (cadre/BarreEtat.tsx) : en plein écran, elle se pose en bas, sur le mur. */
const H_BARRE = 34;
/** Espace entre les vues, en pixels. Zero est un choix legitime : images bord a bord. */
const CLE_ESPACE = 'protectviewer.espace';
/** Ordre des cameras choisi a la souris. Liste d'identifiants, jamais elaguee : une
 *  camera momentanement hors ligne retrouve sa place a son retour. */
const CLE_ORDRE = 'protectviewer.ordre';
/** Cameras masquees de la mosaique. On cache une IMAGE, pas une camera : les veilles et
 *  les detections continuent, et la relecture reste accessible. */
const CLE_MASQUEES = 'protectviewer.masquees';
/** Les dispositions du mur (lib/dispositions.ts) : à côté de l'ordre et des masquées, sur ce PC. */
const CLE_DISPOSITIONS = 'alcora.dispositions';

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
        <p className="mb-2 text-titre font-semibold">{t('app.pontTitre')}</p>
        <p className="text-muted">
          {t('app.pontDetail1')} <span className="font-mono text-meta">journal.txt</span>,
          {' '}{t('app.pontDetail2')} <span className="font-mono text-meta">%APPDATA%\Alcora</span>.
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
  const [relais, setRelais] = useState<RelaisAcces | null>(null);
  /** L'etat du controleur : page Systeme et barre d'etat. Relu avec l'inventaire. */
  const [systeme, setSysteme] = useState<SystemeEtat | null>(null);
  const [relay, setRelay] = useState<RelayState>({ running: false, message: 'Démarrage…' });
  const [espace, setEspace] = useState('direct');
  /** La colonne Activite du direct, a droite du mur. */
  const [activiteVisible, setActiviteVisible] = useState(
    () => localStorage.getItem(CLE_ACTIVITE) !== 'masquee',
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
  /** La fenetre des raccourcis clavier (touche « ? », barre d'etat). */
  const [raccourcis, setRaccourcis] = useState(false);
  /** Le guide d'activation du RTSP, ouvert hors de l'écran de connexion. */
  const [guide, setGuide] = useState(false);
  const [espacement, setEspacement] = useState(() => {
    const brut = localStorage.getItem(CLE_ESPACE);
    const n = Number(brut);
    // Zero par defaut : les images se touchent, un seul mur.
    return brut !== null && Number.isFinite(n) ? Math.min(24, Math.max(0, n)) : 0;
  });
  const [fondAnime, setFondAnime] = useState(
    () => localStorage.getItem(CLE_FOND) === 'anime',
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
  /** Version installee, pour la colonne d'etat. Tiree une fois : elle ne change pas. */
  const [infosVersion, setInfosVersion] = useState<string | null>(null);
  /**
   * Camera visee par une navigation venue d'une tuile.
   *
   * Les boutons du direct emmenent vers la relecture ou les detections DE CETTE camera :
   * y arriver sur une autre serait un contresens.
   */
  const [cameraCible, setCameraCible] = useState<string | null>(null);
  /** L'instant visé par « Revoir à cet instant » : la relecture y arrive directement. */
  const [instantCible, setInstantCible] = useState<{ t: number } | null>(null);
  /**
   * Changer d'espace, éventuellement pour une caméra. Un seul chemin, qui OUBLIE l'instant
   * visé : sans cela, la relecture rouverte depuis le rail reviendrait à la dernière
   * détection revue, sans que rien ne le dise.
   */
  const allerVers = useCallback((id: string, camera: string | null = null) => {
    setCameraCible(camera);
    setInstantCible(null);
    setEspace(id);
  }, []);
  /** « Revoir à cet instant » : une détection mène à la relecture, sur sa caméra, à son heure. */
  const revoirA = useCallback((camera: string | null, t: number) => {
    // Une détection sans caméra rend parfois « » : c'est « aucune », pas un identifiant.
    setCameraCible(camera || null);
    setInstantCible({ t });
    setEspace('relecture');
  }, []);
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
    onRelecture: (id: string) => allerVers('relecture', id),
    onDetections: (id: string) => allerVers('detections', id),
    onCapture: (nom: string, octets: ArrayBuffer) => bridge.capturer(nom, octets),
    onSon: (id: string) => setSonSur(id),
    sonSur,
    sonParDefaut: confort?.sonParDefaut ?? false,
  }), [sonSur, confort, allerVers]);

  /*
   * ATTENTION — tout crochet doit rester AU-DESSUS des sorties anticipees de ce composant
   * (pont manquant, configuration non lue, ecran de connexion). Places en-dessous, ils ne
   * s'executent pas a tous les rendus : React compte alors dix-sept crochets au premier
   * passage puis vingt-deux au suivant, refuse de continuer, et l'application n'affiche
   * plus RIEN. C'est arrive en 2.10.0. « npm test » lance desormais oxlint, dont la regle
   * « react/rules-of-hooks » designe exactement ce defaut.
   */

  /*
   * Commandes du plein ecran : elles reviennent au moindre mouvement, puis s'effacent.
   *
   * Sans elles, « Echap » etait la SEULE sortie et rien ne le disait passe les premieres
   * secondes. Une image plein ecran sans aucune commande visible ressemble a une
   * application bloquee, pas a un choix.
   */
  const [commandes, setCommandes] = useState(false);
  /** Le menu « Caméras » est ouvert : les commandes du plein écran ne s'effacent pas sous lui. */
  const [menuOuvert, setMenuOuvert] = useState(false);
  useEffect(() => {
    // Hors du plein écran, elles ne se montrent pas : « commandesVisibles » le déduit, rien à remettre ici.
    if (!pleinEcran) return;
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
  /** Les dispositions du mur, et la façon d'en appliquer une par son rang (Ctrl + chiffre). */
  const [dispositions, setDispositions] = useState<Dispositions>(
    () => lireDispositions(localStorage.getItem(CLE_DISPOSITIONS)),
  );
  useEffect(() => {
    localStorage.setItem(CLE_DISPOSITIONS, JSON.stringify(dispositions));
  }, [dispositions]);
  const appliquerRang = useRef<(rang: number) => void>(() => {});
  const geometrieRef = useRef<{ colonnes: number; rangees: number; largeur: number; hauteur: number } | null>(null);
  /** Instant de fin du dernier glissement : un double-clic juste apres ne doit pas isoler. */
  const finGlisse = useRef(0);

  useEffect(() => {
    localStorage.setItem(CLE_ACTIVITE, activiteVisible ? 'visible' : 'masquee');
  }, [activiteVisible]);

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
  /* L'introduction couvre-t-elle l'écran ? Calculé ici, avant le clavier qui en a besoin :
     la fenêtre des raccourcis ne doit pas s'ouvrir sous ce qui la cacherait. */
  const echecOuverture = !relay.running && Boolean(relay.permanent || relay.remedy);
  const introVisible = !introFinie && !echecOuverture && (configured !== false || Boolean(maj?.demarrage));

  useEffect(() => {
    const auClavier = (e: KeyboardEvent) => {
      const saisie = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (e.key === 'F11') { e.preventDefault(); basculerPleinEcran(); }
      // « ? » partout, sauf dans un champ ou il s'ecrit. La fenetre ouverte le traite elle-meme.
      // Jamais sous ce qui couvre l'ecran (introduction, sequence, nouveautes), ni avant la
      // configuration : elle s'ouvrirait invisible, et le prochain Echap fermerait les deux.
      else if (e.key === '?' && !saisie && configured && !introVisible && !sequence
               && !(introFinie && nouveautes) && !guide) { e.preventDefault(); setRaccourcis(true); }
      else if (e.key === 'Escape') {
        if (isolee) setIsolee(null);
        else if (pleinEcran) basculerPleinEcran();
      } else if (espace === 'direct' && e.ctrlKey && !e.altKey && !e.metaKey && /^(Digit|Numpad)[1-9]$/.test(e.code)
                 && !saisie) {
        // Ctrl + chiffre : une disposition. Pas Maj — sur un clavier suisse, Maj + 1 donne
        // « + », la touche de zoom de la caméra isolée.
        e.preventDefault();
        appliquerRang.current(Number(e.code.slice(-1)));
      } else if (espace === 'direct' && /^[0-9]$/.test(e.key) && !e.ctrlKey
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

  /*
   * Le rappel s'efface seul : en plein ecran, rien ne doit rester en travers de l'image.
   * Il se rallume quand on entre en plein ecran ou qu'on isole une camera — ajuste PENDANT
   * le rendu, au changement (le motif que React documente), et non par un effet qui
   * relancerait un second rendu (regle react/set-state-in-effect, 24.10.2026). L'effet ne
   * fait plus que programmer l'extinction.
   */
  const cleRappel = `${pleinEcran}|${isolee ?? ''}`;
  const [rappelVu, setRappelVu] = useState(cleRappel);
  if (rappelVu !== cleRappel) {
    setRappelVu(cleRappel);
    setIndice(pleinEcran || isolee !== null);
  }
  useEffect(() => {
    if (!indice) return;
    const t = setTimeout(() => setIndice(false), 2600);
    return () => clearTimeout(t);
  }, [indice, cleRappel]);

  // L'inventaire et le relais sont prets a des instants differents : on suit les deux.
  useEffect(() => {
    if (!configured) return;

    let alive = true;
    const charger = async () => {
      // L'etat du controleur vient de la meme decouverte que l'inventaire : il se relit avec
      // lui. Son echec ne doit pas faire echouer l'inventaire, qui seul fait le direct.
      const [cams, acces, sys] = await Promise.all([
        bridge.getCameras(), bridge.relais(), bridge.systeme().catch(() => null)]);
      if (!alive) return;
      if (sys) setSysteme(sys);
      console.log(`[inventaire] ${cams.length} caméra(s), relais ${acces?.base ?? 'indisponible'}`);
      setCameras(cams);
      setRelais(acces);
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

  /*
   * Le contexte de la mesure de charge (mesure.js, cote principal) : ce que la fenetre
   * montre. Le nombre de tuiles suit la regle de la mosaique plus bas — calcule ICI, parce
   * que tous les crochets doivent passer avant les sorties anticipees (l'ecran noir de la
   * 2.10.0 venait d'un crochet place apres l'une d'elles).
   */
  /** Les images de la relecture, une ou plusieurs caméras : rapportées par l'écran lui-même. */
  const [tuilesRelecture, setTuilesRelecture] = useState(1);
  const tuilesAffichees = !configured || relais === null ? 0
    : isolee ? (cameras.some((c) => c.id === isolee && !masquees.includes(c.id)) ? 1 : 0)
    : cameras.filter((c) => !masquees.includes(c.id)).length;
  useEffect(() => {
    if (!pontDisponible || configured === null) return;
    void bridge.contexteMesure({
      espace: configured ? espace : 'connexion',
      tuiles: configured && espace === 'direct' ? tuilesAffichees
        : configured && espace === 'relecture' ? tuilesRelecture : null,
      // Le ciel ne vit plus qu'autour des images (et a la connexion) : ailleurs, il n'y en a pas.
      ciel: configured && espace !== 'direct' ? 'aucun' : fondAnime ? 'anime' : 'fixe',
    }).catch(() => {});
  }, [configured, espace, tuilesAffichees, tuilesRelecture, fondAnime]);

  // L'ordre choisi a la souris s'applique d'abord ; les cameras inconnues de la liste
  // (nouvelles, ou jamais deplacees) suivent, dans leur ordre d'inventaire. Les masquees
  // sortent de la mosaique — et d'elle seulement : le panneau les liste toujours.
  const rang = new Map(ordre.map((id, i) => [id, i]));
  const ordonnees = cameras.filter((c) => !masquees.includes(c.id)).sort(
    (a, b) => (rang.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rang.get(b.id) ?? Number.MAX_SAFE_INTEGER),
  );

  /* ---- les dispositions du mur ---- */
  const connues = cameras.map((c) => c.id);
  const visiblesMur = ordonnees.map((c) => c.id);
  const dispoActive = dispositions.liste.find((d) => d.id === dispositions.active) ?? null;
  const dispoModifiee = dispoActive !== null && !decritLeMur(dispoActive, visiblesMur, connues);
  /** Le mur prend la disposition : ses caméras, dans son ordre ; les autres masquées. */
  const appliquerDisposition = (d: Disposition) => {
    const r = appliquer(d, connues, ordre);
    // Aucune de ses caméras n'est sur le contrôleur : on ne vide pas le mur.
    if (r.masquees.length === connues.length) return;
    setOrdre(r.ordre);
    setMasquees(r.masquees);
    localStorage.setItem(CLE_MASQUEES, JSON.stringify(r.masquees));
    setIsolee(null);
    setDispositions((s) => ({ ...s, active: d.id }));
  };

  // Une caméra isolée occupe seule toute la zone ; sinon, la mosaïque complète.
  const affichees = isolee ? ordonnees.filter((c) => c.id === isolee) : ordonnees;
  const grille = meilleureGrille(taille.w, taille.h, affichees.length, 16 / 9, espacement, H_ETIQUETTE);

  /* Ce que tu n'as pas vu : tenu dès le lancement, montré par le bandeau du plein écran. */
  const { etat: absence, marquerVu } = useAbsence();

  /*
   * Ce que lisent le clavier et le glisser, montes hors du rendu : le mur tel qu'il est
   * AFFICHE. Ecrit apres chaque rendu valide, avant la peinture — jamais pendant le rendu,
   * qu'un rendu abandonne par React laisserait sinon dans les references (regle react/refs,
   * rallumee le 24.10.2026). Ici, avant les sorties anticipees, comme tout crochet.
   */
  useLayoutEffect(() => {
    ordonneesRef.current = ordonnees;
    geometrieRef.current = grille;
    appliquerRang.current = (r) => {
      const d = dispositions.liste[r - 1];
      if (d) appliquerDisposition(d);
    };
  });

  if (!pontDisponible) return <PontManquant />;

  const pret = relais !== null && cameras.length > 0;

  /*
   * L'introduction : la constellation, par-dessus tout le reste.
   *
   * Elle couvre la sequence d'ouverture entiere — y compris une mise a jour au lancement,
   * qu'elle relate dans son texte. La mosaique vit DESSOUS pendant ce temps : les flux se
   * connectent sous le voile, et la fin de l'introduction decouvre des images deja en
   * mouvement. Elle s'efface d'elle-meme des qu'un echec demande l'attention : l'etat et
   * son remede ne se lisent pas a travers un ciel etoile.
   */
  const intro = introVisible ? (
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
        <Planetarium anime={fondAnime} />
        <SetupScreen onDone={() => { setConfigured(true); setIntroFinie(true); }} />
      </div>
    );
  }

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

  // En plein écran, plus aucun ornement POSÉ : ni rail, ni en-tête, ni colonne, ni barre.
  const habille = !pleinEcran;
  /* La ligne des gestes : dès qu'il y a quelque chose à réorganiser ou à isoler. */
  const indiceGestes = habille && pret && (isolee !== null || affichees.length > 1);

  /* La précision de l'en-tête du direct : combien d'images, ou laquelle est seule. */
  const nomIsolee = isolee ? cameras.find((c) => c.id === isolee)?.name : null;
  const precisionMur = nomIsolee ? t('direct.isolee', { nom: nomIsolee })
    : ordonnees.length === cameras.length
      ? (cameras.length === 1 ? t('direct.une') : t('direct.toutes', { n: cameras.length }))
      : ordonnees.length === 1 ? t('direct.uneSur', { total: cameras.length })
        : t('direct.surTotal', { n: ordonnees.length, total: cameras.length });
  /* La disposition en cours se lit d'abord : c'est le nom de ce qu'on regarde. */
  const precisionDirect = !dispoActive ? precisionMur
    : t(dispoModifiee ? 'dispositions.precisionModifiee' : 'dispositions.precision', { nom: dispoActive.nom, reste: precisionMur });

  /* Le guide de la console s'ouvre sur place. Il ne vivait que dans l'écran de connexion,
     où l'on n'arrivait qu'en effaçant le mot de passe (« Modifier la connexion »). */
  const versLeGuide = () => setGuide(true);

  /* Dès que l'inventaire est lu, même vide : c'est le menu qui dit « Aucune caméra ». */
  const menuCameras = (sombre?: boolean) => relais !== null && (
    <MenuCameras cameras={cameras} masquees={masquees} onBasculer={basculerMasquee}
                 onGuide={versLeGuide} sombre={sombre} onOuvert={sombre ? setMenuOuvert : undefined} />
  );

  const menuDispositions = (sombre?: boolean) => relais !== null && cameras.length > 0 && (
    <MenuDispositions dispositions={dispositions} cameras={cameras} visibles={visiblesMur} modifiee={dispoModifiee}
                      onAppliquer={appliquerDisposition}
                      onEnregistrer={(nom) => setDispositions((s) => enregistrer(s, crypto.randomUUID(), nom, visiblesMur))}
                      onMettreAJour={(id) => setDispositions((s) => mettreAJour(s, id, visiblesMur))}
                      onRenommer={(id, nom) => setDispositions((s) => renommer(s, id, nom))}
                      onSupprimer={(id) => setDispositions((s) => supprimer(s, id))}
                      sombre={sombre} onOuvert={sombre ? setMenuOuvert : undefined} />
  );

  const commandesVisibles = (pleinEcran && commandes) || menuOuvert;
  /* En plein écran, la barre d'état revient avec les commandes — et RESTE quand quelque chose
     ne va pas : c'est par elle qu'on atteint l'état, le remède et « Réessayer ». */
  const barreVisible = commandesVisibles || !relay.running || Boolean(systeme?.enregistrementSuspendu)
    || cameras.some((c) => !c.online);
  const barre = (
    <BarreEtat relay={relay} systeme={systeme} cameras={cameras} espace={espace}
               onSysteme={() => allerVers('systeme')}
               onRaccourcis={() => setRaccourcis(true)}
               onRelecture={() => allerVers('relecture')} />
  );

  /*
   * Le mur : le ciel autour des images, les images, et la ligne qui dit les gestes.
   *
   * Le ciel ne vit plus que LÀ (direction « Observatoire ») : derrière les autres écrans,
   * il ne faisait que concurrencer leur texte.
   */
  const mur = (
    <div className="app-scene isolate relative flex min-h-0 flex-1 flex-col">
      <Planetarium anime={fondAnime} />
      {!pret ? (
        /*
         * L'état et son remède AU CENTRE du mur.
         *
         * Le panneau n'est plus là pour les dire, et c'est exactement quand une panne
         * empêche les images que le mur est vide : c'est donc là qu'on regarde.
         */
        <div className="grid flex-1 place-items-center p-8">
          <div className="max-w-md text-center">
            {/* Le flux marche, l'inventaire est lu, et il est vide : c'est CELA qu'il faut dire,
                pas « Flux vidéo prêt » sur un mur sans image. */}
            {relay.running && relais !== null && cameras.length === 0 ? (
              <>
                <p className="text-titre">{t('app.aucuneCamera')}</p>
                <p className="mt-2 text-muted">{relay.message}</p>
              </>
            ) : <p className="text-titre">{relay.message}</p>}
            {relay.remedy && <p className="mt-2 text-warn">{relay.remedy}</p>}
            {!relay.running && relay.permanent && (
              <Bouton icone={RotateCw} className="mt-4" onClick={() => { void bridge.retry(); }}>
                {t('app.reessayer')}
              </Bouton>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* La marge est portée par le parent : l'élément mesuré ne doit en avoir aucune,
              car « clientHeight » l'inclurait et la grille déborderait d'autant.
              En plein écran elle disparaît : « intégralement » veut dire jusqu'au bord. */}
          <div className={habille ? `min-h-0 flex-1 px-5 pt-5${indiceGestes ? '' : ' pb-5'}` : 'relative min-h-0 flex-1'}>
            <div ref={zoneRef} className="h-full w-full overflow-hidden">
              {grille && (
                /* Centrée sur les deux axes : le vide se répartit autour des images plutôt
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
                           // Un double-clic dans la foulée d'un déplacement est un accident.
                           if (performance.now() - finGlisse.current < 500) return;
                           setIsolee((v) => (v === c.id ? null : c.id));
                         }}
                         style={{
                           cursor: !isolee && affichees.length > 1 ? 'grab' : undefined,
                           opacity: glisse === c.id ? 0.6 : undefined,
                           outline: glisse === c.id ? '2px solid var(--accent)' : undefined,
                           outlineOffset: glisse === c.id ? -2 : undefined,
                           transition: 'opacity .15s',
                         }}>
                      <CameraTile camera={c} relais={relais!} cadre={espacement > 0}
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
            {/* En plein écran, la colonne Activité n'est plus là : le bandeau prend la place
                que la mosaïque laisse libre, sans jamais la rétrécir (lib/placementBandeau.ts). */}
            {pleinEcran && grille && (
              <BandeauActivite placement={placerBandeau(taille, grille, espacement, H_ETIQUETTE, H_BARRE)}
                               absence={absence} largeurZone={taille.w}
                               bas={(barreVisible ? H_BARRE : 0) + 16} commandesVisibles={commandesVisibles}
                               onOuvrir={ouvrirDetection} onVu={marquerVu}
                               onToutes={() => { basculerPleinEcran(); allerVers('detections'); }} />
            )}
          </div>
          {/* Les gestes du mur n'étaient dits nulle part, sinon dans une infobulle qui
              couvrait toute la tuile. Une ligne, sous les images, et la fenêtre des
              raccourcis pour le reste. */}
          {indiceGestes && (
            <p className="flex h-[30px] shrink-0 items-center justify-center px-5 text-meta text-soft">
              {isolee ? t('direct.indiceIsolee') : t('direct.indice')}
            </p>
          )}
        </>
      )}
    </div>
  );

  return (
    <FournisseurActivite>
    {/* La colonne : les espaces au-dessus, la barre d'état dessous. Les surfaces qui couvrent
        tout (séquence, nouveautés, introduction) sont posées sur CE cadre, barre comprise. */}
    <div className="relative flex h-full flex-col">
    <div className="relative flex min-h-0 flex-1">
      {/* Le rail OUBLIE la caméra visée : il ne vient d'aucune image en particulier. Sans
          cela, une visite aux Détections restait filtrée sur la dernière caméra dont on
          avait cliqué le bouton, sans que rien ne l'indique. */}
      {habille && (
        <Rail espace={espace} marqueAnimee={fondAnime}
              onChoisir={(id: Espace) => allerVers(id)} />
      )}

      <main className="relative flex min-w-0 flex-1 flex-col bg-bg">
        {/* Une nouvelle version est prête : on INVITE à redémarrer, on n'impose rien.
            Le téléchargement s'est fait en silence, appliquer attend le bon moment. */}
        {maj?.etat === 'prete' && (
          <div className="veil m-surgit absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-xl py-2 pl-4 pr-2"
               style={{ color: 'var(--on-1)' }}>
            <span>{t('app.versionPrete', { version: maj.version ?? '' })}</span>
            <Bouton variante="primaire" taille="petit" onClick={() => { void bridge.majRedemarrer(); }}>
              {t('app.redemarrerMaintenant')}
            </Bouton>
            <Bouton variante="fantome" taille="petit" onClick={() => setMaj(null)}>
              {t('app.plusTard')}
            </Bouton>
          </div>
        )}

        {/* Rappel fugace : en plein écran plus rien n'indique comment revenir. Hors du plein
            écran, l'en-tête et la ligne des gestes le disent déjà : il ne ferait que s'y poser. */}
        {indice && pleinEcran && (
          <div className="veil m-surgit pointer-events-none absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-md px-3 py-1.5"
               style={{ color: 'var(--on-2)' }}>
            {t('app.echapRevenir')}
          </div>
        )}

        {/* Commandes du plein écran : elles reviennent au moindre mouvement de souris et
            s'effacent d'elles-mêmes. « Échap » restait la seule sortie, et rien ne le
            disait passé les premières secondes — une image sans commande ressemble à une
            application bloquée. Le menu des caméras y est aussi : le panneau qu'on
            révélait au bord de l'écran n'existe plus. */}
        {pleinEcran && (
          <div className="absolute right-3 top-3 z-30 flex gap-1.5"
               style={{ opacity: commandesVisibles ? 1 : 0,
                        pointerEvents: commandesVisibles ? undefined : 'none',
                        transition: 'opacity var(--ample) var(--douce)' }}>
            {espace === 'direct' && menuCameras(true)}
            {espace === 'direct' && menuDispositions(true)}
            <Bouton icone={Minimize2} titre={t('app.quitterPleinEcranEchap')} onClick={basculerPleinEcran}
                    className="veil" style={{ color: 'var(--on-1)' }}>
              {t('app.quitter')}
            </Bouton>
          </div>
        )}

        {/*
          * L'écran qui arrive se pose au lieu de surgir.
          *
          * La clé porte le nom de l'espace : en changer remonte le nœud, et
          * l'animation se rejoue d'elle-même — sans état, sans minuteur. Le
          * remontage n'est pas un coût ajouté ici : chaque espace était DÉJÀ
          * démonté en quittant, ces branches s'excluant l'une l'autre.
          */}
        <div key={espace} className="m-ecran flex min-h-0 flex-1 flex-col">
        {espace === 'reglages' ? (
          <ReglagesScreen
            espacement={espacement}
            onEspacementChange={setEspacement}
            fondAnime={fondAnime}
            onFondAnimeChange={setFondAnime}
            onReconfigurer={() => {
              void bridge.reconfigure().then(() => { setEspace('direct'); setConfigured(false); });
            }}
            onRaccourcis={() => setRaccourcis(true)}
            onGuide={versLeGuide}
          />
        ) : espace === 'detections' ? (
          <RechercheScreen cameras={cameras} cameraInitiale={cameraCible} onRevoir={revoirA} />
        ) : espace === 'relecture' ? (
          <RelectureScreen cameras={cameras} relais={relais} cameraInitiale={cameraCible}
                           instantInitial={instantCible} onTuiles={setTuilesRelecture} />
        ) : espace === 'alertes' ? (
          <VeillesScreen cameras={cameras} onOuvrir={ouvrirDetection} onRevoir={revoirA} />
        ) : espace === 'systeme' ? (
          <SystemeScreen systeme={systeme} relay={relay} cameras={cameras} masquees={masquees}
                         onBasculerMasquee={basculerMasquee} versionAlcora={infosVersion}
                         onGuide={versLeGuide} />
        ) : espace !== 'direct' ? (
          <div className="grid h-full place-items-center text-soft">
            {t('espace.prochainLot')}
          </div>
        ) : (
          <>
            {habille && (
              <EnTete
                titre={t('espace.direct')}
                precision={pret ? precisionDirect : undefined}
                actions={(
                  <>
                    {menuCameras()}
                    {menuDispositions()}
                    {!activiteVisible && (
                      <Bouton variante="fantome" icone={PanelRightOpen} titre={t('activite.afficher')}
                              onClick={() => setActiviteVisible(true)} />
                    )}
                    <Bouton icone={Maximize2} titre={t('app.pleinEcranF11')} onClick={basculerPleinEcran}>
                      {t('video.pleinEcran')} <Touche>F11</Touche>
                    </Bouton>
                  </>
                )}
              />
            )}
            {mur}
          </>
        )}
        </div>
      </main>

      {/* L'activité ne vit que sur le direct : sur les autres écrans, elle ne faisait que
          prendre de la place. La replier change la largeur des images — et donc la
          qualité demandée au contrôleur : c'est un geste, jamais un survol. */}
      {habille && espace === 'direct' && activiteVisible && (
        <ColonneActivite onOuvrir={ouvrirDetection} onRevoir={revoirA}
                         onToutes={() => allerVers('detections')}
                         onMasquer={() => setActiviteVisible(false)} />
      )}
    </div>

      {/* La barre d'état, sur tous les écrans. En plein écran, elle se pose sur l'image avec
          les commandes — c'est elle qui remplace le panneau qu'on révélait au bord. */}
      {!pleinEcran ? barre : (
        <div className="absolute inset-x-0 bottom-0 z-30"
             style={{ opacity: barreVisible ? 1 : 0,
                      pointerEvents: barreVisible ? undefined : 'none',
                      transition: 'opacity var(--ample) var(--douce)' }}>
          {barre}
        </div>
      )}

      {raccourcis && <Raccourcis onFermer={() => setRaccourcis(false)} />}
      {guide && <FenetreGuide onFermer={() => setGuide(false)} />}

      {/* Par-dessus tout : une bulle cliquée doit montrer sa séquence sans rien déranger. */}
      {sequence && (
        <LecteurExtrait detection={sequence} onFermer={() => setSequence(null)}
                        onRelecture={sequence.debut !== null
                          ? () => revoirA(sequence.camera, sequence.debut as number) : undefined} />
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
    </FournisseurActivite>
  );
}
