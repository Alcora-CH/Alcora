# WebRTC entre Electron et le relais local — ce qui marche et pourquoi

Ecrit apres une longue enquete le 22.07.2026. **A lire avant de toucher a la configuration
du relais ou aux options WebRTC d'Electron** : trois « corrections » evidentes cassent tout.

## Le symptome, et pourquoi il trompe

La signalisation reussit : le relais repond, cree la session, connait meme les pistes de la
camera. La page affiche « flux etabli ». Puis rien. Une quinzaine de secondes plus tard, le
relais coupe la source faute de spectateur.

**Aucune erreur nulle part.** Un `catch` sur la connexion ne se declenche jamais, puisque
c'est l'etablissement du media qui echoue, pas la negociation.

## La regle

> Le navigateur **n'emet aucun candidat de boucle locale**. Il n'annonce que ses interfaces
> reseau, adaptateurs virtuels et adresse auto-attribuee `169.254` compris.

Tout decoule de la.

## Ce qu'il faut faire

Dans la configuration du relais :

```yaml
webrtcLocalUDPAddress: :18189                 # toutes interfaces
webrtcLocalTCPAddress: 127.0.0.1:18289        # INDISPENSABLE
```

Le chemin **TCP** est ce qui rend l'ensemble fiable : en TCP le navigateur **compose** vers
l'adresse annoncee, donc `127.0.0.1` lui est directement joignable, sans dependre de
l'interface que la negociation aurait choisie.

## Les trois pieges, tous verifies

### 1. Ne PAS desactiver l'obfuscation mDNS de Chromium

```js
// A NE PAS FAIRE
app.commandLine.appendSwitch('disable-features', 'WebRtcHideLocalIpsWithMdns');
```

Tentant : on croit aider le relais a resoudre les candidats `xxx.local`. En realite le relais
n'a rien a resoudre — c'est le navigateur qui se connecte vers lui. Et sans mDNS, Chromium
enumere toutes les interfaces et le comportement se degrade.

Le comportement par defaut fonctionne. Mesure : un navigateur ordinaire, mDNS actif, se
connecte au premier essai contre la meme configuration de relais.

### 2. Ne PAS restreindre le relais a la boucle locale

```yaml
# A NE PAS FAIRE
webrtcIPsFromInterfaces: no
webrtcAdditionalHosts: [127.0.0.1]
```

Si le relais n'annonce que `127.0.0.1` et que le navigateur n'emet que des adresses
d'interface, **aucune paire n'est joignable**. L'etat passe `checking` puis `failed`.

Motivation initiale de cette restriction : eviter une exception de pare-feu. **Elle est
inutile** — Windows ne filtre pas le trafic d'une machine vers ses propres adresses. Aucune
regle n'existe pour le relais, et cela n'a jamais gene.

### 3. La politique de securite de contenu n'est PAS en cause

`connect-src` ne regit pas la negociation WebRTC. Verifie : sessions etablies, zero
violation signalee, avec la politique complete en place.

## L'etat a journaliser

Le defaut de diagnostic qui a coute le plus cher : ne journaliser que les echecs.

```js
pc.oniceconnectionstatechange = () => trace(`ICE ${pc.iceConnectionState}`);
pc.onconnectionstatechange   = () => trace(`connexion ${pc.connectionState}`);
```

Les deux sont necessaires et disent des choses differentes :

| Observation | Interpretation |
|---|---|
| `ICE checking` puis `failed` | aucune paire d'adresses joignable |
| `ICE connected` mais `connexion` jamais `connected` | paire choisie ou les tests passent mais pas la poignee de main securisee |
| les deux `connected` | tout va bien |

## La methode, pour la prochaine fois

L'experience qui a tout debloque aurait du etre la premiere : **ouvrir une page de test dans
un navigateur ordinaire contre la configuration exacte de l'application**. Elle separe en cinq
minutes « c'est ma configuration » de « c'est Electron ».

A la place, plusieurs correctifs plausibles ont ete empiles — dont deux ont *cree* le probleme
qu'ils pretendaient resoudre.

## Verifie le 22.07.2026

| Point | Resultat |
|---|---|
| Deux tuiles simultanees | `ICE connected` + `connexion connected` |
| Tenue | 0 rupture, sessions stables au-dela de 80 s |
| Bascule de canal | passage medium -> high, anciennes sessions fermees, aucune fuite |
| Debit constate | ~5,5 Mbit/s par tuile en haute qualite |
| Politique de securite | retablie, 0 violation |
