'use strict';

/**
 * L'AUTHENTICITE d'un paquet de mise a jour.
 *
 * L'empreinte SHA-256 de « releases.win.json » prouve que le paquet recu est celui que le
 * manifeste annonce — pas que le manifeste vient de nous : les deux sont servis par le meme
 * depot. Qui en prendrait le controle (compte GitHub, jeton d'acces derobe) y poserait un
 * paquet et son empreinte, et chaque poste installe l'appliquerait. Audit du 22.10.2026.
 *
 * Chaque version publie donc une DECLARATION signee par la cle du certificat de signature —
 * celle qui signe deja les executables, et qui ne quitte pas le poste de construction :
 * « tel paquet, telle version, tel fichier, telle taille, telle empreinte ». L'application
 * la verifie avec la cle publique epinglee ci-dessous AVANT de telecharger, et l'empreinte
 * des octets recus doit ensuite etre celle que la declaration signe. Chaque octet du paquet
 * est couvert — executables, bibliotheques, donnees —, sans exception pour les DLL signees
 * par Microsoft et sans rien demander a Windows.
 *
 * Signer : scripts/declaration.mjs, a la construction (cle du certificat) et a la
 * publication (cle de la puce, depuis la 2.37.0).
 *
 * PLUSIEURS SIGNATURES depuis la 2.37.0 (decision du 24.10.2026). La cle du certificat est
 * exportable : sa sauvegarde .pfx dort sur le disque. La relaie une cle RSA 2048 NEE dans la
 * puce TPM du poste de construction — non exportable, protegee par un PIN demande a chaque
 * publication — et, si ce poste etait perdu, une cle de SECOURS Ed25519 gardee hors du PC,
 * chiffree par une phrase de passe. Pendant la transition, chaque declaration garde la
 * signature historique (« signature », la seule que lisent les postes 2.30.0 a 2.36.0, qui
 * ignorent tout autre champ) et ajoute les nouvelles dans « signatures ». Le texte signe, lui,
 * ne change pas : FORMAT reste 1. Leur verification, recopiee a l'identique dans
 * scripts/authenticite-postes-2.30-2.36.cjs, relit chaque publication.
 */

const crypto = require('node:crypto');

const FORMAT = 1;
/** Au plus tant de signatures par declaration : de quoi tenir une transition, pas davantage. */
const SIGNATURES_MAX = 4;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/*
 * Les cles de confiance — une LISTE, pour qu'un changement de certificat reste possible.
 *
 * Changer de cle sans couper les postes : publier d'abord une version qui connait
 * l'ancienne ET la nouvelle, signee par l'ancienne ; ne signer avec la seule nouvelle
 * qu'une fois cette version installee partout. Dans l'autre ordre, chaque poste refuserait
 * toutes les mises a jour suivantes, et ne s'en sortirait que par une reinstallation.
 *
 * « role » ne sert qu'a la publication (scripts/publier.mjs) : « puce » designe la cle dont
 * la signature est exigee a chaque version. La verification, elle, les traite toutes pareil.
 */
const CLES = [
  {
    nom: 'CN=Alcora 66FBA4FD6EE142FB8385814070C4ECEDD90ACBA2 (2026-2036)',
    role: 'certificat',
    pem: [
      '-----BEGIN PUBLIC KEY-----',
      'MIIBojANBgkqhkiG9w0BAQEFAAOCAY8AMIIBigKCAYEAlyOebK4OS2c90JCr/GxT',
      '+LQwcJNqFHh9RzHCRz057RoU+k6knXPn1L2RBfmTp4PPXlx9/T5VeQsYDYMeddDT',
      '7QB3uAN1xErQuwb+xEKYisSek9KLNJRuUUT0V6k8xllBvyjh60BvMEgGXgg24F5x',
      'Bv557oYIn7yYdmKj4gqHl6ZxXjaQ4VjPtADmbM/jYNQqdqRHlnIxJucszEhcWmrG',
      'A0g96ZBdCa1dotDfn3mqdQqtNK1iSFMiTeutpVY/O4d1cZCZT/UI+GCasBK3VJJV',
      'A8We3JMAM+Aso5z0chNvBXG6SA6yxC+0XqduT2zrPPKZ7qf3cdr68DyOxoBn30k/',
      'VWIaDuYdGDCyaArcipWtqURctUEq+lVHNDVRzU7Pxt49TDiWLEnxM3Y3juZkFFxt',
      'A5QkrehTCMAvW/7RUsg93s0k4QyQnckF5qrg7lAg/ajoDAK/xqyrVjVaWh051B4y',
      'SBD/9vfGDpcJBDGlAFSOLh/Yly9sVzSsH3vTxrZCeksxAgMBAAE=',
      '-----END PUBLIC KEY-----',
    ].join('\n'),
  },
  {
    // Nee dans la puce du poste de construction le 24.10.2026 (scripts/cle-tpm.mjs).
    nom: 'TPM key Alcora-declaration 378529C9 (2026)',
    role: 'puce',
    pem: [
      '-----BEGIN PUBLIC KEY-----',
      'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvSH6hVJP2mpGr32CZiiI',
      '7yYtcKxUNIRGNX4iaBgahIKl2khdul60lvklw1JJAw0nS0Fa9//wSNw5tpxZHI5Q',
      'ycMFVZisdEqP8XHy7PwkYbkZt2adScN0mipUYq0KLHxEqItYOqLdw6k+Bf1Ugk/M',
      'NEyUzltXiLT2/QBMuFpdiLtiYtdDS9YRKP9InQVza8C05/iiyWWUCdlXloyBeZrx',
      'IaYxJ47Ks5AszTcbzQrbaz0djYuGStYbZ57izoTAPxciW1iCrkHPd+LhfCBZ/jhT',
      'Nt4Oo/O1gAZJzF1y0YJDR7yAc+uzuZRIgmK3PWVae8DO2Bw++vrO+cpoNMxQ2Tw4',
      '3QIDAQAB',
      '-----END PUBLIC KEY-----',
    ].join('\n'),
  },
  {
    // Creee le 24.10.2026 (scripts/cle-secours.mjs) ; sa partie privee n'existe que
    // chiffree, dans une note Proton Pass.
    nom: 'Ed25519 backup key A1CD2B18 (2026)',
    role: 'secours',
    pem: [
      '-----BEGIN PUBLIC KEY-----',
      'MCowBQYDK2VwAyEA4+9wMp75Y80THhGOGR8ptm2hAEXBFdZ6fQLG87xVJB8=',
      '-----END PUBLIC KEY-----',
    ].join('\n'),
  },
];

/** Le nom de la declaration publiee a cote du paquet. */
function nomDeclaration(paquet, version) { return `${paquet}-${version}-signature.json`; }

/**
 * Le texte signe. Ordre des champs FIXE : signer et verifier doivent hacher les memes
 * octets, quel que soit l'ordre dans lequel la declaration les range.
 */
function messageSigne({ paquet, version, fichier, taille, sha256 }) {
  return Buffer.from(JSON.stringify({ format: FORMAT, paquet, version, fichier, taille, sha256 }), 'utf8');
}

const refus = (raison) => ({ ok: false, raison });

/**
 * Une cle a-t-elle signe ces octets ? RSA : SHA-256 et PKCS#1 v1.5, comme le certificat et
 * la puce. Ed25519 : la cle de secours. Une cle illisible n'a rien signe — sans planter.
 */
function signeePar(cle, message, octets) {
  try {
    const publique = crypto.createPublicKey(cle.pem);
    if (publique.asymmetricKeyType === 'ed25519') return crypto.verify(null, message, publique, octets);
    if (publique.asymmetricKeyType === 'rsa') {
      return crypto.verify('sha256', message, { key: publique, padding: crypto.constants.RSA_PKCS1_PADDING }, octets);
    }
  } catch { /* cle ou signature illisible : simplement pas celle-ci */ }
  return false;
}

/**
 * Les signatures portees par une declaration, ou null si leur forme est fausse : la
 * historique (« signature ») et les suivantes (« signatures »), au moins une en tout.
 */
function signaturesDe({ signature, signatures }) {
  const toutes = [];
  if (signature !== undefined) {
    if (typeof signature !== 'string' || !BASE64.test(signature)) return null;
    toutes.push(signature);
  }
  if (signatures !== undefined) {
    if (!Array.isArray(signatures) || signatures.length > SIGNATURES_MAX) return null;
    for (const s of signatures) {
      if (!s || typeof s !== 'object' || typeof s.signature !== 'string' || !BASE64.test(s.signature)) return null;
      toutes.push(s.signature);
    }
  }
  return toutes.length ? toutes : null;
}

/**
 * La declaration est-elle signee par une cle de confiance, et dit-elle exactement ce que
 * le manifeste annonce ?
 *
 * @param {unknown} declaration   le JSON publie a cote du paquet
 * @param {{ paquet: string, version: string, fichier: string, taille: number, sha256: string }} attendu
 *        l'entree du manifeste
 * @param {{ cles?: { nom: string, pem: string }[] }} [options]  pour les tests seulement
 * @returns {{ ok: true, cle: string } | { ok: false, raison: string }}  raison en anglais (journal)
 */
function verifierDeclaration(declaration, attendu, { cles = CLES } = {}) {
  if (!declaration || typeof declaration !== 'object' || Array.isArray(declaration)) {
    return refus('declaration unreadable');
  }
  const { format, paquet, version, fichier, taille, sha256 } = declaration;
  if (format !== FORMAT) return refus(`unknown declaration format (${format})`);
  const signatures = signaturesDe(declaration);
  if (typeof paquet !== 'string' || typeof version !== 'string' || typeof fichier !== 'string'
    || !Number.isSafeInteger(taille) || typeof sha256 !== 'string' || !/^[0-9A-F]{64}$/.test(sha256)
    || !signatures) {
    return refus('malformed declaration');
  }

  // Ce que la declaration affirme doit etre ce que le manifeste annonce, champ par champ :
  // une declaration authentique d'une AUTRE version ne doit pas pouvoir couvrir celle-ci.
  const ecarts = [];
  if (paquet !== attendu.paquet) ecarts.push('package');
  if (version !== attendu.version) ecarts.push('version');
  if (fichier !== attendu.fichier) ecarts.push('file name');
  if (taille !== attendu.taille) ecarts.push('size');
  if (sha256 !== String(attendu.sha256).toUpperCase()) ecarts.push('fingerprint');
  if (ecarts.length) return refus(`declaration does not match the manifest (${ecarts.join(', ')})`);

  // Une signature valide d'une cle de confiance suffit : les autres peuvent etre celles d'une
  // cle que ce poste ne connait pas encore, ou plus.
  const message = messageSigne({ paquet, version, fichier, taille, sha256 });
  for (const signature of signatures) {
    const octets = Buffer.from(signature, 'base64');
    for (const cle of cles) {
      if (signeePar(cle, message, octets)) return { ok: true, cle: cle.nom };
    }
  }
  return refus('signature not made by a trusted key');
}

module.exports = { CLES, FORMAT, SIGNATURES_MAX, messageSigne, nomDeclaration, verifierDeclaration };
