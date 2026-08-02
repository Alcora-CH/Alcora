# Alcora

**Un client Windows pour UniFi Protect qui ne touche jamais au nuage.**

Alcora montre vos caméras — direct, enregistrements, détections, alertes — en
parlant directement à votre console UniFi Protect, sur votre propre réseau.
Pas de compte Ubiquiti, pas d'accès distant, pas de télémétrie. Si votre
réseau est debout, Alcora fonctionne.

🇬🇧 [English version](README.md) · 🌐 [alcora.ch](https://alcora.ch)

> Alcora n'est ni affilié ni approuvé par Ubiquiti Inc.
> « UniFi » et « UniFi Protect » sont des marques de Ubiquiti Inc.

## Ce qu'elle fait

- **Le mur du direct** — toutes les caméras en mosaïque automatique ; glisser
  pour réorganiser, double-clic (ou touches `1`–`9`) pour isoler, molette pour
  zoomer dans les *vrais pixels de la source*, son caméra par caméra.
- **La relecture** — parcourir une journée entière d'enregistrement continu,
  frise zoomable avec les détections en repères, lecture enchaînée sans
  coupure, image par image, audio, captures à la définition de la source.
- **Détections et recherche** — filtrer par sujet, type de véhicule, couleur,
  caméra ou plaque ; les filtres ne proposent que ce qui existe réellement
  dans votre archive, avec les comptes en regard. La recherche de plaque
  tolère les lectures ambiguës du contrôleur.
- **Les veilles** — vos propres règles d'armement, indépendantes de Protect :
  sujets, caméras, horaires, son par règle. Les notifications Windows passent
  par une liaison temps réel permanente — mesurées *plus rapides que celles
  du nuage d'Ubiquiti*.
- **Le halo d'activité** — la caméra où il se passe quelque chose s'illumine
  tant que ça dure, en disant *quoi*.
- **Mise à jour autonome** — vérifiée à chaque lancement, contrôlée par
  SHA-256 contre un manifeste signé, appliquée, redémarrée. Une fenêtre
  « Ce qui a changé » explique chaque nouveauté.

## Prérequis

- Windows 10/11 (x64 natif ; fonctionne en émulation sur ARM64).
- Une console UniFi Protect (UDM Pro, UNVR, Cloud Key G2+…) joignable sur
  votre réseau.
- **Le RTSP activé** sur chaque caméra (Protect → caméra → Avancé).
- Un **compte local dédié** à Alcora sur la console, avec droits de
  visionnage — pas votre compte propriétaire.

## Installation

Téléchargez le dernier `Alcora-win-Setup.exe` depuis les
[versions](https://github.com/alcora-ch/Alcora-releases/releases) et
lancez-le. Windows peut afficher un avertissement SmartScreen la première
fois — l'installeur est signé, mais d'un certificat auto-émis. L'application
se maintient ensuite à jour toute seule.

Au premier lancement : l'adresse de la console, le compte dédié et, s'il en a
une, sa clé à deux facteurs — les codes sont générés localement, on ne vous
en demandera plus jamais.

## Le modèle de confidentialité

- Alcora parle à **votre console** et, pour les mises à jour, à **GitHub**.
  À rien d'autre, jamais.
- Après l'appairage, la clé publique TLS de la console est **épinglée** —
  Alcora refuse de parler à quoi que ce soit d'autre à son adresse.
- Les identifiants sont chiffrés par **DPAPI**, liés à votre compte Windows.
- Le relais vidéo n'écoute qu'en **local**.
- Aucune image, plaque ou nom ne quitte votre machine.

Voir [SECURITY.md](SECURITY.md) pour signaler une faille.

## Construire depuis les sources

```bash
npm run install:all   # dépendances de l'interface et de l'écrin de bureau
npm test              # 13 suites de vérification hors ligne, sans contrôleur
npm run dev           # serveur de dev + Electron contre votre console
npm run build         # installeur (signature facultative)
```

Le dossier `docs/` tient l'histoire de la conception — dont les mesures faites
sur une console réelle (`docs/contraintes-verifiees.md`), qui expliquent la
plupart des choix non évidents du code.

## Licence

[GPL-3.0](LICENSE) — © Thomas. Toute œuvre dérivée doit rester open source
aux mêmes conditions.
