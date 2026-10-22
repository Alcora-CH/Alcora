'use strict';

/**
 * L'authenticite des paquets de mise a jour (authenticite.js).
 *
 *   node test-authenticite.js
 *
 * Ajoute le 22.10.2026 avec la declaration signee : jusque-la, qui tenait le depot des
 * versions tenait tous les postes. Les cles des tests sont FICTIVES, engendrees a chaque
 * passe — sauf la derniere section, qui confronte la cle epinglee au VRAI certificat
 * (signature/Alcora-signature.cer, hors depot) et fait signer un message fictif par sa cle
 * privee, comme le fait la construction. Si le certificat manque, le test le DIT et echoue :
 * un garde-fou qui saute en silence est un angle mort.
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { CLES, FORMAT, messageSigne, nomDeclaration, verifierDeclaration } = require('./authenticite');

let echecs = 0;
function check(label, condition, detail = '') {
  if (!condition) echecs++;
  console.log(`${condition ? '  OK  ' : ' ECHEC'}  ${label}${detail && !condition ? ` — ${detail}` : ''}`);
}

const paire = () => crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = (cle) => cle.export({ type: 'spki', format: 'pem' });
const NOTRE = paire();
const AUTRE = paire();
const CLES_TEST = [{ nom: 'cle de test', pem: pem(NOTRE.publicKey) }];

const CHAMPS = {
  paquet: 'Alcora',
  version: '2.30.0',
  fichier: 'Alcora-2.30.0-full.nupkg',
  taille: 194_000_000,
  sha256: 'C0FFEE'.padEnd(64, '0'),
};
function signer(champs, cle = NOTRE.privateKey) {
  return crypto.sign('sha256', messageSigne(champs), { key: cle, padding: crypto.constants.RSA_PKCS1_PADDING })
    .toString('base64');
}
const declaration = (champs = CHAMPS, cle) => ({ format: FORMAT, ...champs, signature: signer(champs, cle) });
const verdict = (d, attendu = CHAMPS, cles = CLES_TEST) => verifierDeclaration(d, attendu, { cles });

(async () => {
  console.log('=== Une declaration authentique passe ===');
  {
    const v = verdict(declaration());
    check('signee par la cle de confiance, conforme au manifeste', v.ok, v.raison);
    check('la cle est nommee', v.cle === 'cle de test');
    const melangee = Object.fromEntries(Object.entries(declaration()).reverse());
    check('l ordre des champs du JSON est indifferent', verdict(melangee).ok);
    check('l empreinte du manifeste peut etre en minuscules',
      verdict(declaration(), { ...CHAMPS, sha256: CHAMPS.sha256.toLowerCase() }).ok);
    check('le nom publie suit le paquet et la version',
      nomDeclaration('Alcora', '2.30.0') === 'Alcora-2.30.0-signature.json');
  }

  console.log('\n=== Le texte signe ne change JAMAIS de forme ===');
  {
    /*
     * Les postes installes verifient avec LEUR copie de messageSigne. Une construction qui
     * en changerait la forme — ordre des champs, espaces, casse — signerait des octets que
     * ces postes ne reconstruiraient pas : ils refuseraient toutes les versions suivantes.
     * Changer cette forme, c'est changer FORMAT et garder l'ancienne verification.
     */
    const attendu = '{"format":1,"paquet":"Alcora","version":"2.30.0","fichier":"Alcora-2.30.0-full.nupkg",'
      + `"taille":194000000,"sha256":"${CHAMPS.sha256}"}`;
    check('octet pour octet', messageSigne(CHAMPS).toString('utf8') === attendu,
      messageSigne(CHAMPS).toString('utf8'));
    check('format 1', FORMAT === 1);
  }

  console.log('\n=== Un depot compromis : le manifeste ET la declaration modifies ===');
  for (const [champ, valeur] of [
    ['sha256', 'BAD'.padEnd(64, '0')], ['taille', 1], ['version', '9.0.0'],
    ['fichier', 'Alcora-9.0.0-full.nupkg'], ['paquet', 'Autre'],
  ]) {
    // L'attaquant aligne tout ce qu'il controle ; il ne peut pas refaire la signature.
    const falsifie = { ...CHAMPS, [champ]: valeur };
    const v = verdict({ ...declaration(), [champ]: valeur }, falsifie);
    check(`${champ} change : signature refusee`, !v.ok && /trusted key/.test(v.raison), v.raison);
  }
  {
    const v = verdict(declaration(CHAMPS, AUTRE.privateKey));
    check('signee par une autre cle : refusee', !v.ok && /trusted key/.test(v.raison), v.raison);
  }

  console.log('\n=== Une declaration authentique qui ne couvre pas CETTE cible ===');
  for (const [champ, valeur] of [
    ['version', '2.31.0'], ['sha256', 'AB'.repeat(32)], ['taille', 5], ['fichier', 'x.nupkg'], ['paquet', 'Autre'],
  ]) {
    // Rejouer la declaration (vraie) d'une autre version, devant un manifeste qui ment.
    const v = verdict(declaration(), { ...CHAMPS, [champ]: valeur });
    check(`${champ} du manifeste different : refusee`, !v.ok && /does not match/.test(v.raison), v.raison);
  }

  console.log('\n=== Ce qui n est pas une declaration ===');
  for (const [nom, d] of [
    ['null', null], ['un tableau', []], ['un texte', 'signature'],
    ['format inconnu', { ...declaration(), format: 2 }],
    ['sans signature', { ...declaration(), signature: undefined }],
    ['signature vide', { ...declaration(), signature: '' }],
    ['signature hors base64', { ...declaration(), signature: '%%%%' }],
    ['empreinte en minuscules (la construction ecrit des majuscules)',
      { ...declaration(), sha256: CHAMPS.sha256.toLowerCase() }],
    ['taille en texte', { ...declaration(), taille: String(CHAMPS.taille) }],
  ]) {
    check(`${nom} : refusee`, !verdict(d).ok);
  }

  console.log('\n=== Les cles de confiance ===');
  {
    const deux = [{ nom: 'ancienne', pem: pem(AUTRE.publicKey) }, { nom: 'nouvelle', pem: pem(NOTRE.publicKey) }];
    const v = verdict(declaration(), CHAMPS, deux);
    check('une liste de deux : la seconde suffit (changement de certificat)', v.ok && v.cle === 'nouvelle');
    const v2 = verdict(declaration(), CHAMPS, [{ nom: 'abimee', pem: 'pas une cle' }, ...CLES_TEST]);
    check('une cle illisible ne fait pas planter la verification', v2.ok);
    check('aucune cle : refusee', !verdict(declaration(), CHAMPS, []).ok);
    check('la cle de test n est PAS une cle de l application',
      !verifierDeclaration(declaration(), CHAMPS).ok);
  }

  console.log('\n=== La cle epinglee est celle du vrai certificat ===');
  {
    const cer = path.resolve(__dirname, '..', '..', 'signature', 'Alcora-signature.cer');
    if (!fs.existsSync(cer)) {
      check(`le certificat est present (${cer}, hors depot)`, false);
    } else {
      const certificat = new crypto.X509Certificate(fs.readFileSync(cer));
      const publique = pem(certificat.publicKey);
      check('CLES[0] est la cle publique du certificat',
        crypto.createPublicKey(CLES[0].pem).export({ type: 'spki', format: 'der' })
          .equals(certificat.publicKey.export({ type: 'spki', format: 'der' })));
      const empreinte = certificat.fingerprint.replace(/:/g, '');
      check(`son nom porte l empreinte du certificat (${empreinte})`, CLES[0].nom.includes(empreinte));
      check(`le certificat est valable aujourd hui (jusqu au ${certificat.validTo})`,
        new Date(certificat.validTo) > new Date());

      // La cle PRIVEE, par le chemin meme de la construction (magasin de Windows).
      const { signerAvecLeCertificat } = await import(
        pathToFileURL(path.resolve(__dirname, '..', '..', 'scripts', 'declaration.mjs')).href);
      const champs = { ...CHAMPS, version: '0.0.0-essai', fichier: 'essai-fictif.nupkg' };
      let signature = null;
      try {
        signature = signerAvecLeCertificat(empreinte, messageSigne(champs));
      } catch (e) {
        check('la cle privee signe depuis le magasin de Windows', false, e.message);
      }
      if (signature) {
        const d = { format: FORMAT, ...champs, signature };
        const v = verifierDeclaration(d, champs);
        check('signee par la vraie cle : acceptee par l application', v.ok, v.raison);
        check('… et refusee des qu un octet change',
          !verifierDeclaration({ ...d, taille: d.taille + 1 }, { ...champs, taille: d.taille + 1 }).ok);
        check('la cle publique lue dans le certificat la verifie aussi',
          crypto.verify('sha256', messageSigne(champs),
            { key: publique, padding: crypto.constants.RSA_PKCS1_PADDING }, Buffer.from(signature, 'base64')));
      }
    }
  }

  console.log('\n' + (echecs === 0 ? 'TOUS LES TESTS PASSENT' : `${echecs} TEST(S) EN ECHEC`));
  process.exit(echecs === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
