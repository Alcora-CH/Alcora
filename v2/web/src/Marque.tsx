/**
 * La marque : la plaque d'or, Mizar et Alcor en creux, reliees par le trait des atlas.
 *
 * Meme trace que l'icone Windows (scripts/icone.mjs) et que docs/marque-alcor.svg : les
 * trois doivent rester le meme dessin. `anime` fait pivoter lentement le couple d'astres
 * dans sa plaque — l'icone livree, elle, reste figee : c'est l'ecran qui anime.
 */
export function Marque({ taille = 24, anime = false }: { taille?: number; anime?: boolean }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 64 64" aria-hidden="true"
         className={anime ? 'marque-anime' : undefined}>
      <path fill="var(--accent)"
            d="M18 4H46A14 14 0 0 1 60 18V46A14 14 0 0 1 46 60H18A14 14 0 0 1 4 46V18A14 14 0 0 1 18 4Z" />
      <g className="marque-rotor">
        <circle cx={25} cy={37} r={11} fill="var(--bg)" />
        <circle cx={45} cy={22} r={4.4} fill="var(--bg)" />
        <path d="M35.64 30.12L40.74 26.32L39.66 24.88L34.56 28.68Z" fill="var(--bg)" />
      </g>
    </svg>
  );
}
