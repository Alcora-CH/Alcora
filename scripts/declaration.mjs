/**
 * La declaration signee d'un paquet de mise a jour — voir v2/desktop/authenticite.js pour
 * le pourquoi.
 *
 * La cle privee reste dans le magasin de Windows : on la designe par l'empreinte du
 * certificat, comme le fait deja la signature des executables, et c'est Windows qui signe.
 * Aucun mot de passe, aucune cle exportee.
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
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
 * Signe des octets avec la cle du certificat (RSA, SHA-256, PKCS#1 v1.5).
 *
 * Le message passe par un fichier et l'empreinte par l'environnement : rien a echapper
 * dans une ligne de commande.
 *
 * @param {string} empreinteCertificat
 * @param {Buffer} message
 * @returns {string} signature en base64
 */
export function signerAvecLeCertificat(empreinteCertificat, message) {
  const atelier = mkdtempSync(path.join(os.tmpdir(), 'alcora-declaration-'));
  try {
    const fichier = path.join(atelier, 'message.bin');
    writeFileSync(fichier, message);
    const script = [
      "$ErrorActionPreference = 'Stop'",
      "$cert = Get-Item ('Cert:\\CurrentUser\\My\\' + $env:ALCORA_EMPREINTE)",
      '$rsa = [System.Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPrivateKey($cert)',
      "if (-not $rsa) { throw 'cle privee inaccessible' }",
      '$octets = [IO.File]::ReadAllBytes($env:ALCORA_MESSAGE)',
      '$sig = $rsa.SignData($octets, [Security.Cryptography.HashAlgorithmName]::SHA256,'
        + ' [Security.Cryptography.RSASignaturePadding]::Pkcs1)',
      '[Convert]::ToBase64String($sig)',
    ].join('\n');
    const r = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], {
      env: { ...process.env, ALCORA_EMPREINTE: empreinteCertificat, ALCORA_MESSAGE: fichier },
      encoding: 'utf8',
      windowsHide: true,
    });
    const signature = (r.stdout ?? '').trim();
    if (r.status !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(signature)) {
      throw new Error(`signature impossible : ${(r.stderr || r.stdout || r.error?.message || '').trim()}`);
    }
    return signature;
  } finally {
    rmSync(atelier, { recursive: true, force: true });
  }
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
