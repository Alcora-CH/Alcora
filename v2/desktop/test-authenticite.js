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
const { CLES, FORMAT, SIGNATURES_MAX, messageSigne, nomDeclaration, verifierDeclaration } = require('./authenticite');

const SCRIPTS = path.resolve(__dirname, '..', '..', 'scripts');
const COPIE_ANTERIEURE = path.join(SCRIPTS, 'authenticite-postes-2.30-2.36.cjs');
const anterieure = require(COPIE_ANTERIEURE);

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
  if (cle.asymmetricKeyType === 'ed25519') return crypto.sign(null, messageSigne(champs), cle).toString('base64');
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

  // Les cles de la transition de la 2.37.0, fictives elles aussi.
  const PUCE = paire();
  const SECOURS = crypto.generateKeyPairSync('ed25519');
  const TROIS = [
    { nom: 'certificat', pem: pem(NOTRE.publicKey) },
    { nom: 'puce', pem: pem(PUCE.publicKey) },
    { nom: 'secours', pem: pem(SECOURS.publicKey) },
  ];
  const SEULE_PUCE = [TROIS[1]];
  const seules = (...signatures) => ({ format: FORMAT, ...CHAMPS, signatures });
  const transition = () => ({ ...declaration(), signatures: [{ cle: 'puce', signature: signer(CHAMPS, PUCE.privateKey) }] });

  console.log('\n=== Plusieurs signatures (2.37.0) ===');
  {
    check('la declaration de transition passe avec les trois cles', verdict(transition(), CHAMPS, TROIS).ok);
    const v = verdict(transition(), CHAMPS, SEULE_PUCE);
    check('… et avec la seule cle de la puce', v.ok && v.cle === 'puce', v.raison);
    check('sans « signature » historique (phase 2) : acceptee',
      verdict(seules({ cle: 'puce', signature: signer(CHAMPS, PUCE.privateKey) }), CHAMPS, SEULE_PUCE).ok);
    const secours = seules({ cle: 'secours', signature: signer(CHAMPS, SECOURS.privateKey) });
    const vs = verdict(secours, CHAMPS, TROIS);
    check('la cle de secours Ed25519 suffit (poste de construction perdu)', vs.ok && vs.cle === 'secours', vs.raison);
    check('… et ne couvre plus rien des qu un octet change',
      !verdict({ ...secours, taille: 1 }, { ...CHAMPS, taille: 1 }, TROIS).ok);
    const parmi = {
      ...declaration(CHAMPS, AUTRE.privateKey),
      signatures: [
        { cle: 'inconnue', signature: signer(CHAMPS, AUTRE.privateKey) },
        { cle: 'puce', signature: signer(CHAMPS, PUCE.privateKey) },
      ],
    };
    check('une signature de confiance parmi d autres inconnues suffit', verdict(parmi, CHAMPS, SEULE_PUCE).ok);
    const aucune = { ...declaration(CHAMPS, AUTRE.privateKey), signatures: [{ signature: signer(CHAMPS, AUTRE.privateKey) }] };
    const va = verdict(aucune, CHAMPS, TROIS);
    check('aucune de confiance : refusee', !va.ok && /trusted key/.test(va.raison), va.raison);
    check('une signature Ed25519 ne passe pas pour une RSA',
      !verdict(seules({ signature: signer(CHAMPS, SECOURS.privateKey) }), CHAMPS, [TROIS[0]]).ok);
    check('… ni une RSA pour une Ed25519', !verdict(declaration(), CHAMPS, [TROIS[2]]).ok);
    check('« cle » n est qu une etiquette : rien ne s y fie',
      verdict(seules({ cle: 'certificat', signature: signer(CHAMPS, PUCE.privateKey) }), CHAMPS, SEULE_PUCE).ok);
  }

  console.log('\n=== Des « signatures » mal formees ===');
  {
    const bonne = signer(CHAMPS);
    for (const [nom, signatures] of [
      ['un objet', { signature: bonne }], ['un texte', bonne], ['null', null],
      ['un element null', [null]], ['un element texte', [bonne]],
      ['un element sans signature', [{ cle: 'puce' }]],
      ['une signature vide', [{ signature: '' }]], ['une signature hors base64', [{ signature: '%%%%' }]],
      [`plus de ${SIGNATURES_MAX}`, Array.from({ length: SIGNATURES_MAX + 1 }, () => ({ signature: bonne }))],
    ]) {
      // Meme a cote d'une « signature » historique valide : une declaration a moitie
      // fausse ne sort pas de notre construction.
      const v = verdict({ ...declaration(), signatures });
      check(`${nom} : refusee`, !v.ok && /malformed/.test(v.raison), v.raison);
    }
    const vide = verdict(seules());
    check('un tableau vide, sans « signature » : refusee', !vide.ok && /malformed/.test(vide.raison), vide.raison);
    check(`${SIGNATURES_MAX} signatures : admises`,
      verdict({ ...declaration(), signatures: Array.from({ length: SIGNATURES_MAX }, () => ({ signature: bonne })) }).ok);
    check('« signature » abimee a cote de « signatures » valides : refusee',
      !verdict({ ...declaration(), signature: '%%%%', signatures: [{ signature: bonne }] }).ok);
  }

  console.log('\n=== Les postes 2.30.0 a 2.36.0, avec LEUR code ===');
  {
    /*
     * Ces postes ne lisent que « signature », avec leurs cles : tant qu'il en reste un,
     * chaque declaration doit leur convenir, ou ils ne se mettront plus jamais a jour.
     * scripts/publier.mjs les consulte donc a chaque version, par une copie de leur code.
     */
    const source = fs.readFileSync(COPIE_ANTERIEURE, 'utf8').replace(/\r\n/g, '\n');
    check('la copie est intacte (authenticite.js du commit a17b515, livre de la 2.30.0 a la 2.36.0)',
      crypto.createHash('sha256').update(source).digest('hex')
        === 'b81b6b72aaee71c315e75bfed847c8a08ec01cc30cad1ca38cb32b47f0f46fbc');
    const chezEux = (d, cles = CLES_TEST) => anterieure.verifierDeclaration(d, CHAMPS, { cles });
    check('la declaration de transition leur convient', chezEux(transition()).ok);
    check('sans « signature » historique, ils la refusent',
      !chezEux(seules({ cle: 'puce', signature: signer(CHAMPS, PUCE.privateKey) }), TROIS).ok);
    check('une « signature » qui n est pas de leur cle, ils la refusent', !chezEux(declaration(CHAMPS, PUCE.privateKey)).ok);
    check('leurs cles sont celles du certificat, et elles seules',
      anterieure.CLES.length === 1 && anterieure.CLES[0].pem === CLES.find((c) => c.role === 'certificat')?.pem);
  }

  console.log('\n=== Ce que la publication exige (ses trois lecteurs) ===');
  {
    const { verdictsDePublication } = await import(pathToFileURL(path.join(SCRIPTS, 'declaration.mjs')).href);
    const avecRoles = [{ ...TROIS[0], role: 'certificat' }, { ...TROIS[1], role: 'puce' }, { ...TROIS[2], role: 'secours' }];
    const actuelle = (cles) => ({
      CLES: cles,
      verifierDeclaration: (d, attendu, options) => verifierDeclaration(d, attendu, { cles: options?.cles ?? cles }),
    });
    const chezEux = { verifierDeclaration: (d, attendu) => anterieure.verifierDeclaration(d, attendu, { cles: CLES_TEST }) };
    const refus = (d, { reel = CHAMPS, manifeste = CHAMPS, cles = avecRoles } = {}) =>
      verdictsDePublication(d, { reel, manifeste }, actuelle(cles), chezEux).filter(([, v]) => !v.ok).map(([l]) => l);

    const tous = verdictsDePublication(transition(), { reel: CHAMPS, manifeste: CHAMPS }, actuelle(avecRoles), chezEux);
    check('la declaration de transition : six verdicts, tous favorables',
      tous.length === 6 && tous.every(([, v]) => v.ok), JSON.stringify(tous));
    const sansPuce = refus(declaration());
    check('sans la signature de la puce : refusee par « la puce seule »',
      sansPuce.length === 2 && sansPuce.every((l) => l.startsWith('la puce seule')), sansPuce.join(' | '));
    const sansHistorique = refus(seules({ cle: 'puce', signature: signer(CHAMPS, PUCE.privateKey) }));
    check('sans la signature historique : refusee par les postes 2.30.0 a 2.36.0',
      sansHistorique.length === 2 && sansHistorique.every((l) => l.startsWith('postes 2.30.0')), sansHistorique.join(' | '));
    const pasDePuce = refus(transition(), { cles: avecRoles.filter((c) => c.role !== 'puce') });
    check('aucune cle « puce » epinglee : refusee', pasDePuce.some((l) => l.startsWith('la puce seule')), pasDePuce.join(' | '));
    const reconstruit = refus(transition(), { reel: { ...CHAMPS, taille: CHAMPS.taille + 1 } });
    check('un paquet reconstruit apres la signature : refuse par les trois lecteurs',
      reconstruit.length === 3 && reconstruit.every((l) => l.endsWith('paquet réel')), reconstruit.join(' | '));
    const horsManifeste = refus(transition(), { manifeste: null });
    check('une version absente du manifeste : refusee par les trois lecteurs',
      horsManifeste.length === 3 && horsManifeste.every((l) => l.endsWith('manifeste')), horsManifeste.join(' | '));
  }

  console.log('\n=== La note de la cle de secours (scripts/secours.mjs) ===');
  {
    const s = await import(pathToFileURL(path.join(SCRIPTS, 'secours.mjs')).href);
    const phrase = 'cheval agrafe lune parapluie';  // fictive
    const note = s.chiffrerCleDeSecours(SECOURS.privateKey, phrase);
    check('une ligne ASCII, six parties', /^[\x21-\x7e]+$/.test(note) && note.split(':').length === 6, note.slice(0, 40));
    const relue = s.dechiffrerCleDeSecours(note, phrase);
    check('relue avec sa phrase : la meme cle', crypto.createPublicKey(relue).export({ type: 'spki', format: 'der' })
      .equals(SECOURS.publicKey.export({ type: 'spki', format: 'der' })));
    const d = seules({ cle: 'secours', signature: s.signerAvecLeSecours(relue, messageSigne(CHAMPS)) });
    check('ce qu elle signe passe chez l application', verdict(d, CHAMPS, [TROIS[2]]).ok);
    const raison = (n, p = phrase) => { try { s.dechiffrerCleDeSecours(n, p); return null; } catch (e) { return e.message; } };
    const refusee = (n, p) => raison(n, p) !== null;
    check('phrase fausse : refusee', refusee(note, `${phrase}!`));
    const parties = note.split(':');
    const abimee = (i) => parties.map((p, j) => (j === i ? (p[0] === 'A' ? 'B' : 'A') + p.slice(1) : p)).join(':');
    check('un caractere change dans le sel, l iv, l etiquette ou le chiffre : refusee',
      [2, 3, 4, 5].every((i) => refusee(abimee(i))));
    check('entete inconnue : refusee', refusee(note.replace('alcora-secours-1', 'alcora-secours-2')));
    check('parametres demesures : refuses avant tout calcul',
      /hors bornes/.test(raison(note.replace(/scrypt-\d+/, 'scrypt-30')) ?? ''));
    const autre = s.chiffrerCleDeSecours(SECOURS.privateKey, phrase).split(':');
    check('chaque note a son sel et son iv', autre[2] !== parties[2] && autre[3] !== parties[3]);
    check('les espaces autour de la note collee sont sans effet', !refusee(`  ${note}\n`));
    check('la phrase en Unicode decompose est la meme phrase',
      !refusee(s.chiffrerCleDeSecours(SECOURS.privateKey, 'clé de café du matin'), 'clé de café du matin'));
    // Ce que rend une copie depuis Proton Pass (contenus fictifs).
    check('la note se retrouve dans une copie avec titre, retours a la ligne et texte apres',
      s.extraireNote(`Alcora — clé de secours\r\n\r\n${note}\r\nModifiée le 24.10.2026\n`) === note);
    check('… et dans une copie de la seule ligne', s.extraireNote(note) === note && s.ecartDeNote(` ${note}\n`, note) === null);
    check('pas de note dans un autre texte', s.extraireNote('Alcora — PIN de la puce\n1234-5678') === null);
    check('une note collee a du texte n est pas extraite a moitie', s.extraireNote(`Note:${note}`) === null);
    const ecart = (copie) => s.ecartDeNote(copie, note) ?? '';
    check('diagnostic : presse-papiers vide', /vide/.test(ecart('  \n')));
    check('diagnostic : autre texte, sans le montrer',
      /Rien de la clé/.test(ecart('mot-de-passe-fictif')) && !ecart('mot-de-passe-fictif').includes('fictif'));
    check('diagnostic : ligne abimee', /tronquée ou abîmée/.test(ecart(note.replace('scrypt', 'scr ypt'))));
    // Le cas du 24.10.2026 : le titre de la note reprenait le nom, la cle masquee n'etait pas copiee.
    check('diagnostic : un titre qui reprend le nom n est pas une ligne abimee',
      /pas dans ce qui a été copié/.test(ecart('alcora-secours-1 - Clé de secours d’Alcora — texte fictif')));
    check('diagnostic : ligne coupee', /incomplète/.test(ecart(note.slice(0, -5))));
    check('diagnostic : une autre cle de secours', /pas celle de ce lancement/.test(ecart(autre.join(':'))));

    let courte = false;
    try { s.chiffrerCleDeSecours(SECOURS.privateKey, 'x'.repeat(s.PHRASE_MIN - 1)); } catch { courte = true; }
    check(`une phrase de moins de ${s.PHRASE_MIN} caracteres : refusee`, courte);
    let rsa = false;
    try { s.chiffrerCleDeSecours(NOTRE.privateKey, phrase); } catch { rsa = true; }
    check('une cle qui n est pas Ed25519 : refusee', rsa);
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
