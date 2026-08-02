# Plan de travail — Alcora (suite du chantier v2)

> **Document de REFERENCE, pas d'etat.** Ecrit le 22.07.2026, sous le nom ProtectViewer —
> le produit s'appelle Alcora depuis le 28.07. Il fixe le decoupage en douze lots et les
> principes qui l'ordonnent ; il ne dit PAS ou en est le chantier. Pour cela,
> `plan-avancement.html`, qui est confronte au code a chaque revision.

## Principes d'ordonnancement retenus

1. **Les fondations qui enchérissent avec le temps d'abord.** L'internationalisation pendant que l'interface tient en cinq écrans, et l'assainissement pendant que le dépôt n'a **aucun commit** (vérifié dans plusieurs critiques : `.git` sans `index`, `refs` ni `remote`). Le premier commit est l'unique occasion gratuite de fixer le périmètre et de purger les secrets ; après, c'est une réécriture d'historique doublée d'une rotation de secrets vivants.
2. **Chaque lot se termine par une version installable et testable.** Les briques d'infrastructure invisibles (client authentifié persistant, moteur de téléchargement, canal d'événements) ne forment jamais un lot seules : elles sont accolées à la première fonctionnalité visible qui les consomme.
3. **Toute faisabilité incertaine est précédée d'une vérification courte et isolée** (notée `V-…`), décrite avant qu'on écrive une ligne du lot. C'est la leçon explicite de `webrtc-local.md` : l'expérience qui tranche doit être la première, pas la dernière.
4. **Les décisions produit/juridiques sont sorties des lots** et regroupées ci-dessous, parce que plusieurs lots sont bloqués tant qu'elles ne sont pas prises.

---

## Décisions à trancher par l'auteur (bloquantes)

| # | Décision | Options | Bloque | Recommandation |
|---|----------|---------|--------|----------------|
| D1 | **Emplacement de publication des versions** (contradiction non résolue : l'énoncé donne un dépôt de versions personnel comme existant, `empaquetage.md` dit « aucun emplacement choisi ») | (a) dépôt de versions séparé public ; (b) Releases du dépôt public. **Privé impossible** : Velopack exigerait un jeton embarqué dans un binaire libre = fuite | Lots 11-12 | Dépôt séparé **public** |
| D2 | **Licence + titulaire du droit d'auteur** | MIT / Apache-2.0 / ISC envisagées au départ | Lots 1, 12 | Tranché le 02.08.2026 : **GPL-3.0, © Thomas** |
| D3 | **Sort de la v1** (`src/` C#/WPF, `publish/` = arbre LibVLC redistribué) | Garder comme référence (obligations LGPL 2.1 + notices sur ~1271 fichiers ; `build.mjs` prend l'icône dans `src/…/app.ico` → dépendance à casser) **vs** archiver hors dépôt | Lots 1, 12 | Archiver hors dépôt, déplacer l'icône |
| D4 | **Langues cibles de l'application** | fr + en ? + de/it pour la Suisse (le poste vise `fr-CH`/`de-CH`) ? | Lot 2 (catalogues, garde de build) | fr + en au minimum |
| D5 | **Langue du dépôt public** (README, docs) | fr / en / bilingue. Public Ubiquiti majoritairement anglophone ; corpus 100 % en français | Lot 12 | en pour le README, fr conservé pour `docs/` |
| D6 | **Nom du projet** — « ProtectViewer » contient « Protect », marque Ubiquiti | Garder / renommer. **Le renommer casse le canal de MAJ Velopack** (`packId = ProtectViewer2`) et le chemin `%APPDATA%\ProtectViewer2` | À figer **avant** la première version auto-mise-à-jour (Lot 11) | Garder, avec mention de non-affiliation |
| D7 | **Signature pour diffusion publique** | Auto-signé (SmartScreen ; demander à un inconnu d'ajouter une racine = inacceptable) / OV/EV (coût) / sources seulement | Lots 11-12 | Sources + build non signé documenté, ou OV si budget |
| D8 | **Modèle de mise à jour** | Silencieuse + invitation à redémarrer (déjà promis à l'écran) / auto-apply-restart | Lot 11 | Silencieuse + invitation |
| D9 | **Extraits téléchargés** : emplacement + politique de purge | `Vidéos\` / dialogue mémorisé / dossier applicatif dédié — **jamais** sous `current\` (remplacé par Velopack) | Lot 6 | Dossier dédié hors `current\`, purge + divulgation honnête |
| D10 | **Canal d'export pour le zoom en relecture** | High 4K (~4,9 Go/h, ~1,3 Mo/s) vs Medium (7× moins mais zoom sans perte perdu) | Lot 6 | High pour l'extrait examiné, Medium pour le balayage |

---

## Vérifications isolées (mesures, pas du code)

Chacune précède le lot indiqué et se fait sur le matériel réel, en une session courte. **Aucune n'a été faite à ce jour.**

- **V-Events** (→ Lot 4, ~15 min) : le compte applicatif dédié peut-il lire `/proxy/protect/api/events` sur 7.1.87 ? Ordre réel (DESC ?), `limit`/`offset` honorés, volume/jour, et un événement **en cours** apparaît-il (avec `end` nul) ?
- **V-Export** (→ Lot 6, ~1 h — la plus importante) : (1) le compte dédié peut-il appeler `/video/export` (Test #1, dont dépend tout le lot 5) ; (2) sur une plage **longue** : présence de `Content-Length`, acceptation de `Range`, position de l'atome `moov` (faststart ?), **délai avant premier octet**, débit de production vs temps réel, comportement plage vide (500 « no files found »).
- **V-Opus** (→ Lot 10, ~5 min) : la piste Opus reçue porte-t-elle le micro ou le retour talkback ? Lire `relay.log` (mediamtx journalise « skipping track … MPEG-4 Audio ») + `pc.getStats()`. Vérifier aussi la présence d'audio sur les canaux medium/low.
- **V-Decode** (→ Lot 10, ~10 min) : décodage matériel au-delà de 2 flux — relever `decoderImplementation`/`powerEfficientDecoder` sur un 4K plein écran + la mosaïque. C'est l'une des deux conditions qui renverseraient la pile.
- **V-Alertes** (→ Lot 8, ~1 h) : sonder `/integration/v1/subscribe/events` (clé API) **et** `wss://…/ws/updates?lastUpdateId=` (binaire) jusqu'à la première trame utile ; mesurer la latence événement→trame ; **AUMID/toast sur build INSTALLÉ** (pas `npm start`) ; comportement des minuteries fenêtre cachée.
- **V-Audio** (→ Lot 9, ~10 min) : lire `featureFlags.smart_detect_audio_types` des deux caméras ; nom exact du type d'événement audio ; **audibilité physique** (caméra extérieure vs détecteur intérieur).
- **V-MAJ** (→ Lot 11, ~30 min sur le poste réel) : `Update.exe` franchit-il l'antivirus (Bitdefender bloque en silence des binaires signés) ; AUMID Velopack↔Electron cohérent ; **appliquer un vrai delta 2.0.x→2.0.y sur une seconde machine**.
- **V-Downgrade** (→ Lot 11b) : `AllowVersionDowngrade` — un poste déjà en N revient-il en N-1, et à quel coût (paquet complet obligatoire) ?

---

## Tableau de synthèse des lots

| Lot | Objectif | Dépend de | Vérif. préalable | Terminé quand… |
|-----|----------|-----------|------------------|----------------|
| **1** | Assainissement + mise sous contrôle de version | — | — | Premier commit propre, zéro secret, app inchangée qui build et diffuse |
| **2** | Socle multilingue | D4, D5 | — | Langue commutable, tout le visible traduit, build échoue si trad manquante |
| **3** | Fiabilité du direct | 2 | — | Coupure réseau / veille / mort du relais récupérées avec état clair par tuile |
| **4** | Client persistant + Journal des détections | 3 | V-Events | L'écran Détections liste les vrais événements, filtrables, avec vignettes |
| **5** | Détections : densité, aperçu, recensement | 4 | — | Bande 7 jours + aperçu au survol ; caméra ajoutée/retirée détectée sans figer |
| **6** | Relecture d'un extrait | 4 | V-Export | Choisir un instant, télécharger, lire, zoomer, ralentir, enregistrer |
| **7** | Relecture étendue | 6 | — | Frise, vignettes d'archive, image fixe, timelapse, file d'exports longs |
| **8** | Alertes en direct | 4 | V-Alertes | Notifié d'une vraie détection, application réduite dans la zone de notification |
| **9** | Alertes : confort et audio | 8 | V-Audio | Bascule auto, son distinct, règles ; alertes fumée/bris de verre si le matériel les émet |
| **10** | Confort fenêtre, disposition, entrées | 3 | V-Opus, V-Decode | Géométrie/ordre persistés, raccourcis, écoute, détachement écran |
| **11** | Mise à jour automatique | 1, D1, D6-D8 | V-MAJ, V-Downgrade | Une 2.0.y publiée arrive seule sur une 2.0.x installée |
| **12** | Ouverture publique du dépôt | 1, 2, D2-D5 | — | Un inconnu clone, comprend, construit ; dépôt public |

---

## Lot 1 — Assainissement et mise sous contrôle de version

**Objectif.** Rendre le dépôt *committable* sans jamais y graver de secret ni d'artefact lourd, pendant qu'il n'y a rien à réécrire. Ne change aucune fonctionnalité visible.

**Contenu.**
- **Secrets vivants.** `v2/desktop/test-relay.js` l.17-18 porte deux alias RTSP **réels** en clair (le seul secret d'un flux RTSP sans authentification, à traiter comme un mot de passe). Paramétrer le test (variables d'environnement / lecture du store), **pas** le supprimer : il est cité dans `decision-pile-technique.md` comme la preuve de la supervision du relais. Puis **faire tourner ces alias sur la console** (désactiver/réactiver le RTSP par caméra → l'alias change ; redécouverte obligatoire ensuite).
- **Adresses réelles.** `192.168.1.1` codé en dur dans ~13 fichiers (`store.js:27`, `SetupScreen.tsx:46`, `test-client.js:44`, `errors.js:59`, docs, tests). Retirer des valeurs par défaut → champ hôte **vide** + placeholder, et faire porter la garde `canTest` sur `normalizedHost` (bug latent : `https://` seul rend `canTest` vrai et l'hôte vide).
- **`.gitignore`.** Ajouter, ancrés à la racine : `/publish/` (~284 Mo, arbre LibVLC), `/releases/` (~671 Mo, fichiers > 100 Mo → refus GitHub), `cfg.json`, `t.js`. Vérifier que `v2/desktop/*.js` n'échappe pas aux règles.
- **Brouillons.** Supprimer `t.js` (mais d'abord consigner le bug qu'il documente : dans `relay.js`, le handler `error` d'un spawn raté ne fait qu'écrire au log, `this.child` reste non nul, `state` répond « Flux vidéo prêt » — écouter `close`, remonter `errno`/code de sortie) et `cfg.json` (config mediamtx périmée et contradictoire avec `relay.js`).
- **Garde de complétude des notices** : `notices.mjs` ne balaie que `v2/web` ; corriger le copyright mediamtx (`aler9`, pas `bluenviron`), ajouter Velopack (Update.exe redistribué), Tailwind (CSS livré).
- Premier commit propre.

**Terminé quand…** `git log` montre un unique commit ; un grep `7447/[A-Za-z0-9]{16}`, `192\.168\.`, `(TOKEN|UOS_TOKEN)=` sur l'arbre suivi ne rend rien ; l'application build (`npm run build`) et affiche toujours les deux flux ; l'écran de connexion démarre sur un champ vide utilisable.

**Inconnues à lever.** D2, D3 (au moins pour décider ce que le premier commit emporte). L'historique des versions 1.x (`releases/`) est-il la seule copie (base des deltas) ? → à archiver hors git avant exclusion.

---

## Lot 2 — Socle multilingue

**Objectif.** Externaliser toutes les chaînes pendant que l'interface est petite, et établir le contrat qui permettra d'ajouter une langue par un simple fichier.

**Contenu.**
- **Renderer** : i18next (inliné par Vite, aucun impact sur `build.mjs`), extraction des ~200 chaînes accentuées de `App.tsx`, `SetupScreen.tsx`, `ReglagesScreen.tsx`, `CameraTile.tsx`, `versions.ts`.
- **Processus principal** : **changement de contrat IPC**. Aujourd'hui `errors.js`, `relay.js` et les étapes de `testConnection` fabriquent des **phrases françaises finies** (avec interpolation et pluriels bricolés « caméra(s) trouvée(s) », majuscule injectée dans `TimeoutError`) et les envoient déjà rendues. Faire émettre **clé + paramètres** ; un « lecteur maison » (sans dépendance) traduit côté principal pour les 3 `dialog.showErrorBox` et pour ce qui doit rester monolingue.
- **Décision structurante** : le **journal reste dans une langue fixe** (français, langue de support) même si l'UI change — sinon un `journal.txt` d'un poste étranger devient illisible pour l'auteur. `main.js` journalise aujourd'hui `result.message`/`state.message` (les phrases UI) : les faire journaliser en forme canonique.
- **Nombres/dates/pluriels** via `Intl` avec locale explicite (piège : `Intl` sans argument suit Windows, pas la langue choisie ; `versions.ts` stocke des dates `JJ.MM.AAAA` → `Intl.DateTimeFormat` en UTC pour ne pas reculer d'un jour).
- Sélecteur de langue + persistance (`config.json`), et suivi automatique de la locale Windows (`getPreferredSystemLanguages()`, parcourir la liste ordonnée, normaliser `fr-CH`→`fr`, anglais en dernier recours ; attention aux erreurs précoces avant `app.whenReady`).
- **Garde de build** : `i18next-cli status` échoue si une clé manque dans une langue **plus** un contrôle maison pour le catalogue du processus principal (i18next-cli est aveugle au lecteur maison).

**Terminé quand…** basculer la langue traduit tout le visible (les deux processus, la liste des versions comprise) ; une version installable existe ; le build échoue volontairement si l'on retire une traduction.

**Inconnues à lever.** D4, D5. ICU complet dans le Node d'Electron 33 (test 2 min : `Intl.NumberFormat('de-CH').format(1234.5)`).

---

## Lot 3 — Fiabilité du direct

**Objectif.** Rendre robuste la seule fonctionnalité livrée. Aucune dépendance au client authentifié : tout se joue sur le chemin relais/WebRTC.

**Contenu.**
- **Détection de gel + reprise par tuile.** `whep.ts` ne fait que `console.log` sur `connectionState`, et `setStatus('direct')` résout sur le SDP (pas sur le média). Ajouter : conditionner « direct » à une image réellement décodée (`getStats().framesDecoded`, pas `requestVideoFrameCallback` qui ne se déclenche pas fenêtre cachée) ; un compteur de génération dans les deps de l'effet de connexion pour forcer la réouverture ; fermeture **systématique** de la `RTCPeerConnection` (fuite si `fetch` rejette) ; `DELETE` de la session WHEP via l'en-tête `Location` ; délai borné sur le POST.
- **Ports stables du relais.** Bug racine de « parfois ça repart » : après relance, `freePort` peut reprendre les mêmes ports → `relayBase` identique → React ne re-rend pas → tuiles mortes. Rendre la reprise déterministe.
- **Backoff coordonné** : le superviseur relais a déjà son backoff (30 s) ; la tuile ne doit pas cogner en parallèle. Faire descendre l'état du relais jusqu'à la tuile (props), avec gigue entre tuiles.
- **Réveil après veille** (`powerMonitor` `resume`/`unlock-screen`, anti-rebond, période de grâce réseau) et **reprise sur panne passagère** (remonter la cause réelle depuis `refresh()` au lieu du booléen ; DNS pas monté au démarrage ≠ définitif).
- **Respect du verrouillage anti-tentatives** : `programmerReprise` ignore `retryAfterSeconds` et re-login toutes les ≤60 s ; verrou `notBefore` **partagé par les quatre points d'entrée de login** (reprise auto, bouton Réessayer, `refresh` sur 401, testConnection). Un mot de passe faux ne se retente jamais.
- **Échec d'écriture n'entraîne pas de rafale** : `onSessionChanged` qui échoue laisse la session non persistée → boucle de logins réussis ; entourer le rappel d'un try/catch, garder la session en mémoire entre cycles.
- **Config qui survit à une coupure** : `store.writeConfig` non atomique (temp + `fsync` + rename) et distinguer « fichier absent » (normal) de « illisible » (ne pas écraser une config abîmée, ne pas perdre les `pins` SPKI).
- **Le composant bloqué se nomme** : traiter l'échec de lancement de mediamtx (antivirus/quarantaine) → message typé avec les **deux chemins à autoriser** affichés et copiables. Mesuré (ancien brouillon `t.js`, supprimé le 23.07.2026) : sur un `spawn` d'un binaire absent, l'événement `error` se déclenche mais **pas** `exit` ; seul `close` suit. `relay.js` n'écoute que `exit`, donc `this.child` reste non nul, aucune relance n'est programmée, et l'état ne bascule jamais en erreur. Écouter `close` (avec `errno`/code de sortie), pas seulement `exit`.
- **Surveillance de la liaison** via l'**API locale de mediamtx** (déjà activée, `/v3/paths/list` déjà éprouvé) — pas d'authentification, pas de risque 429.
- **Actualiser sans redémarrer, toujours à portée** : sortir le bloc d'état + un bouton « Réessayer » protégé de l'`aside` (invisible panneau replié et en plein écran) ; le bouton doit réellement forcer la reconnexion (cf. compteur de génération).

**Terminé quand…** débrancher le réseau, mettre en veille, tuer mediamtx : chaque cas affiche un état honnête par tuile et récupère seul ; marteler « Réessayer » ne verrouille pas le compte.

**Inconnues à lever.** Que devient la session WHEP quand la source RTSP amont meurt (mediamtx ferme-t-il les lecteurs, ou média muet à `connected` ?) — 10 min : couper le RTSP amont, journaliser les deux états + `framesDecoded`. `backgroundThrottling` fenêtre cachée.

---

## Lot 4 — Client authentifié persistant + Journal des détections

**Objectif.** Introduire le sous-système d'API historique — **le maillon manquant de tous les lots 4-9** — justifié par le premier écran visible qui le consomme.

**V-Events** d'abord.

**Contenu.**
- **Client persistant.** Aujourd'hui `connecter()` crée un `ProtectClient` local et le jette. Le hisser au niveau module, gérer son cycle de vie face à `protect:retry` et `protect:reconfigure`, partager l'anti-meute (compteur de génération par instance). Ne **jamais** créer un client par requête (deux logins concurrents = 429).
- **Client `/events`** : sérialisation des `types[]` répétés (obligatoires, sinon pagination cassée), bornes, `limit`/`offset`, tri, exclusion par défaut de `access`/`videoExported`/`adminActivity`.
- **Écran Détections** : App.tsx affiche « prochain lot » → construire la liste antichronologique, états vide/chargement/erreur honnêtes (le 400 documenté ne doit pas remonter en `ApiError` nue). Décalage d'horloge contrôleur/PC (`clockOffsetSeconds`, déjà mesuré, jamais utilisé) pris en compte.
- **Filtres** type / caméra / moment. Les pastilles se **dérivent des capacités réelles** (rien en dur) : ne pas afficher « Son »/« Colis » si le matériel ne les émet pas. Anti-rebond + annulation des requêtes en vol ; décider filtrage serveur (types) vs client (caméra), compteur qui ne ment pas.
- **Vignettes** (transport binaire) : la CSP autorise déjà `img-src data: blob:` ; canal IPC binaire ou sous-schéma `app://` + cache LRU + plafond de concurrence + anti-rebond. Gérer le **404 pendant l'événement** (vignette générée après la fin) comme un état « pas encore prête », pas une panne — avec boucle de reprise bornée.
- **Journal sans données personnelles** : `discovery.js` conserve `rtspAlias` et `main.js` le renvoie à la page ; le retirer du contrat IPC ; le pont console→journal doit passer par un registre de valeurs secrètes (l'alias 16 car. est indistinguable par regex).

**Terminé quand…** l'écran Détections affiche les événements réels des dernières 24 h, filtrables par type/caméra/heure, chaque ligne portant sa vignette ou un état « en cours » explicite.

**Inconnues à lever.** Pagination/ordre réels, volume/jour, recouvrement `motion`/`smartDetectZone` (déduplication ?), champ `thumbnail` renseigné sur un `smartDetectZone` (sinon colonne vide sur les lignes qui comptent).

---

## Lot 5 — Détections : densité, aperçu, recensement continu

**Objectif.** Compléter l'espace Détections et fiabiliser l'inventaire.

**Contenu.**
- **Bande d'activité 7 jours** : agrégation **dans le processus principal** (ne pas faire traverser des milliers d'objets par IPC), fenêtre bornée + pagination en série, cache persistant, 4 états de case distincts (rien / hors rétention / pas encore chargé / erreur), fuseau et heure d'été (jour à 23/25 h). Choisir ce qu'une case compte (motion sature).
- **Aperçu animé au survol** : `animated-thumbnail` prend un `thumbnail_id` (pas l'id d'événement), gouverneur de requêtes (anti-rebond, coalescence, annulation, cache), état vide pour l'événement en cours/long. Étiqueter « probable » et prévoir un repli « au relâchement » si la latence est élevée.
- **Recensement continu des caméras** : la vraie difficulté est la **republication non destructive**. Aujourd'hui `discoverAndPublish` fait `relay.stop()` + nouveau superviseur → nouveaux ports → toutes les tuiles tombent. Utiliser l'**API v3 de mediamtx** pour ajouter/retirer un chemin à chaud (à vérifier). Diff réel sur `(id, name, online, channels[].rtspAlias/width)` avant tout redémarrage. Rafraîchir aussi sur échec de flux (un alias périmé a le même symptôme qu'une caméra morte).

**Terminé quand…** une bande hebdomadaire se dessine et se clique vers la liste filtrée ; ajouter/retirer une caméra sur la console la fait apparaître/disparaître sans couper les autres tuiles.

**Inconnues à lever.** mediamtx v1.19.2 permet-il la modification de chemins à chaud sans perturber les sessions WebRTC existantes ? (test ~30 min via l'API, sinon le recensement retombe sur le cycle destructif).

---

## Lot 6 — Relecture d'un extrait

**Objectif.** Le cœur du lot 5 historique : télécharger et regarder un extrait. Lot le plus lourd — jalonner en sous-livrables internes.

**V-Export** d'abord (Test #1 : sans le droit `/video/export`, le lot n'existe pas).

**Contenu.**
- **Chemin de téléchargement en flux** dans le client épinglé (distinct de `getJson`) : `timeout=0` remplacé par une garde d'inactivité + une garde d'attente du premier octet (deux messages), écriture progressive `.part` puis renommage, jamais en mémoire, annulable, rejeu 401 adapté (tronquer et reprendre, pas rejouer sur un fichier partiel), contrôle d'espace disque avant, comportement ENOSPC défini.
- **Lecture locale** : schéma `app://` dédié aux extraits **avec support `Range`/206** (le `servirUi` actuel ignore `Range` et renvoie 200 complet → pas de déplacement dans la vidéo). Décision `moov` : si en queue et pas de Range, lecture différée.
- **Lecteur** : transport (pause, position, vitesses 0,25×–2× puis jusqu'à 8/16× après mesure du décodage), **zoom sans perte pendant la relecture** (réutiliser le recadrage `drawImage`, mais repeindre sur `seeked`/`pause`/changement de zoom — la boucle actuelle ne repeint pas sur vidéo en pause ; effacer le canvas au changement de source), **avance image par image** (`currentTime += 1/fps` ; le recul par re-ancrage exige la carte des images-clés).
- **Choix d'un instant et d'une durée** + **ouverture depuis une détection** (câblage `event.start`→lecteur). Afficher la **marge honnête ±2-3 s** (bornes calées sur images-clés : 10 s demandées → 10,7 puis 12,2 s obtenues ; « ne jamais promettre la seconde exacte »).
- **Enregistrer l'extrait** : `dialog.showSaveDialog`, nom assaini, `.part`+rename, erreurs typées (disque plein / lecture seule / OneDrive).
- **Dossier des extraits + divulgation honnête** (D9) : ces MP4 ne sont **pas** chiffrés ; bouton « ouvrir le dossier » via `openPath` (créer le dossier avant), « vider » via corbeille avec phrase vraie, sort à la désinstallation.
- Erreur typée pour plage vide (500 « no files found »), fréquente sur le clic « quelques secondes avant ».

**Terminé quand…** depuis une détection ou une saisie d'instant, un extrait se télécharge avec progression réelle et annulation, se lit avec zoom et ralenti, et s'enregistre en un fichier retrouvable.

**Inconnues à lever.** Linéarité du temps interne du MP4 en mode « détections » (segments concaténés → l'offset calculé tombe à côté ; **sans remède documenté** — mesurer avant de promettre le positionnement précis). Cadence/base de temps de l'export (`ffprobe` non embarqué : décider offset précis vs tolérance élargie).

---

## Lot 7 — Relecture étendue

**Objectif.** Navigation temporelle et exports volumineux.

**Contenu.**
- **Frise bornée aux enregistrements** : bornes `stats.video.recording_start/end` (lues au bootstrap, à rafraîchir — elles dérivent) ; piège `new Date(null)` = 1970 ; bande pleine seulement en mode continu ; renommer honnêtement « bornes + densité d'événements ».
- **Vignettes d'archive au survol** (`recording-snapshot`, ~1 Mo, `w`/`h` obligatoires, gouverneur de requêtes, cache).
- **Export d'une image fixe datée** (attention : instant approximatif ; l'horodatage vient du firmware OSD ou est incrusté côté client).
- **Export accéléré (timelapse)** `&fps=` (vérifier `type=timelapse` sur 7.1.87) — attention au mode « détections » où une nuit calme n'est pas une nuit accélérée.
- **Découpage automatique en tranches ≤ 1 h, jamais en parallèle** (des exports ont fait redémarrer des UDM Pro) + **file d'attente unique à l'échelle du processus**, avec progression, annulation, reprise, taxonomie d'erreurs par tranche (500-trou = passer, 400/404-reboot = arrêter), et décision produit N fichiers vs un seul (concaténation = remuxeur, recouvrement variable aux jointures — le corpus penche pour N fichiers assumés).
- **Même créneau multi-caméras**, **marque-pages temporels** (locaux, mais l'instant marqué en direct dépend de la latence d'affichage + décalage d'horloge → intervalle avec marge, jamais un point).

**Terminé quand…** on navigue une frise, on survole des vignettes d'archive, on exporte une nuit en accéléré et une longue plage en file d'attente sans jamais paralléliser.

**Inconnues à lever.** Content-Length/Range sur export long (déjà couvert par V-Export), et le mode d'enregistrement réel des deux caméras (continu vs détections) qui décide de la lisibilité de la frise et du sens du timelapse.

---

## Lot 8 — Alertes en direct

**Objectif.** Être prévenu, application réduite.

**V-Alertes** d'abord (canal + AUMID + arrière-plan).

**Contenu.**
- **Canal d'événements temps réel** (voie tranchée par V-Alertes) : voie publique `subscribe/events` (clé API — nouveau secret, nouvel écran d'onboarding, droits propriétaire) **ou** WS privé binaire (~200 lignes : en-tête 8 o, `!bbbbi`, zlib **plafonné**, `lastUpdateId`, **re-bootstrap à chaque reconnexion**). Le WS privé doit passer par l'agent épinglé côté principal (Chromium ignore le pin ; la CSP interdit `wss` depuis le renderer). **Rattrapage par `/events` à chaque reconnexion** + déduplication (le sondage seul est écarté : latence).
- **Séparer relire l'inventaire de republier le relais** (sinon chaque reconnexion coupe la vidéo).
- **Résidence en arrière-plan** : `Tray` (asset d'icône à livrer et copier au build — n'existe pas à l'exécution), fermeture-vers-la-zone (revoir `window-all-closed` → ne plus quitter ; `second-instance` doit **montrer** une fenêtre cachée, pas seulement `focus`), sortie explicite (drapeau `isQuitting`), **suspension des flux** fenêtre cachée (sinon 2×5,5 Mbit/s 24 h/24). Le JWT de 30 jours sans endpoint de rafraîchissement : le chemin 401→relogin doit fonctionner **sans surveillance** sans réveiller le rate-limit.
- **Notifications Windows** : **AUMID** — Velopack pose `velopack.ProtectViewer2` sur le raccourci ; `app.setAppUserModelId` doit correspondre, **sinon toast avalé en silence** (invisible en dev). Routage du clic. Rédaction de la journalisation (`'failed'`).
- **Règles d'alerte** (JSON dans `%APPDATA%`, déjà hors `current\`) + **anti-flood/dédup** (un passage produit motion + smartDetectZone ; arbitrage de priorité ; plage horaire à cheval sur minuit) + « ne plus me prévenir 1 h » à état visible et persistant.

**Terminé quand…** un mouvement réel produit une notification cliquable, l'application réduite dans la zone de notification, sur un build **installé** ; couper le réseau 30 s ne fait pas perdre l'événement en silence.

**Inconnues à lever.** Schéma des messages du canal (portent-ils caméra + type ?), existence/latence réelle de la voie, mort silencieuse du WS (battement de cœur + état « surveillance active depuis… »).

---

## Lot 9 — Alertes : confort et audio

**Contenu.**
- **Basculer sur la caméra déclenchée** (promotion **sans démontage** — la promotion actuelle renégocie le flux ; garder les tuiles montées, piloter par `order`/`gridArea`), anti-rebond 15-30 s vs `sourceOnDemandCloseAfter: 15s` à réconcilier.
- **Son d'alerte distinct** : joué par la page (`silent: true` sur le toast obligatoire ; un fichier personnalisé via toast Windows est une impasse hors MSIX). Bouton « Écouter » + « aucun son » par règle.
- **Boutons et vignette dans la notification** (toastXml + schéma d'URI applicatif enregistré ; nettoyage à la désinstallation ; la vignette n'existe qu'après la fin de l'événement → notifier tôt sans image, ou snapshot immédiat).
- **Alertes sonores caméras (fumée/bris de verre)** — **seulement si V-Audio confirme** que le matériel les émet et les entend. Sinon retirer. Libellé prudent : jamais lu comme une alarme incendie fiable.

**Terminé quand…** une règle bascule l'écran sur la bonne caméra sans coupure, joue un son choisi, et (si applicable) une alarme audio réelle déclenche une notification.

---

## Lot 10 — Confort fenêtre, disposition, entrées

**Objectif.** Regrouper le confort à faible risque et les entrées, une fois les vérifications faites.

**Contenu.**
- **Préférences conservées** : fichier **séparé** (jamais `config.json`, qui porte `pins`/`configured`), écriture atomique amortie.
- **Fenêtre retrouvée** : `getNormalBounds` + drapeaux maximisé/plein écran séparés ; **valider contre `screen.getAllDisplays()`** (intersection avec `workArea`, sinon fenêtre invisible hors dalle — panne « ne s'ouvre plus » pour l'utilisateur cible) ; appliquer **avant** `show()` (sinon renégociation de canal au démarrage) ; ne pas restaurer le plein écran F11 sans synchroniser l'état React.
- **Ouvrir au démarrage de Windows** : `setLoginItemSettings` (lire `executableWillLaunchAtLogin`, pas `openAtLogin`) + **nettoyage à la désinstallation** (le rappel `--veloapp-uninstall` fait `exit(0)` avant tout → entrée Run orpheline sinon) + démarrage discret (dépend du Tray du Lot 8) + gestion du DNS/pare-feu pas prêts à l'ouverture de session (`HostNotFoundError`/`FirewallBlockedError` sont `permanent` → pas de reprise ; à assouplir au démarrage).
- **Réorganiser à la souris + ordre mémorisé** : geste à arbitrer avec le panoramique au zoom (`setPointerCapture`) et le double-clic d'isolement ; **ne pas déplacer le nœud `<video>`** (risque d'arrêt de la boucle de recadrage — piloter par `order` CSS) ; ordre = liste d'ids projetée, fusion sans élaguer les ids momentanément absents.
- **Raccourcis clavier** : garde de saisie obligatoire (l'écouteur est actif pendant SetupScreen), `e.repeat` pour le zoom (autorepeat → renégociations en rafale), notion de sélection/focus à créer pour +/− et Maj+Flèches.
- **Écouter une caméra** — après **V-Opus**. Si l'Opus porte le talkback (probable), il faut un second pipeline (HLS non transcodé, ou ffmpeg → décision lourde) ; sinon simple `muted` piloté + politique « une seule vue audible ». Lire `isMicEnabled`/`micVolume` (sinon bouton mort). Continuité du son à travers la renégociation de canal.
- **Détacher sur un autre écran** — après **V-Decode**. Trancher : la mosaïque continue-t-elle pendant le détachement (sinon décodage doublé) ? `setWindowOpenHandler` refuse aujourd'hui `window.open` → passer par un `new BrowserWindow` côté principal, second point d'entrée d'interface, cycle de vie des fenêtres.
- **Choisir les caméras affichées** (filtre client, se dégrade seul).

**Terminé quand…** géométrie et ordre survivent au redémarrage sur multi-écran ; les raccourcis fonctionnent sans casser la saisie ; l'écoute et le détachement marchent conformément aux mesures.

**Inconnues à lever.** V-Opus, V-Decode ; qu'un `<video>` WebRTC déplacé/détaché survive sans couper la boucle de recadrage (test 10 min).

---

## Lot 11 — Mise à jour automatique

**Objectif.** Brancher réellement Velopack. Aujourd'hui `Update.exe` est installé mais jamais appelé ; l'écran de réglages **ment déjà** (« s'installent d'elles-mêmes »).

**V-MAJ** d'abord (le point décisif est l'antivirus sur `Update.exe`, le maillon qui télécharge, absent de la liste des deux fichiers autorisés).

**Contenu.**
- **Chaîne de build** : premier ajout de dépendance d'exécution → corriger `build.mjs` (`ignore: /^\/node_modules/` exclut tout ; le module natif `.node` de Velopack doit être empaqueté + garde de présence + notice + licence). `VelopackApp.build().run()` **remplace** le bloc `--veloapp-*` fait main (sinon `exit(0)` court-circuite le SDK).
- **Publication** (D1) : `vpk download github` **avant** `pack` (base des deltas, sinon toujours un paquet complet), `pack`, `vpk upload github` **après** ; jeton hors dépôt ; cas « aucune release » toléré. Semer d'abord un `-full` de référence.
- **Client** : `UpdateManager.checkForUpdates` périodique + `download` en arrière-plan + **vérification taille/empreinte native** (gratuite ; ne pas la réimplémenter) + `waitExitThenApplyUpdate` au prochain démarrage.
- **Application propre** : arrêter mediamtx **et attendre sa mort** avant de rendre la main (Velopack remplace `current\`, fichier verrouillé sinon) ; `app.exit(1)` ne passe pas par `before-quit` → relais orphelin.
- **Invitation à redémarrer** (bandeau interactif, pas le bandeau fugace actuel) + **ne pas redémarrer pendant le visionnage** (état plein écran/isolé remonté au principal, avec plafond d'attente et repli sur l'arrêt naturel).
- **Honnêteté** : corriger la phrase mensongère ; état des mises à jour dans les réglages (dernier contrôle, version disponible, « vérifier maintenant » calqué sur `protect:retry`) ; **journal des MAJ** (le succès/échec de l'application vit dans `Update.exe`, processus séparé → déduire au démarrage suivant en comparant `app.getVersion()` à une version mémorisée) ; **réseau coupé / disque plein** = muet si réessayable, parler si actionnable (vérifier que ENOSPC est distinguable via Velopack) ; **contrôle post-MAJ** (le nouveau binaire peut être re-bloqué par l'antivirus — mais `installation-poste.md` affirme l'inverse, à mesurer).
- **Amorçage** : aucune version installée aujourd'hui n'a de client de MAJ → la première version capable de se mettre à jour doit être **installée à la main** ; l'auto-MAJ ne commence qu'à la suivante. À écrire dans la description.

**Terminé quand…** une 2.0.y publiée sur le dépôt de versions est téléchargée, vérifiée et appliquée seule au redémarrage d'une 2.0.x installée sur une **seconde machine**, avec invitation honnête et journal.

**Inconnues à lever.** V-MAJ (antivirus + AUMID + delta réel). Le binding JS expose-t-il `GithubSource` et `ExplicitChannel` ?

**Sous-lot 11b (confort) :** « ce qui a changé après une MAJ » (via version persistée, **pas** `VELOPACK_RESTART` qui ne se met pas si l'utilisateur relance à la main) ; canal de préversion (fonction de **canaux**, pas de `--pre`) ; retirer une version fautive — **après V-Downgrade**, en assumant que le support downgrade doit être livré **avant** qu'une version devienne fautive, et qu'un downgrade = paquet complet.

---

## Lot 12 — Ouverture publique du dépôt

**Objectif.** Rendre le dépôt public compréhensible et constructible par un tiers. En dernier, l'application étant « terminée ».

**Contenu.**
- **LICENSE** (D2) + champ `license` dans les `package.json` ; **README racine** (D5) : à quoi ça sert, capture d'écran, matériel testé, installation, construction depuis les sources, licence.
- **Guide d'installation/contribution** : prérequis non documentés (Node, `npm run install:all`, SDK .NET + `dotnet tool install -g vpk`, signtool, obtention et **version épinglée** de mediamtx — le `.gitignore` renvoie à `docs/` qui est muet) ; scinder `npm run build` en « application » (sans vpk/certificat, réellement accessible) et « installeur » ; point d'entrée réel pour un tiers sans matériel : `npm run web` + simulateur.
- **Prérequis matériel / compatibilité annoncés honnêtement** : « testé sur UDM Pro / Protect 7.1.87 / G6 Bullet + G5 Turret Ultra ; tout le reste inconnu ». Inclure les prérequis **poste** (Windows x64, antivirus à autoriser, décodage matériel > 4 flux non vérifié).
- **SECURITY.md** + **divulgation honnête du stockage** (mot de passe + seed chiffrés DPAPI **pour ce seul compte Windows** ; extraits non chiffrés ; ce que voit un autre processus de la session) + canal de signalement (D1/D2).
- **Mention de non-affiliation Ubiquiti** (README **et** section « À propos » de l'application — aujourd'hui enterrée dans les notices) ; retirer/annoter `design-tokens.md` (revendique un alignement UniFi Protect, tokens Ubiquiti).
- **Relecture des documents** : dater chaque fichier de `docs/` par son époque, réécrire `README.md` interne (périmé, WPF), arbitrer les deux directions artistiques et les deux maquettes, requalifier `plan-lot3.md` (978 lignes de C#). Décider du sort des mesures nominatives (une installation privée identifiable).
- **Sort de la v1** (D3) + notices LGPL si `publish/` conservé.
- Premier push public.

**Terminé quand…** un inconnu clone le dépôt, lit le README, comprend ce que fait l'application et sur quel matériel, et construit l'interface sans poser de question à l'auteur.

---

## Délibérément exclu (et pourquoi)

- **Lecture immédiate sans téléchargement (`ws/playback`)** — faisabilité incertaine (endpoint peut-être inexistant sur 7.1.87, réfuté ailleurs dans le corpus), effort élevé, pour un gain de ~15 s sur un besoin déjà couvert par l'export court + `recording-snapshot`. Réévaluer seulement si une sonde renvoie une première trame fMP4 décodée.
- **Recherche par plaque / filtre par zone dessinée** — reposent sur `metadata.detectedThumbnails[].group.matchedName`/`coord` **jamais mesurés** sur cette installation, et la G5 Turret Ultra n'est pas une caméra LPR dédiée. À ne pas planifier tant qu'une V-Metadata (matchedName sur plaque non enregistrée, sémantique de `coord`, LPR fiable) n'a pas réussi.
- **Timeline multi-caméra scrubbable synchronisée, favoris synchronisés avec Protect, PTZ joystick libre, smart search par heatmap, dewarp fisheye, recherche en langage naturel** — réfutés par les faits dans le corpus (aucun flux de lecture continue, aucun chemin d'écriture, endpoints supprimés/inexistants, matériel absent).
- **Cycle automatique entre caméras, multi-profils, evidence lock, réglages contraste/gamma, index local d'événements longue durée** — disproportionnés à l'échelle 2-8 caméras ; « une image nocturne bruitée ne contient pas l'information manquante ».
- **Concaténation MP4 en un fichier unique pour les exports multi-tranches** — exigerait ffmpeg embarqué (troisième binaire à signer + autoriser antivirus, question de licence), pour des tranches qui se recouvrent de façon variable aux jointures. Livrer N fichiers horodatés assumés.
- **Sauvegarde/restauration du fichier de secrets** — un blob DPAPI `CurrentUser` n'est pas portable ; le proposer serait malhonnête.