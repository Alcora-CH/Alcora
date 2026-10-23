import type { Cle } from './fr';

/**
 * La traduction allemande.
 *
 * Meme contrat que l'anglais : `Record<Cle, string>` — une cle manquante ou inventee
 * arrete la compilation, donc `npm test`.
 *
 * Orthographe SUISSE (« ss », jamais « ß ») : le projet vit en Suisse, la locale est
 * de-CH. Tutoiement (« du »), comme le francais tutoie — c'est le ton de l'application.
 */
export const de: Record<Cle, string> = {
  'espace.direct': 'Live',
  'espace.detections': 'Erkennungen',
  'espace.relecture': 'Wiedergabe',
  'espace.alertes': 'Alarme',
  'espace.reglages': 'Einstellungen',
  'espace.prochainLot': 'Dieser Bereich kommt in einer nächsten Version.',

  'canal.haute': 'Hoch',
  'canal.moyenne': 'Mittel',
  'canal.basse': 'Niedrig',
  'canal.colis': 'Paket',

  'video.revenirImage': 'Zurück zum ganzen Bild ({zoom}×)',
  'video.couperSon': 'Ton aus',
  'video.activerSon': 'Ton einschalten',
  'video.pasDeSon': 'Dieser Stream führt keinen Ton',
  'video.capturer': 'Standbild speichern',
  'video.pleinEcran': 'Vollbild',
  'video.interpole': 'interpoliert',
  'video.pause': 'Pause',
  'video.lecture': 'Wiedergabe',
  'video.imagePrecedente': 'Vorheriges Bild',
  'video.imageSuivante': 'Nächstes Bild',
  'video.sequenceIllisible': 'Diese Sequenz kann hier nicht abgespielt werden.',
  'video.imageIndisponible': 'Bild nicht verfügbar',
  'video.imageEnregistree': 'Bild gespeichert: {chemin}',

  'nouveautes.titre': 'Alcora wurde aktualisiert',
  'nouveautes.depuis': 'Was sich seit Version {version} geändert hat',
  'nouveautes.compris': 'Verstanden',

  'commun.ouvrirDossier': 'Ordner öffnen',
  'commun.horsLigne': 'offline',
  'commun.aucunFlux': 'kein Stream',
  'camera.rtspDesactive': 'RTSP deaktiviert',
  'camera.guide': 'Zur Anleitung, Schritt für Schritt',
  'camera.rtspRemede':
    'Diese Kamera sendet nicht: Aktiviere RTSP in Protect, an der Kamera, Bereich '
    + 'Erweitert. Alcora übernimmt sie dann von selbst.',
  'commun.fermer': 'Schliessen',
  'commun.fermerEchap': 'Schliessen (Esc)',
  'commun.toutes': 'Alle',

  'unite.j': 'T',
  'unite.mois': 'Mt.',
  'unite.to': 'TB',
  'unite.go': 'GB',

  'sujet.person': 'Person',
  'sujet.vehicle': 'Fahrzeug',
  'sujet.animal': 'Tier',
  'sujet.face': 'Gesicht',
  'sujet.licensePlate': 'Kennzeichen',
  'sujet.alrmSpeak': 'Sprache',
  'sujet.alrmBark': 'Bellen',
  'sujet.alrmCarHorn': 'Hupe',
  'sujet.alrmSmoke': 'Rauch',
  'sujet.alrmGlassBreak': 'Glasbruch',
  'sujet.motion': 'Bewegung',
  'sujet.sonDetecte': 'Geräusch erkannt',
  'sujet.son': 'Geräusch',
  'sujet.package': 'Paket',
  'sujet.sirene': 'Sirene',
  'sujet.monoxyde': 'Kohlenmonoxid',
  'sujet.pleurs': 'Weinen',

  'vehicule.suv': 'SUV',
  'vehicule.car': 'Auto',
  'vehicule.van': 'Lieferwagen',
  'vehicule.truck': 'Lastwagen',
  'vehicule.motorcycle': 'Motorrad',
  'vehicule.bike': 'Velo',
  'vehicule.bus': 'Bus',

  'reglages.titre': 'Einstellungen',
  'reglages.sousTitre': 'Installierte Version, Verbindung zum Controller, und wo das Protokoll liegt.',

  'reglages.version.titre': 'Version',
  'reglages.version.verification': 'Prüfung läuft…',
  'reglages.version.telechargement': 'Version {version} wird geladen… {pourcent} %',
  'reglages.version.prete': 'Version {version} ist bereit: Neustart, um sie anzuwenden.',
  'reglages.version.erreur': 'Die Update-Prüfung ist nicht durchgekommen. Sie versucht es von selbst erneut.',
  'reglages.version.repos':
    'Die Anwendung prüft selbständig auf neue Versionen, lädt sie still herunter ' +
    'und schlägt dann einen Neustart vor.',
  'reglages.version.manuelle':
    'Auf dieser Plattform erfolgt die Aktualisierung manuell: Lade die neue Version ' +
    'von alcora.ch herunter und ersetze die Anwendung.',
  'reglages.version.verifier': 'Jetzt prüfen',

  'reglages.langue.titre': 'Sprache',
  'reglages.langue.detail':
    'Oberfläche und Benachrichtigungen. «Automatisch» folgt der Windows-Sprache.',
  'reglages.langue.auto': 'Automatisch',

  'reglages.apparence.titre': 'Darstellung',
  'reglages.apparence.espacement': 'Abstand zwischen den Ansichten',
  'reglages.apparence.aucun': 'keiner',
  'reglages.apparence.detail':
    'Bei «keiner» berühren sich die Bilder rahmenlos — eine einzige Bildwand.',
  'reglages.apparence.fond': 'Animierter Hintergrund',
  'reglages.apparence.fondDetail':
    'Belebt den Himmel hinter den Bildern: Er dreht sich, Sternschnuppen ziehen vorbei, ' +
    'Nebel treiben. Ausgeschaltet bleibt der Himmel, unbewegt. Er steht auch von selbst ' +
    'still, wenn Windows weniger Animationen verlangt.',

  'reglages.demarrage.titre': 'Start',
  'reglages.demarrage.ouvrir': 'Alcora mit Windows öffnen',
  'reglages.demarrage.indisponible': 'Ausserhalb der installierten Anwendung nicht verfügbar.',
  'reglages.demarrage.detail': 'Die Anwendung startet, sobald du dich bei Windows anmeldest.',

  'reglages.confort.titre': 'Aufnahmen und Ton',
  'reglages.confort.dossier': 'Wohin die Standbilder gehen',
  'reglages.confort.changer': 'Ändern',
  'reglages.confort.son': 'Ton von Anfang an',
  'reglages.confort.sonDetail':
    'Standardmässig aus: eine Bildwand, die beim Start von selbst zu reden beginnt, ' +
    'wird schnell unerträglich. Der Ton wird Kamera für Kamera eingeschaltet, unter dem Bild.',

  'reglages.historique.titre': 'Was sich geändert hat',
  'reglages.historique.installee': 'installiert',

  'reglages.connexion.titre': 'Verbindung',
  'reglages.connexion.controleur': 'Controller',
  'reglages.connexion.compte': 'Konto',
  'reglages.connexion.identite': 'Identität geprüft',
  'reglages.connexion.oui': 'ja',
  'reglages.connexion.non': 'nein',
  'reglages.connexion.modifier': 'Verbindung ändern',
  'reglages.connexion.avertissement':
    'Das Passwort und der Zwei-Faktor-Schlüssel werden von diesem PC gelöscht, und der ' +
    'Anmeldebildschirm erscheint wieder. Die Kameras zeigen nichts mehr an, bis du sie ' +
    'neu eingibst.',
  'reglages.connexion.effacer': 'Löschen und neu eingeben',
  'reglages.connexion.annuler': 'Abbrechen',

  'reglages.probleme.titre': 'Wenn etwas nicht geht',
  'reglages.probleme.detail':
    'Alles, was die Anwendung tut, wird in eine Datei geschrieben. Diese Datei schickst ' +
    'du, wenn etwas nicht funktioniert.',

  'setup.titre': 'Verbindung zum Controller',
  'setup.sousTitre':
    'Die Anwendung fragt deinen Controller ab, um die Kameras zu finden. ' +
    'Nichts wird woandershin gesendet.',
  'setup.demo': 'Demomodus: es wird keine echte Verbindung aufgebaut.',

  'setup.etape.reseau': 'Controller erreichen',
  'setup.etape.certificat': 'Seine Identität prüfen',
  'setup.etape.identifiants': 'Anmelden',
  'setup.etape.inventaire': 'Kameras lesen',
  'setup.etape.flux': 'Streams prüfen',

  'setup.reprise.conservee': 'Eine frühere Verbindung ist auf diesem PC hinterlegt',
  'setup.reprise.detail': 'Du kannst sie übernehmen, ohne etwas neu einzutippen.',
  'setup.reprise.bouton': 'Diese Verbindung übernehmen',
  'setup.reprise.encours': 'Übernahme…',
  'setup.reprise.echec': 'Die Übernahme ist nicht durchgekommen. Gib die Zugangsdaten unten ein.',

  'setup.adresse.label': 'Adresse des Controllers',
  'setup.adresse.hint': 'Die IP-Adresse deiner UDM, deines Cloud Key oder UNVR.',

  'setup.guide.agrandir': 'Vergrössern',
  'setup.guide.reduire': 'Verkleinern',
  'setup.prealable.titre': 'Auf der Konsole vorzubereiten',
  'setup.prealable.rtsp':
    'RTSP auf jeder Kamera aktiviert (Protect → Kamera → Erweitert). Alcora fragt nie '
    + 'nach einer URL: sie liest die Adressen selbst, aber RTSP muss offen sein.',
  'setup.prealable.compte':
    'Ein eigenes Konto für Alcora mit Leserechten — nicht dein Besitzerkonto.',
  'setup.compte.titre': 'Konto',
  'setup.compte.identifiant': 'Benutzername',
  'setup.compte.identifiantHint':
    'Verwende ein Konto nur für diese Anwendung, mit eingeschränkten Rechten.',
  'setup.compte.motDePasse': 'Passwort',
  'setup.compte.masquerMdp': 'Passwort verbergen',
  'setup.compte.afficherMdp': 'Passwort anzeigen',
  'setup.compte.cle': 'Zwei-Faktor-Schlüssel',
  'setup.compte.clePlaceholder': 'leer lassen, wenn das Konto keinen hat',
  'setup.compte.masquerCle': 'Schlüssel verbergen',
  'setup.compte.afficherCle': 'Schlüssel anzeigen',

  'setup.aide.question': 'Wo findet man diesen Schlüssel?',
  'setup.aide.p1':
    'Wähle auf der Verwaltungsseite deines Ubiquiti-Kontos beim Hinzufügen einer ' +
    'Authenticator-App «manuelle Eingabe» statt den Code zu scannen: der Schlüssel wird ' +
    'dann ausgeschrieben angezeigt.',
  'setup.aide.p2':
    'Behalte denselben Schlüssel auch auf deinem Telefon. Wäre diese Anwendung seine ' +
    'einzige Trägerin, würde dich der Verlust dieses PCs aus deinem Konto aussperren.',

  'setup.verification.titre': 'Prüfung',
  'setup.verification.lent': 'Das dauert länger als erwartet…',
  'setup.verification.detailTechnique': 'Technisches Detail',
  'setup.verification.echecTest': 'Der Test konnte nicht zu Ende laufen.',

  'setup.cameras.titre': 'Gefundene Kameras',

  'setup.rester.titre': 'Angemeldet bleiben',
  'setup.rester.p1':
    'Um sich nach einem Neustart selbst wieder zu verbinden, behält die Anwendung auf ' +
    'diesem PC dein Passwort und den Schlüssel für die Einmalcodes — von Windows ' +
    'verschlüsselt, nur für dein Windows-Konto.',
  'setup.rester.p2':
    'Konkret: wer sich unter deinem Windows-Konto anmeldet, könnte sich ohne dein ' +
    'Telefon mit dem Controller verbinden. Gegen jemanden, der nur dein Passwort kennt, ' +
    'bleibt dein Konto hingegen geschützt.',
  'setup.rester.case': 'Auf diesem PC angemeldet bleiben',

  'setup.actions.tester': 'Verbindung testen',
  'setup.actions.enregistrer': 'Speichern und starten',
  'setup.actions.echecEnregistrement': 'Das Speichern ist nicht durchgekommen.',

  'colonne.controleur': 'Controller',
  'colonne.heure': 'Uhrzeit',
  'colonne.arme': 'scharf',
  'colonne.desarme': 'unscharf',
  'colonne.alarmesInactives': 'Alarme nicht eingerichtet',
  'colonne.detection': 'Erkennung',
  'colonne.aujourdhui': 'Heute',
  'colonne.nonLu': 'nicht gelesen',
  'colonne.enregistrements': 'Aufzeichnungen',
  'colonne.suspendu':
    'Die Aufzeichnung ist auf dem Controller ausgesetzt. Nichts Neues wird behalten.',
  'colonne.plusAncien': 'Ältestes',
  'colonne.profondeur': 'Tiefe',
  'colonne.pleineDefinition': 'Volle Auflösung',
  'colonne.pleineDefAnnoncee': 'Volle Aufl. angekündigt',
  'colonne.retentionAnnoncee': 'Angekündigte Aufbewahrung',
  'colonne.etatDisque': 'Zustand der Disk',
  'colonne.disqueNonHomologue': 'nicht zertifiziert',
  'colonne.disqueNonHomologueDetail':
    'Die Disk steht nicht auf der Liste von Ubiquiti. Sie zeichnet normal auf; nur ' +
    'deren Support behält sich eine Ablehnung vor.',
  'colonne.ecritParJour': 'Geschrieben pro Tag',
  'colonne.disque': 'Disk',
  'colonne.rotation': 'Automatische Rotation. Eine volle Disk ist normal.',
  'colonne.versions': 'Versionen',
  'colonne.disponible': 'Verfügbar',
  'colonne.allumeDepuis': 'Läuft seit',
  'colonne.aucuneImage': 'Kein Bild verlässt je dein Netzwerk.',

  'app.reessayer': 'Erneut versuchen',
  'app.aucuneCamera': 'Noch keine Kameras.',
  'app.derniereCamera': 'Die letzte sichtbare Kamera lässt sich nicht ausblenden',
  'app.reafficher': 'Wieder im Mosaik anzeigen',
  'app.masquerMosaique': 'Aus dem Mosaik ausblenden',
  'app.pleinEcranF11': 'Vollbild (F11)',
  'app.versionPrete': 'Version {version} bereit.',
  'app.redemarrerMaintenant': 'Jetzt neu starten',
  'app.plusTard': 'Später',
  'app.echapRevenir': 'Esc zum Zurückkehren',
  'app.quitterPleinEcranEchap': 'Vollbild verlassen (Esc)',
  'app.quitter': 'Verlassen',
  'app.pontTitre': 'Die Anwendung ist nicht korrekt gestartet.',
  'app.pontDetail1':
    'Die interne Verbindung kam nicht zustande. Schliesse die Anwendung und öffne sie ' +
    'wieder; passiert es erneut, schicke die Datei',
  'app.pontDetail2': 'aus dem Ordner',

  'relecture.hier': 'Gestern',
  'relecture.aucuneCamera': 'Keine Kamera.',
  'relecture.revenirDirect': 'Zurück zum Livebild',
  'relecture.revenirDirectTitre': 'Zurück zum Livebild',
  'relecture.jourPrecedent': 'Vorheriger Tag',
  'relecture.jourSuivant': 'Nächster Tag',
  'relecture.jourARelire': 'Wiederzugebender Tag',
  'relecture.inviteDirect': 'Klicke die Zeitleiste oder ein Vorschaubild, um in der Zeit zurückzugehen',
  'relecture.inviteSansRelais':
    'Klicke die Zeitleiste oder ein Vorschaubild, um zu sehen, was in dem Moment geschah.',
  'relecture.definitionReduite': 'reduzierte Auflösung',
  'relecture.extraction': 'Extraktion…',
  'relecture.filtre.tout': 'Alles',
  'relecture.filtre.personnes': 'Personen',
  'relecture.filtre.vehicules': 'Fahrzeuge',
  'relecture.filtre.animaux': 'Tiere',
  'relecture.filtre.sons': 'Geräusche',
  'relecture.detectionUne': 'Erkennung',
  'relecture.detectionPlusieurs': 'Erkennungen',
  'relecture.rienDetecte': 'An diesem Tag nichts erkannt.',
  'relecture.journeeEntiere': 'Ganzer Tag',
  'relecture.revoirJournee': 'Wieder den ganzen Tag sehen',
  'relecture.toutVoir': 'Alles sehen',
  'relecture.molette': 'Mausrad zum Zoomen, Klick zum Ansehen',
  'relecture.cliquerPourVoir': 'klicken zum Ansehen',

  'extrait.cameraInconnue': 'unbekannte Kamera',
  'extrait.enregistrer': 'Speichern',
  'extrait.enregistrerExtrait': 'Clip speichern',
  'extrait.extraction': 'Sequenz wird extrahiert…',
  'extrait.formatIndecodable':
    'Der Clip wurde geholt, aber sein Videoformat kann von der Anwendung nicht ' +
    'dekodiert werden. Speichere ihn, um ihn mit einem anderen Player zu öffnen.',
  'extrait.position': 'Position in der Sequenz',
  'extrait.enregistre': 'Gespeichert:',

  'recherche.chercher': 'Suchen',
  'recherche.placeholder': 'Kennzeichen oder Name…',
  'recherche.chercherAria': 'Ein Kennzeichen oder einen Namen suchen',
  'recherche.tolerante1':
    'Tolerante Suche: der Controller liefert mehrere mögliche Lesarten desselben ' +
    'Kennzeichens. Wer',
  'recherche.tolerante2': 'tippt, findet auch',
  'recherche.tolerante3': ', und die letzten Ziffern genügen.',
  'recherche.sujet': 'Motiv',
  'recherche.confiance': 'Mindestkonfidenz',
  'recherche.confianceDetail':
    'Gilt nur für sichtbare Motive. Geräuscherkennungen tragen keinen Wert — sie nach ' +
    'Konfidenz zu filtern würde sie alle entfernen.',
  'recherche.typeVehicule': 'Fahrzeugtyp',
  'recherche.couleur': 'Farbe',
  'recherche.camera': 'Kamera',
  'recherche.periode': 'Zeitraum',
  'recherche.periode7': '7 Tage',
  'recherche.periode30': '30 Tage',
  'recherche.enCours': 'Suche läuft…',
  'recherche.objetUn': 'Objekt',
  'recherche.objetPlusieurs': 'Objekte',
  'recherche.tronque': 'Nur die 300 jüngsten — grenze ein, um alles zu sehen',
  'recherche.filtrageNote': 'Motiv vom Controller gefiltert, der Rest hier',
  'recherche.rien': 'Nichts passt.',
  'recherche.rienSeuil': 'Die Mindestkonfidenz ist vielleicht zu hoch.',
  'recherche.rienTexte': 'Versuche weniger Zeichen — die letzten Ziffern genügen.',
  'recherche.identifie': 'Ein Kennzeichen oder ein Name wurde erkannt',

  'veilles.jours': 'So Mo Di Mi Do Fr Sa',
  'veilles.quand.toujours': 'Immer',
  'veilles.quand.toujoursAide': 'Auch unscharf, zu jeder Stunde',
  'veilles.quand.armee': 'Wenn die Wache aktiv ist',
  'veilles.quand.armeeAide': 'Folgt dem Schalter und seinen Zeiten',
  'veilles.quand.horaire': 'Nach meinem eigenen Zeitplan',
  'veilles.quand.horaireAide': 'Unabhängig vom Schalter',
  'veilles.presqueJamais': 'fast nie',
  'veilles.parJour': '~{n} pro Tag',
  'veilles.lectureEchouee': 'Die Wachen konnten nicht gelesen werden.',
  'veilles.active': 'Wache aktiv',
  'veilles.desactivee': 'Wache ausgeschaltet',
  'veilles.profil': 'Profil {nom}',
  'veilles.enregistre': 'Gespeichert',
  'veilles.independant':
    'Dieser Schalter gehört Alcora und ist von der Scharfschaltung von Protect ' +
    'unabhängig. Beide können sich unterscheiden: Alcora meldet auf diesem PC, auch ' +
    'wenn Protect still bleibt.',
  'veilles.activerCourt': 'Einschalten',
  'veilles.desactiverCourt': 'Ausschalten',
  'veilles.toutesCameras': 'alle Kameras',
  'veilles.volumesIndisponibles':
    'Die Mengen der letzten sieben Tage konnten nicht gelesen werden: die Schätzungen ' +
    'bleiben leer, solange der Controller nicht erreichbar ist.',
  'veilles.declenche': 'Was auslöst',
  'veilles.surCameras': 'Auf welchen Kameras',
  'veilles.quandTitre': 'Wann',
  'veilles.selonHoraire': 'Nach welchem Zeitplan',
  'veilles.enPermanence': 'Durchgehend',
  'veilles.ceQueCaFait': 'Was sie tut',
  'veilles.son': 'Ton',
  'veilles.retenue': 'höchstens eine Meldung alle',
  'veilles.retenueDetail':
    'Wer im Bild bleibt, erzeugt alle fünfzehn Sekunden eine Erkennung. Ohne diese ' +
    'Zurückhaltung: ebenso viele Meldungen.',

  'ciel.etape.maj': 'Nach Updates suchen',
  'ciel.etape.session': 'Sitzung öffnen',
  'ciel.etape.cameras': 'Kameras lesen',
  'ciel.etape.flux': 'Videostream starten',
  'ciel.etape.relier': 'Kameras verbinden',
  'ciel.telechargement': 'Version {version} wird geladen…',
  'ciel.controle': 'Paket wird geprüft…',
  'ciel.installation': 'Installation…',
  'ciel.empreinte': 'SHA-256-Prüfsumme',
  'ciel.vaRedemarrer': 'die Anwendung startet neu',
  'ciel.rechercheMaj': 'Suche nach einem Update…',
  'ciel.fluxPret': 'Videostream bereit',
  'ciel.connexion': 'Verbindung zum Controller',
  'ciel.versLa': 'auf Version {version}',
  'ciel.redemarreSeule': 'Die Anwendung startet von selbst neu und öffnet sich aktuell.',

  'etape.nonVerifie': 'Nicht geprüft.',
  'etape.contact': 'Controller wird kontaktiert…',
  'etape.verifIdentite': 'Identität wird geprüft…',
  'etape.connexionEnCours': 'Verbindung…',
  'etape.repond': '{host} antwortet auf Port 443.',
  'etape.premierAppairage': 'Erste Kopplung: die Identität wurde erfasst.',
  'etape.connexionAcceptee': 'Verbindung angenommen. Sitzung {jours} Tage gültig.',
  'etape.lectureCameras': 'Kameras werden gelesen…',
  'etape.camerasTrouvees': '{n} Kamera(s) auf {nvr} gefunden (Protect {version}).',
  'etape.verifFlux': 'Streams werden geprüft…',
  'etape.diffusables': '{n} Kamera(s) streambar auf Port {port}.',
  'erreur.nomNonResolu': 'Der Name «{host}» konnte nicht aufgelöst werden.',
  'erreur.nomNonResoluRemede': 'Gib direkt die IP-Adresse des Controllers ein.',
  'erreur.identifiants': 'Benutzername oder Passwort abgelehnt.',
  'erreur.identifiantsRemede': 'Prüfe die E-Mail-Adresse des Kontos und sein Passwort.',
  'erreur.totpRefuse': 'Der Zwei-Faktor-Code wurde abgelehnt.',
  'erreur.totpVerifieCle': 'Prüfe den eingegebenen Schlüssel: er muss vom Einrichtungsbildschirm stammen.',
  'relais.pret': 'Videostream bereit.',

  'tuile.capturee': 'gespeichert: {nom}',
  'tuile.captureImpossible': 'Aufnahme fehlgeschlagen',
  'tuile.fluxIndisponible': 'Stream nicht verfügbar',
  'tuile.connexion': 'Verbindung…',
  'tuile.revoir': 'Diese Kamera wiedergeben',
  'tuile.detections': 'Ihre Erkennungen',
  'tuile.ecouter': 'Diese Kamera anhören',

  // Page Systeme (direction Observatoire, 23.10.2026)
  'espace.systeme': 'System',
  'systeme.precision': 'Der Controller, seine Aufnahmen und jede Kamera, aus Sicht von Alcora',
  'systeme.journal': 'Protokoll der Anwendung',
  'systeme.journalTitre': 'Ordner des Protokolls öffnen',
  'systeme.cameras': 'Kameras',
  'systeme.toutesEnLigne': '{n}, alle online',
  'systeme.dontHorsLigne': '{n}, davon {h} offline',
  'systeme.colCamera': 'Kamera',
  'systeme.colEtat': 'Zustand',
  'systeme.colFlux': 'Streams',
  'systeme.colArchive': 'Archiv',
  'systeme.colDetection': 'Letzte Erkennung',
  'systeme.colMosaique': 'Mosaik',
  'systeme.enLigne': 'Online',
  'systeme.horsLigne': 'Offline',
  'systeme.depuisLe': 'seit {date}',
  'systeme.pleineDef': 'volle Auflösung {duree}',
  'systeme.ilYa': 'vor {duree}',
  'systeme.aucuneAujourdhui': 'heute keine',
  'systeme.inconnue': 'unbekannt',
  'systeme.affichee': 'Angezeigt',
  'systeme.masquee': 'Ausgeblendet',
  'unite.ips': 'B/s',
  'unite.mbits': 'Mbit/s',

  // Barre d'etat et raccourcis clavier (direction Observatoire, 23.10.2026)
  'barre.archive': 'Archiv',
  'barre.suspendu': 'Aufzeichnung ausgesetzt',
  'barre.uneHorsLigne': '1 Kamera offline',
  'barre.horsLigne': '{n} Kameras offline',
  'barre.prive': 'Kein Bild verlässt je dein Netzwerk',
  'barre.raccourcis': 'Tastenkürzel',
  'barre.raccourcisTitre': 'Tastenkürzel (?)',
  'raccourcis.titre': 'Tastenkürzel',
  'raccourcis.sequence': 'Sequenz einer Erkennung',
  'raccourcis.partout': 'Überall',
  'raccourcis.a': 'bis',
  'raccourcis.isoler': 'Die entsprechende Kamera isolieren',
  'raccourcis.mosaique': 'Zurück zum Mosaik',
  'raccourcis.doubleClic': 'Doppelklick',
  'raccourcis.doubleClicFait': 'Ein Bild isolieren, oder zurück',
  'raccourcis.glisser': 'Ziehen',
  'raccourcis.glisserFait': 'Das Mosaik neu ordnen; in einem vergrösserten Bild darin verschieben',
  'raccourcis.molette': 'Mausrad',
  'raccourcis.moletteFait': 'Ins Bild zoomen',
  'raccourcis.zoomIsolee': 'Die isolierte Kamera vergrössern oder verkleinern',
  'raccourcis.echapDirect': 'Zurück zum Mosaik, dann Vollbild verlassen',
  'raccourcis.lecture': 'Wiedergabe oder Pause',
  'raccourcis.dixSecondes': '10 s zurück oder vor',
  'raccourcis.zoomer': 'Vergrössern oder verkleinern',
  'raccourcis.clicFrise': 'Klick auf die Zeitleiste',
  'raccourcis.clicFriseFait': 'Zu diesem Moment springen',
  'raccourcis.moletteFrise': 'Mausrad auf der Zeitleiste',
  'raccourcis.moletteFriseFait': 'Den Tag eingrenzen, bis auf die Minute',
  'raccourcis.imageParImage': 'Bild für Bild',
  'raccourcis.afficher': 'Diese Tastenkürzel anzeigen',
  'touche.espace': 'Leertaste',
  'touche.echap': 'Esc',

  // Direct, rail et colonne Activite (direction Observatoire, 23.10.2026)
  'rail.espaces': 'Bereiche',
  'direct.une': '1 Kamera',
  'direct.toutes': '{n} Kameras',
  'direct.uneSur': '1 von {total} Kameras angezeigt',
  'direct.surTotal': '{n} von {total} Kameras angezeigt',
  'direct.isolee': '{nom}, allein im Bild',
  'direct.indice': 'Ziehen verschiebt ein Bild. Ein Doppelklick oder die Tasten 1 bis 9 isolieren es.',
  'direct.indiceIsolee': 'Ein Doppelklick, 0 oder Esc bringen das Mosaik zurück.',
  'activite.titre': 'Aktivität',
  'activite.masquer': 'Aktivität ausblenden',
  'activite.afficher': 'Aktivität anzeigen',
  'activite.recentes': 'Neueste',
  'activite.aucune': 'Heute keine Erkennung.',
  'activite.toutes': 'Alle Erkennungen',

  // Bandeau des tuiles (direction Observatoire, 23.10.2026)
  'tuile.revoirCourt': 'Wiedergabe',
  'tuile.detectionsCourt': 'Erkennungen',
  'tuile.imageCourt': 'Bild',
  'tuile.sonCourt': 'Ton',
  'tuile.reprise': 'Neuer Versuch in {n} s',

  // Revue du groupe Direct (23.10.2026)
  'systeme.seuleEnLigne': '1, online',
  'systeme.seuleHorsLigne': '1, offline',

  // Liens d'une detection vers la relecture (23.10.2026)
  'activite.revoir': 'Diesen Moment wiedergeben',
  'extrait.voirRelecture': 'In der Wiedergabe ansehen',

  // Relecture (direction Observatoire, 23.10.2026)
  'video.imageEntiere': 'Ganzes Bild',
  'relecture.vitesse': 'Wiedergabegeschwindigkeit',

  // Detections (direction Observatoire, 23.10.2026) : couleurs nommees, en-tete, etats
  'couleur.gray': 'Grau',
  'couleur.white': 'Weiss',
  'couleur.black': 'Schwarz',
  'couleur.blue': 'Blau',
  'couleur.yellow': 'Gelb',
  'couleur.red': 'Rot',
  'couleur.green': 'Grün',
  'couleur.brown': 'Braun',
  'couleur.silver': 'Silber',
  'couleur.orange': 'Orange',
  'couleur.beige': 'Beige',
  'recherche.toutesCameras': 'Alle Kameras',
  'recherche.nCameras': '{n} Kameras',
  'recherche.retirerSeuil': 'Mindestkonfidenz entfernen',
  'recherche.revoirCourt': 'Wiedergabe',

  // Alertes (direction Observatoire, 23.10.2026)
  'veilles.precision': 'Was eine Warnung von Alcora auf diesem PC verdient, und wann',

  // Reglages : sommaire, Aide, A propos (direction Observatoire, 23.10.2026)
  'reglages.sommaire': 'Abschnitte',
  'reglages.aide.titre': 'Hilfe',
  'reglages.aide.raccourcisDetail': 'Alle Tastatur- und Mausgesten, Bildschirm für Bildschirm. Die Taste «?» zeigt sie überall.',
  'reglages.aide.voirRaccourcis': 'Tastenkürzel anzeigen',
  'reglages.aide.guide': 'RTSP auf der Konsole aktivieren',
  'reglages.aide.guideDetail': 'Die Schritt-für-Schritt-Anleitung, dieselbe wie auf dem Verbindungsbildschirm.',
  'reglages.aide.ouvrirGuide': 'Anleitung öffnen',
  'reglages.apropos.titre': 'Über Alcora',
  'reglages.apropos.alcora': 'Desktop-Client für UniFi Protect, vollständig lokal. Nicht mit Ubiquiti verbunden.',
  'reglages.apropos.moteur': 'Laufzeitumgebung',
  'reglages.apropos.relais': 'Video-Relais',
  'reglages.apropos.licence': 'Lizenz',
  'reglages.apropos.licenceDetail': 'GPL-3.0 — © Thomas. Der Quellcode ist öffentlich; jedes abgeleitete Werk muss es bleiben.',
  'reglages.apropos.source': 'Quellcode',
  'reglages.apropos.tiers': 'Komponenten von Drittanbietern',
  'reglages.apropos.tiersDetail': 'Die Lizenzen jeder mitgelieferten Bibliothek.',
  'reglages.apropos.voirLicences': 'Lizenzen anzeigen',
  'reglages.apropos.licencesAbsentes': 'Die Lizenzdatei ist in dieser Installation nicht zu finden.',
  'reglages.apropos.site': 'Website',

  // Sequence d'une detection (direction Observatoire, 23.10.2026)
  'extrait.duree': 'Sequenz von {n} s rund um die Erkennung',

  // Revue des groupes 2 a 7 (23.10.2026)
  'veilles.interrupteur': 'Wache von Alcora',

  // Mise a jour refusee, raison dite (23.10.2026)
  'reglages.version.refusee': 'Die Version {version} wurde abgelehnt: Sie trägt nicht die Signatur von Alcora. Die installierte Version bleibt in Betrieb.',

  // Export d'une plage de la relecture (maquette docs/maquette-export-plage.html, 23.10.2026)
  'unite.mo': 'MB',
  'export.debut': 'Anfang',
  'export.debutTitre': 'Anfang des zu exportierenden Zeitraums: der wiedergegebene Moment (Taste I)',
  'export.fin': 'Ende',
  'export.finTitre': 'Ende des zu exportierenden Zeitraums: der wiedergegebene Moment (Taste O)',
  'export.plage': 'Zeitraum',
  'export.poseFin': 'Setze das Ende beim gewünschten Moment: Schaltfläche «Ende» oder Taste O.',
  'export.poseDebut': 'Setze den Anfang beim gewünschten Moment: Schaltfläche «Anfang» oder Taste I.',
  'export.effacer': 'Löschen',
  'export.exporter': 'Exportieren…',
  'export.exporterParties': 'In {n} Dateien exportieren…',
  'export.environ': 'etwa {taille}',
  'export.tailleInconnue': 'Grösse wird beim Start des Exports angegeben',
  'export.sonCompris': 'mit Ton',
  'export.sansSon': 'ohne Ton',
  'export.imagesCles': 'Auf wenige Sekunden genau: Der Controller schneidet an Schlüsselbildern, das Video reicht also auf beiden Seiten etwas weiter.',
  'export.parties': 'Mehr als eine Stunde: {n} Dateien von höchstens einer Stunde, nacheinander.',
  'export.frontiere': 'Vor dem {date} ist nur noch die niedrige Auflösung vorhanden.',
  'export.finRamenee': 'Ende auf {heure} zurückgesetzt: Danach ist noch nichts aufgezeichnet.',
  'export.export': 'Export',
  'export.progression': '{recu} von {total}',
  'export.restant': 'noch {duree}',
  'export.fichierSur': 'Datei {i} von {n}',
  'export.continuer': 'Du kannst weiter wiedergeben oder den Bildschirm wechseln: Der Export läuft weiter, die Statusleiste zeigt ihn an.',
  'export.annuler': 'Abbrechen',
  'export.enregistree': 'Gespeichert',
  'export.enregistrees': '{n} Dateien gespeichert',
  'export.afficher': 'Im Ordner zeigen',
  'export.effacerPlage': 'Zeitraum löschen',
  'export.heureVide': 'Eine Stunde ohne Aufzeichnung wurde übersprungen.',
  'export.heuresVides': '{n} Stunden ohne Aufzeichnung wurden übersprungen.',
  'export.annule': 'Export abgebrochen: Nichts wurde gespeichert.',
  'export.annuleTitre': 'Abgebrochen',
  'export.faitUn': 'Die erste, vollständige Datei bleibt erhalten.',
  'export.faitsPlusieurs': 'Die ersten {n} vollständigen Dateien bleiben erhalten.',
  'export.reessayer': 'Erneut versuchen',
  'export.occupe': 'Ein Export läuft bereits ({camera}, {pourcent} %): immer nur einer, um den Controller nicht zu überlasten.',
  'export.raison.vide': 'In diesem Zeitraum wurde nichts aufgezeichnet – die Kamera war vielleicht offline. Es wurde keine Datei erstellt.',
  'export.raison.place': 'Nicht genug Platz auf dem gewählten Laufwerk. Wähle einen anderen Ordner oder schaffe Platz.',
  'export.raison.existe': 'Die Datei «{fichier}» existiert dort bereits: Nichts wurde überschrieben. Wähle einen anderen Namen oder Ordner.',
  'export.raison.interrompu': 'Der Export wurde unterbrochen: Der Controller antwortet nicht mehr. Die unvollständige Datei wurde gelöscht.',
  'export.raison.refuse': 'Der Controller hat den Export verweigert ({statut}).',
  'export.raison.session': 'Noch ist keine Sitzung mit dem Controller geöffnet.',
  'export.raison.ecriture': 'In den gewählten Ordner kann nicht geschrieben werden. Wähle einen anderen.',
  'export.raison.plage': 'Dieser Zeitraum ist leer oder zu kurz.',
  'export.raison.occupe': 'Ein Export läuft bereits: immer nur einer.',
  'export.barreTitre': 'Export des Zeitraums {camera}, {debut} → {fin} – ein Klick führt zur Wiedergabe',
  'raccourcis.debutPlage': 'Anfang des zu exportierenden Zeitraums',
  'raccourcis.finPlage': 'Ende des zu exportierenden Zeitraums',

  // Historique des alertes (maquette docs/maquette-historique-alertes.html, 23.10.2026)
  'historique.onglets': 'Ansicht des Alarm-Bildschirms',
  'historique.ongletVeilles': 'Wachen',
  'historique.onglet': 'Verlauf',
  'historique.precision': 'Was die Wachen gesendet haben, 90 Tage auf diesem PC aufbewahrt',
  'historique.uneNonVue': '1 ungesehener Alarm',
  'historique.nonVues': '{n} ungesehene Alarme',
  'historique.vide': 'Noch kein Alarm gesendet',
  'historique.videDetail': 'Wenn eine Wache warnt, erscheint der Alarm hier – auch wenn niemand die Meldung gesehen hat.',
  'historique.filtre': 'Alarme zeigen von',
  'historique.toutes': 'Alle',
  'historique.uneAlerte': '1 Alarm',
  'historique.alertes': '{n} Alarme',
  'historique.ilYa': 'vor {duree}',
  'historique.avecSon': 'mit Ton',
  'historique.sansSon': 'ohne Ton',
  'historique.sansImage': 'Meldung ohne Bild',
  'historique.sansImageTitre': 'Der Schnappschuss kam nicht rechtzeitig: Die Meldung ging ohne Bild hinaus, um nicht zu spät zu warnen.',
  'historique.uneRetenue': '+1 zurückgehalten',
  'historique.retenues': '+{n} zurückgehalten',
  'historique.retenuesTitre': 'Die folgenden Erkennungen dieser Wache für dieses Motiv, von der Zurückhaltung unterdrückt: höchstens eine Meldung pro gewählter Dauer.',
  'historique.revoir': 'Wiedergeben',
  'historique.revoirTitre': 'Ab diesem Moment wiedergeben',
  'historique.sequence': 'Sequenz',
  'historique.sequenceTitre': 'Sequenz öffnen',
  'historique.garde': '90 Tage auf diesem PC aufbewahrt, nie anderswo.',
  'historique.effacerTout': 'Verlauf löschen',
  'historique.confirmer': 'Die {n} Alarme aus dem Verlauf löschen? Die Wachen selbst ändern sich nicht.',
  'historique.annuler': 'Abbrechen',
  'historique.effacer': 'Löschen',
};
