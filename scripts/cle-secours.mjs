/**
 * Cree la cle de SECOURS — une fois, sur le poste de construction. Voir scripts/secours.mjs.
 *
 *   node scripts/cle-secours.mjs                depuis la racine, dans un terminal
 *   node scripts/cle-secours.mjs --reprendre    la note est rangee, seule manque la cle publique
 *
 * Demande une phrase de passe (deux fois), engendre la cle, la chiffre et la pose dans le
 * presse-papiers, hors de l'historique de Windows, pour une note securisee de Proton Pass.
 * Puis fait RECOPIER la note depuis Proton Pass et retaper la phrase : la cle n'est
 * epinglee que si ce qui est range se dechiffre vraiment, et la cle publique ecrite est
 * celle de la note RELUE, pas celle gardee en memoire. Rien de prive ne touche le disque ;
 * seule la cle publique s'ecrit, dans signature/cle-secours-publique.pem.
 *
 * « --reprendre » relit la note deja rangee et en deduit la cle publique, sans rien creer :
 * pour un lancement interrompu apres le rangement (le 24.10.2026, le script est tombe la).
 */

import crypto from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { attendreEntree, copier, demanderCache, lirePressePapiers, viderPressePapiers } from './saisie.mjs';
import {
  PHRASE_MIN, chiffrerCleDeSecours, dechiffrerCleDeSecours, ecartDeNote, empreintePublique, extraireNote, pemPublique,
  signerAvecLeSecours,
} from './secours.mjs';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sortie = path.join(racine, 'signature', 'cle-secours-publique.pem');

/** Ecrit la cle publique de la cle privee relue dans la note de Proton Pass. */
function epingler(privee) {
  const pem = pemPublique(privee);
  writeFileSync(sortie, pem, 'utf8');
  console.log('\nClé de secours prête : la note de Proton Pass se relit, avec la phrase de passe.');
  console.log(`Clé publique : ${path.relative(racine, sortie)}`);
  console.log(`Empreinte    : ${empreintePublique(pem)}`);
}

async function creer() {
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
  if (!phrase) { console.error('Rien n\'a été créé.'); process.exitCode = 1; return; }

  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  const note = chiffrerCleDeSecours(privateKey, phrase);

  // La note se relit-elle, ici, avant d'aller ou que ce soit ?
  const essai = Buffer.from('alcora: essai de la cle de secours');
  const relue = dechiffrerCleDeSecours(note, phrase);
  let fausseRefusee = false;
  try { dechiffrerCleDeSecours(note, `${phrase}x`); } catch { fausseRefusee = true; }
  if (!crypto.verify(null, essai, publicKey, Buffer.from(signerAvecLeSecours(relue, essai), 'base64')) || !fausseRefusee) {
    console.error('La note ne se relit pas comme elle le devrait — rien n\'a été créé.');
    process.exitCode = 1;
    return;
  }

  copier(note);
  console.log('\nÉtape 1 — RANGER. La clé est dans le presse-papiers : une longue ligne qui commence par');
  console.log('« alcora-secours-1: » (hors de l\'historique de Windows). Elle est déjà chiffrée par ta phrase de passe :');
  console.log('c\'est elle, et elle seule, qu\'il faut ranger. Dans Proton Pass, crée une note « Alcora — clé de secours »');
  console.log('et colle-la (Ctrl + V) dans son contenu — ou dans un champ masqué —, puis enregistre.');
  // Quelques caracteres aleatoires d'une cle chiffree : de quoi la reconnaitre, rien de quoi l'ouvrir.
  const reperes = `elle commence par « ${note.slice(0, 37)}… », finit par « …${note.slice(-4)} » et compte ${note.length} caractères`;
  console.log(`La ligne à ranger, et plus tard à recopier : ${reperes}.`);
  await attendreEntree('Une fois la note enregistrée, appuie sur Entrée… ');
  viderPressePapiers();

  let depuisLaNote = null;
  for (let tour = 0; tour < 5 && !depuisLaNote; tour++) {
    console.log('\nÉtape 2 — RELIRE. Dans Proton Pass, copie la longue ligne rangée à l\'étape 1 (bouton « copier »');
    console.log('du champ masqué, ou Ctrl + A puis Ctrl + C dans le contenu) — pas le titre. Ce script l\'a fabriquée :');
    console.log('la lui rendre ne dévoile rien. Puis reviens appuyer sur Entrée sans attendre (Proton Pass peut vider');
    console.log('le presse-papiers après quelques secondes).');
    await attendreEntree('Entrée… ');
    const copiee = lirePressePapiers();
    viderPressePapiers();
    const ecart = ecartDeNote(copiee, note);
    if (ecart) {
      console.log(`  ${ecart}`);
      console.log(`  Attendu : une seule ligne — ${reperes}.`);
      const choix = await attendreEntree('  Entrée pour réessayer, ou R puis Entrée pour remettre la clé dans le presse-papiers (note pas encore créée)… ');
      if (/^r$/i.test(choix)) {
        copier(note);
        console.log('  La clé est de nouveau dans le presse-papiers : refais l\'étape 1 (colle-la dans la note, enregistre).');
        await attendreEntree('  Une fois la note enregistrée, Entrée… ');
        viderPressePapiers();
      }
      continue;
    }
    try {
      depuisLaNote = dechiffrerCleDeSecours(extraireNote(copiee), await demanderCache('Et la phrase de passe, une dernière fois : '));
    } catch (e) {
      console.log(`  ${e.message}.`);
    }
  }
  if (!depuisLaNote) {
    console.error('\nLa note rangée n\'a pas été relue : rien n\'est épinglé. Supprime la note de Proton Pass et relance.');
    process.exitCode = 1;
    return;
  }
  epingler(depuisLaNote);
}

async function reprendre() {
  console.log('Reprise : la note « Alcora — clé de secours » est rangée dans Proton Pass ; sa clé publique');
  console.log('s\'en déduit. Rien n\'est créé.\n');
  let privee = null;
  for (let tour = 0; tour < 3 && !privee; tour++) {
    console.log('Dans Proton Pass, ouvre la note, clique dans son contenu (ou le champ masqué) et copie la longue');
    console.log('ligne qui commence par « alcora-secours-1: » (Ctrl + A puis Ctrl + C, ou le bouton « copier »).');
    await attendreEntree('Puis reviens appuyer sur Entrée tout de suite… ');
    const copiee = lirePressePapiers();
    viderPressePapiers();
    const trouvee = extraireNote(copiee);
    if (!trouvee) {
      console.log(copiee ? '  La clé n\'est pas dans ce qui a été copié : une seule ligne, sans espace, de 158 caractères.\n'
        : '  Le presse-papiers est vide.\n');
      continue;
    }
    try {
      privee = dechiffrerCleDeSecours(trouvee, await demanderCache('Phrase de passe : '));
    } catch (e) {
      console.log(`  ${e.message}.\n`);
    }
  }
  if (!privee) { console.error('\nRien n\'est épinglé.'); process.exitCode = 1; return; }
  epingler(privee);
}

if (existsSync(sortie)) {
  console.error(`Une clé de secours existe déjà : ${path.relative(racine, sortie)}.`);
  console.error('En refaire une, c\'est aussi retirer l\'ancienne de CLES (v2/desktop/authenticite.js) — à décider, pas à lancer par mégarde.');
  process.exitCode = 1;
} else if (process.argv.includes('--reprendre')) {
  await reprendre();
} else {
  await creer();
}
