import { ChevronRight, Download, ShieldCheck } from 'lucide-react';
import { localeDates, t, useLangue } from '../i18n';
import { pourcentExport, useEtatExport } from '../lib/exportPlage';
import { archiveGlobale, armementLisible, duree } from '../lib/lisible';
import { Bouton } from '../ui/Bouton';
import { Touche } from '../ui/Cadre';
import { cx } from '../ui/cx';
import { Horloge } from './Horloge';
import type { DiscoveredCamera, RelayState, SystemeEtat } from '../types/protect';

/**
 * La barre d'état — direction « Observatoire », maquette A du 23.10.2026.
 *
 * Ce que le panneau « Surveillance » disait en permanence, réduit à ce qu'on vérifie d'un
 * coup d'œil : le flux marche-t-il, quel contrôleur, est-il armé, combien d'archive, le
 * disque. Elle est sur TOUS les écrans — c'est elle qui remplace le panneau partout — et
 * mène à la page Système pour le détail.
 *
 * Elle se resserre avec la fenêtre (requêtes de conteneur) : à 900 px, la largeur
 * minimale, ce qui dit qu'une chose ne va pas reste ; la phrase de confidentialité et
 * l'archive cèdent la place en premier.
 */

/**
 * Une case de la barre, séparée de la suivante par un filet.
 *
 * Rigide, sauf la case du message (« souple ») : c'est elle qui cède quand la fenêtre manque
 * de place. Le choix passe par une propriété et non par une classe ajoutée : « shrink » et
 * « shrink-0 » côte à côte, c'est l'ordre de la feuille de style qui tranche — et il
 * tranchait pour « shrink-0 », si bien qu'un long message d'erreur poussait hors de l'écran
 * le bouton qui mène à son remède.
 */
function Case({ children, className, souple }: { children: React.ReactNode; className?: string; souple?: boolean }) {
  return (
    <span className={cx(
      'inline-flex h-[18px] items-center gap-[7px] whitespace-nowrap border-r border-line2 px-3.5 first:pl-0',
      souple ? 'min-w-0 shrink' : 'shrink-0',
      className,
    )}>
      {children}
    </span>
  );
}

function Pastille({ ton }: { ton: string }) {
  return <span aria-hidden className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: ton }} />;
}

export function BarreEtat({
  relay, systeme: systemeLu, cameras: camerasLues, espace, onSysteme, onRaccourcis, onRelecture, horsConnexion,
}: {
  relay: RelayState;
  systeme: SystemeEtat | null;
  cameras: DiscoveredCamera[];
  espace: string;
  onSysteme: () => void;
  onRaccourcis: () => void;
  /** L'export d'une plage continue hors de la relecture : un clic sur sa case y ramène. */
  onRelecture: () => void;
  /** Avant la première connexion : la barre dit seulement que le contrôleur attend. */
  horsConnexion?: boolean;
}) {
  useLangue();
  /* Hors connexion, ce que la barre saurait encore du contrôleur vient d'une session PASSÉE
     (« Modifier la connexion ») : elle n'en dit rien, plutôt que « non connecté » à côté du
     nom du contrôleur et de son archive. */
  const systeme = horsConnexion ? null : systemeLu;
  const cameras = horsConnexion ? [] : camerasLues;
  const exportEnCours = useEtatExport();
  const archive = archiveGlobale(systeme?.archive);
  const armement = systeme?.armement ? armementLisible(systeme.armement) : null;
  const horsLigne = cameras.filter((c) => !c.online).length;
  const disque = systeme?.disque && systeme.disque.total > 0
    ? systeme.disque.utilise / systeme.disque.total : null;

  return (
    <footer className="@container flex h-[34px] shrink-0 items-center border-t border-line bg-card pl-3.5 pr-2 text-meta text-muted">
      {/* L'état du flux d'abord, en couleur : c'est ce qu'on vient vérifier. Avant la première
          connexion, il n'y a pas encore de flux : la barre dit ce qui attend. */}
      {horsConnexion ? (
        <Case souple>
          <Pastille ton="var(--soft)" />
          <span className="truncate">{t('colonne.controleur')} <b className="font-medium text-ink">{t('barre.nonConnecte')}</b></span>
        </Case>
      ) : (
        <Case souple>
          <Pastille ton={relay.running ? 'var(--ok)' : 'var(--warn)'} />
          <span className={cx('truncate', !relay.running && 'text-warn')}>{relay.message}</span>
        </Case>
      )}

      {/* Ce qui ne va pas passe avant ce qui va : suspension, caméras perdues. */}
      {systeme?.enregistrementSuspendu && (
        <Case><Pastille ton="var(--bad)" /><span className="text-bad">{t('barre.suspendu')}</span></Case>
      )}
      {horsLigne > 0 && (
        <Case>
          <Pastille ton="var(--warn)" />
          <span className="text-warn">
            {horsLigne === 1 ? t('barre.uneHorsLigne') : t('barre.horsLigne', { n: horsLigne })}
          </span>
        </Case>
      )}

      {systeme?.nom && (
        <Case>{t('colonne.controleur')} <b className="font-medium text-ink">{systeme.nom}</b></Case>
      )}
      {armement && (
        <Case className="@max-[980px]:hidden">
          Protect <b className="font-medium" style={{ color: armement.ton === 'var(--soft)' ? 'var(--ink)' : armement.ton }}>
            {armement.texte}
          </b>
        </Case>
      )}
      {archive && (
        <Case className="@max-[1100px]:hidden">
          {t('barre.archive')} <b className="font-medium text-ink">{duree(archive.fin - archive.debut)}</b>
        </Case>
      )}
      {disque !== null && (
        <Case>
          {t('colonne.disque')}
          <span aria-hidden className="h-[5px] w-11 overflow-hidden rounded-[3px] bg-card3">
            <span className="block h-full bg-accent" style={{ width: `${Math.min(100, disque * 100)}%` }} />
          </span>
          <b className="font-medium tabular-nums text-ink">
            {new Intl.NumberFormat(localeDates(), { style: 'percent', maximumFractionDigits: 0 }).format(disque)}
          </b>
        </Case>
      )}

      {exportEnCours.etat === 'encours' && (
        <button type="button" onClick={onRelecture}
                title={t('export.barreTitre', {
                  camera: exportEnCours.camera,
                  debut: new Date(exportEnCours.debut).toLocaleTimeString(localeDates()),
                  fin: new Date(exportEnCours.fin).toLocaleTimeString(localeDates()),
                })}
                /* Elle se POSE à son arrivée : c'est elle qui suit l'export hors de la relecture,
                   et la ligne de la plage ne le dit plus en toutes lettres (24.10.2026). */
                className="m-surgit inline-flex h-[18px] shrink-0 items-center gap-[7px] whitespace-nowrap border-r border-line2 px-3.5 text-accent hover:text-ink">
          <Download className="h-4 w-4" aria-hidden />
          {t('export.export')}
          <span aria-hidden className="h-[5px] w-[60px] overflow-hidden rounded-[3px] bg-card3 @max-[1100px]:hidden">
            <span className="block h-full bg-accent" style={{ width: `${pourcentExport(exportEnCours)}%` }} />
          </span>
          <b className="font-medium tabular-nums text-ink">{pourcentExport(exportEnCours)} %</b>
        </button>
      )}

      {/* La promesse d'Alcora, en permanence — en toutes lettres quand la place le permet. */}
      <span className="ml-auto inline-flex shrink-0 items-center gap-[7px] whitespace-nowrap px-3.5 text-soft"
            title={t('barre.prive')}>
        <ShieldCheck className="h-4 w-4" aria-hidden />
        <span className="@max-[1280px]:hidden">{t('barre.prive')}</span>
      </span>
      <span className="inline-flex h-[18px] items-center border-l border-line2 px-3.5">
        <Horloge className="font-mono tabular-nums text-ink" />
      </span>
      {/* Ni raccourcis ni Système avant la première connexion : « ? » n'y fait rien (App.tsx),
          et les gestes listés sont ceux d'écrans encore grisés. */}
      {!horsConnexion && (
        <>
          {/* Le nom accessible ne doit pas tomber à « ? » quand le libellé cède la place. */}
          <Bouton variante="fantome" taille="petit" titre={t('barre.raccourcisTitre')} onClick={onRaccourcis}
                  aria-label={t('raccourcis.titre')} className="ml-1">
            <span className="@max-[1180px]:hidden">{t('barre.raccourcis')}</span> <Touche>?</Touche>
          </Bouton>
          <Bouton variante={espace === 'systeme' ? 'actif' : 'fantome'} taille="petit" onClick={onSysteme}
                  aria-current={espace === 'systeme' ? 'page' : undefined} className="ml-1">
            {t('espace.systeme')}<ChevronRight className="h-4 w-4" aria-hidden />
          </Bouton>
        </>
      )}
    </footer>
  );
}
