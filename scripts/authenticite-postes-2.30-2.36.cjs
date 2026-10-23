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
 * Signer : scripts/declaration.mjs, a la construction.
 */

const crypto = require('node:crypto');

const FORMAT = 1;

/*
 * Les cles de confiance — une LISTE, pour qu'un changement de certificat reste possible.
 *
 * Changer de cle sans couper les postes : publier d'abord une version qui connait
 * l'ancienne ET la nouvelle, signee par l'ancienne ; ne signer avec la seule nouvelle
 * qu'une fois cette version installee partout. Dans l'autre ordre, chaque poste refuserait
 * toutes les mises a jour suivantes, et ne s'en sortirait que par une reinstallation.
 */
const CLES = [
  {
    nom: 'CN=Alcora 66FBA4FD6EE142FB8385814070C4ECEDD90ACBA2 (2026-2036)',
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
  const { format, paquet, version, fichier, taille, sha256, signature } = declaration;
  if (format !== FORMAT) return refus(`unknown declaration format (${format})`);
  if (typeof paquet !== 'string' || typeof version !== 'string' || typeof fichier !== 'string'
    || !Number.isSafeInteger(taille) || typeof sha256 !== 'string' || !/^[0-9A-F]{64}$/.test(sha256)
    || typeof signature !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(signature)) {
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

  const message = messageSigne({ paquet, version, fichier, taille, sha256 });
  const octets = Buffer.from(signature, 'base64');
  for (const cle of cles) {
    let valide = false;
    try {
      valide = crypto.verify('sha256', message,
        { key: cle.pem, padding: crypto.constants.RSA_PKCS1_PADDING }, octets);
    } catch { /* cle ou signature illisible : simplement pas celle-ci */ }
    if (valide) return { ok: true, cle: cle.nom };
  }
  return refus('signature not made by a trusted key');
}

module.exports = { CLES, FORMAT, messageSigne, nomDeclaration, verifierDeclaration };
