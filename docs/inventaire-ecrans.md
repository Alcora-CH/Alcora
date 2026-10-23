# Inventaire iso-contenu des écrans (23.10.2026)

Base de toute maquette et de tout ré-habillage du chantier UX (`docs/plan-ux.md`) : **rien
de ce qui est listé ici ne disparaît**. Un élément peut changer de place, de forme ou de
moment d'apparition ; il ne peut pas cesser d'exister sans une décision écrite du mainteneur.

Relevé sur le source (2.30.0) et sur la démo en 1600 × 960. Les noms entre `« »` sont les
libellés français (clé i18n entre parenthèses quand elle aide à retrouver le code).

## 0. Le constat chiffré (tous les `.tsx`, 5 590 lignes)

| Mesure | Valeur | Ce qu'elle dit |
|---|---|---|
| Tailles de texte distinctes | **15** (9 ; 9,5 ; 10 ; 10,5 ; 11 ; 11,5 ; 12 ; 12,5 ; 13 ; 13,5 ; 14 ; 15 ; 17 ; 19 ; 20 px) | `design-tokens.md` n'en prévoyait que 4 |
| Usages de la police à chasse fixe | 59 | technique partout, y compris pour des libellés |
| Boutons (`<button>`) | 63, **aucun composant partagé** | chacun stylé sur place |
| Hauteurs de bouton | 9 | 26, 28, 30, 32, 36, 40 px… |
| Rayons d'angle | 7 | `rounded`, `-sm`, `-md`, `-lg`, `-xl`, `-full`, `-t`/`-r` |
| Écarts (`gap`) | 11 | de 2 à 32 px |
| Couleurs écrites en dur | 24 occurrences, 15 teintes | hors jetons |
| Commandes vidéo | 2 emplacements | bandeau hors image (direct) / sur l'image (relecture) |
| Panneau Surveillance | affiché sur **tous** les écrans | y compris Détections, Alertes, Réglages |

## 1. Cadre de l'application (`App.tsx`)

**Rail** (56 px, toujours là sauf plein écran)
- Marque Alcor animée en tête.
- 4 espaces, icônes seules, libellé en infobulle : Direct, Détections, Relecture, Alertes.
- Réglages en pied.
- Repère d'espace actif : trait d'accent qui glisse.

**Panneau « Surveillance »** (292 px, épinglable, révélé au survol de la lisière gauche ;
glisse PAR-DESSUS l'image au survol, ne la repousse qu'épinglé — sinon la largeur des
tuiles change et le flux se renégocie)
1. Titre « Surveillance ».
2. **État** : pastille (prêt / problème), message du relais, remède en orange s'il existe,
   bouton « Réessayer » seulement si l'échec est permanent.
3. **Caméras** : par caméra, pastille en ligne/hors ligne, nom, définition max
   (`3840 × 2160`) ou « RTSP désactivé » en orange ; bouton œil au survol
   « Masquer de la mosaïque » / « Réafficher », désactivé pour la dernière visible
   (« La dernière caméra visible ne se masque pas »), caméra masquée à 45 % d'opacité.
   « Aucune caméra pour l'instant. » si vide. Remède RTSP unique sous la liste + lien
   « Voir le guide, étape par étape ».
4. **Colonne d'état** (`ColonneEtat.tsx`) :
   - Contrôleur (nom, vert), Heure (secondes), Protect (armé vert / désarmé /
     alarmes inactives / valeur brute).
   - Pastilles de définition : `HD ×n`, `2K ×n`, `4K ×n` (accent si n > 0).
   - **Détections récentes** (≤ 5, en direct) : vignette 52 × 30 (instantané pendant,
     vignette à la fin), sujets ou « Détection », nom de caméra, « il y a » (s, min, h, j) ;
     clic = ouvre la séquence (lecteur d'extrait).
   - **Aujourd'hui · n** (`≥ n` si partiel) : histogramme 24 barres, heures non lues
     grisées « non lu », infobulle « 07h — 12 », axe 00 06 12 18 24.
   - **Enregistrements** : bandeau rouge « Enregistrement suspendu… » s'il l'est ;
     Le plus ancien (date courte), Profondeur (« 5 mois 12 j »), Pleine définition
     (orange), Pleine déf. annoncée et Rétention annoncée (seulement si écart avec la
     mesure), État du disque (+ explication « non homologué » si besoin), Écrit par jour
     (Go), barre de remplissage du disque, Disque `5,85 To / 5,94 To`, note « Rotation
     automatique. Un disque plein est normal. »
   - **Versions** : Alcora, Protect, UniFi OS, Disponible (orange), Allumé depuis.
   - Note verte « Aucune image ne quitte votre réseau. »

**Superpositions**
- Deux boutons du mur (direct seulement), en haut à gauche, sur l'image, 55 % d'opacité :
  « Réduire le panneau » / « Épingler le panneau », « Plein écran (F11) ».
- Plein écran : commandes en haut à droite, réapparaissent au mouvement de souris —
  « Afficher le panneau », « Quitter » (Échap) ; rappel fugace « Échap pour revenir ».
- Mise à jour prête (bas, centre) : « Version X prête. » + « Redémarrer maintenant » +
  « Plus tard ».
- Lecteur d'extrait (détection cliquée), « Ce qui a changé » (après l'intro), intro Ciel.
- Panne de la liaison interne : « L'application n'a pas démarré correctement. » + détail.
- Fond : Planétarium animé (réglage « Fond animé »).

**Gestes cachés du mur** (aucun n'est visible à l'écran aujourd'hui)
- Glisser une tuile = réorganiser ; double-clic = isoler / revenir (infobulle seulement).
- Touches 0-9 = isoler la caméra n ; F11 plein écran ; Échap.
- Molette = zoom ; glisser = panoramique (zoomé).

## 2. Mur (Direct)

- Mosaïque calculée (colonnes, taille) pour remplir la zone, centrée ; espacement réglable
  (Réglages, « aucun » = images jointives sans cadre).
- **Tuile** (`CameraTile.tsx`) :
  - Bandeau HORS image (décision du mainteneur, après deux refus de boutons posés sur
    l'image) : nom ; qualité du canal `HAUTE 2160p` (accent si haute) ; état (`…` /
    « hors ligne ») ; 4 commandes toujours visibles avec étiquette maison au survol :
    « Revoir cette caméra », « Ses détections », « Enregistrer une image »,
    « Écouter cette caméra » / « Couper le son » / « Ce flux ne porte pas de son ».
  - Image : états « Connexion… », « Flux indisponible », image figée détectée.
  - Zoom : indicateur `2,40×` et « interpolé » (rouge) au-delà de la définition native.
  - Activité en cours : halo animé sur le cadre + pastille « Personne » en haut à droite.
  - Capture : confirmation centrée « enregistrée : nom.jpg » / « capture impossible ».
  - En glisser : 60 % d'opacité + contour accent.
- Un seul son à la fois entre tuiles.
- Pas prêt : message + remède + « Réessayer » au centre.

## 3. Relecture (`RelectureScreen.tsx`)

- **Barre du jour** : nom de la caméra ; « Revenir au direct » (vert, si une séquence
  est lue) ; jour précédent / champ date (borné au premier et au dernier jour
  enregistrés) / nom du jour (« Aujourd'hui », « Hier », « jeudi 23 octobre ») / jour
  suivant.
- **Image** (tuile flottante) :
  - Avant tout clic : le DIRECT de la caméra + invite « Clique la frise ou une vignette
    pour remonter dans le temps » (sans relais : autre invite).
  - Deux lecteurs empilés (échange sans trou) ; « Extraction… » ; erreur « Cette séquence
    ne peut pas être lue ici. » + « Revenir au direct ».
  - Horodatage en haut à gauche `23.10.2026  23:55:03` ; définition lue en haut à droite
    `3840 × 2160` (+ « définition réduite » en orange).
  - Commandes SUR l'image en haut à droite : zoom (« Revenir à l'image entière (2×) »),
    son, capture. Indicateur de zoom + « interpolé ». Confirmation de capture centrée.
- **Caméras** (colonne de 160 px si plus d'une) : carte 16:9 (vide aujourd'hui) + nom ;
  active en accent ; changer garde l'instant.
- **Transport** (îlot) : lecture/pause, −10 s, +10 s, image précédente, image suivante,
  vitesses 0,25× 0,5× 1× 2×.
- **Frise** (îlot) : « journée entière » ou `13:00:00 → 14:00:00` + « tout voir » ;
  « molette pour zoomer » ; zones enregistré (hachures ambre), basse définition seule
  (hachures avant la frontière), futur ; graduations adaptées (minute → 6 h) ; repères de
  détection colorés par genre (mouvement plus bas et plus court), grossis au survol ; tête
  de lecture lumineuse ; trait de survol ; sous la barre : heure survolée + genre + score
  `· 82 %` + « cliquer pour voir ». Zoom molette centré sur le curseur, jusqu'à 1 min.
- **Pellicule** : filtres Tout / Personnes / Véhicules / Animaux / Sons ; compte
  `144 détections` ; cartes 112 px (vignette, heure, genre coloré) ; carte en cours en
  accent ; « Rien de détecté ce jour-là. »
- Teintes par genre : personne ambre, véhicule `#7fa8c9`, animal vert, son `#b98fc9`,
  mouvement gris.
- Clavier : espace, flèches (pas de 10 s / 30 s, image par image).

## 4. Autres écrans — textes recensés, détail à faire avant leur maquette

| Écran | Fichier | Textes | À détailler |
|---|---|---|---|
| Détections | `RechercheScreen.tsx` | 23 | filtres (recherche tolérante, sujet + compteurs, confiance, type et couleur de véhicule, caméra, période), grille (heure, caméra, sujet, couleur, score, badge « identifié »), tronqué à 300 |
| Alertes (veilles) | `VeillesScreen.tsx` | 26 | interrupteur général + profil, cartes de veille (déclencheur, caméras, horaire, son, retenue, estimation « ~n par jour ») |
| Réglages | `ReglagesScreen.tsx` | 43 | Version, Langue, Apparence, Démarrage, Captures et son, Ce qui a changé, Connexion, En cas de problème |
| Connexion | `SetupScreen.tsx` | 43 | reprise, guide console, adresse, compte, 2FA + aide, vérification par étapes, caméras trouvées, rester connecté |
| Intro | `CielScreen.tsx` | 10 | étapes de démarrage et de mise à jour |
| Nouveautés | `NouveautesScreen.tsx` | 4 | liste des versions depuis la précédente |
| Lecteur d'extrait | `LecteurExtrait.tsx` | 18 | séquence d'une détection, transport, enregistrer l'extrait |

## 5. Où est passé chaque élément — cadre, panneau et mur (23.10.2026)

Premier groupe recodé (branche `ux-fondations`, non publiée), relu élément par élément
contre les sections 1 et 2 et vérifié dans la démo, en français, allemand et italien.
Rien n'a disparu ; ce qui change de forme est dit, les ajouts sont marqués.

**Rail** (`cadre/Rail.tsx`)
- [x] Marque en tête — ne tourne plus qu'avec « Fond animé » (choix d'apparence).
- [x] Espaces : icône **et nom**, dans l'ordre du temps : Direct, Relecture, Détections,
      Alertes ; en pied Système (ajout) et Réglages. S'élargit pour l'allemand et l'italien.
- [x] Repère d'or qui glisse.

**Panneau « Surveillance »** — retiré, son contenu redistribué :
- [x] Titre « Surveillance » : sans objet, le panneau n'existe plus.
- [x] État (pastille, message, remède, « Réessayer » si l'échec est permanent) : barre
      d'état (pastille + message) ; page Système, bloc Contrôleur (tout) ; centre du mur
      quand aucune image n'est possible (tout).
- [x] Caméras (pastille, nom, définition ou « RTSP désactivé », masquer / réafficher,
      dernière caméra visible protégée, caméra masquée estompée) : menu « Caméras » du direct
      et tableau de la page Système. « Aucune caméra pour l'instant. » : menu (dès que
      l'inventaire est lu, même vide), centre du mur, page Système. Remède RTSP + lien du
      guide : UNE fois, sous la liste du menu et sous le tableau.
- [x] Contrôleur, Heure, Protect : barre d'état et Système.
- [x] Pastilles HD / 2K / 4K : Système.
- [x] Détections récentes (≤ 5, vignette, sujet, caméra, « il y a », clic = séquence) :
      colonne Activité, vignettes 72 × 40 ; la liste part de celles du jour au lancement
      (ajout).
- [x] Aujourd'hui · n (≥ si partiel), histogramme, heures non lues, infobulle, axe : colonne
      Activité.
- [x] Enregistrements (suspension en tête, plus ancien, profondeur, pleine définition,
      rétentions annoncées en cas d'écart, état et note du disque, écrit par jour, barre,
      disque, note de rotation) : Système ; profondeur et remplissage aussi dans la barre.
- [x] Versions : Système.
- [x] « Aucune image ne quitte ton réseau. » (tutoyé, comme le reste de l'application) :
      barre d'état, en toutes lettres à partir de 1280 px de large, l'icône et son infobulle en
      dessous ; page Système.

**Superpositions**
- [x] Réduire / épingler le panneau : « Masquer l'activité » (tête de la colonne) et
      « Afficher l'activité » (en-tête) — un geste qui se garde, jamais un survol.
- [x] Plein écran (F11) : bouton nommé de l'en-tête, touche affichée.
- [x] Commandes du plein écran : « Quitter » ; menu « Caméras » (direct) ; rappel « Échap
      pour revenir » (en plein écran seulement : ailleurs, l'en-tête et la ligne des gestes le
      disent). La lisière qui révélait le panneau est remplacée par la **barre d'état**, qui
      revient avec les commandes au moindre mouvement et RESTE tant que quelque chose ne va
      pas (flux arrêté, enregistrement suspendu, caméra hors ligne) : l'état, le remède et
      « Réessayer » restent atteignables sans quitter le plein écran, par la page Système.
      Les commandes ne s'effacent pas tant que le menu est ouvert.
- [x] Mise à jour prête : inchangée (bas, centre), boutons communs.
- [x] Lecteur d'extrait, « Ce qui a changé », introduction, panne de liaison : inchangés
      (leurs groupes viendront).
- [x] Fond : le ciel ne vit plus qu'autour des images (et à la connexion).
- [x] Gestes cachés : une ligne sous le mur, et la fenêtre « Raccourcis » (touche **?**,
      barre d'état) — ajout.

**Mur et tuile** (`App.tsx`, `video/CameraTile.tsx`)
- [x] Mosaïque calculée, centrée, espacement des Réglages ; marge de 20 px en vue habillée.
- [x] En-tête du direct (ajout) : nombre d'images affichées, ou la caméra isolée.
- [x] Bandeau hors image, 44 px : nom ; qualité en casse ordinaire (grise : l'or est
      réservé à ce qui est observé) ; « Direct » en vert, « Hors ligne », « RTSP désactivé » en
      orange, ou « … » pendant la connexion ; quatre commandes
      avec leur nom court (icônes seules sur tuile étroite) et l'étiquette maison au survol.
- [x] « Connexion… », « Flux indisponible » + **prochaine tentative annoncée** (ajout),
      image figée détectée.
- [x] Zoom : facteur et « interpolé » en rouge.
- [x] Activité en cours : cadre d'or FIXE + pastille (le halo tournant repeignait à chaque
      image).
- [x] Confirmation de capture centrée ; 60 % + contour en glisser ; un seul son à la fois.
- [x] Pas prêt : message, remède, « Réessayer », au centre du mur.

**Pas dans ce groupe** : « Revoir à cet instant » depuis l'Activité (vient avec la
Relecture) ; les en-têtes des autres écrans (leurs groupes).

## 6. Où est passé chaque élément — Relecture (23.10.2026)

Deuxième groupe, même branche, relu contre la section 3 et vérifié dans la démo sur la
mire vidéo (lecture, zoom, son, capture, jours, 900 × 600 à 1600 × 960).

- [x] Nom de la caméra et changement de caméra : puces avec miniature dans l'en-tête (la
      miniature cède la place sous 1180 px). Changer de caméra **garde désormais l'instant**
      — l'inventaire le disait, le code revenait au direct.
- [x] « Revenir au direct » (vert, si une séquence est lue) : en-tête (icône seule sous
      1100 px).
- [x] Jour précédent / date bornée / nom du jour / jour suivant : en-tête ; la date est un
      bouton qui ouvre le calendrier du système, « Aujourd'hui » / « Hier » à côté.
- [x] Avant tout clic, le direct + invite ; sans relais, l'autre invite ; deux lecteurs qui
      se relaient ; « Extraction… » ; erreur + « Revenir au direct » : dans l'image.
- [x] Horodatage, définition lue (+ « définition réduite » en orange) : bandeau du lecteur,
      HORS de l'image.
- [x] Zoom (« Image entière »), son, capture : bandeau du lecteur, avec leur nom — comme au
      direct. Indicateur de zoom + « interpolé », confirmation de capture : sur l'image.
- [x] Transport (lecture, −10 s, +10 s, image par image, vitesses) : console sous l'image,
      avec l'**heure regardée** en grand (ajout).
- [x] Frise : toutes ses couches et gestes, dans la console ; « Molette pour zoomer, clic
      pour voir ».
- [x] Pellicule : filtres, compte, cartes de 132 px (vignette, heure, genre coloré), carte
      en cours en or, « Rien de détecté ce jour-là. ».
- [x] Teintes par genre : celles de la palette A (or, bleu, vert, mauve, gris).
- [x] Clavier : inchangé.
- [x] **Liens** (ajout) : « Revoir à cet instant » sur chaque détection récente de
      l'Activité, « Voir dans la relecture » dans la séquence d'une détection.
- [x] Fenêtre basse : l'image garde 260 px au moins, la page défile pour le reste.

Non vérifié à l'œil : le calendrier natif ouvert par le bouton du jour (il ne se capture pas
dans le panneau de prévisualisation ; l'appel réussit sur un vrai clic).
