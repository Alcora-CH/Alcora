import type { WhepSession } from './whep';

/**
 * La reserve des flux : une session WHEP survit a la tuile qui l'a ouverte.
 *
 * Quitter le direct demontait le mur, donc fermait toutes les connexions. Y revenir les
 * rouvrait, et chaque tuile attendait la prochaine image cle de sa camera : deux a huit
 * secondes de « Connexion… » a chaque changement d'ecran (journal du 05.11.2026). Isoler une
 * camera en faisait autant a sa voisine.
 *
 * Mesure au banc le meme jour (scripts/banc-decodage) : une session gardee ouverte continue
 * de decoder sans aucune video branchee, et une tuile qui s'y rattache peint sa premiere
 * image en 40 a 60 ms.
 *
 * Pur : ni WebRTC ni page ici, la connexion et les minuteries sont fournies. Eprouve par
 * v2/desktop/test-flux.mjs.
 */

/** Combien de temps garder une session que plus aucune tuile n'utilise : une visite ailleurs. */
export const GARDE_MS = 10 * 60_000;

/**
 * Sessions gardees au plus sans tuile : les plus anciennes se ferment d'abord. Un grand mur
 * sur un petit poste ne doit pas garder seize decodeurs occupes pendant une relecture.
 */
export const SANS_PRENEUR_MAX = 8;

export interface PriseFlux {
  readonly session: WhepSession;
  /** Vrai si cette prise a ouvert la session ; faux si elle etait deja la, et vivante. */
  readonly neuve: boolean;
  /** La tuile s'en va : la session reste ouverte, prete pour le retour. */
  rendre(): void;
  /** La session ne livre plus rien : elle est fermee, pour toutes les tuiles qui la tiennent. */
  jeter(): void;
}

export interface OptionsReserve<M = unknown> {
  connecter: (url: string, autorisation: string) => Promise<WhepSession>;
  gardeMs?: number;
  sansPreneurMax?: number;
  poser?: (rappel: () => void, ms: number) => M;
  retirer?: (minuteur: M | undefined) => void;
}

interface Entree<M> {
  url: string;
  autorisation: string;
  attente: Promise<WhepSession>;
  session: WhepSession | null;
  preneurs: number;
  minuteur: M | undefined;
  /** Rang du dernier retour a la reserve : le plus petit est le plus ancien. */
  rendueAu: number;
}

/** Une session dans cet etat ne repartira pas : personne n'y est branche pour l'attendre. */
const ETATS_MORTS: readonly RTCPeerConnectionState[] = ['closed', 'failed', 'disconnected'];

export function creerReserve<M = ReturnType<typeof setTimeout>>({
  connecter,
  gardeMs = GARDE_MS,
  sansPreneurMax = SANS_PRENEUR_MAX,
  poser = ((rappel: () => void, ms: number) => setTimeout(rappel, ms)) as unknown as (rappel: () => void, ms: number) => M,
  retirer = ((m: M | undefined) => clearTimeout(m as ReturnType<typeof setTimeout>)) as unknown as (m: M | undefined) => void,
}: OptionsReserve<M>) {
  const entrees = new Map<string, Entree<M>>();
  let rang = 0;

  const fermer = (e: Entree<M>) => {
    if (entrees.get(e.url) === e) entrees.delete(e.url);
    retirer(e.minuteur);
    e.minuteur = undefined;
    // Encore en negociation : la session sera fermee a son arrivee, voir ouvrir().
    e.session?.close();
  };

  const ouvrir = (url: string, autorisation: string): Entree<M> => {
    const e: Entree<M> = {
      url, autorisation, session: null, preneurs: 0, minuteur: undefined, rendueAu: 0,
      attente: null as unknown as Promise<WhepSession>,
    };
    entrees.set(url, e);
    e.attente = connecter(url, autorisation).then(
      (session) => {
        e.session = session;
        // Retiree pendant la negociation : plus personne ne l'attend.
        if (entrees.get(url) !== e) session.close();
        return session;
      },
      (erreur: unknown) => {
        if (entrees.get(url) === e) entrees.delete(url);
        throw erreur;
      },
    );
    return e;
  };

  const borner = () => {
    const libres = [...entrees.values()]
      .filter((e) => e.preneurs === 0)
      .sort((a, b) => a.rendueAu - b.rendueAu);
    libres.slice(0, Math.max(0, libres.length - sansPreneurMax)).forEach(fermer);
  };

  return {
    async prendre(url: string, autorisation: string): Promise<PriseFlux> {
      let e = entrees.get(url);
      // Le relais a redemarre (nouveau mot de passe), ou la session est morte sans tuile.
      if (e && (e.autorisation !== autorisation
        || (e.session && ETATS_MORTS.includes(e.session.pc.connectionState)))) {
        fermer(e);
        e = undefined;
      }
      const neuve = !e;
      const entree = e ?? ouvrir(url, autorisation);
      retirer(entree.minuteur);
      entree.minuteur = undefined;
      entree.preneurs += 1;

      const session = await entree.attente;
      let rendue = false;
      const liberer = () => {
        if (rendue) return false;
        rendue = true;
        entree.preneurs -= 1;
        return true;
      };
      return {
        session,
        neuve,
        rendre() {
          if (!liberer() || entrees.get(url) !== entree || entree.preneurs > 0) return;
          entree.rendueAu = ++rang;
          entree.minuteur = poser(() => fermer(entree), gardeMs);
          borner();
        },
        jeter() {
          liberer();
          fermer(entree);
        },
      };
    },

    /** Ferme tout de suite les sessions sans tuile que ce filtre designe : camera masquee. */
    oublier(designe: (url: string) => boolean) {
      [...entrees.values()].filter((e) => e.preneurs === 0 && designe(e.url)).forEach(fermer);
    },

    /** Pour les verifications. */
    etat() {
      const toutes = [...entrees.values()];
      return { sessions: toutes.length, sansPreneur: toutes.filter((e) => e.preneurs === 0).length };
    },
  };
}
