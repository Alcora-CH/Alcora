import { localeDates, nombre, t } from '../i18n';
import { nomSujet } from '../i18n/sujets';
import type { Cle } from '../i18n/fr';

/**
 * Les valeurs du contrôleur, dites lisiblement — partagées par la page Système, la barre
 * d'état et la colonne Activité. Sorties de la colonne d'état du panneau (23.10.2026), dont
 * elles portent les règles : ce qui manque disparaît, jamais un zéro à la place d'une
 * valeur inconnue ; une valeur jamais observée passe brute plutôt que traduite au hasard.
 *
 * Elles appellent le t() du module : le composant qui les affiche s'abonne à la langue.
 */

export const JOUR_MS = 86_400_000;

// « h », « min » et « s » s'ecrivent pareil dans les quatre langues ; jour, mois et
// octets, non — ils passent par le dictionnaire.
export const to = (n: number) => `${nombre(n / 1e12, 2)} ${t('unite.to')}`;
export const go = (n: number) => `${Math.round(n / 1e9)} ${t('unite.go')}`;

/** Un poids de fichier : en Mo sous le giga-octet, en Go au-delà (une décimale sous 10 Go). */
export function poids(n: number): string {
  if (n >= 1e9) return `${nombre(n / 1e9, n < 1e10 ? 1 : 0)} ${t('unite.go')}`;
  return `${Math.max(1, Math.round(n / 1e6))} ${t('unite.mo')}`;
}

/** Une durée de vidéo, à la seconde : « 3 min 30 s », « 2 h 10 min », « 45 s ». */
export function dureeVideo(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h) return m ? `${h} h ${m} min` : `${h} h`;
  if (m) return r ? `${m} min ${r} s` : `${m} min`;
  return `${r} s`;
}

export function duree(ms: number): string {
  const j = Math.floor(ms / JOUR_MS);
  if (j < 1) return `${Math.round(ms / 3_600_000)} h`;
  if (j < 60) return `${j} ${t('unite.j')}`;
  return `${Math.floor(j / 30)} ${t('unite.mois')} ${j % 30} ${t('unite.j')}`;
}

export function ilYa(ms: number): string {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < JOUR_MS / 1000) return `${Math.floor(s / 3600)} h`;
  return `${Math.floor(s / 86_400)} ${t('unite.j')}`;
}

export const dateCourte = (d: Date) => new Intl.DateTimeFormat(
  localeDates(), { day: '2-digit', month: '2-digit', year: '2-digit' }).format(d);

/**
 * Ce qu'une détection a vu, en un mot. nomSujet rend le mot brut quand il ne le connaît
 * pas : un type inconnu redevient alors un sobre « Détection » plutôt qu'un mot d'API.
 */
export function ceQuiAEteVu(d: { sujets: string[]; type: string }): string {
  return d.sujets.map(nomSujet).join(', ')
    || (nomSujet(d.type) !== d.type ? nomSujet(d.type) : t('colonne.detection'));
}

const ARMEMENT: Record<string, { cle: Cle; ton: string }> = {
  armed: { cle: 'colonne.arme', ton: 'var(--ok)' },
  disarmed: { cle: 'colonne.desarme', ton: 'var(--soft)' },
  // Releve sur le poste : les alarmes de Protect ne sont pas configurees du tout, ce qui
  // n'est ni « arme » ni « desarme ». Alcora a ses propres veilles, elles ne dependent
  // pas de celles-ci.
  disabled: { cle: 'colonne.alarmesInactives', ton: 'var(--soft)' },
};

/**
 * L'armement de Protect, tel qu'on ose l'ecrire.
 *
 * Une valeur inconnue se montre TELLE QUELLE plutot que de faire disparaitre la ligne.
 * Ne rien afficher se confond avec « le controleur n'a rien dit », et laisse croire que la
 * fonction n'existe pas ; montrer le mot brut dit au moins qu'il y a quelque chose a
 * traduire. Protect ne documente pas la liste de ces valeurs.
 */
export function armementLisible(brut: string): { texte: string; ton: string } {
  const connu = ARMEMENT[brut];
  return connu ? { texte: t(connu.cle), ton: connu.ton } : { texte: brut, ton: 'var(--muted)' };
}

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

export function etatDisqueLisible(brut: string): { texte: string; ton: string; detail?: string } | null {
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
 * L'archive de l'ensemble des caméras : la plus profonde fait foi pour le début, la plus
 * récente pour la fin. La frontière de pleine définition ne se dit que si CHAQUE caméra en
 * a une — sinon la plus prudente mentirait sur celles qui n'en ont pas.
 */
export function archiveGlobale(archives: { debut: number; frontiere: number | null; fin: number }[] | undefined) {
  if (!archives?.length) return null;
  return {
    debut: Math.min(...archives.map((a) => a.debut)),
    frontiere: archives.every((a) => a.frontiere !== null)
      ? Math.min(...archives.map((a) => a.frontiere as number)) : null,
    fin: Math.max(...archives.map((a) => a.fin)),
  };
}
