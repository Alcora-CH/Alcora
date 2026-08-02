# Alcora — dossier de conception

Client de bureau Windows pour UniFi Protect : direct, détections, relecture, veilles —
sans passer par le nuage d'Ubiquiti.

Alcora n'est ni affilié ni approuvé par Ubiquiti Inc. « UniFi » et « UniFi Protect » sont
des marques de Ubiquiti Inc.

## Par où commencer

| Fichier | Rôle |
|---|---|
| `plan-avancement.html` | **L'état réel du chantier**, confronté au code à chaque révision : les douze lots, ce qui est livré, ce qui reste, et les écarts corrigés. À ouvrir en premier. |
| `contraintes-verifiees.md` | Les mesures faites sur l'installation réelle. **Source de vérité** : ne pas re-supposer ce qui y est écrit. |
| `verifications-poste.html` | Ce que seul le poste de référence peut éprouver — liste vivante. |

## Conception et décisions

| Fichier | Rôle |
|---|---|
| `plan-travail.md` | Le plan d'origine (22.07.2026) et ses principes d'ordonnancement. Référence, pas état courant. |
| `decision-pile-technique.md` | Pourquoi une 2.0 en Electron plutôt que la 1.x WPF/.NET. |
| `design-tokens.md` | Couleurs, espacements, typographie. |
| `empaquetage.md`, `installation-poste.md` | Construction, signature, installation. |
| `webrtc-local.md` | Le relais et le transport vidéo local. |
| `i18n.md` | Les langues (fr·en·de·it) : architecture, règles, ajouter une clé ou une langue. En anglais — c'est le document qu'un traducteur ou un fork cherche. |

## Historique — la v1 en C#

Supprimée du dépôt le 28.07.2026 (décision D3). Ces documents sont conservés parce qu'ils
portent des mesures et des raisonnements qui valent toujours, mais **ils ne décrivent pas
l'application actuelle** :

| Fichier | Rôle |
|---|---|
| `plan-fonctionnalites.md` | Inventaire des fonctions, endpoint par endpoint. Les faits d'API restent valables ; la technologie décrite, non. |
| `plan-lot3.md` | Étude de fiabilité du direct, menée sur la base de code C#. |

## Maquettes

`maquette.html` (six espaces) · `maquette-ecrans-alcora.html` · `maquette-disposition.html` ·
`maquette-identite.html` · `maquette-liquid-glass.html` · `maquette-maj.html` ·
`maquette-frise.html` · `maquette-veilles.html` · `maquette-recherche.html`

Identité : `marque-alcor.svg`, `marque-alcor-512.png`.

## Où vivent les données

| | Chemin |
|---|---|
| Application installée | `%LOCALAPPDATA%\Alcora\` — **géré par l'installeur** |
| Données (config, secrets, journal, paquets) | `%APPDATA%\Alcora\` — Roaming |

**Ne jamais remettre les données dans `%LOCALAPPDATA%`.** Velopack y installe l'application,
y remplace `current\` à chaque mise à jour et fait le ménage autour : une première
installation y a fait disparaître l'exécutable ET exposé les données. Une reprise
automatique recopie l'ancien emplacement au premier lancement — y compris le fichier
`Local State`, sans lequel les secrets recopiés deviennent illisibles.

## Une note sur ce dossier

Ce README s'était figé au 22.07.2026 : il annonçait trois fichiers sur vingt-trois, portait
encore le nom ProtectViewer, et décrivait par le menu une application en WPF/.NET supprimée
depuis — pièges VLC, `CropGeometry`, `dotnet run`. Un index faux coûte plus cher qu'un index
absent : on s'y fie.

Réécrit le 31.07.2026, en même temps que quatre affirmations devenues fausses dans
`plan-avancement.html`. La règle qu'on en tire : **un document d'état se confronte au code,
sinon il dérive** — et il dérive d'autant plus silencieusement qu'il est bien écrit.
