import { langueCourante } from './i18n';

/**
 * Historique des versions, affiche dans les reglages et dans « Ce qui a change ».
 *
 * Tenu a la main, volontairement : une liste engendree a partir des commits raconterait
 * le travail plutot que ce qui change pour la personne devant l'ecran. On decrit donc ce
 * qu'elle constate, pas ce qui a ete modifie dans le code.
 *
 * REECRIT le 02.08.2026 pour l'ouverture publique. Les notes
 * d'origine s'adressaient a l'unique utilisateur et parlaient de SON poste — son disque,
 * ses cameras, ses mesures. Un historique public ne raconte personne : les series de
 * correctifs sont regroupees sous leur derniere version, et chaque note decrit
 * l'application, jamais une machine. L'histoire detaillee, elle, vit dans les commits.
 *
 * CHAQUE version porte ses deux langues, cote a cote : une note ajoutee sans sa
 * traduction se voit au premier coup d'oeil — et test-contrat.js le verifie, note
 * pour note.
 *
 * A completer AVANT chaque construction, en meme temps que le numero dans
 * v2/desktop/package.json.
 */

export interface Version {
  version: string;
  /** Date de publication, au format JJ.MM.AAAA. */
  date: string;
  fr: string[];
  en: string[];
}

/** Les changements d'une version, dans la langue courante de l'interface.
 *  L'historique n'existe qu'en francais et en anglais — les autres langues lisent
 *  l'anglais. Le traduire en quatre langues a chaque version serait le point exact
 *  ou la discipline lacherait. */
export function changementsDe(v: Version): string[] {
  return langueCourante() === 'fr' ? v.fr : v.en;
}

export const VERSIONS: Version[] = [
  {
    version: '2.29.1',
    date: '26.08.2026',
    fr: [
      'Configurer Alcora sur un contrôleur récent ne se termine plus par une erreur. La '
      + 'vérification ouvrait une session puis la jetait, et l’enregistrement se reconnectait '
      + 'deux fois de plus en quelques secondes — un rythme que certains contrôleurs refusent. '
      + 'L’application ne se connecte plus qu’une fois.',
      'Quand un contrôleur refuse une reconnexion trop rapprochée, il le dit maintenant, et '
      + 'indique combien de temps attendre. Il annonçait jusqu’ici que le compte n’avait pas '
      + 'les droits nécessaires, ce qui envoyait chercher au mauvais endroit.',
      'Un échec pendant « Enregistrer et démarrer » est désormais consigné dans le journal de '
      + 'diagnostic. Il n’y laissait aucune trace.',
      'Le moteur d’affichage de l’application a été remplacé par une version beaucoup plus '
      + 'récente, ce qui referme trente-trois failles connues. C’est aussi ce qui rend cette '
      + 'mise à jour inhabituellement longue à télécharger : presque tous les fichiers ont '
      + 'changé. Les suivantes redeviendront légères.',
    ],
    en: [
      'Setting Alcora up against a recent controller no longer ends in an error. The check '
      + 'opened a session then threw it away, and saving signed in twice more within seconds — '
      + 'a pace some controllers refuse. The application now signs in only once.',
      'When a controller refuses a sign-in that comes too soon after the previous one, it now '
      + 'says so, and how long to wait. Until now it announced that the account lacked the '
      + 'necessary rights, which sent you looking in the wrong place.',
      'A failure during “Save and start” is now recorded in the diagnostic log. It used to '
      + 'leave no trace at all.',
      'The application’s rendering engine has been replaced with a far more recent one, closing '
      + 'thirty-three known vulnerabilities. It is also what makes this update unusually long to '
      + 'download: nearly every file changed. Later ones will be light again.',
    ],
  },
  {
    version: '2.29.0',
    date: '08.08.2026',
    fr: [
      'Le guide est désormais POSÉ dans l’écran de connexion, à la place du rappel des '
      + 'préparatifs : on le voit en arrivant, et un bouton l’agrandit sur place. Il '
      + 'n’ouvre plus de seconde fenêtre — l’application n’a qu’une page.',
    ],
    en: [
      'The guide now SITS in the sign-in screen, in place of the list of things to prepare: '
      + 'you see it on arrival, and a button enlarges it in place. It no longer opens a '
      + 'second window — the application has a single page.',
    ],
  },
  {
    version: '2.28.0',
    date: '08.08.2026',
    fr: [
      'Un guide animé montre, étape par étape, comment ouvrir le flux d’une caméra sur la '
      + 'console. Il est embarqué dans l’application : il s’affiche même sans accès à '
      + 'Internet, ce qui est bien le minimum quand rien ne fonctionne encore.',
    ],
    en: [
      'An animated guide shows, step by step, how to open a camera’s stream on the console. '
      + 'It is bundled inside the application: it shows even without Internet access, which '
      + 'is the least one can ask when nothing works yet.',
    ],
  },
  {
    version: '2.27.0',
    date: '08.08.2026',
    fr: [
      'Une caméra dont le RTSP n’est pas activé le DIT, et dit quoi faire : elle affichait ' +
      '« aucun flux » sans un mot de plus, ce qui ressemblait à une panne alors qu’il ' +
      'manque un interrupteur sur la console. L’écran de connexion rappelle désormais les ' +
      'deux préparatifs à faire côté Protect.',
      'L’identifiant du flux d’une caméra ne quitte plus le cœur de l’application : il vaut ' +
      'mot de passe, l’écran n’en a aucun usage, et il lui était pourtant transmis.',
    ],
    en: [
      'A camera whose RTSP is not enabled now SAYS so, and says what to do: it used to show ' +
      '“no stream” and nothing more, which looked like a failure when a switch is simply ' +
      'missing on the console. The sign-in screen now recalls the two things to prepare on ' +
      'the Protect side.',
      'A camera’s stream identifier no longer leaves the core of the application: it is ' +
      'worth a password, the screen has no use for it, and it was being handed over anyway.',
    ],
  },
  {
    version: '2.26.0',
    date: '08.08.2026',
    fr: [
      'L’application bouge : les écrans se posent au lieu de surgir, les îlots et les ' +
      'vignettes arrivent l’un après l’autre, et un repère glisse le long de la bande ' +
      'd’icônes jusqu’à l’espace choisi — c’est lui qui relie deux pages plutôt que de ' +
      'les couper.',
      'Les fenêtres qui s’ouvrent en douceur repartent de même : le lecteur d’extrait et ' +
      '« Ce qui a changé » s’effacent au lieu de disparaître d’un coup.',
      'Rien de tout cela ne retarde une information, et si Windows demande de réduire les ' +
      'animations, tout est simplement là, sans mouvement.',
    ],
    en: [
      'The application moves: screens settle instead of appearing abruptly, islands and ' +
      'thumbnails arrive one after another, and a marker slides along the icon bar to the ' +
      'chosen space — it is what links two pages rather than cutting between them.',
      'Windows that open gently now leave the same way: the clip player and « What has ' +
      'changed » fade out instead of vanishing at once.',
      'None of this delays any information, and if Windows asks for reduced motion, ' +
      'everything is simply there, without movement.',
    ],
  },
  {
    version: '2.25.0',
    date: '08.08.2026',
    fr: [
      'Alcora existe pour Linux : une archive à déplier, qui embarque son relais vidéo. ' +
      'Sur cette plateforme la mise à jour est manuelle — l’application le dit plutôt ' +
      'que de laisser croire à une surveillance qui n’existe pas, et le démarrage ' +
      'automatique s’y déclare indisponible pour la même raison.',
      'L’écran de connexion rejoint le ciel : le planétarium l’accompagne dès la ' +
      'première image, et ses sections deviennent des îlots de verre comme le reste ' +
      'de l’application.',
      'La fenêtre « Ce qui a changé » passe elle aussi au verre.',
    ],
    en: [
      'Alcora now exists for Linux: an archive to unpack, carrying its own video relay. ' +
      'On that platform updating is manual — the application says so rather than ' +
      'implying a watch that does not exist, and start-with-the-system declares itself ' +
      'unavailable there for the same reason.',
      'The sign-in screen joins the sky: the planetarium is there from the very first ' +
      'image, and its sections become glass islands like the rest of the application.',
      'The « What has changed » window turns to glass as well.',
    ],
  },
  {
    version: '2.24.0',
    date: '04.08.2026',
    fr: [
      'Tous les écrans flottent désormais sur le ciel : Réglages, Détections, ' +
      'Relecture et Alertes quittent leurs fonds pleins pour des îlots de verre — ' +
      'le même verre que le panneau, la même ombre que les images du direct. ' +
      'Rien ne disparaît : chaque filtre, chaque compte, chaque graduation reste ' +
      'à sa place.',
      'L’image de la relecture flotte comme une tuile du direct, le transport et ' +
      'la frise deviennent des bandeaux de verre détachés, et les vignettes de ' +
      'résultats se soulèvent au passage de la souris.',
    ],
    en: [
      'Every screen now floats above the sky: Settings, Detections, Playback and ' +
      'Alerts leave their solid backgrounds for glass islands — the same glass as ' +
      'the panel, the same shadow as the live tiles. Nothing goes away: every ' +
      'filter, every count, every tick mark stays in place.',
      'The playback image floats like a live tile, the transport and the timeline ' +
      'become detached glass strips, and result thumbnails lift as the mouse ' +
      'passes over them.',
    ],
  },
  {
    version: '2.23.2',
    date: '03.08.2026',
    fr: [
      'La rétention annoncée s’affiche arrondie au jour : le contrôleur envoie un ' +
      'nombre à quatorze décimales, qui débordait et tronquait son étiquette.',
    ],
    en: [
      'The announced retention is now rounded to the day: the controller sends a ' +
      'number with fourteen decimals, which overflowed and truncated its label.',
    ],
  },
  {
    version: '2.23.1',
    date: '03.08.2026',
    fr: [
      'Le texte du panneau passe à une palette lumineuse, avec une fine ombre qui le ' +
      'détache des vidéos claires : les tons calibrés pour des cartes opaques se ' +
      'noyaient dans une image de jour vue à travers le verre. Le verre, lui, ne ' +
      'change pas.',
    ],
    en: [
      'The panel text moves to a luminous palette, with a thin shadow that lifts it ' +
      'off bright videos: tones calibrated for opaque cards drowned in a daylight ' +
      'image seen through the glass. The glass itself does not change.',
    ],
  },
  {
    version: '2.23.0',
    date: '03.08.2026',
    fr: [
      'Le Planétarium : un ciel vivant derrière les images — étoiles qui tournent ' +
      'comme le vrai ciel (un tour par heure), scintillements, étoiles filantes, ' +
      'voiles de nébuleuse, la Grande Ourse au pouls d’or, un satellite qui passe. ' +
      'Un réglage d’apparence l’éteint ; il se fige si Windows réduit les animations.',
      'Le verre du panneau montre enfin ce qui passe derrière lui : flou affiné, ' +
      'voile presque nul. Les images du direct flottent sur le ciel, portées par ' +
      'une ombre profonde.',
    ],
    en: [
      'The Planetarium: a living sky behind the images — stars turning like the real ' +
      'sky (one revolution per hour), twinkles, shooting stars, nebula veils, the Big ' +
      'Dipper with its golden pulse, a passing satellite. An appearance setting turns ' +
      'it off; it freezes if Windows reduces motion.',
      'The panel’s glass finally shows what passes behind it: refined blur, near-zero ' +
      'veil. Live images float on the sky, carried by a deep shadow.',
    ],
  },
  {
    version: '2.22.0',
    date: '03.08.2026',
    fr: [
      'Alcora parle désormais quatre langues : l’allemand et l’italien rejoignent le ' +
      'français et l’anglais, partout — écrans, notifications, messages de connexion. ' +
      'Le réglage « Automatique » suit la langue de Windows.',
      'Ajouter une langue est devenu un travail de traduction pure : l’architecture est ' +
      'documentée pour qui veut contribuer la sienne (docs/i18n.md).',
    ],
    en: [
      'Alcora now speaks four languages: German and Italian join French and English, ' +
      'everywhere — screens, notifications, connection messages. The “Automatic” ' +
      'setting follows the Windows language.',
      'Adding a language is now pure translation work: the architecture is documented ' +
      'for whoever wants to contribute theirs (docs/i18n.md).',
    ],
  },
  {
    version: '2.21.6',
    date: '03.08.2026',
    fr: [
      'Le journal de diagnostic passe à l’anglais — la langue des rapports de défaut ' +
      'd’un projet ouvert. L’interface, elle, continue de parler la langue choisie ; ' +
      'ceci clôt le chantier des deux langues.',
    ],
    en: [
      'The diagnostic log switches to English — the language of bug reports in an open ' +
      'project. The interface keeps speaking the chosen language; this closes the ' +
      'two-language effort.',
    ],
  },
  {
    version: '2.21.5',
    date: '03.08.2026',
    fr: [
      'L’historique des versions et les messages du contrôleur parlent les deux ' +
      'langues : notes de version, étapes du test de connexion, messages du flux ' +
      'vidéo, erreurs expliquées et notifications Windows suivent la langue choisie.',
    ],
    en: [
      'The version history and the controller messages speak both languages: release ' +
      'notes, connection test steps, video stream messages, explained errors and ' +
      'Windows notifications follow the chosen language.',
    ],
  },
  {
    version: '2.21.4',
    date: '02.08.2026',
    fr: [
      'Toute l’interface parle désormais les deux langues : les détections et leurs ' +
      'filtres, les alertes et leurs horaires, et l’écran d’introduction rejoignent la ' +
      'traduction. Restent l’historique des versions et les messages de connexion, qui ' +
      'suivront.',
    ],
    en: [
      'The whole interface now speaks both languages: detections and their filters, ' +
      'alerts and their schedules, and the introduction screen join the translation. ' +
      'The version history and the connection messages remain, and will follow.',
    ],
  },
  {
    version: '2.21.3',
    date: '02.08.2026',
    fr: [
      'La relecture et le lecteur de séquences parlent les deux langues : frise, filtres, ' +
      'vignettes, commandes de transport et messages d’extraction suivent la langue ' +
      'choisie, tout comme l’étiquette de qualité (HAUTE/HIGH) des tuiles.',
    ],
    en: [
      'Replay and the sequence player speak both languages: timeline, filters, ' +
      'thumbnails, transport controls and extraction messages follow the chosen ' +
      'language, as does the quality label (HAUTE/HIGH) on the tiles.',
    ],
  },
  {
    version: '2.21.2',
    date: '02.08.2026',
    fr: [
      'Le direct parle les deux langues : le panneau latéral — état, caméras, détections ' +
      'récentes, enregistrements, unités et dates comprises —, les tuiles et le halo ' +
      'd’activité suivent désormais la langue choisie.',
    ],
    en: [
      'Live view speaks both languages: the side panel — status, cameras, recent ' +
      'detections, recordings, units and dates included —, the tiles and the activity ' +
      'halo now follow the chosen language.',
    ],
  },
  {
    version: '2.21.1',
    date: '02.08.2026',
    fr: [
      'La traduction anglaise s’étend : les réglages entiers et l’écran de connexion ' +
      'parlent désormais les deux langues.',
    ],
    en: [
      'The English translation grows: the entire settings and the sign-in screen now ' +
      'speak both languages.',
    ],
  },
  {
    version: '2.21.0',
    date: '02.08.2026',
    fr: [
      'Alcora commence à parler anglais : l’interface suit la langue de Windows, et un ' +
      'réglage permet de choisir explicitement le français ou l’anglais. La traduction ' +
      'couvre d’abord la navigation, les commandes vidéo et cette fenêtre — le reste ' +
      'suit dans les prochaines versions.',
    ],
    en: [
      'Alcora starts speaking English: the interface follows the Windows language, and ' +
      'a setting allows choosing French or English explicitly. The translation first ' +
      'covers navigation, video controls and this window — the rest follows in the ' +
      'next versions.',
    ],
  },
  {
    version: '2.20.2',
    date: '02.08.2026',
    fr: [
      'Le projet emménage dans son propre foyer : l’organisation GitHub alcora-ch porte ' +
      'désormais les versions, et alcora.ch devient son adresse. Les installations ' +
      'existantes suivent toutes seules, rien à faire.',
    ],
    en: [
      'The project moves into its own home: the alcora-ch GitHub organization now ' +
      'carries the releases, and alcora.ch becomes its address. Existing installations ' +
      'follow on their own, nothing to do.',
    ],
  },
  {
    version: '2.20.1',
    date: '02.08.2026',
    fr: [
      'L’historique des versions est réécrit pour l’ouverture publique du projet : les ' +
      'séries de correctifs sont regroupées, et les notes décrivent l’application plutôt ' +
      'que le poste de son premier utilisateur.',
    ],
    en: [
      'The version history is rewritten for the public opening of the project: series ' +
      'of fixes are grouped together, and the notes describe the application rather ' +
      'than its first user’s machine.',
    ],
  },
  {
    version: '2.20.0',
    date: '02.08.2026',
    fr: [
      'Le clavier prend sa place : les chiffres 1 à 9 isolent une caméra (0 ramène la ' +
      'mosaïque), + et − zooment — sur la caméra isolée comme en relecture — et, en ' +
      'relecture, espace lit ou met en pause, les flèches sautent de dix secondes.',
      'Un œil dans la liste des caméras masque une image de la mosaïque. On cache une ' +
      'image, pas une caméra : ses alertes et sa relecture continuent, et la dernière ' +
      'caméra visible ne peut pas être masquée.',
    ],
    en: [
      'The keyboard takes its place: digits 1 to 9 isolate a camera (0 brings the ' +
      'mosaic back), + and − zoom — on the isolated camera as in replay — and, in ' +
      'replay, space plays or pauses, the arrows jump ten seconds.',
      'An eye in the camera list hides an image from the mosaic. You hide an image, ' +
      'not a camera: its alerts and its replay continue, and the last visible camera ' +
      'cannot be hidden.',
    ],
  },
  {
    version: '2.19.0',
    date: '02.08.2026',
    fr: [
      'Après une mise à jour, Alcora dit ce qui a changé : une fenêtre présente les ' +
      'nouveautés arrivées depuis la dernière version vue. Elle ne paraît qu’une fois, ' +
      'jamais à la première installation, et revient si on la ferme sans la lire.',
    ],
    en: [
      'After an update, Alcora says what changed: a window presents what arrived since ' +
      'the last version seen. It appears only once, never on first installation, and ' +
      'comes back if closed without being read.',
    ],
  },
  {
    version: '2.18.2',
    date: '02.08.2026',
    fr: [
      'La caméra où il se passe quelque chose s’entoure d’un trait lumineux qui parcourt ' +
      'son cadre tant que l’activité dure, avec une étiquette qui dit ce qui est détecté.',
      'Le zoom, le son et la capture d’image sont disponibles partout où il y a une ' +
      'vidéo : direct, relecture, séquence d’une détection. Le zoom recadre dans les ' +
      'pixels réels de la source et signale quand il commence à interpoler.',
      'Le déplacement dans une image zoomée est fiabilisé, quelle que soit la vitesse ' +
      'du geste, vidéo en lecture comme en pause.',
    ],
    en: [
      'The camera where something is happening gets a luminous stroke running along ' +
      'its frame for as long as the activity lasts, with a label saying what is detected.',
      'Zoom, sound and still capture are available wherever there is video: live, ' +
      'replay, a detection’s sequence. The zoom crops into the real pixels of the ' +
      'source and says when it starts interpolating.',
      'Panning in a zoomed image is made reliable, whatever the speed of the gesture, ' +
      'with the video playing or paused.',
    ],
  },
  {
    version: '2.17.5',
    date: '31.07.2026',
    fr: [
      'La mise à jour automatique au démarrage est fiabilisée en profondeur : le paquet ' +
      'est vérifié pendant son téléchargement, les anciens paquets ne s’accumulent plus, ' +
      'et un fichier momentanément illisible n’est plus confondu avec un fichier corrompu.',
      'Le panneau d’état dit désormais tout ce que le contrôleur sait : armement de ' +
      'Protect, état du disque en clair, version d’UniFi OS, volume écrit par jour, ' +
      'répartition des caméras par définition.',
      'Le journal de diagnostic explique pourquoi une information manque, et pas ' +
      'seulement qu’elle manque.',
    ],
    en: [
      'The automatic update at startup is deeply hardened: the package is verified ' +
      'while it downloads, old packages no longer pile up, and a momentarily unreadable ' +
      'file is no longer mistaken for a corrupted one.',
      'The status panel now says everything the controller knows: Protect arming, disk ' +
      'state in plain words, UniFi OS version, volume written per day, camera breakdown ' +
      'by definition.',
      'The diagnostic log explains why a piece of information is missing, not only ' +
      'that it is missing.',
    ],
  },
  {
    version: '2.16.0',
    date: '30.07.2026',
    fr: [
      'Le panneau de gauche devient vivant : les détections s’y affichent au moment où ' +
      'elles arrivent — sujet, caméra, image, âge — et cliquer une ligne ouvre la ' +
      'séquence. Il porte aussi la profondeur réelle des enregistrements, la part en ' +
      'pleine définition, le remplissage du disque et l’activité heure par heure.',
      'L’espace Détections s’ouvre directement sur la Recherche, qui remplace l’ancien ' +
      'journal.',
      'Une détection encore en cours n’a pas d’image chez le contrôleur : le panneau ' +
      'montre alors la vue de la caméra à cet instant, puis la vraie image dès que possible.',
    ],
    en: [
      'The left panel comes alive: detections appear the moment they arrive — subject, ' +
      'camera, image, age — and clicking a line opens the sequence. It also carries the ' +
      'real recording depth, the full-definition share, disk usage and hour-by-hour ' +
      'activity.',
      'The Detections space opens directly on Search, which replaces the old journal.',
      'A detection still in progress has no image on the controller: the panel then ' +
      'shows the camera’s view at that moment, then the real image as soon as possible.',
    ],
  },
  {
    version: '2.15.0',
    date: '29.07.2026',
    fr: [
      'La Recherche : retrouver une détection par sujet, type de véhicule, couleur, ' +
      'caméra ou plaque. Les filtres ne proposent que ce qui est réellement passé devant ' +
      'les caméras, avec le nombre en regard — jamais une liste de cases vides.',
      'La recherche de plaque est tolérante : le contrôleur propose plusieurs lectures ' +
      'd’une même plaque, et les derniers chiffres suffisent à retrouver un véhicule.',
      'Les plaques et les noms reconnus ne quittent jamais l’application.',
    ],
    en: [
      'Search: find a detection by subject, vehicle type, color, camera or plate. The ' +
      'filters only offer what actually passed in front of the cameras, with the count ' +
      'alongside — never a list of empty checkboxes.',
      'Plate search is tolerant: the controller suggests several readings of the same ' +
      'plate, and the last digits are enough to find a vehicle.',
      'Recognized plates and names never leave the application.',
    ],
  },
  {
    version: '2.14.3',
    date: '29.07.2026',
    fr: [
      'Chaque caméra du direct porte quatre commandes dans son bandeau de titre, ' +
      'visibles en permanence : revoir cette caméra, ses détections, prendre une ' +
      'capture, activer le son.',
      'Le son du flux en direct — désactivé par défaut, une caméra à la fois, et le ' +
      'bouton dit franchement quand un flux ne porte pas de piste audio.',
      'Les captures d’écran s’enregistrent en pleine définition, dans un dossier réglable.',
    ],
    en: [
      'Each live camera carries four controls in its title strip, permanently visible: ' +
      'replay this camera, its detections, take a capture, enable sound.',
      'Live stream sound — off by default, one camera at a time, and the button says ' +
      'frankly when a stream carries no audio track.',
      'Still captures are saved at full definition, in a configurable folder.',
    ],
  },
  {
    version: '2.13.0',
    date: '29.07.2026',
    fr: [
      'Les veilles : vos propres règles d’alerte, indépendantes de celles de Protect — ' +
      'par sujet, par caméra, par horaire, avec ou sans son. Les notifications Windows ' +
      'arrivent par une liaison temps réel permanente avec le contrôleur, sans passer ' +
      'par aucun nuage.',
      'La prévision de volume accompagne chaque règle : combien de notifications par ' +
      'jour ce choix aurait produit, mesuré sur votre propre archive.',
    ],
    en: [
      'Watches: your own alert rules, independent from Protect’s — by subject, by ' +
      'camera, by schedule, with or without sound. Windows notifications arrive over a ' +
      'permanent real-time link with the controller, without going through any cloud.',
      'A volume forecast accompanies each rule: how many notifications per day that ' +
      'choice would have produced, measured on your own archive.',
    ],
  },
  {
    version: '2.12.0',
    date: '29.07.2026',
    fr: [
      'La relecture s’étend à la journée entière : une frise temporelle zoomable couvre ' +
      'toute la profondeur de l’archive, détections en repères colorés, navigation un ' +
      'jour à la fois, lecture continue sans coupure.',
      'La frise annonce la frontière au-delà de laquelle le contrôleur ne conserve ' +
      'plus la pleine définition.',
    ],
    en: [
      'Replay extends to the whole day: a zoomable timeline covers the full depth of ' +
      'the archive, detections as colored markers, navigation one day at a time, ' +
      'continuous playback without cuts.',
      'The timeline announces the boundary beyond which the controller no longer ' +
      'keeps full definition.',
    ],
  },
  {
    version: '2.8.0',
    date: '28.07.2026',
    fr: [
      'Cliquer une détection ouvre sa séquence vidéo : lecture, pause, image par image, ' +
      'vitesses de 0,25× à 2×, enregistrement de l’extrait sur le disque.',
      'Un échec de décodage se dit en toutes lettres au lieu d’un rectangle noir.',
    ],
    en: [
      'Clicking a detection opens its video sequence: play, pause, frame by frame, ' +
      'speeds from 0.25× to 2×, saving the clip to disk.',
      'A decoding failure is said in plain words instead of a black rectangle.',
    ],
  },
  {
    version: '2.7.0',
    date: '28.07.2026',
    fr: [
      'Le journal des détections : la liste de ce qui s’est passé, regroupée par jour, ' +
      'filtrable par sujet et par caméra, avec les vignettes du contrôleur.',
    ],
    en: [
      'The detection journal: the list of what happened, grouped by day, filterable by ' +
      'subject and by camera, with the controller’s thumbnails.',
    ],
  },
  {
    version: '2.6.0',
    date: '28.07.2026',
    fr: [
      'Le direct se répare seul : gel détecté et flux relancé, reconnexion après une ' +
      'coupure de réseau ou une mise en veille, sans jamais demander un geste.',
      'Ni l’introduction ni la mise à jour ne se sautent : aucune version périmée ne ' +
      'doit tourner.',
    ],
    en: [
      'Live view repairs itself: freezes are detected and streams restarted, ' +
      'reconnection after a network cut or sleep, without ever asking for a gesture.',
      'Neither the introduction nor the update can be skipped: no outdated version ' +
      'should ever run.',
    ],
  },
  {
    version: '2.4.0',
    date: '28.07.2026',
    fr: [
      'La fenêtre se rouvre exactement où elle était, écran par écran, et Alcora peut ' +
      's’ouvrir avec Windows.',
      'L’identité dans la barre des tâches est stable à travers les mises à jour.',
    ],
    en: [
      'The window reopens exactly where it was, screen by screen, and Alcora can open ' +
      'with Windows.',
      'The taskbar identity is stable across updates.',
    ],
  },
  {
    version: '2.3.0',
    date: '28.07.2026',
    fr: [
      'L’introduction : la Grande Ourse se dessine aux positions réelles des étoiles ' +
      'pendant que l’application se connecte, puis le ciel devient la marque — Mizar et ' +
      'Alcor, l’étoile-test de l’acuité visuelle.',
    ],
    en: [
      'The introduction: the Big Dipper draws itself at the stars’ real positions ' +
      'while the application connects, then the sky becomes the brand — Mizar and ' +
      'Alcor, the eyesight test star.',
    ],
  },
  {
    version: '2.2.0',
    date: '28.07.2026',
    fr: [
      'Les fondations : le mur du direct multi-caméras avec zoom dans les pixels réels, ' +
      'la connexion sécurisée au contrôleur — identité épinglée, codes à deux facteurs ' +
      'générés localement, identifiants chiffrés par Windows — et la mise à jour ' +
      'automatique, vérifiée par empreinte avant toute application.',
    ],
    en: [
      'The foundations: the multi-camera live wall with zoom into real pixels, the ' +
      'secure connection to the controller — pinned identity, two-factor codes ' +
      'generated locally, credentials encrypted by Windows — and the automatic update, ' +
      'fingerprint-verified before being applied.',
    ],
  },
];
