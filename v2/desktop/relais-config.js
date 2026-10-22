'use strict';

/**
 * La configuration du relais (MediaMTX), et rien d'autre : un module pur, sans disque ni
 * processus, pour que test-relais-config.js puisse la confronter a la configuration PAR
 * DEFAUT du binaire epingle.
 *
 * POURQUOI CE FICHIER EXISTE. Audit du 22.10.2026, sur le poste de reference, en 2.29.3 :
 *
 *   1. L'API de controle etait allumee — par nous, elle est eteinte par defaut — sans mot de
 *      passe et ouverte a toutes les origines. Une page web etrangere pouvait la lire, et
 *      passait le controle CORS pour REECRIRE la configuration, qui sait lancer des
 *      commandes. C'est l'avis critique GHSA-w334-5mp5-h897 de MediaMTX 1.20.1. Alcora ne
 *      se servait meme pas de cette API.
 *   2. MediaMTX a ajoute un serveur MoQ, ALLUME par defaut, sur toutes les interfaces.
 *      Notre configuration coupait RTSP, RTMP, HLS et SRT une a une... mais ignorait celui
 *      qui n'existait pas encore. Avec l'utilisateur par defaut « any », sans mot de passe
 *      et depuis n'importe quelle adresse, tout appareil du reseau pouvait lire les cameras.
 *   3. La lecture video (WHEP) n'avait aucun mot de passe et repondait a toutes les origines.
 *
 * D'ou trois principes, que le test tient :
 *   - CHAQUE serveur est nomme et eteint explicitement, sauf WebRTC. Un serveur que l'on
 *     n'a pas nomme est un serveur que l'on n'a pas decide d'eteindre.
 *   - Un seul utilisateur, tire au hasard a chaque lancement, en LECTURE seule, depuis la
 *     boucle locale seulement. Plus jamais « any ».
 *   - Une seule origine admise : celle de l'interface d'Alcora.
 */

const crypto = require('node:crypto');

/** La version de MediaMTX pour laquelle cette configuration a ete pensee et eprouvee. */
const VERSION_RELAIS = 'v1.21.2';

/** Les serveurs que MediaMTX sait faire tourner. Seul WebRTC sert a Alcora. */
const SERVEURS = ['api', 'metrics', 'pprof', 'playback', 'rtsp', 'rtmp', 'hls', 'webrtc', 'srt', 'moq'];

/** Identifiant du relais, tire au hasard. Il ne sert que pour la vie d'un lancement. */
function nouvelIdentifiant() {
  return { utilisateur: 'alcora', motDePasse: crypto.randomBytes(24).toString('base64url') };
}

/** L'en-tete qu'une requete WHEP doit presenter. */
function autorisation({ utilisateur, motDePasse }) {
  return `Basic ${Buffer.from(`${utilisateur}:${motDePasse}`, 'utf8').toString('base64')}`;
}

/**
 * Les parametres du relais, sous forme d'objet : ce que le test inspecte.
 *
 * @param {object} o
 * @param {{webrtc:number, api:number, ice:number, iceTcp:number}} o.ports
 * @param {{path:string, url:string}[]} o.cameras
 * @param {{utilisateur:string, motDePasse:string}} o.identifiant
 * @param {string[]} o.origines  origines admises — celle de l'interface, plus celle du
 *   serveur de developpement quand il y en a un
 * @param {boolean} [o.api]  allume l'API, en boucle locale et avec mot de passe — reserve au
 *   test manuel test-relay.js, jamais a l'application
 */
function parametresRelais({ ports, cameras, identifiant, origines, api = false }) {
  if (!identifiant?.utilisateur || !identifiant?.motDePasse) {
    throw new Error('relay: no credentials — refusing to start an open relay');
  }
  const admises = (origines ?? []).filter((o) => typeof o === 'string' && o && o !== '*');
  if (!admises.length) throw new Error('relay: no allowed origin — refusing a wildcard');

  const p = { logLevel: 'warn' };
  for (const s of SERVEURS) p[s] = false;
  p.webrtc = true;

  if (api) {
    p.api = true;
    p.apiAddress = `127.0.0.1:${ports.api}`;
    p.apiAllowOrigins = [];
  }

  p.authMethod = 'internal';
  p.authInternalUsers = [{
    user: identifiant.utilisateur,
    pass: identifiant.motDePasse,
    ips: ['127.0.0.1', '::1'],
    permissions: [{ action: 'read', path: '' }, ...(api ? [{ action: 'api', path: '' }] : [])],
  }];

  p.webrtcAddress = `127.0.0.1:${ports.webrtc}`;
  p.webrtcAllowOrigins = admises;

  /*
   * Le chemin ICE en UDP ecoute sur TOUTES les interfaces, et c'est voulu.
   *
   * Contre-intuitif mais mesure : le navigateur n'emet aucun candidat de boucle locale.
   * Restreindre le relais a 127.0.0.1 ne laisse donc aucune paire joignable — la
   * negociation aboutit, l'etat passe « checking » puis « failed », sans message.
   *
   * Ce n'est pas une porte d'entree : aucun octet video n'y passe sans les identifiants
   * ICE negocies par WHEP — donc par la boucle locale, avec mot de passe.
   */
  p.webrtcLocalUDPAddress = `:${ports.ice}`;

  // Allume par defaut, et ECRIT quand meme : c'est lui qui fait annoncer au relais les
  // adresses de ses interfaces, sans lesquelles le navigateur n'a aucune paire joignable
  // (voir ci-dessus). Le garde-fou exige que tout ce qui est allume par defaut soit tranche.
  p.webrtcIPsFromInterfaces = true;

  /*
   * Chemin TCP sur la boucle locale, en plus de l'UDP. Le navigateur COMPOSE vers
   * l'adresse annoncee : 127.0.0.1 lui est joignable sans dependre de l'interface choisie.
   */
  p.webrtcLocalTCPAddress = `127.0.0.1:${ports.iceTcp}`;

  p.paths = {};
  for (const c of cameras) {
    p.paths[c.path] = {
      source: c.url,
      sourceOnDemand: true,
      sourceOnDemandCloseAfter: '15s',
      rtspTransport: 'tcp',
    };
  }
  return p;
}

/**
 * Ecrit l'objet en YAML. Un sous-ensemble suffit : objets, listes, chaines, booleens,
 * nombres. Toute chaine est ECRITE ENTRE GUILLEMETS (forme JSON, valide en YAML) : un mot
 * de passe ou une adresse qui contiendrait « : », « # » ou une apostrophe ne peut pas
 * changer de sens.
 */
function versYaml(valeur, retrait = '') {
  const scalaire = (v) => (typeof v === 'string' ? JSON.stringify(v) : String(v));
  const lignes = [];
  for (const [cle, v] of Object.entries(valeur)) {
    const k = /^[A-Za-z0-9_]+$/.test(cle) ? cle : JSON.stringify(cle);
    if (Array.isArray(v)) {
      if (!v.length) { lignes.push(`${retrait}${k}: []`); continue; }
      lignes.push(`${retrait}${k}:`);
      for (const e of v) {
        if (e && typeof e === 'object') {
          const corps = versYaml(e, `${retrait}    `).split('\n');
          lignes.push(`${retrait}  - ${corps[0].trimStart()}`, ...corps.slice(1));
        } else {
          lignes.push(`${retrait}  - ${scalaire(e)}`);
        }
      }
    } else if (v && typeof v === 'object') {
      if (!Object.keys(v).length) { lignes.push(`${retrait}${k}: {}`); continue; }
      lignes.push(`${retrait}${k}:`, versYaml(v, `${retrait}  `));
    } else {
      lignes.push(`${retrait}${k}: ${scalaire(v)}`);
    }
  }
  return lignes.join('\n');
}

function configurationRelais(o) {
  return `# Genere par Alcora pour MediaMTX ${VERSION_RELAIS}. Les modifications manuelles seront ecrasees.\n`
    + `${versYaml(parametresRelais(o))}\n`;
}

module.exports = {
  VERSION_RELAIS, SERVEURS, nouvelIdentifiant, autorisation, parametresRelais, versYaml,
  configurationRelais,
};
