/**
 * La cle de SECOURS (Ed25519) — voir v2/desktop/authenticite.js.
 *
 * Elle ne vit sur aucun disque : sa partie privee, chiffree par une phrase de passe, tient
 * en une ligne de texte rangee dans une note securisee de Proton Pass (decision du
 * 24.10.2026). Elle sert le jour ou le poste de construction — et sa puce — serait perdu :
 * une version qu'elle signe passe chez tout poste 2.37.0 ou plus recent.
 *
 * Chiffrement : scrypt (N = 2^17, r = 8, p = 1 : 128 Mio et une fraction de seconde par
 * essai, pour qu'une phrase de passe ordinaire resiste a qui volerait la note), puis
 * AES-256-GCM, qui refuse une note abimee au lieu de rendre une cle fausse. Les parametres
 * voyagent dans la note : les durcir un jour ne rendra pas les anciennes illisibles.
 */

import crypto from 'node:crypto';

const ENTETE = 'alcora-secours-1';
const PARAMETRES = { N: 2 ** 17, r: 8, p: 1 };
/** En caracteres. Une phrase de quatre ou cinq mots les depasse sans effort. */
export const PHRASE_MIN = 12;

const b64 = (octets) => octets.toString('base64url');
const deriver = (phrase, sel, { N, r, p }) =>
  crypto.scryptSync(phrase.normalize('NFC'), sel, 32, { N, r, p, maxmem: 512 * 1024 * 1024 });

/**
 * @param {crypto.KeyObject} privee   cle privee Ed25519
 * @param {string} phrase
 * @returns {string} la note : une ligne, ASCII
 */
export function chiffrerCleDeSecours(privee, phrase) {
  if (privee.asymmetricKeyType !== 'ed25519') throw new Error('la cle de secours est une cle Ed25519');
  if ([...phrase].length < PHRASE_MIN) throw new Error(`phrase de passe trop courte (${PHRASE_MIN} caracteres au moins)`);
  const sel = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const chiffreur = crypto.createCipheriv('aes-256-gcm', deriver(phrase, sel, PARAMETRES), iv);
  chiffreur.setAAD(Buffer.from(ENTETE));
  const chiffre = Buffer.concat([chiffreur.update(privee.export({ type: 'pkcs8', format: 'der' })), chiffreur.final()]);
  const { N, r, p } = PARAMETRES;
  return [ENTETE, `scrypt-${Math.log2(N)}-${r}-${p}`, b64(sel), b64(iv), b64(chiffreur.getAuthTag()), b64(chiffre)].join(':');
}

/**
 * @param {string} note
 * @param {string} phrase
 * @returns {crypto.KeyObject} la cle privee Ed25519
 */
export function dechiffrerCleDeSecours(note, phrase) {
  const parties = String(note).trim().split(':');
  const kdf = /^scrypt-(\d{1,2})-(\d{1,2})-(\d)$/.exec(parties[1] ?? '');
  if (parties.length !== 6 || parties[0] !== ENTETE || !kdf) throw new Error('ce n\'est pas une note de cle de secours');
  const [, logN, r, p] = kdf.map(Number);
  // Des bornes, pour qu'une note forgee ne puisse pas demander des gigaoctets.
  if (logN < 14 || logN > 20 || r < 1 || r > 16 || p < 1 || p > 4) throw new Error('parametres de la note hors bornes');
  const [sel, iv, etiquette, chiffre] = parties.slice(2).map((t) => Buffer.from(t, 'base64url'));
  let der;
  try {
    const dechiffreur = crypto.createDecipheriv('aes-256-gcm', deriver(phrase, sel, { N: 2 ** logN, r, p }), iv);
    dechiffreur.setAAD(Buffer.from(ENTETE));
    dechiffreur.setAuthTag(etiquette);
    der = Buffer.concat([dechiffreur.update(chiffre), dechiffreur.final()]);
  } catch {
    throw new Error('phrase de passe fausse, ou note abimee');
  }
  const privee = crypto.createPrivateKey({ key: der, format: 'der', type: 'pkcs8' });
  if (privee.asymmetricKeyType !== 'ed25519') throw new Error('la note ne contient pas une cle Ed25519');
  return privee;
}

const MOTIF_NOTE = /^alcora-secours-\d+(?::[A-Za-z0-9_-]+){5}$/;

/**
 * La note dans ce qui a ete copie depuis Proton Pass : un titre, des retours a la ligne ou
 * des espaces autour n'y changent rien — la note n'en contient aucun. null si elle n'y est
 * pas. Constate le 24.10.2026 : exiger le texte copie a l'identique faisait echouer la
 * relecture sans dire pourquoi.
 */
export function extraireNote(texte) {
  return String(texte ?? '').split(/\s+/).find((morceau) => MOTIF_NOTE.test(morceau)) ?? null;
}

/**
 * Pourquoi ce qui a ete copie n'est pas la note attendue — en francais, pour le terminal,
 * sans rien montrer de ce qui a ete copie (ce pourrait etre un autre secret). null si c'est
 * bien elle.
 */
export function ecartDeNote(copie, attendue) {
  const texte = String(copie ?? '').trim();
  if (!texte) return 'Le presse-papiers est vide : la copie depuis Proton Pass n\'a rien donné, ou Proton Pass l\'a déjà vidé.';
  const trouvee = extraireNote(texte);
  if (trouvee === attendue) return null;
  const n = [...texte].length;
  if (!trouvee) {
    return texte.includes('alcora-secours')
      ? `La ligne y est, mais tronquée ou abîmée (${n} caractères copiés ; la ligne seule en compte ${attendue.length}).`
      : `Rien de la clé dans ce qui a été copié (${n} caractères, sans « alcora-secours- ») : est-ce bien la note « Alcora — clé de secours » ?`;
  }
  return attendue.startsWith(trouvee)
    ? `Ligne incomplète : ${trouvee.length} caractères sur ${attendue.length}.`
    : 'C\'est une clé de secours, mais pas celle de ce lancement — une note d\'un essai précédent ?';
}

/** @returns {string} signature en base64 — la forme de la declaration */
export const signerAvecLeSecours = (privee, message) => crypto.sign(null, message, privee).toString('base64');

/** La cle publique, en PEM : ce qui s'epingle dans CLES. */
export const pemPublique = (cle) => crypto.createPublicKey(cle).export({ type: 'spki', format: 'pem' });

/** L'empreinte d'une cle publique (SHA-256 de sa forme SPKI), pour la reconnaitre a l'oeil. */
export function empreintePublique(pem) {
  const der = crypto.createPublicKey(pem).export({ type: 'spki', format: 'der' });
  return crypto.createHash('sha256').update(der).digest('hex').toUpperCase().match(/.{4}/g).join(' ');
}
