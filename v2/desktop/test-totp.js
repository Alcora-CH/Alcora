'use strict';

/**
 * Verification du generateur de codes contre les vecteurs normalises du RFC 6238.
 * Les memes que ceux qui valident la version 1.x : les deux implementations doivent
 * produire exactement les memes codes.
 *   node test-totp.js
 */

const { normalizeSecret, decodeSecret, computeTotp, remainingSeconds } = require('./protect/totp');

let failures = 0;

function check(label, expected, actual) {
  const ok = expected === actual;
  if (!ok) failures++;
  console.log(`${ok ? '  OK  ' : ' ECHEC'}  ${label.padEnd(42)} attendu=${String(expected).padEnd(10)} obtenu=${actual}`);
}

function checkBool(label, condition) {
  if (!condition) failures++;
  console.log(`${condition ? '  OK  ' : ' ECHEC'}  ${label}`);
}

console.log('=== Vecteurs RFC 6238 (SHA-1, 8 chiffres) ===');
const key = Buffer.from('12345678901234567890', 'ascii');

for (const [unix, expected] of [
  [59, '94287082'],
  [1111111109, '07081804'],
  [1111111111, '14050471'],
  [1234567890, '89005924'],
  [2000000000, '69279037'],
  [20000000000, '65353130'],
]) {
  check(`T=${unix}`, expected, computeTotp(key, new Date(unix * 1000), 30, 8));
}

console.log('\n=== Code a 6 chiffres (le format utilise) ===');
check('T=59', '287082', computeTotp(key, new Date(59 * 1000)));

console.log('\n=== Secondes restantes ===');
checkBool('T=0 -> 30 s', remainingSeconds(new Date(0)) === 30);
checkBool('T=29 -> 1 s', remainingSeconds(new Date(29 * 1000)) === 1);

console.log('\n=== Normalisation du secret ===');
checkBool('cle groupee par 4 acceptee',
  normalizeSecret('JBSW Y3DP EHPK 3PXP').value === 'JBSWY3DPEHPK3PXP');
checkBool('minuscules acceptees',
  normalizeSecret('jbswy3dpehpk3pxp').value === 'JBSWY3DPEHPK3PXP');
checkBool('tirets et padding ignores',
  normalizeSecret('JBSW-Y3DP-EHPK-3PXP==').value === 'JBSWY3DPEHPK3PXP');
checkBool('caractere invalide refuse', normalizeSecret('JBSW1Y3DP').ok === false);
checkBool('longueur impossible refusee', normalizeSecret('JBSWY3DPE').ok === false);
checkBool('chaine vide refusee', normalizeSecret('   ').ok === false);

console.log('\n=== Decodage : reproduit la cle du RFC ===');
const decoded = decodeSecret('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
checkBool('longueur = 20 octets', decoded.length === 20);
checkBool('octets identiques a la cle ASCII', decoded.equals(key));
check('code genere depuis le base32', '94287082', computeTotp(decoded, new Date(59 * 1000), 30, 8));

console.log('\n' + (failures === 0 ? 'TOUS LES TESTS PASSENT' : `${failures} TEST(S) EN ECHEC`));
process.exit(failures === 0 ? 0 : 1);
