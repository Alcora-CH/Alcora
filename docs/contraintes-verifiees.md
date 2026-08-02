# Contraintes verifiees sur l'installation reelle

Mesures faites le 21.07.2026 sur l'UDM Pro (192.168.1.1), Protect 7.1.87.
**Ne pas re-supposer ce qui est ecrit ici : c'est mesure, pas deduit.**

## Materiel

| | G6 Bullet | G5 Turret Ultra |
|---|---|---|
| Canal High | 3840x2160 @30 — cible 16 Mbit/s | 2688x1512 @30 — cible 10 Mbit/s |
| Canal Medium | 1280x720 @30 — cible 2 Mbit/s | 1280x720 @30 — cible 2 Mbit/s |
| Canal Low | 640x360 — cible 0,3 Mbit/s | 640x360 — cible 0,4 Mbit/s |
| Debit **reel** High | **7,42 Mbit/s** | **5,93 Mbit/s** |
| Debit **reel** Medium | **1,01 Mbit/s** | **1,34 Mbit/s** |
| Codec | H.264 (pas d'AV1) | H.264 |

Le debit reel est tres inferieur a la cible : l'encodage est a debit variable. **Augmenter le
plafond n'ameliorera pas le zoom** — le bruit vient du VBR, pas d'un bridage.

Consequence pour la mosaique : Medium coute environ 7 fois moins que High tout en gardant de la
marge de zoom. C'est le fondement du choix de canal selon la taille de tuile.

## Video

- **LibVLC 3.x n'ouvre pas `rtsps://`.** Verifie : « VLC ne peut pas ouvrir rtsps://... ».
  ffprobe lit la meme URL sans probleme. On passe donc par le RTSP clair du port **7447**,
  ou l'alias est **identique** a celui du 7441 (verifie sur 4 alias differents).
- **`--rtsp-frame-buffer-size` est obligatoire en 4K.** Le defaut de live555 (250 000 octets)
  tronque les images-cles de la G6, qui font ~750 Ko : *« total received frame size exceeds the
  client's buffer size »*, et **aucune image n'est decodee**. Verifie dans les deux sens.
  Valeur retenue : 16 000 000.
- **Le flux video est en index 2**, apres deux pistes audio (AAC 16 kHz mono, puis Opus 48 kHz
  talkback). Ne jamais supposer que le flux 0 est la video.
- Le RTSP de Protect n'a **aucune authentification**. L'alias dans l'URL est le seul secret, et il
  est identique sur les deux ports. A traiter comme un mot de passe : chiffre au repos, jamais
  dans un journal.

## Authentification

- Un compte **local** UniFi est structurellement mono-facteur : la 2FA n'existe que sur les
  comptes cloud. Un « compte local avec 2FA » n'existe pas.
- Le compte applicatif dedie est donc un compte cloud avec 2FA, dont le **seed TOTP** est stocke
  chiffre (DPAPI) et le code **genere localement**. Login verifie : HTTP 200 en une etape, champ
  `token` dans le corps de `POST /api/auth/login`.
- Session : cookie `TOKEN`, JWT dont `exp` vaut **exactement 30 jours**. Aucun endpoint de
  rafraichissement : a l'expiration, re-login complet (silencieux, puisque le code est genere).
- La **cle API Integrations** ouvre l'API publique mais est **rejetee** sur l'API privee
  (bootstrap 500, events 401). Elle ne peut pas servir a l'historique.
- `/proxy/protect/integration/v1/files/export` existe mais est un stub vide : GET sans corps,
  OPTIONS 204, POST qui se fige. **Ce n'est pas un export video.**

## Historique

- `GET /proxy/protect/api/video/export?camera=&start=&end=&channel=` fonctionne.
  Mesure : 13,6 Mo pour 10 s demandees, MP4 H.264 + AAC seekable.
- **Les bornes sont calees sur les images-cles** : 10 s demandees ont produit 10,688 s puis
  12,236 s selon l'essai. Ne jamais promettre la seconde exacte dans l'interface.
- Decouper en tranches d'une heure au maximum, jamais en parallele : des campagnes d'export ont
  deja fait redemarrer des UDM Pro.
- `recording-snapshot` fonctionne (JPEG ~1 Mo sans parametres : penser a passer `w` et `h`).

## Evenements

- `GET /proxy/protect/api/events` : types observes sur le poste de reference — `motion`, `smartDetectZone`,
  `access`, `videoExported`, `adminActivity`.
- Champs utiles : `camera, start, end, score, type, smartDetectTypes, metadata, thumbnail,
  heatmap, isFavorite, favoriteObjectIds`.
- **Toujours passer `types[]`** : sans lui, la pagination du controleur est defaillante et les
  bornes horaires sont ignorees. Fournir `start` sans `end` ni `limit` renvoie 400.
- Les vignettes et heatmaps ne sont generees **qu'apres la fin** de l'evenement : 404 pendant.

## Environnement

- Electron **33.4.11** (Node 20.18.3 embarque — pas de `WebSocket` global : le client
  temps reel de Protect est ecrit a la main, voir `v2/desktop/protect/websocket.js`).
- Interface : React 19, Vite 8, Tailwind 4. Relais video : mediamtx, WebRTC/WHEP.
- Empaquetage Velopack (`vpk pack`), signature `CN=Alcora` valable jusqu'en 2036.
- Outils presents : ffmpeg/ffprobe 7.1.1, VLC, openssl, git 2.52.

> **Corrige le 31.07.2026.** Cette section decrivait encore la pile de la v1 — .NET SDK,
> `net8.0-windows`, LibVLCSharp — abandonnee le 28.07 et **supprimee du depot** (decision D3).
> C'etait le pire endroit ou laisser une affirmation perimee : ce document se declare source
> de verite, et demande explicitement de ne pas re-supposer ce qui y est ecrit. Le
> raisonnement qui a mene d'une pile a l'autre reste consigne dans
> `decision-pile-technique.md`, ou il a sa place — l'histoire s'y raconte, elle ne s'affirme
> pas ici au present.

## V-Events — journal des detections (mesure du 28.07.2026, Protect 7.1.87)

Mesure faite avec `npm run test:events` sur le controleur reel, deux cameras.

**Acces.** Le compte applicatif dedie lit `/proxy/protect/api/events` sans restriction.
Le Lot 4 tient donc debout.

**Ordre : CROISSANT** — du plus ancien au plus recent. Toute liste antichronologique doit
inverser. C'est l'inverse de ce que le plan supposait.

**`limit` conserve les plus RECENTS.** Non affiche par la sonde, mais deduit de ses
chiffres : fenetre de 24 h contenant 212 evenements, `limit=200` en rend 200 dont le
dernier a l'instant meme du test. Les douze absents sont donc les plus anciens. La
pagination par fenetre glissante est realisable. A reconfirmer si le comportement
paraissait changer.

**Bornes `start`/`end` honorees.** Aucun evenement hors plage sur une fenetre J-3 -> J-2.

**Volume : ~212 a 266 par jour, 1862 sur sept jours.** Une seule journee a produit 428
evenements : la variation est forte, la pagination n'est pas optionnelle. Repartition tres
inegale entre cameras — G6 Bullet 1458, G5 Turret Ultra 328, soit un rapport de 4,4.

**Types reellement emis :** motion (878), smartDetectZone (630), smartAudioDetect (276),
access (51), arming / armed / disarmed (7 chacun), breach (4), adminActivity (2).
Seuls les trois premiers sont des detections de camera ; les autres relevent de la console
et n'ont rien a faire dans un journal de detections.

**Sujets de detection intelligente :** vehicle, licensePlate, person, animal, face,
alrmBark, alrmSpeak.

**Consequence pour V-Audio (Lot 9), partiellement levee :** les deux dernieres entrees sont
des detections SONORES — aboiement et parole — et 276 evenements `smartAudioDetect` existent
deja. Le materiel emet donc bien de l'audio intelligent. Restent a verifier les types
fumee et bris de verre, absents de ce releve.

**Champs d'un evenement :** camera, category, description, end, favoriteObjectIds, heatmap,
id, isFavorite, metadata, modelKey, partition, score, smartDetectTypes, start, thumbnail,
timestamp, type, user.

**Vignettes servies** en `image/jpeg` sur `/proxy/protect/api/events/<id>/thumbnail`.

**Non tranche :** un evenement EN COURS et sa marque (`end` nul) — aucun n'etait actif a
l'instant de la mesure. A reprendre en passant devant une camera. Le code doit de toute
facon traiter `end` absent sans supposer sa presence.

## V-Export — production d'un extrait (mesure du 28.07.2026, Protect 7.1.87)

Mesure faite avec `npm run test:export` sur le controleur reel, camera G5 Turret Ultra.

**Acces.** `/proxy/protect/api/video/export` repond 200 en `video/mp4` au compte dedie.
Le Lot 6 tient debout.

**`Content-Length` present.** Une barre de progression honnete est donc possible, sans
balayage.

**`Range` IGNORE** — la reponse est 200 et non 206, et `Accept-Ranges` n'est pas annonce.
Consequences : aucune reprise apres coupure cote controleur, et aucune lecture anticipee.
Le fichier doit etre obtenu ENTIER avant lecture. En local, en revanche, c'est nous qui
servons l'extrait : les plages y sont donc a implementer de notre cote pour le
deplacement dans la video.

**Pas de faststart.** Ordre des atomes releve sur le fichier reel :
`ftyp -> mdat (3,88 Mo) -> moov (0,01 Mo)`. L'index est en queue, ce qui confirme qu'il
faut tout le fichier avant la premiere image.

**Production : 77,5x le temps reel, 19,1 Mo/s.** C'est le chiffre qui renverse la
contrainte precedente. Cinq minutes de video ont ete produites en 3,9 s (73,9 Mo). Une
detection ordinaire dure une quinzaine de secondes : environ 4 Mo, donc moins d'une demi
seconde. L'absence de faststart, redoutee par le plan, ne se voit donc pas a l'usage pour
la relecture d'une detection. Elle ne redeviendra sensible que sur les extraits longs
(une heure ~ 900 Mo, ~47 s), c'est-a-dire au Lot 7.

**Debit video : environ 0,26 Mo/s, soit ~2 Mbit/s** (3,89 Mo pour 15 s).

**Plage sans enregistrement : HTTP 404**, corps `{"error":502,"operationId":8969}`. Erreur
distincte, donc mappable en erreur typee — pas un 500 opaque.

**CODEC : H.264 (`avc1`) + AAC (`mp4a`).** Releve en descendant reellement
`moov/trak/mdia/minf/stbl/stsd`, et non par recherche d'octets — laquelle donnait un faux
positif `av01`, qui n'est en fait qu'une marque de compatibilite listee dans `ftyp`
(`mp42, mp41, isom, av01`). H.264 et AAC se lisent nativement dans Electron : aucune
conversion n'est necessaire.

**RESERVE LEVEE le 29.07.2026 par V-Frise.** Elle disait : la mesure ne portait que sur la
G5, et la G6 Bullet pouvait encoder en AV1 ou en H.265 — qu'Electron ne sait pas lire.
V-Frise a lu la boite `stsd` de huit extraits, sur les DEUX cameras et a quatre profondeurs
(1 h, 20 j, 45 j, 100 j) : **`avc1` partout**, y compris pour la G6 en 3840 x 2160. Le
risque d'un extrait indechiffrable n'existe pas sur ce materiel.

Le garde-fou du lecteur (« cette sequence ne peut pas etre lue ici », avec proposition
d'enregistrement) reste en place et doit y rester : il ne coute rien, et il couvre le
materiel absent du poste de reference — une camera d'une autre generation, ou un firmware qui
changerait d'encodeur. Simplement, il ne se declenchera pas ici.

## V-Frise — ou y a-t-il de la video ? (mesure du 28.07.2026, Protect 7.1.87)

Mesure preparatoire au Lot 7. Sonde : `v2/desktop/test-frise.js` (lecture seule, GET seuls).
Trois passages ont ete necessaires : les deux premiers portaient des defauts de la SONDE,
pas du controleur. Ils sont consignes plus bas, parce qu'une mesure fausse qu'on croit vraie
coute plus cher qu'une mesure absente.

**1. Mode d'enregistrement : `always` sur les deux cameras.**
La frise est donc une BARRE PLEINE, continue, et les detections ne sont que des reperes
poses dessus. Aucun balayage n'est necessaire a l'usage : les bornes viennent de
l'inventaire. Si le mode passait un jour a « detections seulement », la frise devrait
redevenir un peigne — le code doit lire ce champ, pas le supposer.

**2. Aucune route ne donne les plages enregistrees.**
Quatre candidates repondent 404 franchement (`video/segments`, `cameras/{id}/recording-segments`,
`timeline`, `recordings`). Seule `cameras/{id}` repond (200, 16 Ko) mais c'est la fiche de la
camera, pas une liste de segments. La disponibilite se deduit donc de l'inventaire et, si
besoin, de l'export lui-meme.

**3. `recordingStart` NE DOIT PAS servir de bord gauche.**
Deux champs coexistent et ne disent pas la meme chose :

| champ | valeur mesuree | ce que c'est |
|---|---|---|
| `stats.video.recordingStart`   | 29.06.2026, soit 29 j  | debut de la HAUTE definition |
| `stats.video.recordingStartLQ` | 16.02.2026, soit 162 j | debut de la BASSE definition |

Recherche par dichotomie sur l'export, avec borne vide PROUVEE a 200 jours (HTTP 404) :
la video s'arrete le **16.02.2026 10:25**, soit **0 h d'ecart avec `recordingStartLQ`**.
Suivre `recordingStart` aurait ampute la frise de **133 jours de video existante**.
→ **Bord gauche = `recordingStartLQ`. Bord droit = `recordingEnd`.**

**4. Une periode vide rend un 404 FRANC** (verifie sur une fenetre d'une heure il y a un an).
La frise peut donc se fier au code de retour : pas besoin de mesurer la duree obtenue pour
savoir s'il y avait quelque chose.

**5. Marges des cameras : 2 s avant / 2 s apres — SANS OBJET ici.**
Elles gouvernent la fabrication de clips en mode « detections ». En enregistrement continu
il n'y a pas de clip. La marge de 3 s d'Alcora (Lot 6) ne fait donc pas double emploi.

**6. Le poids en octets ne mesure PAS la qualite.**
Une seconde de video pese de 3,2 a 45,4 Mbit/s selon l'AGE apparent — mais la variation
suit le CONTENU de la scene, pas l'anciennete : la G6 est a 17,1 Mbit/s a une heure et a
45,4 Mbit/s a vingt-huit jours, son maximum. Une nuit immobile se comprime a presque rien,
du feuillage au vent est lourd. Conclusion tiree a tort d'un premier releve de deux points,
puis renversee par douze.

**7. La definition CHUTE au-dela de 29 jours, et brutalement.**
Resolution lue dans la boite `stsd` du fichier obtenu, pas deduite de son poids :

| age de l'extrait | G5 Turret Ultra | G6 Bullet |
|---|---|---|
| 1 heure  | 2688 x 1512 | 3840 x 2160 |
| 20 jours | 2688 x 1512 | 3840 x 2160 |
| 45 jours | **640 x 360** | **640 x 360** |
| 100 jours| **640 x 360** | **640 x 360** |

Soit un facteur **18** en pixels pour la G5 et **36** pour la G6. Ce n'est pas une
degradation progressive : c'est un AUTRE flux, celui de basse definition, seul conserve
au-dela de la retention haute. Protect ne le signale nulle part dans son interface.

**La frontiere tombe exactement sur `recordingStart`.** Ce champ ne marque donc pas le
debut de l'archive mais **la limite entre les deux qualites**. Modele complet pour la frise :

| borne | champ | role |
|---|---|---|
| bord gauche  | `stats.video.recordingStartLQ` | debut de l'archive (162 j) |
| frontiere    | `stats.video.recordingStart`   | fin de la haute definition (29 j) |
| bord droit   | `stats.video.recordingEnd`     | video la plus recente |

**8. Le codec est `avc1` (H.264) PARTOUT**, sur les deux cameras et aux quatre profondeurs
mesurees — y compris sur la G6 Bullet en 4K. Voir la reserve levee en section V-Export.

### Defauts de la sonde, et ce qu'ils enseignent

- **Agent TLS partage.** La sonde coupait la reponse des les en-tetes pour ne rien
  telecharger, sur l'agent persistant du client : les sockets a demi mortes etaient reprises
  au sondage suivant, ou la verification d'empreinte ne trouvait plus de certificat. Les
  deux tiers des sondages ont rendu « empreinte de cle publique differente » alors que le
  controleur repondait parfaitement. **Un agent jetable par sondage** supprime le probleme.
- **Dichotomie sans borne prouvee.** « Il y a 120 jours = certainement rien » avait ete
  DECRETE. Tous les sondages ayant repondu 200, la recherche a converge vers sa propre borne
  de depart, et ce bord de fenetre a ete pris pour une frontiere. **Une dichotomie doit
  prouver sa borne vide avant de commencer.**
- **Lecture des boites MP4.** Deux formes d'en-tete manquaient : taille = 0 (« jusqu'a la
  fin du fichier », dont le traitement etait ecrit mais rendu mort par le garde-fou suivant)
  et taille = 1 (vraie taille sur 64 bits, employee des qu'une boite peut depasser 4 Go —
  `mdat` en tete). Rencontrer l'une des deux arretait le parcours avant `moov`. Le lecteur
  choisit aussi la piste VIDEO explicitement : la premiere `stsd` d'un MP4 est souvent celle
  du SON, dont les champs de largeur et de hauteur existent mais ne veulent rien dire.
  Le lecteur corrige est eprouve hors ligne sur huit cas de structure.

## V-Alertes — le controleur sait-il prevenir ? (mesure du 29.07.2026, Protect 7.1.87)

Mesure preparatoire au Lot 8. Sonde : `v2/desktop/test-alertes.js`.

**1. La liaison temps reel est OUVERTE au compte applicatif.**
`wss://<hote>/proxy/protect/ws/updates?lastUpdateId=<id>` s'etablit avec le cookie de
session. C'etait la question qui pouvait renverser tout le lot : fermee, il aurait fallu
interroger `/events` toutes les cinq a quinze secondes.

**2. Les detections passent bien par ce canal.**
59 trames recues en quelques secondes, de **198 a 15 186 octets**. Les motifs releves dans
leur contenu : `smartDetectTypes`, `smartAudioDetect`, `motion`, `ring`, `event`, `camera`,
`add`, `update`. Le format binaire de Protect n'est pas publie — la sonde releve des motifs,
elle ne decode pas. Le decodeur reste a ecrire.

**3. `lastUpdateId` existe dans l'inventaire** : c'est le point de reprise auquel la liaison
s'accroche, et il permet de ne rien manquer apres une coupure.

**4. Latence : NON MESUREE.** La premiere methode etait mauvaise et il faut le dire — elle
faisait chronometrer a la main (passer devant une camera, revenir appuyer sur une touche).
Avec ~266 detections par jour des trames arrivent en permanence : rien ne permettait
d'attribuer celle qu'on voyait a son passage. Le releve « -82 s » ne veut donc rien dire.
La sonde corrèle desormais elle-meme la trame avec le debut de l'evenement le plus recent,
sans chronometre humain. **A defaut, la mesure se fera dans l'application** : consigner
l'ecart entre l'arrivee d'une trame et le `start` de l'evenement qu'elle annonce.

### Defaut de la sonde, corrige

Ouvrir la liaison temps reel oblige a lever la verification TLS pour tout le processus (le
certificat du controleur est auto-signe). La sonde la RESTAURAIT ensuite, et la connexion
epinglee suivante ne trouvait plus de certificat a verifier : `PinMismatchError`, sonde
morte apres avoir tout mesure. Les requetes ordinaires passent maintenant AVANT l'ouverture
de la liaison, et la verification n'est plus retablie. Meme famille que le defaut d'agent
partage de V-Frise : **une manipulation globale faite pour une mesure contamine les
suivantes**.

## V-Attributs — que sait-on d'une detection ? (mesure du 29.07.2026, Protect 7.1.87)

Mesure preparatoire a l'ecran de detections avance. Sonde : `v2/desktop/test-attributs.js`.
1242 detections intelligentes sur sept jours, 1405 objets detectes (une detection peut en
porter plusieurs).

**Les attributs vivent dans `metadata.detectedThumbnails[]`**, un par objet detecte. Chacun
porte `type`, `confidence`, `coord` (la boite), `objectId`, `trackerId`, et un `attributes`
qui depend du type.

| Attribut | Ou | Valeurs observees sur le poste de reference |
|---|---|---|
| `attributes.objectType` | tous | person 391, vehicle 321, animal 63, face 12 |
| `attributes.vehicleType.val` | vehicule | **suv 221, car 37, van 15, motorcycle 12, bike 6, truck 1** |
| `attributes.color.val` | vehicule | **gray 104, white 80, black 43, blue 18, yellow 7** |
| `attributes.zone` | tous | `[1]` — une seule zone configuree |
| `attributes.trackerId` | tous | suivi d'un objet d'une image a l'autre |
| `attributes.associatedFaceTrackerID` | personne | 17 cas : lie une personne au visage detecte |
| `confidence` | par OBJET | distinct du `score` de l'evenement |

Chaque attribut porte sa PROPRE confiance (`vehicleType.confidence`, `color.confidence`),
souvent tres differente de celle de l'objet.

**Visages** — rares (12 objets en sept jours) mais tres detailles : `blurness`, `faceMask`,
`facePose` (yaw/roll/pitch), `qualityScore`, `faceLandmarks` (10 nombres = 5 points),
`faceEmbed` (**512 flottants** : l'empreinte biometrique elle-meme), `matchedId`.

**Plaques** — la reconnaissance rend une liste de CANDIDATS classes, `topKCandidate`, avec
une confiance par candidat, plus `matchedName` et `group.matchedName`. Les candidats sont
des variantes de lecture optique du meme texte : une recherche par plaque devra donc etre
TOLERANTE aux confusions de caracteres, pas exacte.

**Trajet** — `detectedAreas[].routePath.waypoints` porte le CHEMIN parcouru par l'objet, et
`lastDirection` son vecteur. C'est ce que Protect appelle « Chemin » dans ses etiquettes
superposables. On peut donc dessiner la trajectoire sur une vignette.

**Divers** : `zonesStatus.1.status` (« leave »), la meteo au moment de la detection
(`weather.temperature`, `iconCode`), `hallwayMode`.

### Deux faits qui commandent la conception

**1. Le seuil de confiance a du sens — SAUF pour les sons.**

| sujet | detections | min | mediane | max | valeurs distinctes |
|---|---|---|---|---|---|
| person | 310 | 10 | 65 | 88 | 69 |
| vehicle | 290 | 24 | 74 | 88 | 38 |
| licensePlate | 159 | 35 | 75 | 88 | 29 |
| animal | 63 | 37 | 64 | 88 | 33 |
| face | 18 | 58 | 75 | 81 | 13 |
| **alrmSpeak** | **615** | **0** | **0** | **0** | **1** |
| alrmBark / alrmCarHorn | 3 | 0 | 0 | 0 | 1 |

Les sujets SONORES valent tous zero. Un curseur de seuil applique a eux les ferait tous
disparaitre en silence des le premier cran. **Le seuil ne doit porter que sur les sujets
visuels.** Noter au passage les 615 « parole » en sept jours, soit 88 par jour : c'est le
deuxieme volume apres le mouvement.

**2. Le controleur filtre PAR SUJET, mais pas par score.**
Reference de 624 detections sur sept jours (smartDetectZone) :
- `smartDetectTypes=person` -> **624 devient 310. HONORE.**
- `minScore=80` -> 624, identique. **IGNORE.**

Le filtre par sujet part donc au controleur ; le seuil se calcule ici, sur ce qui est
descendu. Avec ~266 detections par jour, cela impose de filtrer par sujet EN PREMIER.

### Fuite de la sonde, corrigee

Le premier masquage se faisait par NOM DE CLE. `topKCandidate` et `group.id` n'en
contenaient aucun des mots surveilles, et la sonde a serialise leur contenu entier : les
plaques reelles du poste sont sorties en clair dans le compte rendu. Elles ne figurent
nulle part dans le depot.

Corrige par un DOUBLE garde-fou : le nom de la cle, et une expression qui reconnait une
valeur ressemblant a une plaque quelle que soit sa cle. De plus, un objet ou une liste n'est
plus jamais serialise pour affichage — on n'en dit que la forme. Eprouve hors ligne sur les
cas exacts qui ont fui, avec des plaques fictives.
