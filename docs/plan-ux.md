# Chantier UX et performances (ouvert le 23.10.2026)

## Pourquoi

Thomas, le 23.10.2026 : « La barre latérale, l'emplacement des boutons, les autres pages.
Tout semble brouillon, tout semble avoir été mis ici sans avoir été réfléchi et sans
sembler définitif. L'application semble être un jouet visuellement plutôt qu'une
application sérieuse et professionnelle. » Gênes retenues : **lisibilité** et
**cohérence**, en plus de la disposition.

Ce n'est donc pas un habillage à retoucher : c'est l'**organisation** de chaque écran
(où vit la navigation, où vivent les actions, ce qui est prioritaire) et un **système de
composants** commun qui manquent.

Décisions de Thomas (23.10.2026) :
- **Deux maquettes contrastées**, à contenu identique, avant de trancher : l'identité
  actuelle (ciel, verre, Alcor) poussée vers le professionnel, et une version sobre où la
  vidéo passe d'abord.
- **Cible de performance : un PC modeste** (celui de son père), mesuré avant/après.
- **Electron 45 d'abord, dans une version à part**, avant tout changement visuel.
- **Direction retenue : A « Observatoire »** (23.10.2026, sur `docs/maquette-ux.html`) : ciel
  fixe autour des images seulement, police Atkinson Hyperlegible, rail nommé, panneau
  Surveillance démonté (barre d'état + feuille Système + menu Caméras + colonne Activité
  propre au Direct), commandes vidéo hors de l'image partout, or d'Alcor réservé à ce qui
  est observé.
- **Structure, complétée le 23.10.2026** (`docs/maquette-ux-a.html`) : page **Système**
  (contrôleur, enregistrements, versions, tableau par caméra) dans le rail, réordonné
  Direct, Relecture, Détections, Alertes, puis Système et Réglages ; **liens** d'une
  détection vers la relecture à cet instant ; **raccourcis** (touche ?) ; Réglages
  **Aide** et **À propos** ; **états dégradés** dessinés. Écarté : la barre de titre
  intégrée.
- **Maquette validée le 23.10.2026, tailles A** (texte 13 px, boutons 32 et 28 px, en-têtes
  64 px). La variante B « densité Linear » de la maquette a été jugée plus professionnelle
  mais trop petite pour certains yeux : **A, sans option de densité dans l'application**.
- **Fonctions nouvelles, APRÈS la refonte, chacune dans sa propre version** : exporter une
  plage depuis la relecture, historique des alertes, relecture synchronisée de plusieurs
  caméras, dispositions enregistrées du mur.

## Règles qui ne bougent pas

- **Iso-contenu** : aucune maquette ni aucun écran recodé ne perd une information, un
  compteur, un badge, une graduation ou un état (deux maquettes refusées pour ça le
  04.08.2026).
- **Mouvement** : transform/opacity seulement, le mouvement n'attend jamais l'information,
  `prefers-reduced-motion` coupe tout (voir CLAUDE.md).
- **i18n** : aucun texte en dur, quatre langues, `fr.ts` source de vérité.
- **Mesurer, pas supposer** : chaque gain de performance annoncé est un avant/après chiffré.
- Modales de saisie : jamais de fermeture au clic extérieur.

## Point de départ mesuré

23.10.2026, 2.30.0 sur le poste de Thomas (Electron 44.9.3, 2 caméras affichées, 10 s) :
page (rendu) **28 % d'un cœur**, processus graphique **29 % d'un cœur et 914 Mo**,
principal 0,2 %, relais 2,7 %. Conditions non contrôlées (fenêtre, écran affiché) — d'où
l'étape 1.

## Étapes

Chaque étape finit par une vérification ; rien ne passe à la suivante sans elle.

1. **Electron 45 + mesure intégrée** (2.31.0). Dès qu'une 45.0.x a au moins une semaine.
   - Montée d'Electron seule côté visuel (preload vérifié : n'utilise aucune API retirée).
   - Le journal note, à intervalle régulier et à chaque changement d'écran, la charge par
     processus (`app.getAppMetrics()`) AVEC son contexte : écran, nombre de tuiles,
     fenêtre visible ou non, fond animé, flou. C'est ce qui rend les avant/après comparables,
     chez Thomas comme chez son père.
   - Terminé quand : `npm test`, construction, installation sur le poste, journal lu.

2. **Inventaire iso-contenu** (`docs/inventaire-ecrans.md`).
   - Chaque écran capturé dans la démo, et chaque information, action et état énumérés
     depuis le source : connexion, mur + panneau Surveillance + rail + bandeau et
     commandes des tuiles, relecture, détections, alertes, réglages, nouveautés, lecteur
     d'extrait.
   - Relevé de l'incohérence actuelle, chiffré : tailles de texte, espacements, rayons,
     styles de boutons distincts dans le code.
   - Terminé quand : chaque écran a sa liste, relue contre le composant.

3. **Deux maquettes contrastées** (`docs/maquette-ux.html`), mur + relecture d'abord.
   - A « Alcor abouti » et B « sobre, vidéo d'abord », mêmes données fictives, même
     contenu ; la disposition (navigation, panneau, actions globales et par tuile) est
     repensée dans les deux.
   - Thomas tranche sur pièces ; puis la direction retenue est étendue aux autres écrans,
     validée à son tour.

4. **Système de design en code**.
   - Jetons (échelle typographique, espacements, rayons, élévations, couleurs) et
     composants partagés : bouton, bouton-icône, barre d'outils, panneau, section,
     pastille, champ, segment, menu, boîte de dialogue, états vide / chargement / erreur.
   - Les règles du compilateur React éteintes (CLAUDE.md, « dette assumée ») se règlent
     au passage, règle par règle, vérifiées sur la mire.

5. **Écran par écran**, une version par groupe : mur + panneau + rail, puis relecture,
   détections, alertes, réglages, connexion et nouveautés.
   - Pour chacun : liste de l'inventaire cochée, captures avant/après, mesures avant/après,
     `npm test`, essai de Thomas sur son poste.

6. **Performances sur PC modeste**.
   - Qualité adaptative mesurée : ciel figé ou ralenti, flou réduit quand la machine peine
     ou que la fenêtre est cachée, rendus React inutiles supprimés.
   - Cibles chiffrées fixées après la mesure de l'étape 1 sur le PC de son père.

## Ce qui n'est pas dans ce chantier

Migration de la clé de signature vers la puce TPM (prévue avec une version proche, sur
demande de Thomas), cloud, Android Auto.
