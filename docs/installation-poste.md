# Installer Alcora sur un PC

A suivre une fois par machine. Compter cinq minutes.

## 1. Faire reconnaitre la signature

Copier le dossier `signature\` (au moins `Alcora-signature.cer`) a cote de
`scripts\`, puis :

```
powershell -ExecutionPolicy Bypass -File scripts\confiance.ps1
```

Sans administrateur, la confiance vaut pour le compte Windows courant, ce qui suffit des
lors que c'est ce compte qui lance l'application. En administrateur, elle vaut pour toute
la machine.

Ce que cela supprime : l'avertissement « editeur inconnu ».

## 2. Installer

Double-cliquer `Alcora-win-Setup.exe`.

L'application s'installe dans `%LOCALAPPDATA%\Alcora` et ne demande rien.

## 3. Autoriser l'application dans la suite de securite

**C'est l'etape qui manque le plus souvent, et la plus deroutante quand on l'ignore.**

Une suite de securite comme Bitdefender bloque la sortie reseau des programmes qu'elle ne
connait pas. Le blocage est silencieux : aucune fenetre, aucune alerte. L'application
affiche alors :

> Un logiciel de securite de ce PC empeche Alcora de sortir sur le reseau.

Mesure faite le 22.07.2026 : **la signature ne suffit pas**. Un certificat auto-signe rend
la signature valide au sens de Windows, mais n'apporte aucune reputation ; Bitdefender
bloquait encore une application dont la signature etait pourtant verifiee.

### Bitdefender

Protection → Pare-feu → Acces aux applications → **Ajouter une application**, puis
autoriser ces deux fichiers :

```
%LOCALAPPDATA%\Alcora\current\Alcora.exe
%LOCALAPPDATA%\Alcora\current\resources\relay\mediamtx.exe
```

Les deux sont necessaires et pour des raisons differentes :

| Fichier | Ce qu'il fait |
|---|---|
| `Alcora.exe` | interroge le controleur en HTTPS : session, inventaire, historique |
| `mediamtx.exe` | lit les flux RTSP des cameras et les convertit pour l'affichage |

N'autoriser que le premier donne une application qui trouve les cameras mais n'affiche
aucune image.

Le chemin `current\` reste le meme d'une mise a jour a l'autre : l'exception tient dans le
temps.

### Autres suites

La demarche est la meme : chercher « controle des applications », « pare-feu applicatif »
ou « regles reseau », et autoriser les deux memes fichiers.

Windows Defender seul n'effectue pas ce blocage : sur une machine sans suite tierce,
cette etape est inutile.

## 4. Verifier

Lancer l'application. Elle doit afficher les cameras en quelques secondes.

En cas de doute, tout est ecrit ici :

```
%APPDATA%\Alcora\journal.txt
```

Une ligne par evenement, en clair. C'est le fichier a demander en cas de panne a distance.
Il tourne automatiquement a 2 Mo et ne grossit donc jamais indefiniment.

## Ce qu'un poste ne partage pas avec un autre

Les identifiants sont chiffres par Windows **pour le compte Windows qui les a saisis**.
Ils ne se recopient donc pas d'un PC a l'autre : chaque poste passe une fois par l'ecran
de connexion, avec son propre compte Protect.
