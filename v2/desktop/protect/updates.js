'use strict';

const zlib = require('node:zlib');
const { EventEmitter } = require('node:events');
const { ClientWebSocket } = require('./websocket');

/**
 * Flux des changements du controleur, et sa traduction en detections.
 *
 * Mesure V-Alertes du 29.07.2026 : la liaison `wss://<hote>/proxy/protect/ws/updates`
 * s'ouvre au compte applicatif et porte bien les detections — motifs `smartDetectTypes`,
 * `smartAudioDetect`, `motion`, `ring`, `event` releves dans les trames recues.
 *
 * Le FORMAT, lui, n'est pas publie. Ce qui suit le lit tel qu'il s'observe : chaque message
 * porte DEUX paquets successifs — une trame d'action (« quoi a change »), puis une trame de
 * donnees (« ce qui a change »). Chacune commence par huit octets :
 *
 *   [0] type de paquet        1 = action, 2 = donnees
 *   [1] format de la charge   1 = JSON, 2 = texte, 3 = octets bruts
 *   [2] comprimee             0 ou 1 (zlib)
 *   [3] inutilise
 *   [4..7] taille de la charge, 32 bits gros-boutiste
 *
 * Comme il s'agit d'une lecture OBSERVEE et non d'une specification, tout ce qui ne se
 * comprend pas est ignore et consigne, jamais devine : un message mal lu ne doit produire
 * ni fausse alerte, ni plantage. C'est aussi pour cela que le decodeur est separe du
 * transport — il s'eprouve sur des trames fabriquees, sans controleur.
 */

const TYPE_ACTION = 1;
const TYPE_DONNEES = 2;
const FORMAT_JSON = 1;
const FORMAT_TEXTE = 2;

/** Types d'evenements qui parlent de ce qui s'est passe DEVANT une camera. */
const TYPES_DETECTION = ['motion', 'smartDetectZone', 'smartAudioDetect'];

/** Decoupe un message en paquets. Rend une liste vide si la structure ne tient pas. */
function paquets(buf) {
  const sortie = [];
  let p = 0;
  while (p + 8 <= buf.length) {
    const type = buf[p];
    const format = buf[p + 1];
    const comprimee = buf[p + 2] === 1;
    const taille = buf.readUInt32BE(p + 4);
    if (taille < 0 || p + 8 + taille > buf.length) break;   // structure incoherente
    sortie.push({ type, format, comprimee, charge: buf.subarray(p + 8, p + 8 + taille) });
    p += 8 + taille;
  }
  return sortie;
}

/** Charge utile d'un paquet, decomprimee et analysee selon son format annonce. */
function contenu(paquet) {
  let brut = paquet.charge;
  if (paquet.comprimee) {
    try { brut = zlib.inflateSync(brut); } catch { return null; }
  }
  if (paquet.format === FORMAT_JSON) {
    try { return JSON.parse(brut.toString('utf8')); } catch { return null; }
  }
  if (paquet.format === FORMAT_TEXTE) return brut.toString('utf8');
  return brut;
}

/**
 * Lit un message complet.
 * @returns {{action: object, donnees: object}|null} null si le message n'est pas exploitable
 */
function lireMessage(buf) {
  const p = paquets(buf);
  if (p.length < 2) return null;
  const action = p.find((x) => x.type === TYPE_ACTION);
  const donnees = p.find((x) => x.type === TYPE_DONNEES);
  if (!action || !donnees) return null;
  const a = contenu(action);
  const d = contenu(donnees);
  if (!a || typeof a !== 'object') return null;
  return { action: a, donnees: (d && typeof d === 'object') ? d : {} };
}

/**
 * Traduit un message en detection, ou rend null.
 *
 * Deux moments distincts, et il ne faut pas les confondre :
 *  - « add » sur un evenement : une detection COMMENCE. C'est ce qui doit alerter ;
 *  - « update » qui apporte `end` : elle se termine. Utile pour la liste, jamais pour
 *    alerter — sinon on previendrait deux fois du meme passage.
 */
function versDetection({ action, donnees }) {
  if (action?.modelKey !== 'event') return null;
  const type = donnees.type ?? action.type;
  if (!TYPES_DETECTION.includes(type)) return null;

  return {
    id: action.id ?? donnees.id ?? null,
    commence: action.action === 'add',
    type,
    camera: donnees.camera ?? null,
    debut: Number.isFinite(donnees.start) ? donnees.start : null,
    fin: Number.isFinite(donnees.end) ? donnees.end : null,
    sujets: Array.isArray(donnees.smartDetectTypes) ? donnees.smartDetectTypes : [],
    score: Number.isFinite(donnees.score) ? donnees.score : null,
  };
}

/** Attentes entre deux tentatives de reconnexion, en millisecondes. */
const REPRISES_MS = [2_000, 5_000, 10_000, 20_000, 45_000, 90_000];

/**
 * Liaison permanente, qui se rouvre seule.
 *
 * Une liaison de surveillance doit survivre a une nuit entiere : coupure du reseau, veille
 * du poste, redemarrage du controleur. Elle se reprend donc toujours, avec une attente
 * croissante bornee — et repart du dernier point de reprise connu pour ne rien manquer.
 */
class FluxChangements extends EventEmitter {
  constructor({ client, journal }) {
    super();
    this.client = client;
    this.journal = journal;
    this.ws = null;
    this.essais = 0;
    this.minuteur = null;
    this.arrete = false;
    /** Point de reprise, avance a chaque message : on repart de la ou l'on s'est arrete. */
    this.reprise = null;
    /** Compte des messages incomprehensibles, pour le dire une fois plutot que mille. */
    this.illisibles = 0;
  }

  demarrer(reprise) {
    this.arrete = false;
    if (reprise) this.reprise = reprise;
    this.ouvrir();
    return this;
  }

  ouvrir() {
    const c = this.client();
    if (!c) { this.reprogrammer(); return; }

    const chemin = '/proxy/protect/ws/updates'
      + (this.reprise ? `?lastUpdateId=${encodeURIComponent(this.reprise)}` : '');

    this.ws = new ClientWebSocket({
      host: c.host,
      chemin,
      agent: c.agent,           // l'epinglage de la cle publique s'applique aussi ici
      entetes: {
        'User-Agent': 'Alcora',
        ...(c.session.cookieHeader ? { Cookie: c.session.cookieHeader } : {}),
        ...(c.session.csrf ? { 'X-CSRF-Token': c.session.csrf } : {}),
      },
    });

    this.ws.on('ouvert', () => {
      if (this.essais > 0) this.journal?.info('watch', 'real-time link restored');
      else this.journal?.info('watch', 'real-time link open');
      this.essais = 0;
      this.emit('etat', { ouverte: true });
    });

    this.ws.on('message', (octets) => this.auMessage(octets));

    this.ws.on('erreur', (e) => {
      // Une liaison qui tombe est ordinaire ; on ne crie qu'a la premiere.
      if (this.essais === 0) this.journal?.alerte('watch', `link lost — ${e.message}`);
    });

    this.ws.on('fermé', () => {
      this.emit('etat', { ouverte: false });
      this.reprogrammer();
    });

    this.ws.ouvrir();
  }

  auMessage(octets) {
    const m = lireMessage(octets);
    if (!m) {
      this.illisibles += 1;
      // Une fois, puis tous les cent : sinon un format inattendu noie le journal.
      if (this.illisibles === 1 || this.illisibles % 100 === 0) {
        this.journal?.alerte('watch',
          `${this.illisibles} message(s) not understood (${octets.length} bytes)`);
      }
      return;
    }
    if (m.action.newUpdateId) this.reprise = m.action.newUpdateId;

    const d = versDetection(m);
    if (d) this.emit('detection', d);
  }

  reprogrammer() {
    if (this.arrete) return;
    const attente = REPRISES_MS[Math.min(this.essais, REPRISES_MS.length - 1)];
    this.essais += 1;
    clearTimeout(this.minuteur);
    this.minuteur = setTimeout(() => this.ouvrir(), attente);
  }

  arreter() {
    this.arrete = true;
    clearTimeout(this.minuteur);
    try { this.ws?.fermer(); } catch { /* deja fermee */ }
    this.ws = null;
  }
}

module.exports = {
  FluxChangements, lireMessage, versDetection, paquets, contenu,
  TYPES_DETECTION, REPRISES_MS,
};
