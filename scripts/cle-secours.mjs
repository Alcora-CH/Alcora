/**
 * Cree la cle de SECOURS — une fois, sur le poste de construction. Voir scripts/secours.mjs.
 *
 *   node scripts/cle-secours.mjs      depuis la racine, dans un terminal
 *
 * Demande une phrase de passe (deux fois), engendre la cle, la chiffre et la pose dans le
 * presse-papiers, hors de l'historique de Windows, pour une note securisee de Proton Pass.
 * Puis fait RECOPIER la note depuis Proton Pass et retaper la phrase : la cle n'est
 * epinglee que si ce qui est range se dechiffre vraiment. Rien de prive ne touche le
 * disque ; seule la cle publique s'ecrit, dans signature/cle-secours-publique.pem.
 */

import crypto from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { attendreEntree, copier, demanderCache, lirePressePapiers, viderPressePapiers } from './saisie.mjs';
import {
  PHRASE_MIN, chiffrerCleDeSecours, dechiffrerCleDeSecours, empreintePublique, pemPublique, signerAvecLeSecours,
} from './secours.mjs';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sortie = path.join(racine, 'signature', 'cle-secours-publique.pem');

if (existsSync(sortie)) {
  console.error(`Une clé de secours existe déjà : ${path.relative(racine, sortie)}.`);
  console.error('En refaire une, c\'est aussi retirer l\'ancienne de CLES (v2/desktop/authenticite.js) — à décider, pas à lancer par mégarde.');
  process.exit(1);
}

console.log('Clé de secours d\'Alcora — elle signera une version si ce poste et sa puce étaient perdus.\n');
console.log(`Choisis une phrase de passe (${PHRASE_MIN} caractères au moins). Garde-la AILLEURS que dans`);
console.log('la note Proton Pass : la note seule ne doit rien ouvrir.\n');

let phrase = null;
for (let essai = 0; essai < 3 && !phrase; essai++) {
  const une = await demanderCache('Phrase de passe : ');
  if ([...une].length < PHRASE_MIN) { console.log(`  Trop courte : ${PHRASE_MIN} caractères au moins.\n`); continue; }
  const deux = await demanderCache('La même, encore : ');
  if (une !== deux) { console.log('  Les deux ne sont pas identiques.\n'); continue; }
  phrase = une;
}
if (!phrase) { console.error('Rien n\'a été créé.'); process.exit(1); }

const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
const note = chiffrerCleDeSecours(privateKey, phrase);

// La note se relit-elle, ici, avant d'aller ou que ce soit ?
const essai = Buffer.from('alcora: essai de la cle de secours');
const relue = dechiffrerCleDeSecours(note, phrase);
let fausseRefusee = false;
try { dechiffrerCleDeSecours(note, `${phrase}x`); } catch { fausseRefusee = true; }
if (!crypto.verify(null, essai, publicKey, Buffer.from(signerAvecLeSecours(relue, essai), 'base64')) || !fausseRefusee) {
  console.error('La note ne se relit pas comme elle le devrait — rien n\'a été créé.');
  process.exit(1);
}

copier(note);
console.log('\nLa clé chiffrée est dans le presse-papiers (une ligne, hors de l\'historique de Windows).');
console.log('Dans Proton Pass : nouvelle note sécurisée « Alcora — clé de secours », colle, enregistre.');
await attendreEntree('Puis appuie sur Entrée… ');
viderPressePapiers();

let rangee = false;
for (let tour = 0; tour < 3 && !rangee; tour++) {
  console.log('\nMaintenant, depuis Proton Pass, COPIE le contenu de cette note.');
  await attendreEntree('Puis Entrée… ');
  const copiee = lirePressePapiers();
  viderPressePapiers();
  if (copiee !== note) {
    console.log(copiee ? '  Ce n\'est pas la même ligne — la note est-elle complète ?' : '  Le presse-papiers est vide.');
    continue;
  }
  try {
    dechiffrerCleDeSecours(copiee, await demanderCache('Et la phrase de passe, une dernière fois : '));
    rangee = true;
  } catch (e) {
    console.log(`  ${e.message}.`);
  }
}
if (!rangee) {
  console.error('\nLa note rangée n\'a pas été relue : rien n\'est épinglé. Supprime la note de Proton Pass et relance.');
  process.exit(1);
}

const pem = pemPublique(publicKey);
writeFileSync(sortie, pem, 'utf8');
console.log('\nClé de secours prête : la note de Proton Pass se relit, avec la phrase de passe.');
console.log(`Clé publique : ${path.relative(racine, sortie)}`);
console.log(`Empreinte    : ${empreintePublique(pem)}`);
