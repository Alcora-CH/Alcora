# Direction artistique — alignee sur UniFi Protect

Valeurs issues du jeu de variables CSS publie par Ubiquiti (919 tokens « desktop »),
et non d'une estimation a l'oeil. Ce qui est extrapole est marque comme tel.
Implementation : `v2/web/src/index.css` (variables CSS). Ce document a longtemps renvoye a
`src/ProtectViewer/Themes/Tokens.xaml`, fichier de la v1 en C# supprimee le 28.07.2026 :
les VALEURS ci-dessous n'ont pas bouge, seul leur point d'application a change.

## Les deux rampes de gris

C'est le point le plus important, et le plus facile a rater.

| Rampe | Usage | Teinte |
|---|---|---|
| **app** | chassis : rail, panneaux, fonds | legerement bleutee, `hsl(214, 8%, L)` |
| **oncolor** | tout ce qui flotte AU-DESSUS de la video | strictement neutre, `hsl(0, 0%, L)` |

Poser une surface bleutee sur une image se repere instantanement. Une pastille
d'horodatage doit utiliser `B.OnBg*` / `B.OnText*`, jamais `B.Bg*` / `B.Text*`.

## Couleurs

| Token | Valeur | Role |
|---|---|---|
| `B.Bg0` | `#131416` | fond principal |
| `B.Bg1` | `#1C1E21` | panneaux, cartes |
| `B.Bg2` | `#282B2F` | menus, survol appuye |
| `B.Bg3` | `#34383D` | champs, pistes de barre |
| `B.Bg4` | `#42474D` | bordure de bouton |
| `B.Text1` | `#F9FAFA` | valeurs, titres |
| `B.Text2` | `#DEE0E3` | libelles |
| `B.Text3` | `#B7BCC2` | tertiaire **et icones** |
| `B.Text4` | `#737C87` | desactive, micro-libelles |
| `B.Divider` | `#12F9FAFA` | blanc a 7 %, **pas un gris opaque** |
| `B.RowHover` | `#05F9FAFA` | survol a 2 % |
| `B.RowSelected` | `#1A4797FF` | bleu a 10 % |
| `B.Accent` | `#4797FF` | action, actif, selection |
| `B.Positive` | `#37BE5F` | en ligne |
| `B.Notice` | `#E79613` | avertissement |
| `B.Destructive` | `#EE6368` | erreur, hors ligne |

**Piege evite :** l'accent du theme sombre est `#4797FF`. Le `#006FFF` que l'on croise
partout est la valeur du theme **clair** ; sur `#131416` il manque de contraste.

## Typographie

Token officiel : `UI Sans, Lato, Arial`. UI Sans est proprietaire et non redistribuable ;
**Lato est le repli designe par Ubiquiti lui-meme**, et il est deja installe sur cette
machine — aucun telechargement necessaire. Repli suivant : Segoe UI.

Graisses disponibles : **400 et 600 uniquement. Il n'y a pas de 500** — ne pas inventer
de Medium.

| Role | Graisse / taille |
|---|---|
| Titre de panneau | 600 / 15 |
| Titre de section | 600 / 13 |
| Libelle, valeur, bouton | 400 / 13 |
| Micro-libelle | 400 / 11 |

## Composition

Protect est **dense**. Une palette parfaite avec des marges Windows par defaut ne
ressemblera pas a UniFi.

- Grille de base : **4 px**, tout est un multiple.
- Hauteur de controle : **32 px** (densite « medium »).
- Ligne libelle/valeur : **28 px**.
- Rayons : **4 px** partout, **8 px** pour ce qui flotte. Pas de 6, pas de 12.
- Bordures : **1 px**, sans exception.
- Icones : 20 a 24 px, au niveau de texte 3.

### Ce qui distingue Protect d'une interface sombre generique

1. La hierarchie passe par la **profondeur de fond**, pas par les bordures. Si tu vois
   tes bordures, tu es alle trop loin.
2. Les separateurs sont du **blanc a 7 %** : le meme pinceau reste juste sur toutes les
   profondeurs. Avec un gris opaque, il en faudrait un par fond.
3. Le survol est a **2 %**. Presque rien.
4. Les icones sont au **niveau de texte 3**, jamais au niveau 1. Le rail est discret,
   le sujet c'est l'image.
5. **Le bleu est rare** : action primaire, element actif, selection. Nulle part ailleurs.
6. La rampe **oncolor** des qu'on passe au-dessus de la video.

## Horodatage sur l'image

Constat qui change la donne : dans Protect, l'horodatage grave dans le flux est incruste
par le **firmware de la camera** (`osdSettings`), pas dessine par l'application. Ni la
police, ni la taille, ni le coin ne sont configurables. **Il n'existe donc aucun rendu
Protect a imiter** : le choix est entierement libre.

Retenu : pastille arrondie decollee du bord (marge 16, rayon 8, fond `OnBg0` a 70 %),
texte en graisse **normale** — le gras trahit le « fait maison », c'est le fond qui doit
porter le contraste.

## Reserve

[NON VERIFIE] Le CSS source est celui des sites publics d'Ubiquiti, pas de l'application
Protect 7.1.87 elle-meme, qui est derriere authentification. Les valeurs sont authentiques ;
leur usage exact dans Protect est une inference raisonnable.
