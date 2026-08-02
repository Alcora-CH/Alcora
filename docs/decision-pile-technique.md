# Decision : construire une 2.0 en Electron, en parallele de la 1.x WPF

Date : 22.07.2026. Decidee apres mesure, pas par preference.

## Le contexte

La 1.x (WPF/.NET 8 + LibVLCSharp) fonctionne : live multi-flux, zoom par recadrage,
authentification a deux facteurs automatique, decouverte, installeur avec mises a jour.
Elle donne satisfaction, **qualite video jugee impressionnante**.

Sa question portait sur l'apparence et l'outillage, pas sur la video.

## Les deux raisons invoquees ne tenaient pas

**Les mises a jour.** Velopack produit des deltas de **570 Ko sur une application de 139 Mo**,
sans elevation de privileges. Chez electron-updater, la question « les deltas sont-ils supportes
sous Windows ? » a ete fermee sans reponse par les mainteneurs. Velopack est devant, et il sait
empaqueter Electron : **on le garde en 2.0**.

**Le « look professionnel ».** C'est 80 % du design, deja fait et documente
(`design-tokens.md`), et 20 % de technologie. L'ecart ressenti venait des ecrans pas encore
ecrits, pas du cadre.

## La vraie raison, que personne n'avait mise dans la balance

**L'airspace.** La video est une fenetre native posee au-dessus du rendu WPF. Consequences :

- Le **fantome de glisser-deposer est impossible** au-dessus d'une tuile — or il est valide
  dans la maquette.
- Pas d'image-dans-l'image, pas de tuiles superposees, pas de frise posee sur la video.
- Cout de **1,5 a 2x** sur les ecrans denses des lots 4 a 7.

C'est le seul argument technique serieux, et il est amplifie par le fait que l'interface a
imiter est elle-meme une application web.

## Les trois tests, faits le 22.07.2026

### 1. Le relais RTSP vers le navigateur — PASSE

`mediamtx v1.19.2` devant `rtsp://192.168.1.1:7447/<alias>` :

```
[path g6] [RTSP source] started
[path g6] stream is available and online, 3 tracks (MPEG-4 Audio, Opus, H264)
[path g6] RTP packets are too big (64988 > 1440), remuxing them into smaller ones
```

Cette derniere ligne est **la meme cause racine** que le reglage `--rtsp-frame-buffer-size`
de la 1.x : Protect emet des paquets RTP surdimensionnes. mediamtx le gere nativement.

L'anomalie go2rtc #2071 sur les points d'acces Protect non standards ne concernait pas
mediamtx. go2rtc n'a pas eu besoin d'etre essaye.

### 2. Le zoom sans perte — PASSE

| Mesure | Resultat |
|---|---|
| Flux recu en WebRTC | 3840x2160, 30 i/s, **0 image perdue** |
| Recadrage `drawImage` | **960x540 pixels reels** extraits du 4K |
| Cadence de la boucle | 303 images en 10 s = **30,3/s** |
| Detail | verifie a l'oeil sur une vue nocturne infrarouge |

`drawImage(video, sx, sy, sw, sh, 0, 0, W, H)` lit la **taille intrinseque** de la source
(`videoWidth`/`videoHeight`), independamment de la taille CSS. C'est garanti par specification,
contrairement a `transform: scale()` dont le comportement depend d'un detail d'implementation
de Chromium et produit un flou transitoire pendant une animation.

**Piloter la boucle avec `requestVideoFrameCallback`** en production : une passe par image recue.
Attention, il ne se declenche que si la video est reellement PRESENTEE — un element en
`display:none` ne le declenche jamais (constate pendant ce test).

### 3. La tenue — bonne, une inconnue restante

| Mesure | Resultat |
|---|---|
| Memoire mediamtx | 57 Mo |
| Processeur mediamtx | 6,1 s sur 329 s = **1,9 % d'un coeur** |
| Sessions RTSP vers l'UDM | **1 seule**, quel que soit le nombre de spectateurs |

La consommation confirme l'absence de reencodage. Le regroupement amont fonctionne.

**[NON VERIFIE] Le decodage materiel cote navigateur.** Les statistiques WebRTC ne rapportaient
ni `decoderImplementation` ni `powerEfficientDecoder` dans le panneau d'apercu utilise. Sans
consequence a 2 flux ; **a verifier avant de depasser 4 flux 4K**.

## Ce qu'on garde

- **Velopack** pour les mises a jour (superieur a electron-updater, mesure).
- **`docs/contraintes-verifiees.md`** : tout le savoir acquis y est deja, independant de la pile.
- **`docs/maquette.html`** : 60 Ko de HTML/CSS deja ecrits. En WPF c'etait une reference a
  retranscrire ; en web, c'est le point de depart de l'implementation.
- La logique portable : `Protect/` (TOTP, JWT, epinglage, session, mapper), `Services/`,
  `Models/`. Environ 1 800 lignes, traduction mecanique vers TypeScript.

## Ce qu'on perd

La discipline de cycle de vie de LibVLC (garde synchrone, ordre d'attachement, `Stop()` hors
thread d'interface). Ces heures ne se recuperent pas. Mais ces bugs precis n'existent pas dans
une pile web — on en paiera d'autres.

Le reglage `--rtsp-frame-buffer-size=16000000`, si chèrement trouve, **devient sans objet** :
mediamtx a sa propre pile RTSP en Go et n'a pas cette limite.

## La methode : coexistence, pas bascule

La **1.2.0 reste installee et utilisable** pendant la construction de la 2.0. Canal Velopack
separe, installation parallele. Aucun jour sans outil fonctionnel, arret possible a tout moment
sans rien avoir casse.

## Contrainte ajoutee le 22.07.2026 : une seconde copie, pour un utilisateur non technique

Un proche, pas technicien du tout, aura une copie. Il ne s'y connait pas : **s'il clique, ca doit fonctionner.**
Il sera sur le MEME reseau que l'UDM (pas de tunnel a prevoir) et disposera de son PROPRE
compte Protect dedie, revocable independamment.

Consequences, traitees comme des fonctions et non comme du confort :

- **Le relais est lance par l'application**, embarque dans l'installation. Pas de service
  Windows a installer, pas d'etat a comprendre. Un service separe serait plus « propre » mais
  ajouterait un mode de panne ou l'application dit « pas de video » sans explication.
- **Relance automatique** avec attente croissante plafonnee a 30 s, et etat affiche en
  phrases : « Reconnexion du flux video… », jamais un code.
- **Ports choisis parmi les libres** au demarrage : aucune collision possible avec un autre
  logiciel sur sa machine.
- **`windowsHide`** : aucune fenetre de console, jamais.
- **Arret propre** : un relais orphelin garderait une session ouverte sur le controleur.

Verifie le 22.07.2026 (`v2/desktop/test-relay.js`) : demarrage, publication des deux cameras,
**relance apres mort brutale du processus**, et arret sans session residuelle. Tous les tests
passent.

## Ce qui renverserait la decision

- Le decodage materiel absent au-dela de 4 flux.
- Une instabilite du relais en fonctionnement continu.
