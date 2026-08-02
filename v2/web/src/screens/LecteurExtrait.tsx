import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Download, Pause, Play, SkipBack, SkipForward, X } from 'lucide-react';
import { bridge } from '../lib/bridge';
import { CommandesVideo } from '../video/CommandesVideo';
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

export function LecteurExtrait({ detection, onFermer }: {
  detection: Detection;
  onFermer: () => void;
}) {
  useLangue();
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
  const vue = useZoomVideo(video, largeurVue, Boolean(url));
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

  /* ---- Échap referme, comme partout ailleurs ---- */
  useEffect(() => {
    const auClavier = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onFermer(); return; }

      // Un contrôle a le focus : espace l'actionne, les flèches déplacent le curseur de
      // la barre. Lui voler ces touches rendrait le lecteur inutilisable au clavier.
      const cible = e.target as HTMLElement | null;
      if (cible && /^(BUTTON|INPUT|SELECT|TEXTAREA)$/.test(cible.tagName)) return;

      if (e.key === ' ') { e.preventDefault(); basculer(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); pas(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); pas(1); }
      // « = » accompagne « + » : sur nombre de claviers c'est la meme touche sans majuscule.
      else if (e.key === '+' || e.key === '=') { e.preventDefault(); vue.zoomer(1.25); }
      else if (e.key === '-') { e.preventDefault(); vue.zoomer(1 / 1.25); }
    };
    // En capture : l'écouteur global de l'application traite aussi « Échap », et refermerait
    // le plein écran par la même touche.
    window.addEventListener('keydown', auClavier, true);
    return () => window.removeEventListener('keydown', auClavier, true);
  });

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
    <div className="absolute inset-0 z-40 flex flex-col" style={{ background: 'rgba(15,17,21,.93)' }}>
      {/* ---- en-tête ---- */}
      <div className="flex items-center gap-3 border-b border-line px-5 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px]">{titre}</p>
          <p className="truncate font-mono text-[11px] text-soft">
            {detection.cameraNom ?? t('extrait.cameraInconnue')}
            {detection.debut ? ` · ${horloge(new Date(detection.debut))}` : ''}
          </p>
        </div>
        {url && !illisible && (
          <button onClick={() => { void enregistrer(); }} title={t('extrait.enregistrerExtrait')}
                  className="flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-[12.5px] text-muted transition-colors hover:border-line2 hover:text-ink">
            <Download className="h-3.5 w-3.5" /> {t('extrait.enregistrer')}
          </button>
        )}
        <button onClick={onFermer} aria-label={t('commun.fermer')} title={t('commun.fermerEchap')}
                className="grid h-8 w-8 place-items-center rounded-md text-soft transition-colors hover:text-ink">
          <X className="h-4.5 w-4.5" />
        </button>
      </div>

      {/* ---- image ---- */}
      {/* « select-none » n'est pas cosmetique : sans lui, un glisser cree une SELECTION
          invisible, et le glisser suivant par-dessus demarre un glisser-depose natif qui
          tue le panoramique par pointercancel. Mesure sur le poste le 02.08.2026. */}
      <div
        className="relative min-h-0 flex-1 select-none overflow-hidden bg-black"
        ref={(el) => { if (el) setLargeurVue(el.clientWidth); }}
        style={{ cursor: vue.agrandi ? 'grab' : 'default' }}
        {...vue.gestes}
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
        <canvas ref={vue.canvasRef}
                className="absolute inset-0 h-full w-full object-contain"
                style={{ display: vue.agrandi ? 'block' : 'none' }} />

        {url && (
          <CommandesVideo
            zoom={vue.zoom}
            onReinitialiserZoom={vue.reinitialiser}
            aDuSon={son.aDuSon}
            sonActif={son.sonActif}
            onSon={son.basculer}
            onCapture={() => { void capturer(); }}
          />
        )}

        {vue.agrandi && (
          <div className="veil pointer-events-none absolute bottom-3 left-3 rounded-lg px-2.5 py-1">
            <span className="font-mono text-[11px]"
                  style={{ color: vue.interpole ? 'var(--bad)' : 'var(--on-1)' }}>
              {nombre(vue.zoom, 2)}×{vue.interpole ? ` · ${t('video.interpole')}` : ''}
            </span>
          </div>
        )}

        {!url && !erreur && (
          <div className="absolute inset-0 grid place-items-center">
            <div className="w-[min(320px,70vw)] text-center">
              <p className="text-[13px] text-muted">{t('extrait.extraction')}</p>
              <div className="mt-3 h-[3px] overflow-hidden rounded-full"
                   style={{ background: 'rgba(255,255,255,.09)' }}>
                <div className="h-full rounded-full"
                     style={{ width: `${pourcent}%`, background: 'var(--accent)',
                              transition: 'width .2s linear' }} />
              </div>
              <p className="mt-2 font-mono text-[11px] text-soft">{pourcent} %</p>
            </div>
          </div>
        )}

        {(erreur || illisible) && (
          <div className="absolute inset-0 grid place-items-center p-8">
            <div className="max-w-md text-center">
              <AlertCircle className="mx-auto mb-3 h-6 w-6" style={{ color: 'var(--warn)' }} />
              <p className="text-[14px]">
                {illisible ? t('video.sequenceIllisible') : erreur}
              </p>
              {illisible && (
                <p className="mt-2 text-[12.5px] text-soft">
                  {t('extrait.formatIndecodable')}
                </p>
              )}
              {illisible && jeton && (
                <button onClick={() => { void enregistrer(); }}
                        className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-[13px] text-muted transition-colors hover:border-line2 hover:text-ink">
                  <Download className="h-3.5 w-3.5" /> {t('extrait.enregistrerExtrait')}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ---- transport ---- */}
      {url && !illisible && (
        <div className="flex items-center gap-3 border-t border-line px-5 py-3">
          <button onClick={basculer} aria-label={enLecture ? t('video.pause') : t('video.lecture')}
                  className="grid h-9 w-9 place-items-center rounded-md"
                  style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
            {enLecture ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <button onClick={() => pas(-1)} title={`${t('video.imagePrecedente')} (←)`}
                  className="grid h-8 w-8 place-items-center rounded-md text-soft transition-colors hover:text-ink">
            <SkipBack className="h-4 w-4" />
          </button>
          <button onClick={() => pas(1)} title={`${t('video.imageSuivante')} (→)`}
                  className="grid h-8 w-8 place-items-center rounded-md text-soft transition-colors hover:text-ink">
            <SkipForward className="h-4 w-4" />
          </button>

          <span className="font-mono text-[11.5px] tabular-nums text-soft">{mmss(position)}</span>
          <input
            type="range" min={0} max={duree || 0} step={0.02} value={position}
            onChange={(e) => {
              const v = video.current;
              if (v) { v.currentTime = Number(e.target.value); setPosition(Number(e.target.value)); }
            }}
            aria-label={t('extrait.position')}
            className="min-w-0 flex-1" style={{ accentColor: 'var(--accent)' }}
          />
          <span className="font-mono text-[11.5px] tabular-nums text-soft">{mmss(duree)}</span>

          <div className="flex items-center gap-1">
            {VITESSES.map((v) => (
              <button key={v} onClick={() => {
                setVitesse(v);
                if (video.current) video.current.playbackRate = v;
              }}
                      aria-pressed={vitesse === v}
                      className="rounded px-2 py-1 font-mono text-[11.5px] transition-colors"
                      style={vitesse === v
                        ? { background: 'var(--accent-soft)', color: 'var(--accent)' }
                        : { color: 'var(--soft)' }}>
                {v}×
              </button>
            ))}
          </div>
        </div>
      )}

      {enregistre && (
        <div className="border-t border-line px-5 py-2 text-[12.5px]" style={{ color: 'var(--ok)' }}>
          {t('extrait.enregistre')} <span className="font-mono text-[11.5px]">{enregistre}</span>
        </div>
      )}
    </div>
  );
}
