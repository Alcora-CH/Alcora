import type { Cle } from './fr';

/**
 * La traduction italienne.
 *
 * Meme contrat que l'anglais : `Record<Cle, string>` — une cle manquante ou inventee
 * arrete la compilation, donc `npm test`.
 *
 * Tutoiement (« tu »), comme le francais — c'est le ton de l'application. Locale it-CH.
 */
export const it: Record<Cle, string> = {
  'espace.direct': 'Diretta',
  'espace.detections': 'Rilevamenti',
  'espace.relecture': 'Riproduzione',
  'espace.alertes': 'Avvisi',
  'espace.reglages': 'Impostazioni',
  'espace.prochainLot': 'Questo spazio arriva in una prossima versione.',

  'canal.haute': 'ALTA',
  'canal.moyenne': 'MEDIA',
  'canal.basse': 'BASSA',
  'canal.colis': 'PACCO',

  'video.revenirImage': 'Torna all’immagine intera ({zoom}×)',
  'video.couperSon': 'Silenzia',
  'video.activerSon': 'Attiva l’audio',
  'video.pasDeSon': 'Questo flusso non porta audio',
  'video.capturer': 'Salva un fermo immagine',
  'video.pleinEcran': 'Schermo intero',
  'video.quitterPleinEcran': 'Esci dallo schermo intero',
  'video.interpole': 'interpolato',
  'video.pause': 'Pausa',
  'video.lecture': 'Riproduci',
  'video.imagePrecedente': 'Fotogramma precedente',
  'video.imageSuivante': 'Fotogramma successivo',
  'video.sequenceIllisible': 'Questa sequenza non può essere letta qui.',
  'video.imageIndisponible': 'Immagine non disponibile',
  'video.imageEnregistree': 'Immagine salvata: {chemin}',

  'nouveautes.titre': 'Alcora si è aggiornata',
  'nouveautes.depuis': 'Cosa è cambiato dalla versione {version}',
  'nouveautes.compris': 'Capito',

  'commun.ouvrirDossier': 'Apri la cartella',
  'commun.horsLigne': 'offline',
  'commun.aucunFlux': 'nessun flusso',
  'camera.rtspDesactive': 'RTSP disattivato',
  'camera.guide': 'Vedi la guida, passo dopo passo',
  'camera.rtspRemede':
    'Questa telecamera non trasmette: attiva l’RTSP in Protect, sulla telecamera, '
    + 'sezione Avanzate. Alcora la riprenderà da sola.',
  'commun.fermer': 'Chiudi',
  'commun.fermerEchap': 'Chiudi (Esc)',
  'commun.toutes': 'Tutte',

  'unite.j': 'g',
  'unite.mois': 'mesi',
  'unite.to': 'TB',
  'unite.go': 'GB',

  'sujet.person': 'Persona',
  'sujet.vehicle': 'Veicolo',
  'sujet.animal': 'Animale',
  'sujet.face': 'Volto',
  'sujet.licensePlate': 'Targa',
  'sujet.alrmSpeak': 'Voce',
  'sujet.alrmBark': 'Abbaio',
  'sujet.alrmCarHorn': 'Clacson',
  'sujet.alrmSmoke': 'Fumo',
  'sujet.alrmGlassBreak': 'Vetro rotto',
  'sujet.motion': 'Movimento',
  'sujet.sonDetecte': 'Suono rilevato',
  'sujet.son': 'Suono',
  'sujet.package': 'Pacco',
  'sujet.sirene': 'Sirena',
  'sujet.monoxyde': 'Monossido',
  'sujet.pleurs': 'Pianto',

  'vehicule.suv': 'SUV',
  'vehicule.car': 'Auto',
  'vehicule.van': 'Furgone',
  'vehicule.truck': 'Camion',
  'vehicule.motorcycle': 'Moto',
  'vehicule.bike': 'Bicicletta',
  'vehicule.bus': 'Bus',

  'reglages.titre': 'Impostazioni',
  'reglages.sousTitre': 'Versione installata, connessione al controller, e dove trovare il registro.',

  'reglages.version.titre': 'Versione',
  'reglages.version.verification': 'Verifica in corso…',
  'reglages.version.telechargement': 'Scaricamento della {version}… {pourcent} %',
  'reglages.version.prete': 'La versione {version} è pronta: riavvia per applicarla.',
  'reglages.version.erreur': 'La verifica degli aggiornamenti non è andata a buon fine. Riproverà da sola.',
  'reglages.version.repos':
    'L’applicazione verifica da sola le nuove versioni, le scarica in silenzio, ' +
    'poi propone di riavviare.',
  'reglages.version.manuelle':
    'Su questa piattaforma l’aggiornamento è manuale: scarica la nuova versione da ' +
    'alcora.ch, poi sostituisci l’applicazione.',
  'reglages.version.verifier': 'Verifica ora',

  'reglages.langue.titre': 'Lingua',
  'reglages.langue.detail':
    'L’interfaccia e le notifiche. «Automatica» segue la lingua di Windows.',
  'reglages.langue.auto': 'Automatica',

  'reglages.apparence.titre': 'Aspetto',
  'reglages.apparence.espacement': 'Spazio tra le viste',
  'reglages.apparence.aucun': 'nessuno',
  'reglages.apparence.detail':
    'Con «nessuno», le immagini si toccano, senza cornice — un solo muro di immagini.',
  'reglages.apparence.fond': 'Sfondo animato',
  'reglages.apparence.fondDetail':
    'Il planetario dietro le immagini: stelle, stelle cadenti, nebulose. Si ferma da ' +
    'solo se Windows chiede di ridurre le animazioni.',

  'reglages.demarrage.titre': 'Avvio',
  'reglages.demarrage.ouvrir': 'Apri Alcora con Windows',
  'reglages.demarrage.indisponible': 'Non disponibile fuori dall’applicazione installata.',
  'reglages.demarrage.detail': 'L’applicazione si avvia appena accedi a Windows.',

  'reglages.confort.titre': 'Catture e audio',
  'reglages.confort.dossier': 'Dove vanno le catture',
  'reglages.confort.changer': 'Cambia',
  'reglages.confort.son': 'Audio attivo dall’inizio',
  'reglages.confort.sonDetail':
    'Spento per impostazione: un muro di immagini che si mette a parlare da solo ' +
    'all’avvio diventa presto insopportabile. L’audio si attiva telecamera per ' +
    'telecamera, sotto l’immagine.',

  'reglages.historique.titre': 'Cosa è cambiato',
  'reglages.historique.installee': 'installata',

  'reglages.connexion.titre': 'Connessione',
  'reglages.connexion.controleur': 'Controller',
  'reglages.connexion.compte': 'Account',
  'reglages.connexion.identite': 'Identità verificata',
  'reglages.connexion.oui': 'sì',
  'reglages.connexion.non': 'no',
  'reglages.connexion.modifier': 'Modifica la connessione',
  'reglages.connexion.avertissement':
    'La password e la chiave a due fattori saranno cancellate da questo PC, e la ' +
    'schermata di accesso riapparirà. Le telecamere smetteranno di mostrarsi finché ' +
    'non le reinserisci.',
  'reglages.connexion.effacer': 'Cancella e reinserisci',
  'reglages.connexion.annuler': 'Annulla',

  'reglages.probleme.titre': 'Se qualcosa non va',
  'reglages.probleme.detail':
    'Tutto ciò che fa l’applicazione è scritto in un file. È quel file da inviare ' +
    'quando qualcosa non funziona.',

  'setup.titre': 'Connessione al controller',
  'setup.sousTitre':
    'L’applicazione interroga il tuo controller per scoprire le telecamere. ' +
    'Nulla è inviato altrove.',
  'setup.demo': 'Modalità dimostrazione: nessuna connessione reale è stabilita.',

  'setup.etape.reseau': 'Raggiungere il controller',
  'setup.etape.certificat': 'Verificare la sua identità',
  'setup.etape.identifiants': 'Autenticarsi',
  'setup.etape.inventaire': 'Leggere le telecamere',
  'setup.etape.flux': 'Verificare i flussi',

  'setup.reprise.conservee': 'Una connessione precedente è conservata su questo PC',
  'setup.reprise.detail': 'Puoi riprenderla senza reinserire nulla.',
  'setup.reprise.bouton': 'Riprendi questa connessione',
  'setup.reprise.encours': 'Ripresa…',
  'setup.reprise.echec': 'La ripresa non è andata a buon fine. Inserisci le credenziali qui sotto.',

  'setup.adresse.label': 'Indirizzo del controller',
  'setup.adresse.hint': 'L’indirizzo IP del tuo UDM, Cloud Key o UNVR.',

  'setup.prealable.titre': 'Da preparare sulla console',
  'setup.prealable.rtsp':
    'L’RTSP attivo su ogni telecamera (Protect → telecamera → Avanzate). Alcora non '
    + 'chiede mai un URL: legge gli indirizzi da sola, ma l’RTSP deve essere aperto.',
  'setup.prealable.compte':
    'Un account dedicato ad Alcora, con diritti di visione — non il tuo account proprietario.',
  'setup.compte.titre': 'Account',
  'setup.compte.identifiant': 'Nome utente',
  'setup.compte.identifiantHint':
    'Usa un account dedicato a questa applicazione, con diritti limitati.',
  'setup.compte.motDePasse': 'Password',
  'setup.compte.masquerMdp': 'Nascondi la password',
  'setup.compte.afficherMdp': 'Mostra la password',
  'setup.compte.cle': 'Chiave di autenticazione a due fattori',
  'setup.compte.clePlaceholder': 'lascia vuoto se l’account non ne ha',
  'setup.compte.masquerCle': 'Nascondi la chiave',
  'setup.compte.afficherCle': 'Mostra la chiave',

  'setup.aide.question': 'Dove trovare questa chiave?',
  'setup.aide.p1':
    'Sul sito di gestione del tuo account Ubiquiti, quando aggiungi un’app di ' +
    'autenticazione, scegli «inserimento manuale» invece di scansionare il codice: la ' +
    'chiave viene allora mostrata per esteso.',
  'setup.aide.p2':
    'Tieni la stessa chiave anche sul telefono. Se questa applicazione ne diventasse ' +
    'l’unica custode, perdere questo PC ti chiuderebbe fuori dal tuo account.',

  'setup.verification.titre': 'Verifica',
  'setup.verification.lent': 'Sta durando più del previsto…',
  'setup.verification.detailTechnique': 'Dettaglio tecnico',
  'setup.verification.echecTest': 'Il test non è potuto arrivare in fondo.',

  'setup.cameras.titre': 'Telecamere trovate',

  'setup.rester.titre': 'Rimanere connessi',
  'setup.rester.p1':
    'Per riconnettersi da sola dopo un riavvio, l’applicazione conserva su questo PC la ' +
    'tua password e la chiave che produce i codici monouso, cifrate da Windows solo per ' +
    'il tuo account Windows.',
  'setup.rester.p2':
    'In concreto: chi aprisse una sessione con il tuo account Windows potrebbe ' +
    'connettersi al controller senza avere il tuo telefono. Il tuo account resta invece ' +
    'protetto da chi conoscesse solo la tua password.',
  'setup.rester.case': 'Rimani connesso su questo PC',

  'setup.actions.tester': 'Prova la connessione',
  'setup.actions.enregistrer': 'Salva e avvia',
  'setup.actions.echecEnregistrement': 'Il salvataggio non è andato a buon fine.',

  'colonne.controleur': 'Controller',
  'colonne.heure': 'Ora',
  'colonne.arme': 'attivato',
  'colonne.desarme': 'disattivato',
  'colonne.alarmesInactives': 'allarmi non configurati',
  'colonne.detectionsRecentes': 'Rilevamenti recenti',
  'colonne.detection': 'Rilevamento',
  'colonne.aujourdhui': 'Oggi',
  'colonne.nonLu': 'non letto',
  'colonne.enregistrements': 'Registrazioni',
  'colonne.suspendu':
    'La registrazione è sospesa sul controller. Nulla di nuovo viene conservato.',
  'colonne.plusAncien': 'Più antico',
  'colonne.profondeur': 'Profondità',
  'colonne.pleineDefinition': 'Piena definizione',
  'colonne.pleineDefAnnoncee': 'Piena def. annunciata',
  'colonne.retentionAnnoncee': 'Conservazione annunciata',
  'colonne.etatDisque': 'Stato del disco',
  'colonne.disqueNonHomologue': 'non certificato',
  'colonne.disqueNonHomologueDetail':
    'Il disco non figura nella lista di Ubiquiti. Registra normalmente; solo il loro ' +
    'supporto si riserva un diritto di rifiuto.',
  'colonne.ecritParJour': 'Scritto al giorno',
  'colonne.disque': 'Disco',
  'colonne.rotation': 'Rotazione automatica. Un disco pieno è normale.',
  'colonne.versions': 'Versioni',
  'colonne.disponible': 'Disponibile',
  'colonne.allumeDepuis': 'Acceso da',
  'colonne.aucuneImage': 'Nessuna immagine lascia mai la tua rete.',

  'app.titrePanneau': 'Sorveglianza',
  'app.etat': 'Stato',
  'app.reessayer': 'Riprova',
  'app.cameras': 'Telecamere',
  'app.aucuneCamera': 'Ancora nessuna telecamera.',
  'app.afficherCamera': 'Mostra {nom}',
  'app.masquerCamera': 'Nascondi {nom}',
  'app.derniereCamera': 'L’ultima telecamera visibile non si può nascondere',
  'app.reafficher': 'Mostra di nuovo nel mosaico',
  'app.masquerMosaique': 'Nascondi dal mosaico',
  'app.reduirePanneau': 'Riduci il pannello',
  'app.epinglerPanneau': 'Fissa il pannello',
  'app.pleinEcranF11': 'Schermo intero (F11)',
  'app.versionPrete': 'Versione {version} pronta.',
  'app.redemarrerMaintenant': 'Riavvia ora',
  'app.plusTard': 'Più tardi',
  'app.echapRevenir': 'Esc per tornare',
  'app.afficherPanneau': 'Mostra il pannello',
  'app.quitterPleinEcranEchap': 'Esci dallo schermo intero (Esc)',
  'app.quitter': 'Esci',
  'app.revenirMosaique': 'Doppio clic per tornare al mosaico',
  'app.glisserIsoler': 'Trascina per riordinare · doppio clic per isolare',
  'app.pontTitre': 'L’applicazione non si è avviata correttamente.',
  'app.pontDetail1':
    'Il collegamento interno non si è stabilito. Chiudi e riapri l’applicazione; se ' +
    'succede di nuovo, invia il file',
  'app.pontDetail2': 'nella cartella',

  'relecture.hier': 'Ieri',
  'relecture.aucuneCamera': 'Nessuna telecamera.',
  'relecture.revenirDirect': 'Torna alla diretta',
  'relecture.revenirDirectTitre': 'Torna all’immagine in diretta',
  'relecture.jourPrecedent': 'Giorno precedente',
  'relecture.jourSuivant': 'Giorno successivo',
  'relecture.jourARelire': 'Giorno da rivedere',
  'relecture.inviteDirect': 'Clicca la linea del tempo o una miniatura per tornare indietro nel tempo',
  'relecture.inviteSansRelais':
    'Clicca la linea del tempo o una miniatura per vedere cosa accadeva in quel momento.',
  'relecture.definitionReduite': 'definizione ridotta',
  'relecture.extraction': 'Estrazione…',
  'relecture.filtre.tout': 'Tutto',
  'relecture.filtre.personnes': 'Persone',
  'relecture.filtre.vehicules': 'Veicoli',
  'relecture.filtre.animaux': 'Animali',
  'relecture.filtre.sons': 'Suoni',
  'relecture.detectionUne': 'rilevamento',
  'relecture.detectionPlusieurs': 'rilevamenti',
  'relecture.rienDetecte': 'Nulla di rilevato quel giorno.',
  'relecture.journeeEntiere': 'giornata intera',
  'relecture.revoirJournee': 'Rivedi la giornata intera',
  'relecture.toutVoir': 'vedi tutto',
  'relecture.molette': 'rotella per zoomare',
  'relecture.cliquerPourVoir': 'clicca per vedere',

  'extrait.cameraInconnue': 'telecamera sconosciuta',
  'extrait.enregistrer': 'Salva',
  'extrait.enregistrerExtrait': 'Salva la clip',
  'extrait.extraction': 'Estrazione della sequenza…',
  'extrait.formatIndecodable':
    'La clip è stata ottenuta, ma il suo formato video non è decodificabile ' +
    'dall’applicazione. Salvala per aprirla con un altro lettore.',
  'extrait.position': 'Posizione nella sequenza',
  'extrait.enregistre': 'Salvato:',

  'recherche.chercher': 'Cerca',
  'recherche.placeholder': 'targa, o nome…',
  'recherche.chercherAria': 'Cerca una targa o un nome',
  'recherche.tolerante1':
    'Ricerca tollerante: il controller restituisce più letture possibili della stessa ' +
    'targa. Digitare',
  'recherche.tolerante2': 'troverà anche',
  'recherche.tolerante3': ', e le ultime cifre bastano.',
  'recherche.sujet': 'Soggetto',
  'recherche.confiance': 'Confidenza minima',
  'recherche.confianceDetail':
    'Si applica solo ai soggetti visivi. I rilevamenti sonori non portano punteggio — ' +
    'filtrarli per confidenza li eliminerebbe tutti.',
  'recherche.typeVehicule': 'Tipo di veicolo',
  'recherche.couleur': 'Colore',
  'recherche.camera': 'Telecamera',
  'recherche.periode': 'Periodo',
  'recherche.periode7': '7 giorni',
  'recherche.periode30': '30 giorni',
  'recherche.enCours': 'ricerca…',
  'recherche.objetUn': 'oggetto',
  'recherche.objetPlusieurs': 'oggetti',
  'recherche.tronque': 'mostrati i 300 più recenti — restringi per vedere tutto',
  'recherche.filtrageNote': 'soggetto filtrato dal controller, il resto qui',
  'recherche.rien': 'Nulla corrisponde.',
  'recherche.rienSeuil': 'La confidenza minima è forse troppo alta.',
  'recherche.rienTexte': 'Prova con meno caratteri — le ultime cifre bastano.',
  'recherche.identifie': 'Una targa o un nome è stato riconosciuto',

  'veilles.jours': 'Dom Lun Mar Mer Gio Ven Sab',
  'veilles.quand.toujours': 'Sempre',
  'veilles.quand.toujoursAide': 'anche disattivato, a qualsiasi ora',
  'veilles.quand.armee': 'Quando la guardia è attiva',
  'veilles.quand.armeeAide': 'segue l’interruttore e i suoi orari',
  'veilles.quand.horaire': 'Su un mio orario',
  'veilles.quand.horaireAide': 'indipendente dall’interruttore',
  'veilles.presqueJamais': 'quasi mai',
  'veilles.parJour': '~{n} al giorno',
  'veilles.lectureEchouee': 'Le guardie non hanno potuto essere lette.',
  'veilles.activer': 'Attiva la guardia',
  'veilles.desactiver': 'Disattiva la guardia',
  'veilles.active': 'Guardia attiva',
  'veilles.desactivee': 'Guardia disattivata',
  'veilles.profil': 'profilo {nom}',
  'veilles.enregistre': 'salvato',
  'veilles.independant':
    'Questo interruttore è di Alcora, indipendente dall’attivazione di Protect. I due ' +
    'possono differire: Alcora avviserà su questo PC anche se Protect resta in silenzio.',
  'veilles.activerCourt': 'Attiva',
  'veilles.desactiverCourt': 'Disattiva',
  'veilles.toutesCameras': 'tutte le telecamere',
  'veilles.volumesIndisponibles':
    'I volumi degli ultimi sette giorni non hanno potuto essere letti: le stime ' +
    'resteranno vuote finché il controller non è raggiungibile.',
  'veilles.declenche': 'Cosa scatena',
  'veilles.surCameras': 'Su quali telecamere',
  'veilles.quandTitre': 'Quando',
  'veilles.selonHoraire': 'Secondo quale orario',
  'veilles.enPermanence': 'In permanenza',
  'veilles.ceQueCaFait': 'Cosa fa',
  'veilles.son': 'Suono',
  'veilles.retenue': 'al massimo una notifica ogni',
  'veilles.retenueDetail':
    'Una persona che resta nell’inquadratura produce un rilevamento ogni quindici ' +
    'secondi. Senza questo freno, altrettante notifiche.',

  'ciel.etape.maj': 'Verificare gli aggiornamenti',
  'ciel.etape.session': 'Aprire la sessione',
  'ciel.etape.cameras': 'Leggere le telecamere',
  'ciel.etape.flux': 'Avviare il flusso video',
  'ciel.etape.relier': 'Collegare le telecamere',
  'ciel.telechargement': 'Scaricamento della versione {version}…',
  'ciel.controle': 'Verifica del pacchetto…',
  'ciel.installation': 'Installazione…',
  'ciel.empreinte': 'impronta SHA-256',
  'ciel.vaRedemarrer': 'l’applicazione si riavvierà',
  'ciel.rechercheMaj': 'ricerca di un aggiornamento…',
  'ciel.fluxPret': 'flusso video pronto',
  'ciel.connexion': 'connessione al controller',
  'ciel.versLa': 'verso la {version}',
  'ciel.redemarreSeule': 'L’applicazione si riavvia da sola, poi si apre aggiornata.',

  'etape.nonVerifie': 'Non verificato.',
  'etape.contact': 'Contatto del controller…',
  'etape.verifIdentite': 'Verifica dell’identità…',
  'etape.connexionEnCours': 'Connessione…',
  'etape.repond': '{host} risponde sulla porta 443.',
  'etape.premierAppairage': 'Primo abbinamento: l’identità è stata rilevata.',
  'etape.connexionAcceptee': 'Connessione accettata. Sessione valida {jours} giorni.',
  'etape.lectureCameras': 'Lettura delle telecamere…',
  'etape.camerasTrouvees': '{n} telecamera/e trovata/e su {nvr} (Protect {version}).',
  'etape.verifFlux': 'Verifica dei flussi…',
  'etape.diffusables': '{n} telecamera/e trasmissibile/i sulla porta {port}.',
  'erreur.nomNonResolu': 'Il nome «{host}» non ha potuto essere risolto.',
  'erreur.nomNonResoluRemede': 'Inserisci direttamente l’indirizzo IP del controller.',
  'erreur.identifiants': 'Nome utente o password rifiutati.',
  'erreur.identifiantsRemede': 'Verifica l’indirizzo e-mail dell’account e la sua password.',
  'erreur.totpRefuse': 'Il codice a due fattori è stato rifiutato.',
  'erreur.totpVerifieCle': 'Verifica la chiave inserita: deve venire dalla schermata di registrazione.',
  'relais.pret': 'Flusso video pronto.',

  'tuile.capturee': 'salvata: {nom}',
  'tuile.captureImpossible': 'cattura impossibile',
  'tuile.fluxIndisponible': 'Flusso non disponibile',
  'tuile.connexion': 'Connessione…',
  'tuile.revoir': 'Rivedi questa telecamera',
  'tuile.detections': 'I suoi rilevamenti',
  'tuile.ecouter': 'Ascolta questa telecamera',
};
