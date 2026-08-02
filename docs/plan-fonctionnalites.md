# ProtectViewer — Inventaire de fonctionnalites (maquette finale)

> **Document HISTORIQUE.** Ecrit pour la v1 en C# (WPF/.NET + LibVLCSharp), supprimee du
> depot le 28.07.2026 (decision D3). Les faits d'API du controleur qu'il contient restent
> VALABLES et ont servi de base au portage ; la technologie decrite, non. L'application
> actuelle est en Electron : voir `plan-avancement.html` pour l'etat reel, et
> `decision-pile-technique.md` pour le raisonnement qui a mene d'une pile a l'autre.

> Base : UDM Pro, Protect 7.1.87, G6 Bullet 4K + G5 Turret Ultra 2K, appli WPF/.NET, LibVLCSharp.
> Legende faisabilite : **prouve** (verifie sur ton installation ou dans le code de reference) · **probable** (mecanisme etabli, pas encore teste chez toi) · **incertain** (a valider avant de planifier).
> Tout ce qui n'est pas etaye est marque **[NON VERIFIE]**.

---

## 0. Le principe directeur

Deux API coexistent et **ne partagent pas l'authentification** :

| | API privee | API publique (Integrations) |
|---|---|---|
| Base | `/proxy/protect/api/` | `/proxy/protect/integration/v1/` |
| Auth | cookie `TOKEN`/`UOS_TOKEN` + `x-csrf-token` (login TOTP, session 30 j) | header `X-API-KEY` |
| Contient | bootstrap, historique d'evenements, export video, snapshots d'archive, heatmaps, PTZ presets, lux, reboot | objets appareils appauvris, RTSPS, liveviews, PTZ actions, sirenes, arm-profiles |
| Statut | non documentee, en retrait annonce cote uiprotect | officielle, stable, mais **sans aucun acces a l'historique** |

**Consequence structurante** : une appli de visualisation avec timeline *doit* utiliser l'API privee. La cle API ne peut pas la remplacer. L'architecture doit donc porter **deux clients HTTP** derriere une seule facade (`IProtectClient`), pour pouvoir basculer endpoint par endpoint quand Ubiquiti publiera les manques.

---

## 1. Les six espaces de l'application

| Espace | Role | Contenu principal |
|---|---|---|
| **A. Direct** | Le mur d'images du quotidien | Mosaique, dispositions, plein ecran, zoom numerique, etat des flux, snapshot instantane |
| **B. Detections** | Repondre a « que s'est-il passe ? » | Liste d'evenements filtrable, vignettes, calendrier de densite, filtre par zone dessinee, plaques |
| **C. Relecture** | Revoir et extraire | Lecture d'un evenement, vitesses variables, image par image, export MP4 / image, marque-pages |
| **D. Alertes** | Etre prevenu sans regarder l'ecran | Notifications Windows, regles par camera/horaire, sons, icone de zone de notification, bascule d'alerte |
| **E. Cameras & controle** | Piloter le materiel | Fiche camera, reglages, PTZ presets, projecteur/lampe, talkback, sante NVR et disques |
| **F. Systeme** | Que ca marche tout seul | Connexion et session, decouverte auto, demarrage Windows, multi-ecran, mises a jour, diagnostic |

---

## 2. Inventaire detaille

### A. Espace DIRECT

| Fonctionnalite | Ce que ca t'apporte | Mecanisme | Faisab. | Effort |
|---|---|---|---|---|
| **Mosaique dynamique 1x1 / 2x1 / 2x2 / 3x3** | Toutes les cameras a l'ecran en permanence | `UniformGrid` WPF, 1 `MediaPlayer` par tuile, **une seule instance `LibVLC` partagee** (les options `--rtsp-frame-buffer-size=16000000` et `--avcodec-hw=d3d11va` sont des options d'instance, pas de player) | prouve (fait) | faible |
| **Choix de canal selon la taille de tuile** | Pas de 4K decode dans une vignette de 300 px | `camera.channels[]` du bootstrap, `ChannelHeadroom = 2.0` | prouve (fait) | faible |
| **Plein ecran d'une tuile au double-clic + bascule High** | Le geste le plus utilise de l'appli | Promotion de la tuile + reouverture sur le canal High | prouve (fait) | faible |
| **Zoom numerique de qualite (douleur n°2)** | Lire une plaque ou un visage sans bouillie de pixels | **Recadrer, jamais agrandir** : rester sur le canal High et cropper (`--video-filter=croppadd` avec crop dynamique, ou `RenderTransform` si le decodage reste natif). Ne jamais re-encoder ni downscaler avant zoom | probable | moyen |
| **Deplacement direct dans l'image zoomee** | Glisser-deposer a la souris au lieu de la mini-carte ridicule de Protect | Le rectangle de crop suit le drag ; molette = niveau de zoom | probable | faible |
| **Snapshot instantane** | Une image en un clic | `MediaPlayer.TakeSnapshot()` (live) ou `GET /proxy/protect/api/cameras/{id}/snapshot?ts=&force=true&w=&h=` | prouve | faible |
| **Indicateur d'etat par tuile** | Savoir si c'est calme ou casse | Evenements `EncounteredError` / `EndReached` du `MediaPlayer` + etat de la session API | probable | faible |
| **Reconnexion automatique avec backoff** | Le flux repart seul apres une micro-coupure Wi-Fi ou un reboot UDM | Reouverture avec backoff exponentiel + **re-resolution de l'URL RTSP** (l'alias peut changer) | probable | moyen |
| **Dispositions redimensionnables (Grid + GridSplitter)** | Une grande vue + des vignettes | `Grid` a lignes/colonnes en etoile, splitters dans **leurs propres lignes dediees**, `ShowsPreview=false` (defaut) | prouve | moyen |
| **Presets de disposition nommes** | « Jour », « Nuit », « Entree » | JSON local dans `%LOCALAPPDATA%\ProtectViewer\layouts.json` | prouve | faible |
| **Fenetres detachees / multi-moniteur** | Une camera plein ecran sur le 2e ecran pendant qu'on travaille | Nouvelle `Window` WPF + `VideoView` + `MediaPlayer`, tous issus de l'instance `LibVLC` partagee | probable | moyen |
| **Bascule automatique sur la camera qui declenche** | L'ecran va tout seul la ou ca se passe | WS `/proxy/protect/integration/v1/subscribe/events` (JSON, cle API) → promotion de tuile, avec anti-rebond 15-30 s et priorite sonnette > personne > mouvement | probable | moyen |
| **Cycle automatique entre cameras** | *(gadget a 2 cameras — voir §3)* | Double-buffering (K+1 players), jamais fermeture/reouverture | probable | moyen |

**Points durs de cet espace** — voir §6 : airspace WPF, contradiction « High au focus » vs fenetre detachee, audio double.

---

### B. Espace DETECTIONS

| Fonctionnalite | Ce que ca t'apporte | Mecanisme | Faisab. | Effort |
|---|---|---|---|---|
| **Liste d'evenements** | La table des matieres de ta surveillance | `GET /proxy/protect/api/events?types[]=&start=&end=&limit=&offset=&orderDirection=DESC` | prouve | faible |
| **Saut d'evenement en evenement** | Ne plus faire glisser un curseur sur 8 h de noir. **Meilleur rapport valeur/effort du projet** | Liste triee en memoire, boutons Precedent / Suivant qui positionnent sur `event.start` | prouve | faible |
| **Filtres camera / type d'objet / plage horaire** | Diviser le bruit par dix | Filtrage client sur `type`, `smartDetectTypes[]`, `camera`, heure | prouve | faible |
| **Vignettes d'evenements** | Parcourir dix fois plus vite | `GET /proxy/protect/api/events/{id}/thumbnail?w=&h=` — **toujours dimensionner** | prouve | faible |
| **Apercu anime au survol** | Eviter d'ouvrir 90 % des clips | `GET /proxy/protect/api/events/{id}/animated-thumbnail?keyFrameOnly=true&speedup=10&w=&h=` (GIF) | prouve | faible |
| **Score et metadonnees** | Trier par pertinence | Champs `score`, `metadata`, `smartDetectTypes[]`, `subCategory` de `/events` | prouve | faible |
| **Superposition heatmap** | Voir ou ca a bouge dans l'evenement | `GET /proxy/protect/api/events/{heatmapId}/heatmap` (PNG) — **uniquement pour les evenements `motion`** | probable | moyen |
| **Filtre par zone dessinee** | « Que s'est-il passe au portail ? » | **Pas la heatmap** : intersection du rectangle avec `metadata.detectedThumbnails[].coord` deja present dans la reponse `/events`. Zero requete supplementaire. Necessite un etalonnage prealable de la semantique de `coord` **[NON VERIFIE : unites, origine, canal de reference]** | incertain | moyen |
| **Filtre plaque / couleur / type de vehicule** | Retrouver la camionnette blanche de mardi | `metadata.detectedThumbnails[].group.matchedName` (plaque + confiance) et `.attributes` (`color`, `vehicleType`, `zone`, `trackerId`). **Fenetre bornee (24 h – 7 j) uniquement** | probable | moyen |
| **Piste de detection image par image** | Trajectoire, vitesse, lignes franchies | `GET /proxy/protect/api/events/{id}/smartDetectTrack` — a n'appeler qu'a la demande, jamais en masse | prouve | moyen |
| **Calendrier de densite** | Rattraper un retour de vacances | Agregation client des resultats `/events` par jour/heure | prouve | moyen |
| **Favoris (locaux)** | Retrouver les evenements marquants | **Base locale SQLite/JSON**, pas de synchro Protect (voir §3) | prouve | faible |
| **Index local d'evenements (option lourde)** | Recherche instantanee sur plusieurs mois | Service de fond suivant le WebSocket, persistance SQLite des evenements smart, recherche servie depuis l'index | probable | eleve |

---

### C. Espace RELECTURE

| Fonctionnalite | Ce que ca t'apporte | Mecanisme | Faisab. | Effort |
|---|---|---|---|---|
| **Relecture d'un evenement** | Revoir un declenchement | `GET /proxy/protect/api/video/export?camera={id}&start={ms}&end={ms}&channel={n}` → fichier local → LibVLC. Mesure reelle : **13,6 Mo / 16 s pour 10 s de 4K** | prouve | moyen |
| **Vitesses variables 0,25x – 8x** | Ralentir pour lire une plaque | `MediaPlayer.SetRate()` sur le MP4 local (seekable, verifie) | prouve | faible |
| **Avance image par image (avant seulement)** | Saisir l'instant precis | `Pause()` puis `NextFrame()`, avec `:avcodec-hw=none` sur le media d'historique | probable | faible |
| **Recul image par image** | — | Re-ancrage deterministe : `Time = ancre` puis N-1 `NextFrame()`. **Jamais `Time -= 33`** (gel documente) | probable | moyen |
| **Vignette d'archive / scrubbing** | Se reperer sans telecharger | `GET /proxy/protect/api/cameras/{id}/recording-snapshot?ts={ms}&w=&h=` (instant approximatif +/- quelques secondes) | prouve | faible |
| **Export clip MP4** | Transmettre a un tiers, a l'assurance | Meme endpoint `video/export`, ecriture progressive, `timeout=0`, **tranches ≤ 1 h** | prouve | faible |
| **Export timelapse** | Balayer une nuit | `&type=timelapse&fps={4\|8\|20\|40}` (= 60x / 120x / 300x / 600x) | prouve | faible |
| **Export image fixe datee** | Plus souvent demande que la video | `recording-snapshot` avec `w`/`h` | prouve | faible |
| **Export multi-camera d'un meme creneau** | Un dossier horodate coherent | N appels **en serie** (jamais en parallele) sur la meme fenetre | probable | moyen |
| **Marque-pages temporels** | Marquer maintenant, exporter au calme | JSON local (camera, ts, libelle), rendu en jalons | probable | faible |
| **Verrouillage anti-rotation** | Ne pas perdre une sequence importante | Pas d'API de lock : **export automatique** vers un dossier hors retention | probable | faible |
| **Streaming de plage via `ws/playback`** | Lecture immediate au lieu d'un telechargement | `GET /proxy/protect/api/ws/playback?camera=&channel=&start=&end=&format=FMP4` puis commande `resume`, trames fMP4 (247-255). Prototype 2025 fonctionnel, **jamais teste en 7.1.87** | incertain | eleve |

---

### D. Espace ALERTES

| Fonctionnalite | Ce que ca t'apporte | Mecanisme | Faisab. | Effort |
|---|---|---|---|---|
| **Notification Windows avec vignette** | Etre prevenu appli reduite | `Microsoft.WindowsAppSDK` + `AppNotificationManager` (`<WindowsPackageType>None</WindowsPackageType>`), ou `Microsoft.Toolkit.Uwp.Notifications` 7.1.3 pour plus leger | prouve | moyen |
| **Clic sur le toast → ouvre l'evenement** | Sinon c'est du bruit qu'on apprend a ignorer | `AddArgument("eventId", ...)` + handler `NotificationInvoked` abonne **avant** `Register()`, `Dispatcher.Invoke` pour l'UI | prouve | moyen |
| **Vignette dans le toast** | Voir sans ouvrir | `SetInlineImage(uri)` avec un **chemin `file:///` dans `%LOCALAPPDATA%`** (`ms-appx:` est reserve aux applis empaquetees) **[NON VERIFIE pour appli non empaquetee]** | probable | moyen |
| **Boutons d'action** | « Voir le direct » / « Ignorer » | `AddButton(new AppNotificationButton(...))` | probable | faible |
| **Regles par camera / horaire / type** | Ce qui rend les notifications supportables sur la duree | Filtrage local avant emission ; regles JSON. Alternative : deleguer a Alarm Manager cote Protect et ne relayer que ce qui arrive | probable | moyen |
| **Son d'alerte par regle** | Distinguer sonnette et mouvement | `SoundPlayer` sur WAV, uniquement sur regles a fort taux de vrais positifs | prouve | faible |
| **Icone de zone de notification** | L'appli surveille en tache de fond | `H.NotifyIcon.Wpf` 2.4.1 (mode Efficacite Win11, icone dynamique avec badge) ; `Closing → e.Cancel; Hide()` | prouve | faible |
| **Coupure des flux en arriere-plan** | Ne pas decoder 4K pour rien | Deja fait au lot 1 ; garder **uniquement** le canal d'evenements | prouve (fait) | faible |
| **Inhibition de la veille pendant la surveillance** | L'ecran ne s'eteint pas devant le mur d'images | `SetThreadExecutionState(ES_CONTINUOUS \| ES_DISPLAY_REQUIRED \| ES_SYSTEM_REQUIRED)` **depuis le thread UI** | prouve | faible |
| **Accuse de reception d'alerte** | *(gadget a 2 cameras — voir §3)* | Drapeau local par eventId | prouve | faible |

---

### E. Espace CAMERAS & CONTROLE

| Fonctionnalite | Ce que ca t'apporte | Mecanisme | Faisab. | Effort |
|---|---|---|---|---|
| **Fiche camera complete** | Tout voir d'un coup | `GET /proxy/protect/api/cameras/{id}` : channels, isp/osd/led, stats video/wifi/stockage, zones, featureFlags, lenses | prouve | faible |
| **Sante du NVR et des disques** | Anticiper une panne de disque | `nvr.systemInfo` / `storageInfo` / `storageStats` du bootstrap : CPU, memoire, modele, serie, temperature, heures, duree de vie, secteurs defectueux, capacite restante en jours | prouve | moyen |
| **Reglages d'enregistrement / detection** | Modifier sans passer par l'app Ubiquiti | `PATCH /proxy/protect/api/cameras/{id}` (recordingSettings, smartDetectSettings, ispSettings, osdSettings, videoMode, hdrType, micVolume) | prouve | moyen |
| **Incrustation date/heure** | Horodatage grave dans l'image exportee | **Cote camera** via `osdSettings` — surtout pas de re-encodage ffmpeg cote appli | prouve | faible |
| **Luminosite ambiante (lux)** | Savoir si la scene est en mode nuit | `GET /proxy/protect/api/cameras/{id}/lux` — garde sur `featureFlags.hasLuxCheck` | probable | faible |
| **Reboot camera / NVR** | Debloquer sans se lever | `POST /proxy/protect/api/cameras/{id}/reboot`, `POST /proxy/protect/api/nvr/reboot` | prouve | faible |
| **PTZ — pave de presets** | Positions memorisees et patrouilles | Lecture privee `GET /cameras/{id}/ptz/preset` et `/ptz/patrol` (les noms ne sont **que** la), actions publiques `POST /v1/cameras/{id}/ptz/goto/{slot}`, `/ptz/patrol/start\|stop`. Garde sur `featureFlags.isPtz` | prouve | faible |
| **Talkback (parler dans la camera)** | Repondre au livreur | Voie simple : `POST /v1/cameras/{id}/talkback-session` → cible RTP + codec. Voie privee : `GET /proxy/protect/api/ws/talkback?camera={id}`. Codec impose par `camera.talkbackSettings` | probable | eleve |
| **Lampe du module colis / deverrouillage Access** | Confort ponctuel | `POST /cameras/{id}/turnon-flashlight`, `POST /cameras/{id}/unlock` (fire-and-forget) | probable | faible |
| **Liveviews Protect en lecture** | Synchroniser les grilles avec l'app officielle | `GET /v1/liveviews` (layout, slots, cycleMode, cycleInterval) | prouve | faible |

---

### F. Espace SYSTEME

| Fonctionnalite | Ce que ca t'apporte | Mecanisme | Faisab. | Effort |
|---|---|---|---|---|
| **Session qui survit au redemarrage (douleur n°3)** | Ne plus se reconnecter chaque matin | Cookie chiffre DPAPI ; si JWT expire (30 j, pas de refresh token) : re-login `POST /api/auth/login` avec TOTP genere localement (Otp.NET). Gerer `TOKEN` **et** `UOS_TOKEN` | prouve | moyen |
| **Reauthentification sur 401** | Le controleur invalide parfois avant expiration | Tout 401 declenche un re-login, meme cookie apparemment valide | prouve | faible |
| **Decouverte automatique des cameras** | Plus d'inventaire saisi a la main | Bootstrap prive (complet) ou `GET /v1/cameras` + `/v1/cameras/{id}/rtsps-stream`. **Ne jamais coder les resolutions en dur** | prouve | moyen |
| **WebSocket temps reel** | Le coeur reactif de l'appli | Voie officielle : `/proxy/protect/integration/v1/subscribe/events` et `/subscribe/devices` (JSON, cle API). Repli : `wss://{host}/proxy/protect/ws/updates?lastUpdateId={bootstrap.lastUpdateId}` (binaire, ~200 lignes de decodeur C#) | probable | eleve |
| **Demarrage avec Windows en mode reduit** | La surveillance reprend seule | `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` avec argument `--tray` + case a cocher dans les preferences + lecture de `StartupApproved\Run`. **Jamais sans demande explicite de ta part** | prouve | faible |
| **Memorisation du placement multi-ecran** | Retrouver la meme disposition | Persister `DeviceName` du moniteur + ses bornes + `RestoreBounds` ; jamais Left/Top nus | prouve | moyen |
| **Reaction au changement d'ecrans** | Pas de fenetre perdue hors ecran | `SystemEvents.DisplaySettingsChanged` (**evenement statique : se desabonner obligatoirement**) + `DpiChanged` | prouve | moyen |
| **Mode sombre** | Ne pas fausser la perception d'une image nocturne | Deux `ResourceDictionary` + suivi du theme systeme | prouve | faible |
| **Raccourcis clavier** | Espace, F, fleches, +/-, M | `InputBindings` WPF, une demi-douzaine de touches, pas un langage | prouve | faible |
| **Mises a jour automatiques** | Ne pas reinstaller a la main 120 Mo de DLL | Velopack : install dans `%LocalAppData%`, sans admin, deltas Zstandard (seules les DLL modifiees transitent). **Config et base hors du dossier `current`, qui est remplace** | prouve | moyen |
| **Cible .NET 10 LTS** | Support securite jusqu'a nov. 2028 | `net10.0-windows` (.NET 8 et 9 finissent le 10/11/2026) | prouve | faible |
| **Journal de diagnostic** | Comprendre une panne sans devtools | Log structure des appels API, des reconnexions, des codes HTTP | prouve | faible |

---

## 3. Ce qu'il faut ECARTER — et pourquoi

### Refute par les faits (n'existe pas / ne marche pas)

| Idee | Verdict |
|---|---|
| **Timeline multi-camera scrubbable synchronisee** | **Le gros mirage du projet.** Protect n'expose aucun flux de lecture continue. Chaque deplacement de curseur = N exports serveur de plusieurs secondes a plusieurs Go. En prime, les bornes sont calees sur keyframe (10 s demandes → 10,688 s obtenus) et rien n'indique l'instant reel de debut du fichier : deux exports derivent de plusieurs secondes l'un de l'autre. Un « curseur unique » a cette precision serait un mensonge d'interface. **Remplacer par : revue multi-camera a la demande** (choisir un instant + une duree courte, telecharger, lire en local avec offset corrige par ffprobe, tolerance annoncee +/- 2-3 s). |
| **Favoris synchronises avec Protect** | Les champs `isFavorite` / `favoriteObjectIds` sont lisibles (Protect 6.0+) mais **aucun chemin d'ecriture n'existe** : ni dans uiprotect (les `Event` derivent de `ProtectModelWithId` dont `_api_update` leve `NotImplementedError`), ni dans hjdhjd (zero occurrence de « favorite »), ni dans l'OpenAPI officielle. `PATCH /events/{id}` est une extrapolation. En plus, `favoriteObjectIds` au pluriel suggere un favori **par objet detecte**, pas un booleen global. → **Favoris locaux uniquement**, et ne jamais les presenter comme synchronises. |
| **`recordingSchedules`** | Ce n'est pas une cle racine du bootstrap mais un champ **par camera**, vide (`[]`) partout ou il a ete observe, renomme `recordingSchedulesV2` en 7.x, non modelise meme par hjdhjd, et uiprotect le **jette activement** (membre de `STATS_KEYS`). Aucun endpoint. → Non retenu. |
| **WebSocket `/ws/liveview`** | **N'existe pas.** Les seuls WS Protect sont `ws/updates`, `ws/livestream`, `ws/talkback`, et les deux `subscribe` publics. Un « liveview » est un objet de **configuration**, pas un flux. Et Protect ne compose aucune mosaique cote serveur : N cameras = N sockets independants, sans horloge commune. |
| **PTZ joystick libre / position absolue** | L'API privee de mouvement (`POST /cameras/{id}/move`) a ete **supprimee** de uiprotect en janvier 2026 (migration vers l'API publique). Meme a l'epoque, `relative` etait un saut discret borne a 4095 unites, pas un `ContinuousMove` ONVIF. Emuler un joystick = 5-10 POST/s authentifies : saccade, latence, arret imprecis. → **Presets et patrouilles uniquement.** |
| **Smart search par region via heatmap** | Piege majeur : les heatmaps n'existent **que pour les evenements `motion`** — exactement le bruit que la detection intelligente elimine. Les evenements `smartDetectZone` (ceux qui comptent) ont `heatmap_id = null`. Format non specifie (PNG ? JPEG ? PGM selon versions), **resolution inconnue de toutes les sources**, et N+1 requetes. → **Remplacer par le filtre sur `metadata.detectedThumbnails[].coord`**, gratuit et cible sur les bons evenements. Et **ne pas l'appeler « recherche intelligente »** : ca creerait une attente de VMS pro. |
| **Lecture inverse / recul image par image natif** | LibVLC 3.x n'a ni taux negatif ni `PreviousFrame`. Un seek arriere de 5 s rend le meme service. Assumer le renoncement. |
| **Designer de disposition libre (canvas, poignees, PiP, drag fantome)** | Casse par l'airspace : chaque `VideoView` est une fenetre detachee au-dessus du rendu WPF. Les adorners (poignees, cadres de selection) sont **invisibles**, le `ZIndex` est inoperant entre tuiles, les rotations ne sont pas supportees. Y aller imposerait de remplacer LibVLCSharp par une pile FFmpeg/Direct3D : plusieurs semaines. → **Grid + GridSplitter + presets.** |
| **Dewarp fisheye** | Ni la G6 Bullet ni la G5 Turret Ultra ne sont fisheye. Sans objet. |
| **Recherche en langage naturel (« Find Anything »)** | Exige le processeur AI Key cote controleur. Non reimplementable sans pipeline d'embeddings maison. A 2-8 cameras, tu connais tes evenements. |
| **MSIX** | Probleme connu de chargement des plugins natifs LibVLC sous sandbox (issue LibVLCSharp #454) + certificat a importer sur chaque machine. |
| **`CommunityToolkit.WinUI.Notifications`** | Explicitement deprecie sur NuGet. Ne pas confondre avec `Microsoft.Toolkit.Uwp.Notifications`. |

### Disproportionne a ton echelle (2 a 8 cameras)

| Idee | Pourquoi non |
|---|---|
| **Cycle automatique entre cameras** | Existe parce qu'un operateur a 60 cameras pour 9 tuiles. Chez toi tout tient a l'ecran : le cycle ne fait que te faire rater ce que tu regardais, et ajoute des ecrans noirs periodiques + une classe entiere de bugs de cycle de vie LibVLC. **La bascule d'alerte est la bonne version de cette idee.** |
| **Accuse de reception d'alertes** | Fonction de poste de supervision. Ta liste du jour se lit en 30 secondes. |
| **Filigrane / evidence lock / signature** | Chaine de preuve professionnelle. Synology previent d'ailleurs que le filigrane **detruit** sa propre preuve d'integrite. |
| **Multi-profils utilisateurs** | Un PC, un compte applicatif dedie. Complexite pure. |
| **Favoris de cameras (epinglage)** | La liste entiere tient a l'ecran. |
| **Comparaison avant/apres** | Absent des sept VMS etudies sous cette forme. Besoin reel inexistant ici. |
| **Reglages contraste/gamma sur l'image** | Une image nocturne bruitee ne contient pas l'information manquante : eclaircir revele du bruit, pas un visage. |
| **Index local d'evenements sur plusieurs mois** | Chantier separe (service de fond + SQLite + WS). A ne chiffrer que si le besoin de recherche longue durree se confirme reellement. |
| **Tache planifiee pour le demarrage auto** | Une appli **elevee ne peut ni envoyer ni recevoir de notifications Windows App SDK**. La cle Run HKCU est la bonne reponse. |

---

## 4. Jalonnement en lots

Le fil directeur : **d'abord ce qui est independant de l'API (gain immediat, risque nul), puis le socle d'authentification qui debloque tout le reste, puis les couches de valeur, puis le confort.**

### Lot 1 — Mosaique live robuste *(partiellement fait)*
**Fait** : mosaique dynamique, choix de canal par taille, bascule High au focus, fermeture des flux a la reduction.
**Reste a faire** : reconnexion automatique avec backoff, indicateur d'etat par tuile, instance `LibVLC` unique partagee verifiee, politique « une seule vue audible ».
*Pourquoi d'abord* : sans reconnexion, l'appli affiche une image figee et tu ne sais pas si c'est calme ou casse.

### Lot 2 — Zoom numerique et navigation dans l'image *(douleur n°2)*
Crop dynamique sans re-encodage ni downscale, deplacement direct a la souris, molette, snapshot instantane.
*Pourquoi si tot* : **100 % cote client, zero dependance API, zero risque de casse au prochain firmware**, et c'est la douleur la plus concrete. C'est aussi ce qui conditionne l'architecture du rendu — mieux vaut la trancher avant d'empiler des overlays.

### Lot 3 — Socle API et session durable *(douleur n°3)*
Client prive (cookie + CSRF + TOTP + DPAPI + re-auth sur 401) **et** client public (X-API-KEY) derriere une facade unique. Bootstrap, decouverte automatique des cameras, fiche camera, sante NVR/disques. Demarrage Windows en mode reduit + icone de zone de notification.
*Pourquoi ici* : c'est le prerequis absolu de tous les lots suivants. Rien d'autre ne se construit sans lui.

### Lot 4 — Detections
Liste d'evenements, filtres (camera / type d'objet / horaire), vignettes, apercus animes, saut d'evenement en evenement, calendrier de densite, favoris locaux.
*Pourquoi avant la relecture* : le saut d'evenement est le meilleur rapport valeur/effort du projet, et il rend la relecture utilisable. Sans lui, la relecture n'a pas de point d'entree.

### Lot 5 — Relecture et export
`video/export` en telechargement + lecture locale, vitesses variables, avance image par image, `recording-snapshot`, export clip / image / timelapse, marque-pages, export automatique anti-rotation.
*Prerequis bloquant a lever AVANT de planifier ce lot* : **le role du compte applicatif dedie autorise-t-il `/video/export` sur 7.1.87 ?** Tout ce lot en depend.

### Lot 6 — Alertes et integration Windows
WebSocket temps reel (voie publique d'abord), toasts avec vignette et boutons, clic → ouvre l'evenement, regles par camera/horaire/type, sons, bascule d'alerte automatique sur la tuile, inhibition de la veille.
*Pourquoi apres* : les toasts n'ont de sens qu'une fois la liste d'evenements et la relecture en place — sinon le clic ne mene nulle part.

### Lot 7 — Confort et multi-ecran
Fenetres detachees + memorisation du placement, dispositions redimensionnables et presets nommes, mode sombre, raccourcis clavier, export multi-camera, filtre par zone dessinee (apres etalonnage de `coord`).

### Lot 8 — Controle materiel
PTZ presets et patrouilles (si une PTZ arrive un jour), lux, lampe colis, reboot, reglages camera en ecriture, liveviews en lecture.

### Lot 9 — Experimental, sous reserve de sonde prealable
- **`ws/playback`** : sonder l'endpoint sur 7.1.87 (~1 h de travail avec la session TOTP existante). Si 404 → abandonner definitivement. Si `{url}` → chiffrer le portage C# du decodeur de trames (jours, pas heures).
- **Talkback** : codec impose par `camera.talkbackSettings`, encodeur RTP a produire.
- **Index local d'evenements** pour la recherche longue duree.

### Transverse (a chaque lot)
Mises a jour Velopack, cible .NET 10 LTS, journal de diagnostic, tests de non-regression sur reconnexion et fuite memoire.

---

## 5. Specificites de TES cameras a exploiter

### G6 Bullet 4K
| Point | Ce qu'il faut en faire |
|---|---|
| **4K natif (3840x2160)** | C'est **la** raison d'etre du zoom par recadrage. Ne jamais downscaler avant zoom. La difference avec Protect web sera immediatement visible. |
| **Debit VBR reel 7,4 Mbit/s pour un plafond a 16** | **Fait contre-intuitif et decisif** : le bruit au zoom x4 ne vient pas d'un manque de budget de debit. **Augmenter le bitrate cible ne reglera rien.** La seule reponse est : eviter tout re-encodage et tout downscale. |
| **AV1** | Le G6 peut encoder en AV1 ; le decodage materiel AV1 est absent de la majorite des GPU installes. **Verifier le codec effectif** au demarrage et forcer H.264 cote Protect si necessaire. Le RTSP H.264 est deja prouve sur tous les canaux chez toi. |
| **`featureFlags.hasLuxCheck`** | Si present, afficher l'illuminance pour savoir si la scene est en mode nuit (utile pour interpreter une image bruitee). |
| **HDR (`hdrType` auto/on/off)** | Modifiable via `PATCH`. Sur une scene contre-jour (entree, portail), c'est le reglage qui change le plus le resultat. Exposer un bouton dans la fiche camera. |
| **`videoMode`** | Modes `default / highFps / sport / slowShutter / lprReflex / lprNoneReflex`. **Les deux derniers sont des modes LPR** (obturation rapide adaptee aux plaques). Verifier lesquels sont proposes par ta G6. |

### G5 Turret Ultra 2K
| Point | Ce qu'il faut en faire |
|---|---|
| **LPR (lecture de plaques)** | **[NON VERIFIE]** — Rien n'etablit que la G5 Turret Ultra fasse du LPR fiable : c'est une camera compacte 2K, pas une LPR dediee. **Test decisif de 10 minutes avant tout code** : filmer un vehicule et lire `metadata.detectedThumbnails[].group.matchedName` dans l'evenement. |
| **Plaques non enregistrees** | **[NON VERIFIE, et c'est le point qui conditionne tout]** — le prefixe « **matched**Name » suggere fortement une correspondance avec la liste des vehicules connus. **Si le champ est null pour une plaque inconnue, la « recherche par plaque » se degrade en « alerte sur vehicules enregistres »**, ce qui est une fonctionnalite entierement differente. A tester en meme temps que le point precedent. |
| **Detections audio** | `smartDetectSettings.audioTypes` : `alrmSmoke`, `alrmCmonx`, `alrmSiren`, `alrmBabyCry`, `alrmSpeak`, `alrmBark`, `alrmBurglar`, `alrmCarHorn`, `alrmGlassBreak`. **Detecteur de fumee et bris de verre sont les deux qui valent une notification a coup sur** — c'est de la surveillance passive gratuite que Protect fait deja et que tu n'exploites probablement pas. |
| **Micro / haut-parleur** | Verifier `isMicEnabled`, `speakerSettings` et surtout `talkbackSettings` (`typeFmt`, `samplingRate`, `channels`, `bitsPerSample`) : **c'est l'appareil qui fait autorite sur le codec**, pas une constante. Si `talkbackSettings` est absent, pas de talkback : ne pas afficher le bouton. |
| **Zones de detection** | `camera.smartDetectZones` + `metadata.detectedThumbnails[].attributes.zone` : croiser les deux permet un filtre « uniquement dans l'allee » sans aucun endpoint de recherche. |
| **`useGlobal`** | **Piege silencieux** : si `camera.useGlobal = true`, les reglages d'enregistrement viennent de `nvr.globalCameraSettings` et un `PATCH` local **peut etre ignore sans erreur**. Verifier ce booleen avant d'exposer les controles dans l'UI, sinon tu auras des boutons qui ne font rien. |

### Commun aux deux
- **`camera.channels[]`** : n'est **pas** toujours au nombre de 3. Ne jamais coder les resolutions en dur.
- **Alias RTSP = mot de passe** : le RTSP de Protect n'a **aucune authentification** sur les ports 7441/7447. Traiter l'alias comme un secret (DPAPI), ne jamais le logger.
- **OSD cote camera** pour l'horodatage grave : cout applicatif nul, aucune perte de qualite, contre un re-encodage ffmpeg destructeur.

---

## 6. Pieges d'implementation majeurs

### 6.1 Airspace WPF / HwndHost — le plus structurant
Chaque `VideoView` est un **HWND natif** pose au-dessus de tout ce que WPF dessine, non clippe par les conteneurs.
- Tout overlay (nom de camera, horodatage, boutons) doit etre **enfant du `VideoView`** : `<vlc:VideoView><Grid>…</Grid></vlc:VideoView>`. Place ailleurs, il est invisible.
- **Adorners invisibles** : poignees de redimensionnement, cadres de selection, fantomes de drag ne peuvent pas se dessiner par-dessus la video.
- **`ZIndex` inoperant entre tuiles** : pas de PiP, pas de tuiles qui se chevauchent.
- **Transformations** : seuls `Translate` et `Scale` uniforme sont supportes. Pas de rotation, pas de skew.
- **`ScrollViewer`, `TabControl`, panneaux virtualises** produisent des artefacts de debordement.
- La `ForegroundWindow` d'overlay utilise `AllowsTransparency=true` → **rendu logiciel** pour cette fenetre, et son alignement est recalcule a chaque `LayoutUpdated`. En 4K plein ecran, c'est un cout reel.
- **DPI mixte** : l'overlay est positionne avec le DPI de la fenetre hote, pas du moniteur cible. Sur portable 150 % + externe 100 %, decalage attendu **[NON VERIFIE empiriquement]**. → **Ne pas mettre d'overlay dans une fenetre detachee tant que ce n'est pas teste sur ton materiel.**

### 6.2 Cycle de vie LibVLC — source n°1 de crash
- **Ordre strict a la fermeture** : `Stop()` → `videoView.MediaPlayer = null` → `mediaPlayer.Dispose()` → puis fermer la `Window`. Cabler sur `Closing`, pas `Closed`. Toute inversion expose aux `AccessViolationException` et aux `Dispose()` qui ne rendent jamais la main.
- **`Stop()` est synchrone et bloquant.** L'appeler depuis un `DispatcherTimer` (thread UI) gele l'interface ; l'appeler depuis un callback LibVLC provoque un deadlock. Pattern officiel : le timer pose une **intention**, le `Play`/`Stop` part sur `ThreadPool.QueueUserWorkItem`.
- **Ne jamais recreer un `VideoView`** lors d'un changement de disposition : garder un pool fixe de players et changer seulement le `Media`.
- Instance `LibVLC` **unique** : `--rtsp-frame-buffer-size=16000000` est une option d'instance. Un `new LibVLC()` par fenetre la perd et retronque les keyframes 4K.
- **Audio double** : deux `MediaPlayer` sur la meme camera = meme audio dephase. Regle « une seule vue audible », les fenetres detachees s'ouvrent muettes. Selection de piste explicite (la video n'est pas forcement en index 0).
- **`--avcodec-hw=d3d11va` global** : mettre `:avcodec-hw=none` par media sur le lecteur d'historique, ou `NextFrame()` reste dans les cas limites.

### 6.3 Bugs serveur documentes sur `/events`
- **Si `types[]` est absent, la pagination du controleur est cassee** et `start`/`end` sont ignores : le serveur balaye tout. **Toujours passer `types[]`**, meme quand on veut « tout ».
- Si `start` est fourni **sans** `end` ni `limit` → **400**.

### 6.4 Limites de `/video/export`
- **Bornes calees sur keyframe** : 10 s demandes → 10,688 s obtenus. **Ne jamais promettre la seconde exacte dans l'UI**, annoncer une marge.
- **Tranches ≤ 1 h**, jamais en parallele : le mode « sans decoupage » de protect-archiver porte l'avertissement explicite *« can cause the Protect application to crash and restart unexpectedly »*. Des UDM Pro ont ete rendues inutilisables par des campagnes d'export.
- **Streaming chunke** : `timeout=0`, ecriture progressive sur disque, jamais en memoire.
- **Trous d'enregistrement** : en mode « detections », les segments disponibles sont concatenes et le temps interne du MP4 ne correspond plus lineairement a l'heure murale **[NON VERIFIE sur ton installation]**. Une plage vide renvoie un 500 « no files found ».
- **Absent de l'API publique**, et Ubiquiti ne l'a pas comble en 7.1 (issue uiprotect #924). Depuis Protect 4.0, l'app officielle utilise `video/prepare` + `video/download`, **qu'aucune bibliotheque maintenue n'implemente** (PR abandonnees en juillet 2025).

### 6.5 WebSocket
- **Voie publique d'abord** (`/integration/v1/subscribe/events`, JSON, X-API-KEY). Le WS prive n'est un repli que si la cle API est refusee par gouvernance (elle exige des droits proprietaire de console).
- **WS prive = protocole binaire proprietaire** : `[header 8o][action frame][header 8o][data frame]`, struct `!bbbbi`, payload potentiellement zlib. ~200 lignes de C# a ecrire, aucune bibliotheque .NET n'existe. **Plafonner l'inflate zlib** — c'est une faille corrigee en amont.
- **`lastUpdateId` obligatoire**, issu du bootstrap. A chaque reconnexion : **refaire un bootstrap**, sinon on rate des deltas silencieusement.
- **Backoff exponentiel obligatoire** : une connexion naive se degrade sans bruit.
- **Ne pas sonder `/events` en remplacement** : latence de plusieurs secondes, la bascule d'alerte perd tout son interet.

### 6.6 Vignettes et heatmaps
Generees **apres la fin de l'evenement** : 404 systematique pendant. Prevoir une boucle de retry, et accepter qu'un evenement plus long que le timeout renverra toujours 404.

### 6.7 Notifications Windows
- Handler `NotificationInvoked` abonne **avant** `Register()`, sinon le premier clic est perdu.
- `NotificationInvoked` arrive sur un **thread d'arriere-plan** → `Dispatcher.Invoke`.
- `args.Argument` arrive en paires `cle=valeur` separees par `&`.
- **Une appli elevee ne peut ni envoyer ni recevoir de notifications** → exclut la tache planifiee avec privileges.
- `Unregister()` dans `OnExit`.
- Vignette : `ms-appx:` / `ms-appdata:` sont **reserves aux applis empaquetees** → chemin `file:///` dans `%LOCALAPPDATA%` **[NON VERIFIE]**.

### 6.8 Multi-ecran
- WPF n'expose **aucune API d'enumeration des moniteurs** (`SystemParameters` ne couvre que l'ecran principal). → `WpfScreenHelper` ou P/Invoke.
- **Positionner PUIS maximiser** : maximiser avant chargement retombe sur l'ecran principal.
- `Screen.Bounds` est en **pixels physiques** ; la conversion vers DIP en tenant compte du DPI **du moniteur cible** est la cause classique de « la fenetre s'ouvre a cheval ».
- Persister `DeviceName` + bornes + `RestoreBounds`, jamais Left/Top nus.
- **`SystemEvents.DisplaySettingsChanged` est statique** : ne pas se desabonner = fuite memoire garantie sur toute la duree du process.

### 6.9 Empaquetage
- Le dossier `current` de Velopack est **remplace a chaque mise a jour** : config, base d'evenements, cache de clips et journaux doivent vivre ailleurs (`%LOCALAPPDATA%\ProtectViewer\data`).
- **Ne pas embarquer les DLL natives LibVLC dans un single-file** : les laisser dans `libvlc\win-x64` et pointer `Core.Initialize(path)`.
- Trimming non supporte en single-file framework-dependent, et WPF se trimme mal de toute facon.

### 6.10 Contradictions a corriger dans le code deja livre
Deux regles du lot 1 casseront des lots ulterieurs :
1. **« Bascule High au focus »** → doit devenir **« High si grande surface OU focus »**. Une fenetre detachee plein ecran sur le 2e ecran n'est jamais focalisee et se retrouverait degradee alors qu'elle est la plus grande vue affichee.
2. **« Fermeture des flux a la reduction »** → doit devenir **par fenetre**. Minimiser la fenetre principale ne doit pas tuer un flux detache.
3. **L'etat de canal doit passer de « par camera » a « par vue »** : sinon la meme camera en petite tuile (Low) et en fenetre detachee (High) se disputent un etat unique. **C'est le vrai cout du multi-ecran**, pas la fenetre WPF elle-meme.

### 6.11 Dette d'API assumee
uiprotect declare l'API privee **heritee et en cours de retrait** et refuse toute nouvelle fonctionnalite basee dessus. hjdhjd reste entierement construit dessus. Miser sur le prive fonctionne aujourd'hui sur 7.1.x, mais : **isoler chaque appel prive derriere l'abstraction**, prevoir une **degradation propre** (masquer la fonction sur 404/401 plutot que planter), et un **test de compatibilite au demarrage** qui affiche « historique indisponible sur cette version de Protect » plutot qu'une pile d'exceptions.

---

## 7. Les trois tests a faire AVANT d'ecrire une ligne de code des lots 4-5

| Test | Duree | Ce qui en depend |
|---|---|---|
| **1. Le compte applicatif dedie peut-il appeler `/video/export` sur 7.1.87 ?** | 10 min | **Tout le lot 5.** Si non, elever le role. |
| **2. `group.matchedName` est-il rempli pour une plaque NON enregistree ?** | 10 min (faire passer un vehicule inconnu) | Toute la valeur du filtre LPR. Si null → « alerte sur vehicules enregistres », pas « recherche par plaque ». |
| **3. Semantique de `metadata.detectedThumbnails[].coord`** (unites, origine, canal de reference) | 30 min (objet a position connue) | Le filtre par zone dessinee. Si l'etalonnage echoue, la fonction tombe. |

Test optionnel, a faire seulement si `ws/playback` est envisage : **sonder `GET /proxy/protect/api/ws/playback?camera=&channel=&start=&end=&format=FMP4`** sur 192.168.1.1 avec la session TOTP existante (~1 h). 404 → abandonner. `{url}` → chiffrer le portage.