'use strict';

const crypto = require('node:crypto');

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Nettoie la saisie d'un secret base32 et valide sa forme.
 *
 * Les services affichent ce secret groupe par blocs de quatre. Un decodeur strict rejette
 * l'espace : on normalise en silence plutot que de reprocher a l'utilisateur d'avoir colle
 * ce qu'on lui a montre.
 *
 * @returns {{ok: true, value: string} | {ok: false, error: string}}
 */
function normalizeSecret(raw) {
  if (!raw || !raw.trim()) return { ok: false, error: 'The key is empty.' };

  let out = '';
  for (const ch of raw) {
    if (/\s|[-_=]/.test(ch)) continue;
    const up = ch.toUpperCase();
    if (!ALPHABET.includes(up)) {
      return { ok: false, error: `Invalid character in the key: “${ch}”. Expected: A-Z or 2-7.` };
    }
    out += up;
  }

  if (out.length === 0) return { ok: false, error: 'The key contains no base32 character.' };

  // 8 caracteres base32 codent 5 octets. Les restes 1, 3 et 6 sont impossibles : c'est le
  // signe d'une cle tronquee au copier-coller.
  if ([1, 3, 6].includes(out.length % 8)) {
    return { ok: false, error: `Incomplete key: ${out.length} characters, impossible base32 length.` };
  }

  return { ok: true, value: out };
}

/** Decode un secret deja normalise. */
function decodeSecret(normalized) {
  let bits = 0;
  let value = 0;
  const out = [];

  for (const ch of normalized) {
    const index = ALPHABET.indexOf(ch.toUpperCase());
    if (index < 0) throw new Error(`Invalid base32 character: “${ch}”.`);
    value = (value << 5) | index;
    bits += 5;
    if (bits < 8) continue;
    out.push((value >>> (bits - 8)) & 0xff);
    bits -= 8;
  }

  return Buffer.from(out);
}

/**
 * Code a usage unique (RFC 6238).
 *
 * @param {Buffer} key    secret decode
 * @param {Date}   [at]   instant de reference. Toujours en temps universel : une heure
 *                        locale produirait un code faux, sans erreur ni avertissement.
 */
function computeTotp(key, at = new Date(), step = 30, digits = 6) {
  if (step <= 0) throw new RangeError('The step must be positive.');
  if (digits < 6 || digits > 9) throw new RangeError('Entre 6 et 9 chiffres.');
  if (!key || key.length === 0) throw new Error('Empty key.');

  const counter = Math.floor(Math.floor(at.getTime() / 1000) / step);
  const message = Buffer.alloc(8);
  message.writeBigInt64BE(BigInt(counter));

  const hash = crypto.createHmac('sha1', key).update(message).digest();

  // Troncature dynamique : les 4 derniers bits designent l'offset.
  const offset = hash[hash.length - 1] & 0x0f;
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    (hash[offset + 1] << 16) |
    (hash[offset + 2] << 8) |
    hash[offset + 3];

  const modulo = 10 ** digits;
  return String(binary % modulo).padStart(digits, '0');
}

/** Secondes restantes avant que le code courant ne change. */
function remainingSeconds(at = new Date(), step = 30) {
  return step - (Math.floor(at.getTime() / 1000) % step);
}

module.exports = { normalizeSecret, decodeSecret, computeTotp, remainingSeconds };
