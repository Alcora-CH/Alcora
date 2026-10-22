'use strict';

const { configurationRelais, nouvelIdentifiant, autorisation } = require('./relais-config');

const { spawn } = require('node:child_process');
const net = require('node:net');
const dgram = require('node:dgram');
const fs = require('node:fs');
const path = require('node:path');
const { t } = require('./i18n');

/** Duree au-dela de laquelle on considere que le relais a reellement fonctionne. */
const VIE_PLAUSIBLE = 30000;

/** Au-dela, insister est inutile : mieux vaut le dire que boucler en silence. */
const TENTATIVES_MAX = 6;

/**
 * Supervise le relais video.
 *
 * L'utilisateur ne doit jamais savoir qu'il existe : pas de fenetre, pas de service a
 * installer, pas d'etat a comprendre. S'il tombe, on le relance. Si ses ports sont pris,
 * on en choisit d'autres plutot que d'echouer.
 */
class RelaySupervisor {
  /**
   * @param {object} options
   * @param {string} options.binary   chemin de l'executable du relais
   * @param {string} options.dataDir  dossier ou ecrire configuration et journal
   * @param {(state: object) => void} [options.onState]
   * @param {string[]} options.origines  origines admises a lire la video — celle de
   *   l'interface d'Alcora, jamais « * »
   * @param {boolean} [options.api]  allume l'API de controle — reserve au test manuel
   */
  constructor({ binary, dataDir, onState, origines, api = false }) {
    this.binary = binary;
    this.dataDir = dataDir;
    this.onState = onState || (() => {});
    this.origines = origines;
    this.api = api;
    /*
     * L'identifiant est tire UNE fois par superviseur, comme les ports : la page le recoit
     * au demarrage et doit pouvoir s'en servir a chaque reconnexion. Le changer a chaque
     * relance du relais couperait toutes les tuiles pour rien.
     */
    this.identifiant = nouvelIdentifiant();

    this.child = null;
    this.ports = null;
    this.cameras = [];
    this.stopping = false;
    this.restarts = 0;
    this.restartTimer = null;
    this.abandonne = false;
    this.log = null;
  }

  /**
   * Ouvre le journal du relais, en repartant de zero s'il est devenu gros.
   *
   * Un seul flux pour toute la duree de vie du superviseur : en ouvrir un a chaque
   * relance laisserait un descripteur par tentative, et une relance en boucle finit par
   * epuiser ce que le systeme en accorde.
   */
  openLog() {
    if (this.log) return;
    const chemin = path.join(this.dataDir, 'relay.log');
    try {
      if (fs.statSync(chemin).size > 2 * 1024 * 1024) fs.rmSync(chemin, { force: true });
    } catch { /* absent : rien a faire */ }
    this.log = fs.createWriteStream(chemin, { flags: 'a' });
    this.log.on('error', () => { this.log = null; });   // disque plein : on se tait
  }

  /** Etat lisible par l'interface. Aucun jargon : ce sont des phrases affichables. */
  get state() {
    if (this.stopping) return { running: false, message: t('relais.arret') };
    if (this.child) return { running: true, message: t('relais.pret'), ports: this.ports };
    if (this.abandonne) {
      return {
        running: false,
        permanent: true,
        message: t('relais.echec'),
        remedy: t('relais.echecRemede'),
      };
    }
    if (this.restarts > 0) return { running: false, message: t('relais.reconnexion') };
    return { running: false, message: t('relais.demarrage') };
  }

  emit() { this.onState(this.state); }

  /**
   * Cherche un port libre a partir de celui propose. Evite d'echouer sur une collision.
   *
   * La sonde doit employer le protocole ET l'adresse que le relais utilisera vraiment :
   * un port libre en TCP sur la boucle locale peut etre pris en UDP sur une interface, et
   * la verification n'aurait alors rien prouve.
   */
  static async freePort(preferred, { udp = false, adresse = '127.0.0.1', attempts = 20 } = {}) {
    for (let p = preferred; p < preferred + attempts; p++) {
      const ok = await new Promise((resolve) => {
        if (udp && (adresse === '0.0.0.0' || adresse === '::')) {
          /*
           * « Toutes les interfaces », c'est ce que le relais entend par « :port » : une
           * prise IPv6 en DOUBLE PILE sur « :: », qui couvre aussi l'IPv4. Sonder « 0.0.0.0 »
           * ne prouvait rien — Windows l'accorde meme quand « [::]:port » est deja pris, et
           * le relais, lui, se heurtait ensuite au port occupe et redemarrait en boucle,
           * « Reconnexion du flux vidéo… » a l'ecran pour toujours. Constate le 22.10.2026,
           * avec une seconde copie d'Alcora ouverte.
           *
           * Sans pile IPv6, on retombe sur l'IPv4 seule : c'est alors aussi ce que fera le
           * relais.
           */
          const s = dgram.createSocket({ type: 'udp6', ipv6Only: false });
          s.once('error', (e) => {
            if (!['EAFNOSUPPORT', 'EADDRNOTAVAIL', 'EINVAL'].includes(e.code)) return resolve(false);
            const s4 = dgram.createSocket('udp4');
            s4.once('error', () => resolve(false));
            s4.bind(p, '0.0.0.0', () => s4.close(() => resolve(true)));
          });
          s.bind(p, '::', () => s.close(() => resolve(true)));
        } else if (udp) {
          const s = dgram.createSocket('udp4');
          s.once('error', () => resolve(false));
          s.bind(p, adresse, () => s.close(() => resolve(true)));
        } else {
          const s = net.createServer();
          s.once('error', () => resolve(false));
          s.once('listening', () => s.close(() => resolve(true)));
          s.listen(p, adresse);
        }
      });
      if (ok) return p;
    }
    throw new Error(`Aucun port libre entre ${preferred} et ${preferred + attempts}.`);
  }

  /**
   * @param {Array<{path:string, url:string}>} cameras chemins publies et sources RTSP
   */
  async start(cameras) {
    this.cameras = cameras;
    this.stopping = false;
    this.abandonne = false;
    this.restarts = 0;

    /*
     * Les ports ne sont sondes qu'UNE fois.
     *
     * Ils etaient re-sondes a chaque demarrage : apres une simple redecouverte, le relais
     * repassait de 18889 a 18890 et l'adresse donnee a la page devenait caduque. Toutes
     * les tuiles pointaient alors sur un port mort — constate dans le journal du poste
     * reel, le 22.07.2026. On garde donc les memes ports pour toute la vie du superviseur.
     */
    if (!this.ports) {
      this.ports = {
        webrtc: await RelaySupervisor.freePort(18889),
        api: await RelaySupervisor.freePort(19997),
        // Le chemin ICE en UDP est ouvert sur toutes les interfaces : on le sonde ainsi.
        ice: await RelaySupervisor.freePort(18189, { udp: true, adresse: '0.0.0.0' }),
        iceTcp: await RelaySupervisor.freePort(18289),
      };
    }

    this.writeConfig();
    this.spawn();
  }

  /**
   * Les chemins publies, dans un ordre stable — pour savoir si l'inventaire a bouge.
   *
   * Les separateurs sont des caracteres de CONTROLE parce qu'aucun d'eux ne peut
   * apparaitre dans un chemin ni dans une URL : deux inventaires differents ne peuvent
   * donc pas produire la meme empreinte par collision de separateur.
   *
   * Ils sont ECHAPPES, et ne l'etaient pas jusqu'au 11.08.2026. Un octet nul pose tel
   * quel dans un source rend le fichier « binaire » aux yeux de grep, et n'importe quel
   * editeur ou correctif peut l'avaler sans que rien ne le signale. Le comportement est
   * identique a l'octet pres ; seule la lisibilite change.
   */
  static empreinte(cameras) {
    return cameras.map((c) => `${c.path}\u0000${c.url}`).sort().join('\u0001');
  }

  /**
   * Republie un inventaire modifie SANS changer de ports ni de superviseur.
   *
   * Chaque redecouverte fabriquait auparavant un superviseur neuf : nouveaux ports,
   * nouvelle adresse, et toutes les vues coupees — y compris quand rien n'avait change.
   * Ici, si l'inventaire est identique, on ne touche a rien du tout.
   *
   * @returns {Promise<boolean>} vrai si le relais a effectivement ete republie.
   */
  async republier(cameras) {
    if (RelaySupervisor.empreinte(cameras) === RelaySupervisor.empreinte(this.cameras)
        && this.child) {
      return false;
    }
    this.cameras = cameras;
    this.writeConfig();
    await this.stop({ definitif: false });
    this.stopping = false;
    this.abandonne = false;
    this.restarts = 0;
    this.spawn();
    return true;
  }

  /**
   * La configuration vient de relais-config.js, pur et eprouve par test-relais-config.js :
   * un seul serveur (WebRTC), un seul utilisateur tire au hasard, une seule origine.
   * Voir l'en-tete de ce module pour l'audit du 22.10.2026 qui l'a impose.
   */
  writeConfig() {
    const config = configurationRelais({
      ports: this.ports,
      cameras: this.cameras,
      identifiant: this.identifiant,
      origines: this.origines,
      api: this.api,
    });
    fs.mkdirSync(this.dataDir, { recursive: true });
    fs.writeFileSync(this.configPath, config, 'utf8');
  }

  get configPath() { return path.join(this.dataDir, 'relay.yml'); }

  spawn() {
    if (this.stopping) return;

    this.openLog();

    this.child = spawn(this.binary, [this.configPath], {
      cwd: this.dataDir,
      windowsHide: true,          // aucune fenetre de console, jamais
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // « end: false » : le flux survit a l'enfant, puisqu'il servira aussi a la relance.
    if (this.log) {
      this.child.stdout.pipe(this.log, { end: false });
      this.child.stderr.pipe(this.log, { end: false });
    }

    const enfant = this.child;
    const demarreA = Date.now();
    this.child.on('spawn', () => this.emit());

    /*
     * « error » et « exit » menent au MEME traitement.
     *
     * Un binaire absent, ou refuse par une suite de securite, n'emet pas « exit » mais
     * « error ». Ce cas ne faisait qu'ecrire au journal : this.child restait non nul, et
     * l'etat continuait d'annoncer « Flux vidéo prêt » alors qu'aucun processus n'existait.
     * L'interface affichait donc un direct qui n'avait jamais commence.
     */
    this.child.on('error', (e) => {
      if (this.child === enfant) this.child = null;
      this.apresArret(`launch impossible: ${e.message}`, demarreA);
    });

    this.child.on('exit', (code, signal) => {
      if (this.child === enfant) this.child = null;
      this.apresArret(`stopped (code ${code ?? signal})`, demarreA);
    });
  }

  /** Relance, attente croissante, abandon : commun a « error » et « exit ». */
  apresArret(raison, demarreA) {
    if (this.stopping) return;

    /*
     * Le compteur ne repart de zero que si le relais a tenu.
     *
     * Le remettre a zero des qu'il demarre annulait l'attente croissante : un relais qui
     * s'arrete aussitot lance repartait indefiniment a la premiere temporisation, soit
     * environ une relance par seconde, sans que rien ne le signale jamais.
     */
    if (Date.now() - demarreA > VIE_PLAUSIBLE) this.restarts = 0;
    this.restarts++;

    if (this.restarts > TENTATIVES_MAX) {
      this.log?.write(`\n[Alcora] relay abandoned after ${TENTATIVES_MAX} attempts\n`);
      this.abandonne = true;
      this.emit();
      return;
    }

    // Attente croissante, plafonnee : un relais qui refuse obstinement de demarrer ne
    // doit pas saturer la machine en tentatives.
    const delay = Math.min(30000, 500 * 2 ** Math.min(this.restarts, 6));
    this.log?.write(`\n[Alcora] relay ${raison}, restarting in ${delay} ms\n`);
    this.emit();
    this.restartTimer = setTimeout(() => this.spawn(), delay);
  }

  /** URL de base a donner a l'interface pour consommer les flux. */
  /**
   * Ce que la page doit connaitre pour ouvrir la video : l'adresse ET l'en-tete
   * d'autorisation. L'un sans l'autre ne mene plus nulle part (401).
   */
  get acces() {
    return this.ports
      ? { base: this.webrtcBase, autorisation: autorisation(this.identifiant) }
      : null;
  }

  get webrtcBase() {
    return this.ports ? `http://127.0.0.1:${this.ports.webrtc}` : null;
  }

  /**
   * Arrete le relais et ATTEND sa mort.
   *
   * L'arret ne faisait qu'envoyer le signal : le processus survivait encore un instant,
   * gardant ouverts son dossier et ses fichiers. Le code appelant compensait par une
   * attente forfaitaire de 800 ms avant d'appliquer une mise a jour — un pari, pas une
   * garantie, et un fichier verrouille faisait echouer l'installation.
   *
   * @param {object} [options]
   * @param {boolean} [options.definitif] faux pour une republication : le journal reste ouvert.
   * @returns {Promise<void>} resolue quand le processus a reellement disparu.
   */
  stop({ definitif = true } = {}) {
    this.stopping = true;
    clearTimeout(this.restartTimer);
    const enfant = this.child;
    this.child = null;

    if (definitif) { this.log?.end(); this.log = null; }
    this.emit();
    if (!enfant) return Promise.resolve();

    return new Promise((resolve) => {
      let fini = false;
      const termine = () => { if (!fini) { fini = true; clearTimeout(couperet); resolve(); } };
      enfant.once('exit', termine);
      enfant.once('error', termine);
      // Un processus qui refuse de mourir ne doit pas retenir la fermeture de
      // l'application ni l'application d'une mise a jour.
      const couperet = setTimeout(() => {
        try { enfant.kill('SIGKILL'); } catch { /* deja mort */ }
        termine();
      }, 3000);
      try { enfant.kill(); } catch { termine(); }
    });
  }
}

module.exports = { RelaySupervisor };
