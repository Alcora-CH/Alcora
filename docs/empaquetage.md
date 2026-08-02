# Empaqueter Alcora — ce qui marche et pourquoi

Ecrit le 22.07.2026, apres le premier empaquetage et l'audit qui a suivi ; le produit
s'appelait alors ProtectViewer. **A lire avant de toucher a `scripts/build.mjs` ou au
chargement de l'interface.**

> Deux ajouts du 30-31.07.2026 que ce document ne decrivait pas : les services d'horodatage
> de la signature sont essayes EN CHAINE (`vpk` signe avec une concurrence de dix, et un
> service gratuit rejette dix demandes simultanees — la 2.16.0 est partie sans horodatage
> pour cette raison) ; et `oxlint` est desormais bloquant sur le processus principal comme
> sur l'interface, avertissements compris.

## La chaine

```
npm run build          # racine du depot
```

interface (Vite) → application (@electron/packager) → signature (signtool) → installeur (Velopack)

Chaque etape verifie son resultat. Une etape ratee arrete tout : un installeur produit a
partir d'une etape incomplete est bien pire qu'une erreur franche.

## Les pieges, tous rencontres pour de vrai

### 1. L'interface ne se charge PAS depuis `file://`

Vite ecrit des chemins absolus : `<script src="/assets/index-xxx.js">`. Sous `file://`,
`/assets/…` designe la racine du disque. Rien ne se charge.

**Le symptome trompe complètement** : fenetre vide, et **aucune erreur nulle part** — ni
console, ni sortie d'erreur, ni journal. Normal : aucune ligne de la page ne s'execute,
donc rien ne peut se plaindre.

La correction n'est pas `base: './'`. Meme avec des chemins relatifs, une page `file://`
n'a pas d'origine : les modules sont refuses, et `default-src 'self'` ne correspond a rien.

**On sert l'interface par un schema applicatif**, declare avant que l'application soit
prete :

```js
protocol.registerSchemesAsPrivileged([{
  scheme: 'app',
  privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
}]);
```

Une vraie origine : les chemins resolvent, les modules chargent, la politique de securite
s'applique, le contexte est securise comme sur https.

### 2. Ne livrer que le binaire du relais, jamais son dossier

```js
extraResource: [relay]        // A NE PAS FAIRE
```

Le relais ecrit dans son repertoire de travail. Livrer le dossier a distribue, dans un
installeur reellement produit : sa cle privee, ses journaux, et **la configuration
engendree — adresse du controleur et alias RTSP des cameras en clair**. Ces alias sont ce
qui donne acces aux flux.

On prepare donc un dossier ne contenant que `mediamtx.exe`, et la construction **verifie**
qu'il ne contient rien d'autre. Une garde, pas une intention.

### 3. Traiter les rappels de l'installeur, avant tout le reste

Velopack lance l'executable avec `--veloapp-install`, `--veloapp-updated`,
`--veloapp-obsolete`, `--veloapp-uninstall`, puis **attend qu'il rende la main**. Une
application qui les ignore ouvre sa fenetre et ne s'arrete jamais : l'installeur reste
bloque.

`--veloapp-firstrun` est l'exception et doit poursuivre : c'est ce qui affiche
l'application a la fin de l'installation.

### 4. Le simulateur ne doit jamais servir de secours

```ts
export const bridge = window.protect ?? mock;   // A NE PAS FAIRE
```

Dans l'application installee, un preload defaillant affichait alors deux cameras inventees
et un relais fictif : une application d'apparence normale, sans une seule image, et rien
n'expliquait pourquoi.

`import.meta.env.DEV` est resolu a la construction : en production le simulateur est retire
du paquet. Verifie — les chaines « G6 Bullet » et « UDM-PRO » sont absentes du paquet livre.

### 5. Pas de shell pour lancer les outils

`spawnSync(..., { shell: true })` decoupe les chemins sur les espaces, ce que
« Program Files » et « Windows Kits » garantissent. On appelle les bibliotheques
directement (`packager`, `vite.build`) ou l'executable en absolu, jamais son lanceur
`.cmd`.

## La signature

```
powershell -ExecutionPolicy Bypass -File scripts\certificat.ps1   # une fois, sur ce poste
powershell -ExecutionPolicy Bypass -File scripts\confiance.ps1    # une fois par PC
```

La cle privee reste dans le magasin de Windows ; la construction la designe par son
empreinte. `signature/` est exclu du depot.

**Mesure le 22.07.2026 : la signature ne suffit pas face a une suite de securite.**
Signature `Valid`, horodatee — et Bitdefender bloquait toujours la sortie reseau. Un
certificat auto-signe rend la signature verifiable, il n'apporte aucune reputation. Voir
`installation-poste.md`.

## Reconstruire une version deja produite

L'outil refuse d'ecraser une version presente dans `v2/releases`. Tant qu'elle n'est pas
diffusee, la reconstruire est normal :

```
node scripts/build.mjs --remplacer
```

Une version deja diffusee doit etre incrementee, jamais remplacee : les postes deja
installes se fient au numero pour savoir s'ils sont a jour.

## Ce qui reste a faire

La mise a jour automatique n'est pas branchee. `Update.exe` est installe mais jamais
appele, et aucun emplacement de publication n'est choisi. Tant que ce point n'est pas
tranche, chaque mise a jour se fait en relancant l'installeur a la main.
