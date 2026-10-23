import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown, LayoutPanelTop, Pencil, Plus, Trash2, Undo2 } from 'lucide-react';
import { t, useLangue } from '../i18n';
import { MAX_DISPOSITIONS, NOM_MAX, nomRefuse, type Disposition, type Dispositions } from '../lib/dispositions';
import { Bouton } from '../ui/Bouton';
import { Touche } from '../ui/Cadre';
import { cx } from '../ui/cx';
import type { DiscoveredCamera } from '../types/protect';

/**
 * Le menu « Disposition » du direct — variante 1 de docs/maquette-dispositions.html,
 * retenue le 23.10.2026.
 *
 * Il porte le nom de la disposition en cours (« modifiée » si le mur n'est plus le sien),
 * la liste pour passer de l'une à l'autre — Ctrl + 1 à 9 aussi —, et de quoi enregistrer,
 * mettre à jour, revenir, renommer et supprimer.
 *
 * Un panneau dépliant, comme « Caméras » : un clic ailleurs le referme. SAUF pendant qu'on
 * nomme, renomme ou confirme une suppression : c'est alors une saisie, et une saisie ne se
 * perd pas sur un clic à côté. Échap annule la saisie, puis referme.
 */

type Saisie =
  | { genre: 'nouvelle'; nom: string }
  | { genre: 'renommer'; id: string; nom: string }
  | { genre: 'supprimer'; id: string };

export function MenuDispositions({
  dispositions, cameras, visibles, modifiee, onAppliquer, onEnregistrer, onMettreAJour, onRenommer, onSupprimer,
  sombre, onOuvert,
}: {
  dispositions: Dispositions;
  cameras: DiscoveredCamera[];
  /** Les caméras du mur, dans l'ordre : ce qu'enregistrer garderait. */
  visibles: string[];
  /** La disposition en cours ne décrit plus le mur. */
  modifiee: boolean;
  onAppliquer: (d: Disposition) => void;
  onEnregistrer: (nom: string) => void;
  onMettreAJour: (id: string) => void;
  onRenommer: (id: string, nom: string) => void;
  onSupprimer: (id: string) => void;
  sombre?: boolean;
  onOuvert?: (ouvert: boolean) => void;
}) {
  useLangue();
  const [ouvert, setOuvert] = useState(false);
  const [saisie, setSaisie] = useState<Saisie | null>(null);
  const zone = useRef<HTMLDivElement>(null);
  const idPanneau = useId();
  const active = dispositions.liste.find((d) => d.id === dispositions.active) ?? null;
  const nomCamera = (id: string) => cameras.find((c) => c.id === id)?.name;

  useEffect(() => { onOuvert?.(ouvert); }, [ouvert, onOuvert]);
  useEffect(() => () => onOuvert?.(false), [onOuvert]);
  useEffect(() => { if (!ouvert) setSaisie(null); }, [ouvert]);

  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e: PointerEvent) => {
      // Une saisie en cours ne se perd pas sur un clic à côté.
      if (!saisie && !zone.current?.contains(e.target as Node)) setOuvert(false);
    };
    const clavier = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      if (saisie) setSaisie(null); else setOuvert(false);
    };
    document.addEventListener('pointerdown', dehors);
    window.addEventListener('keydown', clavier, true);
    return () => {
      document.removeEventListener('pointerdown', dehors);
      window.removeEventListener('keydown', clavier, true);
    };
  }, [ouvert, saisie]);

  const resume = (d: Disposition) => {
    const noms = d.cameras.map(nomCamera);
    const absentes = noms.filter((n) => n === undefined).length;
    const presentes = noms.filter((n): n is string => n !== undefined).join(', ');
    return { presentes, absentes };
  };
  const refusNouvelle = saisie?.genre === 'nouvelle' ? nomRefuse(saisie.nom, dispositions) : null;
  const refusRenommer = saisie?.genre === 'renommer' ? nomRefuse(saisie.nom, dispositions, saisie.id) : null;
  const plein = dispositions.liste.length >= MAX_DISPOSITIONS;

  return (
    <div ref={zone} className="relative">
      <Bouton icone={LayoutPanelTop} aria-expanded={ouvert} aria-controls={idPanneau}
              titre={t('dispositions.titreBouton')}
              onClick={() => setOuvert((o) => !o)}
              className={cx(sombre && 'veil')} style={sombre ? { color: 'var(--on-1)' } : undefined}>
        <span className="max-w-[180px] truncate">{active ? active.nom : t('dispositions.bouton')}</span>
        {active && modifiee && <span className="text-meta text-accent">· {t('dispositions.modifiee')}</span>}
        <ChevronDown className="h-4 w-4" aria-hidden />
      </Bouton>

      {ouvert && (
        <div id={idPanneau} role="group" aria-label={t('dispositions.titre')}
             className="m-boite absolute right-0 top-[calc(100%+8px)] z-40 w-[400px] rounded-xl border border-line2 bg-card p-2 shadow-[0_30px_70px_-20px_rgba(0,0,0,.85)]">
          <h3 className="mx-2.5 mb-2 mt-1 text-corps font-semibold text-muted">{t('dispositions.titre')}</h3>

          {dispositions.liste.length === 0 && (
            <p className="px-2.5 pb-1 pt-1 text-meta leading-relaxed text-muted">{t('dispositions.vide')}</p>
          )}

          {dispositions.liste.map((d, i) => {
            const { presentes, absentes } = resume(d);
            const estActive = d.id === dispositions.active;
            if (saisie?.genre === 'renommer' && saisie.id === d.id) {
              return (
                <form key={d.id} className="px-2.5 py-2"
                      onSubmit={(e) => { e.preventDefault(); if (!refusRenommer) { onRenommer(d.id, saisie.nom); setSaisie(null); } }}>
                  <input autoFocus value={saisie.nom} maxLength={NOM_MAX} aria-label={t('dispositions.nomDe', { nom: d.nom })}
                         onChange={(e) => setSaisie({ ...saisie, nom: e.target.value })}
                         className="h-9 w-full rounded-lg border border-accent-ligne bg-card2 px-3 text-corps text-ink outline-none" />
                  {refusRenommer === 'doublon' && <p className="mt-1 text-meta text-warn">{t('dispositions.doublon')}</p>}
                  <div className="mt-2 flex justify-end gap-2">
                    <Bouton taille="petit" type="button" onClick={() => setSaisie(null)}>{t('dispositions.annuler')}</Bouton>
                    <Bouton taille="petit" variante="primaire" type="submit" disabled={Boolean(refusRenommer)}>{t('dispositions.renommerOk')}</Bouton>
                  </div>
                </form>
              );
            }
            if (saisie?.genre === 'supprimer' && saisie.id === d.id) {
              return (
                <div key={d.id} role="alert" className="mx-1 my-1 rounded-[9px] border border-[rgba(227,115,95,.35)] bg-bad-soft px-3 py-2.5 text-meta">
                  {t('dispositions.supprimerQuestion', { nom: d.nom })}
                  <div className="mt-2 flex justify-end gap-2">
                    <Bouton taille="petit" onClick={() => setSaisie(null)}>{t('dispositions.annuler')}</Bouton>
                    <Bouton taille="petit" variante="danger" icone={Trash2}
                            onClick={() => { onSupprimer(d.id); setSaisie(null); }}>{t('dispositions.supprimer')}</Bouton>
                  </div>
                </div>
              );
            }
            return (
              <div key={d.id} className={cx('group grid grid-cols-[20px_minmax(0,1fr)_auto_auto] items-center gap-2.5 rounded-[9px] px-2.5 py-2 hover:bg-card2',
                estActive && 'bg-card2')}>
                <span className="text-accent">{estActive && <Check className="h-4 w-4" aria-hidden />}</span>
                <button type="button" onClick={() => { onAppliquer(d); setOuvert(false); }}
                        aria-current={estActive ? 'true' : undefined} className="min-w-0 text-left">
                  <span className="block truncate font-semibold">
                    {d.nom}
                    {estActive && modifiee && <span className="ml-1.5 text-meta font-medium text-accent">· {t('dispositions.modifiee')}</span>}
                  </span>
                  <span className="block truncate text-meta text-muted">
                    {presentes || '—'}
                    {absentes > 0 && <span className="text-warn"> · {absentes === 1 ? t('dispositions.uneAbsente') : t('dispositions.absentes', { n: absentes })}</span>}
                  </span>
                </button>
                <span className="whitespace-nowrap text-micro text-soft"><Touche>Ctrl</Touche> <Touche>{i + 1}</Touche></span>
                <span className="flex gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                  <Bouton taille="petit" variante="fantome" icone={Pencil} titre={t('dispositions.renommer', { nom: d.nom })}
                          onClick={() => setSaisie({ genre: 'renommer', id: d.id, nom: d.nom })} />
                  <Bouton taille="petit" variante="fantome" icone={Trash2} titre={t('dispositions.supprimerTitre', { nom: d.nom })}
                          onClick={() => setSaisie({ genre: 'supprimer', id: d.id })} />
                </span>
              </div>
            );
          })}

          {/* La disposition en cours ne décrit plus le mur : la garder telle quelle, ou y revenir. */}
          {active && modifiee && (
            <div className="mx-1.5 my-1.5 rounded-[9px] border border-accent-ligne bg-accent-soft px-3 py-2.5 text-meta">
              {t('dispositions.modifieeDetail', { nom: active.nom })}
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Bouton taille="petit" variante="primaire" onClick={() => onMettreAJour(active.id)}>
                  {t('dispositions.mettreAJour', { nom: active.nom })}
                </Bouton>
                <Bouton taille="petit" icone={Undo2} onClick={() => onAppliquer(active)}>
                  {t('dispositions.revenir', { nom: active.nom })}
                </Bouton>
              </div>
            </div>
          )}

          <div className="mx-1 my-1.5 h-px bg-line" />
          {saisie?.genre === 'nouvelle' ? (
            <form className="px-2.5 pb-2.5 pt-1"
                  onSubmit={(e) => { e.preventDefault(); if (!refusNouvelle) { onEnregistrer(saisie.nom); setSaisie(null); } }}>
              <label className="mb-1.5 block text-meta text-muted" htmlFor={`${idPanneau}-nom`}>{t('dispositions.nomNouvelle')}</label>
              <input id={`${idPanneau}-nom`} autoFocus value={saisie.nom} maxLength={NOM_MAX}
                     onChange={(e) => setSaisie({ genre: 'nouvelle', nom: e.target.value })}
                     className="h-9 w-full rounded-lg border border-accent-ligne bg-card2 px-3 text-corps text-ink outline-none" />
              <p className="mt-1.5 text-meta leading-relaxed text-soft">
                {t('dispositions.ceQuiSeraGarde', { cameras: visibles.map(nomCamera).filter(Boolean).join(', ') })}
              </p>
              {refusNouvelle === 'doublon' && <p className="mt-1 text-meta text-warn">{t('dispositions.doublon')}</p>}
              <div className="mt-2.5 flex justify-end gap-2">
                <Bouton taille="petit" type="button" onClick={() => setSaisie(null)}>{t('dispositions.annuler')}</Bouton>
                <Bouton taille="petit" variante="primaire" type="submit" disabled={Boolean(refusNouvelle)}>{t('dispositions.enregistrer')}</Bouton>
              </div>
            </form>
          ) : (
            <button type="button" disabled={plein} title={plein ? t('dispositions.plein', { n: MAX_DISPOSITIONS }) : undefined}
                    onClick={() => setSaisie({ genre: 'nouvelle', nom: '' })}
                    className="m-pression flex w-full items-center gap-2 rounded-[9px] px-2.5 py-2.5 text-left font-semibold text-accent hover:bg-accent-soft disabled:opacity-40">
              <Plus className="h-4 w-4" aria-hidden />{t('dispositions.enregistrerActuelle')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
