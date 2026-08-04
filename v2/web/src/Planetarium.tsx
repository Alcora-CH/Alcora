/**
 * Le Planetarium — le fond anime de l'application, valide sur maquette le 03.08.2026
 * (docs/maquette-fond-anime.html, quatre passes de dosage avec Thomas... le mainteneur).
 *
 * Ce qui vit, du fond vers l'avant :
 *  1. le ciel entier tourne autour de son pole (haut droite) — UN TOUR PAR HEURE :
 *     jamais l'impression de filer, mais apres un the les etoiles ont bouge ;
 *  2. trois profondeurs d'etoiles en parallaxe glaciaire (8-12 min par aller) ;
 *  3. vingt-six etoiles scintillent en decale (~10 s), six brillantes a halo d'or ;
 *  4. une etoile filante toutes les ~3 s — leur brievete est leur realisme ;
 *  5. trois voiles de nebuleuse (or, bleu, violet) qui derivent et s'additionnent ;
 *  6. la Grande Ourse preside — elle ne tourne PAS avec le ciel, c'est la marque —
 *     et Mizar/Alcor battent comme un pouls ;
 *  7. un satellite clignotant traverse toutes les ~90 s.
 *
 * Tout est transform/opacity : le compositeur graphique fait tout, les flux 4K ne
 * sentent rien. prefers-reduced-motion fige l'ensemble (le ciel reste, immobile).
 * L'interrupteur « Fond anime » des reglages demonte simplement ce composant.
 */

const SCINTILLANTES: Array<[string, string, string, string]> = [
  // [gauche, haut, duree de base (x4 en CSS), decalage]
  ['12%', '18%', '2.6s', '0s'], ['31%', '64%', '3.4s', '1.2s'], ['47%', '9%', '2.9s', '2.4s'],
  ['66%', '76%', '3.8s', '.6s'], ['79%', '31%', '3.1s', '3.1s'], ['57%', '44%', '4.2s', '1.8s'],
  ['22%', '86%', '2.8s', '4.2s'], ['8%', '47%', '3.3s', '2.9s'], ['40%', '30%', '3.7s', '.9s'],
  ['88%', '62%', '2.7s', '3.7s'], ['71%', '12%', '3.5s', '1.5s'], ['16%', '71%', '4s', '2.1s'],
  ['52%', '88%', '3.2s', '4.8s'], ['93%', '22%', '2.8s', '.3s'], ['36%', '50%', '3.6s', '2.7s'],
  ['62%', '26%', '2.9s', '4.5s'], ['5%', '8%', '3.9s', '1.1s'], ['84%', '84%', '3s', '3.4s'],
  ['27%', '37%', '4.1s', '.5s'], ['74%', '55%', '2.7s', '2.2s'],
];
const BRILLANTES: Array<[string, string, string, string]> = [
  ['19%', '26%', '4.6s', '0s'], ['45%', '70%', '5.2s', '1.7s'], ['69%', '40%', '4.9s', '3.3s'],
  ['33%', '12%', '5.5s', '2.5s'], ['90%', '74%', '4.4s', '4.1s'], ['10%', '60%', '5s', '.8s'],
];
const FILANTES: Array<[string, string, string, string, string, string]> = [
  // [haut, periode, decalage, angle, portee x, portee y]
  ['14%', '13s', '0s', '16deg', '62vw', '18vw'],
  ['34%', '17s', '5s', '22deg', '56vw', '23vw'],
  ['5%', '19s', '9s', '12deg', '70vw', '15vw'],
  ['52%', '23s', '2.5s', '19deg', '58vw', '20vw'],
  ['24%', '15s', '11s', '26deg', '52vw', '26vw'],
];

export function Planetarium() {
  return (
    <div className="planetarium" aria-hidden="true">
      <div className="plan-ciel">
        <div className="plan-voie plan-p3" />
        <div className="plan-voie plan-p2" />
        <div className="plan-voie plan-p1" />
      </div>
      <div className="plan-voile plan-n1" />
      <div className="plan-voile plan-n2" />
      <div className="plan-voile plan-n3" />

      {SCINTILLANTES.map(([g, h, d, a], i) => (
        <i key={`s${i}`} className="plan-sc"
           style={{ left: g, top: h, '--d': d, '--a': a } as React.CSSProperties} />
      ))}
      {BRILLANTES.map(([g, h, d, a], i) => (
        <i key={`b${i}`} className="plan-sc plan-brillante"
           style={{ left: g, top: h, '--d': d, '--a': a } as React.CSSProperties} />
      ))}
      {FILANTES.map(([h, p, a, r, tx, ty], i) => (
        <div key={`f${i}`} className="plan-filante"
             style={{ top: h, '--p': p, '--a': a, '--r': r, '--tx': tx, '--ty': ty } as React.CSSProperties} />
      ))}

      <div className="plan-satellite" />

      <div className="plan-ourse">
        <svg viewBox="0 0 400 260">
          <circle className="plan-halo-couple" cx="98" cy="67" r="22" fill="rgba(210,162,99,.25)" />
          <g className="plan-traits" stroke="#dad5cb" strokeWidth="1.3" fill="none">
            <path d="M40 40 95 70 150 88 200 95 295 95 300 170 215 160 200 95" />
          </g>
          <g className="plan-astres" fill="#eae6dc">
            <circle cx="40" cy="40" r="3.6" /><circle cx="150" cy="88" r="3.6" />
            <circle cx="200" cy="95" r="3.2" /><circle cx="295" cy="95" r="3.8" />
            <circle cx="300" cy="170" r="3.4" /><circle cx="215" cy="160" r="3.4" />
          </g>
          <g fill="#e6b877" className="plan-couple">
            <circle cx="95" cy="70" r="4.6" style={{ transformOrigin: '95px 70px' }} />
            <circle cx="104" cy="61" r="2.6" style={{ transformOrigin: '104px 61px' }} />
          </g>
        </svg>
      </div>
    </div>
  );
}
