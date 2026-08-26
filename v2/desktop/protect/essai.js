'use strict';

/**
 * Un test de connexion reussi est-il REUTILISABLE pour l'enregistrement qui suit ?
 *
 * POURQUOI CE FICHIER EXISTE. Le 26.08.2026, configurer Alcora sur une console en
 * Protect 7.2.105 echouait en 503. Le journal a montre la cause : « Vérifier la
 * connexion » ouvrait une session, puis l'enregistrement s'authentifiait DEUX fois de
 * plus — une sonde d'empreinte, puis la connexion reelle — en moins de cinq secondes.
 * La console bride cette cadence : 403, puis 429. Le compte, lui, avait tous les droits.
 *
 * La reponse est de reutiliser la session que le test vient d'obtenir. Mais la reutiliser
 * A TORT serait pire que de se reconnecter : une session ouverte pour une autre console
 * ou un autre compte donnerait un 401 quelques instants plus tard, loin de sa cause.
 * D'ou cette fonction, pure et eprouvable sans Electron.
 */

/** Au-dela, on prefere une session neuve : l'utilisateur a pu changer d'avis entre-temps. */
const FRAICHEUR_MS = 600_000;

/**
 * @param {{host: string, username: string, a: number, client: {session: {usable: boolean}}}|null} essai
 * @param {{host: string, username: string}} identifiants
 * @param {number} [maintenantMs]
 * @returns {object|null} l'essai s'il convient, sinon null
 */
function essaiUtilisable(essai, identifiants, maintenantMs = Date.now()) {
  if (!essai || !identifiants) return null;
  // Meme console. Une session est un cookie : elle ne vaut que pour l'hote qui l'a emise.
  if (essai.host !== identifiants.host) return null;
  // Meme compte. Demarrer sous une identite que l'utilisateur vient de remplacer
  // fonctionnerait — et c'est precisement ce qui le rendrait indetectable.
  if (essai.username !== identifiants.username) return null;
  /*
   * MEMES identifiants, au caractere pres.
   *
   * L'ecran de configuration ne reinitialise pas son verdict quand un champ change : on
   * peut donc verifier avec un mot de passe, le modifier, puis enregistrer. Reutiliser la
   * session du test ENREGISTRERAIT alors le nouveau sans l'avoir jamais eprouve, et
   * l'echec n'apparaitrait qu'au demarrage suivant — loin de sa cause. Les identifiants
   * sont lus sur le client lui-meme : rien n'en est recopie ailleurs.
   */
  const c = essai.client?.credentials;
  if (!c) return null;
  if (c.password !== identifiants.password) return null;
  if ((c.totpSeed ?? null) !== (identifiants.totpSeed ?? null)) return null;

  if (!Number.isFinite(essai.a) || maintenantMs - essai.a > FRAICHEUR_MS) return null;
  // Une session expirante n'evite rien : autant se reconnecter maintenant, en pleine
  // configuration, plutot que dans dix secondes au milieu du demarrage.
  if (!essai.client?.session?.usable) return null;
  return essai;
}

module.exports = { essaiUtilisable, FRAICHEUR_MS };
