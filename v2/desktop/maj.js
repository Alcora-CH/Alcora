'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { Readable, Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');

/**
 * Mises a jour automatiques.
 *
 * L'outil d'installation (Update.exe, livre par Velopack) ne sait qu'APPLIQUER un paquet :
 * chercher, telecharger et verifier nous incombent. La construction publie sur un depot
 * GitHub public un manifeste « releases.win.json » qui liste chaque version avec son
 * empreinte SHA-256 — c'est notre source de verite.
 *
 * Choix assume : on telecharge le paquet COMPLET, pas le differentiel. C'est plus lourd
 * (~150 Mo contre ~50 Ko) mais sans aucun etat intermediaire fragile : pas de rustine a
 * enchainer, pas de base a retrouver. Le differentiel viendra quand cette chaine aura
 * prouve sa fiabilite sur plusieurs versions reelles.
 *
 * Deroulement : verification silencieuse -> telechargement en arriere-plan -> controle de
 * l'empreinte -> l'interface INVITE a redemarrer, sans jamais l'imposer.
 */

/*
 * Le foyer du canal de mise a jour.
 *
 * Demenage deux fois, et GitHub redirige DURABLEMENT chaque ancienne adresse — c'est ce
 * qui permet de bouger sans casser un seul poste installe :
 *   28.07.2026  ProtectViewer-releases -> Alcora-releases (meme foyer personnel)
 *   02.08.2026  foyer personnel -> alcora-ch/Alcora-releases
 * Le second demenagement detache le projet du compte personnel : l'organisation
 * alcora-ch est son foyer public, verifie par redirection reelle apres transfert.
 */
const DEPOT = 'alcora-ch/Alcora-releases';
const BASE = `https://github.com/${DEPOT}/releases`;

/**
 * Identifiant du paquet, lu a la source commune.
 *
 * Le manifeste peut contenir plusieurs produits — c'est arrive au renommage du 28.07.2026,
 * ou le meme depot a servi deux canaux. Sans ce filtre, une application ne comparait que
 * des NUMEROS : elle voyait « 2.2.0 > 2.1.1 », telechargeait un paquet qui n'etait pas le
 * sien et le confiait a son programme d'installation. On ne considere donc que les paquets
 * qui portent notre propre identifiant.
 */
const PACK_ID = require('./package.json').packId;

class GestionnaireMaj {
  /**
   * @param {object} options
   * @param {string} options.version      version installee
   * @param {string} options.dossier      ou ranger les paquets telecharges (donnees, pas current\)
   * @param {string} options.executable   process.execPath, pour retrouver Update.exe
   * @param {(url: string) => Promise<Response>} options.fetcher
   * @param {object} options.journal
   * @param {(etat: object) => void} [options.onEtat]
   */
  constructor({ version, dossier, executable, fetcher, journal, onEtat }) {
    this.version = version;
    this.dossier = dossier;
    this.executable = executable;
    this.fetch = fetcher;
    this.journal = journal;
    this.onEtat = onEtat || (() => {});
    this.enCours = false;
    this.prete = null;          // { version, fichier } une fois un paquet verifie

    /**
     * Telechargements en vol, par version.
     *
     * « enCours » ne protegeait que verifier(). Or la sequence de lancement appelle
     * obtenir() DIRECTEMENT : deux telechargements de la meme version pouvaient donc se
     * chevaucher — celui du bouton « Vérifier maintenant » et celui du demarrage — et
     * s'entremeler dans le meme fichier. Le paquet obtenu etait un melange des deux, son
     * empreinte ne correspondait a rien, et la mise a jour etait abandonnee.
     * Constate sur le poste reel le 28.07.2026.
     */
    this.enVol = new Map();
    /** Vrai pendant la sequence de lancement : chaque etat emis doit le porter, sinon
     *  l'ecran de demarrage se refermerait des la premiere progression. */
    this.demarrage = false;
  }

  emettre(etat) { this.onEtat(this.demarrage ? { ...etat, demarrage: true } : etat); }

  /** a est-elle plus recente que b ? Comparaison numerique champ par champ. */
  static plusRecente(a, b) {
    const pa = String(a).split('.').map(Number);
    const pb = String(b).split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
    }
    return false;
  }

  /** Update.exe vit un cran au-dessus de « current\ », qui est remplace a chaque version. */
  get updateExe() {
    return path.resolve(path.dirname(this.executable), '..', 'Update.exe');
  }

  /**
   * Cherche une version plus recente. Ne telecharge rien.
   *
   * Separe du telechargement a dessein : au demarrage, la RECHERCHE doit etre bornee dans
   * le temps — un depot injoignable ne doit pas retarder l'acces aux cameras — alors que
   * le telechargement, lui, ne peut pas l'etre.
   *
   * @returns {Promise<object|null>} l'entree du manifeste, ou null si l'on est a jour
   */
  async chercher() {
    const reponse = await this.fetch(`${BASE}/latest/download/releases.win.json`);
    if (!reponse.ok) throw new Error(`manifeste HTTP ${reponse.status}`);
    const manifeste = await reponse.json();

    const tous = (manifeste.Assets ?? []).filter((a) => a.Type === 'Full');
    const complets = tous.filter((a) => a.PackageId === PACK_ID);

    // Un manifeste qui ne parle que d'un AUTRE produit n'est pas une panne, mais il ne doit
    // pas passer inapercu : c'est le signe que le depot sert desormais un autre canal.
    if (tous.length && !complets.length) {
      this.journal.alerte('update',
        `the manifest contains no “${PACK_ID}” package (${tous.length} entries ignored)`);
      return null;
    }

    const cible = complets.reduce(
      (m, a) => (!m || GestionnaireMaj.plusRecente(a.Version, m.Version) ? a : m), null);

    return cible && GestionnaireMaj.plusRecente(cible.Version, this.version) ? cible : null;
  }

  /**
   * Telecharge la cible, controle son empreinte, et la declare prete.
   *
   * Un seul telechargement par version a la fois : tout appel concurrent recoit la meme
   * promesse au lieu d'ouvrir un second flux vers le meme fichier.
   */
  obtenir(cible) {
    const enVol = this.enVol.get(cible.Version);
    if (enVol) return enVol;

    const travail = this.telechargerEtVerifier(cible)
      .finally(() => this.enVol.delete(cible.Version));
    this.enVol.set(cible.Version, travail);
    return travail;
  }

  async telechargerEtVerifier(cible) {
    fs.mkdirSync(this.dossier, { recursive: true });
    this.balayerPartiels();
    const destination = path.join(this.dossier, cible.FileName);

    const liberes = this.balayerPaquets(destination);
    if (liberes) {
      this.journal.info('update', `old packages deleted: ${Math.round(liberes / 1e6)} MB freed`);
    }

    // Deja telechargee et intacte ? Un redemarrage ne recommence rien.
    if (fs.existsSync(destination)) {
      const relue = await this.empreinteDuDisque(destination, cible.SHA256);
      if (relue.etat === 'conforme') {
        this.prete = { version: cible.Version, fichier: destination };
        this.journal.info('update', `version ${cible.Version} already downloaded and verified`);
        return this.prete;
      }
      // Illisible n'est PAS altere : on n'efface rien sur un doute, on retelechargera.
      if (relue.etat === 'illisible') {
        this.journal.alerte('update',
          `package ${cible.Version} already present but unreadable (${relue.code}): retaken`);
      }
    }

    // Deux essais : un paquet abime par une coupure ne doit pas condamner la mise a jour
    // jusqu'au prochain lancement. Au-dela, insister ne corrigerait rien.
    const ESSAIS = 2;
    for (let essai = 1; essai <= ESSAIS; essai += 1) {
      this.journal.info('update',
        `downloading ${cible.Version} (${Math.round(cible.Size / 1e6)} MB)`
        + (essai > 1 ? ` — attempt ${essai}` : ''));

      /*
       * L'empreinte est calculee EN MEME TEMPS que l'ecriture, sur les octets qui viennent
       * du reseau. C'est la correction du 30.07.2026, et elle vise la cause exacte de cinq
       * mises a jour refusees d'affilee sur le poste : relire ensuite 148 Mo depuis le
       * disque ouvrait une fenetre pendant laquelle l'antivirus de Windows examinait le
       * fichier tout juste ferme, et l'ouverture en lecture echouait. L'erreur etait avalee
       * et rendue comme « empreinte differente » : l'application accusait de corruption un
       * paquet parfaitement sain. Ce chemin n'existe plus — il n'y a plus de seconde
       * lecture a echouer.
       */
      const { empreinte, recu } = await this.telecharger(
        `${BASE}/download/v${cible.Version}/${cible.FileName}`,
        destination, cible.Size, cible.Version);

      this.emettre({ etat: 'controle', version: cible.Version });

      // Un paquet dont l'empreinte ne correspond pas ne sera JAMAIS applique.
      if (empreinte === String(cible.SHA256).toUpperCase()) {
        /*
         * Les octets recus sont les bons. Reste ce que le flux ne peut pas couvrir : ce
         * qui a REELLEMENT ete ecrit sur le disque. On le relit — mais desormais un echec
         * de lecture ne condamne plus rien, il se dit et l'empreinte du flux fait foi.
         * Seule une difference AVEREE fait rejeter le paquet, et c'est le seul cas ou
         * retelecharger 148 Mo a un sens.
         */
        const surDisque = await this.empreinteDuDisque(destination, cible.SHA256);
        if (surDisque.etat === 'different') {
          /*
           * Deux lectures d'accord sur une valeur fausse : le fichier est reellement abime.
           * On le dit avec ce qui permet de trancher — taille obtenue contre taille
           * attendue — parce que « altere » couvre deux causes tres differentes : une
           * ecriture incomplete (taille plus petite) et une ecriture fautive (taille juste).
           */
          this.journal.alerte('update',
            `package ${cible.Version}: received intact (${recu} B) but the written file differs`
            + ` — ${surDisque.taille} B on disk for ${cible.Size} expected,`
            + ` ${surDisque.lectures} concordant read(s)`);
          fs.rmSync(destination, { force: true });
          if (essai < ESSAIS) this.journal.alerte('update', 'the package is retaken from scratch');
          continue;
        }
        if (surDisque.etat === 'illisible') {
          this.journal.info('update',
            `on-disk check impossible (${surDisque.code}) — stream fingerprint kept`);
        }
        this.prete = { version: cible.Version, fichier: destination };
        this.journal.info('update', `version ${cible.Version} ready to apply`);
        return this.prete;
      }

      /*
       * Dire EN QUOI le paquet differe.
       *
       * « empreinte invalide » ne permet de rien conclure : un fichier tronque, un fichier
       * de la bonne taille mais abime, et une page d'erreur servie a la place du paquet
       * donnent tous le meme message. La taille tranche entre ces cas a elle seule, et
       * sans elle il a fallu deviner — le 28.07.2026, sans y parvenir.
       *
       * Desormais ce message ne peut plus mentir : il porte sur les octets RECUS, comptes
       * et haches dans la meme passe, et non sur une relecture qui pouvait echouer.
       */
      this.journal.alerte('update',
        `package ${cible.Version} refused: ${recu} bytes received for ${cible.Size} expected`
        + (recu === cible.Size ? ' (size right, content altered in transit)' : ' (wrong size)'));

      fs.rmSync(destination, { force: true });
      if (essai < ESSAIS) {
        this.journal.alerte('update', 'the package is retaken from scratch');
      }
    }
    throw new Error('invalid package fingerprint');
  }

  /**
   * Retire les fichiers partiels qu'aucun telechargement ne reprendra.
   *
   * Un processus tue en pleine ecriture laisse le sien derriere lui. Ils portent un
   * numero de processus, donc rien ne les recyclera : sans ce balayage, ils s'accumulent
   * au fil des coupures, a 148 Mo l'unite.
   */
  balayerPartiels() {
    const LIMITE = 24 * 3_600_000;
    try {
      for (const nom of fs.readdirSync(this.dossier)) {
        if (!nom.endsWith('.part')) continue;
        const chemin = path.join(this.dossier, nom);
        const age = Date.now() - fs.statSync(chemin).mtimeMs;
        if (age > LIMITE) fs.rmSync(chemin, { force: true });
      }
    } catch { /* le dossier vient d'etre cree, ou est illisible : sans consequence */ }
  }

  /**
   * Ne garder qu'un paquet : celui qu'on s'apprete a installer.
   *
   * Rien n'effacait les paquets appliques. Sur le poste de reference, le dossier en comptait
   * DIX-SEPT le 31.07.2026, a 148 Mo piece — 2,4 Go immobilises, dont seize inutiles : une
   * version installee ne se reinstalle pas depuis ce dossier, elle se retelecharge si
   * besoin. Le balayage a lieu AVANT l'ecriture, pour liberer la place plutot que de
   * l'exiger en plus.
   *
   * `garder` echappe au balayage : c'est la cible du telechargement en cours, qui peut
   * deja etre la et intacte.
   *
   * @returns {number} octets liberes, pour le journal
   */
  balayerPaquets(garder) {
    let liberes = 0;
    try {
      for (const nom of fs.readdirSync(this.dossier)) {
        if (!nom.endsWith('.nupkg')) continue;
        const chemin = path.join(this.dossier, nom);
        if (chemin === garder) continue;
        try {
          liberes += fs.statSync(chemin).size;
          fs.rmSync(chemin, { force: true });
        } catch { /* un paquet verrouille sera repris au prochain passage */ }
      }
    } catch { /* dossier absent ou illisible : sans consequence */ }
    return liberes;
  }

  /** Cycle complet, pour la surveillance de fond d'une session qui dure. */
  async verifier() {
    if (this.enCours) return;
    this.enCours = true;
    try {
      this.emettre({ etat: 'verification' });
      const cible = await this.chercher();
      if (!cible) {
        this.journal.info('update', `up to date (${this.version})`);
        this.emettre({ etat: 'aucune' });
        return;
      }
      await this.obtenir(cible);
      this.emettre({ etat: 'prete', version: cible.Version });
    } catch (e) {
      // Un poste hors ligne n'est pas une panne : on le note, on reessaiera seul.
      this.journal.alerte('update', `check impossible: ${e.message}`);
      this.emettre({ etat: 'erreur', message: e.message });
    } finally {
      this.enCours = false;
    }
  }

  /**
   * Telecharge, ecrit, et hache — en UNE passe.
   *
   * @returns {Promise<{empreinte: string, recu: number}>} l'empreinte des octets recus,
   *          en majuscules, et leur nombre.
   */
  async telecharger(url, destination, taille, version) {
    const reponse = await this.fetch(url);
    if (!reponse.ok || !reponse.body) throw new Error(`download HTTP ${reponse.status}`);

    // Ecriture en « .part » puis renommage : un fichier a moitie ecrit ne peut jamais
    // passer pour un paquet complet.
    //
    // Le numero de processus fait partie du nom. Sans lui, une copie qui se ferme pendant
    // son telechargement et une copie qui vient de s'ouvrir ecrivent dans le MEME fichier
    // temporaire : les deux flux s'entremelent, et le paquet renomme n'est ni l'un ni
    // l'autre. C'est ce qui s'est produit le 28.07.2026.
    const partiel = `${destination}.${process.pid}.part`;
    let recu = 0;
    let dernier = -1;
    const empreinte = crypto.createHash('sha256');
    const flux = Readable.fromWeb(reponse.body);

    /*
     * Une COPIE de chaque morceau, et un seul consommateur.
     *
     * Correction du 31.07.2026, apres deux diagnostics errones et une experience qui a
     * enfin tranche. Le montage precedent avait deux consommateurs du meme morceau : un
     * ecouteur « data » qui hachait, et `pipeline` qui ecrivait. L'ecouteur hache
     * SYNCHRONEMENT ; le flux de fichier, lui, met le morceau en file et l'ecrit PLUS TARD.
     * Entre les deux, rien ne garantissait que la memoire du morceau nous appartenait
     * encore — celle rendue par le `net.fetch` d'Electron vient de Chromium, qui peut la
     * reutiliser. L'empreinte restait juste, la longueur aussi, et le fichier recevait
     * d'autres octets. D'ou le symptome exact du poste : « recu intact, disque different »,
     * intermittent, et seulement au demarrage — la ou l'ecriture prend du retard.
     *
     * La meme sonde, en Node pur, n'a jamais diverge en trois passes de 148 Mo : le defaut
     * ne pouvait donc pas venir des flux eux-memes.
     *
     * Ici il n'y a plus qu'un consommateur, et les octets haches sont EXACTEMENT ceux qui
     * partent au fichier, dans une memoire qui est la notre. Le cout est une recopie par
     * morceau de 64 Ko — invisible a cote d'une ecriture disque.
     */
    const progresser = (pct) => this.emettre({ etat: 'telechargement', version, pourcent: pct });
    const aNous = new Transform({
      transform(morceau, _codage, suite) {
        const copie = Buffer.from(morceau);
        recu += copie.length;
        empreinte.update(copie);
        const pct = taille ? Math.min(100, Math.floor((recu / taille) * 100)) : 0;
        if (pct !== dernier) {
          dernier = pct;
          progresser(pct);
        }
        suite(null, copie);
      },
    });

    try {
      await pipeline(flux, aNous, fs.createWriteStream(partiel));
    } catch (e) {
      // Coupure en cours de route : le reliquat ne servira a personne, et le balayage
      // des vieux fichiers ne passera que dans vingt-quatre heures.
      fs.rmSync(partiel, { force: true });
      throw e;
    }
    fs.renameSync(partiel, destination);
    return { empreinte: empreinte.digest('hex').toUpperCase(), recu };
  }

  /**
   * Empreinte d'un fichier DEJA sur le disque, pour le seul cas qui l'exige encore : un
   * paquet trouve au lancement, telecharge lors d'une session precedente.
   *
   * Rend un etat a TROIS valeurs, et jamais un booleen. « different » et « illisible » sont
   * des situations opposees : la premiere condamne le fichier, la seconde ne prouve rien du
   * tout. Les confondre a coute cinq mises a jour refusees sur le poste de reference entre le
   * 29 et le 30.07.2026 — l'application annoncait un contenu altere pour un paquet qu'elle
   * n'avait simplement pas pu ouvrir, l'effacait, et retelechargeait 148 Mo pour rien.
   *
   * Les verrous de Windows sont passagers — l'antivirus examine un gros fichier qui vient
   * d'etre ferme — d'ou les reprises espacees.
   *
   * @returns {Promise<{etat: 'conforme'|'different'|'illisible', code?: string}>}
   */
  async empreinteDuDisque(fichier, attendue, essais = 4) {
    const cible = String(attendue).toUpperCase();
    const vues = [];
    let dernierCode = null;

    for (let n = 1; n <= essais; n += 1) {
      const lu = await this.lireEmpreinte(fichier);

      if (lu.ok) {
        if (lu.valeur === cible) {
          /*
           * Conforme — mais peut-etre pas du premier coup.
           *
           * Une relecture qui commence par rendre une empreinte FAUSSE puis la bonne ne
           * dit pas que le fichier a change : elle dit que la LECTURE etait incoherente.
           * C'est le discriminant qui manquait le 30.07.2026, ou l'application concluait a
           * un fichier abime des la premiere divergence — et abandonnait une mise a jour
           * dont les octets recus etaient pourtant justes.
           */
          if (vues.length) {
            this.journal.alerte('update',
              `inconsistent reread: ${vues.length} wrong read(s) before the right one`
              + ` (${vues.map((v) => v.slice(0, 12)).join(', ')} then ${cible.slice(0, 12)})`);
          }
          return { etat: 'conforme', lectures: n };
        }
        vues.push(lu.valeur);
        // Deux lectures QUI S'ACCORDENT sur une valeur fausse : le fichier est bien abime,
        // insister ne changera rien.
        if (vues.length >= 2 && vues[vues.length - 1] === vues[vues.length - 2]) {
          return { etat: 'different', lectures: n, taille: this.tailleDe(fichier), vues };
        }
      } else {
        dernierCode = lu.code;
      }

      if (n < essais) await new Promise((r) => setTimeout(r, 400 * n));
    }

    if (vues.length) {
      return { etat: 'different', lectures: essais, taille: this.tailleDe(fichier), vues };
    }
    return { etat: 'illisible', code: dernierCode };
  }

  tailleDe(fichier) {
    try { return fs.statSync(fichier).size; } catch { return null; }
  }

  lireEmpreinte(fichier) {
    return new Promise((resoudre) => {
      const h = crypto.createHash('sha256');
      fs.createReadStream(fichier)
        .on('data', (c) => h.update(c))
        .on('end', () => resoudre({ ok: true, valeur: h.digest('hex').toUpperCase() }))
        .on('error', (e) => resoudre({ ok: false, code: e.code ?? e.message }));
    });
  }

  /**
   * Confie le paquet a Update.exe, qui attend la mort de ce processus, applique, puis
   * relance l'application. L'appelant doit avoir arrete le relais AVANT : mediamtx vit
   * dans le dossier que l'installation va remplacer.
   */
  redemarrer() {
    if (!this.prete) return false;
    if (!fs.existsSync(this.updateExe)) {
      this.journal.erreur('update', `Update.exe not found: ${this.updateExe}`);
      return false;
    }
    this.journal.info('update', `applying ${this.prete.version} at restart`);
    spawn(this.updateExe,
      ['apply', '--waitPid', String(process.pid), '-p', this.prete.fichier],
      { detached: true, stdio: 'ignore' }).unref();
    return true;
  }
}

module.exports = { GestionnaireMaj, DEPOT };
