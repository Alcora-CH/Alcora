import type { CodeLangue } from '../i18n';

/**
 * Contrat entre l'interface et le processus principal.
 *
 * Le client Protect ne peut pas vivre dans la page : le navigateur refuserait les requetes
 * vers le controleur (origine differente) et ne sait pas epingler un certificat auto-signe.
 * Il vit donc cote Electron, et la page le pilote par messages. C'est aussi ce qui garde
 * les secrets hors de portee du code de la page.
 */

export type StepId = 'reseau' | 'certificat' | 'identifiants' | 'inventaire' | 'flux';

export type StepState = 'attente' | 'encours' | 'reussi' | 'echoue' | 'ignore';

export interface StepResult {
  step: StepId;
  state: StepState;
  /** Phrase affichable telle quelle. Jamais un code d'erreur. */
  message: string;
  /** Ce que l'utilisateur peut faire. Absent s'il n'y a rien a proposer. */
  remedy?: string;
  /** Detail technique, repliable et selectionnable. */
  technical?: string;
}

export interface DiscoveredChannel {
  quality: 'high' | 'medium' | 'low' | 'package';
  width: number;
  height: number;
  fps: number;
  bitrate: number;
  streamable: boolean;
}

/**
 * Bornes de l'archive d'une camera.
 *
 * Mesure du 29.07.2026 : les trois valeurs viennent de champs dont les NOMS trompent.
 * `debut` est tire de `recordingStartLQ` (162 jours ici) et non de `recordingStart`, qui
 * marque en realite la fin de la haute definition (29 jours). Au-dela de `frontiere`,
 * l'export rend 640 x 360 la ou il rendait 3840 x 2160.
 */
export interface Archive {
  /** Millisecondes. Bord gauche de la frise : la video la plus ancienne qui existe. */
  debut: number;
  /** Millisecondes. Passage en definition reduite. Nul si une seule qualite est conservee. */
  frontiere: number | null;
  /** Millisecondes. Video la plus recente. */
  fin: number;
}

/**
 * Etat du controleur, pour la colonne laterale.
 *
 * `disque` vaut null quand le controleur ne l'expose pas sous un nom connu — les champs
 * changent d'une version de Protect a l'autre. L'interface fait alors disparaitre le bloc
 * plutot que d'afficher une jauge inventee.
 */
export interface SystemeEtat {
  nom: string | null;
  version: string | null;
  /** Mise a jour du controleur disponible. Montree, jamais appliquee : ce n'est pas a nous. */
  versionDisponible: string | null;
  /** UniFi OS. Nom de champ releve dans le journal du poste. */
  versionOs: string | null;
  disque: { total: number; utilise: number } | null;
  /** Retentions ESTIMEES par le controleur, en jours. Nulles s'il ne les donne pas. */
  retentionHaute: number | null;
  retentionBasse: number | null;
  /** Octets ecrits par jour, par qualite. */
  parJourHaute: number | null;
  parJourBasse: number | null;
  /** Cameras par classe de definition — les badges HD / 2K / 4K de Protect. */
  parDefinition: { hd: number; '2k': number; '4k': number } | null;
  /** Armement de PROTECT, distinct de celui d'Alcora. */
  armement: string | null;
  /** Allume depuis, en millisecondes. */
  depuis: number | null;
  etatDisque: string | null;
  enregistrementSuspendu: boolean;
  cameras: { total: number; enLigne: number };
  /** Bornes d'archive de chaque camera : la plus profonde fait foi pour la colonne. */
  archive: Archive[];
  alcora: string;
}

export interface DiscoveredCamera {
  id: string;
  name: string;
  model?: string;
  online: boolean;
  channels: DiscoveredChannel[];
  /** Absente si le controleur ne dit rien de son archive. */
  archive?: Archive | null;
}

export interface Credentials {
  host: string;
  username: string;
  password: string;
  totpSeed?: string;
}

export interface TestOutcome {
  ok: boolean;
  cameras: DiscoveredCamera[];
  /** Empreinte de cle publique relevee au premier appairage, a faire confirmer. */
  discoveredPin?: string;
  nvrName?: string;
  protectVersion?: string;
}

export interface RelayState {
  running: boolean;
  message: string;
  /** Ce que l'utilisateur peut faire. Le message seul ne suffit pas a debloquer. */
  remedy?: string;
  /** Vrai quand reessayer ne servira a rien : il faut corriger la configuration. */
  permanent?: boolean;
}

/** Connexion mise a l'abri avant une remise a zero. Ni mot de passe ni clé. */
export interface Sauvegarde {
  existe: boolean;
  /** Date ISO de la mise de côté, ou null. */
  date: string | null;
  /** Adresse du contrôleur concerné, pour que la reprise se reconnaisse. */
  host: string | null;
}

/**
 * Ou en est la sequence d'ouverture. Trois jalons ordonnes ; le relais et l'inventaire de
 * la page completent le tableau (voir l'ecran d'introduction).
 */
export interface Progression {
  etape: 'demarrage' | 'session' | 'inventaire';
}

/**
 * Une detection, telle que la page la recoit.
 *
 * Seuls les trois types de camera remontent — mouvement, zone intelligente, son. Les
 * evenements de console (armement, acces, activite administrative) sont ecartes cote
 * processus principal : ils n'apprennent rien sur ce qui s'est passe devant les cameras.
 */
export interface Detection {
  id: string;
  type: 'motion' | 'smartDetectZone' | 'smartAudioDetect' | string;
  camera: string | null;
  cameraNom: string | null;
  /** Millisecondes. */
  debut: number | null;
  /** Nul quand la detection est ENCORE EN COURS. */
  fin: number | null;
  /** person, vehicle, animal, face, licensePlate, alrmBark, alrmSpeak… */
  sujets: string[];
  score: number | null;
  vignette: boolean;
}

export interface ExtraitProgres {
  jeton: string;
  etat: 'demande' | 'obtention' | 'pret';
  pourcent: number;
}

export interface ProtectBridge {
  isConfigured(): Promise<boolean>;
  /** Lance le diagnostic. Chaque etape est remontee au fil de l'eau. */
  testConnection(credentials: Credentials, onStep: (r: StepResult) => void): Promise<TestOutcome>;
  /** Enregistre la configuration. `keepSignedIn` decide si les secrets sont conserves. */
  save(credentials: Credentials, keepSignedIn: boolean): Promise<void>;
  getCameras(): Promise<DiscoveredCamera[]>;
  /** Etat du controleur pour la colonne laterale. */
  systeme(): Promise<SystemeEtat>;
  /** Ou vont les captures, et le son du direct. */
  confort(): Promise<Confort>;
  confortEnregistrer(c: Confort): Promise<Confort>;
  /** Ouvre le selecteur de dossier. Rend le reglage tel qu'il est apres coup. */
  choisirDossierCaptures(): Promise<Confort>;
  ouvrirCaptures(): Promise<void>;
  /** Ecrit une capture prise dans la page. Rend le chemin du fichier. */
  capturer(nom: string, octets: ArrayBuffer): Promise<string>;
  /**
   * Recherche fine. Le filtre par sujet part au controleur, le reste s'applique ici.
   * Aucun texte reconnu ne revient : seuls des objets anonymes.
   */
  recherche(criteres: CriteresRecherche): Promise<ResultatRecherche>;
  /** Configuration des veilles. */
  veilles(): Promise<ConfigVeilles>;
  /** Enregistre et rend ce qui a ete retenu. */
  veillesEnregistrer(v: ConfigVeilles): Promise<ConfigVeilles>;
  /**
   * Detections par sujet et par JOUR, sur les sept derniers jours.
   * C'est ce que Protect ne dit nulle part : cocher une case sans savoir qu'elle vaut 157
   * bulles par jour, c'est choisir a l'aveugle. Nul si le controleur n'est pas joignable.
   */
  volumes(): Promise<Record<string, number> | null>;
  /** Detections en direct, pour que la liste vive sans rechargement. */
  onDetectionVive(handler: (d: DetectionVive) => void): () => void;
  /** L'utilisateur a clique une bulle : ouvrir cette sequence. */
  onOuvrirDetection(handler: (d: DetectionVive) => void): () => void;
  onRelayState(handler: (s: RelayState) => void): () => void;
  relayBase(): Promise<string>;
  /** Bascule la FENETRE en plein ecran. Renvoie l'etat obtenu. */
  pleinEcran(actif: boolean): Promise<boolean>;
  /** Retente la connexion au controleur sans redemarrer l'application. */
  retry(): Promise<void>;
  /** Met la connexion de cote, l'efface, et ramene a l'ecran de connexion. */
  reconfigure(): Promise<void>;
  /** Connexion mise de cote par une remise a zero, s'il y en a une. Jamais de secret. */
  sauvegarde(): Promise<Sauvegarde>;
  /** Repose la connexion mise de cote. Faux si elle n'existe plus. */
  restaurer(): Promise<boolean>;
  /** Chemin du journal, a montrer quand il faut le reclamer a distance. */
  journalPath(): Promise<string>;
  /** Ce qu'il faut pouvoir citer au telephone. Jamais de secret. */
  infos(): Promise<Infos>;
  /** Ouvre le dossier des donnees dans l'explorateur. */
  ouvrirJournal(): Promise<void>;
  /** Ouvre le guide d'activation du RTSP, embarque dans l'application. */
  ouvrirGuide(): Promise<boolean>;
  /** Etat courant des sous-systemes, a tirer au montage de la page. */
  etats(): Promise<{
    relais: RelayState;
    maj: MajState;
    progression: Progression;
    /** La fenetre peut rouvrir en plein ecran (etat memorise) : la page doit le savoir. */
    fenetre?: { pleinEcran: boolean };
  }>;
  /**
   * Detections, de la plus recente a la plus ancienne.
   * `avant` recule la borne haute pour obtenir la page suivante.
   */
  evenements(p?: { avant?: number; jours?: number; limite?: number }): Promise<Detection[]>;
  /**
   * Obtient l'extrait video d'une detection et rend l'adresse locale a lire.
   * L'attente est reelle mais breve : le controleur produit a ~77x le temps reel.
   */
  extraire(p: { camera: string; debut: number; fin: number | null }):
    Promise<{ url: string; octets: number; marge: number }>;
  /**
   * Obtient la video autour d'un INSTANT, pour la frise. Le morceau rendu est aligne sur
   * une grille absolue : `debut` n'est donc pas l'instant demandé, et la page doit se
   * positionner elle-meme a `(instant - debut) / 1000` secondes dans la sequence.
   */
  sequence(p: {
    camera: string;
    /** Instant vise. Le morceau rendu est alors ALIGNE sur une grille : `debut` n'est donc
     *  pas cet instant, et la page se positionne elle-meme a `(instant - debut) / 1000`. */
    instant?: number;
    /** Enchainement : le morceau commence EXACTEMENT ici, sans passer par la grille. */
    depuis?: number;
    duree?: number;
  }): Promise<{ url: string; debut: number; fin: number; octets: number }>;
  /** Progression de l'obtention, poussee par le processus principal. */
  onExtraitProgres(handler: (e: ExtraitProgres) => void): () => void;
  /** Propose d'enregistrer l'extrait ailleurs. Faux si l'utilisateur renonce. */
  enregistrerExtrait(p: { jeton: string; nom: string }):
    Promise<{ enregistre: boolean; chemin?: string }>;
  /** Demarrage avec Windows. `disponible` est faux hors application installee. */
  autoDemarrage(): Promise<{ actif: boolean; disponible: boolean }>;
  autoDemarrageChanger(actif: boolean): Promise<{ actif: boolean; disponible: boolean }>;
  /** Jalons de la sequence d'ouverture, pousses par le processus principal. */
  onProgression(handler: (p: Progression) => void): () => void;
  /** Etat des mises a jour automatiques, pousse par le processus principal. */
  onMajState(handler: (s: MajState) => void): () => void;
  /** Langue courante : le choix ('fr' | 'en' | 'auto') et la langue effective. */
  langue(): Promise<Langue>;
  /** Change le choix. Le processus principal le grave et rend la langue effective. */
  langueChanger(choix: CodeLangue | 'auto'): Promise<Langue>;
  /**
   * Nouveautes a presenter apres une mise a jour, ou null s'il n'y a rien a dire.
   * Nul a la premiere installation : l'ecran n'existe que pour les mises a jour.
   */
  nouveautes(): Promise<Nouveautes | null>;
  /** L'utilisateur les a vues : ne plus les presenter. */
  nouveautesVues(): Promise<void>;
  /** Force une verification immediate. */
  majVerifier(): Promise<void>;
  /** Applique la version prete : l'application se ferme et se relance a jour. */
  majRedemarrer(): Promise<boolean>;
}

export interface MajState {
  /** « manuelle » : la plateforme n'a pas de chaine automatique (Linux) — on le DIT
   *  plutot que de laisser croire a une verification qui n'aura jamais lieu. */
  etat: 'aucune' | 'verification' | 'telechargement' | 'controle' | 'application' | 'prete'
      | 'erreur' | 'manuelle';
  version?: string;
  pourcent?: number;
  message?: string;
  /** Vrai tant que la sequence de lancement occupe l'ecran. */
  demarrage?: boolean;
}

export interface Infos {
  version: string;
  journal: string;
  donnees: string;
  host: string | null;
  username: string | null;
  /** Vrai si l'empreinte du controleur est memorisee. Sa valeur n'est jamais exposee. */
  appaire: boolean;
}

declare global {
  interface Window {
    protect?: ProtectBridge;
  }
}

/* ---- Veilles (Lot 8) ---------------------------------------------------- */

/** Une plage hebdomadaire. `jours` : 0 = dimanche. Une plage peut franchir minuit. */
export interface PlageHoraire {
  jours: number[];
  /** « HH:MM ». Debut egal a fin signifie la journee entiere. */
  debut: string;
  fin: string;
}

/** Horaire nomme, repris de Protect : leur « Nuit » dit mieux les choses qu'un interrupteur. */
export interface ProfilVeille {
  id: string;
  nom: string;
  plages: PlageHoraire[];
}

export interface Veille {
  id: string;
  nom: string;
  actif: boolean;
  /** person, vehicle, animal, package, verre, fumee, sirene, co, aboiement, parole, bebe, motion */
  sujets: string[];
  /** Vide = toutes les cameras. C'est le cas courant, et il survit a l'ajout d'une camera. */
  cameras: string[];
  quand: 'toujours' | 'armee' | 'horaire';
  /** Profils retenus quand `quand` vaut « armee ». Vide = tous. */
  profils: string[];
  /** Horaire propre a cette veille, quand `quand` vaut « horaire ». */
  plages?: PlageHoraire[];
  son: boolean;
  /** Au plus une bulle par sujet sur cette duree. */
  retenueMs: number;
}

export interface ConfigVeilles {
  /** L'interrupteur d'Alcora — distinct de celui de Protect, et assume comme tel. */
  armee: boolean;
  profils: ProfilVeille[];
  veilles: Veille[];
}

/** Une detection telle qu'elle arrive en direct, sans attendre un rechargement. */
export interface DetectionVive {
  id: string | null;
  /** Vrai au COMMENCEMENT. La fin ne doit jamais alerter une seconde fois. */
  commence: boolean;
  type: string;
  camera: string | null;
  cameraNom: string | null;
  debut: number | null;
  fin: number | null;
  sujets: string[];
  score: number | null;
}

/** La langue : ce que l'utilisateur a choisi, et ce qui en resulte.
 *  La liste des codes vit dans le registre (i18n/index.ts, LANGUES). */
export interface Langue {
  choix: CodeLangue | 'auto';
  effective: CodeLangue;
}

/** L'ecart entre la version que l'utilisateur a VUE et celle qui tourne. */
export interface Nouveautes {
  de: string;
  a: string;
}

/** Reglages de confort. Le son reste eteint par defaut : un mur d'images qui se met a
 *  parler au lancement serait insupportable. */
export interface Confort {
  dossierCaptures: string;
  sonParDefaut: boolean;
}

/* ---- Recherche fine ------------------------------------------------------ */

/** Un attribut et la confiance qui lui est propre — souvent tres differente de celle de l'objet. */
export interface Attribut {
  valeur: string;
  confiance: number | null;
}

/**
 * Un OBJET detecte, et non un evenement.
 *
 * Mesure du 29.07.2026 : 1405 objets pour 1242 detections. Une meme detection peut porter
 * deux voitures et un pieton ; les fondre en une ligne en perdrait deux.
 */
export interface ObjetDetecte {
  /** Identifiant de l'EVENEMENT, pour ouvrir la sequence. */
  id: string | null;
  objectId: string;
  camera: string | null;
  cameraNom: string | null;
  debut: number | null;
  /** person, vehicle, animal, face, licensePlate, alrmSpeak… */
  type: string;
  /** Confiance de l'OBJET. Nulle pour les sujets sonores, qui n'en ont pas. */
  confiance: number | null;
  vehicule: Attribut | null;
  couleur: Attribut | null;
  /**
   * Une plaque ou un nom a ete reconnu. Le TEXTE ne traverse jamais le pont : il reste dans
   * le processus principal, et c'est lui qui compare lors d'une recherche.
   */
  identifie: boolean;
  vignette: boolean;
}

/** Ce qui existe REELLEMENT, pour peupler les filtres sans jamais proposer un choix vide. */
export interface Recensement {
  sujets: { valeur: string; n: number }[];
  types: { valeur: string; n: number }[];
  couleurs: { valeur: string; n: number }[];
}

export interface CriteresRecherche {
  depuis?: number;
  jusqua?: number;
  /** Part au CONTROLEUR : c'est le seul filtre qu'il honore. */
  sujets?: string[];
  /** Calcules ici : le controleur ignore « minScore ». */
  seuil?: number;
  types?: string[];
  couleurs?: string[];
  cameras?: string[];
  /** Plaque ou nom. Compare cote principal, sur des textes que la page ne voit pas. */
  texte?: string;
}

export interface ResultatRecherche {
  objets: ObjetDetecte[];
  total: number;
  tronque: boolean;
  recensement: Recensement;
  fenetre: { debut: number; fin: number };
}
