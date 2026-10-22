/**
 * Le durcissement de ce qui est livre : la politique de contenu de la page, et les fusibles
 * de l'executable.
 *
 * Les fusibles d'Electron sont des interrupteurs graves DANS l'executable, que rien ne
 * rallume a l'execution — ni une variable d'environnement, ni un argument. Audit du
 * 22.10.2026 : celui de la 2.29.3 portait les reglages d'usine (relus). Sur un banc
 * empaquete a l'identique, ELECTRON_RUN_AS_NODE=1 en faisait un Node.js complet — signe de
 * notre certificat —, --inspect lui ouvrait un debogueur, et rien ne verifiait l'app.asar
 * pose a cote de lui. Rien de cela ne sert Alcora.
 *
 * Les fusibles se posent APRES l'empaquetage (l'empreinte de l'asar y est inscrite) et AVANT
 * la signature (la signature couvre les octets du fusible).
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const ETATS = { 48: 'eteint', 49: 'allume', 114: 'retire', 50: 'herite' };

/**
 * Ce que l'archive de l'application emporte, en LISTE BLANCHE.
 *
 * L'empaqueteur prend tout v2/desktop, sauf ce qu'une liste d'exclusions ecarte. Un fichier
 * oublie la — un journal de developpement, une configuration, un vidage — partirait donc
 * chez chaque utilisateur. Constate le 22.10.2026 : « electron.log » etait dans l'archive
 * de la 2.29.3 (vide, par chance). On n'enumere plus ce qu'il faut exclure, on verifie ce
 * qui est entre.
 *
 * @param {(id: string) => any} requireDesktop
 * @param {string} archive  chemin de app.asar
 * @returns {string[]}      les entrees de premier niveau qui n'ont rien a faire la
 */
export function intrusDansArchive(requireDesktop, archive) {
  const asar = requireDesktop('@electron/asar');
  const admis = (nom) => ['package.json', 'assets', 'protect', 'ui'].includes(nom)
    || (/^[a-z][a-z0-9-]*\.js$/.test(nom) && !nom.startsWith('test-'));
  // La bibliotheque garde l'en-tete de chaque archive en memoire, PAR CHEMIN : une archive
  // reconstruite au meme endroit dans le meme processus serait lue dans son etat precedent.
  // Le banc d'essai s'y est trompe le 22.10.2026.
  asar.uncache(archive);
  const premiers = new Set(asar.listPackage(archive).map((f) => f.split(/[\\/]/).find(Boolean)));
  return [...premiers].filter((nom) => !admis(nom)).sort();
}

/**
 * La politique de contenu de la page LIVREE.
 *
 * Le greffon de v2/web/vite.config.ts la resserre et echoue si son ancre disparait. Mais
 * s'il disparaissait LUI de la configuration, la construction passerait sans un mot, avec
 * la politique laxiste du developpement. On relit donc le resultat, pas l'intention.
 *
 * @param {string} html  index.html construit
 * @returns {string[]}   les defauts trouves ; vide si la politique est stricte
 */
export function defautsPolitique(html) {
  const csp = html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]*)"/)?.[1];
  if (csp === undefined) return ['aucune politique de contenu dans la page'];
  const directives = new Map(csp.split(';').map((d) => d.trim().split(/\s+/)).filter((d) => d[0])
    .map(([nom, ...valeurs]) => [nom, valeurs]));
  const defauts = [];
  const scripts = directives.get('script-src') ?? directives.get('default-src');
  if (!scripts) defauts.push('aucune directive pour les scripts');
  else {
    for (const v of ["'unsafe-inline'", "'unsafe-eval'", '*', 'data:', 'blob:']) {
      if (scripts.includes(v)) defauts.push(`script-src admet ${v}`);
    }
  }
  if (/localhost/.test(csp)) defauts.push('la politique admet encore localhost (developpement)');
  return defauts;
}

/*
 * TOUS les fusibles sont tranches, y compris ceux que l'on laisse a leur reglage d'usine
 * (releve sur Electron 44.9.3) : `strictlyRequireAllFuses` fait echouer la construction le
 * jour ou une version d'Electron en ajoute un. Un interrupteur apparu allume sans que nous
 * l'ayons regarde, c'est exactement ainsi que MoQ a echappe a la configuration du relais.
 */
function reglages(FuseV1Options, { integrite }) {
  return {
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.EnableCookieEncryption]: true,
    [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
    // Documentee pour Windows et macOS seulement : la construction Linux la laisse eteinte
    // (jamais essaye de l'allumer sous Linux).
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: integrite,
    // Reglages d'usine, gardes tels quels.
    [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: false,
    [FuseV1Options.WasmTrapHandlers]: true,
  };
}

/**
 * Pose les fusibles, puis les RELIT dans le fichier : une ecriture que l'on n'a pas relue
 * n'est qu'une intention.
 *
 * @param {(id: string) => any} requireDesktop  require ancre dans v2/desktop
 * @param {string} exe                           executable empaquete
 * @param {{ integrite: boolean }} options
 * @returns {Promise<string[]>}                  les fusibles relus, pour le compte rendu
 */
export async function poserFusibles(requireDesktop, exe, { integrite }) {
  const { flipFuses, getCurrentFuseWire, FuseVersion, FuseV1Options } = requireDesktop('@electron/fuses');
  const voulu = reglages(FuseV1Options, { integrite });
  await flipFuses(exe, {
    version: FuseVersion.V1,
    strictlyRequireAllFuses: true,
    resetAdHocDarwinSignature: false,
    ...voulu,
  });

  const relu = await getCurrentFuseWire(exe);
  const ecarts = [];
  const lignes = [];
  for (const [cle, valeur] of Object.entries(voulu)) {
    const attendu = valeur ? 49 : 48;
    const lu = relu[cle];
    const nom = FuseV1Options[cle];
    lignes.push(`${nom} : ${ETATS[lu] ?? lu}`);
    if (lu !== attendu) ecarts.push(`${nom} : attendu ${ETATS[attendu]}, lu ${ETATS[lu] ?? lu}`);
  }
  if (ecarts.length) throw new Error(`fusibles mal poses :\n  ${ecarts.join('\n  ')}`);
  return lignes;
}

/*
 * Les sondes : l'executable fusible, lance pour de vrai.
 *
 * Chacune passe « --veloapp-install », le rappel que l'installeur envoie : main.js le
 * traite en toute premiere ligne et rend la main SANS ouvrir de fenetre ni toucher aux
 * donnees. Une sortie a 0 prouve donc deux choses a la fois : l'asar a ete charge (sinon
 * main.js n'aurait pas tourne), et son empreinte a ete acceptee (sinon Electron s'arrete
 * net avant le moindre code).
 */
function lancer(exe, args, env = {}) {
  // RETIRER, jamais vider : Electron ne regarde que la PRESENCE de ELECTRON_RUN_AS_NODE.
  // Une premiere version la posait a '' pour la neutraliser, et faisait de chaque sonde un
  // Node.js (22.10.2026). Windows ignore la casse des noms : on compare en majuscules.
  const propre = Object.fromEntries(Object.entries(process.env)
    .filter(([k]) => !['ELECTRON_RUN_AS_NODE', 'NODE_OPTIONS'].includes(k.toUpperCase())));
  const r = spawnSync(exe, [...args, '--veloapp-install'], {
    env: { ...propre, ...env },
    encoding: 'utf8',
    timeout: 60_000,
    windowsHide: true,
  });
  return { statut: r.status, sortie: `${r.stdout ?? ''}${r.stderr ?? ''}`, erreur: r.error };
}

/*
 * Apres la sortie de l'application, ses processus annexes (Chromium en lance plusieurs, du
 * meme executable) le tiennent encore ouvert un instant. La signature, juste derriere,
 * echouerait alors sur un fichier verrouille — constate le 22.10.2026 sur le banc d'essai,
 * en reposant des fusibles sur un executable qui venait de tourner.
 */
async function attendreLiberation(exe, delaiMs = 30_000) {
  const fin = Date.now() + delaiMs;
  for (;;) {
    try {
      fs.closeSync(fs.openSync(exe, 'r+'));
      return;
    } catch (e) {
      if (!['EBUSY', 'EPERM', 'EACCES'].includes(e.code) || Date.now() > fin) throw e;
      await new Promise((r) => setTimeout(r, 250));
    }
  }
}

/**
 * @param {string} exe
 * @returns {Promise<{ sonde: string, ok: boolean, detail: string }[]>}
 */
export async function eprouverExecutable(exe) {
  const resultats = [];
  const noter = (sonde, ok, detail) => resultats.push({ sonde, ok, detail });

  const base = lancer(exe, []);
  noter('l application demarre depuis son asar et rend la main', base.statut === 0,
    `code ${base.statut}${base.erreur ? `, ${base.erreur.code}` : ''}`);

  // En mode Node, l'executable refuse « --veloapp-install » comme option inconnue (code 9,
  // mesure sur l'executable d'usine) ; en application, main.js voit le rappel de
  // l'installeur et sort sur 0. Seul 0 est un succes.
  const node = lancer(exe, ['-e', 'process.exit(42)'], { ELECTRON_RUN_AS_NODE: '1' });
  noter('ELECTRON_RUN_AS_NODE n en fait pas un Node.js', node.statut === 0, `code ${node.statut}`);

  /*
   * Pas de sonde pour NODE_OPTIONS : une application empaquetee l'ignore DEJA, fusible ou
   * non (Electron n'en garde que deux options HTTP). Essaye le 22.10.2026 : la sonde
   * passait sur l'executable d'usine, elle ne pouvait donc jamais rougir. Ce fusible-la
   * n'est prouve que par la relecture de poserFusibles — il ferme la porte qu'ouvrirait un
   * futur changement d'Electron.
   */

  const inspect = lancer(exe, ['--inspect=127.0.0.1:0']);
  const ecoute = /Debugger listening/i.test(inspect.sortie);
  noter('--inspect n ouvre aucun debogueur', inspect.statut === 0 && !ecoute,
    `code ${inspect.statut}${ecoute ? ', debogueur ouvert' : ''}`);

  await attendreLiberation(exe);
  return resultats;
}
