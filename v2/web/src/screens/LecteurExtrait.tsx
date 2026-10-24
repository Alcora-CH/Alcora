import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle, Camera, ChevronLeft, Download, History, Pause, Play, SkipBack, SkipForward, Volume2, VolumeX, ZoomOut,
} from 'lucide-react';
import { bridge } from '../lib/bridge';
import { useFermetureAnimee } from '../lib/fermeture';
import { BoutonBandeau } from '../video/BoutonBandeau';
import { Bouton } from '../ui/Bouton';
import { Segment } from '../ui/Segment';
import { imageDeLaVideo, useSonVideo } from '../video/outils';
import { useZoomVideo } from '../video/useZoomVideo';
import { localeDates, nombre, t, useLangue } from '../i18n';
import { nomSujet } from '../i18n/sujets';
import type { Detection } from '../types/protect';

/**
 * Relecture d'une detection.
 *
 * Ce que la mesure du 28.07.2026 impose : le controleur ignore « Range » et place l'index
 * en queue de fichier, donc l'extrait doit etre obtenu ENTIER avant la premiere image.
 * Mais il produit a 77 fois le temps reel — une detection de quinze secondes pese ~4 Mo et
 * arrive en une fraction de seconde. L'attente existe, elle se compte en dixiemes.
 *
 * Une reserve demeure, et le lecteur doit la porter : la mesure ne couvre que la G5
 * (H.264, lisible nativement). Si une autre camera exportait en AV1 ou H.265, Electron ne
 * saurait pas la lire. Un echec de decodage doit donc se DIRE, jamais se traduire par un
 * rectangle noir dont personne ne comprend la cause.
 */

const VITESSES = [0.25, 0.5, 1, 2] as const;
/** Un pas d'image, a trente images par seconde. */
const PAS_IMAGE = 1 / 30;

const horloge = (d: Date) => new Intl.DateTimeFormat(localeDates(),
  { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(d);

function mmss(s: number): string {
  if (!Number.isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

export function LecteurExtrait({ detection, retour, onFermer, onRelecture }: {
  detection: Detection;
  /** L'écran d'où l'on vient, nommé sur le bouton de retour : « ← Direct ». */
  retour: string;
  onFermer: () => void;
  /** « Voir dans la relecture » : la relecture de cette caméra, à l'heure de la détection. */
  onRelecture?: () => void;
}) {
  useLangue();
  /* La séquence part EN FONDU : « onFermer » n'est appelé qu'une fois l'animation finie,
     et l'écran resté dessous réapparaît à travers elle. */
  const { part, fermer, ref: fenetre } = useFermetureAnimee<HTMLElement>(onFermer);
  /* Le focus sur le lecteur lui-même : Espace, les flèches et + − le visent — et non la
     carte cliquée ailleurs, qui gardait le focus et se re-cliquait (revue du 23.10.2026).
     En partant, il revient à cette carte, restée montée sous la séquence — sauf si l'on est
     parti par le rail : le focus est alors déjà ailleurs, on ne le reprend pas. */
  useEffect(() => {
    const avant = document.activeElement as HTMLElement | null;
    const el = fenetre.current;
    el?.focus({ preventScroll: true });
    return () => {
      const ici = document.activeElement;
      const perdu = !ici || ici === document.body || !!el?.contains(ici);
      if (perdu && avant && document.contains(avant)) avant.focus({ preventScroll: true });
    };
  }, [fenetre]);
  const video = useRef<HTMLVideoElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [pourcent, setPourcent] = useState(0);
  const [erreur, setErreur] = useState<string | null>(null);
  const [illisible, setIllisible] = useState(false);
  const [enLecture, setEnLecture] = useState(false);
  const [position, setPosition] = useState(0);
  const [duree, setDuree] = useState(0);
  const [vitesse, setVitesse] = useState<number>(1);
  const [enregistre, setEnregistre] = useState<string | null>(null);
  const [largeurVue, setLargeurVue] = useState(0);

  /*
   * Zoom, son et capture — les memes qu'en direct, montes une fois (video/).
   * C'est ICI qu'ils comptent le plus : on ouvre une sequence pour regarder un detail,
   * pas pour la contempler de loin.
   */
  // Deplie : un objet qui porte une reference ferait prendre chacune de ses valeurs pour une
  // reference (regle react/refs, rallumee le 24.10.2026).
  const { gestes, canvasRef, zoom, agrandi, interpole, reinitialiser, zoomer } =
    useZoomVideo(video, largeurVue, Boolean(url));
  const son = useSonVideo(video, Boolean(url));

  const capturer = useCallback(async () => {
    const image = await imageDeLaVideo(video.current);
    if (!image) { setEnregistre(t('video.imageIndisponible')); return; }
    try {
      const nom = `${detection.cameraNom ?? 'camera'} ${horloge(new Date(detection.debut ?? Date.now()))}`;
      setEnregistre(t('video.imageEnregistree',
        { chemin: await bridge.capturer(nom, await image.arrayBuffer()) }));
    } catch (e) {
      setEnregistre(e instanceof Error ? e.message : String(e));
    }
  }, [detection.cameraNom, detection.debut]);

  const titre = detection.sujets.length
    ? detection.sujets.map(nomSujet).join(', ')
    : t('sujet.motion');

  /* ---- obtention ---- */
  useEffect(() => {
    let vivant = true;
    const off = bridge.onExtraitProgres((e) => { if (vivant) setPourcent(e.pourcent); });

    bridge.extraire({ camera: detection.camera!, debut: detection.debut!, fin: detection.fin })
      .then((r) => { if (vivant) setUrl(r.url); })
      .catch((e) => { if (vivant) setErreur(e instanceof Error ? e.message : String(e)); });

    return () => { vivant = false; off(); };
  }, [detection.camera, detection.debut, detection.fin]);

  const basculer = useCallback(() => {
    const v = video.current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => {});
    else v.pause();
  }, []);

  /** Avance ou recule d'une image. Le lecteur doit être en pause pour que cela ait un sens. */
  const pas = useCallback((sens: number) => {
    const v = video.current;
    if (!v) return;
    v.pause();
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + sens * PAS_IMAGE));
  }, []);
  /* ---- Échap referme, comme partout ailleurs ---- */
  // (Les fonctions qu'il appelle sont définies AVANT lui : règle react/immutability.)
  useEffect(() => {
    const auClavier = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); fermer(); return; }

      // Un contrôle a le focus : espace l'actionne, les flèches déplacent le curseur de
      // la barre. Lui voler ces touches rendrait le lecteur inutilisable au clavier.
      const cible = e.target as HTMLElement | null;
      if (cible && /^(BUTTON|INPUT|SELECT|TEXTAREA)$/.test(cible.tagName)) return;

      if (e.key === ' ') { e.preventDefault(); basculer(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); pas(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); pas(1); }
      // « = » accompagne « + » : sur nombre de claviers c'est la meme touche sans majuscule.
      else if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomer(1.25); }
      else if (e.key === '-') { e.preventDefault(); zoomer(1 / 1.25); }
    };
    // En capture : l'écouteur global de l'application traite aussi « Échap », et refermerait
    // le plein écran par la même touche. Sur le DOCUMENT, que la capture atteint après la
    // fenêtre : le panneau des raccourcis, qui écoute sur la fenêtre, passe d'abord — ouvert à
    // côté de la séquence, Échap le referme lui seul, pas les deux d'un coup.
    document.addEventListener('keydown', auClavier, true);
    return () => document.removeEventListener('keydown', auClavier, true);
  });


  const jeton = url ? url.replace('/extrait/', '') : null;

  const enregistrer = async () => {
    if (!jeton) return;
    const quand = detection.debut ? new Date(detection.debut) : new Date();
    const nom = `${detection.cameraNom ?? 'camera'} ${quand.toISOString().slice(0, 19).replace(/[:T]/g, '-')}`;
    try {
      const r = await bridge.enregistrerExtrait({ jeton, nom });
      if (r.enregistre && r.chemin) setEnregistre(r.chemin);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    /*
     * La séquence prend la place du contenu, dans le cadre — rail et barre d'état gardés :
     * plus de fenêtre posée par-dessus l'application (décision de Thomas, 24.10.2026 : « une
     * fenêtre unique tout-en-un »). « ← Direct » ou Échap ramènent d'où l'on vient.
     *
     * Opaque et posée SUR l'écran, qui reste monté et inerte dessous (l'appelant s'en charge) :
     * démonté, le mur reconnectait toutes ses caméras au retour et la liste des détections
     * revenait en haut (mesuré le 24.10.2026 : 1144 px → 0).
     */
    <section ref={fenetre} tabIndex={-1} aria-label={titre}
             className={`@container absolute inset-0 z-40 flex flex-col overflow-hidden bg-card outline-none ${part ? 'm-voile m-part' : 'm-ecran'}`}>
        {/* ---- en-tête ---- */}
        <div className="flex h-16 shrink-0 items-center gap-3.5 border-b border-line pl-3 pr-5">
          <Bouton variante="fantome" icone={ChevronLeft} titre={t('commun.fermerEchap')} onClick={fermer}>{retour}</Bouton>
          <div className="min-w-0 flex-1">
            <p className="truncate text-titre font-semibold">{titre}</p>
            <p className="truncate text-meta tabular-nums text-muted">
              {detection.cameraNom ?? t('extrait.cameraInconnue')}
              {detection.debut ? `, ${horloge(new Date(detection.debut))}` : ''}
            </p>
          </div>
          {/* De la séquence à la relecture, à cet instant : pour voir ce qui précède et ce qui
              suit, au-delà des quelques secondes de l'extrait. */}
          {onRelecture && (
            <Bouton icone={History} onClick={() => { onRelecture(); fermer(); }}>{t('extrait.voirRelecture')}</Bouton>
          )}
          {url && !illisible && (
            <Bouton icone={Download} titre={t('extrait.enregistrerExtrait')} onClick={() => { void enregistrer(); }}>
              {t('extrait.enregistrer')}
            </Bouton>
          )}
        </div>

        {/* ---- le bandeau : hors de l'image, comme au direct et en relecture ---- */}
        {url && !illisible && (
          <div className="flex h-11 shrink-0 items-center gap-2.5 border-b border-line pl-5 pr-2">
            {duree > 0 && (
              <span className="text-meta text-muted">{t('extrait.duree', { n: Math.round(duree) })}</span>
            )}
            <div className="ml-auto flex shrink-0 items-center gap-1">
              {agrandi && (
                <BoutonBandeau titre={t('video.revenirImage', { zoom: nombre(zoom, 2) })}
                               court={t('video.imageEntiere')} icone={ZoomOut} actif onClick={reinitialiser} />
              )}
              <BoutonBandeau
                titre={son.aDuSon === false ? t('video.pasDeSon')
                  : son.sonActif ? t('video.couperSon') : t('video.activerSon')}
                court={t('tuile.sonCourt')} icone={son.sonActif ? Volume2 : VolumeX}
                desactive={son.aDuSon === false} actif={son.sonActif} onClick={son.basculer} />
              <BoutonBandeau titre={t('video.capturer')} court={t('tuile.imageCourt')} icone={Camera}
                             onClick={() => { void capturer(); }} />
            </div>
          </div>
        )}

        {/* ---- image ---- */}
        {/* « select-none » n'est pas cosmetique : sans lui, un glisser cree une SELECTION
            invisible, et le glisser suivant par-dessus demarre un glisser-depose natif qui
            tue le panoramique par pointercancel. Mesure sur le poste le 02.08.2026. */}
        <div
          className="relative min-h-0 flex-1 select-none overflow-hidden bg-black"
          ref={(el) => { if (el) setLargeurVue(el.clientWidth); }}
          style={{ cursor: agrandi ? 'grab' : 'default' }}
          {...gestes}
        >
          {url && (
            <video
              ref={video}
              src={url}
              autoPlay
              className="h-full w-full"
              style={{ objectFit: 'contain' }}
              onPlay={() => setEnLecture(true)}
              onPause={() => setEnLecture(false)}
              onTimeUpdate={(e) => setPosition(e.currentTarget.currentTime)}
              onDurationChange={(e) => setDuree(e.currentTarget.duration || 0)}
              /* Le seul signal d'un codec que ce PC ne sait pas décoder. Sans lui,
                 l'utilisateur ne verrait qu'un rectangle noir. */
              onError={() => setIllisible(true)}
            />
          )}

          {/* Le canevas recadre dans les pixels de la SOURCE : il prend la main dès qu'on
              agrandit, et laisse l'élément vidéo afficher directement sinon. */}
          <canvas ref={canvasRef}
                  className="absolute inset-0 h-full w-full object-contain"
                  style={{ display: agrandi ? 'block' : 'none' }} />

          {agrandi && (
            <div className="veil pointer-events-none absolute bottom-2.5 left-2.5 flex h-6 items-center gap-1.5 rounded-md px-2.5 text-meta tabular-nums"
                 style={{ color: 'var(--on-1)' }}>
              {nombre(zoom, 2)}×
              {interpole && <span className="text-bad">{t('video.interpole')}</span>}
            </div>
          )}

          {!url && !erreur && (
            <div className="absolute inset-0 grid place-items-center">
              <div className="w-[min(320px,70vw)] text-center">
                <p className="text-muted">{t('extrait.extraction')}</p>
                <div className="mt-3 h-[3px] overflow-hidden rounded-full bg-white/[.09]">
                  <div className="h-full rounded-full bg-accent"
                       style={{ width: `${pourcent}%`, transition: 'width .2s linear' }} />
                </div>
                <p className="mt-2 text-meta tabular-nums text-soft">{pourcent} %</p>
              </div>
            </div>
          )}

          {(erreur || illisible) && (
            <div className="absolute inset-0 grid place-items-center p-8">
              <div className="max-w-md text-center">
                <AlertCircle className="mx-auto mb-3 h-6 w-6 text-warn" aria-hidden />
                <p className="text-titre">{illisible ? t('video.sequenceIllisible') : erreur}</p>
                {illisible && <p className="mt-2 text-meta text-soft">{t('extrait.formatIndecodable')}</p>}
                {illisible && jeton && (
                  <Bouton icone={Download} className="mt-4" onClick={() => { void enregistrer(); }}>
                    {t('extrait.enregistrerExtrait')}
                  </Bouton>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ---- transport ---- */}
        {url && !illisible && (
          <div className="flex items-center gap-2.5 border-t border-line px-[18px] py-3">
            <button type="button" onClick={basculer}
                    aria-label={enLecture ? t('video.pause') : t('video.lecture')}
                    title={enLecture ? t('video.pause') : t('video.lecture')}
                    className="m-pression grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[10px] bg-accent text-sur-accent transition hover:brightness-110">
              {enLecture ? <Pause className="h-[17px] w-[17px] fill-current" aria-hidden />
                : <Play className="h-[17px] w-[17px] fill-current" aria-hidden />}
            </button>
            <Bouton variante="fantome" taille="petit" icone={SkipBack} titre={`${t('video.imagePrecedente')} (←)`}
                    onClick={() => pas(-1)} />
            <Bouton variante="fantome" taille="petit" icone={SkipForward} titre={`${t('video.imageSuivante')} (→)`}
                    onClick={() => pas(1)} />

            <span className="font-mono tabular-nums text-muted">{mmss(position)}</span>
            <input
              type="range" min={0} max={duree || 0} step={0.02} value={position}
              onChange={(e) => {
                const v = video.current;
                if (v) { v.currentTime = Number(e.target.value); setPosition(Number(e.target.value)); }
              }}
              aria-label={t('extrait.position')}
              className="min-w-0 flex-1 accent-[var(--accent)]"
            />
            <span className="font-mono tabular-nums text-muted">{mmss(duree)}</span>

            <Segment etiquette={t('relecture.vitesse')} valeur={vitesse}
                     options={VITESSES.map((v) => ({ valeur: v, libelle: `${nombre(v, v === 0.25 ? 2 : v === 0.5 ? 1 : 0)}×` }))}
                     onChange={(v) => {
                       setVitesse(v);
                       if (video.current) video.current.playbackRate = v;
                     }} />
          </div>
        )}

        {enregistre && (
          <div className="border-t border-line px-5 py-2.5 text-meta text-ok">
            {t('extrait.enregistre')} <span className="break-all font-mono">{enregistre}</span>
          </div>
        )}
    </section>
  );
}
