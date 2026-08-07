'use strict';

/*
 * Rappels de l'installeur — a traiter avant TOUT le reste.
 *
 * Pendant une installation, une mise a jour ou une desinstallation, l'installeur lance
 * l'executable avec l'un de ces arguments puis attend qu'il rende la main. Une application
 * qui les ignore ouvre sa fenetre et ne s'arrete jamais : l'installeur reste bloque.
 *
 * « firstrun » est l'exception : il signale le tout premier lancement apres installation et
 * doit poursuivre normalement, c'est ce qui affiche l'application a la fin de l'installation.
 */
const RAPPELS_INSTALLEUR = [
  '--veloapp-install',
  '--veloapp-updated',
  '--veloapp-obsolete',
  '--veloapp-uninstall',
];
if (process.argv.some((a) => RAPPELS_INSTALLEUR.includes(a.toLowerCase()))) {
  // A la desinstallation, retirer l'inscription au demarrage de Windows : une cle Run qui
  // pointe vers un executable efface resterait sinon dans le registre pour toujours.
  if (process.argv.some((a) => a.toLowerCase() === '--veloapp-uninstall')) {
    try {
      const { app: appSortante } = require('electron');
      appSortante.setLoginItemSettings({ openAtLogin: false });
    } catch { /* le nettoyage est un geste de politesse, jamais un blocage */ }
  }
  process.exit(0);
}

const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const {
  app, BrowserWindow, dialog, ipcMain, net, powerMonitor, protocol, screen, shell,
} = require('electron');

const journal = require('./journal');
const i18n = require('./i18n');
const { GestionnaireMaj } = require('./maj');
const { Store, reprendreDossier } = require('./store');
const { chargerFenetre, enregistrerFenetre, positionSure } = require('./fenetre');
const { Extraits } = require('./extraits');
const { Veilleur } = require('./veilleur');
const { veillesParDefaut, sujetsDe } = require('./veilles');
const { objetsDe, textesDe, filtrer, recenser, correspond } = require('./recherche');
const { FluxChangements } = require('./protect/updates');
const { RelaySupervisor } = require('./relay');
const { ProtectClient } = require('./protect/client');
const { Session } = require('./protect/session');
const { fromBootstrap, relayPaths, etatPourInterface } = require('./protect/discovery');
const {
  ProtectError, RelayMissingError, PinningFailedError, TimeoutError,
} = require('./protect/errors');

/*
 * Dossier de donnees.
 *
 * Distinct de la version 1.x en C#, et distinct de l'ancien nom : les installations ne
 * doivent jamais se marcher dessus. Le renommage du 28.07.2026 change ce dossier, d'ou la
 * reprise juste en dessous — elle evite de reclamer des identifiants que le poste possede
 * deja. Elle pourra disparaitre quand plus aucune installation ProtectViewer ne subsistera.
 */
const DOSSIER_DONNEES = 'Alcora';
const DOSSIER_PRECEDENT = 'ProtectViewer2';

app.setPath('userData', path.join(app.getPath('appData'), DOSSIER_DONNEES));
journal.ouvrir(app.getPath('userData'));

/*
 * Identite de la fenetre dans la barre des taches.
 *
 * Windows ne regroupe pas les fenetres par executable mais par AppUserModelID. Sans
 * declaration, il en deduit un depuis le CHEMIN de l'executable — or ce chemin traverse
 * « current\ », remplace a chaque mise a jour. La fenetre se detachait donc de l'icone
 * epinglee et en ouvrait une seconde, qu'il fallait reepingler apres chaque version.
 *
 * Les raccourcis poses par l'installeur portent « velopack.<packId> » — releve le
 * 28.07.2026 sur les raccourcis reels : « velopack.Alcora ». On declare le meme, derive du
 * packId pour qu'un renommage ne puisse pas desynchroniser les deux.
 */
const AUMID = `velopack.${require('./package.json').packId}`;
app.setAppUserModelId(AUMID);

const dossierRepris = reprendreDossier(
  path.join(app.getPath('appData'), DOSSIER_PRECEDENT),
  app.getPath('userData'));
if (dossierRepris) {
  journal.info('startup', `configuration taken over from ${dossierRepris}`);
}

// Rien ne doit disparaitre en silence : c'est le seul moyen de comprendre une panne
// survenue sur une autre machine, chez quelqu'un qui ne saura pas la decrire.
process.on('unhandledRejection', (e) => journal.erreur('promise', journal.deErreur(e)));

/**
 * Erreurs de flux : graves a consigner, jamais mortelles.
 *
 * Le 29.07.2026, l'application est morte deux fois pendant une relecture. La cause : le
 * lecteur video abandonne ses requetes a chaque deplacement — c'est son fonctionnement
 * normal — et la fermeture du flux cote serveur levait alors « Invalid state: ReadableStream
 * is already closed » dans une micro-tache. Elle arrivait ici, et l'on quittait.
 *
 * La cause est corrigee (voir extraits.js), mais la disproportion demeurait : une requete
 * abandonnee ne dit RIEN sur l'etat de l'application, et fermer un outil de surveillance
 * pour cela est le contraire du service rendu. On consigne, et l'on continue.
 */
function erreurDeFlux(e) {
  return e?.code === 'ERR_INVALID_STATE'
      || e?.code === 'ERR_STREAM_PREMATURE_CLOSE'
      || e?.code === 'ERR_STREAM_DESTROYED'
      || e?.code === 'ERR_STREAM_WRITE_AFTER_END'
      || e?.code === 'ABORT_ERR';
}

// Une exception fatale doit se voir. Une application figee sans un mot est le pire des
// etats : personne ne sait qu'il y a quelque chose a signaler, ni ou le trouver.
process.on('uncaughtException', (e) => {
  if (erreurDeFlux(e)) {
    journal.alerte('stream', `request aborted — ${journal.deErreur(e)}`);
    return;
  }
  journal.erreur('main', journal.deErreur(e));
  try {
    dialog.showErrorBox('Alcora',
      `${i18n.t('main.erreurFatale')}\n\n${i18n.t('main.detailJournal')}\n${journal.chemin()}`);
  } catch { /* trop tot pour une fenetre : le journal suffira */ }
  app.exit(1);
});
app.on('child-process-gone', (_e, d) =>
  journal.erreur('process', `${d.type} gone: ${d.reason}`));

// Le CHEMIN autant que le numero : plusieurs copies peuvent coexister sur un poste et
// partager ce dossier de donnees. Sans cette ligne, un journal melangeant deux copies est
// illisible — c'est exactement ce qui a rendu la panne du 23.07.2026 si longue a cerner.
journal.info('startup',
  `Alcora ${app.getVersion()} — ${app.isPackaged ? 'installed' : 'development'}`
  + ` — ${process.execPath}`);
// Consigne : si la barre des taches se dedoublait a nouveau, c'est la premiere chose a
// comparer avec l'AUMID porte par le raccourci.
journal.info('startup', `taskbar identity: ${AUMID}`);

/*
 * NE PAS toucher a la politique d'adresses du temps reel.
 *
 * Il est tentant de desactiver l'obfuscation mDNS de Chromium en croyant aider le relais
 * local a resoudre les candidats. C'est l'inverse qui se produit : sans elle, Chromium
 * enumere toutes les interfaces reseau et n'emet PLUS de candidat de boucle locale. Le
 * relais n'annonçant que 127.0.0.1, plus aucune paire n'est joignable — la signalisation
 * reussit, puis rien ne circule, sans le moindre message d'erreur.
 *
 * Le comportement par defaut fonctionne. Verifie le 22.07.2026 en comparant un navigateur
 * ordinaire, qui reussit, a Electron avec ce commutateur, qui echoue.
 */

/*
 * L'adresse de developpement n'est lue que hors application installee.
 *
 * Sinon, une variable d'environnement suffisait a faire charger n'importe quelle page
 * distante — laquelle heritait du pont vers le processus principal, donc de l'acces aux
 * cameras et au controleur.
 */
const DEV_URL = app.isPackaged ? null : process.env.PROTECTVIEWER_DEV_URL;
if (app.isPackaged && process.env.PROTECTVIEWER_DEV_URL) {
  journal.alerte('ui', 'PROTECTVIEWER_DEV_URL ignored: installed application');
}

/**
 * Emplacement du relais.
 *
 * Une fois empaquetee, l'application vit dans une archive : les fichiers voisins du code
 * n'y sont plus accessibles comme sur disque. Le binaire du relais est donc livre en
 * ressource externe, et son chemin differe selon le mode.
 *
 * Le NOM depend de la plateforme : « .exe » sous Windows, sans extension ailleurs. C'est
 * le meme mediamtx, telecharge pour l'architecture visee au moment de la construction.
 */
const NOM_RELAIS = process.platform === 'win32' ? 'mediamtx.exe' : 'mediamtx';
const RELAY_BINARY = app.isPackaged
  ? path.join(process.resourcesPath, 'relay', NOM_RELAIS)
  : path.join(__dirname, '..', 'relay', NOM_RELAIS);

/*
 * L'interface est servie par un protocole applicatif, jamais depuis « file:// ».
 *
 * Sous file://, une page n'a pas d'origine : ses chemins absolus visent la racine du
 * disque, ses modules sont refuses par la politique d'origine, et « default-src 'self' »
 * ne correspond a rien. Le symptome est une fenetre vide SANS aucune erreur — ni dans la
 * console, ni sur la sortie d'erreur — parce qu'aucune ligne de la page ne s'execute.
 *
 * Un schema declare « standard » et « secure » donne au contraire une vraie origine :
 * les chemins resolvent, les modules chargent, la politique de securite s'applique
 * reellement, et le contexte est securise comme sur https.
 *
 * Verifie le 22.07.2026 : c'est exactement ce qui manquait au premier empaquetage.
 */
const SCHEMA_UI = 'app';
const ORIGINE_UI = `${SCHEMA_UI}://viewer`;
const DOSSIER_UI = path.join(__dirname, 'ui');

protocol.registerSchemesAsPrivileged([{
  scheme: SCHEMA_UI,
  privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
}]);

/**
 * Vignettes des detections, servies par le schema de l'interface.
 *
 * Passer les octets par messages aurait impose de les convertir en texte, de les garder en
 * memoire et d'ecrire un cache a la main. Servies ici, ce sont de vraies images : la
 * balise habituelle suffit, et le navigateur s'occupe seul du cache et de la memoire.
 *
 * Un cache court est tout de meme tenu ici : une liste que l'on fait defiler redemande
 * sans cesse les memes vignettes, et chacune est un aller-retour authentifie.
 */
const CACHE_VIGNETTES = new Map();
const CACHE_VIGNETTES_MAX = 120;

async function servirVignette(id) {
  const enCache = CACHE_VIGNETTES.get(id);
  if (enCache) {
    // Remise en tete : la plus ancienne sortira en premier.
    CACHE_VIGNETTES.delete(id);
    CACHE_VIGNETTES.set(id, enCache);
    return new Response(enCache.corps, { headers: { 'Content-Type': enCache.type } });
  }

  if (!clientActif) return new Response('', { status: 503 });

  try {
    const { type, corps } = await clientActif.getEventThumbnail(id);
    CACHE_VIGNETTES.set(id, { type, corps });
    if (CACHE_VIGNETTES.size > CACHE_VIGNETTES_MAX) {
      CACHE_VIGNETTES.delete(CACHE_VIGNETTES.keys().next().value);
    }
    return new Response(corps, { headers: { 'Content-Type': type } });
  } catch (e) {
    // 404 pendant l'evenement : le controleur n'a pas encore fabrique l'image. Ce n'est
    // pas une panne, et la page doit pouvoir l'afficher comme une absence ordinaire.
    const statut = e?.status === 404 ? 404 : 502;
    if (statut !== 404) journal.alerte('thumbnail', `${id} — ${e.message ?? e}`);
    return new Response('', { status: statut });
  }
}

/**
 * Instantane d'une camera, servi comme une image.
 *
 * Meme raison que pour la bulle de veille : la vignette d'un evenement n'existe QU'APRES sa
 * fin (404 pendant, mesure du 21.07.2026). Une detection qui vient de COMMENCER n'a donc
 * aucune vignette a montrer, et un `<img>` qui prend un 404 ne reessaie jamais. La colonne
 * d'etat demande donc l'instantane, qui montre l'instant meme — ce qui vaut mieux.
 *
 * Le cache est volontairement minuscule et court : c'est une image du PRESENT. Il n'existe
 * que pour absorber les rendus rapproches de React, pas pour eviter un aller-retour.
 */
const CACHE_INSTANTANES = new Map();
const INSTANTANE_MS = 4000;

async function servirInstantane(id) {
  const frais = CACHE_INSTANTANES.get(id);
  if (frais && Date.now() - frais.a < INSTANTANE_MS) {
    return new Response(frais.corps, { headers: { 'Content-Type': frais.type } });
  }
  if (!clientActif) return new Response('', { status: 503 });
  try {
    const { type, corps } = await clientActif.getCameraSnapshot(id, { w: 320, h: 180 });
    CACHE_INSTANTANES.set(id, { type, corps, a: Date.now() });
    // Deux cameras ici : la borne n'existe que pour ne pas grandir sans fin.
    if (CACHE_INSTANTANES.size > 16) {
      CACHE_INSTANTANES.delete(CACHE_INSTANTANES.keys().next().value);
    }
    return new Response(corps, { headers: { 'Content-Type': type } });
  } catch (e) {
    return new Response('', { status: e?.absent ? 404 : 502 });
  }
}

/** Sert un fichier de l'interface, en refusant toute sortie du dossier. */
async function servirUi(requete) {
  const demande = decodeURIComponent(new URL(requete.url).pathname);

  // Les vignettes ne sont pas des fichiers : elles viennent du controleur.
  if (demande.startsWith('/vignette/')) {
    const id = demande.slice('/vignette/'.length);
    // L'identifiant part dans une adresse d'API : on n'accepte que ce qu'il peut etre.
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return new Response('', { status: 400 });
    return servirVignette(id);
  }

  if (demande.startsWith('/instantane/')) {
    const id = demande.slice('/instantane/'.length);
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return new Response('', { status: 400 });
    return servirInstantane(id);
  }

  // Les extraits vivent sur le disque : servis ici AVEC les plages, que le lecteur exige
  // pour se deplacer dans la video.
  if (demande.startsWith('/extrait/')) {
    if (!extraits) return new Response('', { status: 503 });
    return extraits.servir(demande.slice('/extrait/'.length), requete.headers.get('Range'));
  }

  const relatif = demande === '/' ? 'index.html' : demande.slice(1);
  const cible = path.resolve(DOSSIER_UI, relatif);

  // Un « .. » dans l'adresse ne doit pas donner acces au reste du disque.
  if (cible !== DOSSIER_UI && !cible.startsWith(DOSSIER_UI + path.sep)) {
    journal.alerte('ui', `path refused: ${demande}`);
    return new Response('', { status: 403 });
  }

  try {
    return await net.fetch(pathToFileURL(cible).toString());
  } catch (e) {
    journal.erreur('ui', `${demande} unreadable — ${journal.deErreur(e)}`);
    return new Response('', { status: 404 });
  }
}

let window = null;
let store = null;
let relay = null;
let cameras = [];
/** Etat du controleur pour la colonne d'etat : disque, versions, nom. */
let systeme = null;
/** Liaison temps reel et veilleur : crees a la premiere session ouverte. */
let flux = null;
let veilleur = null;

/**
 * Client authentifie de la session en cours, ou null tant qu'aucune n'est ouverte.
 *
 * C'est lui qui porte la session : le jeter apres la decouverte obligeait a se
 * reconnecter pour la moindre question posee au controleur.
 */
let clientActif = null;

/** Obtention et service des extraits video. Cree au demarrage, une fois le store pret. */
let extraits = null;

/**
 * Identifiants du cycle courant, jamais ecrits sur le disque.
 *
 * Ils permettent a « ne pas rester connecte » d'etre une vraie option : l'application
 * fonctionne jusqu'a sa fermeture, puis oublie tout.
 */
let identifiantsDeSession = null;

let maj = null;
let dernierEtatMaj = { etat: 'aucune' };

/**
 * Vrai des qu'une mise a jour va etre appliquee.
 *
 * La recherche tourne en parallele de la connexion au controleur : sans ce verrou, la
 * decouverte pouvait demarrer le relais APRES qu'on l'a arrete pour appliquer, et le
 * binaire vivant reverrouillait le dossier que l'installation doit remplacer. La mise a
 * jour echouait alors sans raison apparente.
 */
let majImminente = false;

function pushMajState(etat) {
  dernierEtatMaj = etat;
  envoyerPage('protect:majState', etat);
}

/**
 * Demarrage en cours. La page se lance en parallele de la decouverte et demanderait
 * l'inventaire avant qu'il existe : on la fait attendre plutot que de lui repondre « rien ».
 */
let demarrage = Promise.resolve();

// Numero de la version plus recente ayant deja tourne dans ce dossier de donnees, quand
// cette copie-ci lui est anterieure. Non nul = cette copie n'ecrit plus rien.
let perimee = null;
/* Le message initial est TRADUIT au moment ou on le sert, pas a la creation du module :
   la langue n'est connue qu'apres la lecture de la configuration. */
let dernierEtatRelais = { running: false, message: '' };
const etatRelaisCourant = () => (dernierEtatRelais.message
  ? dernierEtatRelais
  : { ...dernierEtatRelais, message: i18n.t('relais.demarrage') });

/**
 * Ou en est la sequence d'ouverture : 'demarrage' -> 'session' -> 'inventaire'.
 *
 * L'ecran d'introduction dessine une constellation dont chaque etoile est une etape
 * REELLE. Sans ces jalons, la page ne voyait que deux instants — « ça démarre » et
 * « flux prêt » — et l'animation aurait du inventer le reste, c'est-a-dire mentir.
 */
let dernierEtatProgression = { etape: 'demarrage' };

function pushProgression(etape) {
  if (dernierEtatProgression.etape === etape) return;
  dernierEtatProgression = { etape };
  journal.info('progress', etape);
  envoyerPage('protect:progression', dernierEtatProgression);
}

/* ------------------------------------------------------------------ fenetre */

function createWindow() {
  /*
   * La fenetre se remet ou elle etait : taille, position, ecran, etat.
   *
   * La position n'est reprise que si elle retombe sur un ecran ENCORE PRESENT — un ecran
   * debranche laisserait sinon la fenetre hors de vue, irrecuperable a la souris. Dans ce
   * cas, Windows centre, comme au premier lancement.
   */
  const sauvee = chargerFenetre(app.getPath('userData'));
  const posee = positionSure(sauvee, screen.getAllDisplays().map((d) => d.workArea));

  window = new BrowserWindow({
    width: posee?.width ?? 1320,
    height: posee?.height ?? 820,
    ...(posee ? { x: posee.x, y: posee.y } : {}),
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#1b1e23',        // evite le flash blanc au demarrage
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,                   // le preload a besoin de require
    },
  });

  // L'etat AVANT l'affichage : agrandir apres coup ferait sauter la fenetre a l'ecran.
  if (posee && sauvee.pleinEcran) window.setFullScreen(true);
  else if (posee && sauvee.maximisee) window.maximize();

  window.once('ready-to-show', () => window.show());

  /*
   * Memorisation : les bornes NORMALES, jamais celles de l'etat agrandi — sinon quitter
   * l'agrandissement rendrait une fenetre aux dimensions de l'ecran entier. Amortie sur
   * les gestes continus, immediate sur les changements d'etat et la fermeture.
   */
  let minuterieFenetre = null;
  const retenir = () => {
    if (!window || window.isDestroyed()) return;
    enregistrerFenetre(app.getPath('userData'), {
      ...window.getNormalBounds(),
      maximisee: window.isMaximized(),
      pleinEcran: window.isFullScreen(),
    });
  };
  const retenirPlusTard = () => {
    clearTimeout(minuterieFenetre);
    minuterieFenetre = setTimeout(retenir, 600);
  };
  window.on('resize', retenirPlusTard);
  window.on('move', retenirPlusTard);
  for (const ev of ['maximize', 'unmaximize', 'enter-full-screen', 'leave-full-screen']) {
    window.on(ev, retenir);
  }
  window.on('close', () => { clearTimeout(minuterieFenetre); retenir(); });

  const pages = window.webContents;

  // La console de la page n'apparait nulle part sans outils de developpement : elle part
  // dans le journal commun. C'est ce qui rend une panne comprehensible a distance.
  pages.on('console-message', (_e, niveau, message, ligne, source) => {
    const court = String(source).split(/[\\/]/).pop();
    journal.ecrire(niveau >= 2 ? 'erreur' : 'info', 'page', `${message}  (${court}:${ligne})`);
  });

  /*
   * Les trois pannes qui laissent une fenetre vide sans rien dire nulle part.
   * Sans ces trois lignes, le premier empaquetage ne donnait AUCUN indice.
   */
  pages.on('did-fail-load', (_e, code, description, url, principal) => {
    if (!principal) return;                       // une image manquante n'est pas une panne
    journal.erreur('ui', `load failed (${code} ${description}): ${url}`);
  });
  pages.on('render-process-gone', (_e, d) =>
    journal.erreur('ui', `renderer gone: ${d.reason}`));
  pages.on('preload-error', (_e, fichier, e) =>
    journal.erreur('preload', `${fichier} — ${journal.deErreur(e)}`));

  // Rejoue le dernier etat connu a chaque chargement : sans cela, une page qui se
  // charge apres le demarrage du relais resterait sur « Démarrage… » indefiniment.
  pages.on('did-finish-load', () => {
    journal.info('ui', 'page loaded');
    pages.send('protect:relayState', etatRelaisCourant());
    pages.send('protect:majState', dernierEtatMaj);
    pages.send('protect:progression', dernierEtatProgression);
  });

  // Aucun lien externe ne s'ouvre dans l'application elle-meme.
  pages.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  // L'interface n'a aucune raison de naviguer ailleurs. Si une page y parvenait, elle
  // hériterait du pont vers le processus principal.
  pages.on('will-navigate', (e, url) => {
    if (url.startsWith(ORIGINE_UI) || (DEV_URL && url.startsWith(DEV_URL))) return;
    e.preventDefault();
    journal.alerte('ui', `navigation refused to ${url}`);
  });

  const depart = DEV_URL || `${ORIGINE_UI}/index.html`;
  window.loadURL(depart).catch((e) =>
    journal.erreur('ui', `${depart} — ${journal.deErreur(e)}`));
}

/* ------------------------------------------------------- relais et decouverte */

/**
 * Envoie un message a la page, sauf si elle n'existe plus.
 *
 * « window?. » ne suffit pas : a la fermeture, la fenetre existe encore un instant mais son
 * contenu est deja detruit. « relay.stop() » emet alors un dernier etat, l'envoi echoue sur
 * « Object has been destroyed », et cette exception — capturee par le garde global — peut
 * faire surgir une boite d'erreur a CHAQUE fermeture propre.
 *
 * Constate sur le poste reel les 22 et 23.07.2026, en 2.0.2 comme en 2.0.4.
 */
function envoyerPage(canal, charge) {
  if (window && !window.isDestroyed() && !window.webContents.isDestroyed()) {
    window.webContents.send(canal, charge);
  }
}

function pushRelayState(state) {
  // Memorise : la page peut se charger APRES cet envoi, ou etre rechargee a chaud.
  if (state.message !== dernierEtatRelais.message) journal.info('relay', state.message);
  dernierEtatRelais = state;
  envoyerPage('protect:relayState', state);
}

function makeClient(config, { onFirstUse } = {}) {
  const client = new ProtectClient({
    host: config.host,
    pins: config.pins ?? [],
    onFirstUse,
    session: Session.fromJSON(JSON.parse(store.readSecret('session') ?? 'null')),
    // Un disque plein ou un magasin de secrets indisponible ne doit pas faire echouer une
    // connexion par ailleurs reussie : au pire la session ne survit pas a la fermeture.
    onSessionChanged: (s) => {
      try {
        store.writeSecret('session', JSON.stringify(s));
      } catch (e) {
        journal.alerte('session', `session not kept on this machine: ${e.message}`);
      }
    },
  });
  return client;
}

/** Interroge le controleur, met a jour l'inventaire, et republie les flux. */
async function discoverAndPublish(client, config) {
  const inventory = fromBootstrap(await client.getBootstrap());

  if (inventory.rtspPort && inventory.rtspPort !== config.rtspPort) {
    config.rtspPort = inventory.rtspPort;
    store.writeConfig(config);
  }

  cameras = inventory.cameras;
  systeme = inventory.systeme;
  journal.info('inventory',
    `${cameras.length} camera(s) on ${inventory.nvrName}, RTSP ${config.rtspPort}`);

  /*
   * Les noms de champs du controleur, une fois par decouverte.
   *
   * Le stockage n'a pas ete trouve la ou je l'attendais, et ces noms changent d'une version
   * de Protect a l'autre. Plutot que de faire relancer une sonde a l'utilisateur, on consigne ce
   * que CE controleur expose : le journal repondra tout seul a la prochaine lecture.
   */
  /*
   * Les VALEURS qui commandent un affichage, et pas seulement les noms de champs.
   *
   * Le 31.07.2026, la ligne « Protect » du panneau restait muette et il a fallu demander a
   * l'utilisateur de lire son ecran pour savoir ce que le controleur repondait. Le journal donnait
   * deja la liste des champs ; il donne maintenant le contenu des trois qui decident de ce
   * qui s'affiche. Aucun n'est sensible : ce sont des etats de console, pas des donnees.
   */
  if (systeme) {
    journal.info('inventory',
      `controller state: arming=${systeme.armement ?? 'absent'}`
      + ` disk=${systeme.etatDisque ?? 'absent'}`
      + ` recording=${systeme.enregistrementSuspendu ? 'suspended' : 'active'}`
      + ` definitions=${JSON.stringify(systeme.parDefinition ?? null)}`);

    /*
     * Pourquoi un champ manque, et pas seulement qu'il manque.
     *
     * Le 31.07.2026, `armMode` figurait dans la liste des champs du controleur et rendait
     * pourtant « absent ». Savoir qu'il manque ne dit pas s'il est nul, vide, ou d'une
     * forme que la lecture n'attendait pas — trois causes, trois corrections differentes.
     * On consigne donc sa FORME BRUTE, une fois, plutot que de faire un aller-retour de
     * plus. Ce sont des etats de console, jamais des donnees.
     */
    if (!systeme.armement && systeme.brut) {
      journal.info('inventory',
        `arming not read: armMode=${systeme.brut.armMode} `
        + `alarmSettings=${systeme.brut.alarmSettings}`);
    }
  }
  if (systeme?.clesNvr?.length) {
    journal.info('inventory', `controller fields: ${systeme.clesNvr.join(' ')}`);
    if (!systeme.disque) {
      journal.info('inventory',
        'storage not found among known paths — the disk gauge will stay hidden');
    }
  }
  pushProgression('inventaire');

  // Une ressource manquante ici donnerait une fenetre sans image et aucune explication.
  if (!fs.existsSync(RELAY_BINARY)) {
    journal.erreur('relay', `binary not found: ${RELAY_BINARY}`);
    throw new RelayMissingError(RELAY_BINARY);
  }

  // Une mise a jour s'applique : ne pas relancer un relais qui reverrouillerait le dossier.
  if (majImminente) {
    journal.info('relay', 'start suspended: update being applied');
    return inventory;
  }

  const paths = relayPaths(cameras, { host: config.host, rtspPort: config.rtspPort });

  /*
   * Republier plutot que reconstruire.
   *
   * Chaque redecouverte fabriquait un superviseur neuf : nouveaux ports, nouvelle adresse
   * remise a la page, et toutes les vues coupees — meme quand l'inventaire n'avait pas
   * bouge d'un iota. On garde donc le superviseur, qui garde ses ports, et il ne relance
   * le relais que si les chemins ont reellement change.
   */
  if (relay) {
    const republie = await relay.republier(paths);
    journal.info('relay', republie
      ? 'inventory changed: streams republished'
      : 'inventory unchanged: streams kept');
  } else {
    relay = new RelaySupervisor({
      binary: RELAY_BINARY,
      dataDir: path.join(app.getPath('userData'), 'relay'),
      onState: pushRelayState,
    });
    await relay.start(paths);
  }

  return inventory;
}

/**
 * Borne une operation dans le temps, quoi qu'il arrive.
 *
 * Les delais de la bibliotheque HTTP portent sur la socket. Ils ne couvrent donc pas les
 * phases qui precedent son obtention — l'attente dans la file de l'agent en particulier —
 * et une promesse peut alors n'etre ni tenue ni rompue. C'est le pire cas pour
 * l'utilisateur : une roue qui tourne sans fin, sans erreur, sans rien a raconter.
 */
function avecDelai(promesse, ms, quoi) {
  let minuteur;
  const limite = new Promise((_, rejeter) => {
    minuteur = setTimeout(
      () => rejeter(new TimeoutError(quoi, ms)),
      ms,
    );
  });
  return Promise.race([promesse, limite]).finally(() => clearTimeout(minuteur));
}

/* --------------------------------------------------------------------- IPC */

ipcMain.handle('protect:isConfigured', () => Boolean(store.readConfig().configured));

ipcMain.handle('protect:testConnection', async (_event, credentials, channel) => {
  /*
   * Chaque etape passe par le journal.
   *
   * Un test fige n'avait laisse AUCUNE trace : cinq etapes, une trentaine de secondes de
   * reseau, et pas une ligne. Impossible de savoir jusqu'ou l'execution etait allee. Le
   * journal doit dire au minimum ce qui a ete tente et ce qui a repondu.
   */
  const step = (result) => {
    journal.info('test', `${result.step} ${result.state} — ${result.message}`);
    envoyerPage(channel, result);
  };
  const config = store.readConfig();
  journal.info('test', `requested for ${credentials.host}, ` +
    `${credentials.totpSeed ? 'with' : 'without'} two-factor key, ` +
    `${config.pins?.length ? 'pinned identity' : 'first pairing'}`);

  let discoveredPin;
  const client = new ProtectClient({
    host: credentials.host,
    pins: config.pins ?? [],
    onFirstUse: (pin) => { discoveredPin = pin; },
  });
  client.setCredentials(credentials);

  const skip = (after) => {
    for (const s of after) step({ step: s, state: 'ignore', message: i18n.t('etape.nonVerifie') });
  };

  step({ step: 'reseau', state: 'encours', message: i18n.t('etape.contact') });
  step({ step: 'certificat', state: 'encours', message: i18n.t('etape.verifIdentite') });
  step({ step: 'identifiants', state: 'encours', message: i18n.t('etape.connexionEnCours') });

  try {
    // Aucune etape ne doit pouvoir durer indefiniment. Les delais internes ne couvrent pas
    // toutes les phases — l'attente d'une socket dans la file de l'agent, notamment —, donc
    // on pose ici une limite qui, elle, ne depend de rien.
    await avecDelai(client.login(), 40000, i18n.t('delai.connexion'));
  } catch (e) {
    journal.erreur('test', journal.deErreur(e));
    const err = e instanceof ProtectError ? e : null;
    const isNetwork = err && ['NetworkError', 'HostNotFoundError', 'ConnectionRefusedError'].includes(err.name);
    const isPin = err?.name === 'PinMismatchError';

    if (isNetwork) {
      step({ step: 'reseau', state: 'echoue', message: err.userMessage, remedy: err.remedy, technical: err.technical });
      skip(['certificat', 'identifiants', 'inventaire', 'flux']);
    } else if (isPin) {
      step({ step: 'reseau', state: 'reussi', message: i18n.t('etape.repond', { host: credentials.host }) });
      step({ step: 'certificat', state: 'echoue', message: err.userMessage, remedy: err.remedy, technical: err.technical });
      skip(['identifiants', 'inventaire', 'flux']);
    } else {
      step({ step: 'reseau', state: 'reussi', message: i18n.t('etape.repond', { host: credentials.host }) });
      step({ step: 'certificat', state: 'reussi', message: i18n.t('etape.identiteVerifiee') });
      step({ step: 'identifiants', state: 'echoue',
             message: err?.userMessage ?? i18n.t('etape.echecConnexion'),
             remedy: err?.remedy, technical: err?.technical });
      skip(['inventaire', 'flux']);
    }
    return { ok: false, cameras: [] };
  }

  step({ step: 'reseau', state: 'reussi', message: i18n.t('etape.repond', { host: credentials.host }) });
  step({ step: 'certificat', state: 'reussi',
         message: discoveredPin ? i18n.t('etape.premierAppairage')
                                : i18n.t('etape.identiteConforme') });
  const jours = Math.round((client.session.expiresAt - Date.now()) / 86_400_000);
  step({ step: 'identifiants', state: 'reussi',
         message: i18n.t('etape.connexionAcceptee', { jours }) });

  step({ step: 'inventaire', state: 'encours', message: i18n.t('etape.lectureCameras') });
  let inventory;
  try {
    inventory = fromBootstrap(await avecDelai(client.getBootstrap(), 40000, i18n.t('delai.lectureCameras')));
  } catch (e) {
    journal.erreur('test', journal.deErreur(e));
    const err = e instanceof ProtectError ? e : null;
    step({ step: 'inventaire', state: 'echoue',
           message: err?.userMessage ?? i18n.t('etape.inventaireIllisible'),
           remedy: err?.remedy, technical: err?.technical });
    skip(['flux']);
    return { ok: false, cameras: [] };
  }

  step({ step: 'inventaire', state: 'reussi',
         message: i18n.t('etape.camerasTrouvees', {
           n: inventory.cameras.length, nvr: inventory.nvrName, version: inventory.protectVersion,
         }) });

  step({ step: 'flux', state: 'encours', message: i18n.t('etape.verifFlux') });
  const streamable = inventory.cameras.filter((c) => c.channels.some((ch) => ch.rtspAlias)).length;
  if (streamable === 0) {
    step({ step: 'flux', state: 'echoue',
           message: i18n.t('etape.aucunFlux'),
           remedy: i18n.t('etape.aucunFluxRemede') });
    return { ok: false, cameras: [] };
  }
  step({ step: 'flux', state: 'reussi',
         message: i18n.t('etape.diffusables', { n: streamable, port: inventory.rtspPort }) });

  return {
    ok: true,
    cameras: inventory.cameras,
    discoveredPin,
    nvrName: inventory.nvrName,
    protectVersion: inventory.protectVersion,
  };
});

ipcMain.handle('protect:save', async (_event, credentials, keepSignedIn) => {
  // Une copie perimee ne reecrit pas la configuration du poste : elle l'ecraserait avec
  // un format d'hier, et effacerait au passage l'empreinte deja etablie.
  if (perimee) throw new Error(i18n.t('main.copiePerimee'));
  const config = store.readConfig();
  config.host = credentials.host;
  config.username = credentials.username;

  // L'empreinte relevee au test est confirmee par l'enregistrement lui-meme. Si elle
  // n'aboutit pas, on ne demarre PAS sans epinglage : accepter n'importe quel certificat
  // en silence viderait de son sens la verification d'identite du controleur.
  if (!config.pins?.length) {
    const probe = new ProtectClient({ host: credentials.host, pins: [], onFirstUse: (p) => config.pins = [p] });
    probe.setCredentials(credentials);
    try {
      await probe.login();
    } catch (e) {
      journal.erreur('pairing', journal.deErreur(e));
    }
    if (!config.pins?.length) {
      throw new PinningFailedError();
    }
  }

  /*
   * Les identifiants sont conserves ou non — mais la session vit dans tous les cas.
   *
   * Sans cela, decocher « rester connecte » ecrivait une configuration valide puis
   * effacait tout : le demarrage suivant ne trouvait pas de mot de passe, renoncait en
   * silence, et l'ecran de connexion ne revenait jamais. L'option briquait l'application.
   */
  identifiantsDeSession = { username: credentials.username, password: credentials.password,
                            totpSeed: credentials.totpSeed };

  if (keepSignedIn) {
    store.writeSecret('password', credentials.password);
    if (credentials.totpSeed) store.writeSecret('totp', credentials.totpSeed);
  } else {
    store.clearSecrets();
  }

  // « configure » n'est ecrit qu'apres un demarrage reussi : une configuration qui ne
  // fonctionne pas ne doit jamais verrouiller l'ecran de connexion.
  await connecter(config);
  config.configured = true;
  store.writeConfig(config);
});

// On attend la fin du demarrage : repondre « aucune camera » a une page qui demande trop
// tot la laisserait sur un ecran vide sans jamais rien reessayer.
ipcMain.handle('protect:getCameras', async () => { await demarrage; return cameras; });

/**
 * Reglages de confort : ou vont les captures, et le son du direct.
 *
 * Ils vivent dans config.json a cote du reste. Le dossier par defaut est celui des IMAGES
 * de Windows, pas un recoin du dossier de donnees : une capture se prend pour la montrer a
 * quelqu'un, elle doit se retrouver la ou l'on cherche ses images.
 */
function lireConfort() {
  let c = {};
  try { c = store?.readConfig()?.confort ?? {}; } catch { /* valeurs de depart */ }
  return {
    dossierCaptures: typeof c.dossierCaptures === 'string' && c.dossierCaptures
      ? c.dossierCaptures
      : path.join(app.getPath('pictures'), 'Alcora'),
    // Le son reste ETEINT par defaut : un mur d'images qui se met a parler au lancement
    // serait insupportable, et c'est le premier reflexe de quelqu'un qui l'entend.
    sonParDefaut: c.sonParDefaut === true,
  };
}

ipcMain.handle('protect:confort', async () => { await demarrage; return lireConfort(); });

ipcMain.handle('protect:confortEnregistrer', async (_event, confort) => {
  if (perimee) throw new Error(i18n.t('main.copiePerimee'));
  const actuel = lireConfort();
  const suivant = {
    dossierCaptures: typeof confort?.dossierCaptures === 'string' && confort.dossierCaptures
      ? confort.dossierCaptures : actuel.dossierCaptures,
    sonParDefaut: confort?.sonParDefaut === true,
  };
  const config = store.readConfig();
  store.writeConfig({ ...config, confort: suivant });
  return suivant;
});

/** Choisir le dossier des captures. Rend le reglage tel qu'il est apres coup. */
ipcMain.handle('protect:choisirDossierCaptures', async () => {
  if (!window) return lireConfort();
  const actuel = lireConfort();
  const { canceled, filePaths } = await dialog.showOpenDialog(window, {
    title: i18n.t('main.ouCaptures'),
    defaultPath: actuel.dossierCaptures,
    properties: ['openDirectory', 'createDirectory'],
  });
  if (canceled || !filePaths?.[0]) return actuel;
  const config = store.readConfig();
  const suivant = { ...actuel, dossierCaptures: filePaths[0] };
  store.writeConfig({ ...config, confort: suivant });
  journal.info('capture', 'captures folder changed');
  return suivant;
});

/**
 * Ecrit une capture prise dans la page.
 *
 * L'image arrive DEJA encodee : la page la produit a la definition native du flux, pas a
 * celle de la tuile — c'est justement quand on veut lire une plaque qu'on la prend, et une
 * vignette de mosaique n'apprendrait rien.
 */
ipcMain.handle('protect:capturer', async (_event, { nom, octets }) => {
  if (perimee) throw new Error(i18n.t('main.copiePerimee'));
  if (!octets?.byteLength) throw new Error('Capture vide.');

  const { dossierCaptures } = lireConfort();
  await fs.promises.mkdir(dossierCaptures, { recursive: true });

  const d = new Date();
  const deux = (n) => String(n).padStart(2, '0');
  const horodate = `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`
    + ` ${deux(d.getHours())}h${deux(d.getMinutes())}m${deux(d.getSeconds())}`;
  // Un nom venu de la page ne doit jamais pouvoir designer un autre dossier.
  const propre = String(nom ?? 'camera').replace(/[^A-Za-zÀ-ÿ0-9 _-]/g, '_').slice(0, 60);
  const cible = path.join(dossierCaptures, `${propre} ${horodate}.jpg`);

  await fs.promises.writeFile(cible, Buffer.from(octets));
  journal.info('capture', `${path.basename(cible)} — ${Math.round(octets.byteLength / 1024)} KB`);
  return cible;
});

/** Ouvre le dossier des captures dans l'explorateur, et met en evidence la derniere. */
ipcMain.handle('protect:ouvrirCaptures', async () => {
  const { dossierCaptures } = lireConfort();
  await fs.promises.mkdir(dossierCaptures, { recursive: true }).catch(() => {});
  shell.openPath(dossierCaptures);
});

/**
 * Recherche fine dans les detections.
 *
 * Le partage du travail vient de la mesure du 29.07.2026, pas d'un choix d'architecture :
 * le controleur HONORE le filtre par sujet (624 -> 310) et IGNORE le filtre par score. Le
 * premier part donc au controleur — c'est lui qui rend la chose tenable avec ~266
 * detections par jour — et le seuil s'applique ici, sur ce qui est descendu.
 *
 * Les TEXTES RECONNUS ne remontent jamais a la page. Plaques et noms associes aux visages
 * restent ici ; la page ne recoit qu'un booleen « identifie ». C'est aussi pourquoi la
 * recherche par plaque se fait de ce cote : elle compare des textes que la page ne voit pas.
 */
ipcMain.handle('protect:recherche', async (_event, params = {}) => {
  await demarrage;
  if (!clientActif) throw new Error(i18n.t('main.pasConnexion'));

  const fin = Number.isFinite(params.jusqua) ? params.jusqua : Date.now();
  const debut = Number.isFinite(params.depuis) ? params.depuis : fin - 7 * 86400000;
  const sujets = Array.isArray(params.sujets) ? params.sujets : [];

  const bruts = await clientActif.getEvents({
    debut, fin, limite: 4000,
    types: ['smartDetectZone', 'smartAudioDetect'],
    sujets,
  });

  const noms = new Map(cameras.map((c) => [c.id, c.name]));
  const objets = [];
  const textes = new Map();

  for (const e of bruts) {
    for (const o of objetsDe(e, noms)) objets.push(o);
    // Les textes restent ICI, indexes par objet, pour la recherche.
    for (const v of e.metadata?.detectedThumbnails ?? []) {
      const t = textesDe(v);
      if (t.length) textes.set(String(v.objectId ?? ''), t);
    }
  }

  // Le recensement porte sur ce qui est descendu AVANT affinage : les filtres doivent
  // montrer ce qui existe, pas ce qui reste apres qu'on a deja filtre.
  const recensement = recenser(objets);

  let retenus = filtrer(objets, {
    seuil: Number.isFinite(params.seuil) ? params.seuil : 0,
    types: Array.isArray(params.types) ? params.types : [],
    couleurs: Array.isArray(params.couleurs) ? params.couleurs : [],
    cameras: Array.isArray(params.cameras) ? params.cameras : [],
  });

  if (params.texte) {
    retenus = retenus.filter((o) => correspond(params.texte, textes.get(o.objectId) ?? []));
  }

  retenus.sort((a, b) => (b.debut ?? 0) - (a.debut ?? 0));
  const LIMITE_PAGE = 300;
  return {
    objets: retenus.slice(0, LIMITE_PAGE),
    total: retenus.length,
    tronque: retenus.length > LIMITE_PAGE,
    recensement,
    fenetre: { debut, fin },
  };
});

/*
 * Les veilles : lecture et enregistrement.
 *
 * La configuration vit dans config.json, a cote du reste. Elle ne contient aucun secret —
 * des sujets, des cameras, des horaires — et gagne a etre lisible si l'on veut regarder.
 */
ipcMain.handle('protect:veilles', async () => { await demarrage; return lireVeilles(); });

ipcMain.handle('protect:veillesEnregistrer', async (_event, veilles) => {
  if (perimee) throw new Error(i18n.t('main.copiePerimee'));
  if (!veilles || typeof veilles !== 'object' || !Array.isArray(veilles.veilles)) {
    throw new Error('Configuration de veille invalide.');
  }
  const config = store.readConfig();
  store.writeConfig({ ...config, veilles });
  const actives = veilles.veilles.filter((v) => v.actif).length;
  journal.info('watch',
    `configuration saved: ${actives} active watch(es), ${veilles.armee ? 'armed' : 'disarmed'}`);
  return lireVeilles();
});

/**
 * Volume observe par sujet sur les sept derniers jours.
 *
 * C'est ce que Protect ne dit nulle part, et la seule information qui empeche de se noyer :
 * sur le poste de reference, 157 mouvements par jour contre UNE personne. Cocher une case sans savoir
 * cela, c'est choisir a l'aveugle.
 */
ipcMain.handle('protect:volumes', async () => {
  await demarrage;
  if (!clientActif) return null;
  const fin = Date.now();
  const debut = fin - 7 * 86400000;
  const bruts = await clientActif.getEvents({
    debut, fin, limite: 5000, types: ['motion', 'smartDetectZone', 'smartAudioDetect'],
  });
  const parSujet = new Map();
  for (const e of bruts) {
    for (const s of sujetsDe({ type: e.type, sujets: e.smartDetectTypes ?? [] })) {
      parSujet.set(s, (parSujet.get(s) ?? 0) + 1);
    }
  }
  // Par JOUR : c'est l'unite dans laquelle on ressent une notification.
  return Object.fromEntries([...parSujet].map(([s, n]) => [s, Math.round((n / 7) * 10) / 10]));
});

/*
 * Etat du systeme, pour la colonne laterale.
 *
 * Ce qui n'a pas ete trouve n'est pas invente : « disque » vaut null plutot que zero, et
 * l'interface fait alors disparaitre le bloc au lieu d'afficher une jauge fausse.
 */
ipcMain.handle('protect:systeme', async () => {
  await demarrage;
  // La projection vit dans discovery.js, ou elle est verifiable hors ligne contre le
  // contrat TypeScript. Enumerer les champs ICI a coute six champs perdus en silence.
  return etatPourInterface(systeme, cameras, app.getVersion());
});
ipcMain.handle('protect:relayBase', async () => { await demarrage; return relay?.webrtcBase ?? null; });
ipcMain.handle('protect:journalPath', () => journal.chemin());

/*
 * Etat courant, sur demande.
 *
 * L'envoi seul ne suffit pas : entre le chargement de la page et le moment ou elle
 * s'abonne, tout message est perdu. Le relais pouvait donc etre pret et diffuser pendant
 * que le panneau affichait encore « Démarrage… » — constate sur le poste reel en 2.0.8.
 * La page tire l'etat a son montage ; l'envoi ne sert plus qu'aux changements.
 */
ipcMain.handle('protect:etats', () => ({
  relais: etatRelaisCourant(),
  maj: dernierEtatMaj,
  progression: dernierEtatProgression,
  // La fenetre peut rouvrir en plein ecran (etat memorise) : la page doit le savoir,
  // sinon son bouton F11 croit partir de la fenetre normale et se decale d'un cran.
  fenetre: { pleinEcran: Boolean(window && !window.isDestroyed() && window.isFullScreen()) },
}));

/*
 * Demarrage avec Windows.
 *
 * L'inscription vise le LANCEUR STABLE, au-dessus de « current\ » : l'executable versionne
 * change de contenu a chaque mise a jour, et une cle Run qui le viserait par un chemin
 * gele casserait au premier changement de dossier. Le lanceur, lui, ne bouge jamais.
 *
 * L'etat rendu est RELU du registre apres ecriture, jamais suppose : c'est la seule preuve
 * que l'inscription a reellement eu lieu.
 */
function lanceurStable() {
  const stable = path.resolve(path.dirname(process.execPath), '..', path.basename(process.execPath));
  // Usage portable (pas de lanceur au-dessus) : on retombe sur l'executable lui-meme.
  return fs.existsSync(stable) ? stable : process.execPath;
}

/*
 * Le demarrage automatique n'existe que la ou Electron sait l'inscrire.
 *
 * « setLoginItemSettings » est documente pour Windows et macOS seulement : sous Linux, il
 * ne fait rien et « getLoginItemSettings » rend toujours faux. Un interrupteur qui revient
 * a zero sans un mot est pire que pas d'interrupteur — on le declare indisponible, et
 * l'ecran des reglages dit alors pourquoi.
 */
const AUTO_DEMARRAGE_POSSIBLE = process.platform === 'win32' || process.platform === 'darwin';

ipcMain.handle('protect:autoDemarrage', () => {
  if (!app.isPackaged || !AUTO_DEMARRAGE_POSSIBLE) return { actif: false, disponible: false };
  const reglages = app.getLoginItemSettings({ path: lanceurStable() });
  return { actif: reglages.openAtLogin, disponible: true };
});

ipcMain.handle('protect:autoDemarrageChanger', (_event, actif) => {
  if (!app.isPackaged || !AUTO_DEMARRAGE_POSSIBLE) return { actif: false, disponible: false };
  app.setLoginItemSettings({ openAtLogin: Boolean(actif), path: lanceurStable() });
  const reglages = app.getLoginItemSettings({ path: lanceurStable() });
  journal.info('config',
    `open at login ${reglages.openAtLogin ? 'enabled' : 'disabled'} (${lanceurStable()})`);
  return { actif: reglages.openAtLogin, disponible: true };
});

/** Ce qu'il faut pouvoir citer au telephone quand quelque chose ne va pas. */
ipcMain.handle('protect:infos', () => {
  const config = store.readConfig();
  return {
    version: app.getVersion(),
    journal: journal.chemin(),
    donnees: app.getPath('userData'),
    host: config.host ?? null,
    username: config.username ?? null,
    // On expose l'existence de l'empreinte, jamais sa valeur.
    appaire: Boolean(config.pins?.length),
  };
});

/*
 * Journal des detections.
 *
 * Le controleur emet aussi des evenements de console — armement, acces, activite
 * administrative. Ils n'ont rien a faire dans un journal de DETECTIONS : mesure du
 * 28.07.2026, ils representaient 74 entrees sur 1862, et noieraient la lecture sans rien
 * apprendre sur ce qui s'est passe devant les cameras.
 */
const TYPES_DETECTION = ['motion', 'smartDetectZone', 'smartAudioDetect'];

ipcMain.handle('protect:evenements', async (_event, { avant, jours = 7, limite = 60 } = {}) => {
  if (!clientActif) throw new Error('Aucune session ouverte pour le moment.');

  const fin = Number.isFinite(avant) ? avant : Date.now();
  const debut = fin - jours * 86_400_000;
  const bruts = await clientActif.getEvents({ debut, fin, limite, types: TYPES_DETECTION });

  // Le nom des cameras vit ici : la page n'a pas a le deviner, et l'identifiant seul ne
  // dit rien a personne.
  const noms = new Map(cameras.map((c) => [c.id, c.name]));
  return bruts.map((e) => ({
    id: e.id,
    type: e.type,
    camera: e.camera ?? null,
    cameraNom: noms.get(e.camera) ?? null,
    debut: e.start ?? null,
    fin: e.end ?? null,          // absent = evenement encore en cours
    sujets: e.smartDetectTypes ?? [],
    score: typeof e.score === 'number' ? e.score : null,
    vignette: Boolean(e.thumbnail),
  }));
});

/**
 * Obtient l'extrait d'une detection, et rend l'adresse locale a lire.
 *
 * Une marge encadre l'evenement : la detection commence quand le mouvement est CONFIRME,
 * pas quand il debute. Sans ces quelques secondes, on ouvre l'extrait sur une scene deja
 * commencee et l'on ne voit jamais d'ou vient ce qui passe.
 */
const MARGE_MS = 3000;

ipcMain.handle('protect:extraire', async (_event, { camera, debut, fin }) => {
  if (!extraits) throw new Error(i18n.t('main.pasPret'));
  if (!camera || !Number.isFinite(debut)) throw new Error(i18n.t('main.detectionIncomplete'));

  // Une detection en cours n'a pas de fin : on prend ce qui existe deja.
  const enCours = !Number.isFinite(fin);
  const finReelle = enCours ? Math.min(Date.now(), debut + 120_000) : fin;

  // La marge de fin ne doit pas depasser l'instant present : rien n'est encore enregistre
  // apres, et demander une periode qui n'existe pas ferait rendre au controleur soit un
  // refus, soit un extrait tronque sans que rien ne l'explique.
  const finDemandee = Math.min(finReelle + MARGE_MS, Date.now());

  const { jeton, octets } = await extraits.obtenir({
    cameraId: camera,
    debut: debut - MARGE_MS,
    fin: finDemandee,
  });
  return { url: `/extrait/${jeton}`, octets, marge: MARGE_MS };
});

/**
 * Obtient la video AUTOUR D'UN INSTANT, pour la frise.
 *
 * Deux contraintes tirees de la mesure, et qui commandent tout :
 *
 *  - le controleur produit a ~19 Mo/s, mais la G6 pese 3,5 Mo par seconde de video en
 *    3840 x 2160. Une minute demandee, c'est 210 Mo et onze secondes d'attente : on ne
 *    demande donc que quelques secondes a la fois, et l'on enchaine ;
 *  - le morceau est ALIGNE sur une grille absolue. Sans cela, deux clics voisins dans la
 *    meme seconde produiraient deux fichiers differents, tous deux telecharges. Aligne,
 *    tout un voisinage retombe sur le meme extrait, deja sur le disque.
 */
const PAS_SEQUENCE_MS = 10_000;
const PAS_SEQUENCE_MAX_MS = 60_000;

ipcMain.handle('protect:sequence', async (_event, { camera, instant, duree, depuis }) => {
  if (!extraits) throw new Error(i18n.t('main.pasPret'));
  if (!camera) throw new Error(i18n.t('main.cameraManquante'));

  const pas = Math.min(
    PAS_SEQUENCE_MAX_MS,
    Math.max(PAS_SEQUENCE_MS, Number.isFinite(duree) ? duree : PAS_SEQUENCE_MS),
  );

  // « depuis » = enchainement pendant la lecture : le morceau reprend EXACTEMENT ou le
  // precedent s'est arrete. « instant » = un clic : on retombe sur la grille, donc sur un
  // fichier probablement deja obtenu.
  const bornes = Number.isFinite(depuis)
    ? Extraits.suite(depuis, pas)
    : (Number.isFinite(instant) ? Extraits.morceau(instant, pas) : null);
  if (!bornes) throw new Error(i18n.t('main.instantNonEnregistre'));
  const { debut, fin } = bornes;

  const { jeton, octets } = await extraits.obtenir({ cameraId: camera, debut, fin });
  return { url: `/extrait/${jeton}`, debut, fin, octets };
});

/** Enregistre un extrait deja obtenu la ou l'utilisateur le decide. */
ipcMain.handle('protect:enregistrerExtrait', async (_event, { jeton, nom }) => {
  if (!extraits || !window) return { enregistre: false };
  const source = extraits.chemin(String(jeton));
  if (!fs.existsSync(source)) throw new Error('L’extrait n’est plus disponible.');

  // Un nom venu de l'interface ne doit jamais pouvoir designer un autre dossier.
  const propre = String(nom ?? 'extrait').replace(/[^A-Za-z0-9 _.-]/g, '_').slice(0, 80);
  const { canceled, filePath } = await dialog.showSaveDialog(window, {
    title: 'Enregistrer l’extrait',
    defaultPath: path.join(app.getPath('videos'), `${propre}.mp4`),
    filters: [{ name: i18n.t('main.videoMp4'), extensions: ['mp4'] }],
  });
  if (canceled || !filePath) return { enregistre: false };

  // Copie provisoire puis renommage : une copie interrompue ne doit pas laisser un
  // fichier tronque portant le nom que l'utilisateur a choisi.
  const provisoire = `${filePath}.part`;
  await fs.promises.copyFile(source, provisoire);
  await fs.promises.rename(provisoire, filePath);
  journal.info('clip', `saved: ${filePath}`);
  return { enregistre: true, chemin: filePath };
});

/** Ouvre le dossier des donnees dans l'explorateur, journal compris. */
ipcMain.handle('protect:ouvrirJournal', () => {
  shell.showItemInFolder(journal.chemin());
});

/* ------------------------------------------------------------------------- langue */

/**
 * La langue effective : le choix de l'utilisateur, ou celle de Windows a defaut.
 *
 * Tout ce qui PARLE la lit — l'ecran par le pont, les notifications directement ici.
 * Seuls 'fr' et 'en' existent ; toute autre langue de Windows tombe sur l'anglais,
 * la langue de l'open source.
 */
function langueEffective() {
  const choix = store.readConfig().langue;
  if (i18n.LANGUES[choix]) return choix;
  // La langue de Windows si on la parle, l'anglais sinon — la langue de l'open source.
  const sys = String(app.getLocale() ?? '').toLowerCase().slice(0, 2);
  return i18n.LANGUES[sys] ? sys : 'en';
}

ipcMain.handle('protect:langue', () => ({
  choix: store.readConfig().langue || 'auto',
  effective: langueEffective(),
}));

ipcMain.handle('protect:langueChanger', (_event, choix) => {
  const propre = i18n.LANGUES[choix] ? choix : '';
  store.writeConfig({ ...store.readConfig(), langue: propre });
  // Le principal parle AUSSI : ses prochains messages — bulles, relais, erreurs —
  // partent dans la nouvelle langue, sans redemarrage.
  i18n.definirLangue(langueEffective());
  journal.info('language', `choice ${propre || 'auto'} — effective ${langueEffective()}`);
  return { choix: propre || 'auto', effective: langueEffective() };
});

/* ------------------------------------------------------ nouveautes apres mise a jour */

/** Calcule au demarrage, avant marquerVersion — voir la sequence de lancement. */
let nouveautesEnAttente = null;

ipcMain.handle('protect:nouveautes', () => nouveautesEnAttente);

ipcMain.handle('protect:nouveautesVues', () => {
  if (!nouveautesEnAttente) return;
  store.marquerPresentee(nouveautesEnAttente.a);
  nouveautesEnAttente = null;
});

/**
 * Mise a jour au lancement — automatique, sans echappatoire.
 *
 * L'application ne s'ouvre jamais dans une version perimee : si une version plus recente
 * existe, elle est telechargee, verifiee, appliquee, et l'application redemarre a jour.
 *
 * Deux garde-fous, sans lesquels ce choix deviendrait hostile :
 *   - la RECHERCHE est bornee a trois secondes. Un depot injoignable ou une coupure de
 *     reseau ne doivent jamais retarder l'acces aux cameras ;
 *   - tout echec — reseau, empreinte invalide, disque plein — laisse simplement demarrer
 *     l'application. Une mise a jour ratee n'a jamais empeche de voir ses cameras.
 *
 * La recherche tourne EN PARALLELE de la connexion au controleur : dans le cas courant,
 * ou il n'y a rien a installer, on ne perd pas une seconde.
 */
async function majAuDemarrage() {
  maj.demarrage = true;
  try {
    pushMajState({ etat: 'verification', demarrage: true });
    const cible = await avecDelai(maj.chercher(), 3000, i18n.t('delai.rechercheMaj'));

    if (!cible) {
      journal.info('update', `up to date (${app.getVersion()})`);
      pushMajState({ etat: 'aucune' });
      return;
    }

    journal.info('update', `version ${cible.Version} found, applying at startup`);
    pushMajState({ etat: 'telechargement', version: cible.Version, pourcent: 0, demarrage: true });
    await maj.obtenir(cible);

    pushMajState({ etat: 'application', version: cible.Version, demarrage: true });

    // Le verrou AVANT l'arret : une decouverte en vol ne doit pas rouvrir le relais.
    majImminente = true;
    // On ATTEND sa mort : l'installation remplace le dossier où il vit, et un fichier
    // encore verrouillé la fait échouer. L'attente forfaitaire d'avant était un pari.
    await relay?.stop();
    relay = null;

    if (maj.redemarrer()) { app.quit(); return; }
    throw new Error('application impossible');
  } catch (e) {
    // Jamais bloquant : on note, on libere l'ecran, l'application demarre.
    journal.alerte('update', `startup update abandoned: ${e.message}`);
    // L'application demarre : le relais doit pouvoir repartir.
    majImminente = false;
    maj.demarrage = false;
    pushMajState({ etat: 'aucune' });
    // La decouverte a pu etre suspendue par le verrou : on la relance.
    demarrage = startFromStoredCredentials();
  } finally {
    maj.demarrage = false;
  }
}

/* -------------------------------------------------------------- mises a jour */

ipcMain.handle('protect:majVerifier', async () => {
  if (!maj) {
    // En developpement il n'y a ni Update.exe ni version installee : on le dit.
    pushMajState({ etat: 'erreur', message: 'unavailable outside the installed application' });
    return;
  }
  await maj.verifier();
});

ipcMain.handle('protect:majRedemarrer', async () => {
  if (!maj?.prete) return false;

  // Le relais vit dans le dossier que l'installation va remplacer : il doit mourir
  // AVANT qu'on rende la main, sinon le fichier verrouille fait echouer l'application.
  majImminente = true;
  await relay?.stop();
  relay = null;

  if (!maj.redemarrer()) return false;
  app.quit();
  return true;
});

/*
 * Plein ecran.
 *
 * Seul le processus principal peut agir sur la fenetre. Le plein ecran du navigateur ne
 * conviendrait pas : il laisse la barre de titre et ne couvre pas la barre des taches.
 */
ipcMain.handle('protect:pleinEcran', (_event, actif) => {
  if (!window) return false;
  window.setFullScreen(Boolean(actif));
  return window.isFullScreen();
});

/** Retente sans redemarrer : une panne passagere ne doit pas condamner la session. */
ipcMain.handle('protect:retry', async () => {
  if (perimee) return;
  clearTimeout(reprise);
  demarrage = startFromStoredCredentials();
  await demarrage;
});

/**
 * Ramene a l'ecran de connexion. Seule issue quand la configuration est fautive.
 *
 * La connexion est mise de cote avant d'etre effacee : une remise a zero par erreur ne
 * doit plus couter une ressaisie complete. L'ecran de connexion propose de la reprendre.
 */
ipcMain.handle('protect:reconfigure', async () => {
  if (perimee) return false;
  clearTimeout(reprise);
  await relay?.stop();
  relay = null;
  cameras = [];
  // Le client porte la session du compte qu'on abandonne : le garder laisserait des
  // vignettes et des detections accessibles apres une remise a zero.
  clientActif = null;
  CACHE_VIGNETTES.clear();
  identifiantsDeSession = null;

  let archivee = false;
  try {
    archivee = store.archiverConfiguration();
  } catch (e) {
    journal.alerte('config', `connection set-aside failed: ${e.message}`);
  }

  store.clearSecrets();
  store.writeConfig({ ...store.readConfig(), configured: false });
  journal.info('config',
    `reset requested from the ui${archivee ? ' — connection set aside' : ''}`);
  return true;
});

/** Existence et date de la connexion mise de cote. Jamais son contenu. */
ipcMain.handle('protect:sauvegarde', () => store.sauvegarde());

/** Repose la connexion mise de cote, puis relance la decouverte. */
ipcMain.handle('protect:restaurer', async () => {
  if (perimee) return false;
  if (!store.restaurerSauvegarde()) return false;
  journal.info('config', 'previous connection restored');
  clearTimeout(reprise);
  attente = 5000;
  demarrage = startFromStoredCredentials();
  await demarrage;
  return true;
});

/* ------------------------------------------------------------------ demarrage */

/**
 * Reprise automatique.
 *
 * La decouverte n'etait tentee qu'une fois, au lancement. Un controleur qui redemarre, un
 * reseau qui met dix secondes a monter, un portable ouvert hors de la maison : tout cela
 * figeait l'application jusqu'au prochain lancement manuel. On reessaie donc, en espacant,
 * sauf quand l'erreur est de celles que le temps ne corrigera pas.
 */
let reprise = null;
let attente = 5000;
const ATTENTE_MAX = 60000;

/**
 * Instant avant lequel aucune tentative de connexion n'est permise.
 *
 * Le controleur repond 429 avec un delai a respecter. Ce delai etait porte par l'erreur
 * mais ignore : les quatre chemins qui ouvrent une session — lancement, reprise
 * automatique, bouton « Réessayer », reveil — pouvaient repartir aussitot et prolonger le
 * blocage au lieu de le laisser expirer.
 */
let pasAvant = 0;

/** Attend, si le controleur a demande de patienter. */
async function respecterLeDelai() {
  const reste = pasAvant - Date.now();
  if (reste <= 0) return;
  journal.info('retry', `the controller asks to wait another ${Math.ceil(reste / 1000)} s`);
  await new Promise((r) => setTimeout(r, reste));
}

function programmerReprise(cause, delaiImpose) {
  clearTimeout(reprise);
  // Un delai reclame par le controleur prime sur notre propre attente : insister avant
  // qu'il expire ne fait que le prolonger.
  if (Number.isFinite(delaiImpose) && delaiImpose > 0) {
    attente = Math.max(attente, delaiImpose * 1000);
    pasAvant = Date.now() + delaiImpose * 1000;
  }
  const secondes = Math.round(attente / 1000);
  journal.info('retry', `new attempt in ${secondes} s`);
  // La reprise doit se VOIR : sans cela, l'utilisateur croit l'application figee et
  // cherche un bouton. On annonce donc l'echeance, et le compte a rebours suffit.
  pushRelayState({
    running: false,
    message: cause ?? i18n.t('relais.connexionImpossible'),
    remedy: i18n.t('relais.nouvelleTentative', { s: secondes }),
  });
  reprise = setTimeout(() => {
    demarrage = startFromStoredCredentials();
  }, attente);
  attente = Math.min(ATTENTE_MAX, attente * 2);
}

/** Ouvre la session puis publie les flux. Suppose les identifiants disponibles. */
async function connecter(config) {
  const client = makeClient(config);
  client.setCredentials({
    username: config.username ?? identifiantsDeSession?.username,
    password: identifiantsDeSession?.password ?? store.readSecret('password'),
    totpSeed: identifiantsDeSession?.totpSeed ?? store.readSecret('totp') ?? undefined,
  });

  if (!client.session.usable) await client.login();
  pushProgression('session');
  await discoverAndPublish(client, config);

  /*
   * Le client SURVIT a la connexion.
   *
   * Il etait cree puis jete a chaque cycle : rien ne pouvait ensuite interroger le
   * controleur, ni pour les detections, ni pour une vignette. Le garder, c'est aussi
   * garder sa session — donc ne pas se reconnecter a chaque question posee.
   */
  clientActif = client;
  demarrerVeille();

  clearTimeout(reprise);
  attente = 5000;
}

/**
 * Ouvre la liaison temps reel et met le veilleur en service.
 *
 * Appelee a chaque session ouverte. La liaison se rouvre seule si elle tombe ; ce qui est
 * relance ici, c'est le cas ou la SESSION change — nouveau cookie, nouveau client.
 */
function demarrerVeille() {
  if (!clientActif) return;
  flux?.arreter();

  veilleur ??= new Veilleur({
    config: () => lireVeilles(),
    client: () => clientActif,
    nomCamera: (id) => cameras.find((c) => c.id === id)?.name ?? 'camera',
    dossier: path.join(app.getPath('userData'), 'bulles'),
    journal,
    onDetection: (d) => envoyerPage('protect:detectionVive', {
      ...d, cameraNom: d.camera ? (cameras.find((c) => c.id === d.camera)?.name ?? null) : null,
    }),
    // Un clic sur la bulle ramene l'application AU PREMIER PLAN et la page ouvre la
    // sequence. Une notification sur laquelle il ne se passe rien ne vaut pas d'exister.
    onOuvrir: (d) => {
      if (window) {
        if (window.isMinimized()) window.restore();
        window.show();
        window.focus();
      }
      envoyerPage('protect:ouvrirDetection', d);
    },
  });

  flux = new FluxChangements({ client: () => clientActif, journal });
  flux.on('detection', (d) => { void veilleur.recevoir(d); });
  flux.demarrer();
}

/** Configuration des veilles, avec la configuration de depart si rien n'est enregistre. */
function lireVeilles() {
  try {
    const v = store?.readConfig()?.veilles;
    if (v && typeof v === 'object' && Array.isArray(v.veilles)) return v;
  } catch { /* illisible : on retombe sur les valeurs de depart */ }
  return veillesParDefaut();
}

async function startFromStoredCredentials() {
  // Chaque tentative repart du debut : une reprise apres echec ne doit pas afficher des
  // etapes encore franchies de la tentative precedente.
  pushProgression('demarrage');
  await respecterLeDelai();
  const config = store.readConfig();
  if (!config.configured) {
    journal.info('startup', 'no configuration: sign-in screen');
    return;
  }

  // Aucun secret utilisable. Le cas se produit apres un « ne pas rester connecte », ou
  // quand le profil Windows a change : le chiffrement est lie au compte qui a saisi.
  const password = identifiantsDeSession?.password ?? store.readSecret('password');
  if (!password) {
    journal.alerte('startup', 'credentials not stored on this machine');
    pushRelayState({
      running: false,
      permanent: true,
      message: i18n.t('relais.identifiantsAbsents'),
      remedy: i18n.t('relais.identifiantsAbsentsRemede'),
    });
    return;
  }

  try {
    await connecter(config);
  } catch (e) {
    journal.erreur('startup', journal.deErreur(e));
    const err = e instanceof ProtectError ? e : null;
    // Reessayer ne corrigera ni un mot de passe faux ni un pare-feu : dans ce cas on
    // s'arrete et l'interface propose de revoir la configuration. Sinon, on reprend seul.
    if (err?.permanent) {
      pushRelayState({
        running: false,
        permanent: true,
        message: err.userMessage,
        remedy: err.remedy,
      });
    } else {
      programmerReprise(err?.userMessage, err?.retryAfterSeconds);
    }
  }
}

/*
 * Reveil de veille.
 *
 * Au retour, les sessions WebRTC sont mortes et la carte reseau n'est pas encore prete :
 * se reconnecter dans la seconde echoue a coup sur, consomme une tentative et enclenche
 * l'attente croissante — l'utilisateur retrouve alors une application qui annonce un echec
 * alors que tout va bien. On laisse donc au reseau le temps de remonter.
 */
const GRACE_REVEIL_MS = 4000;
let repriseReveil = null;

function auReveil(cause) {
  clearTimeout(repriseReveil);
  journal.info('retry', `${cause}: reconnecting in ${GRACE_REVEIL_MS / 1000} s`);
  pushRelayState({
    running: false,
    message: i18n.t('relais.repriseVeille'),
    remedy: i18n.t('relais.repriseVeilleRemede'),
  });
  repriseReveil = setTimeout(() => {
    clearTimeout(reprise);
    attente = 5000;               // le reveil n'est pas un enieme echec : on repart net
    demarrage = startFromStoredCredentials();
  }, GRACE_REVEIL_MS);
}

/*
 * Une seule instance. Deux copies ouvriraient deux relais sur les memes ports : la seconde
 * echouerait a se lier et la premiere continuerait de fonctionner, ce qui donne une fenetre
 * definitivement vide. Un double-clic de trop ne doit pas produire cela.
 */
if (!app.requestSingleInstanceLock()) {
  // Journalise avant de sortir : sans cette ligne, le journal montrait un demarrage suivi
  // de rien du tout, ce qui ressemble a s'y meprendre a un plantage silencieux.
  journal.info('startup', 'already running: this copy exits and hands back focus');
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!window) return;
    if (window.isMinimized()) window.restore();
    window.focus();
  });

  app.whenReady().then(() => {
    // La fenetre EN PREMIER : c'est le seul organe capable de montrer quoi que ce soit.
    // Initialiser avant elle, c'est risquer un processus vivant, sans fenetre, que le
    // verrou d'instance empeche ensuite de relancer.
    protocol.handle(SCHEMA_UI, servirUi);
    createWindow();

    try {
      store = new Store(app.getPath('userData'));
      // La langue AVANT tout ce qui parle : le relais, le veilleur et les erreurs typees
      // liront le dictionnaire dans la langue choisie (ou celle de Windows).
      i18n.definirLangue(langueEffective());
      extraits = new Extraits({
        dossier: path.join(app.getPath('userData'), 'extraits'),
        client: () => clientActif,
        journal,
        onProgres: (e) => envoyerPage('protect:extraitProgres', e),
      });
      // Les extraits d'hier n'interessent plus personne, et pesent.
      extraits.balayer();
    } catch (e) {
      journal.erreur('startup', journal.deErreur(e));
      dialog.showErrorBox('Alcora',
        `${i18n.t('main.dossierDonnees')}\n\n${journal.chemin()}`);
      app.quit();
      return;
    }

    /*
     * Copie perimee : on ne touche a rien.
     *
     * Ce dossier de donnees est partage par toutes les copies presentes sur le poste. Une
     * version anterieure a celle qui a deja tourne ici n'a rien de legitime a y faire :
     * elle ne connait pas le format ecrit depuis, et ses propres garde-fous sont ceux
     * d'hier. Le 23.07.2026, une 2.0.0 oubliee dans un dossier d'essai — encore epinglee a
     * la barre des taches, donc lancee sans le savoir — a ainsi efface les identifiants de
     * l'installation courante en un clic, faute de confirmation a l'epoque.
     */
    perimee = store.versionPlusRecente(app.getVersion());
    if (perimee) {
      journal.alerte('startup',
        `outdated copy ${app.getVersion()}: ${perimee} already ran here — no action`);
      pushRelayState({
        running: false,
        permanent: true,
        message: i18n.t('main.copiePerimeeVersion', { version: app.getVersion() }),
        remedy: i18n.t('main.copiePerimeeRemede', { version: perimee }),
      });
      return;
    }
    /*
     * Les nouveautes a presenter se calculent AVANT de marquer la version : c'est l'ecart
     * entre ce qui tourne et ce qui a ete VU qui fait le contenu, et marquer d'abord
     * l'effacerait. Le resultat est retenu pour la page, qui le demandera apres l'intro.
     */
    nouveautesEnAttente = store.nouveautesAPresenter(app.getVersion());
    if (nouveautesEnAttente) {
      journal.info('startup',
        `what's-new to present: ${nouveautesEnAttente.de} → ${nouveautesEnAttente.a}`);
    }
    store.marquerVersion(app.getVersion());

    // La fenetre s'affiche tout de suite ; la decouverte se fait en parallele et les
    // appels de la page l'attendent d'eux-memes.
    demarrage = startFromStoredCredentials();

    // Mises a jour : seulement une fois installee — en developpement il n'y a rien a
    // mettre a jour. Premiere verification differee pour ne pas concurrencer les flux
    // au demarrage, puis toutes les six heures.
    // Reveil de veille et retour du reseau : les deux tuent les sessions en cours.
    powerMonitor.on('resume', () => auReveil('wake from sleep'));
    powerMonitor.on('unlock-screen', () => {
      // Deverrouiller n'a rien coupe si le relais tourne : ne rien faire dans ce cas.
      if (!relay?.state.running) auReveil('session unlocked');
    });

    /*
     * La chaine de mise a jour est celle de Velopack, et Velopack est ici la version
     * Windows : elle publie des .nupkg, lit « releases.win.json » et confie l'application
     * a Update.exe. Rien de tout cela n'existe sur une autre plateforme.
     *
     * On ne la demarre donc pas ailleurs, et surtout on le DIT : l'ecran des reglages
     * annonce une mise a jour manuelle plutot que de laisser croire a une surveillance
     * qui n'aura jamais lieu. Une chaine muette est exactement ce qui a coute trois jours
     * en juillet — mieux vaut pas de chaine qu'une chaine qui ment.
     */
    if (app.isPackaged && process.platform === 'win32') {
      maj = new GestionnaireMaj({
        version: app.getVersion(),
        dossier: path.join(app.getPath('userData'), 'maj'),
        executable: process.execPath,
        fetcher: (url) => net.fetch(url, { cache: 'no-store' }),
        journal,
        onEtat: pushMajState,
      });
      void majAuDemarrage();
      setInterval(() => void maj.verifier(), 6 * 3_600_000);
    } else if (app.isPackaged) {
      journal.info('update', `no automatic update chain on ${process.platform}`);
      pushMajState({ etat: 'manuelle' });
    }
  }).catch((e) => {
    journal.erreur('startup', journal.deErreur(e));
    dialog.showErrorBox('Alcora',
      `${i18n.t('main.pasDemarre')}\n\n${i18n.t('main.detailsDans')}\n${journal.chemin()}`);
    app.quit();
  });
}

app.on('window-all-closed', () => {
  relay?.stop();          // un relais orphelin garderait une session sur le controleur
  app.quit();
});

app.on('before-quit', () => { flux?.arreter(); relay?.stop(); });
