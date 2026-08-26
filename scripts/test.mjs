/**
 * Lance toutes les verifications hors ligne.
 *
 *   npm test        depuis la racine du depot
 *
 * Les tests exigeant des identifiants ou le controleur ne sont PAS inclus ici :
 * ils se lancent a la demande, voir la liste affichee a la fin.
 */

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const suites = [
  {
    nom: 'Codes à deux facteurs (vecteurs RFC 6238)',
    commande: 'node',
    args: ['test-totp.js'],
    dossier: path.join(racine, 'v2', 'desktop'),
  },
  {
    /*
     * Ajoutee le 26.08.2026, apres une configuration impossible chez un tiers : le test
     * de connexion reussissait, l'enregistrement rendait 503, et le message accusait des
     * droits qui ne manquaient pas. Deux causes opposees sous un meme code, et une
     * session ouverte trois fois en cinq secondes.
     */
    nom: 'Refus de connexion : droits ou cadence, et reprise de session',
    commande: 'node',
    args: ['test-connexion.js'],
    dossier: path.join(racine, 'v2', 'desktop'),
  },
  {
    nom: "Bornes de l'archive (frise temporelle)",
    commande: 'node',
    args: ['test-archive.js'],
    dossier: path.join(racine, 'v2', 'desktop'),
  },
  {
    nom: 'Recherche fine (plaques tolérantes, seuil, attributs)',
    commande: 'node',
    args: ['test-recherche.js'],
    dossier: path.join(racine, 'v2', 'desktop'),
  },
  {
    nom: 'Veilles : sujets, horaires, anti-répétition',
    commande: 'node',
    args: ['test-veilles.js'],
    dossier: path.join(racine, 'v2', 'desktop'),
  },
  {
    nom: 'Trames WebSocket (découpage réseau)',
    commande: 'node',
    args: ['test-websocket.js'],
    dossier: path.join(racine, 'v2', 'desktop'),
  },
  {
    nom: 'Format temps réel de Protect',
    commande: 'node',
    args: ['test-updates.js'],
    dossier: path.join(racine, 'v2', 'desktop'),
  },
  {
    nom: 'Extraits vidéo (plages, jetons, conservation)',
    commande: 'node',
    args: ['test-extraits.js'],
    dossier: path.join(racine, 'v2', 'desktop'),
  },
  {
    /*
     * La chaine de mise a jour. Ajoutee le 30.07.2026, apres cinq mises a jour refusees
     * d'affilee sur le poste : rien ne surveillait ce chemin, qui est pourtant celui dont
     * la panne est la plus couteuse — une application qui ne se met plus a jour ne recoit
     * plus aucune des corrections suivantes.
     */
    nom: 'Mises à jour (empreinte, reprises, lecture impossible)',
    commande: 'node',
    args: ['test-maj.js'],
    dossier: path.join(racine, 'v2', 'desktop'),
  },
  {
    /*
     * Le contrat entre le processus principal et la page, que RIEN ne verifiait : le
     * contrat est ecrit en TypeScript, le processus principal en JavaScript. Six champs
     * ajoutes le 30.07.2026 ont ainsi ete calcules, declares, affiches — et jetes au
     * passage du pont, sans qu'une seule verification ne rougisse.
     */
    nom: 'Contrat principal ↔ interface',
    commande: 'node',
    args: ['test-contrat.js'],
    dossier: path.join(racine, 'v2', 'desktop'),
  },
  {
    /*
     * La configuration et les secrets — 262 lignes qui gardent l'adresse du controleur, le
     * compte, le mot de passe, la cle a deux facteurs et l'empreinte de cle publique. Leurs
     * commentaires racontaient TROIS incidents survenus sur le poste reel, et rien ne
     * verifiait qu'ils ne peuvent plus se reproduire. Ajoute le 31.07.2026.
     */
    nom: 'Configuration et secrets (reprise, sauvegarde, copie périmée)',
    commande: 'node',
    args: ['test-store.js'],
    dossier: path.join(racine, 'v2', 'desktop'),
  },
  {
    /*
     * « tsc -b --force », et surtout PAS « tsc --noEmit ».
     *
     * Le tsconfig.json de v2/web est un fichier de references : « files: [] » puis deux
     * projets references. « tsc --noEmit » y trouve donc zero fichier a examiner et se
     * termine en succes sans avoir rien lu — un feu vert vide, qui a laisse passer quatre
     * erreurs de type pendant des semaines. Le mode « build » suit les references et
     * examine reellement les 205 fichiers ; « --force » interdit de sauter un projet sur
     * la foi d'un cache.
     */
    nom: "Types de l'interface",
    commande: npx,
    args: ['tsc', '-b', '--force'],
    dossier: path.join(racine, 'v2', 'web'),
  },
  {
    /*
     * Les regles que le compilateur ne voit pas.
     *
     * « react/rules-of-hooks » surtout : un crochet place sous une sortie anticipee ne
     * s'execute pas a tous les rendus, React compte alors un nombre different d'un rendu a
     * l'autre, refuse de continuer, et l'application n'affiche plus RIEN. C'est arrive en
     * 2.10.0, livree sur le poste de reference : ecran noir au lancement. Les types passaient, les tests
     * aussi — cette regle etait configuree depuis toujours, mais rien ne la lancait.
     */
    nom: "Règles de l'interface (crochets React)",
    commande: npx,
    args: ['oxlint', 'src', '--deny-warnings'],
    dossier: path.join(racine, 'v2', 'web'),
  },
  {
    /*
     * Les memes regles, sur le PROCESSUS PRINCIPAL.
     *
     * Il n'en avait jamais vu la couleur : oxlint ne tournait que sur « v2/web/src », donc
     * sur l'interface seule. Neuf mille quatre cents lignes de JavaScript — main.js, la
     * chaine de mise a jour, le client Protect, le relais — n'etaient analysees par rien,
     * et c'est precisement la moitie du code ou vivent les defauts les plus couteux.
     *
     * Constate le 31.07.2026, en cherchant ce qui n'etait verifie par personne. C'est la
     * meme forme que les trois angles morts precedents : un outil configure, qui tourne, et
     * dont personne n'avait remarque qu'il ne regardait qu'une partie du terrain.
     */
    nom: 'Règles du processus principal',
    commande: npx,
    args: ['oxlint', 'v2/desktop', 'scripts', '--deny-warnings'],
    dossier: racine,
  },
];

let echecs = 0;

for (const suite of suites) {
  console.log(`\n=== ${suite.nom} ===`);
  const res = spawnSync(suite.commande, suite.args, {
    cwd: suite.dossier,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (res.status !== 0) {
    echecs++;
    console.log(`  → échec (code ${res.status})`);
  }
}

console.log('\n' + (echecs === 0 ? 'TOUTES LES VÉRIFICATIONS PASSENT' : `${echecs} suite(s) en échec`));
console.log('\nVérifications nécessitant le contrôleur, à lancer à la demande :');
console.log('  npm --prefix v2/desktop run test:relay     (relais et relance automatique)');
console.log('  npm --prefix v2/desktop run test:client    (connexion, demande les identifiants)');
console.log('  npm --prefix v2/desktop run test:frise     (V-Frise : où y a-t-il de la vidéo ?)');
console.log('  npm --prefix v2/desktop run test:alertes   (V-Alertes : le contrôleur sait-il prévenir ?)');
console.log("  npm --prefix v2/desktop run test:attributs (V-Attributs : que sait-on d'une détection ?)");

process.exit(echecs === 0 ? 0 : 1);
