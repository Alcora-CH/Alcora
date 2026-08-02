'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { safeStorage } = require('electron');

/**
 * Configuration et secrets.
 *
 * Les secrets passent par safeStorage. Le detail qui compte : la cle qui les chiffre est
 * tiree au hasard POUR CE DOSSIER, puis rangee — protegee par DPAPI, donc liee au compte
 * Windows — dans le fichier « Local State » voisin. Deux consequences : les secrets ne
 * franchissent ni une autre machine, ni un autre compte, ET ils ne survivent pas a un
 * changement de dossier de donnees si « Local State » ne suit pas (voir reprendreDossier).
 */
const NOMS_SECRETS = ['password', 'totp', 'session'];

/** Compare deux numeros de version. Renvoie -1, 0 ou 1. Tout format inconnu vaut 0.0.0. */
function comparerVersions(a, b) {
  const decouper = (v) => String(v ?? '').split('.').map((n) => Number.parseInt(n, 10) || 0);
  const [x, y] = [decouper(a), decouper(b)];
  for (let i = 0; i < 3; i += 1) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0) ? 1 : -1;
  }
  return 0;
}

/**
 * Reprise du dossier de donnees de l'ancien nom.
 *
 * Le renommage deplace le dossier : sans cette reprise, la premiere ouverture reclamerait
 * l'adresse du controleur, le compte, le mot de passe et la cle a deux facteurs, alors que
 * le poste les detient deja a cote. On copie une seule fois, et seulement si le nouveau
 * dossier est encore vierge — jamais par-dessus une configuration en place.
 *
 * COPIER LES SECRETS NE SUFFIT PAS — constate sur le poste reel le 28.07.2026.
 *
 * On pouvait croire que safeStorage chiffre chaque secret par DPAPI, pour le compte
 * Windows : les fichiers auraient alors ete lisibles depuis n'importe quel dossier. C'est
 * faux. Electron tire une cle AES AU HASARD PAR DOSSIER DE DONNEES, range cette cle —
 * elle, protegee par DPAPI — dans le fichier « Local State », et chiffre les secrets avec
 * elle. Une reprise sans « Local State » recopie donc des fichiers que la nouvelle
 * installation ne peut plus ouvrir : elle s'en fabrique une autre quelques secondes plus
 * tard, et l'ecran de connexion reapparait malgre la copie.
 *
 * « Local State » doit par consequent etre repris AVANT qu'Electron n'en ecrive un neuf,
 * ce que garantit l'appel au chargement du module, avant app.whenReady().
 *
 * @returns {string|null} le dossier repris, ou null si rien n'a ete fait.
 */
function reprendreDossier(ancien, nouveau) {
  try {
    if (ancien === nouveau) return null;
    if (!fs.existsSync(path.join(ancien, 'config.json'))) return null;
    if (fs.existsSync(path.join(nouveau, 'config.json'))) return null;

    fs.mkdirSync(nouveau, { recursive: true });
    fs.copyFileSync(path.join(ancien, 'config.json'), path.join(nouveau, 'config.json'));

    // La cle qui ouvre les secrets. Jamais par-dessus une cle deja en place : ce sont les
    // secrets DEJA presents dans ce dossier qu'on rendrait alors illisibles.
    const cleAncienne = path.join(ancien, 'Local State');
    const cleNouvelle = path.join(nouveau, 'Local State');
    if (fs.existsSync(cleAncienne) && !fs.existsSync(cleNouvelle)) {
      fs.copyFileSync(cleAncienne, cleNouvelle);
    }

    const secretsAncien = path.join(ancien, 'secrets');
    if (fs.existsSync(secretsAncien)) {
      const secretsNouveau = path.join(nouveau, 'secrets');
      fs.mkdirSync(secretsNouveau, { recursive: true });
      for (const nom of fs.readdirSync(secretsAncien)) {
        fs.copyFileSync(path.join(secretsAncien, nom), path.join(secretsNouveau, nom));
      }
    }
    return ancien;
  } catch {
    // Une reprise qui echoue ne doit pas empecher l'application de demarrer : au pire,
    // l'utilisateur ressaisit ses identifiants une fois.
    return null;
  }
}

class Store {
  constructor(dir) {
    this.dir = dir;
    this.configPath = path.join(dir, 'config.json');
    this.secretsDir = path.join(dir, 'secrets');
    this.sauvegardeDir = path.join(dir, 'sauvegarde');
    fs.mkdirSync(this.secretsDir, { recursive: true });
  }

  /**
   * Lit la configuration.
   *
   * « absent » et « illisible » etaient confondus dans un seul catch : un fichier tronque
   * par une coupure de courant rendait donc les valeurs par defaut, et le premier
   * enregistrement suivant ECRASAIT l'empreinte de cle publique du controleur — la seule
   * chose qui garantisse qu'on parle bien a lui. On distingue, et on met de cote ce qu'on
   * n'a pas su lire plutot que de l'effacer.
   */
  readConfig() {
    let brut;
    try {
      brut = fs.readFileSync(this.configPath, 'utf8');
    } catch {
      return this.configVierge();
    }
    try {
      return JSON.parse(brut);
    } catch {
      const mis = `${this.configPath}.illisible`;
      try { fs.writeFileSync(mis, brut, 'utf8'); } catch { /* tant pis */ }
      this.illisible = mis;
      return this.configVierge();
    }
  }

  configVierge() {
    return {
      host: '',
      username: '',
      pins: [],
      rtspPort: 7447,
      configured: false,
      channelHeadroom: 2,
      // Version la plus recente ayant tourne sur ce poste. Sert de garde-fou : une copie
      // plus ancienne, oubliee quelque part, ne doit pas ecrire ici.
      derniereVersion: '',
      // Version dont les nouveautes ont ete PRESENTEES. Distincte de derniereVersion :
      // l'une dit ce qui a tourne, l'autre ce que l'utilisateur a vu.
      versionPresentee: '',
      // Langue choisie : un code du registre (i18n.js LANGUES), ou '' pour suivre celle
      // de Windows. Vit ICI parce
      // que le processus principal parle aussi (notifications Windows) : l'ecran et les
      // bulles doivent parler d'une seule voix.
      langue: '',
    };
  }

  /**
   * Ce qu'il faut presenter au lancement, ou null s'il n'y a rien a dire.
   *
   * A appeler AVANT marquerVersion : c'est l'ecart entre la version courante et la
   * derniere VUE qui fait le contenu, et marquer d'abord l'effacerait.
   *
   * Deux subtilites voulues :
   *  · une PREMIERE installation ne presente rien — un nouvel utilisateur n'a pas de
   *    « depuis » ; l'ecran n'existe que pour les mises a jour. On marque en silence ;
   *  · un poste deja installe AVANT cette fonctionnalite n'a pas de versionPresentee,
   *    mais il a une derniereVersion : elle fait foi, et la premiere mise a jour qui suit
   *    presente bien ses nouveautes au lieu de se taire.
   */
  nouveautesAPresenter(versionCourante) {
    const config = this.readConfig();
    let vue = config.versionPresentee;

    if (!vue) {
      vue = config.derniereVersion;
      if (!vue) {
        this.marquerPresentee(versionCourante);
        return null;
      }
      /*
       * Le point de depart se GRAVE immediatement. Sans cela, le marquage de version du
       * meme demarrage avancait la reference, et fermer l'application sans avoir vu
       * l'ecran perdait les nouveautes pour toujours — le test « marquerVersion apres
       * coup » l'a montre avant que ca n'arrive a personne.
       */
      this.writeConfig({ ...config, versionPresentee: vue });
    }
    if (comparerVersions(versionCourante, vue) <= 0) return null;
    return { de: vue, a: versionCourante };
  }

  /** L'utilisateur a vu les nouveautes jusqu'a cette version : ne plus les representer. */
  marquerPresentee(version) {
    const config = this.readConfig();
    if (comparerVersions(version, config.versionPresentee ?? '') <= 0) return;
    this.writeConfig({ ...config, versionPresentee: version });
  }

  /**
   * Ecrit la configuration SANS jamais laisser un fichier a moitie ecrit.
   *
   * L'ecriture etait directe : une coupure de courant, un disque plein ou une extinction
   * brutale au mauvais instant laissaient un JSON tronque. Au lancement suivant la
   * configuration paraissait vierge — adresse, compte et surtout empreinte de cle publique
   * perdus. On ecrit donc a cote, on force sur le disque, puis on bascule d'un seul geste :
   * a tout instant, le fichier en place est soit l'ancien complet, soit le nouveau complet.
   */
  writeConfig(config) {
    fs.mkdirSync(this.dir, { recursive: true });
    const provisoire = `${this.configPath}.tmp`;
    const donnees = JSON.stringify(config, null, 2);

    const fd = fs.openSync(provisoire, 'w');
    try {
      fs.writeFileSync(fd, donnees, 'utf8');
      // Sans cette synchronisation, le renommage peut atteindre le disque avant le
      // contenu : on obtiendrait un fichier en place, mais vide.
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(provisoire, this.configPath);
  }

  secretPath(name) { return path.join(this.secretsDir, `${name}.bin`); }

  writeSecret(name, value) {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error(require('./i18n').t('main.chiffrementIndisponible'));
    }
    fs.writeFileSync(this.secretPath(name), safeStorage.encryptString(String(value)));
  }

  readSecret(name) {
    try {
      return safeStorage.decryptString(fs.readFileSync(this.secretPath(name)));
    } catch {
      // Secret absent, ou chiffre sous un autre compte Windows : on repart d'une saisie.
      return null;
    }
  }

  deleteSecret(name) {
    try { fs.unlinkSync(this.secretPath(name)); } catch { /* deja absent */ }
  }

  clearSecrets() {
    for (const n of NOMS_SECRETS) this.deleteSecret(n);
  }

  /* --------------------------------------------------------------- versions */

  /**
   * Version plus recente ayant deja tourne, ou null.
   *
   * Constate sur le poste reel le 23.07.2026 : une copie 2.0.0 restee dans un dossier
   * oublie, lancee par un raccourci perime, partageait ce dossier de donnees avec
   * l'installation courante et y a efface les identifiants. Une version anterieure n'a
   * aucune raison legitime d'ecrire ici : on la reconnait, et on l'arrete.
   */
  versionPlusRecente(version) {
    const vue = this.readConfig().derniereVersion;
    return vue && comparerVersions(version, vue) < 0 ? vue : null;
  }

  /** Enregistre la version courante si elle depasse celle deja notee. */
  marquerVersion(version) {
    const config = this.readConfig();
    if (comparerVersions(version, config.derniereVersion) <= 0) return;
    this.writeConfig({ ...config, derniereVersion: version });
  }

  /* ------------------------------------------------------------ sauvegarde */

  /**
   * Met la connexion de cote avant de l'effacer.
   *
   * Une remise a zero par erreur coutait une ressaisie complete : adresse, compte, mot de
   * passe et cle a deux facteurs. Rien ne justifie de detruire ce qui peut etre repose.
   * Renvoie true si quelque chose d'utilisable a bien ete mis a l'abri.
   */
  archiverConfiguration() {
    const config = this.readConfig();
    // Ne jamais ecraser une bonne sauvegarde par une configuration deja vide : la seconde
    // remise a zero d'affilee effacerait sinon le seul exemplaire encore recuperable.
    if (!config.configured || !fs.existsSync(this.secretPath('password'))) return false;

    // On assemble a cote, puis on bascule. Effacer d'abord l'ancienne sauvegarde ouvrirait
    // une fenetre ou une copie interrompue laisse le poste sans aucun exemplaire reposable.
    const provisoire = `${this.sauvegardeDir}.tmp`;
    fs.rmSync(provisoire, { recursive: true, force: true });
    fs.mkdirSync(provisoire, { recursive: true });
    fs.copyFileSync(this.configPath, path.join(provisoire, 'config.json'));
    for (const n of NOMS_SECRETS) {
      const src = this.secretPath(n);
      if (fs.existsSync(src)) fs.copyFileSync(src, path.join(provisoire, `${n}.bin`));
    }
    fs.rmSync(this.sauvegardeDir, { recursive: true, force: true });
    fs.renameSync(provisoire, this.sauvegardeDir);
    return true;
  }

  /** Ce qu'on peut proposer de reprendre : l'existence et la date, jamais le contenu. */
  sauvegarde() {
    try {
      const stat = fs.statSync(path.join(this.sauvegardeDir, 'config.json'));
      const config = JSON.parse(fs.readFileSync(path.join(this.sauvegardeDir, 'config.json'), 'utf8'));
      return { existe: true, date: stat.mtime.toISOString(), host: config.host ?? null };
    } catch {
      return { existe: false, date: null, host: null };
    }
  }

  /** Repose la connexion mise de cote. Renvoie false si elle n'existe plus. */
  restaurerSauvegarde() {
    if (!this.sauvegarde().existe) return false;
    fs.mkdirSync(this.secretsDir, { recursive: true });
    for (const n of NOMS_SECRETS) {
      const src = path.join(this.sauvegardeDir, `${n}.bin`);
      if (fs.existsSync(src)) fs.copyFileSync(src, this.secretPath(n));
      else this.deleteSecret(n);
    }
    fs.copyFileSync(path.join(this.sauvegardeDir, 'config.json'), this.configPath);
    return true;
  }
}

module.exports = { Store, comparerVersions, reprendreDossier };
