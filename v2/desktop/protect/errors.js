'use strict';

const { t } = require('../i18n');

/**
 * Erreurs typees du client Protect.
 *
 * Chacune porte un message affichable tel quel et, quand c'est possible, l'action a
 * proposer. Aucune erreur opaque ne doit remonter jusqu'a l'interface : « echec de
 * connexion » n'aide personne a comprendre quel champ corriger.
 *
 * Les messages destines a l'UTILISATEUR viennent du dictionnaire (i18n.js), dans la
 * langue du moment de la construction ; le message technique (this.message) reste, lui,
 * la matiere du journal.
 */
class ProtectError extends Error {
  constructor(message, { userMessage, remedy, permanent = false, technical } = {}) {
    super(message);
    this.name = new.target.name;
    this.userMessage = userMessage;
    this.remedy = remedy;
    this.permanent = permanent;
    this.technical = technical;
  }
}

class NetworkError extends ProtectError {
  constructor(detail, host) {
    super(detail, {
      userMessage: t('erreur.injoignable'),
      remedy: t('erreur.injoignableRemede'),
      technical: detail,
    });
    this.host = host;
  }
}

class HostNotFoundError extends ProtectError {
  constructor(host) {
    super(`DNS: ${host}`, {
      userMessage: t('erreur.nomNonResolu', { host }),
      remedy: t('erreur.nomNonResoluRemede'),
      permanent: true,
    });
  }
}

class ConnectionRefusedError extends ProtectError {
  constructor(host) {
    super(`ECONNREFUSED ${host}:443`, {
      userMessage: t('erreur.rienPort443', { host }),
      remedy: t('erreur.rienPort443Remede'),
    });
  }
}

/**
 * Le systeme a refuse la sortie reseau a CETTE application.
 *
 * A ne pas confondre avec « injoignable » : le reseau va bien, c'est ce PC qui interdit la
 * connexion — EACCES est rendu localement, avant tout paquet.
 *
 * Le message n'accusait qu'une cause : l'antivirus. Il avait tort le 23.07.2026, et cette
 * fausse piste a coute des heures : le blocage venait d'un executable lance depuis un
 * dossier d'essai, la meme connexion reussissant depuis l'installation normale au meme
 * instant. On enonce donc le fait, et on laisse les deux causes ouvertes — celle qu'on peut
 * verifier soi-meme d'abord.
 */
class FirewallBlockedError extends ProtectError {
  constructor(host, technical) {
    super(`EACCES ${host}:443`, {
      userMessage: t('erreur.pcRefuse', { host }),
      remedy: t('erreur.pcRefuseRemede'),
      permanent: true,
      technical,
    });
  }
}

class PinMismatchError extends ProtectError {
  constructor(seen, expected) {
    super('public key fingerprint differs', {
      userMessage: t('erreur.identiteChangee'),
      remedy: t('erreur.identiteChangeeRemede'),
      permanent: true,
      technical: `attendu ${expected.join(' ou ')}, vu ${seen}`,
    });
    this.seen = seen;
  }
}

class CredentialsError extends ProtectError {
  constructor(technical) {
    super('credentials refused', {
      userMessage: t('erreur.identifiants'),
      remedy: t('erreur.identifiantsRemede'),
      permanent: true,
      technical,
    });
  }
}

class TotpError extends ProtectError {
  constructor(technical, clockOffsetSeconds) {
    const decale = Number.isFinite(clockOffsetSeconds) && Math.abs(clockOffsetSeconds) > 5;
    super('two-factor code refused', {
      userMessage: t('erreur.totpRefuse'),
      remedy: decale
        ? t('erreur.totpDecale', { s: Math.abs(Math.round(clockOffsetSeconds)) })
        : t('erreur.totpVerifieCle'),
      permanent: true,
      technical,
    });
    this.clockOffsetSeconds = clockOffsetSeconds;
  }
}

/** Le compte exige un second facteur, et aucune cle n'a ete fournie. */
class TotpRequiredError extends ProtectError {
  constructor(technical) {
    super('second factor required, no key provided', {
      userMessage: t('erreur.totpExige'),
      remedy: t('erreur.totpExigeRemede'),
      permanent: true,
      technical,
    });
  }
}

class ForbiddenError extends ProtectError {
  constructor(what = 'this operation') {
    super(`403 on ${what}`, {
      userMessage: t('erreur.droits'),
      remedy: t('erreur.droitsRemede'),
      permanent: true,
    });
  }
}

class RateLimitedError extends ProtectError {
  constructor(retryAfterSeconds = 30) {
    super(`429, retry in ${retryAfterSeconds} s`, {
      userMessage: t('erreur.tropTentatives'),
      remedy: t('erreur.tropTentativesRemede', { s: retryAfterSeconds }),
    });
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** L'installation est incomplete : le composant qui convertit les flux manque. */
class RelayMissingError extends ProtectError {
  constructor(chemin) {
    super(`relay missing: ${chemin}`, {
      userMessage: t('erreur.composantAbsent'),
      remedy: t('erreur.composantAbsentRemede'),
      permanent: true,
      technical: chemin,
    });
  }
}

/** L'identite du controleur n'a pas pu etre relevee : demarrer sans serait aveugle. */
/** Une operation n'a pas rendu la main dans le temps imparti. */
class TimeoutError extends ProtectError {
  constructor(quoi, ms) {
    super(`timeout: ${quoi} (${ms} ms)`, {
      userMessage: t('erreur.delai', {
        quoi: `${quoi[0].toUpperCase()}${quoi.slice(1)}`, s: Math.round(ms / 1000),
      }),
      remedy: t('erreur.delaiRemede'),
      technical: `${quoi} interrupted after ${ms} ms`,
    });
  }
}

class PinningFailedError extends ProtectError {
  constructor() {
    super('no fingerprint recorded', {
      userMessage: t('erreur.identiteNonVerifiee'),
      remedy: t('erreur.identiteNonVerifieeRemede'),
      permanent: true,
    });
  }
}

class ApiError extends ProtectError {
  constructor(status, detail) {
    super(`HTTP ${status}`, {
      userMessage: t('erreur.controleur', { status }),
      technical: detail,
    });
    this.status = status;
  }
}

module.exports = {
  ProtectError, NetworkError, HostNotFoundError, ConnectionRefusedError,
  PinMismatchError, CredentialsError, TotpError, TotpRequiredError, ForbiddenError,
  RateLimitedError, RelayMissingError, FirewallBlockedError, PinningFailedError,
  TimeoutError, ApiError,
};
