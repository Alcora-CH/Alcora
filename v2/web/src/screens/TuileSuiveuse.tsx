import { useEffect, useRef, useState } from 'react';
import { Camera, Volume2, VolumeX } from 'lucide-react';
import { bridge } from '../lib/bridge';
import { messageLisible } from '../lib/erreurs';
import { BoutonBandeau } from '../video/BoutonBandeau';
import { imageDeLaVideo } from '../video/outils';
import { localeDates, t, useLangue } from '../i18n';
import { Carte } from '../ui/Cadre';
import type { DiscoveredCamera } from '../types/protect';

/**
 * Une caméra de plus dans la relecture — variante 2 de docs/maquette-relecture-multi.html,
 * retenue le 23.10.2026.
 *
 * Elle ne mène pas : la tuile active (bordure dorée) lit, et celle-ci SUIT son heure. Elle a
 * ses deux lecteurs qui se relaient, comme la tuile active et pour la même raison (un seul
 * lecteur coupait toutes les dix secondes), et se recale dès qu'elle s'écarte de plus de
 * 0,7 s : en dessous l'œil ne voit rien, et chaque recalage coûte une image.
 *
 * Ses morceaux passent par la même file que ceux de la tuile active (extraits.js) : le
 * contrôleur ne reçoit jamais deux exports à la fois. Mesuré le 23.10.2026 : deux caméras
 * relues ensemble l'occupent ~7 % du temps.
 */

const PAS_MS = 10_000;
const PAS_SUITE_MS = 30_000;
const ECART_MAX_MS = 700;

type Morceau = { url: string; debut: number; fin: number };

export function TuileSuiveuse({ camera, frontiere, saut, instant, enLecture, vitesse, sonActif, onSon, onChoisir, onMorceau }: {
  camera: DiscoveredCamera;
  /** Avant cet instant, seule la basse définition subsiste. */
  frontiere: number | null;
  /** Un saut de la console (frise, ±10 s, une détection) : un objet neuf à chaque saut. */
  saut: { t: number } | null;
  /** L'heure lue par la tuile active. */
  instant: number | null;
  enLecture: boolean;
  vitesse: number;
  /** Une seule caméra parle à la fois : c'est la relecture qui choisit laquelle. */
  sonActif: boolean;
  onSon: () => void;
  /** Un clic sur l'image en fait la tuile active. */
  onChoisir: () => void;
  /** Chaque morceau obtenu : la relecture en tire le débit, pour estimer un export. */
  onMorceau?: (s: { debut: number; fin: number; octets: number }) => void;
}) {
  useLangue();
  const lecteurs = [useRef<HTMLVideoElement>(null), useRef<HTMLVideoElement>(null)];
  const [morceaux, setMorceaux] = useState<[Morceau | null, Morceau | null]>([null, null]);
  const [actif, setActif] = useState(0);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [definition, setDefinition] = useState<string | null>(null);
  const [capture, setCapture] = useState<string | null>(null);
  /** Instant absolu à viser dans chaque case au chargement, ou null pour « depuis le début ». */
  const cibles = useRef<[number | null, number | null]>([null, null]);
  /** Chaque chargement a son numéro : un morceau revenu après un saut plus récent est jeté. */
  const generation = useRef(0);
  /** Le dernier instant qu'un chargement a échoué à couvrir : on ne réessaie pas en boucle. */
  const echec = useRef<number | null>(null);
  const etat = useRef({ morceaux, actif, chargement, instant, enLecture, vitesse, sonActif });
  etat.current = { morceaux, actif, chargement, instant, enLecture, vitesse, sonActif };

  const precharger = async (i: number, depuis: number, g: number) => {
    try {
      const s = await bridge.sequence({ camera: camera.id, depuis, duree: PAS_SUITE_MS });
      if (g !== generation.current) return;
      onMorceau?.(s);
      cibles.current[i] = null;
      setMorceaux((m) => { const n: [Morceau | null, Morceau | null] = [m[0], m[1]]; n[i] = s; return n; });
    } catch { /* le relais retombera sur un chargement ordinaire */ }
  };

  const charger = async (cible: number) => {
    const g = ++generation.current;
    setChargement(true);
    setErreur(null);
    try {
      const s = await bridge.sequence({ camera: camera.id, instant: cible, duree: PAS_MS });
      if (g !== generation.current) return;
      onMorceau?.(s);
      echec.current = null;
      cibles.current = [cible, null];
      setActif(0);
      setMorceaux([s, null]);
      void precharger(1, s.fin, g);
    } catch (e) {
      if (g !== generation.current) return;
      echec.current = cible;
      setMorceaux([null, null]);
      setErreur(messageLisible(e));
    } finally {
      if (g === generation.current) setChargement(false);
    }
  };

  /*
   * L'arrivée de la tuile, ou un saut de la console : on va chercher l'instant. À l'arrivée,
   * c'est l'heure LUE qui compte — le dernier saut peut dater de plusieurs minutes de lecture.
   */
  const arrivee = useRef(true);
  useEffect(() => {
    const cible = arrivee.current ? (etat.current.instant ?? saut?.t ?? null) : (saut?.t ?? null);
    arrivee.current = false;
    if (cible !== null) void charger(cible);
    // Seuls le saut et la caméra comptent : l'heure qui avance se suit plus bas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saut, camera.id]);

  /* Suivre la tuile active : se recaler, passer au morceau suivant, ou aller chercher. */
  useEffect(() => {
    if (instant === null) return;
    const { morceaux: m, actif: a, chargement: occupe } = etat.current;
    if (occupe) return;
    const ici = m[a];
    const v = lecteurs[a].current;
    if (!ici || !v) {
      // Un échec ne se retente qu'une fois sorti de son morceau de dix secondes.
      if (echec.current === null || Math.abs(instant - echec.current) > PAS_MS) void charger(instant);
      return;
    }
    if (instant < ici.debut - 500 || instant > ici.fin + 500) {
      const la = m[1 - a];
      if (la && instant >= la.debut && instant < la.fin) {
        cibles.current[1 - a] = instant;
        setActif(1 - a);
        const w = lecteurs[1 - a].current;
        if (w) { w.currentTime = (instant - la.debut) / 1000; if (etat.current.enLecture) void w.play().catch(() => {}); }
        void precharger(a, la.fin, generation.current);
      } else void charger(instant);
      return;
    }
    const propre = ici.debut + v.currentTime * 1000;
    if (Math.abs(propre - instant) > ECART_MAX_MS) v.currentTime = Math.max(0, (instant - ici.debut) / 1000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instant]);

  /* Lecture, vitesse et son suivent la relecture. */
  useEffect(() => {
    const v = lecteurs[actif].current;
    if (!v || !morceaux[actif]) return;
    if (enLecture) void v.play().catch(() => {}); else v.pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enLecture, actif, morceaux]);
  useEffect(() => {
    for (const l of lecteurs) if (l.current) l.current.playbackRate = vitesse;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vitesse, morceaux]);
  useEffect(() => {
    for (const l of lecteurs) if (l.current) l.current.muted = !sonActif;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sonActif, morceaux, actif]);

  /* La confirmation d'une capture s'efface d'elle-même. */
  useEffect(() => {
    if (!capture) return;
    const id = setTimeout(() => setCapture(null), 6000);
    return () => clearTimeout(id);
  }, [capture]);

  const capturer = async () => {
    const image = await imageDeLaVideo(lecteurs[actif].current);
    if (!image) { setCapture(t('video.imageIndisponible')); return; }
    try {
      const quand = new Date(etat.current.instant ?? Date.now());
      const nom = `${camera.name} ${quand.toLocaleString(localeDates()).replace(/[/:]/g, '-')}`;
      setCapture(t('video.imageEnregistree', { chemin: await bridge.capturer(nom, await image.arrayBuffer()) }));
    } catch (e) {
      setCapture(messageLisible(e));
    }
  };

  const courant = morceaux[actif];
  const reduite = frontiere !== null && instant !== null && instant < frontiere;

  return (
    <Carte className="@container flex min-h-0 flex-col overflow-hidden">
      <div className="flex h-11 shrink-0 items-center gap-2.5 pl-3.5 pr-2">
        <span className="min-w-0 truncate text-titre font-semibold">{camera.name}</span>
        {definition && courant && (
          <span className="whitespace-nowrap text-meta tabular-nums text-muted @max-[360px]:hidden">
            {definition}
            {reduite && <span className="text-warn"> · {t('relecture.definitionReduite')}</span>}
          </span>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <BoutonBandeau titre={sonActif ? t('video.couperSon') : t('relecture.ecouterCamera')}
                         court={t('tuile.sonCourt')} icone={sonActif ? Volume2 : VolumeX}
                         actif={sonActif} onClick={onSon} />
          <BoutonBandeau titre={t('video.capturer')} court={t('tuile.imageCourt')} icone={Camera}
                         desactive={!courant} onClick={() => { void capturer(); }} />
        </div>
      </div>
      <div role="button" tabIndex={0} aria-label={t('relecture.rendreActive', { nom: camera.name })}
           onClick={onChoisir} onKeyDown={(e) => { if (e.key === 'Enter') onChoisir(); }}
           className="relative min-h-0 flex-1 cursor-pointer select-none overflow-hidden bg-black">
        {[0, 1].map((i) => morceaux[i] && (
          <video key={i} ref={lecteurs[i]} src={morceaux[i]!.url} preload="auto" muted={!sonActif}
                 className="absolute inset-0 h-full w-full"
                 style={{ objectFit: 'contain', opacity: actif === i ? 1 : 0, pointerEvents: 'none' }}
                 onLoadedMetadata={(e) => {
                   const v = e.currentTarget;
                   const m = etat.current.morceaux[i];
                   if (!m) return;
                   const cible = cibles.current[i] ?? (i === etat.current.actif ? etat.current.instant : null);
                   v.currentTime = cible === null ? 0 : Math.max(0, Math.min((m.fin - m.debut) / 1000, (cible - m.debut) / 1000));
                   v.playbackRate = etat.current.vitesse;
                   v.muted = !etat.current.sonActif;
                   if (i === etat.current.actif) {
                     setDefinition(`${v.videoWidth} × ${v.videoHeight}`);
                     if (etat.current.enLecture) void v.play().catch(() => {});
                   } else {
                     // Amorçage de la case en attente : sa première image décodée d'avance.
                     const avant = v.muted;
                     v.muted = true;
                     void v.play().then(() => { v.pause(); v.currentTime = 0; v.muted = avant; })
                       .catch(() => { v.muted = avant; });
                   }
                 }}
                 onEnded={() => {
                   if (i !== etat.current.actif) return;
                   const la = etat.current.morceaux[1 - i];
                   const ici = etat.current.morceaux[i];
                   if (la && ici && la.debut === ici.fin) {
                     setActif(1 - i);
                     const w = lecteurs[1 - i].current;
                     if (w) { w.currentTime = 0; w.playbackRate = etat.current.vitesse; if (etat.current.enLecture) void w.play().catch(() => {}); }
                     void precharger(i, la.fin, generation.current);
                   } else if (ici) void charger(etat.current.instant ?? ici.fin);
                 }}
                 onError={() => { if (i === etat.current.actif) setErreur(t('video.sequenceIllisible')); }} />
        ))}

        {/* Ce qui manque se dit sur l'image, au centre ; les autres tuiles continuent. */}
        {(chargement || erreur) && (
          <div className="absolute inset-0 grid place-items-center bg-black/60 p-4 text-center">
            <span className="rounded-lg px-3 py-1.5 text-meta" style={{ background: 'rgba(12,15,20,.85)', color: 'var(--on-2)' }}>
              {erreur ?? (courant ? t('relecture.rattrape') : t('relecture.extraction'))}
            </span>
          </div>
        )}
        {capture && (
          <div className="m-surgit pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center">
            <span className="max-w-[86%] truncate rounded-[9px] border border-line2 px-3 py-1.5 text-meta"
                  style={{ background: 'rgba(12,15,20,.92)', color: '#f2efe8' }}>{capture}</span>
          </div>
        )}
      </div>
    </Carte>
  );
}
