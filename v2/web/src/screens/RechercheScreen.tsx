import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, History, Loader2, Search, ShieldCheck } from 'lucide-react';
import { bridge } from '../lib/bridge';
import { LecteurExtrait } from './LecteurExtrait';
import { localeDates, t, useLangue } from '../i18n';
import { nomCouleur, nomSujet, nomVehicule } from '../i18n/sujets';
import { Bouton } from '../ui/Bouton';
import { Carte, EnTete } from '../ui/Cadre';
import { Champ } from '../ui/Champ';
import { Puce } from '../ui/Puce';
import { Segment } from '../ui/Segment';
import { cx } from '../ui/cx';
import type {
  CriteresRecherche, Detection, DiscoveredCamera, ObjetDetecte, Recensement,
} from '../types/protect';

/**
 * Recherche fine dans les detections.
 *
 * Dessine sur la mesure V-Attributs du 29.07.2026, et c'est la toute la difference avec une
 * imitation des captures de Protect : leurs filtres proposent une liste THEORIQUE — berline,
 * camion, fourgonnette, moto, SUV, velo — sans jamais dire lesquels sont passes. Les notres
 * ne montrent que ce qui existe, avec son compte. Cocher un filtre vide est une impasse
 * qu'on peut eviter, et c'est le seul endroit ou l'on fait mieux qu'eux.
 *
 * Deux faits mesures commandent le reste :
 *  · le controleur HONORE le filtre par sujet (624 -> 310) et IGNORE le filtre par score ;
 *  · les detections SONORES ont un score de zero — 615 « parole » sur le poste de reference. Le seuil ne
 *    les touche donc jamais, sinon le premier cran les ferait toutes disparaitre.
 */

/** Teintes d'affichage des couleurs relevees. Approximatives, et c'est voulu : ce sont des
 *  reperes, pas des echantillons — le controleur ne rend qu'un mot. */
const TEINTE_COULEUR: Record<string, string> = {
  gray: '#8a8a8a', grey: '#8a8a8a', white: '#e8e6e1', black: '#1d1f22',
  blue: '#3f6fa8', yellow: '#d8c14a', red: '#b4483f', green: '#5c8a4a',
  brown: '#7a5a3f', silver: '#b9bcc0', orange: '#c9803a', beige: '#c8b89a',
};

const PERIODES = [
  { id: 'jour', cle: 'colonne.aujourdhui', ms: 86_400_000 },
  { id: 'semaine', cle: 'recherche.periode7', ms: 7 * 86_400_000 },
  { id: 'mois', cle: 'recherche.periode30', ms: 30 * 86_400_000 },
] as const;

/** Un groupe de filtres : son titre, puis ses choix. */
function Filtre({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2.5 text-corps font-semibold">{titre}</h2>
      {children}
    </section>
  );
}

const horaire = (d: Date) => new Intl.DateTimeFormat(localeDates(),
  { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(d);

export function RechercheScreen({ cameras, cameraInitiale, onRevoir }: {
  cameras: DiscoveredCamera[];
  /** Camera visee par un bouton du direct : on arrive filtre sur elle. */
  cameraInitiale?: string | null;
  /** « Revoir a cet instant » : la relecture de cette camera, a l'heure de la detection. */
  onRevoir: (camera: string | null, t: number) => void;
}) {
  useLangue();
  const [texte, setTexte] = useState('');
  const [sujets, setSujets] = useState<string[]>([]);
  const [seuil, setSeuil] = useState(0);
  const [types, setTypes] = useState<string[]>([]);
  const [couleurs, setCouleurs] = useState<string[]>([]);
  const [camerasChoisies, setCameras] = useState<string[]>(cameraInitiale ? [cameraInitiale] : []);
  const [periode, setPeriode] = useState<typeof PERIODES[number]['id']>('semaine');

  const [objets, setObjets] = useState<ObjetDetecte[]>([]);
  const [recensement, setRecensement] = useState<Recensement | null>(null);
  const [total, setTotal] = useState(0);
  const [tronque, setTronque] = useState(false);
  const [ouvert, setOuvert] = useState<Detection | null>(null);

  /** Numéro de la demande : une recherche lente ne doit pas écraser une plus récente. */
  const demande = useRef(0);

  const periodeMs = PERIODES.find((p) => p.id === periode)?.ms ?? 7 * 86_400_000;
  const filtres = useMemo<Omit<CriteresRecherche, 'depuis' | 'jusqua'>>(() => ({
    sujets, seuil, types, couleurs, cameras: camerasChoisies,
    texte: texte.trim() || undefined,
  }), [sujets, seuil, types, couleurs, camerasChoisies, texte]);

  /*
   * La demande se reconnaît à sa clé : « chargement » et « erreur » s'en DÉDUISENT — une
   * réponse reçue pour une autre clé n'en dit rien. Avant, l'effet les remettait à zéro à
   * chaque départ, ce qui coûtait un second rendu (règle react/set-state-in-effect).
   */
  const cle = useMemo(() => JSON.stringify([filtres, periodeMs]), [filtres, periodeMs]);
  const [recue, setRecue] = useState<{ cle: string; erreur: string | null } | null>(null);
  const chargement = recue?.cle !== cle;
  const erreur = recue && !chargement ? recue.erreur : null;

  useEffect(() => {
    const n = ++demande.current;
    // Le texte se tape lettre par lettre : on laisse la frappe se poser.
    const minuteur = setTimeout(() => {
      // L'heure se lit a la demande, pas pendant le rendu (regle react/purity, 24.10.2026).
      const jusqua = Date.now();
      bridge.recherche({ ...filtres, depuis: jusqua - periodeMs, jusqua })
        .then((r) => {
          if (n !== demande.current) return;
          setObjets(r.objets);
          setRecensement(r.recensement);
          setTotal(r.total);
          setTronque(r.tronque);
          setRecue({ cle, erreur: null });
        })
        .catch((e) => { if (n === demande.current) setRecue({ cle, erreur: e instanceof Error ? e.message : String(e) }); });
    }, texte ? 320 : 0);
    return () => clearTimeout(minuteur);
  }, [cle, filtres, periodeMs, texte]);

  const bascule = useCallback(
    (liste: string[], set: (v: string[]) => void, id: string) =>
      set(liste.includes(id) ? liste.filter((x) => x !== id) : [...liste, id]),
    [],
  );

  /** Un objet ouvre la séquence de SON événement, avec la marge habituelle. */
  const ouvrir = (o: ObjetDetecte) => {
    if (!o.id || o.debut === null) return;
    setOuvert({
      id: o.id, type: 'smartDetectZone', camera: o.camera, cameraNom: o.cameraNom,
      debut: o.debut, fin: null, sujets: [o.type], score: o.confiance, vignette: o.vignette,
    });
  };

  /* La précision de l'en-tête : sur quelles caméras porte la recherche. */
  const precision = camerasChoisies.length === 0 ? t('recherche.toutesCameras')
    : camerasChoisies.length === 1 ? (cameras.find((c) => c.id === camerasChoisies[0])?.name ?? '')
      : t('recherche.nCameras', { n: camerasChoisies.length });

  return (
    <div className="relative flex h-full flex-col">
      <EnTete
        titre={t('espace.detections')}
        precision={precision}
        actions={(
          <Segment etiquette={t('recherche.periode')} valeur={periode} onChange={setPeriode}
                   options={PERIODES.map((p) => ({ valeur: p.id, libelle: t(p.cle) }))} />
        )}
      />

      <div className="grid min-h-0 flex-1 grid-cols-[300px_minmax(0,1fr)]">

        {/* ---- les filtres : une colonne, dans l'ordre où l'on affine ---- */}
        <aside className="flex flex-col gap-[22px] overflow-y-auto border-r border-line bg-card px-5 pb-6 pt-[18px]">
          <Champ id="recherche-texte" libelle={t('recherche.chercher')} icone={Search}
                 value={texte} onChange={(e) => setTexte(e.target.value)}
                 placeholder={t('recherche.placeholder')} aria-label={t('recherche.chercherAria')}
                 aide={<>
                   {t('recherche.tolerante1')} <span className="font-mono">O</span> {t('recherche.tolerante2')}
                   <span className="font-mono"> 0</span>{t('recherche.tolerante3')}
                 </>} />

          {recensement && recensement.sujets.length > 0 && (
            <Filtre titre={t('recherche.sujet')}>
              <div className="flex flex-wrap gap-1.5">
                {/* Le compte réel, collé au choix : c'est ce que Protect ne dit nulle part. */}
                {recensement.sujets.map((s) => (
                  <Puce key={s.valeur} compte={s.n} allumee={sujets.includes(s.valeur)}
                        onClick={() => bascule(sujets, setSujets, s.valeur)}>
                    {nomSujet(s.valeur)}
                  </Puce>
                ))}
              </div>
            </Filtre>
          )}

          <Filtre titre={t('recherche.confiance')}>
            <input type="range" min={0} max={100} step={5} value={seuil}
                   onChange={(e) => setSeuil(Number(e.target.value))}
                   aria-label={t('recherche.confiance')}
                   className="w-full accent-[var(--accent)]" />
            <div className="flex justify-between text-meta tabular-nums text-soft">
              <span>0</span><b className="font-medium text-accent">{seuil} %</b><span>100</span>
            </div>
            {/* Le piège que seule la mesure a révélé : les sons n'ont pas de score. */}
            <p className="mt-1.5 text-meta leading-normal text-soft">{t('recherche.confianceDetail')}</p>
          </Filtre>

          {recensement && recensement.types.length > 0 && (
            <Filtre titre={t('recherche.typeVehicule')}>
              <div className="flex flex-wrap gap-1.5">
                {recensement.types.map((ty) => (
                  <Puce key={ty.valeur} compte={ty.n} allumee={types.includes(ty.valeur)}
                        onClick={() => bascule(types, setTypes, ty.valeur)}>
                    {nomVehicule(ty.valeur)}
                  </Puce>
                ))}
              </div>
            </Filtre>
          )}

          {recensement && recensement.couleurs.length > 0 && (
            <Filtre titre={t('recherche.couleur')}>
              {/* La pastille ET le nom : la teinte seule laissait deviner gris ou argent. */}
              <div className="flex flex-wrap gap-1.5">
                {recensement.couleurs.map((c) => (
                  <Puce key={c.valeur} compte={c.n} allumee={couleurs.includes(c.valeur)}
                        echantillon={TEINTE_COULEUR[c.valeur] ?? 'var(--card2)'}
                        onClick={() => bascule(couleurs, setCouleurs, c.valeur)}>
                    {nomCouleur(c.valeur)}
                  </Puce>
                ))}
              </div>
            </Filtre>
          )}

          {cameras.length > 1 && (
            <Filtre titre={t('recherche.camera')}>
              <div className="flex flex-wrap gap-1.5">
                <Puce allumee={camerasChoisies.length === 0} onClick={() => setCameras([])}>{t('commun.toutes')}</Puce>
                {cameras.map((c) => (
                  <Puce key={c.id} allumee={camerasChoisies.includes(c.id)}
                        onClick={() => bascule(camerasChoisies, setCameras, c.id)}>
                    {c.name}
                  </Puce>
                ))}
              </div>
            </Filtre>
          )}
        </aside>

        {/* ---- les résultats ---- */}
        <div className="flex min-h-0 flex-col">
          {/* La barre d'état des résultats : total, troncature, note de filtrage. */}
          <div className="flex shrink-0 items-center gap-3.5 border-b border-line px-5 py-3">
            <b className="font-semibold tabular-nums">
              {chargement ? t('recherche.enCours')
                : `${total} ${total > 1 ? t('recherche.objetPlusieurs') : t('recherche.objetUn')}`}
            </b>
            {chargement && <Loader2 className="h-4 w-4 animate-spin text-soft" aria-hidden />}
            {tronque && <span className="text-warn">{t('recherche.tronque')}</span>}
            <span className="ml-auto text-meta text-soft">{t('recherche.filtrageNote')}</span>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-[18px]">
            {erreur && (
              <Carte className="mx-auto mt-6 max-w-md p-5 text-center">
                <AlertCircle className="mx-auto mb-2 h-5 w-5 text-warn" aria-hidden />
                <p>{erreur}</p>
              </Carte>
            )}

            {/* Rien ne correspond : on dit pourquoi, et l'on offre de retirer le filtre fautif. */}
            {!chargement && !erreur && objets.length === 0 && (
              <Carte className="mx-auto mt-6 max-w-md p-5 text-center">
                <p className="font-semibold">{t('recherche.rien')}</p>
                {seuil > 0 && (
                  <>
                    <p className="mt-1.5 text-meta text-soft">{t('recherche.rienSeuil')}</p>
                    <Bouton taille="petit" className="mt-2.5" onClick={() => setSeuil(0)}>
                      {t('recherche.retirerSeuil')}
                    </Bouton>
                  </>
                )}
                {texte && <p className="mt-1.5 text-meta text-soft">{t('recherche.rienTexte')}</p>}
              </Carte>
            )}

            <div className="m-cascade grid auto-rows-max content-start gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(214px,1fr))]">
              {objets.map((o) => {
                /* La confiance montrée est celle de l'ATTRIBUT quand il y en a un : c'est elle
                   qui compte quand on cherche « une voiture blanche ». */
                const confiance = o.couleur?.confiance ?? o.vehicule?.confiance ?? o.confiance;
                return (
                  <div key={o.objectId} className="group/obj relative">
                    <button type="button" onClick={() => ouvrir(o)}
                            className="block w-full overflow-hidden rounded-[10px] border border-line2 bg-card text-left transition hover:-translate-y-0.5 hover:border-accent-ligne">
                      {/* La vignette nette : plus rien posé dessus, sinon le badge. */}
                      <div className="relative aspect-video bg-black">
                        {o.vignette && o.id && (
                          <img src={`/vignette/${o.id}`} alt="" loading="lazy"
                               className="h-full w-full object-cover"
                               onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
                        )}
                        {/* Une plaque ou un nom a été reconnu — le texte, lui, ne quitte jamais
                            le processus principal. */}
                        {o.identifie && (
                          <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-md text-accent"
                                title={t('recherche.identifie')} style={{ background: 'rgba(12,15,20,.8)' }}>
                            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                            <span className="sr-only">{t('recherche.identifie')}</span>
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-[1fr_auto] gap-y-[3px] px-[11px] pb-2.5 pt-[9px]">
                        <span className="flex min-w-0 items-center gap-[7px]">
                          <span className="truncate">
                            {o.vehicule?.valeur ? nomVehicule(o.vehicule.valeur) : nomSujet(o.type)}
                          </span>
                          {o.couleur?.valeur && (
                            <>
                              <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/25"
                                    style={{ background: TEINTE_COULEUR[o.couleur.valeur] ?? 'var(--card2)' }} />
                              <span className="truncate">{nomCouleur(o.couleur.valeur)}</span>
                            </>
                          )}
                        </span>
                        {confiance !== null && confiance !== undefined && (
                          <span className={cx('text-right text-meta tabular-nums', confiance >= 80 ? 'text-ok' : 'text-muted')}>
                            {confiance} %
                          </span>
                        )}
                        <span className="col-span-2 truncate text-meta text-muted">
                          {[o.debut ? horaire(new Date(o.debut)) : '—', o.cameraNom].filter(Boolean).join(', ')}
                        </span>
                      </div>
                    </button>
                    {/* D'une détection à la relecture, à cet instant (ajout du 23.10.2026). */}
                    {o.debut !== null && (
                      <Bouton taille="petit" icone={History} titre={t('activite.revoir')}
                              onClick={() => onRevoir(o.camera, o.debut as number)}
                              className="veil absolute left-2 top-2 opacity-0 focus-visible:opacity-100 group-hover/obj:opacity-100"
                              style={{ color: 'var(--on-1)' }}>
                        {t('recherche.revoirCourt')}
                      </Bouton>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {ouvert && (
        <LecteurExtrait key={ouvert.id} detection={ouvert} onFermer={() => setOuvert(null)}
                        onRelecture={ouvert.debut !== null
                          ? () => onRevoir(ouvert.camera, ouvert.debut as number) : undefined} />
      )}
    </div>
  );
}
