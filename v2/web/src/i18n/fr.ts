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
  'canal.haute': 'HAUTE',
  'canal.moyenne': 'MOYENNE',
  'canal.basse': 'BASSE',
  'canal.colis': 'COLIS',

  // ---- les commandes d'une vue video, partagees par les trois ecrans
  'video.revenirImage': 'Revenir à l’image entière ({zoom}×)',
  'video.couperSon': 'Couper le son',
  'video.activerSon': 'Activer le son',
  'video.pasDeSon': 'Ce flux ne porte pas de son',
  'video.capturer': 'Enregistrer une image',
  'video.pleinEcran': 'Plein écran',
  'video.quitterPleinEcran': 'Quitter le plein écran',
  'video.interpole': 'interpolé',
  'video.pause': 'Pause',
  'video.lecture': 'Lecture',
  'video.imagePrecedente': 'Image précédente',
  'video.imageSuivante': 'Image suivante',
  'video.sequenceIllisible': 'Cette séquence ne peut pas être lue ici.',
  'video.imageIndisponible': 'Image indisponible',
  'video.imageEnregistree': 'Image enregistrée : {chemin}',

  // ---- « Ce qui a change »
  'nouveautes.titre': 'Alcora s’est mise à jour',
  'nouveautes.depuis': 'Ce qui a changé depuis la version {version}',
  'nouveautes.compris': 'Compris',

  // ---- partage entre ecrans
  'commun.ouvrirDossier': 'Ouvrir le dossier',
  'commun.horsLigne': 'hors ligne',
  'commun.aucunFlux': 'aucun flux',
  'camera.rtspDesactive': 'RTSP désactivé',
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
  'reglages.version.verification': 'Vérification en cours…',
  'reglages.version.telechargement': 'Téléchargement de la {version}… {pourcent} %',
  'reglages.version.prete': 'La version {version} est prête : redémarre pour l’appliquer.',
  'reglages.version.erreur':
    'La vérification des mises à jour n’a pas abouti. Elle réessaiera d’elle-même.',
  'reglages.version.repos':
    'L’application vérifie d’elle-même les nouvelles versions, les télécharge en silence, ' +
    'puis propose de redémarrer.',
  'reglages.version.manuelle':
    'Sur cette plateforme, la mise à jour est manuelle : télécharge la nouvelle version ' +
    'depuis alcora.ch, puis remplace l’application.',
  'reglages.version.verifier': 'Vérifier maintenant',

  // Les NOMS des langues (Français, English, Deutsch…) ne sont pas ici : chacun
  // s'ecrit dans sa propre langue, toujours — ils vivent dans le registre (index.ts).
  'reglages.langue.titre': 'Langue',
  'reglages.langue.detail':
    'L’interface et les notifications. « Automatique » suit la langue de Windows.',
  'reglages.langue.auto': 'Automatique',

  'reglages.apparence.titre': 'Apparence',
  'reglages.apparence.espacement': 'Espacement entre les vues',
  'reglages.apparence.aucun': 'aucun',
  'reglages.apparence.detail':
    'À « aucun », les images se touchent, sans cadre — un seul mur d’images.',
  'reglages.apparence.fond': 'Fond animé',
  'reglages.apparence.fondDetail':
    'Le planétarium derrière les images : étoiles, filantes, nébuleuses. Il se fige ' +
    'de lui-même si Windows demande de réduire les animations.',

  'reglages.demarrage.titre': 'Démarrage',
  'reglages.demarrage.ouvrir': 'Ouvrir Alcora avec Windows',
  'reglages.demarrage.indisponible': 'Indisponible hors application installée.',
  'reglages.demarrage.detail': 'L’application se lance dès l’ouverture de la session Windows.',

  'reglages.confort.titre': 'Captures et son',
  'reglages.confort.dossier': 'Où vont les captures',
  'reglages.confort.changer': 'Changer',
  'reglages.confort.son': 'Son actif dès l’ouverture',
  'reglages.confort.sonDetail':
    'Éteint par défaut : un mur d’images qui se met à parler tout seul au lancement est ' +
    'vite insupportable. Le son se demande caméra par caméra, sous l’image.',

  'reglages.historique.titre': 'Ce qui a changé',
  'reglages.historique.installee': 'installée',

  'reglages.connexion.titre': 'Connexion',
  'reglages.connexion.controleur': 'Contrôleur',
  'reglages.connexion.compte': 'Compte',
  'reglages.connexion.identite': 'Identité vérifiée',
  'reglages.connexion.oui': 'oui',
  'reglages.connexion.non': 'non',
  'reglages.connexion.modifier': 'Modifier la connexion',
  'reglages.connexion.avertissement':
    'Le mot de passe et la clé à deux facteurs seront effacés de ce PC, et l’écran de ' +
    'connexion réapparaîtra. Les caméras cesseront de s’afficher jusqu’à ce que tu les ' +
    'saisisses à nouveau.',
  'reglages.connexion.effacer': 'Effacer et ressaisir',
  'reglages.connexion.annuler': 'Annuler',

  'reglages.probleme.titre': 'En cas de problème',
  'reglages.probleme.detail':
    'Tout ce que fait l’application est consigné dans un fichier. C’est ce fichier qu’il ' +
    'faut envoyer lorsque quelque chose ne fonctionne pas.',

  // ---- l'ecran de connexion
  'setup.titre': 'Connexion au contrôleur',
  'setup.sousTitre':
    'L’application interroge ton contrôleur pour découvrir les caméras. ' +
    'Rien n’est envoyé ailleurs.',
  'setup.demo': 'Mode démonstration : aucune connexion réelle n’est établie.',

  'setup.etape.reseau': 'Joindre le contrôleur',
  'setup.etape.certificat': 'Vérifier son identité',
  'setup.etape.identifiants': 'S’authentifier',
  'setup.etape.inventaire': 'Lire les caméras',
  'setup.etape.flux': 'Vérifier les flux',

  'setup.reprise.conservee': 'Une connexion précédente est conservée sur ce PC',
  'setup.reprise.detail': 'Tu peux la reprendre sans rien ressaisir.',
  'setup.reprise.bouton': 'Reprendre cette connexion',
  'setup.reprise.encours': 'Reprise…',
  'setup.reprise.echec': 'La reprise n’a pas abouti. Saisis les identifiants ci-dessous.',

  'setup.adresse.label': 'Adresse du contrôleur',
  'setup.adresse.hint': 'L’adresse IP de ton UDM, Cloud Key ou UNVR.',

  'setup.prealable.titre': 'À préparer sur la console',
  'setup.prealable.rtsp':
    'Le RTSP activé sur chaque caméra (Protect → caméra → Avancé). Alcora ne demande '
    + 'jamais d’URL : elle lit les adresses toute seule, mais le RTSP doit être ouvert.',
  'setup.prealable.compte':
    'Un compte dédié à Alcora, avec droits de visionnage — pas ton compte propriétaire.',
  'setup.compte.titre': 'Compte',
  'setup.compte.identifiant': 'Identifiant',
  'setup.compte.identifiantHint':
    'Utilise un compte dédié à cette application, avec des droits limités.',
  'setup.compte.motDePasse': 'Mot de passe',
  'setup.compte.masquerMdp': 'Masquer le mot de passe',
  'setup.compte.afficherMdp': 'Afficher le mot de passe',
  'setup.compte.cle': 'Clé d’authentification à deux facteurs',
  'setup.compte.clePlaceholder': 'laisser vide si le compte n’en a pas',
  'setup.compte.masquerCle': 'Masquer la clé',
  'setup.compte.afficherCle': 'Afficher la clé',

  'setup.aide.question': 'Où trouver cette clé ?',
  'setup.aide.p1':
    'Sur le site de gestion de ton compte Ubiquiti, lors de l’ajout d’une application ' +
    'd’authentification, choisis « saisie manuelle » plutôt que de scanner le code : la ' +
    'clé s’affiche alors en toutes lettres.',
  'setup.aide.p2':
    'Garde cette même clé enrôlée sur ton téléphone. Si cette application en devenait ' +
    'l’unique détentrice, perdre ce PC te bloquerait l’accès à ton compte.',

  'setup.verification.titre': 'Vérification',
  'setup.verification.lent': 'C’est plus long que prévu…',
  'setup.verification.detailTechnique': 'Détail technique',
  'setup.verification.echecTest': 'Le test n’a pas pu être mené à son terme.',

  'setup.cameras.titre': 'Caméras trouvées',

  'setup.rester.titre': 'Rester connecté',
  'setup.rester.p1':
    'Pour se reconnecter seule après un redémarrage, l’application conserve sur ce PC ton ' +
    'mot de passe et la clé qui produit les codes à usage unique, chiffrés par Windows ' +
    'pour ton compte Windows uniquement.',
  'setup.rester.p2':
    'Concrètement : une personne qui ouvrirait une session sous ton compte Windows ' +
    'pourrait se connecter au contrôleur sans avoir ton téléphone. En revanche, ton ' +
    'compte reste protégé face à quelqu’un qui ne connaîtrait que ton mot de passe.',
  'setup.rester.case': 'Rester connecté sur ce PC',

  'setup.actions.tester': 'Tester la connexion',
  'setup.actions.enregistrer': 'Enregistrer et démarrer',
  'setup.actions.echecEnregistrement': 'L’enregistrement n’a pas abouti.',

  // ---- la colonne d'etat
  'colonne.controleur': 'Contrôleur',
  'colonne.heure': 'Heure',
  'colonne.arme': 'armé',
  'colonne.desarme': 'désarmé',
  'colonne.alarmesInactives': 'alarmes inactives',
  'colonne.detectionsRecentes': 'Détections récentes',
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
  'colonne.aucuneImage': 'Aucune image ne quitte votre réseau.',

  // ---- la coquille du direct : panneau lateral, plein ecran, mosaique
  'app.titrePanneau': 'Surveillance',
  'app.etat': 'État',
  'app.reessayer': 'Réessayer',
  'app.cameras': 'Caméras',
  'app.aucuneCamera': 'Aucune caméra pour l’instant.',
  'app.afficherCamera': 'Afficher {nom}',
  'app.masquerCamera': 'Masquer {nom}',
  'app.derniereCamera': 'La dernière caméra visible ne se masque pas',
  'app.reafficher': 'Réafficher dans la mosaïque',
  'app.masquerMosaique': 'Masquer de la mosaïque',
  'app.reduirePanneau': 'Réduire le panneau',
  'app.epinglerPanneau': 'Épingler le panneau',
  'app.pleinEcranF11': 'Plein écran (F11)',
  'app.versionPrete': 'Version {version} prête.',
  'app.redemarrerMaintenant': 'Redémarrer maintenant',
  'app.plusTard': 'Plus tard',
  'app.echapRevenir': 'Échap pour revenir',
  'app.afficherPanneau': 'Afficher le panneau',
  'app.quitterPleinEcranEchap': 'Quitter le plein écran (Échap)',
  'app.quitter': 'Quitter',
  'app.revenirMosaique': 'Double-clic pour revenir à la mosaïque',
  'app.glisserIsoler': 'Glisser pour réorganiser · double-clic pour isoler',
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
  'relecture.journeeEntiere': 'journée entière',
  'relecture.revoirJournee': 'Revoir la journée entière',
  'relecture.toutVoir': 'tout voir',
  'relecture.molette': 'molette pour zoomer',
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
  'recherche.placeholder': 'plaque, ou nom…',
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
  'recherche.enCours': 'recherche…',
  'recherche.objetUn': 'objet',
  'recherche.objetPlusieurs': 'objets',
  'recherche.tronque': 'affichage limité aux 300 plus récents — affine pour tout voir',
  'recherche.filtrageNote': 'sujet filtré par le contrôleur, le reste ici',
  'recherche.rien': 'Rien ne correspond.',
  'recherche.rienSeuil': 'La confiance minimale est peut-être trop haute.',
  'recherche.rienTexte': 'Essaie avec moins de caractères — les derniers chiffres suffisent.',
  'recherche.identifie': 'Une plaque ou un nom a été reconnu',

  // ---- les veilles
  'veilles.jours': 'Dim Lun Mar Mer Jeu Ven Sam',
  'veilles.quand.toujours': 'Toujours',
  'veilles.quand.toujoursAide': 'même désarmé, à toute heure',
  'veilles.quand.armee': 'Quand la veille est active',
  'veilles.quand.armeeAide': 'suit l’interrupteur et ses horaires',
  'veilles.quand.horaire': 'Sur un horaire à moi',
  'veilles.quand.horaireAide': 'indépendant de l’interrupteur',
  'veilles.presqueJamais': 'presque jamais',
  'veilles.parJour': '~{n} par jour',
  'veilles.lectureEchouee': 'Les veilles n’ont pas pu être lues.',
  'veilles.activer': 'Activer la veille',
  'veilles.desactiver': 'Désactiver la veille',
  'veilles.active': 'Veille active',
  'veilles.desactivee': 'Veille désactivée',
  'veilles.profil': 'profil {nom}',
  'veilles.enregistre': 'enregistré',
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
} as const;

/** Toute cle de traduction est une cle de CE dictionnaire : le reste est refuse. */
export type Cle = keyof typeof fr;
