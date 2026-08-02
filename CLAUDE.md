# Alcora — carte pour qui touche au code

Client Windows (Electron) pour UniFi Protect, entièrement local : direct, relecture,
détections, veilles. Aucun nuage, aucune télémétrie, aucune image ne quitte le réseau.
Non affilié à Ubiquiti.

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
