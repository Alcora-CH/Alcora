import type { LucideIcon } from 'lucide-react';
import { Bouton } from '../ui/Bouton';

/**
 * Bouton de commande d'un bandeau video — la tuile du direct, le lecteur de la relecture —,
 * pose dans le BANDEAU DE TITRE et non sur l'image.
 *
 * Trois tentatives, et les deux premieres etaient des variations sur la meme erreur.
 * D'abord 28 px translucides disperses aux quatre coins de l'image ; puis 36 px sur fond
 * franc, reunis en bas a droite. Le retour, les deux fois : « ils se fondent dans le flux
 * video », « on ne les remarque pas bien au survol ». Il avait raison, et il a designe la
 * vraie cause en se demandant si Ubiquiti avait bien pense l'emplacement.
 *
 * Reponse : Ubiquiti n'a pas le CHOIX. Leur interface n'a pas de bandeau au-dessus de
 * l'image, ils doivent donc poser leurs boutons dessus, ou ils lutteront toujours contre
 * une scene qui va du plein soleil a la nuit. Alcora, elle, affiche deja le nom de la
 * camera et sa definition dans un bandeau HORS de l'image. C'est la que ces commandes
 * doivent vivre : visibles en permanence, jamais en concurrence avec la video, toujours au
 * meme endroit. Il n'y a plus rien a decouvrir.
 *
 * Direction « Observatoire » (23.10.2026) : le bouton commun, et son NOM a cote de l'icone
 * — « Revoir », « Detections », « Image », « Son ». Sur une tuile etroite, l'icone seule
 * (requete de conteneur) ; l'etiquette au survol dit alors le reste.
 */
export function BoutonBandeau({ titre, court, icone, onClick, actif, desactive }: {
  titre: string;
  /** Le nom court, a cote de l'icone quand la tuile est assez large. */
  court: string;
  icone: LucideIcon;
  onClick: () => void;
  actif?: boolean;
  desactive?: boolean;
}) {
  return (
    <div className="group/bt relative shrink-0">
      <Bouton
        variante={actif ? 'actif' : 'fantome'} taille="petit" icone={icone}
        /* Le nom commence par ce qu'on lit (« Son ») : une commande vocale qui le dit doit
           trouver le bouton. La forme longue suit, pour le lecteur d'écran. */
        aria-label={`${court} — ${titre}`} disabled={desactive}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        onPointerDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <span className="@max-[680px]:hidden">{court}</span>
      </Bouton>

      {/*
        L'etiquette est POSEE PAR L'APPLICATION, pas par le systeme.
        Celle du systeme met une seconde a venir. Elle s'ouvre vers le BAS : le bandeau est
        en haut de la tuile, une etiquette vers le haut serait coupee par la tuile voisine.

        Elle est calee sur le bord DROIT du bouton, pas sur son centre. Centree, celle des
        deux derniers boutons sortait de l'ecran — ils sont contre le bord droit de la
        tuile, qui est lui-meme contre celui de la fenetre. Calee a droite, elle grandit
        toujours vers l'interieur, quel que soit le bouton et quelle que soit la tuile.
      */}
      <span
        className="pointer-events-none absolute right-0 top-full z-30 mt-1 hidden whitespace-nowrap
                   rounded-md border border-line2 px-2.5 py-1 text-meta group-hover/bt:block
                   group-has-[:focus-visible]/bt:block"
        style={{ background: 'rgba(14,17,22,.96)', color: '#eae5db', boxShadow: '0 4px 14px rgba(0,0,0,.55)' }}
      >
        {titre}
      </span>
    </div>
  );
}
