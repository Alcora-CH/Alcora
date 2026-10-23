import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, History, ScanSearch, Volume2, VolumeX } from 'lucide-react';
import { BoutonBandeau } from './BoutonBandeau';
import { connectWhep, type WhepSession } from './whep';
import { attenteReprise, causeDeReprise } from './sante';
import { bestChannel, pickChannel, qualityLabel, relayPath } from './channel';
import { nombre, t, useLangue } from '../i18n';
import { cx } from '../ui/cx';

/**
 * Delai d'immobilite avant de reevaluer le canal apres un changement de taille.
 *
 * Assez long pour absorber l'animation d'une fenetre qu'on agrandit ou restaure, assez
 * court pour que la montee en qualite suive le geste sans se faire attendre.
 */
const STABILISATION_MS = 400;
import { useZoomVideo } from './useZoomVideo';
import type { DiscoveredCamera, RelaisAcces } from '../types/protect';

export interface CameraTileProps {
  camera: DiscoveredCamera;
  /** Adresse du relais et en-tete d'autorisation : l'un sans l'autre rend 401. */
  relais: RelaisAcces;
  /** Marge de resolution exigee au-dela de la taille d'affichage. */
  headroom?: number;
  /** Faux quand l'espacement est nul : les images se touchent, sans bord ni arrondi. */
  cadre?: boolean;
  /** Hauteur reservee a l'etiquette, accordee avec le calcul de la mosaique. */
  hauteurEtiquette?: number;
  /**
   * Commandes offertes au survol. Absentes, la tuile reste une simple image — c'est le cas
   * en relecture, ou ces boutons n'auraient aucun sens.
   */
  actions?: {
    onRelecture?: (cameraId: string) => void;
    onDetections?: (cameraId: string) => void;
    /** Rend le chemin du fichier ecrit, ou leve. */
    onCapture?: (nomCamera: string, jpeg: ArrayBuffer) => Promise<string>;
    /** Cette camera vient de prendre la parole : les autres se taisent. */
    onSon?: (cameraId: string) => void;
    /** Camera qui a la parole, ou null. */
    sonSur?: string | null;
    /** Reglage : le son s'active de lui-meme des qu'une piste existe. */
    sonParDefaut?: boolean;
  };
  /**
   * Detection en cours sur CETTE camera, ou null.
   *
   * Tenue plus haut : la liaison temps reel est unique, et c'est l'application qui sait
   * quelles detections courent. La tuile ne fait qu'afficher.
   */
  activite?: { libelle: string } | null;
  /**
   * Vrai quand cette tuile est SEULE a l'ecran (camera isolee) : « + » et « − » zooment
   * alors au clavier. En mosaique, le raccourci n'aurait pas de cible designee.
   */
  zoomClavier?: boolean;
}

/** « Reprise automatique dans 4 s » : le compte, et lui seul, se redessine chaque seconde. */
function Decompte({ jusqua }: { jusqua: number }) {
  const [maintenant, setMaintenant] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const s = Math.max(0, Math.ceil((jusqua - maintenant) / 1000));
  return <>{t('tuile.reprise', { n: s })}</>;
}

type Status = 'attente' | 'connexion' | 'direct' | 'erreur';

/**
 * Surveillance du direct.
 *
 * « direct » s'affichait des que la negociation aboutissait — avant qu'une seule image
 * n'ait ete decodee. Et si le flux s'arretait ensuite, la tuile restait indefiniment en
 * direct sur une image figee : la panne la plus grave d'un outil de surveillance, celle
 * qui ne se voit pas. On compte donc les images REELLEMENT decodees.
 */
const SONDE_MS = 2000;
/** Sans nouvelle image pendant ce temps, le flux est considere arrete. */
const GEL_MS = 6000;
/** Session ouverte mais aucune image livree : plus genereux, la montee peut etre lente. */
const PREMIERE_IMAGE_MS = 12000;
/** Attente avant reprise : croissante, bornee, et decalee d'une tuile a l'autre. */
const REPRISE_MS = [1000, 2000, 4000, 8000, 15000];

/** Images video decodees depuis le debut de la session, ou null si l'info manque. */
async function imagesDecodees(pc: RTCPeerConnection): Promise<number | null> {
  try {
    let n: number | null = null;
    (await pc.getStats()).forEach((r) => {
      const s = r as RTCInboundRtpStreamStats & { framesDecoded?: number };
      if (s.type === 'inbound-rtp' && s.kind === 'video' && typeof s.framesDecoded === 'number') {
        n = s.framesDecoded;
      }
    });
    return n;
  } catch {
    return null;
  }
}

export function CameraTile({
  camera, relais, headroom = 2, cadre = true, hauteurEtiquette = 26, actions, activite,
  zoomClavier = false,
}: CameraTileProps) {
  useLangue();
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const sessionRef = useRef<WhepSession | null>(null);

  const [status, setStatus] = useState<Status>('attente');
  /** Instant de la prochaine tentative, tant que la tuile est en erreur : il se dit. */
  const [repriseA, setRepriseA] = useState<number | null>(null);
  /** Incremente pour forcer une reconnexion : gel detecte, ou echec a reprendre. */
  const [generation, setGeneration] = useState(0);
  const essaisRef = useRef(0);
  const [tileWidth, setTileWidth] = useState(0);

  /*
   * Le zoom vit desormais dans un crochet partage — il servait au seul direct, alors que
   * c'est en RELECTURE qu'on cherche un detail. Voir video/useZoomVideo.ts.
   */
  const vue = useZoomVideo(videoRef, tileWidth, status === 'direct');

  /* « + » et « − » zooment la camera isolee — meme grille de crans que la molette. */
  useEffect(() => {
    if (!zoomClavier) return;
    const auClavier = (e: KeyboardEvent) => {
      const cible = e.target as HTMLElement | null;
      if (cible && /^(BUTTON|INPUT|SELECT|TEXTAREA)$/.test(cible.tagName)) return;
      if (e.key === '+' || e.key === '=') { e.preventDefault(); vue.zoomer(1.25); }
      else if (e.key === '-') { e.preventDefault(); vue.zoomer(1 / 1.25); }
    };
    window.addEventListener('keydown', auClavier);
    return () => window.removeEventListener('keydown', auClavier);
    // `vue.zoomer` est stable (useCallback sans dependance) : seule l'activation compte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomClavier]);
  const { zoom } = vue;
  const canvasRef = vue.canvasRef;

  // Le canal suit la surface reellement affichee ET le zoom. Recalcule a chaque
  // changement, mais la reconnexion n'a lieu que si le chemin change vraiment.
  const channel = useMemo(
    () => (tileWidth > 0 ? pickChannel(camera, tileWidth, zoom, headroom) : null),
    [camera, tileWidth, zoom, headroom],
  );
  const path = channel ? relayPath(camera, channel) : null;

  useEffect(() => {
    console.log(
      `[tuile ${camera.name}] largeur=${Math.round(tileWidth)} zoom=${zoom.toFixed(2)} ` +
      `canal=${channel?.quality ?? 'AUCUN'} chemin=${path ?? 'AUCUN'}`);
  }, [camera.name, tileWidth, zoom, channel, path]);

  /* ---- mesure de la tuile ---- */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Valeur initiale : l'observateur ne notifie qu'au prochain changement, et sans elle
    // aucun canal ne serait choisi.
    setTileWidth(el.getBoundingClientRect().width);

    /*
     * On attend que la taille se stabilise avant d'en tirer une conclusion.
     *
     * Changer de canal coute une renegociation complete : la session est fermee, une
     * nouvelle est ouverte, et l'image se fige un instant. Or une fenetre qu'on agrandit
     * ou qu'on restaure passe par des largeurs intermediaires qui ne durent qu'une
     * fraction de seconde.
     *
     * Mesure du 22.07.2026 : restaurer la fenetre a produit trois renegociations en huit
     * secondes, dont une pour une largeur de 462 px qui n'a jamais ete affichee. Pendant
     * un redimensionnement a la souris, il y en aurait des dizaines.
     */
    let minuteur: number | undefined;
    const ro = new ResizeObserver(([e]) => {
      const largeur = e.contentRect.width;
      clearTimeout(minuteur);
      minuteur = window.setTimeout(() => setTileWidth(largeur), STABILISATION_MS);
    });
    ro.observe(el);
    return () => { clearTimeout(minuteur); ro.disconnect(); };
  }, []);

  /* ---- connexion, refaite seulement si le chemin change ---- */
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !path) return;

    let cancelled = false;
    // La session creee PAR CET effet. Fermer `sessionRef.current` a la place fermerait
    // celle d'un montage suivant : en mode strict, React monte, demonte puis remonte, et
    // le nettoyage du premier passage s'execute apres l'installation du second.
    let mienne: WhepSession | null = null;

    setStatus('connexion');
    console.log(`[tuile ${camera.name}] appel ${relais.base}/${path}/whep`);

    connectWhep(`${relais.base}/${path}/whep`, video, relais.autorisation)
      .then((s) => {
        if (cancelled) { s.close(); return; }
        mienne = s;
        sessionRef.current = s;
        // PAS encore « direct » : la negociation a abouti, aucune image n'est arrivee.
        // C'est la sonde qui le declarera, sur des images reellement decodees.
        console.log(`[tuile ${camera.name}] session ouverte, en attente d’images`);
      })
      .catch((e) => {
        if (cancelled) return;
        setStatus('erreur');
        console.error(`[tuile ${camera.name}] échec : ${e?.message ?? e}`);
      });

    return () => {
      cancelled = true;
      mienne?.close();
      if (sessionRef.current === mienne) sessionRef.current = null;
    };
  }, [path, relais.base, relais.autorisation, camera.name, generation]);

  /*
   * Reprise apres un echec de connexion.
   *
   * Une tuile en erreur y restait definitivement : le relais pouvait revenir, le
   * controleur repondre a nouveau, l'image ne revenait jamais sans relancer l'application.
   */
  useEffect(() => {
    if (status !== 'erreur') { setRepriseA(null); return; }
    const attente = attenteReprise(essaisRef.current, REPRISE_MS);
    essaisRef.current += 1;
    setRepriseA(Date.now() + attente);
    console.log(`[tuile ${camera.name}] nouvelle tentative dans ${attente} ms`);
    const t = window.setTimeout(() => setGeneration((g) => g + 1), attente);
    return () => clearTimeout(t);
  }, [status, camera.name]);

  /*
   * Sonde du direct : compte les images decodees, declare le direct, detecte le gel.
   *
   * La visibilite est prise en compte : fenetre masquee, le navigateur cesse legitimement
   * de decoder, et sans cette garde on reconnecterait en boucle une tuile que personne ne
   * regarde. Le compteur est remis a zero au retour pour ne pas conclure sur l'absence.
   */
  useEffect(() => {
    let arrete = false;
    let differe = 0;
    /** Images decodees au dernier releve. -1 : jamais releve. */
    let vues = -1;
    /** Instant du dernier mouvement d'images, ou de l'ouverture tant qu'il n'y en a eu aucun. */
    let dernierMouvement = performance.now();
    /** Vrai des la premiere image reellement decodee. */
    let demarre = false;

    const reprendre = (cause: string) => {
      if (arrete) return;
      arrete = true;
      const attente = attenteReprise(essaisRef.current, REPRISE_MS);
      essaisRef.current += 1;
      console.warn(`[tuile ${camera.name}] ${cause} — reprise dans ${attente} ms`);
      setStatus('connexion');
      differe = window.setTimeout(() => setGeneration((g) => g + 1), attente);
    };

    const battement = async () => {
      const s = sessionRef.current;
      if (arrete || !s) return;

      const visible = document.visibilityState === 'visible';
      // Fenetre masquee : le compteur repart, pour ne rien conclure de l'absence.
      if (!visible) { dernierMouvement = performance.now(); return; }

      const n = await imagesDecodees(s.pc);
      if (arrete) return;

      // Une image de plus : le flux vit. Zero image decodee n'est PAS le direct — c'est
      // une session ouverte qui n'a encore rien recu.
      if (n !== null && n > vues) {
        vues = n;
        dernierMouvement = performance.now();
        if (n > 0 && !demarre) {
          demarre = true;
          console.log(`[tuile ${camera.name}] première image décodée`);
        }
        if (n > 0) { essaisRef.current = 0; setStatus('direct'); }
        return;
      }

      const cause = causeDeReprise(
        { connexion: s.pc.connectionState, demarre, immobileMs: performance.now() - dernierMouvement, visible },
        { gelMs: GEL_MS, premiereImageMs: PREMIERE_IMAGE_MS },
      );
      if (cause) reprendre(cause);
    };

    const id = window.setInterval(() => { void battement(); }, SONDE_MS);
    return () => { arrete = true; clearInterval(id); clearTimeout(differe); };
  }, [camera.name, generation, path]);


  /* ---- boucle de recadrage ---- */

  /* ---- son du direct ---- */
  /*
   * Le son se DECOUVRE, il ne se suppose pas.
   *
   * Le flux RTSP du controleur porte deux pistes audio (AAC 16 kHz, puis Opus 48 kHz —
   * mesure du 21.07.2026). WebRTC ne transporte pas l'AAC ; l'Opus, si. Selon ce que le
   * relais republie, la piste peut donc etre la ou pas. Plutot que de parier, on regarde le
   * flux recu : s'il n'y a pas de son, le bouton le DIT au lieu de ne rien faire.
   */
  const [aDuSon, setADuSon] = useState(false);
  const [sonActif, setSonActif] = useState(false);
  const [capture, setCapture] = useState<string | null>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || status !== 'direct') return;
    const regarder = () => {
      const flux = v.srcObject as MediaStream | null;
      setADuSon(Boolean(flux?.getAudioTracks?.().length));
    };
    regarder();
    // La piste audio peut arriver apres la video : on regarde encore un peu.
    const id = setInterval(regarder, 1000);
    const arret = setTimeout(() => clearInterval(id), 8000);
    return () => { clearInterval(id); clearTimeout(arret); };
  }, [status, generation]);

  /* Le son par defaut est un reglage : on l'applique des que la piste existe. */
  useEffect(() => {
    if (aDuSon && actions?.sonParDefaut && !sonActif) {
      const v = videoRef.current;
      if (v) { v.muted = false; setSonActif(true); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aDuSon]);

  const basculerSon = useCallback(() => {
    const v = videoRef.current;
    if (!v || !aDuSon) return;
    /* Une seule camera parle a la fois : deux flux simultanes donnent une bouillie ou l'on
       ne distingue plus rien, et l'on ne sait meme plus laquelle on ecoute. */
    if (v.muted) actions?.onSon?.(camera.id);
    v.muted = !v.muted;
    setSonActif(!v.muted);
  }, [aDuSon, actions, camera.id]);

  /* Une autre tuile a pris la parole : celle-ci se tait. */
  useEffect(() => {
    if (actions?.sonSur && actions.sonSur !== camera.id && sonActif) {
      const v = videoRef.current;
      if (v) { v.muted = true; setSonActif(false); }
    }
  }, [actions?.sonSur, camera.id, sonActif]);

  /**
   * Capture : l'image NATIVE, pas ce que la tuile affiche.
   *
   * Une capture reduite a la taille d'une vignette de mosaique ne sert a rien — c'est
   * justement quand on veut lire une plaque ou un visage qu'on la prend. On repart donc du
   * flux a sa definition reelle, zoom et recadrage ignores.
   */
  const capturer = useCallback(async () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d')?.drawImage(v, 0, 0);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.92));
    if (!blob) return;
    try {
      const chemin = await actions!.onCapture!(camera.name, await blob.arrayBuffer());
      setCapture(chemin ? t('tuile.capturee', { nom: chemin.split(/[\\/]/).pop() ?? '' }) : null);
    } catch (e) {
      setCapture(e instanceof Error ? e.message : t('tuile.captureImpossible'));
    }
    setTimeout(() => setCapture(null), 3200);
  }, [actions, camera.name]);

  /* Aucun canal diffusable : la tuile attend pour toujours, et doit le dire. */
  const sansFlux = !bestChannel(camera);
  const upscaling = vue.interpole;
  const zoomed = vue.agrandi;

  const image = (
    <div
      ref={containerRef}
      /* La cellule est deja dimensionnee a la bonne proportion par la mosaique : imposer
         « aspect-video » ici ferait s'affronter deux regles sur le meme arrondi. */
      className="group relative h-full w-full select-none overflow-hidden bg-black"
      style={{ cursor: zoomed ? 'grab' : 'default' }}
      {...vue.gestes}
    >
      {/* « muted » reste l'etat de depart : un mur d'images qui se met a parler tout seul
          au lancement serait insupportable. Le son se demande, il ne s'impose pas. */}
      <video ref={videoRef} muted playsInline
             className="absolute inset-0 h-full w-full object-contain" />

      {/* Confirmation de capture : au CENTRE, et franche. Discrete dans un coin, elle
          laissait douter que quelque chose ait ete enregistre. */}
      {capture && (
        <div className="m-surgit pointer-events-none absolute inset-x-0 bottom-12 z-20 flex justify-center">
          <span className="max-w-[86%] truncate rounded-[9px] border border-line2 px-3.5 py-2"
                style={{ background: 'rgba(12,15,20,.92)', color: '#f2efe8' }}>
            {capture}
          </span>
        </div>
      )}

      <canvas ref={canvasRef}
              className="absolute inset-0 h-full w-full object-contain"
              style={{ display: zoomed ? 'block' : 'none' }} />

      {zoomed && (
        <div className="veil pointer-events-none absolute bottom-2.5 left-2.5 flex h-6 items-center gap-1.5 rounded-md px-2.5 text-meta tabular-nums"
             style={{ color: 'var(--on-1)' }}>
          {nombre(zoom, 2)}×
          {upscaling && <span className="text-bad">{t('video.interpole')}</span>}
        </div>
      )}

      {status !== 'direct' && (
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-muted">
              {status === 'erreur' ? t('tuile.fluxIndisponible')
                : status === 'attente' ? (sansFlux ? t('camera.rtspDesactive') : '') : t('tuile.connexion')}
            </p>
            {/* La prochaine tentative se dit : un « Flux indisponible » muet ressemble à
                une panne définitive, alors que la tuile réessaie d'elle-même. */}
            {status === 'erreur' && repriseA !== null && (
              <p className="mt-1 text-meta text-soft"><Decompte jusqua={repriseA} /></p>
            )}
          </div>
        </div>
      )}

      {/*
        Activite en cours, reprise de Protect.
        ------------------------------------------------------------------
        La pastille dit QUOI ; le cadre d'or, pose sur la tuile, dit OU. Rien en voile sur
        l'image : masquer ce qu'on veut justement faire regarder serait un contresens.

        Le cadre ne tourne plus (direction « Observatoire ») : le trait lumineux animait
        un degrade conique, que le navigateur repeignait a chaque image pendant toute la
        detection — un travail de plus, pendant qu'un flux 4K decode. Seul le point de la
        pastille respire, en opacite.

        « pointer-events-none » est indispensable : sans lui, la pastille intercepterait la
        molette et le glisser, et l'on ne pourrait plus zoomer sur la camera ou il se passe
        quelque chose — exactement celle qu'on veut regarder.
      */}
      {activite && (
        <div className="veil m-surgit pointer-events-none absolute right-2.5 top-2.5 z-10 flex h-[26px] items-center gap-[7px] rounded-[13px] px-2.5 text-meta"
             style={{ color: 'var(--on-1)' }}>
          <span className="point-activite h-[7px] w-[7px] rounded-full bg-accent" />
          {activite.libelle}
        </div>
      )}
    </div>
  );

  /* Le cadre d'or de l'activite : contour et halo autour de la tuile quand elle a un cadre ;
     anneau interieur quand les images se touchent, pour ne pas deborder sur la voisine. */
  const halo = activite
    ? (cadre
      ? { borderColor: 'var(--accent-ligne)',
          boxShadow: '0 0 0 1px var(--accent-ligne), 0 0 28px -6px rgba(220,169,92,.45), 0 18px 40px -18px rgba(0,0,0,.7)' }
      : undefined)
    : undefined;

  /*
   * L'etiquette vit HORS de l'image, au-dessus d'elle.
   *
   * Posee dessus, elle masquait une partie de la scene — et redoublait l'horodatage que
   * les cameras incrustent elles-memes. Dehors, elle ne cache plus rien et reste lisible
   * quelle que soit la luminosite du flux.
   *
   * La tuile est une carte de l'instrument (maquette A) : bandeau et image dans le meme
   * cadre. Quand l'espacement est nul, plus de cadre — les images se touchent — mais le
   * bandeau garde sa surface pleine : du texte pose sur le ciel se lisait mal.
   */
  return (
    <div className={cx(
      '@container relative flex h-full w-full flex-col overflow-hidden',
      cadre && 'rounded-xl border border-line2 shadow-[0_18px_40px_-18px_rgba(0,0,0,.7)]',
      hauteurEtiquette > 0 && 'bg-card',
    )} style={halo}>
      {/* A hauteur nulle (l'invite de la relecture), le bandeau ne se rend pas du
          tout : son contenu deborderait d'un conteneur a zero pixel et viendrait
          s'imprimer sur le haut de l'image. */}
      {hauteurEtiquette > 0 && (
      <div className="flex shrink-0 items-center gap-2.5 pl-3.5 pr-2"
           style={{ height: hauteurEtiquette }}>
        <span className="truncate text-titre font-semibold">{camera.name}</span>
        {channel && (
          <span className="shrink-0 whitespace-nowrap text-meta text-muted @max-[380px]:hidden">
            {qualityLabel(channel)}
          </span>
        )}
        {status === 'direct' ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 text-meta text-ok">
            <span aria-hidden className="h-[7px] w-[7px] rounded-full bg-current" />{t('espace.direct')}
          </span>
        ) : status === 'erreur' ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-meta text-soft">
            <span aria-hidden className="h-[7px] w-[7px] rounded-full bg-current" />{t('systeme.horsLigne')}
          </span>
        ) : sansFlux ? (
          /* La CAUSE plutôt que le silence : il manque un interrupteur sur la console. */
          <span className="shrink-0 whitespace-nowrap text-meta text-warn">{t('camera.rtspDesactive')}</span>
        ) : (
          <span className="shrink-0 text-meta text-soft">
            <span aria-hidden>…</span><span className="sr-only">{t('tuile.connexion')}</span>
          </span>
        )}

        {/* Les commandes vivent ICI, dans le bandeau, et non sur l'image. Visibles en
            permanence : il n'y a plus rien a decouvrir au survol. */}
        {actions && (
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <BoutonBandeau titre={t('tuile.revoir')} court={t('tuile.revoirCourt')} icone={History}
                         onClick={() => actions.onRelecture?.(camera.id)} />
            <BoutonBandeau titre={t('tuile.detections')} court={t('tuile.detectionsCourt')} icone={ScanSearch}
                         onClick={() => actions.onDetections?.(camera.id)} />
            <BoutonBandeau titre={t('video.capturer')} court={t('tuile.imageCourt')} icone={Camera}
                         onClick={() => { void capturer(); }} />
            <BoutonBandeau
              titre={!aDuSon ? t('video.pasDeSon')
                     : sonActif ? t('video.couperSon') : t('tuile.ecouter')}
              court={t('tuile.sonCourt')}
              icone={sonActif ? Volume2 : VolumeX}
              desactive={!aDuSon}
              actif={sonActif}
              onClick={() => basculerSon()} />
          </div>
        )}
      </div>
      )}
      <div className="relative min-h-0 flex-1">
        {image}
        {/* Images jointives : l'anneau d'or se pose A L'INTERIEUR, au-dessus de l'image. */}
        {activite && !cadre && (
          <div aria-hidden className="pointer-events-none absolute inset-0 z-10"
               style={{ boxShadow: 'inset 0 0 0 2px var(--accent-ligne)' }} />
        )}
      </div>
    </div>
  );
}
