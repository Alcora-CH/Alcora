import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Play, ScanSearch, Volume2, VolumeX } from 'lucide-react';
import { connectWhep, type WhepSession } from './whep';
import { attenteReprise, causeDeReprise } from './sante';
import { pickChannel, qualityLabel, relayPath } from './channel';
import { nombre, t, useLangue } from '../i18n';

/**
 * Delai d'immobilite avant de reevaluer le canal apres un changement de taille.
 *
 * Assez long pour absorber l'animation d'une fenetre qu'on agrandit ou restaure, assez
 * court pour que la montee en qualite suive le geste sans se faire attendre.
 */
const STABILISATION_MS = 400;
import { useZoomVideo } from './useZoomVideo';
import type { DiscoveredCamera } from '../types/protect';

export interface CameraTileProps {
  camera: DiscoveredCamera;
  relayBase: string;
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

/**
 * Bouton de commande d'une tuile, pose dans le BANDEAU DE TITRE et non sur l'image.
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
 */
function BoutonTuile({ titre, onClick, children, actif, desactive }: {
  titre: string;
  onClick: () => void;
  children: React.ReactNode;
  actif?: boolean;
  desactive?: boolean;
}) {
  return (
    <div className="group/bt relative shrink-0">
      <button
        type="button"
        aria-label={titre}
        disabled={desactive}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        onPointerDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        className="grid h-[26px] w-[26px] place-items-center rounded-md border transition-colors
                   hover:brightness-125 disabled:opacity-30"
        style={{
          background: actif ? 'var(--accent)' : 'var(--card2)',
          borderColor: actif ? 'var(--accent)' : 'var(--line2)',
          color: actif ? '#1b1e23' : 'var(--ink)',
        }}
      >
        {children}
      </button>

      {/*
        L'etiquette est POSEE PAR L'APPLICATION, pas par le systeme.
        Celle du systeme met une seconde a venir, et l'infobulle du conteneur — « glisser
        pour reorganiser » — passait devant. Elle s'ouvre vers le BAS : le bandeau est en
        haut de la tuile, une etiquette vers le haut serait coupee par la tuile voisine.

        Elle est calee sur le bord DROIT du bouton, pas sur son centre. Centree, celle des
        deux derniers boutons sortait de l'ecran — ils sont contre le bord droit de la
        tuile, qui est lui-meme contre celui de la fenetre. Calee a droite, elle grandit
        toujours vers l'interieur, quel que soit le bouton et quelle que soit la tuile.
      */}
      <span
        className="pointer-events-none absolute right-0 top-full z-30 mt-1 hidden
                   whitespace-nowrap rounded-md px-2.5 py-1 text-[12px] group-hover/bt:block"
        style={{ background: 'rgba(14,17,22,.96)', color: '#eae5db',
                 border: '1px solid rgba(255,255,255,.18)', boxShadow: '0 4px 14px rgba(0,0,0,.55)' }}
      >
        {titre}
      </span>
    </div>
  );
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
  camera, relayBase, headroom = 2, cadre = true, hauteurEtiquette = 26, actions, activite,
  zoomClavier = false,
}: CameraTileProps) {
  useLangue();
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const sessionRef = useRef<WhepSession | null>(null);

  const [status, setStatus] = useState<Status>('attente');
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
    console.log(`[tuile ${camera.name}] appel ${relayBase}/${path}/whep`);

    connectWhep(`${relayBase}/${path}/whep`, video)
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
  }, [path, relayBase, camera.name, generation]);

  /*
   * Reprise apres un echec de connexion.
   *
   * Une tuile en erreur y restait definitivement : le relais pouvait revenir, le
   * controleur repondre a nouveau, l'image ne revenait jamais sans relancer l'application.
   */
  useEffect(() => {
    if (status !== 'erreur') return;
    const attente = attenteReprise(essaisRef.current, REPRISE_MS);
    essaisRef.current += 1;
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

  const upscaling = vue.interpole;
  const zoomed = vue.agrandi;

  const image = (
    <div
      ref={containerRef}
      /* La cellule est deja dimensionnee a la bonne proportion par la mosaique : imposer
         « aspect-video » ici ferait s'affronter deux regles sur le meme arrondi. */
      className={`group relative h-full w-full select-none overflow-hidden bg-black ${
        cadre ? 'rounded-md border tuile-flottante' : ''}`}
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
        <div className="pointer-events-none absolute inset-x-0 bottom-14 z-20 flex justify-center">
          <span className="max-w-[86%] truncate rounded-lg px-3 py-1.5 text-[12.5px]"
                style={{ background: 'rgba(14,17,22,.92)', color: '#eae5db',
                         border: '1px solid rgba(255,255,255,.16)' }}>
            {capture}
          </span>
        </div>
      )}

      <canvas ref={canvasRef}
              className="absolute inset-0 h-full w-full object-contain"
              style={{ display: zoomed ? 'block' : 'none' }} />

      {zoomed && (
        <div className="veil pointer-events-none absolute bottom-3 left-3 rounded-lg px-2.5 py-1">
          <span className="font-mono text-[11px]"
                style={{ color: upscaling ? 'var(--bad)' : 'var(--on-1)' }}>
            {nombre(zoom, 2)}×{upscaling ? ` · ${t('video.interpole')}` : ''}
          </span>
        </div>
      )}

      {status !== 'direct' && (
        <div className="absolute inset-0 grid place-items-center">
          <span className="font-mono text-[12px]" style={{ color: 'var(--muted)' }}>
            {status === 'erreur' ? t('tuile.fluxIndisponible')
              : status === 'attente' ? '' : t('tuile.connexion')}
          </span>
        </div>
      )}

      {/*
        Activite en cours, reprise de Protect.
        ------------------------------------------------------------------
        Le halo est pose sur le CADRE, hors de l'image : un voile par-dessus la video
        masquerait justement ce qu'on veut faire regarder. Le trait tourne tant que la
        detection dure, et s'eteint a sa fin — les deux bouts viennent de la liaison temps
        reel, celle qui previent trois secondes avant Protect.

        « pointer-events-none » est indispensable : sans lui, le halo intercepterait la
        molette et le glisser, et l'on ne pourrait plus zoomer sur la camera ou il se passe
        quelque chose — exactement celle qu'on veut regarder.
      */}
      {activite && (
        <>
          <div className="halo-activite pointer-events-none absolute inset-0 z-10"
               style={cadre ? { borderRadius: '0.375rem' } : undefined} />
          <div className="veil pointer-events-none absolute right-2 top-2 z-10 flex items-center gap-1.5 rounded-full px-2 py-[3px]">
            <span className="point-activite h-1.5 w-1.5 rounded-full"
                  style={{ background: 'var(--accent-d)' }} />
            <span className="text-[11px]" style={{ color: 'var(--on-1)' }}>
              {activite.libelle}
            </span>
          </div>
        </>
      )}
    </div>
  );

  /*
   * L'etiquette vit HORS de l'image, au-dessus d'elle.
   *
   * Posee dessus, elle masquait une partie de la scene — et redoublait l'horodatage que
   * les cameras incrustent elles-memes. Dehors, elle ne cache plus rien et reste lisible
   * quelle que soit la luminosite du flux.
   */
  return (
    <div className="flex h-full w-full flex-col">
      {/* A hauteur nulle (l'invite de la relecture), le bandeau ne se rend pas du
          tout : son contenu deborderait d'un conteneur a zero pixel et viendrait
          s'imprimer sur le haut de l'image. */}
      {hauteurEtiquette > 0 && (
      <div className="flex shrink-0 items-center gap-2 px-1.5 pb-1"
           style={{ height: hauteurEtiquette }}>
        <span className="truncate text-[12.5px]" style={{ color: 'var(--ink)' }}>{camera.name}</span>
        {channel && (
          <span className="shrink-0 font-mono text-[10.5px]"
                style={{ color: channel.quality === 'high' ? 'var(--accent-d)' : 'var(--soft)' }}>
            {qualityLabel(channel)}
          </span>
        )}
        <span className="shrink-0 font-mono text-[10px]"
              style={{ color: status === 'direct' ? 'var(--ok)' : 'var(--soft)' }}>
          {status === 'direct' ? '' : status === 'erreur' ? t('commun.horsLigne') : '…'}
        </span>

        {/* Les commandes vivent ICI, dans le bandeau, et non sur l'image. Visibles en
            permanence : il n'y a plus rien a decouvrir au survol. */}
        {actions && (
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <BoutonTuile titre={t('tuile.revoir')} onClick={() => actions.onRelecture?.(camera.id)}>
              <Play className="h-3.5 w-3.5" />
            </BoutonTuile>
            <BoutonTuile titre={t('tuile.detections')} onClick={() => actions.onDetections?.(camera.id)}>
              <ScanSearch className="h-3.5 w-3.5" />
            </BoutonTuile>
            <BoutonTuile titre={t('video.capturer')} onClick={() => { void capturer(); }}>
              <Camera className="h-3.5 w-3.5" />
            </BoutonTuile>
            <BoutonTuile
              titre={!aDuSon ? t('video.pasDeSon')
                     : sonActif ? t('video.couperSon') : t('tuile.ecouter')}
              desactive={!aDuSon}
              actif={sonActif}
              onClick={() => basculerSon()}>
              {sonActif ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            </BoutonTuile>
          </div>
        )}
      </div>
      )}
      <div className="min-h-0 flex-1">{image}</div>
    </div>
  );
}
