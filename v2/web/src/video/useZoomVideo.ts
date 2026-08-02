import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Zoomer et se deplacer dans une video, partout.
 *
 * Ce mecanisme vivait dans la tuile du direct, ou il etait ne. L'usage a fait remarquer le
 * 01.08.2026 qu'il n'existait qu'la : ni la relecture ni la sequence d'une detection ne
 * permettaient d'agrandir l'image, alors que c'est justement la qu'on cherche un detail —
 * une plaque, un visage, ce qu'on tenait a la main. Sorti d'ici, il sert les trois.
 *
 * LE POINT QUI COMPTE : on ne grossit pas l'element video par une transformation CSS, qui
 * etirerait des pixels deja reduits a la taille d'affichage. On RECADRE dans les pixels
 * intrinseques de la source, vers un canevas — `drawImage` lit la taille reelle de la video,
 * pas celle de son affichage. C'est ce qui fait la difference entre agrandir une image et
 * en montrer davantage.
 *
 * Ce que ce module ne fait PAS, et qui reste a l'appelant : choisir la definition demandee
 * au controleur. En direct, zoomer reclame un canal superieur (la tuile s'en charge) ; sur
 * un extrait deja telecharge, il n'y a qu'un fichier et le zoom finit par interpoler. D'ou
 * `limiteSansPerte`, qui dit a partir de quand on invente des pixels.
 */

export const ZOOM_MAX = 8;

export interface ZoomVideo {
  /** A poser sur le conteneur : il porte les gestes. */
  gestes: {
    onWheel: (e: React.WheelEvent) => void;
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: () => void;
    onPointerCancel: () => void;
    onDragStart: (e: React.DragEvent) => void;
  };
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  zoom: number;
  /** Vrai des que l'on depasse 1 : le canevas prend alors la main sur l'element video. */
  agrandi: boolean;
  /** Vrai quand on demande plus de pixels que la source n'en a : l'image est inventee. */
  interpole: boolean;
  reinitialiser: () => void;
  /** Zoom programmatique — les raccourcis clavier passent par la, sur la meme grille. */
  zoomer: (facteur: number) => void;
}

/**
 * @param videoRef      la video source
 * @param largeurVue    largeur d'affichage en pixels, pour savoir quand on interpole
 * @param actif         faux met le mecanisme en sommeil (aucune peinture, aucun geste)
 */
export function useZoomVideo(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  largeurVue: number,
  actif = true,
): ZoomVideo {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0.5, y: 0.5 });
  const [naturelle, setNaturelle] = useState(0);

  /*
   * Les valeurs vivantes sont doublees en references.
   *
   * La boucle de peinture est montee UNE fois et ne doit pas se remonter a chaque cran de
   * molette : la relancer perdrait le rappel d'image en vol et ferait clignoter la vue.
   * Elle lit donc les references, que le rendu tient a jour.
   */
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  zoomRef.current = zoom;
  panRef.current = pan;

  /* La derniere largeur naturelle vue, pour n'ecrire l'etat qu'aux vrais changements. */
  const naturelleRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!actif || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let arrete = false;
    let raf = 0;
    let derniereCle = '';

    /*
     * L'ELEMENT VIDEO EST RELU A CHAQUE IMAGE — c'est la correction du 02.08.2026, apres
     * que le zoom de la relecture a ete livre MORT en 2.18.0. Deux defauts se cumulaient :
     *
     *  · l'element etait capture UNE FOIS a l'ouverture de l'effet. Or en relecture la
     *    reference du lecteur « a l'antenne » est recopiee pendant le rendu, AVANT que
     *    React n'attache les references aux elements qui viennent de monter : l'effet
     *    demarrait donc sur null, sortait, et ne revenait jamais — ses dependances ne
     *    changeant plus. La boucle etait morte-nee, pendant que l'etiquette de zoom, elle,
     *    vivait sa vie dans l'etat React. Symptome exact rapporte : « la valeur
     *    change mais rien ne se passe a l'image » ;
     *  · requestVideoFrameCallback ne se declenche JAMAIS sur une video en pause, et le
     *    chien de garde ne rattrapait que le cas ou aucune image n'avait ete peinte.
     *    Lire, mettre en pause, zoomer — l'usage premier de la relecture — restait fige.
     *
     * Le direct n'avait aucun des deux problemes : reference attachee par React, flux
     * jamais en pause. C'est pourquoi le defaut n'a pas ete vu avant d'etre livre.
     *
     * La boucle tourne donc au rythme du rendu, et une CLE D'IMAGE evite de redessiner
     * pour rien : on ne repeint que si l'instant de la video, le zoom, le deplacement ou
     * la source ont change. Video en pause et zoom immobile : zero dessin.
     */
    const peindre = () => {
      const video = videoRef.current;
      if (!video) return;
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h) return;
      if (w !== naturelleRef.current) { naturelleRef.current = w; setNaturelle(w); }

      const z = zoomRef.current;
      if (z <= 1.001) return;   // a zoom 1, l'element video affiche directement

      const p = panRef.current;
      const cle = `${video.currentTime}|${z}|${p.x}|${p.y}|${w}`;
      if (cle === derniereCle) return;
      derniereCle = cle;

      const sw = w / z;
      const sh = h / z;
      const sx = Math.min(Math.max(p.x * w - sw / 2, 0), w - sw);
      const sy = Math.min(Math.max(p.y * h - sh / 2, 0), h - sh);

      const cw = Math.round(sw);
      const ch = Math.round(sh);
      if (canvas.width !== cw) { canvas.width = cw; canvas.height = ch; }

      // drawImage lit la taille INTRINSEQUE de la source : c'est ce qui garantit qu'on
      // recadre dans les pixels reels, et non dans une image deja reduite a l'affichage.
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, cw, ch);
    };

    const boucle = () => {
      if (arrete) return;
      peindre();
      raf = requestAnimationFrame(boucle);
    };
    boucle();

    return () => {
      arrete = true;
      cancelAnimationFrame(raf);
    };
  }, [actif, videoRef]);

  /** Multiplie le zoom, molette ou clavier — meme grille de crans pour les deux. */
  const zoomer = useCallback((facteur: number) => {
    setZoom((z) => {
      const suite = Math.min(ZOOM_MAX, Math.max(1, z * facteur));
      if (suite <= 1.001) setPan({ x: 0.5, y: 0.5 });
      return suite;
    });
  }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    zoomer(e.deltaY < 0 ? 1.25 : 1 / 1.25);
  }, [zoomer]);

  const glisse = useRef<{ x: number; y: number } | null>(null);

  /*
   * POURQUOI CES DEFENSES — mesure du 02.08.2026, sur le poste reel, compteurs a l'appui.
   *
   * Le panoramique mourait apres un ou deux mouvements : « 1 mm par clic », rapportait
   * l'usage. Le releve CDP pendant un glisser rapide a montre la sequence exacte :
   *
   *     dragstart: 2 → pointercancel: 2 → plus un seul pointermove
   *
   * Un premier geste avait declenche `selectstart` — une SELECTION invisible, les
   * conteneurs de la relecture n'ayant pas l'interdiction de selection de la tuile du
   * direct. Chaque geste rapide par-dessus demarrait alors un glisser-depose NATIF de
   * Chromium, qui envoie `pointercancel` et coupe le flux du pointeur. Un geste lent
   * passait entre les gouttes — c'est pourquoi les verifications synthetiques n'ont
   * rien vu.
   *
   * Trois defenses, chacune suffisante seule, aucune couteuse :
   *   · `preventDefault()` au pointerdown — ni selection ni glisser natif ne PEUVENT
   *     demarrer depuis la vue ;
   *   · `onDragStart` etouffe — meme si un autre element se declarait glissable ;
   *   · la REPRISE : un mouvement recu bouton tenu alors qu'aucun glisser n'est en
   *     cours en redevient un. Quoi qu'un `pointercancel` parasite ait tue, le geste
   *     suivant du meme maintien reprend la ou en est le curseur, sans saut.
   */
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (zoomRef.current <= 1) return;
    /*
     * Un appui sur une COMMANDE posee sur la vue n'est pas un debut de panoramique. Le
     * capturer volerait le pointerup du bouton — capture posee, le clic ne se forme
     * jamais, et le bouton semblerait mort precisement quand on est zoome.
     */
    if ((e.target as Element).closest('button, input, select')) return;
    e.preventDefault();
    // Zoomee, la vue capture le geste pour son panoramique : il ne doit pas remonter au
    // parent, qui l'interpreterait comme un debut de reorganisation.
    e.stopPropagation();
    glisse.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    let depart = glisse.current;
    if (!depart) {
      // Reprise defensive : bouton encore tenu, glisser tue par un pointercancel
      // parasite. On repart d'ici — pas de saut, le delta suivant sera minuscule.
      if (zoomRef.current <= 1 || !(e.buttons & 1)) return;
      if ((e.target as Element).closest('button, input, select')) return;
      depart = { x: e.clientX, y: e.clientY };
      glisse.current = depart;
      // La capture est morte avec le pointercancel : on la reprend, sinon le geste
      // s'arreterait au premier passage du curseur hors de la vue.
      try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch { /* pointeur deja inactif */ }
      return;
    }
    const boite = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const dx = (e.clientX - depart.x) / boite.width;
    const dy = (e.clientY - depart.y) / boite.height;
    glisse.current = { x: e.clientX, y: e.clientY };
    // A fort zoom la fenetre visible est petite : le meme geste doit deplacer moins.
    setPan((p) => ({
      x: Math.min(Math.max(p.x - dx / zoomRef.current, 0), 1),
      y: Math.min(Math.max(p.y - dy / zoomRef.current, 0), 1),
    }));
  }, []);

  const onPointerUp = useCallback(() => { glisse.current = null; }, []);

  const onDragStart = useCallback((e: React.DragEvent) => { e.preventDefault(); }, []);

  const reinitialiser = useCallback(() => {
    setZoom(1);
    setPan({ x: 0.5, y: 0.5 });
  }, []);

  const limiteSansPerte = naturelle && largeurVue ? naturelle / largeurVue : 1;

  return {
    gestes: {
      onWheel, onPointerDown, onPointerMove, onPointerUp,
      onPointerCancel: onPointerUp, onDragStart,
    },
    canvasRef,
    zoom,
    agrandi: zoom > 1.001,
    interpole: zoom > limiteSansPerte + 0.001,
    reinitialiser,
    zoomer,
  };
}
