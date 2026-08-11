# Alcora — carte pour qui touche au code

Client de bureau (Electron) pour UniFi Protect, entièrement local : direct, relecture,
détections, veilles. Aucun nuage, aucune télémétrie, aucune image ne quitte le réseau.
Non affilié à Ubiquiti.

**Windows est la plateforme de référence** (installeur signé, mise à jour automatique).
**Linux** existe depuis la 2.25.0 : archive `.tar.gz`, sans chaîne de mise à jour — voir
« Construire pour Linux » plus bas.

## À lire avant de supposer quoi que ce soit

- `docs/plan-avancement.html` — l'état réel du chantier, confronté au code.
- `docs/contraintes-verifiees.md` — les mesures faites sur une vraie installation.
  **Source de vérité : ne pas re-supposer ce qui y est écrit.**
- `docs/i18n.md` — les langues : architecture, règles, comment ajouter clé ou langue.

## Commandes — toujours depuis la RACINE du dépôt

```
npm test          # tsc -b --force + oxlint (bloquant, main process compris) + 13 suites hors ligne
npm run build     # vite build + vpk pack + signature (certificat requis)
npm run publier   # publie sur alcora-ch/Alcora-releases
npm run web       # démo navigateur (mode simulation, sans caméra ni contrôleur)
```

`node scripts/test.mjs` lancé depuis `v2/desktop` échoue sur un chemin relatif — piège
récurrent. Racine, toujours.

## Construire pour Linux

```
npm run build:linux    # exige WSL (Ubuntu) et v2/relay/mediamtx-linux-x64
```

- **Les deux binaires du relais cohabitent** dans `v2/relay/` (hors dépôt) :
  `mediamtx.exe` et `mediamtx-linux-x64`, **même version** — la livraison Linux le
  renomme `mediamtx`, ce que `main.js` cherche hors Windows.
- **Version épinglée du relais : `v1.20.0`** (montée le 11.08.2026 depuis la 1.19.2).
  C'est la seule dépendance d'exécution d'Alcora : elle ne s'approvisionne pas toute
  seule, et rien dans le dépôt ne la vérifie. Le faire à la main, dans cet ordre :

  ```
  gh release download v1.20.0 --repo bluenviron/mediamtx \
     -p 'mediamtx_v1.20.0_windows_amd64.zip' -p 'mediamtx_v1.20.0_linux_amd64.tar.gz' -p checksums.sha256
  sha256sum -c checksums.sha256 --ignore-missing
  gh attestation verify mediamtx_v1.20.0_windows_amd64.zip --repo bluenviron/mediamtx
  ```

  **Les sommes seules ne suffisent pas** : elles viennent du même serveur que les
  archives. L'attestation SLSA, elle, est signée indépendamment — c'est elle qui dit
  d'où vient réellement le binaire. Éprouvée le 11.08.2026, témoins négatifs compris
  (fichier non attesté et dépôt erroné rendent tous deux 404).
- **WSL n'est pas un caprice** : construite depuis Windows, l'archive s'écrirait sur du
  NTFS, qui n'a pas de bit « exécutable » — Linux refuserait de démarrer le lanceur.
  L'archive est donc faite dans WSL après `chmod`, et le script **relit les modes dans
  l'archive produite** avant de la déclarer prête.
- **Pas de mise à jour automatique hors Windows** : Velopack publie des `.nupkg`, lit
  `releases.win.json` et confie l'application à `Update.exe`. Rien de tout cela n'existe
  ailleurs. Le processus principal ne crée donc pas le gestionnaire (`main.js`) et pousse
  `etat: 'manuelle'` ; les réglages l'annoncent au lieu de laisser croire à une
  surveillance. Même raison pour le démarrage automatique
  (`AUTO_DEMARRAGE_POSSIBLE` : `setLoginItemSettings` ne fait rien sous Linux).
- `releases.win.json` **ne liste pas** l'archive Linux : ce manifeste ne pilote que
  Velopack. L'archive est un actif de release ordinaire, publié par `npm run publier`
  s'il la trouve.
- Éprouvé le 08.08.2026 dans WSLg : l'application démarre, écrit son journal
  (`no automatic update chain on linux`, écran de connexion, page chargée) et le relais
  répond. **Jamais lancée sur un vrai bureau Linux** — l'inconnue restante est le rendu
  vidéo (WebRTC, décodage matériel), que WSLg ne représente pas.

## Le rituel d'une version

1. Note dans `v2/web/src/versions.ts` — **fr[] ET en[]**, un test compte les notes une à une.
2. `npm version X.Y.Z --no-git-tag-version` dans `v2/desktop`.
3. `npm test` (racine) → `npm run build` → `npm run publier`.
4. Vérifier le manifeste publié : `releases.win.json` de la release doit porter la version.

## Règles dures (chacune a une histoire)

- **Chaîne de mise à jour** (`v2/desktop/maj.js`) : l'empreinte se calcule sur les octets
  REÇUS pendant l'écriture ; « illisible » n'est jamais « altéré » ; ne rien retirer sans
  lire les commentaires du fichier et `test-maj.js`. Cette chaîne a cassé trois jours.
- **i18n** : aucun texte visible en dur — tout passe par les dictionnaires (voir
  `docs/i18n.md`). Le journal de diagnostic est en ANGLAIS, toujours. L'historique des
  versions n'existe qu'en fr + en.
- **Garde-fous prouvés** : tout nouveau test se prouve en réinjectant le défaut qu'il
  surveille. Un test vert qui n'a jamais rougi ne protège rien — quatre angles morts
  sont nés exactement comme ça.
- **Mouvement** (`index.css`, jetons `--vive/--douceur/--ample/--montee/--echelle/--cascade`
  et courbes `--pose/--part/--douce`) : dosage validé sur maquette
  (`docs/maquette-animations.html`, trois crans comparés). Trois règles :
  **transform et opacity seulement** (toute autre propriété recalcule la mise en page
  pendant qu'un flux 4K décode — une exception assumée, le dépliement d'une veille) ;
  **le mouvement n'attend jamais l'information** (on anime l'arrivée, pas la
  disponibilité) ; `prefers-reduced-motion` coupe tout sans rien casser.
  Six classes, pas davantage : `.m-ecran`, `.m-cascade`, `.m-voile`, `.m-boite`,
  `.m-surgit`, `.m-pression`. Une surface qui s'ouvre doit aussi **partir** animée —
  `useFermetureAnimee` (`lib/fermeture.ts`) tient l'état, écoute `animationend` plutôt
  qu'un délai écrit en dur, et garde un secours si l'événement n'arrive jamais.
- **Jamais de données réelles** (personnes, adresses, domaines, mesures d'un poste
  précis) dans le code, les tests ou les exemples publics. Fixtures fictives.
- **Erreurs typées** (`protect/errors.js`) : message utilisateur + remède via i18n,
  détail technique en anglais. Jamais de 500 opaque.
- Modales de saisie : pas de fermeture au clic extérieur.
- La démo du navigateur (`v2/web/src/lib/bridge.ts`) imite le processus principal, mêmes
  textes — c'est l'outil de vérification vivante ; la mire vidéo
  (`v2/web/public/demo-extrait.mp4`) donne de vrais pixels au zoom et à la capture.

## Conventions

- Code, commits, identifiants : ASCII. Textes d'interface : via dictionnaires, ton
  sobre, tutoiement, pas de marketing.
- Les commentaires expliquent le POURQUOI (souvent une mesure datée), pas le comment.
- UI en français d'abord (`fr.ts` est la source de vérité), puis en/de/it.
