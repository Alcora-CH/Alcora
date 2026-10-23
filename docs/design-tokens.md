# Système de design — direction « Observatoire »

Retenue par Thomas le 23.10.2026 sur `docs/maquette-ux-a.html` (plan : `docs/plan-ux.md`).
Ce document décrit ce qui est **en vigueur dans le code** : les jetons vivent dans
`v2/web/src/index.css`, les composants dans `v2/web/src/ui/`. Le catalogue de tous les
composants s'ouvre en développement avec `npm run web` puis `?catalogue` dans l'adresse.

Il remplace l'ancienne direction « alignée sur UniFi Protect » (valeurs relevées sur le
CSS public d'Ubiquiti, juillet 2026) : plus rien ne l'appliquait depuis le thème « Nuit
lecture », et elle contredisait la maquette validée.

## L'idée

Un instrument d'observation de nuit. Le ciel ne vit plus que là où il n'y a pas d'image,
et il est **fixe par défaut** (réglage « Fond animé »). Les surfaces sont pleines — plus
aucun flou nulle part. L'or d'Alcor est **réservé à ce qui est observé** : le direct actif,
la sélection, la tête de lecture, l'action principale.

## Couleurs (`:root`, mêmes noms qu'avant : chaque classe Tailwind suit)

| Jeton | Valeur | Rôle |
|---|---|---|
| `--bg` | `#0e131b` | nuit : le fond |
| `--card` | `#151b25` | instrument : rail, en-têtes, cartes |
| `--card2` | `#1e2633` | graphite : boutons, champs |
| `--card3` | `#283242` | graphite appuyé : survol, piste d'interrupteur |
| `--line` / `--line2` | `rgba(206,214,229,.09)` / `.17` | séparateurs / contours |
| `--ink` / `--muted` / `--soft` | `#ece8df` / `#a9b0bc` / `#737d8b` | texte : principal, secondaire, tertiaire |
| `--accent` | `#dca95c` | Alcor |
| `--accent-soft` / `--accent-ligne` | or à 14 % / à 42 % | fond / contour d'un élément sélectionné |
| `--sur-accent` / `--sur-bad` | `#1d1608` / `#1d0b07` | texte posé sur l'or / sur le rouge |
| `--ok` / `--warn` / `--bad` / `--info` | `#74c494` / `#e0a23c` / `#e3735f` / `#86afcf` | en ligne / attention / erreur / information |

La rampe `--on-*` (neutre) reste réservée à ce qui se pose **sur la vidéo**.

## Texte : cinq tailles, et aucune autre

| Classe | Taille | Rôle |
|---|---|---|
| `text-micro` | 11 px | graduations, libellés du rail, comptes dans une puce |
| `text-meta` | 12 px | précisions, aides, petits boutons |
| `text-corps` | 13 px | le texte courant, les boutons, les champs |
| `text-titre` | 15 px | titres de section |
| `text-ecran` | 19 px | le titre de chaque écran |

L'inventaire du 23.10.2026 en comptait quinze, de 9 à 20 px. Police : **Atkinson
Hyperlegible Next** (variable, embarquée), dessinée pour la lisibilité ; **Atkinson
Hyperlegible Mono** pour les horodatages et les valeurs techniques seulement. Les intitulés
s'écrivent en casse ordinaire — plus de petites capitales espacées.

## Formes

- Contrôles : **32 px** (normal) et **28 px** (petit), rayons 8 et 7 px.
- Cartes : rayon **12 px**, contour `--line2`, ombre `0 18px 40px -18px rgba(0,0,0,.7)`.
- Puces : 28 px, entièrement arrondies. Interrupteurs : 40 × 22 px.
- En-tête d'écran : **64 px**.

## Composants (`v2/web/src/ui/`)

`Bouton` (normal, primaire, fantome, actif, vert, danger ; deux tailles ; icône seule avec
titre obligatoire), `Segment`, `Puce`, `Interrupteur`, `Champ`, et dans `Cadre.tsx` :
`EnTete`, `Carte`, `Section`, `Rangee`, `Touche`. Un écran ne style plus ses boutons sur
place : il emploie ceux-ci.

## Horodatage sur l'image

L'horodatage gravé dans le flux est incrusté par le firmware de la caméra (`osdSettings`),
pas par l'application : aucun rendu Protect à imiter. Les informations d'Alcora (heure de
la relecture, définition lue, commandes) vivent **hors de l'image**, dans le bandeau
au-dessus d'elle — décision de Thomas, après deux refus de boutons posés sur l'image.
