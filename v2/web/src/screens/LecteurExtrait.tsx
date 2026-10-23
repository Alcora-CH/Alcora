import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle, Camera, Download, History, Pause, Play, SkipBack, SkipForward, Volume2, VolumeX, X, ZoomOut,
} from 'lucide-react';
import { bridge } from '../lib/bridge';
import { BoutonBandeau } from '../video/BoutonBandeau';
import { Bouton } from '../ui/Bouton';
import { Segment } from '../ui/Segment';
import { imageDeLaVideo, useSonVideo } from '../video/outils';
import { useZoomVideo } from '../video/useZoomVideo';
import { useFermetureAnimee } from '../lib/fermeture';
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

export function LecteurExtrait({ detection, onFermer, onRelecture }: {
  detection: Detection;
  onFermer: () => void;
  /** « Voir dans la relecture » : la relecture de cette caméra, à l'heure de la détection. */
  onRelecture?: () => void;
}) {
  useLangue();
  /* Le lecteur se referme EN PARTANT : « onFermer » n'est appele qu'une fois
     l'animation de sortie terminee. */
  const { part, fermer, ref: cadre } = useFermetureAnimee(onFermer);
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
      if (e.key === 'Escape') { e.stopPropagation(); fermer(); return; }

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
    /*
     * Une carte posée sur un voile sombre (maquette A), plus un plein écran : on garde sous
     * les yeux d'où l'on vient. Pas de fermeture au clic à côté : un glisser pour se
     * déplacer dans l'image agrandie, relâché hors de la carte, la refermerait par erreur.
     * Échap et le bouton suffisent.
     */
    <div ref={cadre}
         className={`m-voile absolute inset-0 z-40${part ? ' m-part' : ''}`}
         style={{ background: 'rgba(8,11,16,.72)' }}>
      <section role="dialog" aria-modal="true" aria-label={titre}
               className={`@container m-boite absolute inset-x-10 bottom-[30px] top-16 flex flex-col overflow-hidden rounded-xl border border-line2 bg-card shadow-[0_40px_100px_-30px_rgba(0,0,0,.9)]${part ? ' m-part' : ''}`}>
        {/* ---- en-tête ---- */}
        <div className="flex items-center gap-3.5 border-b border-line py-3.5 pl-5 pr-4">
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
          <Bouton variante="fantome" icone={X} titre={t('commun.fermerEchap')} onClick={fermer} />
        </div>

        {/* ---- le bandeau : hors de l'image, comme au direct et en relecture ---- */}
        {url && !illisible && (
          <div className="flex h-11 shrink-0 items-center gap-2.5 border-b border-line pl-5 pr-2">
            {duree > 0 && (
              <span className="text-meta text-muted">{t('extrait.duree', { n: Math.round(duree) })}</span>
            )}
            <div className="ml-auto flex shrink-0 items-center gap-1">
              {vue.agrandi && (
                <BoutonBandeau titre={t('video.revenirImage', { zoom: nombre(vue.zoom, 2) })}
                               court={t('video.imageEntiere')} icone={ZoomOut} actif onClick={vue.reinitialiser} />
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

          {vue.agrandi && (
            <div className="veil pointer-events-none absolute bottom-2.5 left-2.5 flex h-6 items-center gap-1.5 rounded-md px-2.5 text-meta tabular-nums"
                 style={{ color: 'var(--on-1)' }}>
              {nombre(vue.zoom, 2)}×
              {vue.interpole && <span className="text-bad">{t('video.interpole')}</span>}
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
    </div>
  );
}
