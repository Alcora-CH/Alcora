/**
 * Le dictionnaire francais — LA SOURCE DE VERITE de l'internationalisation.
 *
 * Plat, volontairement : des cles en pointille (`espace.direct`), jamais d'imbrication.
 * C'est ce qui rend le fichier lisible en diff, cherchable au grep, et comparable
 * textuellement si un outil en a un jour besoin.
 *
 * LE CONTRAT EST TENU PAR LE COMPILATEUR, pas par un test de plus : `en.ts` est type
 * `Record<Cle, string>` — une cle manquante ou une cle en trop dans la traduction est une
 * erreur de compilation, et `npm test` (tsc -b) rougit. C'est le meme esprit que le test
 * du pont IPC, au prix de zero ligne de test.
 *
 * `{nom}` marque un parametre, remplace par t() a l'execution.
 */

export const fr = {
  // ---- les espaces, et la coquille de l'application
  'espace.direct': 'Direct',
  'espace.detections': 'Détections',
  'espace.relecture': 'Relecture',
  'espace.alertes': 'Alertes',
  'espace.reglages': 'Réglages',
  'espace.prochainLot': 'Cet espace arrive dans un prochain lot.',

  // ---- les canaux d'une camera, tels que Protect les hierarchise
  'canal.haute': 'Haute',
  'canal.moyenne': 'Moyenne',
  'canal.basse': 'Basse',
  'canal.colis': 'Colis',

  // ---- les commandes d'une vue video, partagees par les trois ecrans
  'video.revenirImage': 'Revenir à l’image entière ({zoom}×)',
  'video.couperSon': 'Couper le son',
  'video.activerSon': 'Activer le son',
  'video.pasDeSon': 'Ce flux ne porte pas de son',
  'video.capturer': 'Enregistrer une image',
  'video.pleinEcran': 'Plein écran',
  'video.interpole': 'interpolé',
  'video.pause': 'Pause',
  'video.lecture': 'Lecture',
  'video.imagePrecedente': 'Image précédente',
  'video.imageSuivante': 'Image suivante',
  'video.sequenceIllisible': 'Cette séquence ne peut pas être lue ici.',
  'video.imageIndisponible': 'Image indisponible',
  'video.imageEnregistree': 'Image enregistrée : {chemin}',

  // ---- « Ce qui a change »

  // ---- partage entre ecrans
  'commun.ouvrirDossier': 'Ouvrir le dossier',
  'commun.horsLigne': 'hors ligne',
  'commun.aucunFlux': 'aucun flux',
  'camera.rtspDesactive': 'RTSP désactivé',
  'camera.guide': 'Voir le guide, étape par étape',
  'camera.rtspRemede':
    'Cette caméra ne diffuse pas : active le RTSP dans Protect, sur la caméra, '
    + 'section Avancé. Alcora la reprendra toute seule.',
  'commun.fermer': 'Fermer',
  'commun.fermerEchap': 'Fermer (Échap)',
  'commun.toutes': 'Toutes',

  // ---- unites qui different d'une langue a l'autre (jour, mois, octets)
  'unite.j': 'j',
  'unite.mois': 'mois',
  'unite.to': 'To',
  'unite.go': 'Go',

  // ---- les sujets de detection, tels que Protect les nomme
  'sujet.person': 'Personne',
  'sujet.vehicle': 'Véhicule',
  'sujet.animal': 'Animal',
  'sujet.face': 'Visage',
  'sujet.licensePlate': 'Plaque',
  'sujet.alrmSpeak': 'Parole',
  'sujet.alrmBark': 'Aboiement',
  'sujet.alrmCarHorn': 'Klaxon',
  'sujet.alrmSmoke': 'Fumée',
  'sujet.alrmGlassBreak': 'Bris de verre',
  'sujet.motion': 'Mouvement',
  'sujet.sonDetecte': 'Son détecté',
  'sujet.son': 'Son',
  'sujet.package': 'Colis',
  'sujet.sirene': 'Sirène',
  'sujet.monoxyde': 'Monoxyde',
  'sujet.pleurs': 'Pleurs',

  // ---- les types de vehicules, tels que Protect les classe
  'vehicule.suv': 'SUV',
  'vehicule.car': 'Voiture',
  'vehicule.van': 'Fourgon',
  'vehicule.truck': 'Camion',
  'vehicule.motorcycle': 'Moto',
  'vehicule.bike': 'Vélo',
  'vehicule.bus': 'Bus',

  // ---- reglages
  'reglages.titre': 'Réglages',
  'reglages.sousTitre': 'Version installée, connexion au contrôleur, et où trouver le journal.',

  'reglages.version.titre': 'Version',
  'reglages.version.verifier': 'Vérifier',

  // Les NOMS des langues (Français, English, Deutsch…) ne sont pas ici : chacun
  // s'ecrit dans sa propre langue, toujours — ils vivent dans le registre (index.ts).
  'reglages.langue.titre': 'Langue',
  'reglages.langue.auto': 'Automatique',

  'reglages.apparence.titre': 'Apparence',
  'reglages.apparence.espacement': 'Espacement',
  'reglages.apparence.aucun': 'aucun',
  'reglages.apparence.fond': 'Ciel animé',
  'reglages.apparence.fondDetail':
    'Fait vivre le ciel derrière les images : il tourne, des étoiles filent, les nébuleuses ' +
    'dérivent. Éteint, le ciel reste, immobile. Il se fige aussi de lui-même si Windows ' +
    'demande de réduire les animations.',

  'reglages.demarrage.titre': 'Démarrage',
  'reglages.demarrage.ouvrir': 'Lancer avec Windows',
  'reglages.demarrage.indisponible': 'Indisponible hors application installée.',

  'reglages.confort.titre': 'Captures et son',
  'reglages.confort.dossier': 'Captures',
  'reglages.confort.changer': 'Changer',
  'reglages.confort.son': 'Son au lancement',

  'reglages.historique.titre': 'Ce qui a changé',
  'reglages.historique.installee': 'installée',

  'reglages.connexion.titre': 'Connexion',
  'reglages.connexion.controleur': 'Contrôleur',
  'reglages.connexion.compte': 'Compte',
  'reglages.connexion.identite': 'Identité vérifiée',
  'reglages.connexion.oui': 'oui',
  'reglages.connexion.non': 'non',
  'reglages.connexion.modifier': 'Modifier la connexion',
  'reglages.connexion.avertissement': 'Mot de passe et clé seront effacés de ce PC.',
  'reglages.connexion.effacer': 'Effacer et ressaisir',
  'reglages.connexion.annuler': 'Annuler',

  'reglages.probleme.titre': 'En cas de problème',

  // ---- l'ecran de connexion
  'setup.titre': 'Connexion',
  'setup.sousTitre':
    'L’application interroge ton contrôleur pour découvrir les caméras. ' +
    'Rien n’est envoyé ailleurs.',
  'setup.demo': 'Mode démonstration : aucune connexion réelle n’est établie.',

  'setup.etape.reseau': 'Joindre le contrôleur',
  'setup.etape.certificat': 'Vérifier son identité',
  'setup.etape.identifiants': 'S’authentifier',
  'setup.etape.inventaire': 'Lire les caméras',
  'setup.etape.flux': 'Vérifier les flux',

  'setup.reprise.conservee': 'Connexion conservée',
  'setup.reprise.detail': 'Rien à ressaisir',
  'setup.reprise.bouton': 'Reprendre',
  'setup.reprise.encours': 'Reprise…',
  'setup.reprise.echec': 'La reprise n’a pas abouti. Saisis les identifiants ci-dessous.',

  'setup.adresse.label': 'Adresse',
  'setup.adresse.hint': 'IP de l’UDM, de la Cloud Key ou de l’UNVR',

  'setup.guide.agrandir': 'Agrandir',
  'setup.guide.reduire': 'Réduire',
  'setup.prealable.titre': 'À préparer sur la console',
  'setup.prealable.rtsp': 'Le RTSP activé sur chaque caméra',
  'setup.prealable.compte': 'Un compte dédié à Alcora, droits de visionnage',
  'setup.compte.titre': 'Compte',
  'setup.compte.identifiant': 'Identifiant',
  'setup.compte.identifiantHint': 'Un compte dédié, droits de visionnage',
  'setup.compte.motDePasse': 'Mot de passe',
  'setup.compte.masquerMdp': 'Masquer le mot de passe',
  'setup.compte.afficherMdp': 'Afficher le mot de passe',
  'setup.compte.cle': 'Clé à deux facteurs',
  'setup.compte.clePlaceholder': 'laisser vide si le compte n’en a pas',
  'setup.compte.masquerCle': 'Masquer la clé',
  'setup.compte.afficherCle': 'Afficher la clé',

  'setup.aide.question': 'Où trouver cette clé ?',
  'setup.aide.p1': 'Compte Ubiquiti → ajout d’une application d’authentification → « saisie manuelle » : la clé s’affiche en toutes lettres.',
  'setup.aide.p2': 'Garde-la aussi sur ton téléphone : ce PC ne doit pas en être le seul détenteur.',

  'setup.verification.titre': 'Vérification',
  'setup.verification.lent': 'C’est plus long que prévu…',
  'setup.verification.detailTechnique': 'Détail technique',
  'setup.verification.echecTest': 'Le test n’a pas pu être mené à son terme.',

  'setup.cameras.titre': 'Caméras trouvées',

  'setup.rester.titre': 'Rester connecté',
  'setup.rester.p1': 'Mot de passe et clé gardés sur ce PC, chiffrés par Windows',
  'setup.rester.p2': 'Ta session Windows suffira pour te connecter, sans ton téléphone',
  'setup.rester.case': 'Rester connecté sur ce PC',

  'setup.actions.tester': 'Tester',
  'setup.actions.enregistrer': 'Enregistrer',
  'setup.actions.echecEnregistrement': 'L’enregistrement n’a pas abouti.',

  // ---- la colonne d'etat
  'colonne.controleur': 'Contrôleur',
  'colonne.heure': 'Heure',
  'colonne.arme': 'armé',
  'colonne.desarme': 'désarmé',
  'colonne.alarmesInactives': 'alarmes inactives',
  'colonne.detection': 'Détection',
  'colonne.aujourdhui': 'Aujourd’hui',
  'colonne.nonLu': 'non lu',
  'colonne.enregistrements': 'Enregistrements',
  'colonne.suspendu':
    'Enregistrement suspendu sur le contrôleur. Rien de nouveau n’est conservé.',
  'colonne.plusAncien': 'Le plus ancien',
  'colonne.profondeur': 'Profondeur',
  'colonne.pleineDefinition': 'Pleine définition',
  'colonne.pleineDefAnnoncee': 'Pleine déf. annoncée',
  'colonne.retentionAnnoncee': 'Rétention annoncée',
  'colonne.etatDisque': 'État du disque',
  'colonne.disqueNonHomologue': 'non homologué',
  'colonne.disqueNonHomologueDetail':
    'Le disque ne figure pas sur la liste d’Ubiquiti. Il enregistre normalement ; ' +
    'seul leur support s’en réserve le droit de refus.',
  'colonne.ecritParJour': 'Écrit par jour',
  'colonne.disque': 'Disque',
  'colonne.rotation': 'Rotation automatique. Un disque plein est normal.',
  'colonne.versions': 'Versions',
  'colonne.disponible': 'Disponible',
  'colonne.allumeDepuis': 'Allumé depuis',
  'colonne.aucuneImage': 'Aucune image ne quitte ton réseau.',

  // ---- la coquille du direct : panneau lateral, plein ecran, mosaique
  'app.reessayer': 'Réessayer',
  'app.aucuneCamera': 'Aucune caméra pour l’instant.',
  'app.derniereCamera': 'La dernière caméra visible ne se masque pas',
  'app.reafficher': 'Réafficher dans la mosaïque',
  'app.masquerMosaique': 'Masquer de la mosaïque',
  'app.pleinEcranF11': 'Plein écran (F11)',
  'app.versionPrete': 'Version {version} prête.',
  'app.redemarrerMaintenant': 'Redémarrer maintenant',
  'app.plusTard': 'Plus tard',
  'app.echapRevenir': 'Échap pour revenir',
  'app.quitterPleinEcranEchap': 'Quitter le plein écran (Échap)',
  'app.quitter': 'Quitter',
  'app.pontTitre': 'L’application n’a pas démarré correctement.',
  'app.pontDetail1':
    'La liaison interne ne s’est pas établie. Ferme puis rouvre l’application ; ' +
    'si cela se reproduit, envoie le fichier',
  'app.pontDetail2': 'dans le dossier',

  // ---- la relecture d'une journee
  'relecture.hier': 'Hier',
  'relecture.aucuneCamera': 'Aucune caméra.',
  'relecture.revenirDirect': 'Revenir au direct',
  'relecture.revenirDirectTitre': 'Revenir à l’image en direct',
  'relecture.jourPrecedent': 'Jour précédent',
  'relecture.jourSuivant': 'Jour suivant',
  'relecture.jourARelire': 'Jour à relire',
  'relecture.inviteDirect': 'Clique la frise ou une vignette pour remonter dans le temps',
  'relecture.inviteSansRelais':
    'Clique la frise ou une vignette pour voir ce qui se passait à cet instant.',
  'relecture.definitionReduite': 'définition réduite',
  'relecture.extraction': 'Extraction…',
  'relecture.filtre.tout': 'Tout',
  'relecture.filtre.personnes': 'Personnes',
  'relecture.filtre.vehicules': 'Véhicules',
  'relecture.filtre.animaux': 'Animaux',
  'relecture.filtre.sons': 'Sons',
  'relecture.detectionUne': 'détection',
  'relecture.detectionPlusieurs': 'détections',
  'relecture.rienDetecte': 'Rien de détecté ce jour-là.',
  'relecture.journeeEntiere': 'Journée entière',
  'relecture.revoirJournee': 'Revoir la journée entière',
  'relecture.toutVoir': 'Tout voir',
  'relecture.molette': 'Molette pour zoomer, clic pour voir',
  'relecture.cliquerPourVoir': 'cliquer pour voir',

  // ---- le lecteur d'un extrait
  'extrait.cameraInconnue': 'caméra inconnue',
  'extrait.enregistrer': 'Enregistrer',
  'extrait.enregistrerExtrait': 'Enregistrer l’extrait',
  'extrait.extraction': 'Extraction de la séquence…',
  'extrait.formatIndecodable':
    'L’extrait a bien été obtenu, mais son format vidéo n’est pas décodable par ' +
    'l’application. Enregistre-le pour l’ouvrir avec un autre lecteur.',
  'extrait.position': 'Position dans la séquence',
  'extrait.enregistre': 'Enregistré :',

  // ---- la recherche fine dans les detections
  'recherche.chercher': 'Chercher',
  'recherche.placeholder': 'Plaque, ou nom…',
  'recherche.chercherAria': 'Chercher une plaque ou un nom',
  'recherche.tolerante1':
    'Recherche tolérante : le contrôleur rend plusieurs lectures possibles d’une même ' +
    'plaque. Taper',
  'recherche.tolerante2': 'trouvera aussi',
  'recherche.tolerante3': ', et les derniers chiffres suffisent.',
  'recherche.sujet': 'Sujet',
  'recherche.confiance': 'Confiance minimale',
  'recherche.confianceDetail':
    'Ne s’applique qu’aux sujets visuels. Les détections sonores n’ont pas de score — ' +
    'les filtrer par confiance les supprimerait toutes.',
  'recherche.typeVehicule': 'Type de véhicule',
  'recherche.couleur': 'Couleur',
  'recherche.camera': 'Caméra',
  'recherche.periode': 'Période',
  'recherche.periode7': '7 jours',
  'recherche.periode30': '30 jours',
  'recherche.enCours': 'Recherche…',
  'recherche.objetUn': 'objet',
  'recherche.objetPlusieurs': 'objets',
  'recherche.tronque': 'Affichage limité aux 300 plus récents — affine pour tout voir',
  'recherche.filtrageNote': 'Sujet filtré par le contrôleur, le reste ici',
  'recherche.rien': 'Rien ne correspond.',
  'recherche.rienSeuil': 'La confiance minimale est peut-être trop haute.',
  'recherche.rienTexte': 'Essaie avec moins de caractères — les derniers chiffres suffisent.',
  'recherche.identifie': 'Une plaque ou un nom a été reconnu',

  // ---- les veilles
  'veilles.jours': 'Dim Lun Mar Mer Jeu Ven Sam',
  'veilles.quand.toujours': 'Toujours',
  'veilles.quand.toujoursAide': 'Même désarmé, à toute heure',
  'veilles.quand.armee': 'Quand la veille est active',
  'veilles.quand.armeeAide': 'Suit l’interrupteur et ses horaires',
  'veilles.quand.horaire': 'Sur un horaire à moi',
  'veilles.quand.horaireAide': 'Indépendant de l’interrupteur',
  'veilles.presqueJamais': 'presque jamais',
  'veilles.parJour': '~{n} par jour',
  'veilles.lectureEchouee': 'Les veilles n’ont pas pu être lues.',
  'veilles.active': 'Veille active',
  'veilles.desactivee': 'Veille désactivée',
  'veilles.profil': 'profil {nom}',
  'veilles.enregistre': 'Enregistré',
  'veilles.independant':
    'Cet interrupteur est celui d’Alcora, indépendant de l’armement de Protect. Les deux ' +
    'peuvent différer : Alcora préviendra sur ce PC même si Protect reste silencieux.',
  'veilles.activerCourt': 'Activer',
  'veilles.desactiverCourt': 'Désactiver',
  'veilles.toutesCameras': 'toutes les caméras',
  'veilles.volumesIndisponibles':
    'Les volumes des sept derniers jours n’ont pas pu être lus : les estimations ' +
    'resteront vides tant que le contrôleur n’est pas joignable.',
  'veilles.declenche': 'Ce qui déclenche',
  'veilles.surCameras': 'Sur quelles caméras',
  'veilles.quandTitre': 'Quand',
  'veilles.selonHoraire': 'Selon quel horaire',
  'veilles.enPermanence': 'En permanence',
  'veilles.ceQueCaFait': 'Ce que ça fait',
  'veilles.son': 'Son',
  'veilles.retenue': 'au plus une bulle toutes les',
  'veilles.retenueDetail':
    'Une personne qui reste dans le champ produit une détection toutes les quinze ' +
    'secondes. Sans cette retenue, autant de bulles.',

  // ---- l'introduction
  'ciel.etape.maj': 'Vérifier les mises à jour',
  'ciel.etape.session': 'Ouvrir la session',
  'ciel.etape.cameras': 'Lire les caméras',
  'ciel.etape.flux': 'Démarrer le flux vidéo',
  'ciel.etape.relier': 'Relier les caméras',
  'ciel.telechargement': 'Téléchargement de la version {version}…',
  'ciel.controle': 'Vérification du paquet…',
  'ciel.installation': 'Installation…',
  'ciel.empreinte': 'empreinte SHA-256',
  'ciel.vaRedemarrer': 'l’application va redémarrer',
  'ciel.rechercheMaj': 'recherche d’une mise à jour…',
  'ciel.fluxPret': 'flux vidéo prêt',
  'ciel.connexion': 'connexion au contrôleur',
  'ciel.versLa': 'vers la {version}',
  'ciel.redemarreSeule': 'L’application redémarre d’elle-même, puis s’ouvre à jour.',

  // ---- les mots du processus principal, repris par le mode demonstration
  // (la source de verite du vrai texte vit dans v2/desktop/i18n.js ; la demo
  //  simule le principal et doit parler exactement comme lui)
  'etape.nonVerifie': 'Non vérifié.',
  'etape.contact': 'Contact du contrôleur…',
  'etape.verifIdentite': 'Vérification de l’identité…',
  'etape.connexionEnCours': 'Connexion…',
  'etape.repond': '{host} répond sur le port 443.',
  'etape.premierAppairage': 'Premier appairage : l’identité a été relevée.',
  'etape.connexionAcceptee': 'Connexion acceptée. Session valable {jours} jours.',
  'etape.lectureCameras': 'Lecture des caméras…',
  'etape.camerasTrouvees': '{n} caméra(s) trouvée(s) sur {nvr} (Protect {version}).',
  'etape.verifFlux': 'Vérification des flux…',
  'etape.diffusables': '{n} caméra(s) diffusable(s) sur le port {port}.',
  'erreur.nomNonResolu': 'Le nom « {host} » n’a pas pu être résolu.',
  'erreur.nomNonResoluRemede': 'Saisis directement l’adresse IP du contrôleur.',
  'erreur.identifiants': 'Identifiant ou mot de passe refusé.',
  'erreur.identifiantsRemede': 'Vérifie l’adresse e-mail du compte et son mot de passe.',
  'erreur.totpRefuse': 'Le code à deux facteurs a été refusé.',
  'erreur.totpVerifieCle': 'Vérifie la clé saisie : elle doit venir de l’écran d’enrôlement.',
  'relais.pret': 'Flux vidéo prêt.',

  // ---- la tuile d'une camera
  'tuile.capturee': 'enregistrée : {nom}',
  'tuile.captureImpossible': 'capture impossible',
  'tuile.fluxIndisponible': 'Flux indisponible',
  'tuile.connexion': 'Connexion…',
  'tuile.revoir': 'Revoir cette caméra',
  'tuile.detections': 'Ses détections',
  'tuile.ecouter': 'Écouter cette caméra',

  // Page Systeme (direction Observatoire, 23.10.2026)
  'espace.systeme': 'Système',
  'systeme.precision': 'Le contrôleur, ses enregistrements et chaque caméra, vus d’Alcora',
  'systeme.journal': 'Journal de l’application',
  'systeme.journalTitre': 'Ouvrir le dossier du journal',
  'systeme.cameras': 'Caméras',
  'systeme.toutesEnLigne': '{n}, toutes en ligne',
  'systeme.dontHorsLigne': '{n}, dont {h} hors ligne',
  'systeme.colCamera': 'Caméra',
  'systeme.colEtat': 'État',
  'systeme.colFlux': 'Flux',
  'systeme.colArchive': 'Archive',
  'systeme.colDetection': 'Dernière détection',
  'systeme.colMosaique': 'Mosaïque',
  'systeme.enLigne': 'En ligne',
  'systeme.horsLigne': 'Hors ligne',
  'systeme.depuisLe': 'depuis le {date}',
  'systeme.pleineDef': 'pleine définition {duree}',
  'systeme.ilYa': 'il y a {duree}',
  'systeme.aucuneAujourdhui': 'aucune aujourd’hui',
  'systeme.inconnue': 'inconnue',
  'systeme.affichee': 'Affichée',
  'systeme.masquee': 'Masquée',
  'unite.ips': 'i/s',
  'unite.mbits': 'Mbit/s',

  // Barre d'etat et raccourcis clavier (direction Observatoire, 23.10.2026)
  'barre.archive': 'Archive',
  'barre.suspendu': 'Enregistrement suspendu',
  'barre.uneHorsLigne': '1 caméra hors ligne',
  'barre.horsLigne': '{n} caméras hors ligne',
  'barre.prive': 'Aucune image ne quitte ton réseau',
  'barre.raccourcis': 'Raccourcis',
  'barre.raccourcisTitre': 'Raccourcis clavier (?)',
  'raccourcis.titre': 'Raccourcis clavier',
  'raccourcis.sequence': 'Séquence d’une détection',
  'raccourcis.partout': 'Partout',
  'raccourcis.a': 'à',
  'raccourcis.isoler': 'Isoler la caméra correspondante',
  'raccourcis.mosaique': 'Revenir à la mosaïque',
  'raccourcis.doubleClic': 'Double-clic',
  'raccourcis.doubleClicFait': 'Isoler une image, ou revenir',
  'raccourcis.glisser': 'Glisser',
  'raccourcis.glisserFait': 'Réorganiser la mosaïque ; dans une image zoomée, s’y déplacer',
  'raccourcis.molette': 'Molette',
  'raccourcis.moletteFait': 'Zoomer dans l’image',
  'raccourcis.zoomIsolee': 'Zoomer ou dézoomer la caméra isolée',
  'raccourcis.echapDirect': 'Revenir à la mosaïque, puis quitter le plein écran',
  'raccourcis.lecture': 'Lecture ou pause',
  'raccourcis.dixSecondes': 'Reculer ou avancer de 10 s',
  'raccourcis.zoomer': 'Zoomer ou dézoomer',
  'raccourcis.clicFrise': 'Clic sur la frise',
  'raccourcis.clicFriseFait': 'Aller à cet instant',
  'raccourcis.moletteFrise': 'Molette sur la frise',
  'raccourcis.moletteFriseFait': 'Resserrer la journée, jusqu’à la minute',
  'raccourcis.imageParImage': 'Image par image',
  'raccourcis.afficher': 'Afficher ces raccourcis',
  'touche.espace': 'Espace',
  'touche.echap': 'Échap',

  // Direct, rail et colonne Activite (direction Observatoire, 23.10.2026)
  'rail.espaces': 'Espaces',
  'direct.une': '1 caméra',
  'direct.toutes': '{n} caméras',
  'direct.uneSur': '1 caméra sur {total} affichée',
  'direct.surTotal': '{n} caméras sur {total} affichées',
  'direct.isolee': '{nom}, seule à l’écran',
  'direct.indice': 'Glisser une image la déplace. Un double-clic, ou les touches 1 à 9, l’isolent.',
  'direct.indiceIsolee': 'Un double-clic, 0 ou Échap ramènent la mosaïque.',
  'activite.titre': 'Activité',
  'activite.masquer': 'Masquer l’activité',
  'activite.afficher': 'Afficher l’activité',
  'activite.recentes': 'Récentes',
  'activite.aucune': 'Aucune détection aujourd’hui.',
  'activite.toutes': 'Toutes les détections',

  // Bandeau des tuiles (direction Observatoire, 23.10.2026)
  'tuile.revoirCourt': 'Revoir',
  'tuile.detectionsCourt': 'Détections',
  'tuile.imageCourt': 'Image',
  'tuile.sonCourt': 'Son',
  'tuile.reprise': 'Reprise automatique dans {n} s',

  // Revue du groupe Direct (23.10.2026)
  'systeme.seuleEnLigne': '1, en ligne',
  'systeme.seuleHorsLigne': '1, hors ligne',

  // Liens d'une detection vers la relecture (23.10.2026)
  'activite.revoir': 'Revoir à cet instant',
  'extrait.voirRelecture': 'Voir dans la relecture',

  // Relecture (direction Observatoire, 23.10.2026)
  'video.imageEntiere': 'Image entière',
  'relecture.vitesse': 'Vitesse de lecture',

  // Detections (direction Observatoire, 23.10.2026) : couleurs nommees, en-tete, etats
  'couleur.gray': 'Gris',
  'couleur.white': 'Blanc',
  'couleur.black': 'Noir',
  'couleur.blue': 'Bleu',
  'couleur.yellow': 'Jaune',
  'couleur.red': 'Rouge',
  'couleur.green': 'Vert',
  'couleur.brown': 'Brun',
  'couleur.silver': 'Argent',
  'couleur.orange': 'Orange',
  'couleur.beige': 'Beige',
  'recherche.toutesCameras': 'Toutes les caméras',
  'recherche.nCameras': '{n} caméras',
  'recherche.retirerSeuil': 'Retirer la confiance minimale',
  'recherche.revoirCourt': 'Revoir',

  // Alertes (direction Observatoire, 23.10.2026)
  'veilles.precision': 'Ce qui mérite qu’Alcora te prévienne sur ce PC, et quand',

  // Reglages : sommaire, Aide, A propos (direction Observatoire, 23.10.2026)
  'reglages.sommaire': 'Sections',
  'reglages.aide.titre': 'Aide',
  'reglages.aide.voirRaccourcis': 'Voir',
  'reglages.aide.guide': 'Guide de la console',
  'reglages.aide.ouvrirGuide': 'Ouvrir',
  'reglages.apropos.titre': 'À propos',
  'reglages.apropos.licenceDetail': 'Le code source est public ; toute œuvre dérivée doit le rester.',
  'reglages.apropos.source': 'Code source',
  'reglages.apropos.voirLicences': 'Licences',
  'reglages.apropos.licencesAbsentes': 'Le fichier des licences est introuvable dans cette installation.',

  // Sequence d'une detection (direction Observatoire, 23.10.2026)
  'extrait.duree': 'Séquence de {n} s autour de la détection',

  // Revue des groupes 2 a 7 (23.10.2026)
  'veilles.interrupteur': 'Veille d’Alcora',

  // Mise a jour refusee, raison dite (23.10.2026)

  // Export d'une plage de la relecture (maquette docs/maquette-export-plage.html, 23.10.2026)
  'unite.mo': 'Mo',
  'export.debut': 'Début',
  'export.debutTitre': 'Début de la plage à exporter : l’instant lu (touche I)',
  'export.fin': 'Fin',
  'export.finTitre': 'Fin de la plage à exporter : l’instant lu (touche O)',
  'export.plage': 'Plage',
  'export.poseFin': 'Pose la fin à l’instant voulu : bouton « Fin » ou touche O.',
  'export.poseDebut': 'Pose le début à l’instant voulu : bouton « Début » ou touche I.',
  'export.effacer': 'Effacer',
  'export.exporter': 'Exporter…',
  'export.exporterParties': 'Exporter en {n} fichiers…',
  'export.environ': 'environ {taille}',
  'export.tailleInconnue': 'taille annoncée au début de l’export',
  'export.sonCompris': 'son compris',
  'export.sansSon': 'sans son',
  'export.imagesCles': 'À quelques secondes près : le contrôleur coupe sur les images-clés, la vidéo déborde donc un peu de chaque côté.',
  'export.parties': 'Plus d’une heure : {n} fichiers d’une heure au plus, l’un après l’autre.',
  'export.frontiere': 'Avant le {date}, seule la basse définition subsiste.',
  'export.finRamenee': 'Fin ramenée à {heure} : rien n’est encore enregistré après.',
  'export.export': 'Export',
  'export.progression': '{recu} sur {total}',
  'export.restant': 'encore {duree}',
  'export.fichierSur': 'fichier {i} sur {n}',
  'export.continuer': 'Tu peux continuer à relire, ou changer d’écran : l’export se poursuit, la barre d’état le suit.',
  'export.annuler': 'Annuler',
  'export.enregistree': 'Enregistrée',
  'export.enregistrees': '{n} fichiers enregistrés',
  'export.afficher': 'Afficher dans le dossier',
  'export.effacerPlage': 'Effacer la plage',
  'export.heureVide': 'Une heure sans enregistrement a été sautée.',
  'export.heuresVides': '{n} heures sans enregistrement ont été sautées.',
  'export.annule': 'Export annulé : rien n’a été enregistré.',
  'export.annuleTitre': 'Annulé',
  'export.faitUn': 'Le premier fichier, complet, est gardé.',
  'export.faitsPlusieurs': 'Les {n} premiers fichiers, complets, sont gardés.',
  'export.reessayer': 'Réessayer',
  'export.occupe': 'Un export est déjà en cours ({camera}, {pourcent} %) : un seul à la fois, pour ne pas surcharger le contrôleur.',
  'export.raison.vide': 'Rien n’a été enregistré sur cette plage — la caméra était peut-être hors ligne. Aucun fichier n’a été créé.',
  'export.raison.place': 'Pas assez de place sur le disque choisi. Choisis un autre dossier, ou libère de la place.',
  'export.raison.existe': 'Le fichier « {fichier} » existe déjà à cet endroit : rien n’a été écrasé. Choisis un autre nom ou un autre dossier.',
  'export.raison.interrompu': 'L’export s’est interrompu : le contrôleur ne répond plus. Le fichier partiel a été effacé.',
  'export.raison.refuse': 'Le contrôleur a refusé l’export ({statut}).',
  'export.raison.session': 'Aucune session n’est ouverte avec le contrôleur pour le moment.',
  'export.raison.ecriture': 'Impossible d’écrire dans le dossier choisi. Choisis-en un autre.',
  'export.raison.plage': 'Cette plage est vide ou trop courte.',
  'export.raison.occupe': 'Un export est déjà en cours : un seul à la fois.',
  'export.barreTitre': 'Export de la plage {camera}, {debut} → {fin} — un clic ramène à la relecture',
  'raccourcis.debutPlage': 'Début de la plage à exporter',
  'raccourcis.finPlage': 'Fin de la plage à exporter',

  // Historique des alertes (maquette docs/maquette-historique-alertes.html, 23.10.2026)
  'historique.onglets': 'Vue de l’écran Alertes',
  'historique.ongletVeilles': 'Veilles',
  'historique.onglet': 'Historique',
  'historique.precision': 'Ce que les veilles ont envoyé, gardé 90 jours sur ce PC',
  'historique.uneNonVue': '1 alerte non vue',
  'historique.nonVues': '{n} alertes non vues',
  'historique.vide': 'Aucune alerte envoyée pour l’instant',
  'historique.videDetail': 'Quand une veille préviendra, l’alerte apparaîtra ici — même si personne n’a vu la bulle.',
  'historique.filtre': 'Montrer les alertes de',
  'historique.toutes': 'Toutes',
  'historique.uneAlerte': '1 alerte',
  'historique.alertes': '{n} alertes',
  'historique.ilYa': 'il y a {duree}',
  'historique.avecSon': 'avec son',
  'historique.sansSon': 'sans son',
  'historique.sansImage': 'bulle sans image',
  'historique.sansImageTitre': 'L’instantané n’est pas arrivé à temps : la bulle est partie sans image, pour ne pas prévenir en retard.',
  'historique.uneRetenue': '+1 retenue',
  'historique.retenues': '+{n} retenues',
  'historique.retenuesTitre': 'Les détections suivantes de cette veille, pour ce sujet, que la retenue a tues : au plus une bulle par durée choisie.',
  'historique.revoir': 'Revoir',
  'historique.revoirTitre': 'Revoir à cet instant',
  'historique.sequence': 'Séquence',
  'historique.sequenceTitre': 'Ouvrir la séquence',
  'historique.garde': 'Gardé 90 jours sur ce PC, jamais ailleurs.',
  'historique.effacerTout': 'Effacer l’historique',
  'historique.confirmer': 'Effacer les {n} alertes de l’historique ? Les veilles, elles, ne changent pas.',
  'historique.annuler': 'Annuler',
  'historique.effacer': 'Effacer',

  // Relecture de plusieurs cameras (maquette docs/maquette-relecture-multi.html, 23.10.2026)
  'relecture.ajouter': 'Ajouter {nom} à côté',
  'relecture.retirer': 'Retirer {nom} de la relecture',
  'relecture.ecouterCamera': 'Écouter cette caméra (les autres se taisent)',
  'relecture.rendreActive': 'Rendre {nom} active',
  'relecture.rattrape': 'Extraction du morceau… cette caméra rattrape',
  'export.nCameras': '{n} caméras',
  'export.unParCamera': 'Un fichier par caméra affichée, l’un après l’autre.',

  // Dispositions du mur (maquette docs/maquette-dispositions.html, 23.10.2026)
  'dispositions.bouton': 'Disposition',
  'dispositions.titreBouton': 'Dispositions du mur (Ctrl + 1 à 9)',
  'dispositions.titre': 'Dispositions',
  'dispositions.vide': 'Une disposition garde les caméras affichées et leur ordre. Enregistre celle-ci pour y revenir d’un clic — ou de Ctrl + chiffre.',
  'dispositions.modifiee': 'modifiée',
  'dispositions.modifieeDetail': 'Le mur n’est plus celui de « {nom} » : une caméra a été déplacée, masquée ou réaffichée.',
  'dispositions.mettreAJour': 'Mettre à jour « {nom} »',
  'dispositions.revenir': 'Revenir à « {nom} »',
  'dispositions.uneAbsente': '1 caméra absente',
  'dispositions.absentes': '{n} caméras absentes',
  'dispositions.renommer': 'Renommer « {nom} »',
  'dispositions.renommerOk': 'Renommer',
  'dispositions.nomDe': 'Nom de « {nom} »',
  'dispositions.supprimerTitre': 'Supprimer « {nom} »',
  'dispositions.supprimerQuestion': 'Supprimer la disposition « {nom} » ? Les caméras, elles, ne changent pas.',
  'dispositions.supprimer': 'Supprimer',
  'dispositions.annuler': 'Annuler',
  'dispositions.nomNouvelle': 'Nom de la nouvelle disposition',
  'dispositions.ceQuiSeraGarde': 'Ce que tu vois maintenant : {cameras} — dans cet ordre.',
  'dispositions.doublon': 'Une disposition porte déjà ce nom.',
  'dispositions.enregistrer': 'Enregistrer',
  'dispositions.enregistrerActuelle': 'Enregistrer la disposition actuelle…',
  'dispositions.plein': '{n} dispositions au plus : supprime-en une pour en enregistrer une autre.',
  'dispositions.precision': '{nom} · {reste}',
  'dispositions.precisionModifiee': '{nom} (modifiée) · {reste}',
  'raccourcis.disposition': 'Passer à la disposition correspondante',

  // Bandeau d'activité du plein écran (maquette docs/maquette-bandeau-activite.html, 24.10.2026)
  'bandeau.region': 'Activité récente',
  'bandeau.enAbsence': '{n} pendant ton absence',
  'bandeau.enAbsences': '{n} pendant tes absences',
  'bandeau.plage': 'de {de} à {a}',
  'bandeau.plageOuverte': 'depuis {de}',
  'bandeau.duJour': 'aujourd’hui {n}',
  'bandeau.duJourMaj': 'Aujourd’hui {n}',
  'bandeau.rienDepuis': 'rien depuis {h}',
  'bandeau.enCours': 'En cours · {camera}',
  'bandeau.enCoursCourt': 'en cours',
  'bandeau.ouvrir': '{quoi}, {camera} : voir la séquence',

  // Réglages, passe de clarté (maquette docs/maquette-clarte-reglages.html, 24.10.2026)
  'reglages.etat.aJour': 'À jour',
  'reglages.etat.verification': 'Vérification',
  'reglages.etat.controle': 'Contrôle de {version}',
  'reglages.etat.application': 'Installation',
  'reglages.etat.prete': '{version} prête',
  'reglages.etat.refusee': '{version} refusée',
  'reglages.etat.erreur': 'Vérification impossible',
  'reglages.etat.manuelle': 'Mise à jour manuelle',
  'reglages.version.redemarrer': 'Redémarrer',
  'reglages.version.refuseeDetail': 'Elle ne porte pas la signature d’Alcora : rien n’a été installé, la version actuelle reste en service.',
  'reglages.version.erreurDetail': 'Elle réessaiera d’elle-même.',
  'reglages.langue.windows': 'Windows',
  'reglages.confort.sonSinon': 'Sinon, caméra par caméra',
  'reglages.probleme.journal': 'Journal',
  'reglages.probleme.joindre': 'À joindre à toute demande d’aide',
  'reglages.aide.raccourcis': 'Raccourcis',
  'reglages.aide.guideCourt': 'Activer le RTSP',
  'reglages.apropos.ligne': 'Client local pour UniFi Protect · non affilié à Ubiquiti',
  'reglages.apropos.moteurRelais': 'Moteur · relais',
  'reglages.ouvrir': 'Ouvrir',
  'reglages.connexion.avertissementSuite': 'Plus d’images jusqu’à la reconnexion.',
  'commun.plusInfo': 'En savoir plus',

  // Une seule fenêtre : la connexion dans le cadre (maquette docs/maquette-fenetre-unique.html, 24.10.2026)
  'rail.apresConnexion': 'Après la connexion',
  'barre.nonConnecte': 'non connecté',

  // Connexion, passe de clarté (maquette docs/maquette-fenetre-unique.html, 24.10.2026)
  'setup.rester.detail': 'Pour se reconnecter seule après un redémarrage, Alcora garde ton mot de passe et la clé à deux facteurs, chiffrés par Windows pour ton seul compte Windows. Quelqu’un qui ouvrirait ta session pourrait donc se connecter sans ton téléphone ; quelqu’un qui ne connaîtrait que ton mot de passe, non.',

  // Une seule fenêtre : la mise à jour annoncée d'une ligne (24.10.2026)
  'nouveautes.installee': 'Alcora {version} est installée',
  'nouveautes.nouveau': 'Nouveau',

  // Réglages, À propos : la licence lisible d'un coup d'œil (24.10.2026)
  'reglages.apropos.licenceTitre': 'GPL-3.0 · © Thomas',

  // Relecture, clarté : les loupes de la frise (24.10.2026)
  'relecture.elargir': 'Élargir — molette',
  'relecture.resserrer': 'Resserrer — molette',
} as const;

/** Toute cle de traduction est une cle de CE dictionnaire : le reste est refuse. */
export type Cle = keyof typeof fr;
