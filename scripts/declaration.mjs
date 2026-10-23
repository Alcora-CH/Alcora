/**
 * La declaration signee d'un paquet de mise a jour — voir v2/desktop/authenticite.js pour
 * le pourquoi.
 *
 * La cle privee reste dans le magasin de Windows : on la designe par l'empreinte du
 * certificat, comme le fait deja la signature des executables, et c'est Windows qui signe.
 * Aucun mot de passe, aucune cle exportee.
 *
 * Depuis la 2.37.0, la publication y ajoute la signature de la PUCE (TPM) : une cle nee
 * dans la puce du poste de construction (scripts/cle-tpm.mjs), qui n'en sort pas, et dont
 * Windows demande le PIN a chaque signature.
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** Empreinte SHA-256 d'un fichier, en majuscules — la forme du manifeste. */
export function empreinteFichier(fichier) {
  return new Promise((resoudre, rejeter) => {
    const h = createHash('sha256');
    createReadStream(fichier)
      .on('data', (c) => h.update(c))
      .on('end', () => resoudre(h.digest('hex').toUpperCase()))
      .on('error', rejeter);
  });
}

/**
 * Fait signer des octets par Windows (RSA, SHA-256, PKCS#1 v1.5) : le script PowerShell
 * lit le message dans $env:ALCORA_MESSAGE et rend la signature en base64.
 *
 * Le message passe par un fichier et le reste par l'environnement : rien a echapper dans
 * une ligne de commande.
 */
function signerParWindows(script, env, message, { delai } = {}) {
  const atelier = mkdtempSync(path.join(os.tmpdir(), 'alcora-declaration-'));
  try {
    const fichier = path.join(atelier, 'message.bin');
    writeFileSync(fichier, message);
    const r = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], {
      env: { ...process.env, ...env, ALCORA_MESSAGE: fichier },
      encoding: 'utf8',
      windowsHide: true,
      timeout: delai,
    });
    const signature = (r.stdout ?? '').trim();
    if (r.status !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(signature)) {
      const pourquoi = r.error?.code === 'ETIMEDOUT' ? 'delai depasse' : (r.stderr || r.stdout || r.error?.message || '');
      throw new Error(`signature impossible : ${pourquoi.trim()}`);
    }
    return signature;
  } finally {
    rmSync(atelier, { recursive: true, force: true });
  }
}

const SIGNER = '$sig = $rsa.SignData($octets, [Security.Cryptography.HashAlgorithmName]::SHA256,'
  + ' [Security.Cryptography.RSASignaturePadding]::Pkcs1)';

/**
 * Signe des octets avec la cle du certificat.
 *
 * @param {string} empreinteCertificat
 * @param {Buffer} message
 * @returns {string} signature en base64
 */
export function signerAvecLeCertificat(empreinteCertificat, message) {
  return signerParWindows([
    "$ErrorActionPreference = 'Stop'",
    "$cert = Get-Item ('Cert:\\CurrentUser\\My\\' + $env:ALCORA_EMPREINTE)",
    '$rsa = [System.Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPrivateKey($cert)',
    "if (-not $rsa) { throw 'cle privee inaccessible' }",
    '$octets = [IO.File]::ReadAllBytes($env:ALCORA_MESSAGE)',
    SIGNER,
    '[Convert]::ToBase64String($sig)',
  ].join('\n'), { ALCORA_EMPREINTE: empreinteCertificat }, message);
}

/** La cle de la puce, chez le fournisseur de la plateforme, dans le compte courant. */
export const NOM_CLE_PUCE = 'Alcora-declaration';
export const FOURNISSEUR_PUCE = 'Microsoft Platform Crypto Provider';

/**
 * La fenetre du PIN s'attache a la fenetre au premier plan — le terminal qui publie —
 * plutot que de s'ouvrir derriere lui.
 */
export const FENETRE_AU_PREMIER_PLAN = [
  "Add-Type -Namespace Alcora -Name Fenetre -MemberDefinition '[DllImport(\"user32.dll\")] public static extern System.IntPtr GetForegroundWindow();'",
  '$premierPlan = [Alcora.Fenetre]::GetForegroundWindow()',
].join('\n');

/**
 * Signe des octets avec la cle de la puce. Windows demande le PIN : la signature l'attend
 * cinq minutes au plus. Trop d'essais faux et la puce se verrouille un moment — c'est sa
 * protection, pas une panne.
 *
 * @param {Buffer} message
 * @param {{ nom?: string }} [options]  une autre cle, pour les essais seulement
 * @returns {string} signature en base64
 */
export function signerAvecLaPuce(message, { nom = NOM_CLE_PUCE } = {}) {
  return signerParWindows([
    "$ErrorActionPreference = 'Stop'",
    '$pcp = [System.Security.Cryptography.CngProvider]::new($env:ALCORA_FOURNISSEUR)',
    'if (-not [System.Security.Cryptography.CngKey]::Exists($env:ALCORA_CLE, $pcp)) {',
    "  throw ('cle de la puce introuvable (' + $env:ALCORA_CLE + ') : lancer node scripts/cle-tpm.mjs')",
    '}',
    FENETRE_AU_PREMIER_PLAN,
    '$cle = [System.Security.Cryptography.CngKey]::Open($env:ALCORA_CLE, $pcp)',
    'try {',
    '  $cle.ParentWindowHandle = $premierPlan',
    '  $rsa = [System.Security.Cryptography.RSACng]::new($cle)',
    '  $octets = [IO.File]::ReadAllBytes($env:ALCORA_MESSAGE)',
    `  ${SIGNER}`,
    '  [Convert]::ToBase64String($sig)',
    '} finally { $cle.Dispose() }',
  ].join('\n'), { ALCORA_CLE: nom, ALCORA_FOURNISSEUR: FOURNISSEUR_PUCE }, message, { delai: 5 * 60_000 });
}

/** Ce que couvre chaque signature d'une declaration. */
export const champsSignes = ({ paquet, version, fichier, taille, sha256 }) => ({ paquet, version, fichier, taille, sha256 });

/**
 * Ajoute (ou remplace) la signature de la puce dans une declaration ecrite par la
 * construction. Elle doit convaincre l'application A ELLE SEULE, avec la seule cle de la
 * puce epinglee : sinon la cle epinglee n'est pas celle de cette puce, et la migration
 * n'aurait lieu qu'en apparence.
 *
 * @returns {{ cle: string }}
 */
export function signerLaDeclarationAvecLaPuce({ requireDesktop, fichier }) {
  const { CLES, FORMAT, messageSigne, verifierDeclaration } = requireDesktop('./authenticite.js');
  const puce = CLES.filter((c) => c.role === 'puce');
  if (!puce.length) throw new Error('aucune cle de role « puce » dans CLES (v2/desktop/authenticite.js)');
  const declaration = JSON.parse(readFileSync(fichier, 'utf8'));
  const champs = champsSignes(declaration);
  const signature = signerAvecLaPuce(messageSigne(champs));
  const seule = verifierDeclaration({ format: FORMAT, ...champs, signatures: [{ cle: 'puce', signature }] }, champs,
    { cles: puce });
  if (!seule.ok) throw new Error(`la signature de la puce n'est pas celle de la cle epinglee : ${seule.raison}`);
  const autres = Array.isArray(declaration.signatures) ? declaration.signatures.filter((s) => s?.cle !== 'puce') : [];
  writeFileSync(fichier, `${JSON.stringify({ ...declaration, signatures: [...autres, { cle: 'puce', signature }] }, null, 2)}\n`,
    'utf8');
  return { cle: seule.cle };
}

/**
 * Ce que diraient de la declaration ceux qui la liront, contre le paquet reel et contre
 * l'entree du manifeste (voir scripts/publier.mjs) : chacun doit l'accepter.
 *
 * @param {object} declaration
 * @param {{ reel: object, manifeste: object | null }} attendus
 * @param {{ CLES: object[], verifierDeclaration: Function }} actuelle    authenticite.js
 * @param {{ verifierDeclaration: Function }} anterieure  la copie figee des postes 2.30.0 a 2.36.0
 * @returns {[string, { ok: boolean, raison?: string, cle?: string }][]}
 */
export function verdictsDePublication(declaration, { reel, manifeste }, actuelle, anterieure) {
  const puce = actuelle.CLES.filter((c) => c.role === 'puce');
  const verdicts = [];
  for (const [lecteur, verifier] of [
    ['cette version', (attendu) => actuelle.verifierDeclaration(declaration, attendu)],
    ['la puce seule', (attendu) => (puce.length
      ? actuelle.verifierDeclaration(declaration, attendu, { cles: puce })
      : { ok: false, raison: 'aucune cle de role « puce » dans CLES' })],
    ['postes 2.30.0 à 2.36.0', (attendu) => anterieure.verifierDeclaration(declaration, attendu)],
  ]) {
    verdicts.push([`${lecteur}, paquet réel`, verifier(reel)]);
    verdicts.push([`${lecteur}, manifeste`, manifeste
      ? verifier(manifeste) : { ok: false, raison: 'version absente de releases.win.json' }]);
  }
  return verdicts;
}

/**
 * Ecrit la declaration a cote du paquet, apres l'avoir fait relire par le code MEME de
 * l'application, avec ses cles epinglees : une declaration que les postes refuseraient
 * (certificat change, cle publique oubliee) arrete la construction au lieu de partir.
 *
 * @returns {Promise<{ sortie: string, cle: string }>}
 */
export async function ecrireDeclaration({ requireDesktop, empreinteCertificat, paquet, version, fichier }) {
  const { FORMAT, messageSigne, nomDeclaration, verifierDeclaration } = requireDesktop('./authenticite.js');
  const champs = {
    paquet,
    version,
    fichier: path.basename(fichier),
    taille: statSync(fichier).size,
    sha256: await empreinteFichier(fichier),
  };
  const signature = signerAvecLeCertificat(empreinteCertificat, messageSigne(champs));
  const declaration = { format: FORMAT, ...champs, signature };

  const verdict = verifierDeclaration(declaration, champs);
  if (!verdict.ok) {
    throw new Error(`declaration refusee par l'application elle-meme : ${verdict.raison}`);
  }
  const sortie = path.join(path.dirname(fichier), nomDeclaration(paquet, version));
  writeFileSync(sortie, `${JSON.stringify(declaration, null, 2)}\n`, 'utf8');
  return { sortie, cle: verdict.cle };
}
