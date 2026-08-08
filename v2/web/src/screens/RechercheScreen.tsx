import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Loader2, Search, ShieldCheck } from 'lucide-react';
import { bridge } from '../lib/bridge';
import { LecteurExtrait } from './LecteurExtrait';
import { localeDates, t, useLangue } from '../i18n';
import { nomSujet, nomVehicule } from '../i18n/sujets';
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

const horaire = (d: Date) => new Intl.DateTimeFormat(localeDates(),
  { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(d);

export function RechercheScreen({ cameras, cameraInitiale }: {
  cameras: DiscoveredCamera[];
  /** Camera visee par un bouton du direct : on arrive filtre sur elle. */
  cameraInitiale?: string | null;
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
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ouvert, setOuvert] = useState<Detection | null>(null);

  /** Numéro de la demande : une recherche lente ne doit pas écraser une plus récente. */
  const demande = useRef(0);

  const criteres = useMemo<CriteresRecherche>(() => ({
    depuis: Date.now() - (PERIODES.find((p) => p.id === periode)?.ms ?? 7 * 86_400_000),
    jusqua: Date.now(),
    sujets, seuil, types, couleurs, cameras: camerasChoisies,
    texte: texte.trim() || undefined,
  }), [periode, sujets, seuil, types, couleurs, camerasChoisies, texte]);

  useEffect(() => {
    const n = ++demande.current;
    setChargement(true);
    setErreur(null);
    // Le texte se tape lettre par lettre : on laisse la frappe se poser.
    const minuteur = setTimeout(() => {
      bridge.recherche(criteres)
        .then((r) => {
          if (n !== demande.current) return;
          setObjets(r.objets);
          setRecensement(r.recensement);
          setTotal(r.total);
          setTronque(r.tronque);
        })
        .catch((e) => { if (n === demande.current) setErreur(e instanceof Error ? e.message : String(e)); })
        .finally(() => { if (n === demande.current) setChargement(false); });
    }, texte ? 320 : 0);
    return () => clearTimeout(minuteur);
  }, [criteres, texte]);

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

  const Titre = ({ children }: { children: React.ReactNode }) => (
    <h4 className="mb-2 mt-4 text-[10.5px] font-semibold uppercase tracking-wider text-soft first:mt-0">
      {children}
    </h4>
  );

  const Puce = ({ on, onClick, children, n }: {
    on: boolean; onClick: () => void; children: React.ReactNode; n?: number;
  }) => (
    <button onClick={onClick} aria-pressed={on}
            className="flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12px] transition-colors"
            style={on
              ? { background: 'var(--accent-soft)', color: 'var(--accent)', borderColor: 'transparent' }
              : { color: 'var(--soft)', borderColor: 'var(--line)' }}>
      {children}
      {/* Le compte réel, collé au choix : c'est ce que Protect ne dit nulle part. */}
      {n !== undefined && <span className="font-mono text-[10px] opacity-70">{n}</span>}
    </button>
  );

  return (
    <div className="relative flex h-full min-h-0 gap-4 p-4">

      {/* ---- les filtres : un îlot qui flotte à gauche ---- */}
      <div className="ilot w-[252px] shrink-0 overflow-y-auto p-4">
        <Titre>{t('recherche.chercher')}</Titre>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
                  style={{ color: 'var(--soft)' }} />
          <input value={texte} onChange={(e) => setTexte(e.target.value)}
                 placeholder={t('recherche.placeholder')}
                 aria-label={t('recherche.chercherAria')}
                 className="w-full rounded-lg border border-line bg-transparent py-1.5 pl-8 pr-2.5 text-[12.5px] text-ink" />
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-soft">
          {t('recherche.tolerante1')} <span className="font-mono">O</span> {t('recherche.tolerante2')}
          <span className="font-mono"> 0</span>{t('recherche.tolerante3')}
        </p>

        {recensement && recensement.sujets.length > 0 && (
          <>
            <Titre>{t('recherche.sujet')}</Titre>
            <div className="flex flex-wrap gap-1.5">
              {recensement.sujets.map((s) => (
                <Puce key={s.valeur} n={s.n} on={sujets.includes(s.valeur)}
                      onClick={() => bascule(sujets, setSujets, s.valeur)}>
                  {nomSujet(s.valeur)}
                </Puce>
              ))}
            </div>
          </>
        )}

        <Titre>{t('recherche.confiance')}</Titre>
        <input type="range" min={0} max={100} step={5} value={seuil}
               onChange={(e) => setSeuil(Number(e.target.value))}
               aria-label={t('recherche.confiance')}
               className="w-full" style={{ accentColor: 'var(--accent)' }} />
        <div className="flex justify-between font-mono text-[10px] text-soft">
          <span>0</span><span>{seuil}</span><span>100</span>
        </div>
        {/* Le piège que seule la mesure a révélé : les sons n'ont pas de score. */}
        <p className="mt-1.5 text-[11px] leading-relaxed text-soft">
          {t('recherche.confianceDetail')}
        </p>

        {recensement && recensement.types.length > 0 && (
          <>
            <Titre>{t('recherche.typeVehicule')}</Titre>
            <div className="flex flex-wrap gap-1.5">
              {recensement.types.map((ty) => (
                <Puce key={ty.valeur} n={ty.n} on={types.includes(ty.valeur)}
                      onClick={() => bascule(types, setTypes, ty.valeur)}>
                  {nomVehicule(ty.valeur)}
                </Puce>
              ))}
            </div>
          </>
        )}

        {recensement && recensement.couleurs.length > 0 && (
          <>
            <Titre>{t('recherche.couleur')}</Titre>
            {/* Les couleurs se montrent, elles ne s'écrivent pas. */}
            <div className="flex flex-wrap gap-2">
              {recensement.couleurs.map((c) => (
                <button key={c.valeur} onClick={() => bascule(couleurs, setCouleurs, c.valeur)}
                        aria-pressed={couleurs.includes(c.valeur)}
                        title={`${c.valeur} — ${c.n}`}
                        className="relative h-7 w-7 rounded-md border-2 transition-colors"
                        style={{ background: TEINTE_COULEUR[c.valeur] ?? 'var(--card2)',
                                 borderColor: couleurs.includes(c.valeur) ? 'var(--accent)' : 'var(--line2)' }}>
                  <span className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 font-mono text-[9px] text-soft">
                    {c.n}
                  </span>
                </button>
              ))}
            </div>
            <div className="h-4" />
          </>
        )}

        {cameras.length > 1 && (
          <>
            <Titre>{t('recherche.camera')}</Titre>
            <div className="flex flex-wrap gap-1.5">
              <Puce on={camerasChoisies.length === 0} onClick={() => setCameras([])}>{t('commun.toutes')}</Puce>
              {cameras.map((c) => (
                <Puce key={c.id} on={camerasChoisies.includes(c.id)}
                      onClick={() => bascule(camerasChoisies, setCameras, c.id)}>
                  {c.name}
                </Puce>
              ))}
            </div>
          </>
        )}

        <Titre>{t('recherche.periode')}</Titre>
        <div className="flex flex-wrap gap-1.5">
          {PERIODES.map((p) => (
            <Puce key={p.id} on={periode === p.id} onClick={() => setPeriode(p.id)}>{t(p.cle)}</Puce>
          ))}
        </div>
      </div>

      {/* ---- les résultats ---- */}
      <div className="min-w-0 flex-1 overflow-y-auto">
        {/* Le bandeau d'état, en îlot détaché : total, troncature, note de filtrage. */}
        <div className="ilot flex items-center gap-3 px-4 py-2.5">
          <span className="font-mono text-[11.5px] text-soft">
            {chargement ? t('recherche.enCours')
              : `${total} ${total > 1 ? t('recherche.objetPlusieurs') : t('recherche.objetUn')}`}
          </span>
          {chargement && <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: 'var(--soft)' }} />}
          {tronque && (
            <span className="text-[11.5px]" style={{ color: 'var(--warn)' }}>
              {t('recherche.tronque')}
            </span>
          )}
          <span className="ml-auto text-[11px] text-soft">
            {t('recherche.filtrageNote')}
          </span>
        </div>

        {erreur && (
          <div className="ilot my-4 p-4">
            <p className="flex gap-2 text-[13px]" style={{ color: 'var(--warn)' }}>
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{erreur}</span>
            </p>
          </div>
        )}

        {!chargement && !erreur && objets.length === 0 && (
          <p className="p-6 text-[13px] text-soft">
            {t('recherche.rien')} {seuil > 0 && `${t('recherche.rienSeuil')} `}
            {texte && t('recherche.rienTexte')}
          </p>
        )}

        <div className="m-cascade grid gap-3 py-4"
             style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(178px, 1fr))' }}>
          {objets.map((o) => (
            /* Cartes flottantes : la levée au survol remplace le changement de bord. */
            <button key={o.objectId} onClick={() => ouvrir(o)}
                    className="carte-flottante relative overflow-hidden rounded-xl text-left transition-transform hover:-translate-y-[3px]">
              <div className="aspect-video">
                {o.vignette && o.id && (
                  <img src={`/vignette/${o.id}`} alt="" loading="lazy"
                       className="h-full w-full object-cover"
                       onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
                )}
              </div>

              <div className="pointer-events-none absolute inset-x-1.5 top-1.5 flex gap-1.5 font-mono text-[9px]">
                <span className="rounded px-1.5 py-0.5" style={{ background: 'rgba(10,12,15,.72)', color: '#c9c3b8' }}>
                  {o.debut ? horaire(new Date(o.debut)) : '—'}
                </span>
                <span className="truncate rounded px-1.5 py-0.5"
                      style={{ background: 'rgba(10,12,15,.72)', color: '#c9c3b8' }}>
                  {o.cameraNom ?? ''}
                </span>
                {/* Une plaque ou un nom a été reconnu — le texte, lui, ne quitte jamais
                    le processus principal. */}
                {o.identifie && (
                  <span className="ml-auto grid h-4 w-4 place-items-center rounded"
                        title={t('recherche.identifie')}
                        style={{ background: 'rgba(10,12,15,.72)', color: 'var(--accent-d)' }}>
                    <ShieldCheck className="h-2.5 w-2.5" />
                  </span>
                )}
              </div>

              <div className="pointer-events-none absolute inset-x-1.5 bottom-1.5 flex items-center gap-1.5">
                <span className="truncate rounded px-1.5 py-0.5 text-[10px]"
                      style={{ background: 'rgba(10,12,15,.72)', color: '#dad5cb' }}>
                  {[o.vehicule?.valeur ? nomVehicule(o.vehicule.valeur) : nomSujet(o.type),
                    o.couleur?.valeur].filter(Boolean).join(' · ')}
                </span>
                {/* La confiance montrée est celle de l'ATTRIBUT quand il y en a un : c'est
                    elle qui compte quand on cherche « une voiture blanche ». */}
                {(o.couleur?.confiance ?? o.vehicule?.confiance ?? o.confiance) !== null && (
                  <span className="ml-auto rounded px-1.5 py-0.5 font-mono text-[9.5px]"
                        style={{ background: 'rgba(10,12,15,.72)',
                                 color: (o.couleur?.confiance ?? o.vehicule?.confiance ?? o.confiance ?? 0) >= 80
                                   ? 'var(--ok)' : 'var(--ink)' }}>
                    {o.couleur?.confiance ?? o.vehicule?.confiance ?? o.confiance} %
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {ouvert && (
        <LecteurExtrait key={ouvert.id} detection={ouvert} onFermer={() => setOuvert(null)} />
      )}
    </div>
  );
}
