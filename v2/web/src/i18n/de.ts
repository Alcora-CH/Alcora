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

  'canal.haute': 'HOCH',
  'canal.moyenne': 'MITTEL',
  'canal.basse': 'NIEDRIG',
  'canal.colis': 'PAKET',

  'video.revenirImage': 'Zurück zum ganzen Bild ({zoom}×)',
  'video.couperSon': 'Ton aus',
  'video.activerSon': 'Ton einschalten',
  'video.pasDeSon': 'Dieser Stream führt keinen Ton',
  'video.capturer': 'Standbild speichern',
  'video.pleinEcran': 'Vollbild',
  'video.quitterPleinEcran': 'Vollbild verlassen',
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
    'Das Planetarium hinter den Bildern: Sterne, Sternschnuppen, Nebel. Es steht von ' +
    'selbst still, wenn Windows weniger Animationen verlangt.',

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
  'colonne.detectionsRecentes': 'Jüngste Erkennungen',
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

  'app.titrePanneau': 'Überwachung',
  'app.etat': 'Status',
  'app.reessayer': 'Erneut versuchen',
  'app.cameras': 'Kameras',
  'app.aucuneCamera': 'Noch keine Kameras.',
  'app.afficherCamera': '{nom} anzeigen',
  'app.masquerCamera': '{nom} ausblenden',
  'app.derniereCamera': 'Die letzte sichtbare Kamera lässt sich nicht ausblenden',
  'app.reafficher': 'Wieder im Mosaik anzeigen',
  'app.masquerMosaique': 'Aus dem Mosaik ausblenden',
  'app.reduirePanneau': 'Panel einklappen',
  'app.epinglerPanneau': 'Panel anheften',
  'app.pleinEcranF11': 'Vollbild (F11)',
  'app.versionPrete': 'Version {version} bereit.',
  'app.redemarrerMaintenant': 'Jetzt neu starten',
  'app.plusTard': 'Später',
  'app.echapRevenir': 'Esc zum Zurückkehren',
  'app.afficherPanneau': 'Panel anzeigen',
  'app.quitterPleinEcranEchap': 'Vollbild verlassen (Esc)',
  'app.quitter': 'Verlassen',
  'app.revenirMosaique': 'Doppelklick, um zum Mosaik zurückzukehren',
  'app.glisserIsoler': 'Ziehen zum Umordnen · Doppelklick zum Isolieren',
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
  'relecture.journeeEntiere': 'ganzer Tag',
  'relecture.revoirJournee': 'Wieder den ganzen Tag sehen',
  'relecture.toutVoir': 'alles sehen',
  'relecture.molette': 'Mausrad zum Zoomen',
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
  'recherche.tronque': 'nur die 300 jüngsten — grenze ein, um alles zu sehen',
  'recherche.filtrageNote': 'Motiv vom Controller gefiltert, der Rest hier',
  'recherche.rien': 'Nichts passt.',
  'recherche.rienSeuil': 'Die Mindestkonfidenz ist vielleicht zu hoch.',
  'recherche.rienTexte': 'Versuche weniger Zeichen — die letzten Ziffern genügen.',
  'recherche.identifie': 'Ein Kennzeichen oder ein Name wurde erkannt',

  'veilles.jours': 'So Mo Di Mi Do Fr Sa',
  'veilles.quand.toujours': 'Immer',
  'veilles.quand.toujoursAide': 'auch unscharf, zu jeder Stunde',
  'veilles.quand.armee': 'Wenn die Wache aktiv ist',
  'veilles.quand.armeeAide': 'folgt dem Schalter und seinen Zeiten',
  'veilles.quand.horaire': 'Nach meinem eigenen Zeitplan',
  'veilles.quand.horaireAide': 'unabhängig vom Schalter',
  'veilles.presqueJamais': 'fast nie',
  'veilles.parJour': '~{n} pro Tag',
  'veilles.lectureEchouee': 'Die Wachen konnten nicht gelesen werden.',
  'veilles.activer': 'Wache einschalten',
  'veilles.desactiver': 'Wache ausschalten',
  'veilles.active': 'Wache aktiv',
  'veilles.desactivee': 'Wache ausgeschaltet',
  'veilles.profil': 'Profil {nom}',
  'veilles.enregistre': 'gespeichert',
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
};
