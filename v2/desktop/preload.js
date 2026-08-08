'use strict';

const { contextBridge, ipcRenderer } = require('electron');

/**
 * Passerelle entre la page et le processus principal.
 *
 * Surface volontairement etroite : la page ne recoit jamais d'objet Node, jamais de
 * secret, et ne peut appeler que ce qui est expose ici. Les identifiants transitent vers
 * le processus principal pour un test ou un enregistrement, mais n'en reviennent jamais.
 */
let compteurCanal = 0;

contextBridge.exposeInMainWorld('protect', {
  isConfigured: () => ipcRenderer.invoke('protect:isConfigured'),

  testConnection: (credentials, onStep) => {
    // Un compteur en plus de l'horodatage : deux tests lances dans la meme milliseconde
    // partageraient sinon le meme canal, et melangeraient leurs etapes.
    const channel = `protect:step:${Date.now()}:${++compteurCanal}`;
    const listener = (_event, result) => onStep(result);
    ipcRenderer.on(channel, listener);
    return ipcRenderer
      .invoke('protect:testConnection', credentials, channel)
      .finally(() => ipcRenderer.removeListener(channel, listener));
  },

  save: (credentials, keepSignedIn) =>
    ipcRenderer.invoke('protect:save', credentials, keepSignedIn),

  getCameras: () => ipcRenderer.invoke('protect:getCameras'),

  // Etat du controleur pour la colonne laterale : disque, versions, profondeur d'archive.
  systeme: () => ipcRenderer.invoke('protect:systeme'),

  // Veilles : configuration, volumes observes, et les deux flux qui remontent.
  veilles: () => ipcRenderer.invoke('protect:veilles'),
  veillesEnregistrer: (v) => ipcRenderer.invoke('protect:veillesEnregistrer', v),
  volumes: () => ipcRenderer.invoke('protect:volumes'),
  onDetectionVive: (handler) => {
    const l = (_e, d) => handler(d);
    ipcRenderer.on('protect:detectionVive', l);
    return () => ipcRenderer.removeListener('protect:detectionVive', l);
  },
  // L'utilisateur a clique une bulle : la page doit ouvrir cette sequence.
  onOuvrirDetection: (handler) => {
    const l = (_e, d) => handler(d);
    ipcRenderer.on('protect:ouvrirDetection', l);
    return () => ipcRenderer.removeListener('protect:ouvrirDetection', l);
  },

  relayBase: () => ipcRenderer.invoke('protect:relayBase'),

  onRelayState: (handler) => {
    const listener = (_event, state) => handler(state);
    ipcRenderer.on('protect:relayState', listener);
    return () => ipcRenderer.removeListener('protect:relayState', listener);
  },

  // Jalons de la sequence d'ouverture, pour l'ecran d'introduction : chaque etoile de la
  // constellation correspond a une etape reellement franchie, jamais a un minuteur.
  onProgression: (handler) => {
    const listener = (_event, etat) => handler(etat);
    ipcRenderer.on('protect:progression', listener);
    return () => ipcRenderer.removeListener('protect:progression', listener);
  },

  // Sorties de secours. Sans elles, une configuration erronee ou une panne passagere
  // laissait l'application definitivement figee, sans aucun recours pour l'utilisateur.
  pleinEcran: (actif) => ipcRenderer.invoke('protect:pleinEcran', actif),

  retry: () => ipcRenderer.invoke('protect:retry'),
  reconfigure: () => ipcRenderer.invoke('protect:reconfigure'),

  // Une remise a zero met la connexion de cote au lieu de la detruire : l'ecran de
  // connexion peut donc proposer de la reprendre plutot que de tout faire ressaisir.
  sauvegarde: () => ipcRenderer.invoke('protect:sauvegarde'),
  restaurer: () => ipcRenderer.invoke('protect:restaurer'),

  journalPath: () => ipcRenderer.invoke('protect:journalPath'),
  infos: () => ipcRenderer.invoke('protect:infos'),
  ouvrirJournal: () => ipcRenderer.invoke('protect:ouvrirJournal'),
  etats: () => ipcRenderer.invoke('protect:etats'),

  // Journal des detections. Les vignettes ne passent PAS par ici : elles sont servies en
  // images par le schema de l'interface, et le navigateur les met en cache lui-meme.
  evenements: (params) => ipcRenderer.invoke('protect:evenements', params),

  // Extraits video. L'adresse rendue se lit directement dans une balise video : c'est le
  // processus principal qui sert le fichier, plages comprises.
  extraire: (params) => ipcRenderer.invoke('protect:extraire', params),
  sequence: (params) => ipcRenderer.invoke('protect:sequence', params),
  enregistrerExtrait: (params) => ipcRenderer.invoke('protect:enregistrerExtrait', params),
  onExtraitProgres: (handler) => {
    const listener = (_event, e) => handler(e);
    ipcRenderer.on('protect:extraitProgres', listener);
    return () => ipcRenderer.removeListener('protect:extraitProgres', listener);
  },

  // Recherche fine. Les textes reconnus ne traversent JAMAIS ce pont : la requete part,
  // la comparaison se fait cote principal, et seuls des objets anonymes reviennent.
  recherche: (params) => ipcRenderer.invoke('protect:recherche', params),

  // Confort : ou vont les captures, et le son du direct.
  confort: () => ipcRenderer.invoke('protect:confort'),
  confortEnregistrer: (c) => ipcRenderer.invoke('protect:confortEnregistrer', c),
  choisirDossierCaptures: () => ipcRenderer.invoke('protect:choisirDossierCaptures'),
  ouvrirCaptures: () => ipcRenderer.invoke('protect:ouvrirCaptures'),
  // L'image arrive deja encodee, a la definition native du flux.
  capturer: (nom, octets) => ipcRenderer.invoke('protect:capturer', { nom, octets }),

  // Demarrage avec Windows : lecture, puis bascule dont l'etat rendu est RELU du registre.
  autoDemarrage: () => ipcRenderer.invoke('protect:autoDemarrage'),
  autoDemarrageChanger: (actif) => ipcRenderer.invoke('protect:autoDemarrageChanger', actif),

  // Langue : lue au demarrage, changee depuis les reglages.
  langue: () => ipcRenderer.invoke('protect:langue'),
  langueChanger: (choix) => ipcRenderer.invoke('protect:langueChanger', choix),
  // Nouveautes d'une mise a jour : lues apres l'intro, acquittees une fois vues.
  nouveautes: () => ipcRenderer.invoke('protect:nouveautes'),
  nouveautesVues: () => ipcRenderer.invoke('protect:nouveautesVues'),
  // Mises a jour automatiques : l'etat descend, deux ordres remontent.
  majVerifier: () => ipcRenderer.invoke('protect:majVerifier'),
  majRedemarrer: () => ipcRenderer.invoke('protect:majRedemarrer'),
  onMajState: (handler) => {
    const listener = (_event, state) => handler(state);
    ipcRenderer.on('protect:majState', listener);
    return () => ipcRenderer.removeListener('protect:majState', listener);
  },
});
