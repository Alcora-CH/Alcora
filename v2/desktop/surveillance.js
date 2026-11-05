'use strict';

/**
 * Garder la page en vie.
 *
 * POURQUOI CE FICHIER EXISTE. Le 05.10.2026, le mur d'images du poste de reference est
 * reste fige trente-cinq minutes sans un mot. La chaine, relevee au debogueur :
 *
 *   12:43:00  Windows epuise sa memoire virtuelle (un node.exe etranger a Alcora en
 *             reservait 232 Go).
 *   12:43:04  Le service reseau de Chromium plante sur une allocation refusee. Toutes les
 *             connexions WebRTC de la page meurent avec lui.
 *   12:43:12  Les tuiles constatent le gel et relancent. La relance ferme l'ancienne
 *             connexion : pc.close() attend le fil de signalisation, qui attend le fil
 *             reseau, qui attend la liberation du decodeur materiel, qui attend une
 *             allocation de memoire graphique dont la reponse s'est perdue. Appel
 *             synchrone sans delai de garde : la page entiere est bloquee, pour toujours.
 *
 * La page ne peut pas s'en sortir seule : l'interblocage est dans Chromium, et le premier
 * geste de reprise y entre. C'est donc le processus principal qui tranche, de trois facons.
 *
 *   1. Le service reseau meurt  -> on ABAT la page tout de suite, AVANT qu'une tuile
 *      n'appelle pc.close(), puis on la recharge. Toutes ses connexions sont mortes de
 *      toute facon : deux secondes de noir valent mieux qu'un gel indefini.
 *   2. La page meurt            -> on la recharge, dans la limite d'un budget.
 *   3. La page ne repond plus   -> un battement le constate et l'on revient au 1.
 *   4. Le GPU meurt             -> on attend qu'il se calme, puis on revient au 1. La page
 *      vit encore, mais elle a perdu le decodage materiel pour de bon (voir gpuPerdu).
 *
 * Tout est pur ici : ni Electron ni minuterie, donc eprouvable par test-surveillance.js.
 */

/** Toutes les combien on demande a la page si elle repond. */
const PERIODE_BATTEMENT_MS = 15_000;

/** Delai au-dela duquel une sonde est tenue pour sans reponse. */
const DELAI_REPONSE_MS = 15_000;

/**
 * Sondes sans reponse D'AFFILEE avant d'abattre.
 *
 * Deux, et pas une : une seule sonde manquee peut tomber sur un reveil de veille, une
 * page en plein chargement, un ramasse-miettes long. Deux d'affilee font trente secondes
 * de silence — sur une page dont le fil principal ne fait presque rien, ce n'est plus une
 * lenteur, c'est une panne.
 */
const RATES_AVANT_ABATTAGE = 2;

/** Budget de rechargements : au plus tant... */
const RECHARGEMENTS_MAX = 3;
/** ...sur cette duree glissante. */
const FENETRE_RECHARGEMENTS_MS = 5 * 60_000;

/**
 * Silence exige du GPU avant de relancer la page.
 *
 * Une reinstallation du pilote fait tomber le GPU, puis continue plusieurs secondes :
 * relancer tout de suite, c'est risquer de recharger la page sur un pilote encore en place,
 * sans decodeur. Chaque nouvelle mort remet ce delai a zero.
 */
const DELAI_APRES_GPU_MS = 5_000;

/**
 * Le filet « images recues, aucune decodee » : l'attente exigee avant chaque essai.
 *
 * Deux essais seulement : le premier rattrape un GPU revenu en retard, le second un pilote
 * encore en place au premier. Au-dela, le poste n'a sans doute pas ce decodeur du tout, et
 * relancer ne ferait que clignoter le mur : la tuile dit alors ce qui manque.
 */
const PALIERS_DECODEUR_MS = [0, 10 * 60_000];
/** Un essai plus vieux que cela ne compte plus : la panne d'aujourd'hui en est une autre. */
const OUBLI_DECODEUR_MS = 24 * 60 * 60_000;

/**
 * Nom lisible d'un processus enfant disparu, pour le journal.
 *
 * Electron fournit le nom du service, et le journal l'omettait : « Utility gone: crashed »
 * ne disait pas lequel. Il a fallu lire la ligne de commande du remplacant pour apprendre
 * que c'etait le service reseau — une piste qu'un journal complet aurait donnee d'emblee.
 */
function nomDuProcessus(details) {
  if (!details) return 'unknown process';
  const type = details.type ?? 'unknown';
  const precis = details.serviceName || details.name;
  return precis ? `${type} (${precis})` : String(type);
}

/**
 * Faut-il abattre la page apres la mort de CE processus enfant ?
 *
 * Seulement le service reseau : c'est lui qui porte les connexions WebRTC, et sa mort est
 * la seule dont on ait PROUVE qu'elle mene a l'interblocage. Le service audio, la capture
 * video ou un service de stockage peuvent tomber sans couper une seule image : abattre la
 * page pour eux couterait un ecran noir pour rien. Une sortie propre n'est jamais une
 * panne.
 */
function faireTomberLaPage(details) {
  if (!details || details.type !== 'Utility') return false;
  if (details.reason === 'clean-exit') return false;
  const nom = `${details.serviceName ?? ''} ${details.name ?? ''}`;
  return /NetworkService|Network Service/.test(nom);
}

/**
 * Le processus GPU vient-il de disparaitre ?
 *
 * Le 05.11.2026, l'installeur du pilote NVIDIA a fait tomber le GPU (exit 0x22). Chromium le
 * relance, mais la page garde ses decodeurs morts : H.264 repart en decodage logiciel, trois
 * fois plus lourd, et H.265, qui n'a PAS de decodeur logiciel, ne decode plus une seule
 * image. Rouvrir la connexion ne sert a rien : les images arrivent, rien ne les decode.
 * La camera est restee noire sous un « Connexion… » sans fin, jusqu'au redemarrage.
 *
 * Eprouve au banc (voir scripts/banc-decodage) : recharger la page repare tout en deux
 * secondes. Une sortie propre n'est jamais une panne.
 */
function gpuPerdu(details) {
  return details?.type === 'GPU' && details.reason !== 'clean-exit';
}

/**
 * Faut-il recharger une page qui vient de disparaitre ?
 *
 * Non si elle s'est fermee normalement, ou si l'application est en train de quitter :
 * recharger une fenetre qu'on ferme la ferait renaitre sous les doigts de l'utilisateur.
 */
function fautIlRecharger(details, enFermeture) {
  if (enFermeture) return false;
  return details?.reason !== 'clean-exit';
}

/**
 * Le budget de rechargements, sur une fenetre glissante.
 *
 * Sans lui, une page qui plante des son chargement — un fichier abime, un pilote graphique
 * a l'agonie — serait rechargee en boucle serree, pour toujours, en saturant le processeur.
 * Avec lui : trois essais rapides, puis un essai chaque fois qu'une place se libere.
 *
 * @returns {{ permis: boolean, historique: number[], attenteMs: number }}
 *   attenteMs : si refuse, delai avant qu'une place se libere.
 */
function rechargement(historique, maintenantMs, {
  max = RECHARGEMENTS_MAX,
  fenetreMs = FENETRE_RECHARGEMENTS_MS,
} = {}) {
  const recents = (historique ?? [])
    .filter((t) => Number.isFinite(t) && t <= maintenantMs && maintenantMs - t < fenetreMs);
  if (recents.length < max) {
    return { permis: true, historique: [...recents, maintenantMs], attenteMs: 0 };
  }
  const plusAncien = Math.min(...recents);
  return {
    permis: false,
    historique: recents,
    attenteMs: Math.max(1_000, plusAncien + fenetreMs - maintenantMs),
  };
}

/**
 * Une tuile recoit des images et n'en decode aucune : peut-on encore relancer la page ?
 *
 * Budget a part, bien plus avare que celui des pannes : ici, la page va bien, et le defaut
 * peut etre permanent — un poste sans decodeur H.265 demanderait une relance a chaque
 * demi-minute, pour toujours, et ferait clignoter les cameras qui marchent.
 *
 * @returns {{ permis: boolean, historique: number[] }}
 */
function rechargementDecodeur(historique, maintenantMs, {
  paliers = PALIERS_DECODEUR_MS,
  oubliMs = OUBLI_DECODEUR_MS,
} = {}) {
  const recents = (historique ?? [])
    .filter((t) => Number.isFinite(t) && t <= maintenantMs && maintenantMs - t < oubliMs);
  if (recents.length >= paliers.length) return { permis: false, historique: recents };
  const dernier = recents.length ? Math.max(...recents) : -Infinity;
  if (maintenantMs - dernier < paliers[recents.length]) return { permis: false, historique: recents };
  return { permis: true, historique: [...recents, maintenantMs] };
}

/**
 * Le compte des sondes manquees d'affilee, et la decision qui en decoule.
 *
 * Une reponse remet le compte a zero : seules les sondes CONSECUTIVES comptent, sans quoi
 * quelques lenteurs isolees sur une journee finiraient par abattre une page en parfaite
 * sante.
 */
function apresSonde(ratesAvant, repondu, seuil = RATES_AVANT_ABATTAGE) {
  if (repondu) return { rates: 0, abattre: false };
  const rates = (Number.isFinite(ratesAvant) ? ratesAvant : 0) + 1;
  if (rates >= seuil) return { rates: 0, abattre: true };
  return { rates, abattre: false };
}

module.exports = {
  PERIODE_BATTEMENT_MS, DELAI_REPONSE_MS, RATES_AVANT_ABATTAGE,
  RECHARGEMENTS_MAX, FENETRE_RECHARGEMENTS_MS,
  DELAI_APRES_GPU_MS, PALIERS_DECODEUR_MS, OUBLI_DECODEUR_MS,
  nomDuProcessus, faireTomberLaPage, gpuPerdu, fautIlRecharger, rechargement,
  rechargementDecodeur, apresSonde,
};
