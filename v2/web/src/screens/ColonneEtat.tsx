import { useEffect, useMemo, useRef, useState } from 'react';
import { bridge } from '../lib/bridge';
import { localeDates, nombre, t, useLangue } from '../i18n';
import { nomSujet } from '../i18n/sujets';
import type { Cle } from '../i18n/fr';
import type { Detection, DetectionVive, SystemeEtat } from '../types/protect';

/**
 * Colonne d'etat.
 *
 * Reprise du panneau de Protect, dont c'est la meilleure partie : des CHIFFRES, denses,
 * qu'on lit d'un coup d'oeil. La version precedente expliquait trop et montrait trop peu —
 * chaque bloc portait son paragraphe. Ici le texte ne reste que la ou son absence
 * tromperait : un disque a 98 % ressemble a une panne si rien ne dit que c'est normal.
 *
 * Les noms de champs viennent du journal du poste (30.07.2026), pas d'une supposition.
 * Ce qui manque disparait : jamais un zero a la place d'une valeur inconnue.
 */

const JOUR_MS = 86_400_000;

// « h », « min » et « s » s'ecrivent pareil dans les deux langues ; jour, mois et
// octets, non — ils passent par le dictionnaire.
const to = (n: number) => `${nombre(n / 1e12, 2)} ${t('unite.to')}`;
const go = (n: number) => `${Math.round(n / 1e9)} ${t('unite.go')}`;

function duree(ms: number): string {
  const j = Math.floor(ms / JOUR_MS);
  if (j < 1) return `${Math.round(ms / 3_600_000)} h`;
  if (j < 60) return `${j} ${t('unite.j')}`;
  return `${Math.floor(j / 30)} ${t('unite.mois')} ${j % 30} ${t('unite.j')}`;
}

function ilYa(ms: number): string {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < JOUR_MS / 1000) return `${Math.floor(s / 3600)} h`;
  return `${Math.floor(s / 86_400)} ${t('unite.j')}`;
}

const dateCourte = (d: Date) => new Intl.DateTimeFormat(
  localeDates(), { day: '2-digit', month: '2-digit', year: '2-digit' }).format(d);

const ARMEMENT: Record<string, { cle: Cle; ton: string }> = {
  armed: { cle: 'colonne.arme', ton: 'var(--ok)' },
  disarmed: { cle: 'colonne.desarme', ton: 'var(--soft)' },
  // Releve sur le poste : les alarmes de Protect ne sont pas configurees du tout, ce qui
  // n'est ni « arme » ni « desarme ». Alcora a ses propres veilles, elles ne dependent
  // pas de celles-ci.
  disabled: { cle: 'colonne.alarmesInactives', ton: 'var(--soft)' },
};

/**
 * L'etat du disque du controleur, dit sans alarmer a tort.
 *
 * Seules les valeurs REELLEMENT observees sont traduites — celle du poste de reference, le
 * 31.07.2026, et le cas nominal. Les autres passent brutes : inventer une traduction pour
 * un etat qu'on n'a jamais vu, c'est risquer de rassurer sur une panne ou d'affoler sur
 * rien. Ubiquiti ne publie pas cette liste.
 *
 * `hddNotCompatible` merite son explication : le disque n'est pas sur la liste d'Ubiquiti,
 * ce qui ne l'empeche pas de fonctionner. Sur ce poste il porte 162 jours d'archive.
 * L'afficher en rouge sans un mot ferait croire a une panne imminente.
 */
// « ok » vaut null : le cas normal ne se dit pas, une colonne dense ne le repete pas.
const DISQUE: Record<string, { cle: Cle; ton: string; detailCle?: Cle } | null> = {
  ok: null,
  hddnotcompatible: {
    cle: 'colonne.disqueNonHomologue',
    ton: 'var(--muted)',
    detailCle: 'colonne.disqueNonHomologueDetail',
  },
};

function etatDisqueLisible(brut: string): { texte: string; ton: string; detail?: string } | null {
  const connu = DISQUE[brut.toLowerCase()];
  if (connu !== undefined) {
    return connu && {
      texte: t(connu.cle), ton: connu.ton,
      detail: connu.detailCle ? t(connu.detailCle) : undefined,
    };
  }
  return { texte: brut, ton: 'var(--warn)' };
}

/**
 * L'armement de Protect, tel qu'on ose l'ecrire.
 *
 * Une valeur inconnue se montre TELLE QUELLE plutot que de faire disparaitre la ligne.
 * Ne rien afficher se confond avec « le controleur n'a rien dit », et laisse croire que la
 * fonction n'existe pas ; montrer le mot brut dit au moins qu'il y a quelque chose a
 * traduire. Protect ne documente pas la liste de ces valeurs.
 */
function armementLisible(brut: string): { texte: string; ton: string } {
  const connu = ARMEMENT[brut];
  return connu ? { texte: t(connu.cle), ton: connu.ton } : { texte: brut, ton: 'var(--muted)' };
}

/**
 * Combien de détections, heure par heure.
 *
 * Le contrôleur rend les plus RÉCENTES en premier et s'arrête à la limite demandée. Si elle
 * est atteinte, les premières heures du jour manquent — et un histogramme vide au petit
 * matin serait un mensonge de la même famille que ceux qu'on chasse ailleurs. On rend donc
 * aussi la première heure réellement couverte, pour que le dessin s'arrête là où il sait.
 */
function parHeure(liste: Detection[], partiel: boolean) {
  const h = new Array(24).fill(0) as number[];
  let plusAncien = Infinity;
  for (const d of liste) {
    if (!d.debut) continue;
    h[new Date(d.debut).getHours()] += 1;
    plusAncien = Math.min(plusAncien, d.debut);
  }
  /*
   * L'heure qui CONTIENT la plus ancienne détection lue est elle-même incomplète : on la
   * grise aussi. Une barre à moitié vraie serait pire qu'une barre qui se dit inconnue.
   */
  const depuis = partiel && Number.isFinite(plusAncien)
    ? Math.min(24, new Date(plusAncien).getHours() + 1) : 0;
  return { heures: h, depuis };
}

/** Combien de détections le contrôleur veut bien rendre d'un coup. Cinq fois le volume
 *  observé sur ce matériel (~205 par jour) : la troncature reste théorique. */
const LIMITE_JOUR = 1000;

const Titre = ({ children }: { children: React.ReactNode }) => (
  <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-soft">{children}</p>
);

const Ligne = ({ k, v, ton }: { k: string; v: string; ton?: string }) => (
  <div className="flex items-baseline gap-2 px-1 py-[3px] text-[12.5px]">
    <span className="truncate text-muted">{k}</span>
    <span className="ml-auto shrink-0 font-mono text-[12px]" style={ton ? { color: ton } : undefined}>{v}</span>
  </div>
);

const Sep = () => <div className="my-2.5 h-px bg-line" />;

export function ColonneEtat({ versionAlcora, onOuvrir }: {
  versionAlcora: string | null;
  /** Une detection recente a ete cliquee : la fenetre de lecture est tenue plus haut. */
  onOuvrir: (d: DetectionVive) => void;
}) {
  /* L'abonnement a la langue : la colonne entiere se redessine quand elle change,
     unites, sujets et etats compris. Le rendu du t() module reste ainsi a jour. */
  useLangue();
  const [systeme, setSysteme] = useState<SystemeEtat | null>(null);
  const [dujour, setDujour] = useState<Detection[] | null>(null);
  const [partiel, setPartiel] = useState(false);
  const [vives, setVives] = useState<DetectionVive[]>([]);
  const [horloge, setHorloge] = useState(() => new Date());
  const dernieres = useRef<DetectionVive[]>([]);

  useEffect(() => {
    let vivant = true;
    bridge.systeme().then((s) => { if (vivant) setSysteme(s); }).catch(() => {});
    return () => { vivant = false; };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setHorloge(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  /* Les détections du jour, pour l'histogramme. Sans hâte : cette colonne informe. */
  useEffect(() => {
    let vivant = true;
    const lire = () => {
      const minuit = new Date(); minuit.setHours(0, 0, 0, 0);
      bridge.evenements({ avant: Date.now(), jours: 1, limite: LIMITE_JOUR })
        .then((l) => {
          if (!vivant) return;
          const dujour = l.filter((d) => (d.debut ?? 0) >= minuit.getTime());
          /*
           * Partiel, et non « tronqué » : atteindre la limite ne veut rien dire en soi.
           * Ce qui compte est de savoir si la journée est couverte JUSQU'À minuit. Si la
           * plus ancienne détection rendue est postérieure, alors il en manque avant elle.
           */
          const plusAncien = Math.min(...dujour.map((d) => d.debut ?? Infinity));
          // Une heure entière : c'est la granularité de l'histogramme, donc le seuil en
          // dessous duquel il n'y a rien à signaler.
          setPartiel(l.length >= LIMITE_JOUR && plusAncien - minuit.getTime() >= 3_600_000);
          setDujour(dujour);
        })
        .catch(() => { if (vivant) setDujour([]); });
    };
    lire();
    const id = setInterval(lire, 120_000);
    return () => { vivant = false; clearInterval(id); };
  }, []);

  /*
   * Les détections récentes arrivent EN DIRECT — même liaison que les veilles.
   *
   * Les deux bouts sont utiles, et pour des raisons différentes. Le commencement fait
   * apparaître la ligne tout de suite ; la fin apporte la durée ET rend enfin disponible
   * la vignette de l'événement, que le contrôleur ne fabrique qu'à ce moment-là.
   */
  useEffect(() => bridge.onDetectionVive((d) => {
    const sans = dernieres.current.filter((x) => x.id !== d.id);
    if (d.commence) dernieres.current = [d, ...sans].slice(0, 5);
    else if (sans.length !== dernieres.current.length) {
      // Fin d'une détection déjà listée : on la remplace sur place, l'ordre ne bouge pas.
      dernieres.current = dernieres.current.map((x) => (x.id === d.id ? { ...x, ...d } : x));
    } else return;
    // Trié sur l'HEURE, pas sur l'ordre d'arrivée : une reprise de liaison peut livrer
    // d'un coup des détections dans le désordre, et la plus récente doit rester en tête.
    dernieres.current.sort((a, b) => (b.debut ?? 0) - (a.debut ?? 0));
    setVives([...dernieres.current]);
  }), []);

  const { heures, depuis } = useMemo(() => parHeure(dujour ?? [], partiel), [dujour, partiel]);
  const maxi = Math.max(1, ...heures);

  const archive = useMemo(() => {
    const toutes = systeme?.archive ?? [];
    if (!toutes.length) return null;
    return {
      debut: Math.min(...toutes.map((a) => a.debut)),
      frontiere: toutes.every((a) => a.frontiere !== null)
        ? Math.min(...toutes.map((a) => a.frontiere as number)) : null,
      fin: Math.max(...toutes.map((a) => a.fin)),
    };
  }, [systeme]);

  const remplissage = systeme?.disque
    ? (systeme.disque.utilise / systeme.disque.total) * 100 : null;

  const etatDisque = systeme?.etatDisque ? etatDisqueLisible(systeme.etatDisque) : null;

  /**
   * La rétention annoncée, mais seulement lorsqu'elle contredit ce qu'on a mesuré.
   *
   * Répéter en deux formulations une valeur identique ferait douter sans rien apprendre.
   * L'écart, lui, dit quelque chose : le disque se remplit autrement que prévu.
   */
  const ecartRetention = useMemo(() => {
    const annonce = systeme?.retentionBasse;
    if (annonce == null || !archive) return null;
    const mesuree = (archive.fin - archive.debut) / JOUR_MS;
    return Math.abs(annonce - mesuree) > Math.max(7, mesuree * 0.1) ? annonce : null;
  }, [systeme, archive]);

  /** Même règle pour la pleine définition, qui a sa propre frontière et sa propre estimation. */
  const ecartHaute = useMemo(() => {
    const annonce = systeme?.retentionHaute;
    if (annonce == null || !archive || archive.frontiere === null) return null;
    const mesuree = (archive.fin - archive.frontiere) / JOUR_MS;
    return Math.abs(annonce - mesuree) > Math.max(7, mesuree * 0.1) ? annonce : null;
  }, [systeme, archive]);

  return (
    <>
      <Sep />

      {/* En un coup d'œil. Le compte de caméras n'est pas repris : la liste est juste
          au-dessus, et un doublon n'apprend rien. */}
      <Ligne k={t('colonne.controleur')} v={systeme?.nom ?? '—'} ton="var(--ok)" />
      <Ligne k={t('colonne.heure')} v={horloge.toLocaleTimeString(localeDates())} />
      {systeme?.armement && (
        <Ligne k="Protect" v={armementLisible(systeme.armement).texte}
               ton={armementLisible(systeme.armement).ton} />
      )}

      {/* ---- définitions, comme leurs badges ---- */}
      {systeme?.parDefinition && (
        <div className="mt-2 flex gap-1.5 px-1">
          {([['hd', 'HD'], ['2k', '2K'], ['4k', '4K']] as const).map(([cle, nom]) => {
            const n = systeme.parDefinition?.[cle] ?? 0;
            return (
              <span key={cle} className="rounded px-1.5 py-0.5 font-mono text-[10px]"
                    style={{ background: n ? 'var(--accent-soft)' : 'var(--card2)',
                             color: n ? 'var(--accent)' : 'var(--soft)' }}>
                {nom} ×{n}
              </span>
            );
          })}
        </div>
      )}

      {/* ---- détections récentes, en direct ---- */}
      {vives.length > 0 && (
        <>
          <Sep />
          <Titre>{t('colonne.detectionsRecentes')}</Titre>
          {vives.map((d) => (
            <button key={d.id ?? String(d.debut)} onClick={() => onOuvrir(d)}
                    disabled={!d.id || d.debut === null}
                    className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left transition-colors hover:bg-[var(--card2)] disabled:cursor-default disabled:hover:bg-transparent">
              <div className="h-[30px] w-[52px] shrink-0 overflow-hidden rounded"
                   style={{ background: 'var(--card2)' }}>
                {/*
                  Tant que la détection COURT, il n'existe aucune vignette : on montre
                  l'instantané de la caméra, daté du début pour que le navigateur le garde.
                  Une fois finie, la vraie vignette de l'événement prend la place.
                */}
                {(d.fin && d.id ? true : Boolean(d.camera)) && (
                  <img src={d.fin && d.id ? `/vignette/${d.id}` : `/instantane/${d.camera}?t=${d.debut ?? 0}`}
                       alt="" loading="lazy" className="h-full w-full object-cover"
                       onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px]">
                  {/* nomSujet rend le mot brut quand il ne connait pas : ici, un type
                      inconnu redevient un sobre « Détection » plutot qu'un mot d'API. */}
                  {d.sujets.map(nomSujet).join(', ')
                    || (nomSujet(d.type) !== d.type ? nomSujet(d.type) : t('colonne.detection'))}
                </div>
                <div className="truncate font-mono text-[10px] text-soft">{d.cameraNom ?? ''}</div>
              </div>
              <span className="shrink-0 font-mono text-[10.5px] text-soft">
                {d.debut ? ilYa(d.debut) : ''}
              </span>
            </button>
          ))}
        </>
      )}

      {/* ---- activité du jour ---- */}
      {dujour !== null && (
        <>
          <Sep />
          <Titre>{t('colonne.aujourdhui')} · {partiel ? '≥ ' : ''}{dujour.length}</Titre>
          <div className="flex h-11 items-end gap-[2px] px-1">
            {heures.map((n, h) => {
              // Heure non couverte par la lecture : elle se dit inconnue, jamais vide.
              const su = h >= depuis;
              return (
                <div key={h} className="flex-1 rounded-t-sm"
                     title={su ? `${String(h).padStart(2, '0')}h — ${n}`
                              : `${String(h).padStart(2, '0')}h — ${t('colonne.nonLu')}`}
                     style={{ height: su ? `${Math.max(2, (n / maxi) * 100)}%` : '100%',
                              background: su ? 'var(--accent)' : 'var(--line)',
                              opacity: su ? (n ? 0.8 : 0.18) : 0.35 }} />
              );
            })}
          </div>
          <div className="mt-1 flex justify-between px-1 font-mono text-[9.5px] text-soft">
            <span>00</span><span>06</span><span>12</span><span>18</span><span>24</span>
          </div>
        </>
      )}

      {/* ---- enregistrements ---- */}
      {(archive || systeme?.disque) && (
        <>
          <Sep />
          <Titre>{t('colonne.enregistrements')}</Titre>
          {/*
            L'enregistrement suspendu passe AVANT tout le reste, et en rouge : sans cela,
            une profondeur de cinq mois et un disque à moitié plein donneraient toutes les
            apparences du bon fonctionnement pendant que plus rien ne s'écrit.
          */}
          {systeme?.enregistrementSuspendu && (
            <p className="mb-1.5 rounded-md px-2 py-1.5 text-[12px] leading-snug"
               style={{ background: 'rgba(180,72,63,.14)', color: 'var(--warn)' }}>
              {t('colonne.suspendu')}
            </p>
          )}
          {archive && (
            <>
              <Ligne k={t('colonne.plusAncien')} v={dateCourte(new Date(archive.debut))} />
              <Ligne k={t('colonne.profondeur')} v={duree(archive.fin - archive.debut)} />
              {archive.frontiere !== null && (
                <Ligne k={t('colonne.pleineDefinition')} v={duree(archive.fin - archive.frontiere)} ton="var(--warn)" />
              )}
              {/* Le controleur annonce des JOURS FLOTTANTS (393,163460… constate le
                  03.08) : on arrondit a l'affichage, la comparaison garde le brut. */}
              {ecartHaute !== null && (
                <Ligne k={t('colonne.pleineDefAnnoncee')} v={`${Math.round(ecartHaute)} ${t('unite.j')}`} ton="var(--warn)" />
              )}
            </>
          )}
          {ecartRetention !== null && (
            <Ligne k={t('colonne.retentionAnnoncee')} v={`${Math.round(ecartRetention)} ${t('unite.j')}`} ton="var(--warn)" />
          )}
          {/*
            Un disque qui n'est pas « ok » se dit — mais avec ce qu'il faut pour ne pas
            s'alarmer a tort. Le poste de reference rend « hddNotCompatible » : le disque n'est
            pas sur la liste d'Ubiquiti, ce qui n'empeche rien et n'a jamais rien empeche
            chez lui — 162 jours d'archive et 5,85 To ecrits. L'annoncer en rouge sans le
            dire serait inquieter pour rien.
          */}
          {etatDisque && (
            <>
              <Ligne k={t('colonne.etatDisque')} v={etatDisque.texte} ton={etatDisque.ton} />
              {etatDisque.detail && (
                <p className="px-1 text-[11px] leading-snug text-soft">{etatDisque.detail}</p>
              )}
            </>
          )}
          {systeme?.parJourHaute != null && (
            <Ligne k={t('colonne.ecritParJour')} v={go(systeme.parJourHaute + (systeme.parJourBasse ?? 0))} />
          )}

          {systeme?.disque && remplissage !== null && (
            <>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--card2)' }}>
                <div className="h-full rounded-full"
                     style={{ width: `${Math.min(100, remplissage)}%`,
                              background: 'linear-gradient(90deg,var(--accent),var(--accent-d))' }} />
              </div>
              <Ligne k={t('colonne.disque')} v={`${to(systeme.disque.utilise)} / ${to(systeme.disque.total)}`} />
              {/* La seule phrase qui reste : sans elle, 98 % ressemble a une panne. */}
              <p className="px-1 text-[11px] leading-snug text-soft">
                {t('colonne.rotation')}
              </p>
            </>
          )}
        </>
      )}

      {/* ---- versions ---- */}
      {systeme && (
        <>
          <Sep />
          <Titre>{t('colonne.versions')}</Titre>
          {versionAlcora && <Ligne k="Alcora" v={versionAlcora} ton="var(--ok)" />}
          {systeme.version && <Ligne k="Protect" v={systeme.version} />}
          {systeme.versionOs && <Ligne k="UniFi OS" v={systeme.versionOs} />}
          {systeme.versionDisponible && (
            <Ligne k={t('colonne.disponible')} v={systeme.versionDisponible} ton="var(--warn)" />
          )}
          {systeme.depuis != null && <Ligne k={t('colonne.allumeDepuis')} v={duree(Date.now() - systeme.depuis)} />}
        </>
      )}

      <Sep />
      <p className="px-1 text-[11.5px] leading-snug" style={{ color: 'var(--ok)' }}>
        {t('colonne.aucuneImage')}
      </p>
    </>
  );
}
