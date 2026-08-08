import { cpSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Met le guide d'activation du RTSP a portee de l'interface.
 *
 * Le guide vit dans « site/ » — c'est une page web, et le site le publie. Mais
 * l'application l'affiche AUSSI, dans un cadre integre a son ecran de connexion, et
 * Alcora ne depend d'aucun acces a Internet : pointer alcora.ch laisserait sans reponse
 * exactement la personne qui en a besoin, celle dont les cameras ne diffusent pas encore.
 *
 * D'ou cette copie vers « v2/web/public/ », que Vite embarque dans l'interface. UNE seule
 * source committee : deux exemplaires finiraient par diverger, et c'est toujours celui
 * qu'on ne relit pas qui reste faux. La copie est ignoree par git.
 *
 * Appelee par les trois chaines — construction Windows, construction Linux, et
 * developpement : sans elle, `npm run web` afficherait un cadre vide sur un depot frais.
 *
 * @param {string} racine  racine du depot
 * @param {string} web     dossier de l'interface (v2/web)
 * @returns {number} taille du guide, en octets
 */
export function embarquerGuide(racine, web) {
  const source = path.join(racine, 'site', 'guide-rtsp.html');
  if (!existsSync(source)) {
    throw new Error(`Guide introuvable : ${source}`);
  }
  cpSync(source, path.join(web, 'public', 'guide-rtsp.html'));
  return statSync(source).size;
}
