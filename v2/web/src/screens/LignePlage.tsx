import { AlertCircle, CircleCheck, Download, FolderOpen, RotateCw, X } from 'lucide-react';
import { localeDates, t, useLangue } from '../i18n';
import { dureeVideo, poids } from '../lib/lisible';
import { pourcentExport, type Plage } from '../lib/exportPlage';
import { Bouton } from '../ui/Bouton';
import { Info } from '../ui/Info';
import { cx } from '../ui/cx';
import type { Cle } from '../i18n/fr';
import type { EtatExport, RaisonExport } from '../types/protect';

/**
 * La ligne de la plage, sous la frise — variante 1 de la maquette
 * (docs/maquette-export-plage.html), retenue le 23.10.2026.
 *
 * Elle dit, dans cet ordre de priorité : l'export en cours ; son issue (enregistrée,
 * refusée, interrompue, annulée) tant qu'on ne l'a pas écartée ; la plage choisie, avec ce
 * qu'elle donnera — durée, poids estimé, définition, son, et ce qui mérite d'être su avant
 * (plusieurs fichiers, basse définition) ; ou la borne qui manque encore.
 */

const HEURE_MS = 3_600_000;

const RAISON: Record<RaisonExport, Cle> = {
  vide: 'export.raison.vide', place: 'export.raison.place', existe: 'export.raison.existe',
  interrompu: 'export.raison.interrompu', refuse: 'export.raison.refuse', session: 'export.raison.session',
  ecriture: 'export.raison.ecriture', plage: 'export.raison.plage', occupe: 'export.raison.occupe',
};

function hms(ms: number): string {
  return new Intl.DateTimeFormat(localeDates(), { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .format(new Date(ms));
}

/** Les bornes ; le jour de la semaine s'ajoute quand elles ne tombent pas le même jour. */
function Bornes({ debut, fin }: { debut: number; fin: number | null }) {
  const memeJour = fin === null || new Date(debut).toDateString() === new Date(fin).toDateString();
  const jour = (ms: number) => new Intl.DateTimeFormat(localeDates(), { weekday: 'short' }).format(new Date(ms));
  return (
    <span className="whitespace-nowrap font-mono tabular-nums text-ink">
      {!memeJour && `${jour(debut)} `}{hms(debut)}
      <span className="mx-1.5 text-soft">→</span>
      {fin === null ? '…' : `${!memeJour ? `${jour(fin)} ` : ''}${hms(fin)}`}
    </span>
  );
}

/*
 * Une issue (enregistree, refusee, annulee) s'annonce au lecteur d'ecran ; la progression,
 * non : mise a jour quatre fois par seconde, elle parlerait sans arret.
 */
function Cadre({ ton = 'neutre', annonce = false, children }: {
  ton?: 'neutre' | 'ok' | 'erreur' | 'avert'; annonce?: boolean; children: React.ReactNode;
}) {
  return (
    <div className={cx('mt-2 flex min-h-11 flex-wrap items-center gap-x-2.5 gap-y-1 rounded-[9px] border py-1.5 pl-3 pr-2 text-corps',
      ton === 'ok' ? 'border-[rgba(116,196,148,.35)] bg-card2'
        : ton === 'erreur' ? 'border-[rgba(227,115,95,.45)] bg-bad-soft'
          : ton === 'avert' ? 'border-[rgba(224,162,60,.45)] bg-card2' : 'border-line2 bg-card2')}
         role={annonce ? 'status' : undefined}>
      {children}
    </div>
  );
}

const Titre = ({ icone: Icone, ton, children }: { icone: typeof Download; ton: string; children: React.ReactNode }) => (
  <span className={cx('inline-flex items-center gap-[7px] whitespace-nowrap font-semibold', ton)}>
    <Icone className="h-4 w-4" aria-hidden />{children}
  </span>
);

const Note = ({ ton, children }: { ton?: string; children: React.ReactNode }) => (
  <span className={cx('basis-full pb-0.5 text-meta', ton ?? 'text-muted')}>{children}</span>
);

const Fin = ({ children }: { children: React.ReactNode }) => (
  <span className="ml-auto flex items-center gap-1.5">{children}</span>
);

export function LignePlage({
  plage, etat, estimation, definition, aDuSon, frontiere, refus, cameras = 1,
  onEffacer, onExporter, onAnnuler, onMontrer, onReessayer,
}: {
  plage: Plage;
  etat: EtatExport;
  /** Octets attendus, d'après le débit RÉEL des morceaux déjà lus ; 0 = inconnu. */
  estimation: number;
  definition: string | null;
  aDuSon: boolean | null;
  /** Avant cet instant, seule la basse définition subsiste. */
  frontiere: number | null;
  /** Les caméras affichées : à plusieurs, un fichier par caméra. */
  cameras?: number;
  /** Le dernier refus avant le premier octet (boîte de Windows passée). */
  refus: { raison: RaisonExport; fichier?: string | null } | null;
  onEffacer: () => void;
  onExporter: () => void;
  onAnnuler: () => void;
  onMontrer: () => void;
  onReessayer: () => void;
}) {
  useLangue();

  /* ---- l'export en cours : il passe avant tout, même si l'on choisit déjà la suite ---- */
  if (etat.etat === 'encours') {
    const pourcent = pourcentExport(etat);
    const restant = etat.debit && etat.total > 0
      ? ((etat.total - etat.recu) + (etat.parties - etat.partie) * etat.total) / etat.debit * 1000 : null;
    return (
      <Cadre>
        <Titre icone={Download} ton="text-accent">{t('export.export')}</Titre>
        <span className="text-muted">{etat.camera}</span>
        <Bornes debut={etat.debut} fin={etat.fin} />
        <span aria-hidden className="h-1.5 w-[220px] shrink overflow-hidden rounded-[3px] bg-card3">
          <span className="block h-full bg-accent" style={{ width: `${pourcent}%` }} />
        </span>
        <span className="font-mono tabular-nums text-ink">{pourcent} %</span>
        <span className="whitespace-nowrap text-muted">
          {etat.parties > 1 && <>{t('export.fichierSur', { i: etat.partie, n: etat.parties })} · </>}
          {etat.total > 0 && t('export.progression', { recu: poids(etat.recu), total: poids(etat.total) })}
          {restant !== null && <> · {t('export.restant', { duree: dureeVideo(restant) })}</>}
        </span>
        <Fin><Bouton taille="petit" icone={X} onClick={onAnnuler}>{t('export.annuler')}</Bouton></Fin>
        {/* Plus de « Tu peux continuer à relire… » : la case Export de la barre d'état arrive en
            même temps que cette ligne — on voit que l'export vit ailleurs (clarté, 24.10.2026). */}
      </Cadre>
    );
  }

  /* ---- son issue, tant qu'on ne l'a pas écartée ---- */
  if (etat.etat === 'termine') {
    return (
      <Cadre ton="ok" annonce>
        <Titre icone={CircleCheck} ton="text-ok">
          {etat.fichiers.length > 1 ? t('export.enregistrees', { n: etat.fichiers.length }) : t('export.enregistree')}
        </Titre>
        <span className="min-w-0 truncate font-mono text-meta text-ink" title={`${etat.dossier}\\${etat.fichiers[0]}`}>
          {etat.fichiers[0]}{etat.fichiers.length > 1 && ' …'}
        </span>
        <span className="text-muted">{poids(etat.octets)}</span>
        <Fin>
          <Bouton taille="petit" icone={FolderOpen} onClick={onMontrer}>{t('export.afficher')}</Bouton>
          <Bouton taille="petit" variante="fantome" icone={X} onClick={onEffacer}>{t('export.effacerPlage')}</Bouton>
        </Fin>
        {etat.vides > 0 && (
          <Note>{etat.vides === 1 ? t('export.heureVide') : t('export.heuresVides', { n: etat.vides })}</Note>
        )}
      </Cadre>
    );
  }
  if (etat.etat === 'erreur' || etat.etat === 'annule') {
    const erreur = etat.etat === 'erreur';
    const faits = etat.faits > 0
      ? ` ${etat.faits === 1 ? t('export.faitUn') : t('export.faitsPlusieurs', { n: etat.faits })}` : '';
    return (
      <Cadre ton={erreur ? 'erreur' : 'neutre'} annonce>
        <Titre icone={erreur ? AlertCircle : X} ton={erreur ? 'text-bad' : 'text-muted'}>
          {erreur ? t('export.export') : t('export.annuleTitre')}
        </Titre>
        <span className="text-muted">{etat.camera}</span>
        <Bornes debut={etat.debut} fin={etat.fin} />
        <Fin>
          <Bouton taille="petit" variante="fantome" icone={X} onClick={onEffacer}>{t('export.effacerPlage')}</Bouton>
          {plage.debut !== null && plage.fin !== null && (
            <Bouton taille="petit" variante="primaire" icone={RotateCw} onClick={onReessayer}>{t('export.reessayer')}</Bouton>
          )}
        </Fin>
        <Note ton={erreur ? 'text-[#f0a898]' : undefined}>
          {erreur ? t(RAISON[etat.raison], { statut: etat.statut ?? '' }) : t('export.annule')}{faits}
        </Note>
      </Cadre>
    );
  }

  /* ---- une seule borne ---- */
  if (plage.debut === null && plage.fin === null) return null;
  if (plage.debut === null || plage.fin === null) {
    return (
      <Cadre>
        <Titre icone={Download} ton="text-accent">{t('export.plage')}</Titre>
        {plage.debut !== null ? <Bornes debut={plage.debut} fin={null} /> : (
          <span className="whitespace-nowrap font-mono tabular-nums text-ink">
            …<span className="mx-1.5 text-soft">→</span>{hms(plage.fin!)}
          </span>
        )}
        <Fin><Bouton taille="petit" variante="fantome" icone={X} onClick={onEffacer}>{t('export.effacer')}</Bouton></Fin>
      </Cadre>
    );
  }

  /* ---- la plage choisie, et ce qu'elle donnera ---- */
  const duree = plage.fin - plage.debut;
  const heures = Math.ceil(duree / HEURE_MS);
  const parties = heures * cameras;
  const basse = frontiere !== null && plage.debut < frontiere;
  /*
   * Des faits courts, et le pourquoi dans les « i » — règle « Clarté avant texte » (maquette
   * docs/maquette-clarte-relecture.html, 24.10.2026). Quatre phrases suivaient la ligne, dont
   * celle des images-clés sous CHAQUE plage ; le bouton dit déjà « Exporter en N fichiers ».
   * À plusieurs, la définition et le son sont ceux de chaque caméra : on dit leur nombre.
   */
  const faits: { cle: string; contenu: React.ReactNode }[] = [
    ...(cameras > 1 ? [{ cle: 'cameras', contenu: t('export.nCameras', { n: cameras }) }] : []),
    { cle: 'poids', contenu: estimation > 0 ? t('export.environ', { taille: poids(estimation) }) : t('export.tailleInconnue') },
    ...(cameras === 1 && definition && !basse ? [{ cle: 'definition', contenu: definition }] : []),
    ...(cameras === 1 && aDuSon !== null ? [{ cle: 'son', contenu: aDuSon ? t('export.sonCompris') : t('export.sansSon') }] : []),
    ...(parties > 1 ? [{
      cle: 'fichiers',
      contenu: (
        <span className="inline-flex items-center gap-1">
          {t('export.nFichiers', { n: parties })}
          {/* À plusieurs ET sur plus d'une heure, les deux raisons : un fichier par caméra, et par heure. */}
          <Info>{[cameras > 1 ? t('export.unParCamera') : '', heures > 1 ? t('export.fichiersDetail') : ''].filter(Boolean).join(' ')}</Info>
        </span>
      ),
    }] : []),
    ...(basse ? [{
      cle: 'basse',
      contenu: (
        <span className="inline-flex items-center gap-1">
          <span className="text-warn">{t('export.basse')}</span>
          <Info>{t('export.frontiere', { date: new Date(frontiere!).toLocaleDateString(localeDates()) })}</Info>
        </span>
      ),
    }] : []),
  ];
  return (
    <Cadre ton={refus ? 'erreur' : parties > 1 || basse ? 'avert' : 'neutre'} annonce={Boolean(refus)}>
      <Titre icone={refus ? AlertCircle : Download} ton={refus ? 'text-bad' : 'text-accent'}>{t('export.plage')}</Titre>
      <Bornes debut={plage.debut} fin={plage.fin} />
      <span className="inline-flex items-center whitespace-nowrap text-muted">
        {/* « ≈ » : le contrôleur coupe sur les images-clés — le détail est dans le « i ». */}
        <b className="font-medium text-ink">≈ {dureeVideo(duree)}</b>
        <span className="ml-1 inline-flex"><Info>{t('export.imagesCles')}</Info></span>
        {faits.map((f) => <span key={f.cle} className="inline-flex items-center"><span className="mx-1.5 text-soft">·</span>{f.contenu}</span>)}
      </span>
      <Fin>
        <Bouton taille="petit" variante="fantome" icone={X} onClick={onEffacer}>{t('export.effacer')}</Bouton>
        <Bouton taille="petit" variante="primaire" icone={Download} onClick={onExporter}>
          {parties > 1 ? t('export.exporterParties', { n: parties }) : t('export.exporter')}
        </Bouton>
      </Fin>
      {refus && (
        <Note ton="text-[#f0a898]">{t(RAISON[refus.raison], { fichier: refus.fichier ?? '', statut: '' })}</Note>
      )}
    </Cadre>
  );
}
