'use strict';

/**
 * Les mots du processus principal, dans les deux langues.
 *
 * Le pendant de web/src/i18n : le principal PARLE — notifications Windows, messages du
 * relais, etapes du test de connexion, erreurs typees — et doit parler la meme langue
 * que l'ecran. La langue est posee au demarrage par main.js (choix de l'utilisateur, ou
 * celle de Windows) et reposee a chaque changement dans les reglages.
 *
 * Le contrat est tenu par test-contrat.js : les deux tables doivent porter exactement
 * les memes cles. Le journal, lui, n'en fait pas partie : il est en anglais, toujours —
 * c'est la langue des rapports de defaut d'un projet ouvert.
 *
 * `{nom}` marque un parametre, remplace par t() a l'execution.
 */

const FR = {
  // ---- le relais video
  'relais.demarrage': 'Démarrage…',
  'relais.arret': 'Arrêt en cours.',
  'relais.pret': 'Flux vidéo prêt.',
  'relais.reconnexion': 'Reconnexion du flux vidéo…',
  'relais.echec': 'Le composant vidéo ne parvient pas à démarrer.',
  'relais.echecRemede': 'Redémarre le PC. Si cela persiste, réinstalle l’application.',
  'relais.connexionImpossible': 'Connexion au contrôleur impossible.',
  'relais.nouvelleTentative': 'Nouvelle tentative dans {s} secondes.',
  'relais.identifiantsAbsents': 'Les identifiants ne sont pas conservés sur ce PC.',
  'relais.identifiantsAbsentsRemede': 'Ouvre les réglages pour te reconnecter.',
  'relais.repriseVeille': 'Reprise après la mise en veille…',
  'relais.repriseVeilleRemede': 'La connexion se rétablit d’elle-même.',

  // ---- les sujets, dans le vocabulaire des veilles (veilles.js)
  'sujet.person': 'Personne',
  'sujet.vehicle': 'Véhicule',
  'sujet.animal': 'Animal',
  'sujet.package': 'Colis',
  'sujet.verre': 'Bris de verre',
  'sujet.fumee': 'Fumée',
  'sujet.sirene': 'Sirène',
  'sujet.co': 'Monoxyde',
  'sujet.aboiement': 'Aboiement',
  'sujet.parole': 'Parole',
  'sujet.bebe': 'Pleurs',
  'sujet.motion': 'Mouvement',
  'sujet.detection': 'Détection',

  // ---- les bulles du veilleur
  'veilleur.cliquerVoir': 'cliquer pour voir la séquence',

  // ---- les veilles semees a la premiere ouverture
  'veilles.profilNuit': 'Nuit',
  'veilles.nomPersonne': 'Une personne est détectée',
  'veilles.nomUrgences': 'Bris de verre, fumée, sirène, monoxyde',

  // ---- les etapes du test de connexion
  'etape.nonVerifie': 'Non vérifié.',
  'etape.contact': 'Contact du contrôleur…',
  'etape.verifIdentite': 'Vérification de l’identité…',
  'etape.connexionEnCours': 'Connexion…',
  'etape.repond': '{host} répond sur le port 443.',
  'etape.identiteVerifiee': 'Identité du contrôleur vérifiée.',
  'etape.echecConnexion': 'La connexion a échoué.',
  'etape.premierAppairage': 'Premier appairage : l’identité a été relevée.',
  'etape.identiteConforme': 'Identité conforme à celle mémorisée.',
  'etape.connexionAcceptee': 'Connexion acceptée. Session valable {jours} jours.',
  'etape.lectureCameras': 'Lecture des caméras…',
  'etape.inventaireIllisible': 'L’inventaire n’a pas pu être lu.',
  'etape.camerasTrouvees': '{n} caméra(s) trouvée(s) sur {nvr} (Protect {version}).',
  'etape.verifFlux': 'Vérification des flux…',
  'etape.aucunFlux': 'Aucune caméra n’a de flux activé.',
  'etape.aucunFluxRemede':
    'Dans Protect, ouvre chaque caméra puis Réglages, section Avancé, et active le RTSP.',
  'etape.diffusables': '{n} caméra(s) diffusable(s) sur le port {port}.',

  // ---- ce qui peut durer trop longtemps (sujets de TimeoutError)
  'delai.connexion': 'la connexion',
  'delai.lectureCameras': 'la lecture des caméras',
  'delai.rechercheMaj': 'la recherche de mise à jour',

  // ---- les erreurs typees (protect/errors.js)
  'erreur.delai': '{quoi} n’a pas abouti en {s} secondes.',
  'erreur.delaiRemede':
    'Le contrôleur répond mais ne termine pas la demande. Vérifie qu’il n’est pas en ' +
    'cours de mise à jour ou de redémarrage, puis réessaie.',
  'erreur.injoignable': 'Le contrôleur est injoignable.',
  'erreur.injoignableRemede':
    'Vérifie l’adresse saisie et que ce PC est bien sur le même réseau.',
  'erreur.nomNonResolu': 'Le nom « {host} » n’a pas pu être résolu.',
  'erreur.nomNonResoluRemede': 'Saisis directement l’adresse IP du contrôleur.',
  'erreur.rienPort443': '{host} répond, mais rien n’écoute sur le port 443.',
  'erreur.rienPort443Remede': 'Le réseau va bien : c’est le service qui semble arrêté.',
  'erreur.pcRefuse': 'Ce PC a refusé la connexion au contrôleur {host}.',
  'erreur.pcRefuseRemede':
    'Le réseau n’est pas en cause : la connexion est bloquée sur ce PC même. Deux ' +
    'causes possibles. Soit cette fenêtre n’est pas l’application installée mais une ' +
    'ancienne copie lancée par un raccourci périmé — referme-la et ouvre Alcora depuis ' +
    'le menu Démarrer. Soit un antivirus ou un pare-feu la bloque : autorise alors ' +
    'Alcora et son composant vidéo.',
  'erreur.identiteChangee':
    'L’identité du contrôleur a changé depuis la première connexion.',
  'erreur.identiteChangeeRemede':
    'Si tu viens de réinstaller ou mettre à jour le contrôleur, réassocie-le dans les ' +
    'réglages. Sinon, ne poursuis pas.',
  'erreur.identifiants': 'Identifiant ou mot de passe refusé.',
  'erreur.identifiantsRemede': 'Vérifie l’adresse e-mail du compte et son mot de passe.',
  'erreur.totpRefuse': 'Le code à deux facteurs a été refusé.',
  'erreur.totpDecale':
    'L’horloge de ce PC est décalée d’environ {s} s par rapport au contrôleur, ce qui ' +
    'suffit à invalider le code. Corrige la date et l’heure de Windows.',
  'erreur.totpVerifieCle':
    'Vérifie la clé saisie : elle doit venir de l’écran d’enrôlement.',
  'erreur.totpExige': 'Ce compte exige une authentification à deux facteurs.',
  'erreur.totpExigeRemede':
    'Renseigne la clé d’authentification à deux facteurs ci-dessus. Elle se trouve sur ' +
    'l’écran d’enrôlement du compte, sous le code QR, sous la forme « saisir la clé ».',
  'erreur.droits': 'Ce compte n’a pas les droits nécessaires.',
  'erreur.droitsRemede':
    'Donne-lui un rôle Protect permettant la lecture des caméras et de l’historique.',
  'erreur.tropTentatives': 'Trop de tentatives de connexion.',
  'erreur.tropTentativesRemede': 'Le contrôleur demande d’attendre environ {s} secondes.',
  'erreur.composantAbsent': 'Le composant vidéo est absent de l’installation.',
  'erreur.composantAbsentRemede': 'Réinstalle l’application depuis l’installeur d’origine.',
  'erreur.identiteNonVerifiee': 'L’identité du contrôleur n’a pas pu être vérifiée.',
  'erreur.identiteNonVerifieeRemede':
    'Relance le test de connexion, puis enregistre à nouveau.',
  'erreur.controleur': 'Le contrôleur a répondu une erreur ({status}).',

  // ---- messages divers du principal
  'main.copiePerimee': 'Cette copie d’Alcora est périmée.',
  'main.pasPret': 'L’application n’est pas encore prête.',
  'main.detectionIncomplete': 'Détection incomplète.',
  'main.cameraManquante': 'Caméra manquante.',
  'main.instantNonEnregistre': 'Cet instant n’est pas encore enregistré.',
  'main.pasConnexion': 'Pas de connexion au contrôleur.',
  'main.ouCaptures': 'Où enregistrer les captures',
  'main.videoMp4': 'Vidéo MP4',
  'main.erreurFatale': 'Une erreur inattendue a interrompu l’application.',
  'main.detailJournal': 'Le détail est enregistré ici :',
  'main.dossierDonnees': 'L’application n’a pas pu préparer son dossier de données.',
  'main.pasDemarre': 'L’application n’a pas pu démarrer.',
  'main.detailsDans': 'Détails dans :',
  'main.copiePerimeeVersion': 'Cette copie d’Alcora ({version}) est périmée.',
  'main.copiePerimeeRemede':
    'La version {version} est installée sur ce PC. Ferme cette fenêtre et ouvre Alcora ' +
    'depuis le menu Démarrer. Si tu es arrivé ici par une icône de la barre des tâches, ' +
    'détache-la : elle pointe vers une ancienne copie.',
  'main.chiffrementIndisponible': 'Le chiffrement des secrets est indisponible sur ce système.',

  // ---- les extraits
  'extraits.aucunEnregistrement': 'Aucun enregistrement sur cette période.',
  'extraits.refuse': 'Le contrôleur a refusé l’extrait ({status}).',
  'extraits.pasRepondu': 'Le contrôleur n’a pas répondu à temps.',
};

const EN = {
  'relais.demarrage': 'Starting…',
  'relais.arret': 'Stopping.',
  'relais.pret': 'Video stream ready.',
  'relais.reconnexion': 'Reconnecting the video stream…',
  'relais.echec': 'The video component cannot start.',
  'relais.echecRemede': 'Restart the PC. If it persists, reinstall the application.',
  'relais.connexionImpossible': 'Cannot connect to the controller.',
  'relais.nouvelleTentative': 'New attempt in {s} seconds.',
  'relais.identifiantsAbsents': 'The credentials are not kept on this PC.',
  'relais.identifiantsAbsentsRemede': 'Open the settings to sign in again.',
  'relais.repriseVeille': 'Resuming after sleep…',
  'relais.repriseVeilleRemede': 'The connection re-establishes itself.',

  'sujet.person': 'Person',
  'sujet.vehicle': 'Vehicle',
  'sujet.animal': 'Animal',
  'sujet.package': 'Package',
  'sujet.verre': 'Glass break',
  'sujet.fumee': 'Smoke',
  'sujet.sirene': 'Siren',
  'sujet.co': 'Monoxide',
  'sujet.aboiement': 'Barking',
  'sujet.parole': 'Speech',
  'sujet.bebe': 'Crying',
  'sujet.motion': 'Motion',
  'sujet.detection': 'Detection',

  'veilleur.cliquerVoir': 'click to view the sequence',

  'veilles.profilNuit': 'Night',
  'veilles.nomPersonne': 'A person is detected',
  'veilles.nomUrgences': 'Glass break, smoke, siren, monoxide',

  'etape.nonVerifie': 'Not checked.',
  'etape.contact': 'Contacting the controller…',
  'etape.verifIdentite': 'Verifying its identity…',
  'etape.connexionEnCours': 'Connecting…',
  'etape.repond': '{host} answers on port 443.',
  'etape.identiteVerifiee': 'Controller identity verified.',
  'etape.echecConnexion': 'The connection failed.',
  'etape.premierAppairage': 'First pairing: the identity was recorded.',
  'etape.identiteConforme': 'Identity matches the one on record.',
  'etape.connexionAcceptee': 'Connection accepted. Session valid for {jours} days.',
  'etape.lectureCameras': 'Reading the cameras…',
  'etape.inventaireIllisible': 'The inventory could not be read.',
  'etape.camerasTrouvees': '{n} camera(s) found on {nvr} (Protect {version}).',
  'etape.verifFlux': 'Checking the streams…',
  'etape.aucunFlux': 'No camera has a stream enabled.',
  'etape.aucunFluxRemede':
    'In Protect, open each camera, then Settings, Advanced section, and enable RTSP.',
  'etape.diffusables': '{n} camera(s) streamable on port {port}.',

  'delai.connexion': 'the connection',
  'delai.lectureCameras': 'reading the cameras',
  'delai.rechercheMaj': 'the update check',

  'erreur.delai': '{quoi} did not complete within {s} seconds.',
  'erreur.delaiRemede':
    'The controller answers but does not finish the request. Check that it is not ' +
    'updating or restarting, then try again.',
  'erreur.injoignable': 'The controller is unreachable.',
  'erreur.injoignableRemede':
    'Check the address entered and that this PC is on the same network.',
  'erreur.nomNonResolu': 'The name “{host}” could not be resolved.',
  'erreur.nomNonResoluRemede': 'Enter the controller’s IP address directly.',
  'erreur.rienPort443': '{host} answers, but nothing listens on port 443.',
  'erreur.rienPort443Remede': 'The network is fine: the service seems stopped.',
  'erreur.pcRefuse': 'This PC refused the connection to the controller {host}.',
  'erreur.pcRefuseRemede':
    'The network is not at fault: the connection is blocked on this very PC. Two ' +
    'possible causes. Either this window is not the installed application but an old ' +
    'copy launched by an outdated shortcut — close it and open Alcora from the Start ' +
    'menu. Or an antivirus or firewall is blocking it: then allow Alcora and its ' +
    'video component.',
  'erreur.identiteChangee':
    'The controller’s identity has changed since the first connection.',
  'erreur.identiteChangeeRemede':
    'If you just reinstalled or updated the controller, pair it again in the ' +
    'settings. Otherwise, do not continue.',
  'erreur.identifiants': 'Username or password refused.',
  'erreur.identifiantsRemede': 'Check the account’s e-mail address and its password.',
  'erreur.totpRefuse': 'The two-factor code was refused.',
  'erreur.totpDecale':
    'This PC’s clock is off by about {s} s from the controller, which is enough to ' +
    'invalidate the code. Fix the Windows date and time.',
  'erreur.totpVerifieCle':
    'Check the key entered: it must come from the enrollment screen.',
  'erreur.totpExige': 'This account requires two-factor authentication.',
  'erreur.totpExigeRemede':
    'Fill in the two-factor authentication key above. It is found on the account’s ' +
    'enrollment screen, under the QR code, as “enter the key”.',
  'erreur.droits': 'This account lacks the necessary rights.',
  'erreur.droitsRemede':
    'Give it a Protect role allowing reading of the cameras and the history.',
  'erreur.tropTentatives': 'Too many connection attempts.',
  'erreur.tropTentativesRemede': 'The controller asks to wait about {s} seconds.',
  'erreur.composantAbsent': 'The video component is missing from the installation.',
  'erreur.composantAbsentRemede': 'Reinstall the application from the original installer.',
  'erreur.identiteNonVerifiee': 'The controller’s identity could not be verified.',
  'erreur.identiteNonVerifieeRemede': 'Run the connection test again, then save again.',
  'erreur.controleur': 'The controller answered an error ({status}).',

  'main.copiePerimee': 'This copy of Alcora is outdated.',
  'main.pasPret': 'The application is not ready yet.',
  'main.detectionIncomplete': 'Incomplete detection.',
  'main.cameraManquante': 'Missing camera.',
  'main.instantNonEnregistre': 'This moment is not recorded yet.',
  'main.pasConnexion': 'No connection to the controller.',
  'main.ouCaptures': 'Where to save captures',
  'main.erreurFatale': 'An unexpected error interrupted the application.',
  'main.detailJournal': 'The details are recorded here:',
  'main.videoMp4': 'MP4 video',
  'main.dossierDonnees': 'The application could not prepare its data folder.',
  'main.pasDemarre': 'The application could not start.',
  'main.detailsDans': 'Details in:',
  'main.copiePerimeeVersion': 'This copy of Alcora ({version}) is outdated.',
  'main.copiePerimeeRemede':
    'Version {version} is installed on this PC. Close this window and open Alcora from ' +
    'the Start menu. If you got here through a taskbar icon, unpin it: it points to an ' +
    'old copy.',
  'main.chiffrementIndisponible': 'Secret encryption is unavailable on this system.',

  'extraits.aucunEnregistrement': 'No recording over this period.',
  'extraits.refuse': 'The controller refused the clip ({status}).',
  'extraits.pasRepondu': 'The controller did not answer in time.',
};

const DE = {
  'relais.demarrage': 'Start…',
  'relais.arret': 'Wird beendet.',
  'relais.pret': 'Videostream bereit.',
  'relais.reconnexion': 'Videostream wird neu verbunden…',
  'relais.echec': 'Die Videokomponente kann nicht starten.',
  'relais.echecRemede': 'Starte den PC neu. Bleibt es dabei, installiere die Anwendung neu.',
  'relais.connexionImpossible': 'Verbindung zum Controller nicht möglich.',
  'relais.nouvelleTentative': 'Neuer Versuch in {s} Sekunden.',
  'relais.identifiantsAbsents': 'Die Zugangsdaten sind auf diesem PC nicht hinterlegt.',
  'relais.identifiantsAbsentsRemede': 'Öffne die Einstellungen, um dich neu anzumelden.',
  'relais.repriseVeille': 'Fortsetzung nach dem Ruhezustand…',
  'relais.repriseVeilleRemede': 'Die Verbindung stellt sich von selbst wieder her.',

  'sujet.person': 'Person',
  'sujet.vehicle': 'Fahrzeug',
  'sujet.animal': 'Tier',
  'sujet.package': 'Paket',
  'sujet.verre': 'Glasbruch',
  'sujet.fumee': 'Rauch',
  'sujet.sirene': 'Sirene',
  'sujet.co': 'Kohlenmonoxid',
  'sujet.aboiement': 'Bellen',
  'sujet.parole': 'Sprache',
  'sujet.bebe': 'Weinen',
  'sujet.motion': 'Bewegung',
  'sujet.detection': 'Erkennung',

  'veilleur.cliquerVoir': 'klicken, um die Sequenz zu sehen',

  'veilles.profilNuit': 'Nacht',
  'veilles.nomPersonne': 'Eine Person wird erkannt',
  'veilles.nomUrgences': 'Glasbruch, Rauch, Sirene, Kohlenmonoxid',

  'etape.nonVerifie': 'Nicht geprüft.',
  'etape.contact': 'Controller wird kontaktiert…',
  'etape.verifIdentite': 'Identität wird geprüft…',
  'etape.connexionEnCours': 'Verbindung…',
  'etape.repond': '{host} antwortet auf Port 443.',
  'etape.identiteVerifiee': 'Identität des Controllers geprüft.',
  'etape.echecConnexion': 'Die Verbindung ist fehlgeschlagen.',
  'etape.premierAppairage': 'Erste Kopplung: die Identität wurde erfasst.',
  'etape.identiteConforme': 'Identität entspricht der hinterlegten.',
  'etape.connexionAcceptee': 'Verbindung angenommen. Sitzung {jours} Tage gültig.',
  'etape.lectureCameras': 'Kameras werden gelesen…',
  'etape.inventaireIllisible': 'Das Inventar konnte nicht gelesen werden.',
  'etape.camerasTrouvees': '{n} Kamera(s) auf {nvr} gefunden (Protect {version}).',
  'etape.verifFlux': 'Streams werden geprüft…',
  'etape.aucunFlux': 'Keine Kamera hat einen aktivierten Stream.',
  'etape.aucunFluxRemede':
    'Öffne in Protect jede Kamera, dann Einstellungen, Bereich Erweitert, und aktiviere RTSP.',
  'etape.diffusables': '{n} Kamera(s) streambar auf Port {port}.',

  'delai.connexion': 'die Verbindung',
  'delai.lectureCameras': 'das Lesen der Kameras',
  'delai.rechercheMaj': 'die Update-Prüfung',

  'erreur.delai': '{quoi} ist in {s} Sekunden nicht zu Ende gekommen.',
  'erreur.delaiRemede':
    'Der Controller antwortet, schliesst die Anfrage aber nicht ab. Prüfe, ob er gerade ' +
    'aktualisiert oder neu startet, und versuche es dann erneut.',
  'erreur.injoignable': 'Der Controller ist nicht erreichbar.',
  'erreur.injoignableRemede':
    'Prüfe die eingegebene Adresse und dass dieser PC im selben Netzwerk ist.',
  'erreur.nomNonResolu': 'Der Name «{host}» konnte nicht aufgelöst werden.',
  'erreur.nomNonResoluRemede': 'Gib direkt die IP-Adresse des Controllers ein.',
  'erreur.rienPort443': '{host} antwortet, aber auf Port 443 hört nichts.',
  'erreur.rienPort443Remede': 'Das Netzwerk ist in Ordnung: der Dienst scheint gestoppt.',
  'erreur.pcRefuse': 'Dieser PC hat die Verbindung zum Controller {host} verweigert.',
  'erreur.pcRefuseRemede':
    'Das Netzwerk ist nicht schuld: die Verbindung wird auf diesem PC selbst blockiert. ' +
    'Zwei mögliche Ursachen. Entweder ist dieses Fenster nicht die installierte ' +
    'Anwendung, sondern eine alte Kopie aus einer veralteten Verknüpfung — schliesse es ' +
    'und öffne Alcora über das Startmenü. Oder ein Virenschutz oder eine Firewall ' +
    'blockiert sie: erlaube dann Alcora und ihre Videokomponente.',
  'erreur.identiteChangee':
    'Die Identität des Controllers hat sich seit der ersten Verbindung geändert.',
  'erreur.identiteChangeeRemede':
    'Hast du den Controller gerade neu installiert oder aktualisiert, kopple ihn in den ' +
    'Einstellungen neu. Sonst fahre nicht fort.',
  'erreur.identifiants': 'Benutzername oder Passwort abgelehnt.',
  'erreur.identifiantsRemede': 'Prüfe die E-Mail-Adresse des Kontos und sein Passwort.',
  'erreur.totpRefuse': 'Der Zwei-Faktor-Code wurde abgelehnt.',
  'erreur.totpDecale':
    'Die Uhr dieses PCs geht etwa {s} s gegenüber dem Controller falsch — genug, um den ' +
    'Code ungültig zu machen. Korrigiere Datum und Uhrzeit von Windows.',
  'erreur.totpVerifieCle':
    'Prüfe den eingegebenen Schlüssel: er muss vom Einrichtungsbildschirm stammen.',
  'erreur.totpExige': 'Dieses Konto verlangt eine Zwei-Faktor-Anmeldung.',
  'erreur.totpExigeRemede':
    'Trage oben den Zwei-Faktor-Schlüssel ein. Er steht auf dem Einrichtungsbildschirm ' +
    'des Kontos, unter dem QR-Code, als «Schlüssel eingeben».',
  'erreur.droits': 'Dieses Konto hat nicht die nötigen Rechte.',
  'erreur.droitsRemede':
    'Gib ihm eine Protect-Rolle, die das Lesen der Kameras und der Historie erlaubt.',
  'erreur.tropTentatives': 'Zu viele Verbindungsversuche.',
  'erreur.tropTentativesRemede': 'Der Controller bittet, etwa {s} Sekunden zu warten.',
  'erreur.composantAbsent': 'Die Videokomponente fehlt in der Installation.',
  'erreur.composantAbsentRemede': 'Installiere die Anwendung mit dem Original-Installer neu.',
  'erreur.identiteNonVerifiee': 'Die Identität des Controllers konnte nicht geprüft werden.',
  'erreur.identiteNonVerifieeRemede': 'Starte den Verbindungstest neu und speichere dann wieder.',
  'erreur.controleur': 'Der Controller hat einen Fehler gemeldet ({status}).',

  'main.copiePerimee': 'Diese Kopie von Alcora ist veraltet.',
  'main.pasPret': 'Die Anwendung ist noch nicht bereit.',
  'main.detectionIncomplete': 'Unvollständige Erkennung.',
  'main.cameraManquante': 'Kamera fehlt.',
  'main.instantNonEnregistre': 'Dieser Moment ist noch nicht aufgezeichnet.',
  'main.pasConnexion': 'Keine Verbindung zum Controller.',
  'main.ouCaptures': 'Wohin die Standbilder speichern',
  'main.videoMp4': 'MP4-Video',
  'main.erreurFatale': 'Ein unerwarteter Fehler hat die Anwendung unterbrochen.',
  'main.detailJournal': 'Die Details stehen hier:',
  'main.dossierDonnees': 'Die Anwendung konnte ihren Datenordner nicht vorbereiten.',
  'main.pasDemarre': 'Die Anwendung konnte nicht starten.',
  'main.detailsDans': 'Details in:',
  'main.copiePerimeeVersion': 'Diese Kopie von Alcora ({version}) ist veraltet.',
  'main.copiePerimeeRemede':
    'Version {version} ist auf diesem PC installiert. Schliesse dieses Fenster und ' +
    'öffne Alcora über das Startmenü. Kamst du über ein Taskleisten-Symbol hierher, ' +
    'löse es: es zeigt auf eine alte Kopie.',
  'main.chiffrementIndisponible': 'Die Verschlüsselung der Geheimnisse ist auf diesem System nicht verfügbar.',

  'extraits.aucunEnregistrement': 'Keine Aufzeichnung in diesem Zeitraum.',
  'extraits.refuse': 'Der Controller hat den Clip verweigert ({status}).',
  'extraits.pasRepondu': 'Der Controller hat nicht rechtzeitig geantwortet.',
};

const IT = {
  'relais.demarrage': 'Avvio…',
  'relais.arret': 'Arresto in corso.',
  'relais.pret': 'Flusso video pronto.',
  'relais.reconnexion': 'Riconnessione del flusso video…',
  'relais.echec': 'Il componente video non riesce ad avviarsi.',
  'relais.echecRemede': 'Riavvia il PC. Se persiste, reinstalla l’applicazione.',
  'relais.connexionImpossible': 'Connessione al controller impossibile.',
  'relais.nouvelleTentative': 'Nuovo tentativo tra {s} secondi.',
  'relais.identifiantsAbsents': 'Le credenziali non sono conservate su questo PC.',
  'relais.identifiantsAbsentsRemede': 'Apri le impostazioni per riconnetterti.',
  'relais.repriseVeille': 'Ripresa dopo la sospensione…',
  'relais.repriseVeilleRemede': 'La connessione si ristabilisce da sola.',

  'sujet.person': 'Persona',
  'sujet.vehicle': 'Veicolo',
  'sujet.animal': 'Animale',
  'sujet.package': 'Pacco',
  'sujet.verre': 'Vetro rotto',
  'sujet.fumee': 'Fumo',
  'sujet.sirene': 'Sirena',
  'sujet.co': 'Monossido',
  'sujet.aboiement': 'Abbaio',
  'sujet.parole': 'Voce',
  'sujet.bebe': 'Pianto',
  'sujet.motion': 'Movimento',
  'sujet.detection': 'Rilevamento',

  'veilleur.cliquerVoir': 'clicca per vedere la sequenza',

  'veilles.profilNuit': 'Notte',
  'veilles.nomPersonne': 'Una persona è rilevata',
  'veilles.nomUrgences': 'Vetro rotto, fumo, sirena, monossido',

  'etape.nonVerifie': 'Non verificato.',
  'etape.contact': 'Contatto del controller…',
  'etape.verifIdentite': 'Verifica dell’identità…',
  'etape.connexionEnCours': 'Connessione…',
  'etape.repond': '{host} risponde sulla porta 443.',
  'etape.identiteVerifiee': 'Identità del controller verificata.',
  'etape.echecConnexion': 'La connessione è fallita.',
  'etape.premierAppairage': 'Primo abbinamento: l’identità è stata rilevata.',
  'etape.identiteConforme': 'Identità conforme a quella memorizzata.',
  'etape.connexionAcceptee': 'Connessione accettata. Sessione valida {jours} giorni.',
  'etape.lectureCameras': 'Lettura delle telecamere…',
  'etape.inventaireIllisible': 'L’inventario non ha potuto essere letto.',
  'etape.camerasTrouvees': '{n} telecamera/e trovata/e su {nvr} (Protect {version}).',
  'etape.verifFlux': 'Verifica dei flussi…',
  'etape.aucunFlux': 'Nessuna telecamera ha un flusso attivato.',
  'etape.aucunFluxRemede':
    'In Protect, apri ogni telecamera poi Impostazioni, sezione Avanzate, e attiva l’RTSP.',
  'etape.diffusables': '{n} telecamera/e trasmissibile/i sulla porta {port}.',

  'delai.connexion': 'la connessione',
  'delai.lectureCameras': 'la lettura delle telecamere',
  'delai.rechercheMaj': 'la ricerca di aggiornamento',

  'erreur.delai': '{quoi} non è arrivata in fondo in {s} secondi.',
  'erreur.delaiRemede':
    'Il controller risponde ma non termina la richiesta. Verifica che non sia in ' +
    'aggiornamento o in riavvio, poi riprova.',
  'erreur.injoignable': 'Il controller è irraggiungibile.',
  'erreur.injoignableRemede':
    'Verifica l’indirizzo inserito e che questo PC sia sulla stessa rete.',
  'erreur.nomNonResolu': 'Il nome «{host}» non ha potuto essere risolto.',
  'erreur.nomNonResoluRemede': 'Inserisci direttamente l’indirizzo IP del controller.',
  'erreur.rienPort443': '{host} risponde, ma nulla ascolta sulla porta 443.',
  'erreur.rienPort443Remede': 'La rete va bene: è il servizio che sembra fermo.',
  'erreur.pcRefuse': 'Questo PC ha rifiutato la connessione al controller {host}.',
  'erreur.pcRefuseRemede':
    'La rete non c’entra: la connessione è bloccata su questo stesso PC. Due cause ' +
    'possibili. O questa finestra non è l’applicazione installata ma una vecchia copia ' +
    'lanciata da un collegamento superato — chiudila e apri Alcora dal menu Start. ' +
    'Oppure un antivirus o un firewall la blocca: autorizza allora Alcora e il suo ' +
    'componente video.',
  'erreur.identiteChangee':
    'L’identità del controller è cambiata dalla prima connessione.',
  'erreur.identiteChangeeRemede':
    'Se hai appena reinstallato o aggiornato il controller, riabbinalo nelle ' +
    'impostazioni. Altrimenti, non proseguire.',
  'erreur.identifiants': 'Nome utente o password rifiutati.',
  'erreur.identifiantsRemede': 'Verifica l’indirizzo e-mail dell’account e la sua password.',
  'erreur.totpRefuse': 'Il codice a due fattori è stato rifiutato.',
  'erreur.totpDecale':
    'L’orologio di questo PC è sfasato di circa {s} s rispetto al controller, quanto ' +
    'basta a invalidare il codice. Correggi data e ora di Windows.',
  'erreur.totpVerifieCle':
    'Verifica la chiave inserita: deve venire dalla schermata di registrazione.',
  'erreur.totpExige': 'Questo account esige un’autenticazione a due fattori.',
  'erreur.totpExigeRemede':
    'Inserisci sopra la chiave di autenticazione a due fattori. Si trova sulla ' +
    'schermata di registrazione dell’account, sotto il codice QR, come «inserisci la chiave».',
  'erreur.droits': 'Questo account non ha i diritti necessari.',
  'erreur.droitsRemede':
    'Dagli un ruolo Protect che permetta la lettura delle telecamere e della cronologia.',
  'erreur.tropTentatives': 'Troppi tentativi di connessione.',
  'erreur.tropTentativesRemede': 'Il controller chiede di attendere circa {s} secondi.',
  'erreur.composantAbsent': 'Il componente video è assente dall’installazione.',
  'erreur.composantAbsentRemede': 'Reinstalla l’applicazione dall’installer originale.',
  'erreur.identiteNonVerifiee': 'L’identità del controller non ha potuto essere verificata.',
  'erreur.identiteNonVerifieeRemede': 'Rilancia il test di connessione, poi salva di nuovo.',
  'erreur.controleur': 'Il controller ha risposto un errore ({status}).',

  'main.copiePerimee': 'Questa copia di Alcora è superata.',
  'main.pasPret': 'L’applicazione non è ancora pronta.',
  'main.detectionIncomplete': 'Rilevamento incompleto.',
  'main.cameraManquante': 'Telecamera mancante.',
  'main.instantNonEnregistre': 'Questo momento non è ancora registrato.',
  'main.pasConnexion': 'Nessuna connessione al controller.',
  'main.ouCaptures': 'Dove salvare le catture',
  'main.videoMp4': 'Video MP4',
  'main.erreurFatale': 'Un errore inatteso ha interrotto l’applicazione.',
  'main.detailJournal': 'Il dettaglio è registrato qui:',
  'main.dossierDonnees': 'L’applicazione non ha potuto preparare la sua cartella dati.',
  'main.pasDemarre': 'L’applicazione non è riuscita ad avviarsi.',
  'main.detailsDans': 'Dettagli in:',
  'main.copiePerimeeVersion': 'Questa copia di Alcora ({version}) è superata.',
  'main.copiePerimeeRemede':
    'La versione {version} è installata su questo PC. Chiudi questa finestra e apri ' +
    'Alcora dal menu Start. Se sei arrivato qui da un’icona della barra delle ' +
    'applicazioni, staccala: punta a una vecchia copia.',
  'main.chiffrementIndisponible': 'La cifratura dei segreti non è disponibile su questo sistema.',

  'extraits.aucunEnregistrement': 'Nessuna registrazione in questo periodo.',
  'extraits.refuse': 'Il controller ha rifiutato la clip ({status}).',
  'extraits.pasRepondu': 'Il controller non ha risposto in tempo.',
};

/**
 * LE registre. Ajouter une langue = son tableau ci-dessus + une entree ici + le
 * jumeau web (v2/web/src/i18n/index.ts). test-contrat.js verifie que CHAQUE table
 * porte exactement les cles du francais.
 */
const LANGUES = {
  fr: { table: FR, locale: 'fr-CH' },
  en: { table: EN, locale: 'en-GB' },
  de: { table: DE, locale: 'de-CH' },
  it: { table: IT, locale: 'it-CH' },
};

let courante = 'fr';

/** Posee par main.js au demarrage, puis a chaque changement dans les reglages. */
function definirLangue(langue) {
  courante = LANGUES[langue] ? langue : 'fr';
}

function langue() {
  return courante;
}

/** La locale des heures affichees (bulles de notification). */
function localeHeure() {
  return LANGUES[courante].locale;
}

/**
 * Traduit une cle, en remplacant les parametres `{nom}`.
 *
 * Une cle absente rend la cle elle-meme : mieux vaut un mot d'API a l'ecran qu'un
 * plantage du principal — et test-contrat.js interdit deja ce cas entre les tables.
 */
function t(cle, params) {
  let texte = LANGUES[courante].table[cle] ?? FR[cle] ?? cle;
  if (params) {
    for (const [nom, valeur] of Object.entries(params)) {
      texte = texte.split(`{${nom}}`).join(String(valeur));
    }
  }
  return texte;
}

module.exports = { t, definirLangue, langue, localeHeure, LANGUES, FR, EN };
