/**
 * Publie la version courante sur le depot de versions GitHub.
 *
 *   npm run publier        depuis la racine, APRES « npm run build »
 *
 * Volontairement separe de la construction : construire est un geste local et repetable,
 * publier expose des binaires au monde et declenche les mises a jour automatiques chez
 * tous les postes installes. Les deux ne doivent jamais se confondre.
 *
 * Le manifeste « releases.win.json » est cumulatif : celui de la DERNIERE version publiee
 * decrit toutes les versions. C'est lui que les applications installees consultent, via
 * « releases/latest/download/releases.win.json ».
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const releases = path.join(racine, 'v2', 'releases');

// Le meme depot que dans v2/desktop/maj.js — les deux doivent rester accordes.
// Renomme le 28.07.2026 avec le produit, puis transfere le 02.08.2026 a l'organisation
// alcora-ch pour detacher le projet du compte personnel. GitHub redirige durablement
// chaque ancienne adresse : aucun poste installe n'a rien a faire.
const DEPOT = 'alcora-ch/Alcora-releases';

// Source unique de l'identifiant, partagee avec build.mjs et maj.js.
const PACK_ID = JSON.parse(
  readFileSync(path.join(racine, 'v2', 'desktop', 'package.json'), 'utf8')).packId;
const GH = 'C:\\Program Files\\GitHub CLI\\gh.exe';

const version = JSON.parse(
  readFileSync(path.join(racine, 'v2', 'desktop', 'package.json'), 'utf8')).version;

if (!existsSync(GH)) {
  console.error(`GitHub CLI introuvable : ${GH}`);
  process.exit(1);
}

const obligatoires = [
  `${PACK_ID}-${version}-full.nupkg`,
  `${PACK_ID}-win-Setup.exe`,
  'releases.win.json',
];
/*
 * L'archive Linux est OPTIONNELLE, et c'est voulu.
 *
 * Elle sort d'une autre chaine (« npm run build:linux »), qui exige WSL. La publication
 * ne doit pas dependre d'un atelier que tout le monde n'a pas : si l'archive est la, elle
 * part avec le reste ; sinon la version Windows se publie seule, comme avant.
 *
 * Elle n'entre PAS dans « releases.win.json » : ce manifeste pilote la mise a jour
 * automatique de Velopack, qui ne connait que Windows. Un poste Linux ne le lit jamais.
 */
const optionnels = [
  `${PACK_ID}-${version}-delta.nupkg`,
  `${PACK_ID}-${version}-linux-x64.tar.gz`,
];

const fichiers = [];
for (const nom of obligatoires) {
  const chemin = path.join(releases, nom);
  if (!existsSync(chemin)) {
    console.error(`Fichier manquant : ${nom}\n  Lancer d'abord « npm run build ».`);
    process.exit(1);
  }
  fichiers.push(chemin);
}
for (const nom of optionnels) {
  const chemin = path.join(releases, nom);
  if (existsSync(chemin)) fichiers.push(chemin);
}

/*
 * Un depot vierge n'accepte aucune release : l'etiquette exige un commit. Au tout premier
 * passage, on y depose donc un README minimal — qui sert aussi d'ecriteau public, puisque
 * ce depot est visible de tous.
 */
let vierge = false;
try {
  execFileSync(GH, ['api', `repos/${DEPOT}/commits?per_page=1`], { stdio: 'pipe' });
} catch {
  vierge = true;
}
if (vierge) {
  console.log('Dépôt vierge : dépôt d\'un README initial…');
  const readme = [
    `# ${PACK_ID} — versions`,
    '',
    `Binaires construits d'${PACK_ID}, un client de bureau Windows pour visionner`,
    'des cameras UniFi Protect. Ce depot ne contient que les paquets publies : le code',
    'source sera publie separement.',
    '',
    `${PACK_ID} n'est ni affilie ni approuve par Ubiquiti Inc. « UniFi » et`,
    '« UniFi Protect » sont des marques de Ubiquiti Inc.',
    '',
  ].join('\n');
  try {
    execFileSync(GH, [
      'api', '-X', 'PUT', `repos/${DEPOT}/contents/README.md`,
      '-f', 'message=Initialisation du depot des versions',
      '-f', `content=${Buffer.from(readme, 'utf8').toString('base64')}`,
    ], { stdio: 'pipe' });
    console.log('README déposé.');
  } catch {
    // Si le README existe deja, le depot n'est pas vierge : on poursuit simplement.
    console.log('Initialisation ignorée (le dépôt semble déjà initialisé).');
  }
}

console.log(`Publication de la ${version} sur ${DEPOT} (${fichiers.length} fichiers)…`);

// Si l'etiquette existe deja, l'outil refuse : une version publiee ne se remplace pas,
// elle s'incremente. C'est la meme discipline que la construction locale.
execFileSync(GH, [
  'release', 'create', `v${version}`,
  '--repo', DEPOT,
  '--title', `${PACK_ID} ${version}`,
  '--notes', `Version ${version}. Voir l'historique dans l'application, écran Réglages.`,
  ...fichiers,
], { stdio: 'inherit' });

console.log(`\nPubliée. Les applications installées la verront à leur prochaine vérification.`);
