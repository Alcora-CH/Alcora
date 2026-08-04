import type { Cle } from './fr';

/**
 * La traduction anglaise.
 *
 * Le type `Record<Cle, string>` EST le contrat : une cle du francais absente ici, ou une
 * cle inventee ici, arrete la compilation — donc `npm test`. Aucune traduction ne peut
 * etre oubliee en silence.
 *
 * Le ton suit celui du francais : sobre, factuel, sans point d'exclamation.
 */
export const en: Record<Cle, string> = {
  'espace.direct': 'Live',
  'espace.detections': 'Detections',
  'espace.relecture': 'Replay',
  'espace.alertes': 'Alerts',
  'espace.reglages': 'Settings',
  'espace.prochainLot': 'This space arrives in an upcoming release.',

  'canal.haute': 'HIGH',
  'canal.moyenne': 'MEDIUM',
  'canal.basse': 'LOW',
  'canal.colis': 'PACKAGE',

  'video.revenirImage': 'Back to the full image ({zoom}×)',
  'video.couperSon': 'Mute',
  'video.activerSon': 'Enable sound',
  'video.pasDeSon': 'This stream carries no audio',
  'video.capturer': 'Save a still image',
  'video.pleinEcran': 'Full screen',
  'video.quitterPleinEcran': 'Exit full screen',
  'video.interpole': 'interpolated',
  'video.pause': 'Pause',
  'video.lecture': 'Play',
  'video.imagePrecedente': 'Previous frame',
  'video.imageSuivante': 'Next frame',
  'video.sequenceIllisible': 'This sequence cannot be played here.',
  'video.imageIndisponible': 'Image unavailable',
  'video.imageEnregistree': 'Image saved: {chemin}',

  'nouveautes.titre': 'Alcora has been updated',
  'nouveautes.depuis': 'What changed since version {version}',
  'nouveautes.compris': 'Got it',

  'commun.ouvrirDossier': 'Open the folder',
  'commun.horsLigne': 'offline',
  'commun.aucunFlux': 'no stream',
  'commun.fermer': 'Close',
  'commun.fermerEchap': 'Close (Esc)',
  'commun.toutes': 'All',

  'unite.j': 'd',
  'unite.mois': 'mo',
  'unite.to': 'TB',
  'unite.go': 'GB',

  'sujet.person': 'Person',
  'sujet.vehicle': 'Vehicle',
  'sujet.animal': 'Animal',
  'sujet.face': 'Face',
  'sujet.licensePlate': 'Plate',
  'sujet.alrmSpeak': 'Speech',
  'sujet.alrmBark': 'Barking',
  'sujet.alrmCarHorn': 'Car horn',
  'sujet.alrmSmoke': 'Smoke',
  'sujet.alrmGlassBreak': 'Glass break',
  'sujet.motion': 'Motion',
  'sujet.sonDetecte': 'Sound detected',
  'sujet.son': 'Sound',
  'sujet.package': 'Package',
  'sujet.sirene': 'Siren',
  'sujet.monoxyde': 'Monoxide',
  'sujet.pleurs': 'Crying',

  'vehicule.suv': 'SUV',
  'vehicule.car': 'Car',
  'vehicule.van': 'Van',
  'vehicule.truck': 'Truck',
  'vehicule.motorcycle': 'Motorcycle',
  'vehicule.bike': 'Bicycle',
  'vehicule.bus': 'Bus',

  'reglages.titre': 'Settings',
  'reglages.sousTitre': 'Installed version, controller connection, and where to find the log.',

  'reglages.version.titre': 'Version',
  'reglages.version.verification': 'Checking…',
  'reglages.version.telechargement': 'Downloading {version}… {pourcent} %',
  'reglages.version.prete': 'Version {version} is ready: restart to apply it.',
  'reglages.version.erreur': 'The update check did not go through. It will retry on its own.',
  'reglages.version.repos':
    'The application checks for new versions on its own, downloads them silently, ' +
    'then offers to restart.',
  'reglages.version.verifier': 'Check now',

  'reglages.langue.titre': 'Language',
  'reglages.langue.detail':
    'Interface and notifications. “Automatic” follows the Windows language.',
  'reglages.langue.auto': 'Automatic',

  'reglages.apparence.titre': 'Appearance',
  'reglages.apparence.espacement': 'Spacing between views',
  'reglages.apparence.aucun': 'none',
  'reglages.apparence.detail':
    'At “none”, the images touch each other, frameless — a single wall of images.',
  'reglages.apparence.fond': 'Animated background',
  'reglages.apparence.fondDetail':
    'The planetarium behind the images: stars, shooting stars, nebulae. It freezes ' +
    'on its own if Windows asks for reduced motion.',

  'reglages.demarrage.titre': 'Startup',
  'reglages.demarrage.ouvrir': 'Open Alcora with Windows',
  'reglages.demarrage.indisponible': 'Unavailable outside the installed application.',
  'reglages.demarrage.detail': 'The application launches as soon as you sign in to Windows.',

  'reglages.confort.titre': 'Captures and sound',
  'reglages.confort.dossier': 'Where captures go',
  'reglages.confort.changer': 'Change',
  'reglages.confort.son': 'Sound on from the start',
  'reglages.confort.sonDetail':
    'Off by default: a wall of images that starts talking on its own at launch quickly ' +
    'becomes unbearable. Sound is enabled camera by camera, below the image.',

  'reglages.historique.titre': 'What changed',
  'reglages.historique.installee': 'installed',

  'reglages.connexion.titre': 'Connection',
  'reglages.connexion.controleur': 'Controller',
  'reglages.connexion.compte': 'Account',
  'reglages.connexion.identite': 'Identity verified',
  'reglages.connexion.oui': 'yes',
  'reglages.connexion.non': 'no',
  'reglages.connexion.modifier': 'Change the connection',
  'reglages.connexion.avertissement':
    'The password and the two-factor key will be erased from this PC, and the sign-in ' +
    'screen will come back. The cameras will stop displaying until you enter them again.',
  'reglages.connexion.effacer': 'Erase and re-enter',
  'reglages.connexion.annuler': 'Cancel',

  'reglages.probleme.titre': 'If something goes wrong',
  'reglages.probleme.detail':
    'Everything the application does is written to a file. That file is what to send ' +
    'when something does not work.',

  'setup.titre': 'Connecting to the controller',
  'setup.sousTitre':
    'The application queries your controller to discover the cameras. ' +
    'Nothing is sent anywhere else.',
  'setup.demo': 'Demonstration mode: no real connection is made.',

  'setup.etape.reseau': 'Reach the controller',
  'setup.etape.certificat': 'Verify its identity',
  'setup.etape.identifiants': 'Authenticate',
  'setup.etape.inventaire': 'Read the cameras',
  'setup.etape.flux': 'Check the streams',

  'setup.reprise.conservee': 'A previous connection is kept on this PC',
  'setup.reprise.detail': 'You can resume it without typing anything again.',
  'setup.reprise.bouton': 'Resume this connection',
  'setup.reprise.encours': 'Resuming…',
  'setup.reprise.echec': 'The resume did not go through. Enter the credentials below.',

  'setup.adresse.label': 'Controller address',
  'setup.adresse.hint': 'The IP address of your UDM, Cloud Key or UNVR.',

  'setup.compte.titre': 'Account',
  'setup.compte.identifiant': 'Username',
  'setup.compte.identifiantHint':
    'Use an account dedicated to this application, with limited rights.',
  'setup.compte.motDePasse': 'Password',
  'setup.compte.masquerMdp': 'Hide the password',
  'setup.compte.afficherMdp': 'Show the password',
  'setup.compte.cle': 'Two-factor authentication key',
  'setup.compte.clePlaceholder': 'leave empty if the account has none',
  'setup.compte.masquerCle': 'Hide the key',
  'setup.compte.afficherCle': 'Show the key',

  'setup.aide.question': 'Where to find this key?',
  'setup.aide.p1':
    'On your Ubiquiti account management site, when adding an authenticator application, ' +
    'choose “manual entry” instead of scanning the code: the key is then shown in full.',
  'setup.aide.p2':
    'Keep this same key enrolled on your phone. If this application became its only ' +
    'holder, losing this PC would lock you out of your account.',

  'setup.verification.titre': 'Verification',
  'setup.verification.lent': 'This is taking longer than expected…',
  'setup.verification.detailTechnique': 'Technical detail',
  'setup.verification.echecTest': 'The test could not run to completion.',

  'setup.cameras.titre': 'Cameras found',

  'setup.rester.titre': 'Stay signed in',
  'setup.rester.p1':
    'To reconnect on its own after a restart, the application keeps on this PC your ' +
    'password and the key that produces the one-time codes, encrypted by Windows for ' +
    'your Windows account only.',
  'setup.rester.p2':
    'Concretely: someone who signed in under your Windows account could connect to the ' +
    'controller without having your phone. Your account remains protected, however, ' +
    'against someone who would only know your password.',
  'setup.rester.case': 'Stay signed in on this PC',

  'setup.actions.tester': 'Test the connection',
  'setup.actions.enregistrer': 'Save and start',
  'setup.actions.echecEnregistrement': 'Saving did not go through.',

  'colonne.controleur': 'Controller',
  'colonne.heure': 'Time',
  'colonne.arme': 'armed',
  'colonne.desarme': 'disarmed',
  'colonne.alarmesInactives': 'alarms not set up',
  'colonne.detectionsRecentes': 'Recent detections',
  'colonne.detection': 'Detection',
  'colonne.aujourdhui': 'Today',
  'colonne.nonLu': 'not read',
  'colonne.enregistrements': 'Recordings',
  'colonne.suspendu':
    'Recording is suspended on the controller. Nothing new is being kept.',
  'colonne.plusAncien': 'Oldest',
  'colonne.profondeur': 'Depth',
  'colonne.pleineDefinition': 'Full definition',
  'colonne.pleineDefAnnoncee': 'Full def. announced',
  'colonne.retentionAnnoncee': 'Announced retention',
  'colonne.etatDisque': 'Disk state',
  'colonne.disqueNonHomologue': 'not certified',
  'colonne.disqueNonHomologueDetail':
    'The disk is not on Ubiquiti’s list. It records normally; only their support ' +
    'reserves a right of refusal.',
  'colonne.ecritParJour': 'Written per day',
  'colonne.disque': 'Disk',
  'colonne.rotation': 'Automatic rotation. A full disk is normal.',
  'colonne.versions': 'Versions',
  'colonne.disponible': 'Available',
  'colonne.allumeDepuis': 'Up for',
  'colonne.aucuneImage': 'No image ever leaves your network.',

  'app.titrePanneau': 'Surveillance',
  'app.etat': 'Status',
  'app.reessayer': 'Retry',
  'app.cameras': 'Cameras',
  'app.aucuneCamera': 'No cameras yet.',
  'app.afficherCamera': 'Show {nom}',
  'app.masquerCamera': 'Hide {nom}',
  'app.derniereCamera': 'The last visible camera cannot be hidden',
  'app.reafficher': 'Show in the mosaic again',
  'app.masquerMosaique': 'Hide from the mosaic',
  'app.reduirePanneau': 'Collapse the panel',
  'app.epinglerPanneau': 'Pin the panel',
  'app.pleinEcranF11': 'Full screen (F11)',
  'app.versionPrete': 'Version {version} ready.',
  'app.redemarrerMaintenant': 'Restart now',
  'app.plusTard': 'Later',
  'app.echapRevenir': 'Esc to go back',
  'app.afficherPanneau': 'Show the panel',
  'app.quitterPleinEcranEchap': 'Exit full screen (Esc)',
  'app.quitter': 'Exit',
  'app.revenirMosaique': 'Double-click to return to the mosaic',
  'app.glisserIsoler': 'Drag to reorganize · double-click to isolate',
  'app.pontTitre': 'The application did not start correctly.',
  'app.pontDetail1':
    'The internal link was not established. Close and reopen the application; ' +
    'if it happens again, send the file',
  'app.pontDetail2': 'found in the folder',

  'relecture.hier': 'Yesterday',
  'relecture.aucuneCamera': 'No camera.',
  'relecture.revenirDirect': 'Back to live',
  'relecture.revenirDirectTitre': 'Back to the live image',
  'relecture.jourPrecedent': 'Previous day',
  'relecture.jourSuivant': 'Next day',
  'relecture.jourARelire': 'Day to replay',
  'relecture.inviteDirect': 'Click the timeline or a thumbnail to go back in time',
  'relecture.inviteSansRelais':
    'Click the timeline or a thumbnail to see what was happening at that moment.',
  'relecture.definitionReduite': 'reduced definition',
  'relecture.extraction': 'Extracting…',
  'relecture.filtre.tout': 'All',
  'relecture.filtre.personnes': 'People',
  'relecture.filtre.vehicules': 'Vehicles',
  'relecture.filtre.animaux': 'Animals',
  'relecture.filtre.sons': 'Sounds',
  'relecture.detectionUne': 'detection',
  'relecture.detectionPlusieurs': 'detections',
  'relecture.rienDetecte': 'Nothing detected that day.',
  'relecture.journeeEntiere': 'whole day',
  'relecture.revoirJournee': 'View the whole day again',
  'relecture.toutVoir': 'see all',
  'relecture.molette': 'scroll to zoom',
  'relecture.cliquerPourVoir': 'click to view',

  'extrait.cameraInconnue': 'unknown camera',
  'extrait.enregistrer': 'Save',
  'extrait.enregistrerExtrait': 'Save the clip',
  'extrait.extraction': 'Extracting the sequence…',
  'extrait.formatIndecodable':
    'The clip was obtained, but its video format cannot be decoded by the application. ' +
    'Save it to open it with another player.',
  'extrait.position': 'Position in the sequence',
  'extrait.enregistre': 'Saved:',

  'recherche.chercher': 'Search',
  'recherche.placeholder': 'plate, or name…',
  'recherche.chercherAria': 'Search for a plate or a name',
  'recherche.tolerante1':
    'Tolerant search: the controller returns several possible readings of the same ' +
    'plate. Typing',
  'recherche.tolerante2': 'will also find',
  'recherche.tolerante3': ', and the last digits are enough.',
  'recherche.sujet': 'Subject',
  'recherche.confiance': 'Minimum confidence',
  'recherche.confianceDetail':
    'Applies only to visual subjects. Sound detections carry no score — filtering ' +
    'them by confidence would remove them all.',
  'recherche.typeVehicule': 'Vehicle type',
  'recherche.couleur': 'Color',
  'recherche.camera': 'Camera',
  'recherche.periode': 'Period',
  'recherche.periode7': '7 days',
  'recherche.periode30': '30 days',
  'recherche.enCours': 'searching…',
  'recherche.objetUn': 'object',
  'recherche.objetPlusieurs': 'objects',
  'recherche.tronque': 'showing the 300 most recent — narrow down to see everything',
  'recherche.filtrageNote': 'subject filtered by the controller, the rest here',
  'recherche.rien': 'Nothing matches.',
  'recherche.rienSeuil': 'The minimum confidence may be too high.',
  'recherche.rienTexte': 'Try fewer characters — the last digits are enough.',
  'recherche.identifie': 'A plate or a name was recognized',

  'veilles.jours': 'Sun Mon Tue Wed Thu Fri Sat',
  'veilles.quand.toujours': 'Always',
  'veilles.quand.toujoursAide': 'even disarmed, at any hour',
  'veilles.quand.armee': 'When the watch is active',
  'veilles.quand.armeeAide': 'follows the switch and its schedule',
  'veilles.quand.horaire': 'On my own schedule',
  'veilles.quand.horaireAide': 'independent of the switch',
  'veilles.presqueJamais': 'almost never',
  'veilles.parJour': '~{n} per day',
  'veilles.lectureEchouee': 'The watches could not be read.',
  'veilles.activer': 'Enable the watch',
  'veilles.desactiver': 'Disable the watch',
  'veilles.active': 'Watch active',
  'veilles.desactivee': 'Watch disabled',
  'veilles.profil': 'profile {nom}',
  'veilles.enregistre': 'saved',
  'veilles.independant':
    'This switch is Alcora’s, independent of Protect’s arming. The two can differ: ' +
    'Alcora will notify on this PC even if Protect stays silent.',
  'veilles.activerCourt': 'Enable',
  'veilles.desactiverCourt': 'Disable',
  'veilles.toutesCameras': 'all cameras',
  'veilles.volumesIndisponibles':
    'The volumes of the last seven days could not be read: estimates will stay empty ' +
    'while the controller is unreachable.',
  'veilles.declenche': 'What triggers',
  'veilles.surCameras': 'On which cameras',
  'veilles.quandTitre': 'When',
  'veilles.selonHoraire': 'On which schedule',
  'veilles.enPermanence': 'At all times',
  'veilles.ceQueCaFait': 'What it does',
  'veilles.son': 'Sound',
  'veilles.retenue': 'at most one bubble every',
  'veilles.retenueDetail':
    'Someone staying in the frame produces a detection every fifteen seconds. Without ' +
    'this hold-back, as many bubbles.',

  'ciel.etape.maj': 'Check for updates',
  'ciel.etape.session': 'Open the session',
  'ciel.etape.cameras': 'Read the cameras',
  'ciel.etape.flux': 'Start the video stream',
  'ciel.etape.relier': 'Link the cameras',
  'ciel.telechargement': 'Downloading version {version}…',
  'ciel.controle': 'Verifying the package…',
  'ciel.installation': 'Installing…',
  'ciel.empreinte': 'SHA-256 fingerprint',
  'ciel.vaRedemarrer': 'the application will restart',
  'ciel.rechercheMaj': 'checking for an update…',
  'ciel.fluxPret': 'video stream ready',
  'ciel.connexion': 'connecting to the controller',
  'ciel.versLa': 'to version {version}',
  'ciel.redemarreSeule': 'The application restarts on its own, then opens up to date.',

  'etape.nonVerifie': 'Not checked.',
  'etape.contact': 'Contacting the controller…',
  'etape.verifIdentite': 'Verifying its identity…',
  'etape.connexionEnCours': 'Connecting…',
  'etape.repond': '{host} answers on port 443.',
  'etape.premierAppairage': 'First pairing: the identity was recorded.',
  'etape.connexionAcceptee': 'Connection accepted. Session valid for {jours} days.',
  'etape.lectureCameras': 'Reading the cameras…',
  'etape.camerasTrouvees': '{n} camera(s) found on {nvr} (Protect {version}).',
  'etape.verifFlux': 'Checking the streams…',
  'etape.diffusables': '{n} camera(s) streamable on port {port}.',
  'erreur.nomNonResolu': 'The name “{host}” could not be resolved.',
  'erreur.nomNonResoluRemede': 'Enter the controller’s IP address directly.',
  'erreur.identifiants': 'Username or password refused.',
  'erreur.identifiantsRemede': 'Check the account’s e-mail address and its password.',
  'erreur.totpRefuse': 'The two-factor code was refused.',
  'erreur.totpVerifieCle': 'Check the key entered: it must come from the enrollment screen.',
  'relais.pret': 'Video stream ready.',

  'tuile.capturee': 'saved: {nom}',
  'tuile.captureImpossible': 'capture failed',
  'tuile.fluxIndisponible': 'Stream unavailable',
  'tuile.connexion': 'Connecting…',
  'tuile.revoir': 'Replay this camera',
  'tuile.detections': 'Its detections',
  'tuile.ecouter': 'Listen to this camera',
};
