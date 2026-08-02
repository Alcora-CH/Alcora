# Mettre alcora.ch en ligne

**Etat au 02.08.2026 : les etapes 1 et 2 sont FAITES** (site pousse sur le depot public,
Pages actif, domaine pose, construction verte). Reste la seule etape que seul le
proprietaire du domaine peut faire : le DNS, chez le registraire. Le HTTPS s'active ensuite tout
seul cote GitHub, puis « Enforce HTTPS » est a cocher.

## 1. Poser le site sur le depot des versions

Le depot `alcora-ch/Alcora-releases` est deja public — c'est le bon toit :
le site peut vivre sans que le code soit ouvert.

```bash
# Depuis un dossier vide :
git clone https://github.com/alcora-ch/Alcora-releases.git
cd Alcora-releases
# y copier index.html et CNAME (le contenu de ce dossier site/)
git add index.html CNAME
git commit -m "Site alcora.ch"
git push
```

## 2. Activer GitHub Pages

Sur GitHub : depot `Alcora-releases` → Settings → Pages →
Source « Deploy from a branch » → branche `main`, dossier `/ (root)` → Save.
Dans « Custom domain », saisir `alcora.ch` et cocher « Enforce HTTPS »
(la case n'apparait qu'une fois le DNS propage).

## 3. Le DNS, chez le registraire

Deux enregistrements sur `alcora.ch` :

| Type  | Nom | Valeur                                              |
|-------|-----|-----------------------------------------------------|
| A     | @   | 185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153 |
| CNAME | www | alcora-ch.github.io                             |

La propagation prend de quelques minutes a quelques heures. Le certificat
HTTPS est emis par GitHub tout seul ensuite.

## L'adresse de securite

`SECURITY.md` promet `security@alcora.ch` : creer la redirection chez le
registraire (ou l'hebergeur mail du domaine) AVANT d'ouvrir le depot — une
adresse de contact qui rebondit est pire qu'aucune.
