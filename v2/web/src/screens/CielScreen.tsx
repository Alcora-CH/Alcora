import { useEffect, useMemo, useRef, useState } from 'react';
import { t, useLangue } from '../i18n';
import type { Cle } from '../i18n/fr';
import type { MajState, Progression, RelayState } from '../types/protect';

/**
 * L'introduction : la Grande Ourse se dessine, puis devient la marque.
 *
 * Chaque etoile est une etape REELLEMENT franchie de la sequence d'ouverture — jamais un
 * minuteur. Une etoile ne s'allume que lorsque son jalon est atteint ET que son plancher
 * de temps est ecoule : au tempo choisi (contemplatif), les etapes rapides sont retenues
 * pour que la figure se lise ; une etape lente retient son etoile, honnetement.
 *
 * Quand les cinq etapes sont franchies, la finale se joue : Mizar, Alkaid, puis Alcor —
 * et le ciel entier zoome en pivotant pour porter Mizar et Alcor exactement sur les deux
 * vides du logo. Les etoiles ne sont pas remplacees par la marque : elles la deviennent.
 *
 * Pendant tout ce temps, la mosaique vit DERRIERE cet ecran : les flux se connectent sous
 * le voile, et la fin de l'introduction decouvre des images deja en mouvement.
 *
 * RIEN NE SE SAUTE. Une version perimee ne doit jamais tourner : ni l'introduction ni la
 * mise a jour ne sont escamotables. Un clic et Échap sortaient d'ici jusqu'au 28.07.2026 —
 * ils laissaient l'ancienne version a l'ecran pendant que la nouvelle se telechargeait,
 * exactement ce que « automatique et sans echappatoire » excluait.
 *
 * Une mise a jour LOURDE (telechargement, controle, installation) prend le centre de
 * l'ecran : c'est elle le sujet, pas la constellation. Le compte rendu etait relegue dans
 * une ligne du coin bas-gauche — il fallait le chercher pour comprendre l'attente.
 */

/** Tempo contemplatif, choisi le 28.07.2026. Un cran par etoile. */
const PAS = 900;

/* Positions reelles (J2000), un seul facteur d'echelle — deux facteurs deformeraient. */
const OURSE = [
  { x: 165, y: 60, r: 3.9 },   // Dubhe
  { x: 160, y: 162, r: 3.5 },  // Merak
  { x: 298, y: 213, r: 3.3 },  // Phecda
  { x: 355, y: 150, r: 2.5 },  // Megrez
  { x: 458, y: 170, r: 3.8 },  // Alioth
  { x: 537, y: 190, r: 3.7 },  // Mizar
  { x: 600, y: 296, r: 3.7 },  // Alkaid
];
/* Alcor est a 11,8 minutes d'arc de Mizar — quatre pixels a cette echelle. On l'ecarte
   comme le font les atlas, pour qu'elle se distingue. */
const ALCOR = { x: 549, y: 177, r: 1.9 };
const SEGMENTS: Array<[number, number]> = [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [4, 5], [5, 6]];

/* Une etoile s'allume TOUJOURS avec le trait qui l'y relie. Megrez referme le chaudron. */
const ALLUMAGE = [
  { etoile: 0, traits: [] as number[] },
  { etoile: 1, traits: [0] },
  { etoile: 2, traits: [1] },
  { etoile: 3, traits: [2, 3] },
  { etoile: 4, traits: [4] },
];

const ETAPES: Cle[] = [
  'ciel.etape.maj',
  'ciel.etape.session',
  'ciel.etape.cameras',
  'ciel.etape.flux',
  'ciel.etape.relier',
];

/* Pose du logo a la fin : origine et echelle (140 unites pour un viewBox de 64). */
const POSE = { ox: 360, oy: 110, s: 2.1875 };

/**
 * La similitude (zoom + rotation + translation) qui envoie Mizar et Alcor du ciel
 * EXACTEMENT sur les centres des deux vides du logo. Calculee depuis les memes constantes
 * que le dessin : elle ne peut pas se desynchroniser de lui.
 */
const MATRICE_FUSION = (() => {
  const p1 = OURSE[5], p2 = ALCOR;
  const q1 = { x: POSE.ox + 25 * POSE.s, y: POSE.oy + 37 * POSE.s };
  const q2 = { x: POSE.ox + 45 * POSE.s, y: POSE.oy + 22 * POSE.s };
  const dp = { x: p2.x - p1.x, y: p2.y - p1.y };
  const dq = { x: q2.x - q1.x, y: q2.y - q1.y };
  const den = dp.x * dp.x + dp.y * dp.y;
  const ar = (dq.x * dp.x + dq.y * dp.y) / den;
  const ai = (dq.y * dp.x - dq.x * dp.y) / den;
  const bx = q1.x - (ar * p1.x - ai * p1.y);
  const by = q1.y - (ai * p1.x + ar * p1.y);
  return `matrix(${ar}, ${ai}, ${-ai}, ${ar}, ${bx}, ${by})`;
})();

/**
 * Le ciel deborde volontairement du cadre de reference.
 *
 * La scene est dessinee dans un repere de 720 x 420, mais l'ecran, lui, a le rapport qu'il
 * veut. Sur un 3440 x 1440 — rapport 2,39 — un cadrage qui COUVRE l'ecran devait grossir
 * de 4,78 la ou la hauteur n'en demandait que 3,43 : la constellation etait rognee de 283
 * pixels en haut et en bas. Constate le 29.07.2026 sur le poste.
 *
 * On elargit donc le repere jusqu'au rapport reel de l'ecran au lieu de rogner. Les etoiles
 * de fond sont semees bien au-dela des 720 x 420 pour qu'aucun bord ne se vide, quel que
 * soit ce rapport — jusqu'au 32:9 des ecrans les plus larges.
 */
const CHAMP = { x0: -500, x1: 1220, y0: -300, y1: 720 };

/**
 * Ciel reproductible : le meme a chaque lancement, sinon c'est du bruit.
 *
 * Deux couches. Le CŒUR garde exactement la densite d'origine, la ou se joue la scene ;
 * le POURTOUR est plus clairsemé et ne sert qu'a ce qu'aucun bord ne se vide sur un ecran
 * tres large ou tres haut. Semer le champ entier a la densite du cœur donnerait sept cents
 * cercles animes pour n'en montrer qu'un tiers.
 */
function champEtoile() {
  let graine = 20260728;
  const hasard = () => (graine = (graine * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const etoiles = [];
  const COEUR = 120, POURTOUR = 170;
  for (let i = 0; i < COEUR + POURTOUR; i += 1) {
    let x: number, y: number;
    if (i < COEUR) {
      x = hasard() * 720;
      y = hasard() * 420;
    } else {
      // Rejet : on tire dans tout le champ jusqu'a tomber hors du cœur, deja peuple.
      do {
        x = CHAMP.x0 + hasard() * (CHAMP.x1 - CHAMP.x0);
        y = CHAMP.y0 + hasard() * (CHAMP.y1 - CHAMP.y0);
      } while (x >= 0 && x <= 720 && y >= 0 && y <= 420);
    }
    const proche = OURSE.some((e) => Math.hypot(e.x - x, e.y - y) < 26);
    etoiles.push({
      x: Number(x.toFixed(1)),
      y: Number(y.toFixed(1)),
      r: Number((0.35 + hasard() * (proche ? 0.4 : 1.0)).toFixed(2)),
      o: Number((0.10 + hasard() * (proche ? 0.12 : 0.42)).toFixed(2)),
      d: Number((2.6 + hasard() * 5.4).toFixed(1)),
      a: Number((hasard() * 6).toFixed(1)),
    });
  }
  return etoiles;
}

export function CielScreen({ maj, relay, progression, pret, onFini }: {
  maj: MajState | null;
  relay: RelayState;
  progression: Progression;
  pret: boolean;
  onFini: () => void;
}) {
  useLangue();
  /*
   * Les cinq jalons reels, dans l'ordre des etoiles. Le premier est franchi quand la
   * verification des mises a jour a CONCLU — y compris par un echec : un depot
   * injoignable n'est pas une raison de retenir les cameras.
   */
  const jalons = [
    maj !== null && (maj.etat === 'aucune' || maj.etat === 'erreur' || maj.etat === 'prete'),
    progression.etape === 'session' || progression.etape === 'inventaire',
    progression.etape === 'inventaire',
    relay.running,
    pret,
  ];

  const [allumees, setAllumees] = useState(0);
  /** 0 rien · 1 Mizar · 2 Alkaid · 3 Alcor · 4 fusion · 5 sortie */
  const [finale, setFinale] = useState(0);
  const debut = useRef(performance.now());
  const finiRef = useRef(onFini);
  finiRef.current = onFini;

  const doux = useMemo(() => matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  const pas = doux ? 0 : PAS;
  const etoilesFond = useMemo(champEtoile, []);

  /*
   * Le repere suit le rapport de l'ecran, au lieu que l'ecran rogne le repere.
   *
   * Elargir n'a aucun cout — les etoiles sont semees bien au-dela — alors que rogner
   * coupait la constellation, qui est justement ce qu'on est venu voir.
   */
  const cadre = useRef<HTMLDivElement>(null);
  const [rapport, setRapport] = useState(720 / 420);

  useEffect(() => {
    const el = cadre.current;
    if (!el) return;
    const mesurer = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setRapport(r.width / r.height);
    };
    mesurer();
    const ro = new ResizeObserver(mesurer);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const vue = useMemo(() => {
    const L = 720, H = 420;
    // On n'elargit jamais au-dela de ce que le ciel couvre : passe cette borne — au-dela du
    // 32:9, ou d'une fenetre deux fois plus haute que large — mieux vaut rogner un peu que
    // laisser paraitre un bord vide de toute etoile.
    const MAX_L = CHAMP.x1 - CHAMP.x0;
    const MAX_H = CHAMP.y1 - CHAMP.y0;
    if (rapport >= L / H) {
      const l = Math.min(H * rapport, MAX_L);   // ecran large : du ciel sur les cotes
      return `${(L - l) / 2} 0 ${l} ${H}`;
    }
    const h = Math.min(L / rapport, MAX_H);     // ecran haut : du ciel en haut et en bas
    return `0 ${(H - h) / 2} ${L} ${h}`;
  }, [rapport]);

  /* Allumage : plancher de temps ET jalon reel, les deux. Les etoiles restent en ordre. */
  useEffect(() => {
    if (allumees >= 5) return;
    const tic = () => {
      const t = performance.now() - debut.current;
      let n = allumees;
      while (n < 5 && jalons[n] && t >= (n + 1) * pas) n += 1;
      if (n !== allumees) setAllumees(n);
    };
    tic();
    const id = setInterval(tic, 130);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allumees, jalons[0], jalons[1], jalons[2], jalons[3], jalons[4], pas]);

  /* La finale, une fois les cinq etapes franchies. */
  useEffect(() => {
    if (allumees < 5) return;
    const minuteurs = [
      setTimeout(() => setFinale(1), pas),
      setTimeout(() => setFinale(2), pas * 1.6),
      setTimeout(() => setFinale(3), pas * 2.4),
      setTimeout(() => setFinale(4), pas * 2.4 + (doux ? 0 : 900)),
      setTimeout(() => setFinale(5), pas * 2.4 + (doux ? 0 : 900 + 2300)),
      setTimeout(() => finiRef.current(), pas * 2.4 + (doux ? 0 : 900 + 2300 + 750)),
    ];
    return () => minuteurs.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allumees >= 5]);

  /*
   * Garde-fou, et non echappatoire.
   *
   * La MISE A JOUR n'est jamais bornee : elle doit aller a son terme, c'est tout l'objet
   * de « sans echappatoire ». Mais une fois passee, la phase de connexion l'est — un
   * relais qui demarre sans jamais rendre de camera, un inventaire vide, et l'introduction
   * retiendrait l'application pour toujours sur un ciel qui pretend travailler.
   *
   * Au terme, on rend la main SANS jouer la finale : la constellation n'a pas ete achevee,
   * et l'ecran suivant dit la verite sur l'etat reel plutot que de la maquiller.
   * Douze secondes de marge au-dela des sept que dure la sequence complete.
   */
  const majFaite = jalons[0];
  const complet = allumees >= 5;
  useEffect(() => {
    if (!majFaite || complet) return;
    const t = setTimeout(() => finiRef.current(), 20000);
    return () => clearTimeout(t);
  }, [majFaite, complet]);

  const traitsAllumes = new Set<number>();
  for (let i = 0; i < allumees; i += 1) for (const t of ALLUMAGE[i].traits) traitsAllumes.add(t);
  if (finale >= 1) traitsAllumes.add(5);
  if (finale >= 2) traitsAllumes.add(6);

  const enFusion = finale >= 4;

  /*
   * Une mise a jour lourde prend le centre. « verification » n'en fait pas partie : elle
   * est bornee a trois secondes et la premiere etoile la represente deja — lui donner tout
   * l'ecran ferait clignoter un panneau a chaque lancement, pour rien.
   */
  const majLourde = maj !== null
    && (maj.etat === 'telechargement' || maj.etat === 'controle' || maj.etat === 'application');
  const chiffree = maj?.etat === 'telechargement';

  const titreMaj =
    maj?.etat === 'telechargement' ? t('ciel.telechargement', { version: maj.version ?? '' })
    : maj?.etat === 'controle' ? t('ciel.controle')
    : t('ciel.installation');
  const detailMaj =
    maj?.etat === 'telechargement' ? `${maj.pourcent ?? 0} %`
    : maj?.etat === 'controle' ? t('ciel.empreinte')
    : t('ciel.vaRedemarrer');

  const detail =
    maj?.etat === 'verification' ? t('ciel.rechercheMaj')
    : allumees >= 4 ? t('ciel.fluxPret')
    : t('ciel.connexion');

  return (
    <div
      ref={cadre}
      className={`ciel ${enFusion ? 'ciel-fusion' : ''} ${finale >= 5 ? 'ciel-sortie' : ''}`}
      role="presentation"
    >
      <style>{`
        .ciel { position: absolute; inset: 0; z-index: 50; background: var(--bg);
                overflow: hidden; cursor: default; opacity: 1; transition: opacity .7s ease; }
        .ciel-sortie { opacity: 0; pointer-events: none; }
        .ciel > svg { position: absolute; inset: 0; width: 100%; height: 100%; }

        .ciel-champ circle { fill: var(--ink); animation: ciel-clignote var(--d) ease-in-out infinite var(--a); }
        @keyframes ciel-clignote { 0%,100% { opacity: var(--o) } 50% { opacity: calc(var(--o) * .25) } }

        .ciel-seg { stroke: var(--accent); stroke-width: 1.15; fill: none; opacity: .42;
                    stroke-dasharray: var(--l); stroke-dashoffset: var(--l);
                    transition: stroke-dashoffset .62s cubic-bezier(.4,0,.2,1); }
        .ciel-seg.on { stroke-dashoffset: 0; }

        .ciel-monde { transform-box: view-box; transform-origin: 0 0; }
        .ciel-fusion .ciel-monde { transition: transform 1.6s cubic-bezier(.55,0,.15,1); }

        .ciel-astres circle { fill: var(--ink); opacity: 0; transform-box: fill-box;
                              transform-origin: center; transform: scale(.25);
                              transition: opacity .5s ease, transform .6s cubic-bezier(.2,1.4,.3,1); }
        .ciel-astres circle.on { opacity: 1; transform: scale(1); }
        .ciel-astres circle.ciel-vive { fill: var(--accent-d); }
        @keyframes ciel-palpite { 0%,100% { opacity: 1 } 50% { opacity: .42 } }
        .ciel-astres circle.ciel-vive.on { animation: ciel-palpite 2.6s ease-in-out infinite 1.1s; }

        .ciel-fusion .ciel-champ, .ciel-fusion .ciel-segs, .ciel-fusion .ciel-etiqs,
        .ciel-fusion .ciel-fugace { opacity: 0; transition: opacity .8s ease; }
        .ciel-fusion .ciel-astres { filter: none; }
        .ciel-fusion circle.ciel-mizar { r: 7.784px; fill: var(--bg); animation: none;
          transition: r 1.6s cubic-bezier(.55,0,.15,1), fill 1.2s ease .3s; }
        .ciel-fusion circle.ciel-alcor { r: 3.114px; fill: var(--bg); animation: none;
          transition: r 1.6s cubic-bezier(.55,0,.15,1), fill 1.2s ease .3s; }
        .ciel-naissant { opacity: 0; }
        .ciel-fusion .ciel-naissant { opacity: 1; transition: opacity 1.1s ease .5s; }
        .ciel-mot { opacity: 0; fill: var(--ink); font-size: 13px; font-weight: 600;
                    letter-spacing: .02em; }
        .ciel-fusion .ciel-mot { opacity: 1; transition: opacity .8s ease 1.5s; }

        .ciel-etiq { font-family: var(--font-mono); font-size: 9px; letter-spacing: .11em;
                     fill: var(--soft); opacity: 0; transition: opacity .55s ease .2s; }
        .ciel-etiq.on { opacity: 1; }
        .ciel-etiq.ciel-vedette { fill: var(--accent); font-size: 9.5px; }

        .ciel-contenu { position: absolute; left: 4%; bottom: 6%; width: min(40%, 300px);
                        z-index: 2; transition: opacity .6s ease; }
        .ciel-fusion .ciel-contenu { opacity: 0; }

        /* Le compte rendu de mise a jour : au centre, en pleine lumiere. */
        .ciel-maj { position: absolute; inset: 0; z-index: 4; display: grid;
                    place-items: center; background: rgba(27,30,35,.72); }
        .ciel-maj-boite { width: min(420px, 78vw); text-align: center; }
        .ciel-piste { margin-top: 26px; height: 3px; border-radius: 999px; overflow: hidden;
                      background: rgba(255,255,255,.09); }
        .ciel-jauge { height: 100%; border-radius: 999px; background: var(--accent); }
        .ciel-jauge.indetermine { width: 32%; animation: balayage 1.1s ease-in-out infinite; }

        @media (prefers-reduced-motion: reduce) {
          .ciel, .ciel-seg, .ciel-monde, .ciel-astres circle, .ciel-etiq, .ciel-contenu,
          .ciel-naissant, .ciel-mot,
          .ciel-fusion circle.ciel-mizar, .ciel-fusion circle.ciel-alcor {
            transition-duration: .01ms !important; transition-delay: 0ms !important; }
          .ciel-champ circle, .ciel-astres circle.ciel-vive.on { animation: none !important; }
          /* La jauge indeterminee garde son mouvement : sans lui, plus rien ne distingue
             « ça travaille » de « c'est figé » pendant un téléchargement de 148 Mo. */
        }
      `}</style>

      {/* Le repere est calcule pour epouser l'ecran : « slice » ne rogne donc plus rien,
          il ne sert qu'a fermer un eventuel cheveu de bord au sous-pixel. */}
      <svg viewBox={vue} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <filter id="ciel-lueur" x="-260%" y="-260%" width="620%" height="620%">
            <feGaussianBlur stdDeviation="3.2" result="f" />
            <feMerge><feMergeNode in="f" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* La plaque nait SOUS les etoiles : ordre du document = ordre de peinture. */}
        <g className="ciel-naissant" transform={`translate(${POSE.ox},${POSE.oy}) scale(${POSE.s})`}>
          <path fill="var(--accent)"
                d="M18 4H46A14 14 0 0 1 60 18V46A14 14 0 0 1 46 60H18A14 14 0 0 1 4 46V18A14 14 0 0 1 18 4Z" />
          <path fill="var(--bg)" d="M35.64 30.12L40.74 26.32L39.66 24.88L34.56 28.68Z" />
        </g>
        {/* Le mot vit dans le SVG : il suit la pose du logo quel que soit le cadrage. */}
        <text className="ciel-mot" x={POSE.ox + 32 * POSE.s} y={POSE.oy + 64 * POSE.s + 22}
              textAnchor="middle">Alcora</text>

        {/* Tout le ciel vit dans ce groupe : c'est lui que la fusion transforme. */}
        <g className="ciel-monde" style={enFusion ? { transform: MATRICE_FUSION } : undefined}>
          <g className="ciel-champ">
            {etoilesFond.map((e, i) => (
              <circle key={i} cx={e.x} cy={e.y} r={e.r}
                      style={{ '--o': e.o, '--d': `${e.d}s`, '--a': `${e.a}s` } as React.CSSProperties} />
            ))}
          </g>
          <g className="ciel-segs">
            {SEGMENTS.map(([a, b], i) => (
              <line key={i} x1={OURSE[a].x} y1={OURSE[a].y} x2={OURSE[b].x} y2={OURSE[b].y}
                    className={`ciel-seg ${traitsAllumes.has(i) ? 'on' : ''}`}
                    style={{ '--l': Math.hypot(OURSE[b].x - OURSE[a].x, OURSE[b].y - OURSE[a].y).toFixed(1) } as React.CSSProperties} />
            ))}
          </g>
          <g className="ciel-astres" filter="url(#ciel-lueur)">
            {OURSE.map((e, i) => {
              const on = i < 5 ? i < allumees : (i === 5 ? finale >= 1 : finale >= 2);
              const classe = i === 5 ? 'ciel-mizar' : 'ciel-fugace';
              return (
                <circle key={i} cx={e.x} cy={e.y} r={e.r}
                        className={`${i === 6 ? 'ciel-fugace' : classe} ${on ? 'on' : ''}`} />
              );
            })}
            <circle cx={ALCOR.x} cy={ALCOR.y} r={ALCOR.r}
                    className={`ciel-vive ciel-alcor ${finale >= 3 ? 'on' : ''}`} />
          </g>
          <g className="ciel-etiqs">
            <text x={OURSE[5].x - 4} y={OURSE[5].y + 20}
                  className={`ciel-etiq ${finale >= 1 ? 'on' : ''}`}>MIZAR</text>
            <text x={ALCOR.x + 8} y={ALCOR.y - 6}
                  className={`ciel-etiq ciel-vedette ${finale >= 3 ? 'on' : ''}`}>ALCOR</text>
          </g>
        </g>
      </svg>

      <div className="ciel-contenu">
        <p className="mb-3 text-[20px] font-semibold tracking-tight">Alcora</p>
        <div className="flex flex-col gap-1.5">
          {ETAPES.map((cle, i) => {
            const on = i < allumees;
            return (
              <div key={cle} className="flex items-center gap-2.5 text-[12.5px] transition-colors"
                   style={{ color: on ? 'var(--ink)' : 'var(--soft)' }}>
                <span className="grid h-[13px] w-[13px] shrink-0 place-items-center">
                  {on ? (
                    <span className="h-3 w-3 rounded-full border-[1.4px]"
                          style={{ borderColor: 'var(--ok)' }} />
                  ) : (
                    <span className="h-1 w-1 rounded-full bg-current opacity-40" />
                  )}
                </span>
                <span>{t(cle)}</span>
              </div>
            );
          })}
        </div>
        <p className="mt-3.5 font-mono text-[10.5px] tracking-wide text-soft">{detail}</p>
      </div>

      {/* La mise à jour prend le centre : elle est le sujet, la constellation attend. */}
      {majLourde && (
        <div className="ciel-maj">
          <div className="ciel-maj-boite">
            <p className="text-[19px] font-semibold tracking-tight">Alcora</p>
            <p className="mt-0.5 font-mono text-[11.5px] text-soft">
              {maj?.version ? t('ciel.versLa', { version: maj.version }) : ' '}
            </p>

            {/* Tant que la durée est inconnue, la barre balaie sans rien promettre ;
                elle ne chiffre que lorsqu'elle sait vraiment. */}
            <div className="ciel-piste">
              <div className={`ciel-jauge ${chiffree ? '' : 'indetermine'}`}
                   style={chiffree
                     ? { width: `${maj?.pourcent ?? 0}%`, transition: 'width .25s linear' }
                     : undefined} />
            </div>

            <p className="mt-3.5 min-h-5 text-[13px]">{titreMaj}</p>
            <p className="mt-0.5 min-h-4 font-mono text-[11px] text-soft">{detailMaj}</p>
            <p className="mt-5 text-[12.5px] text-soft">
              {t('ciel.redemarreSeule')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
