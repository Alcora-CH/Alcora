/**
 * Ce que tu n'as pas vu : les absences, et les détections qui y tombent.
 *
 * Demande du 24.10.2026 (le bandeau d'activité du plein écran) : « regarder s'il s'est passé
 * quelque chose pendant qu'on ne regardait pas les caméras ». Personne ne sait où sont tes
 * yeux ; deux signes ont été retenus avec Thomas : la fenêtre d'Alcora n'a plus ton attention
 * (une autre au premier plan, Alcora réduite), ou aucun geste de souris ni de clavier depuis
 * deux minutes. L'absence commence au dernier signe de présence — le dernier geste, ou
 * l'instant où la fenêtre a perdu l'attention — et finit au premier geste qui suit.
 *
 * Les détections qui y tombent restent marquées jusqu'à ce que tu les regardes : survol du
 * bandeau, ou ouverture d'une détection. Alcora fermée, c'est aussi ne pas regarder : au
 * lancement, le temps écoulé depuis la dernière présence connue devient une absence.
 *
 * Module PUR (aucun navigateur) : v2/desktop/test-absence.mjs le lit dans sa source.
 */

export const INACTIVITE_MS = 2 * 60_000;
/*
 * Un aller-retour éclair vers une autre fenêtre n'est pas une absence : on a vu ce qui
 * passait à l'écran. Sans ce seuil, chaque Alt + Tab marquerait des détections « non vues ».
 */
export const ABSENCE_MIN_MS = 15_000;
/** Assez pour une journée de va-et-vient ; au-delà, les plus anciennes se fondent ensemble. */
export const ABSENCES_MAX = 24;
/** Le bandeau ne montre que la journée : une absence plus vieille que deux jours ne sert plus. */
const PEREMPTION_MS = 2 * 86_400_000;

export interface Absence {
  de: number;
  /** null : l'absence dure encore. */
  a: number | null;
}

export interface EtatAbsence {
  /** Les absences pas encore regardées, la plus ancienne en tête ; la dernière peut durer. */
  absences: Absence[];
  /** Le dernier instant où l'on te savait là. */
  derniereVue: number;
}

export const enCours = (e: EtatAbsence) => e.absences.length > 0 && e.absences[e.absences.length - 1].a === null;

/** Tu n'es plus là depuis `depuis` — le dernier signe de présence. */
export function partir(e: EtatAbsence, depuis: number): EtatAbsence {
  if (enCours(e)) return e;
  const absences = [...e.absences];
  const derniere = absences[absences.length - 1];
  // Repartir avant la fin de la précédente : c'est la même absence, qui reprend.
  if (derniere && derniere.a !== null && depuis <= derniere.a) {
    absences[absences.length - 1] = { de: derniere.de, a: null };
  } else {
    absences.push({ de: depuis, a: null });
  }
  while (absences.length > ABSENCES_MAX) {
    const [premiere, seconde] = absences;
    absences.splice(0, 2, { de: premiere.de, a: seconde.a });
  }
  return { ...e, absences };
}

/** Te revoilà, à `instant`. Une absence trop brève s'efface d'elle-même. */
export function revenir(e: EtatAbsence, instant: number): EtatAbsence {
  if (!enCours(e)) return { ...e, derniereVue: Math.max(e.derniereVue, instant) };
  const absences = e.absences.slice(0, -1);
  const derniere = e.absences[e.absences.length - 1];
  if (instant - derniere.de >= ABSENCE_MIN_MS) absences.push({ de: derniere.de, a: instant });
  return { absences, derniereVue: Math.max(e.derniereVue, instant) };
}

/** Tu as regardé : les absences finies ne marquent plus rien. */
export function vu(e: EtatAbsence): EtatAbsence {
  return { ...e, absences: e.absences.filter((a) => a.a === null) };
}

/** La détection est-elle tombée pendant une absence pas encore regardée ? */
export function pendantAbsence(e: EtatAbsence, debut: number | null): boolean {
  if (debut === null) return false;
  return e.absences.some((a) => a.de <= debut && (a.a === null || debut <= a.a));
}

/**
 * Ce que le bandeau en dit : combien de détections, et de quand à quand (la plus ancienne et
 * la plus récente des absences qui en contiennent). `a` null : l'absence dure encore.
 */
export function resumeAbsence(e: EtatAbsence, detections: { debut: number | null }[]) {
  const touchees = e.absences.filter((a) => detections.some((d) => d.debut !== null
    && a.de <= d.debut && (a.a === null || d.debut <= a.a)));
  const nombre = detections.filter((d) => pendantAbsence(e, d.debut)).length;
  if (!nombre || !touchees.length) return { nombre: 0, de: null, a: null };
  return { nombre, de: touchees[0].de, a: touchees[touchees.length - 1].a };
}

/**
 * L'état au lancement, depuis ce que le stockage gardait — qui peut être abîmé, ou absent.
 * L'application fermée est une absence : de la dernière présence connue jusqu'à maintenant.
 */
export function auLancement(stocke: unknown, instant: number): EtatAbsence {
  const lu = stocke && typeof stocke === 'object' ? stocke as Partial<EtatAbsence> : {};
  const fini = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
  const borne = (n: number) => Math.min(n, instant);
  let absences: Absence[] = Array.isArray(lu.absences)
    ? lu.absences.filter((a): a is Absence => Boolean(a) && fini(a.de) && (a.a === null || fini(a.a)) && (a.a === null || a.a >= a.de))
      .map((a) => ({ de: borne(a.de), a: a.a === null ? null : borne(a.a) }))
      .filter((a) => instant - (a.a ?? instant) < PEREMPTION_MS)
      .sort((x, y) => x.de - y.de)
    : [];
  let e: EtatAbsence = { absences, derniereVue: fini(lu.derniereVue) ? borne(lu.derniereVue) : instant };
  // Une absence en cours à la fermeture a duré jusqu'à maintenant ; sinon, la fermeture en ouvre une.
  if (!enCours(e) && fini(lu.derniereVue)) e = partir(e, e.derniereVue);
  e = revenir(e, instant);
  absences = e.absences.slice(-ABSENCES_MAX);
  return { absences, derniereVue: instant };
}
