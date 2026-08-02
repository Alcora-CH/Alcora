'use strict';

const crypto = require('node:crypto');
const https = require('node:https');
const { EventEmitter } = require('node:events');

/**
 * Client WebSocket minimal, pour la liaison temps reel du controleur.
 *
 * Pourquoi ecrire ceci plutot que de prendre une bibliotheque : l'application n'a AUCUNE
 * dependance d'execution, et toute sa chaine d'approvisionnement tient en Electron et
 * mediamtx. C'est une qualite pour un projet destine a s'ouvrir, et le sous-ensemble du
 * protocole dont on a besoin est petit et ferme — on ne fait que RECEVOIR des trames
 * binaires, repondre aux pings et fermer proprement.
 *
 * Pourquoi ce n'etait pas evitable : Electron 33 embarque Node 20.18, ou l'objet WebSocket
 * global n'existe pas. Verifie le 29.07.2026 dans le processus principal.
 *
 * Ce qui casse reellement ce genre de code n'est pas l'analyse d'une trame, c'est que le
 * reseau livre les octets en morceaux ARBITRAIRES : une trame peut arriver en dix paquets,
 * ou dix trames dans un seul. Le lecteur ci-dessous est donc separe du transport, et
 * eprouve seul sur ce decoupage.
 */

const OP = { SUITE: 0x0, TEXTE: 0x1, BINAIRE: 0x2, FERMETURE: 0x8, PING: 0x9, PONG: 0xa };
const MAGIE = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

/**
 * Assemble les messages complets a partir d'un flux d'octets quelconque.
 *
 * Ne connait rien du reseau : on lui pousse des morceaux, il rend les messages entiers.
 * C'est ce qui permet de l'eprouver sans ouvrir une seule connexion.
 */
class LecteurTrames {
  constructor() {
    this.tampon = Buffer.alloc(0);
    /** Morceaux d'un message fragmente, en attente de sa trame finale. */
    this.fragments = [];
    this.opFragment = null;
  }

  /** @returns {{op: number, donnees: Buffer}[]} messages complets, dans l'ordre */
  ajouter(morceau) {
    this.tampon = this.tampon.length ? Buffer.concat([this.tampon, morceau]) : morceau;
    const messages = [];

    for (;;) {
      const trame = this.lireUneTrame();
      if (!trame) break;

      // Les trames de controle s'intercalent au milieu d'un message fragmente et ne sont
      // JAMAIS fragmentees elles-memes : elles passent devant, sans toucher aux fragments.
      if (trame.op >= 0x8) { messages.push(trame); continue; }

      if (trame.op === OP.SUITE) {
        if (this.opFragment === null) continue;   // suite sans debut : on ignore
        this.fragments.push(trame.donnees);
        if (trame.fin) {
          messages.push({ op: this.opFragment, donnees: Buffer.concat(this.fragments) });
          this.fragments = [];
          this.opFragment = null;
        }
        continue;
      }

      if (trame.fin) { messages.push({ op: trame.op, donnees: trame.donnees }); continue; }
      this.opFragment = trame.op;
      this.fragments = [trame.donnees];
    }

    return messages;
  }

  /** Une trame, ou null si le tampon n'en contient pas encore une entiere. */
  lireUneTrame() {
    const b = this.tampon;
    if (b.length < 2) return null;

    const fin = (b[0] & 0x80) !== 0;
    const op = b[0] & 0x0f;
    const masque = (b[1] & 0x80) !== 0;
    let taille = b[1] & 0x7f;
    let p = 2;

    if (taille === 126) {
      if (b.length < p + 2) return null;
      taille = b.readUInt16BE(p); p += 2;
    } else if (taille === 127) {
      if (b.length < p + 8) return null;
      const grand = b.readBigUInt64BE(p); p += 8;
      // Au-dela de ce que Node sait adresser, on ne peut rien faire d'utile.
      if (grand > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('oversized frame');
      taille = Number(grand);
    }

    let cle = null;
    if (masque) {
      if (b.length < p + 4) return null;
      cle = b.subarray(p, p + 4); p += 4;
    }

    if (b.length < p + taille) return null;      // le message n'est pas encore entier

    let donnees = b.subarray(p, p + taille);
    // Un serveur ne masque pas ; on le traite quand meme plutot que de rendre du charabia.
    if (cle) {
      const clair = Buffer.allocUnsafe(taille);
      for (let i = 0; i < taille; i += 1) clair[i] = donnees[i] ^ cle[i & 3];
      donnees = clair;
    } else {
      // subarray partage la memoire du tampon, que l'on va tronquer : on copie.
      donnees = Buffer.from(donnees);
    }

    this.tampon = b.subarray(p + taille);
    return { fin, op, donnees };
  }
}

/**
 * Connexion WebSocket sur un hote en TLS.
 *
 * L'agent est fourni par l'appelant : c'est ainsi que l'epinglage de la cle publique du
 * controleur s'applique aussi a cette liaison. Rien ici ne desactive de verification.
 */
class ClientWebSocket extends EventEmitter {
  constructor({ host, chemin, entetes = {}, agent, port = 443 }) {
    super();
    this.host = host; this.chemin = chemin; this.entetes = entetes;
    this.agent = agent; this.port = port;
    this.socket = null;
    this.lecteur = new LecteurTrames();
    this.ferme = false;
  }

  ouvrir() {
    const cle = crypto.randomBytes(16).toString('base64');
    const attendu = crypto.createHash('sha1').update(cle + MAGIE).digest('base64');

    const req = https.request({
      host: this.host, port: this.port, path: this.chemin, method: 'GET', agent: this.agent,
      headers: {
        ...this.entetes,
        Connection: 'Upgrade',
        Upgrade: 'websocket',
        'Sec-WebSocket-Key': cle,
        'Sec-WebSocket-Version': '13',
      },
    });

    req.on('upgrade', (reponse, socket) => {
      if (reponse.headers['sec-websocket-accept'] !== attendu) {
        socket.destroy();
        this.emit('erreur', new Error('WebSocket handshake refused'));
        return;
      }
      this.socket = socket;
      socket.setNoDelay(true);
      socket.on('data', (m) => this.auxOctets(m));
      socket.on('error', (e) => this.terminer(e));
      socket.on('close', () => this.terminer(null));
      this.emit('ouvert');
    });

    // Une reponse ORDINAIRE veut dire que le serveur a refuse la bascule : 401, 403, 404.
    // C'est une information utile, pas un silence.
    req.on('response', (res) => {
      res.resume();
      this.emit('erreur', new Error(`link refused (HTTP ${res.statusCode})`));
    });
    req.on('error', (e) => this.emit('erreur', e));
    req.end();
    return this;
  }

  auxOctets(morceau) {
    let messages;
    try {
      messages = this.lecteur.ajouter(morceau);
    } catch (e) {
      this.terminer(e);
      return;
    }
    for (const m of messages) {
      if (m.op === OP.PING) { this.envoyer(OP.PONG, m.donnees); continue; }
      if (m.op === OP.PONG) continue;
      if (m.op === OP.FERMETURE) { this.terminer(null); return; }
      this.emit('message', m.donnees, m.op);
    }
  }

  /** Une trame cote client est TOUJOURS masquee : le protocole l'exige. */
  envoyer(op, donnees = Buffer.alloc(0)) {
    if (!this.socket || this.socket.destroyed) return;
    const n = donnees.length;
    const tete = n < 126 ? 2 : n < 65536 ? 4 : 10;
    const trame = Buffer.allocUnsafe(tete + 4 + n);
    trame[0] = 0x80 | op;
    if (n < 126) trame[1] = 0x80 | n;
    else if (n < 65536) { trame[1] = 0x80 | 126; trame.writeUInt16BE(n, 2); }
    else { trame[1] = 0x80 | 127; trame.writeBigUInt64BE(BigInt(n), 2); }
    const cle = crypto.randomBytes(4);
    cle.copy(trame, tete);
    for (let i = 0; i < n; i += 1) trame[tete + 4 + i] = donnees[i] ^ cle[i & 3];
    try { this.socket.write(trame); } catch { /* la fermeture suivra */ }
  }

  fermer() {
    if (this.ferme) return;
    this.envoyer(OP.FERMETURE);
    this.terminer(null);
  }

  terminer(erreur) {
    if (this.ferme) return;
    this.ferme = true;
    try { this.socket?.destroy(); } catch { /* deja mort */ }
    this.socket = null;
    if (erreur) this.emit('erreur', erreur);
    this.emit('fermé');
  }
}

module.exports = { ClientWebSocket, LecteurTrames, OP };
