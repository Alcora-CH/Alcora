/**
 * Cree la cle de la PUCE (TPM) qui signe chaque version a la publication — une fois, sur
 * le poste de construction, dans le compte Windows qui publie. Voir
 * v2/desktop/authenticite.js et scripts/declaration.mjs.
 *
 *   node scripts/cle-tpm.mjs      depuis la racine
 *
 * La cle NAIT dans la puce et n'en sort pas (non exportable). Windows demande d'en choisir
 * le PIN a la creation, puis le redemande a chaque signature. Avant d'ecrire la cle
 * publique (signature/cle-tpm-publique.pem, a epingler dans CLES), le script prouve :
 * qu'elle est bien dans la puce, que sa partie privee refuse de sortir, qu'une signature
 * SANS PIN est refusee, et qu'une signature avec le PIN — par le chemin meme de la
 * publication — est acceptee par l'application.
 *
 * Relance sur une cle deja creee : rien n'est recree, les preuves sont refaites.
 */

import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FENETRE_AU_PREMIER_PLAN, FOURNISSEUR_PUCE, NOM_CLE_PUCE, signerAvecLaPuce } from './declaration.mjs';
import { empreintePublique } from './secours.mjs';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sortie = path.join(racine, 'signature', 'cle-tpm-publique.pem');
const requireDesktop = createRequire(path.join(racine, 'v2', 'desktop', 'package.json'));
const { FORMAT, messageSigne, verifierDeclaration } = requireDesktop('./authenticite.js');

const CNG = 'System.Security.Cryptography';
const ENV = {
  ALCORA_CLE: NOM_CLE_PUCE,
  ALCORA_FOURNISSEUR: FOURNISSEUR_PUCE,
  ALCORA_NOM_LISIBLE: 'Alcora — signature des versions',
  ALCORA_DESCRIPTION: 'Le PIN de la puce, demandé à chaque publication d’Alcora.',
  ALCORA_TITRE: 'Alcora — choisir le PIN de la puce',
};

function powershell(script) {
  const r = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command',
    `$ErrorActionPreference = 'Stop'\n$pcp = [${CNG}.CngProvider]::new($env:ALCORA_FOURNISSEUR)\n${script}`], {
    env: { ...process.env, ...ENV }, encoding: 'utf8', windowsHide: true, timeout: 5 * 60_000,
  });
  return { ok: r.status === 0, sortie: (r.stdout ?? '').trim(), erreur: (r.stderr || r.error?.message || '').trim() };
}

function arreter(message) {
  console.error(`\n${message}`);
  process.exit(1);
}

// 1. Creer la cle — ou ouvrir celle qui existe — et lire ce qu'elle est.
console.log(`Clé « ${NOM_CLE_PUCE} » dans la puce (${FOURNISSEUR_PUCE})…`);
const lecture = powershell(`${FENETRE_AU_PREMIER_PLAN}
$creee = $false
if (-not [${CNG}.CngKey]::Exists($env:ALCORA_CLE, $pcp)) {
  $p = [${CNG}.CngKeyCreationParameters]::new()
  $p.Provider = $pcp
  $p.KeyUsage = [${CNG}.CngKeyUsages]::Signing
  $p.ExportPolicy = [${CNG}.CngExportPolicies]::None
  $p.UIPolicy = [${CNG}.CngUIPolicy]::new([${CNG}.CngUIProtectionLevels]::ForceHighProtection,
    $env:ALCORA_NOM_LISIBLE, $env:ALCORA_DESCRIPTION, $null, $env:ALCORA_TITRE)
  $p.ParentWindowHandle = $premierPlan
  $p.Parameters.Add([${CNG}.CngProperty]::new('Length', [BitConverter]::GetBytes([int]2048), [${CNG}.CngPropertyOptions]::None))
  $cle = [${CNG}.CngKey]::Create([${CNG}.CngAlgorithm]::Rsa, $env:ALCORA_CLE, $p)
  $creee = $true
} else {
  $cle = [${CNG}.CngKey]::Open($env:ALCORA_CLE, $pcp)
}
try {
  $rsa = [${CNG}.RSACng]::new($cle)
  $pub = $rsa.ExportParameters($false)
  $privee = $true
  try { $null = $rsa.ExportParameters($true) } catch { $privee = $false }
  $protection = 'illisible'
  try { $protection = [string]$cle.UIPolicy.ProtectionLevel } catch {}
  [ordered]@{
    creee = $creee
    fournisseur = $cle.Provider.Provider
    taille = $cle.KeySize
    exportation = [string]$cle.ExportPolicy
    priveeExportable = $privee
    protection = $protection
    n = [Convert]::ToBase64String($pub.Modulus)
    e = [Convert]::ToBase64String($pub.Exponent)
  } | ConvertTo-Json -Compress
} finally { $cle.Dispose() }`);
if (!lecture.ok) arreter(`La puce n'a pas créé (ou ouvert) la clé :\n  ${lecture.erreur}`);
const cle = JSON.parse(lecture.sortie);
console.log(cle.creee ? '  créée (le PIN est choisi).' : '  elle existait déjà : rien n\'est recréé.');

const b64url = (b) => b.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const pem = crypto.createPublicKey({ key: { kty: 'RSA', n: b64url(cle.n), e: b64url(cle.e) }, format: 'jwk' })
  .export({ type: 'spki', format: 'pem' });

// 2. Une signature SANS PIN doit etre refusee — dans un autre processus, ou rien ne reste
//    en memoire de la creation.
const silence = powershell(`$cle = [${CNG}.CngKey]::Open($env:ALCORA_CLE, $pcp, [${CNG}.CngKeyOpenOptions]::Silent)
try {
  $null = [${CNG}.RSACng]::new($cle).SignData([byte[]](1, 2, 3), [Security.Cryptography.HashAlgorithmName]::SHA256,
    [Security.Cryptography.RSASignaturePadding]::Pkcs1)
  'signee sans PIN'
} finally { $cle.Dispose() }`);
const sansPinRefusee = !silence.ok;

const preuves = [
  ['dans la puce', cle.fournisseur === FOURNISSEUR_PUCE, cle.fournisseur],
  ['RSA 2048', cle.taille === 2048, String(cle.taille)],
  ['exportation interdite', cle.exportation === 'None' && !cle.priveeExportable,
    `${cle.exportation}, privée exportable : ${cle.priveeExportable}`],
  ['PIN exigé (protection forte)', cle.protection === 'ForceHighProtection', cle.protection],
  ['une signature sans PIN est refusée', sansPinRefusee, silence.sortie || silence.erreur],
];

// 3. Une signature AVEC le PIN, par le chemin de la publication, acceptee par l'application.
if (preuves.every(([, ok]) => ok)) {
  console.log('\nWindows demande maintenant le PIN de la puce, pour une signature d\'essai…');
  const champs = { paquet: 'Alcora', version: '0.0.0-essai', fichier: 'essai-fictif.nupkg', taille: 1, sha256: 'A'.repeat(64) };
  try {
    const signature = signerAvecLaPuce(messageSigne(champs));
    const d = { format: FORMAT, ...champs, signatures: [{ cle: 'puce', signature }] };
    const cles = [{ nom: 'puce', pem }];
    preuves.push(['signée avec le PIN : acceptée par l\'application', verifierDeclaration(d, champs, { cles }).ok, '']);
    preuves.push(['… et refusée dès qu\'un octet change',
      !verifierDeclaration({ ...d, taille: 2 }, { ...champs, taille: 2 }, { cles }).ok, '']);
  } catch (e) {
    preuves.push(['signée avec le PIN', false, e.message]);
  }
}

console.log('');
for (const [nom, ok, detail] of preuves) console.log(`${ok ? '  OK   ' : '  NON  '} ${nom}${ok ? '' : ` — ${detail}`}`);
if (!preuves.every(([, ok]) => ok)) {
  const defaut = preuves.slice(0, 5).some(([, ok]) => !ok);
  if (defaut && cle.creee) {
    const effacement = powershell(`[${CNG}.CngKey]::Open($env:ALCORA_CLE, $pcp).Delete()`);
    console.error(effacement.ok ? '\nLa clé ne tient pas ses promesses : elle vient d\'être effacée.'
      : `\nLa clé ne tient pas ses promesses, et son effacement a échoué : ${effacement.erreur}`);
  }
  arreter('Rien n\'est épinglé.');
}

writeFileSync(sortie, pem, 'utf8');
console.log('\nClé de la puce prête.');
console.log(`Clé publique : ${path.relative(racine, sortie)}`);
console.log(`Empreinte    : ${empreintePublique(pem)}`);
