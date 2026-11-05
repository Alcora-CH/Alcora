/**
 * Les flux du direct : la reserve (v2/web/src/video/reserve.ts) et la sante d'un flux
 * (v2/web/src/video/sante.ts), lues dans leur source meme.
 *
 *   node test-flux.mjs
 *
 * Ajoutee le 05.11.2026. Ce qui est garde : revenir sur le direct ne rouvre rien ; une session
 * morte ne se rend jamais a une tuile ; rien ne reste ouvert indefiniment, ni au-dela d'un
 * plafond ; masquer une camera la coupe pour de bon ; le decodeur manquant se distingue d'un
 * flux qui demarre et d'un flux coupe en amont.
 */

import { creerReserve, GARDE_MS, SANS_PRENEUR_MAX } from '../web/src/video/reserve.ts';
import {
  attenteReprise, causeDeReprise, constatDeGel, lireDecodage, nomCodec, sansDecodeur,
} from '../web/src/video/sante.ts';

let echecs = 0;
function check(label, attendu, obtenu) {
  const ok = JSON.stringify(attendu) === JSON.stringify(obtenu);
  if (!ok) echecs++;
  console.log(`${ok ? '  OK  ' : ' ECHEC'}  ${label}`);
  if (!ok) {
    console.log(`          attendu = ${JSON.stringify(attendu)}`);
    console.log(`          obtenu  = ${JSON.stringify(obtenu)}`);
  }
}

/** Une fausse session : on regarde seulement si elle a ete ouverte et fermee, et combien de fois. */
function banc(options = {}) {
  const ouvertes = [];
  const minuteurs = new Map();
  let prochain = 1;
  const reserve = creerReserve({
    connecter: async (url, autorisation) => {
      if (options.refuser?.(url)) throw new Error('refuse');
      const s = { url, autorisation, fermetures: 0, pc: { connectionState: 'connected' }, close() { s.fermetures += 1; } };
      ouvertes.push(s);
      return s;
    },
    poser: (rappel, ms) => { const id = prochain++; minuteurs.set(id, { rappel, ms }); return id; },
    retirer: (id) => { minuteurs.delete(id); },
    ...options.reglages,
  });
  const ecouler = () => { [...minuteurs.values()].forEach((m) => m.rappel()); minuteurs.clear(); };
  return { reserve, ouvertes, minuteurs, ecouler };
}

const URL_G5 = 'http://relais/g5_high/whep';
const URL_G6 = 'http://relais/g6_high/whep';

console.log('=== Revenir sur le direct ne rouvre rien ===');
{
  const { reserve, ouvertes, minuteurs } = banc();
  const a = await reserve.prendre(URL_G5, 'cle');
  check('la premiere prise ouvre une session', [1, true], [ouvertes.length, a.neuve]);
  a.rendre();
  check('la tuile part : la session reste ouverte', [0, 1], [ouvertes[0].fermetures, reserve.etat().sansPreneur]);
  check('elle est gardee le temps prevu', GARDE_MS, [...minuteurs.values()][0].ms);
  const b = await reserve.prendre(URL_G5, 'cle');
  check('le retour retrouve la MEME session', [1, false, true], [ouvertes.length, b.neuve, b.session === a.session]);
  check('le compte a rebours est annule au retour', 0, minuteurs.size);
}

console.log('\n=== Rien ne reste ouvert indefiniment ===');
{
  const { reserve, ouvertes, ecouler } = banc();
  (await reserve.prendre(URL_G5, 'cle')).rendre();
  ecouler();
  check('la garde ecoulee : la session se ferme', [1, 0], [ouvertes[0].fermetures, reserve.etat().sessions]);
  const n = await reserve.prendre(URL_G5, 'cle');
  check('la prise suivante en ouvre une autre', [2, true], [ouvertes.length, n.neuve]);
}
{
  // Le plafond : les plus anciennes partent d'abord, et pas celles qu'une tuile tient.
  const { reserve, ouvertes } = banc({ reglages: { sansPreneurMax: 2 } });
  const tenue = await reserve.prendre('http://relais/tenue/whep', 'cle');
  for (const nom of ['a', 'b', 'c']) (await reserve.prendre(`http://relais/${nom}/whep`, 'cle')).rendre();
  check('au-dela du plafond, la plus ancienne se ferme', 1, ouvertes.find((s) => s.url.includes('/a/')).fermetures);
  check('les plus recentes restent', [0, 0],
    [ouvertes.find((s) => s.url.includes('/b/')).fermetures, ouvertes.find((s) => s.url.includes('/c/')).fermetures]);
  check('celle qu\'une tuile tient n\'est jamais fermee', 0, tenue.session.fermetures);
  check('le plafond par defaut laisse un mur courant intact', true, SANS_PRENEUR_MAX >= 4);
}

console.log('\n=== Plusieurs tuiles, une seule session ===');
{
  const { reserve, ouvertes, minuteurs } = banc();
  const [a, b] = await Promise.all([reserve.prendre(URL_G5, 'cle'), reserve.prendre(URL_G5, 'cle')]);
  check('deux prises simultanees : une seule negociation', [1, true], [ouvertes.length, a.session === b.session]);
  a.rendre();
  check('tant qu\'une tuile la tient, pas de compte a rebours', 0, minuteurs.size);
  a.rendre();
  check('rendre deux fois ne vole pas la place de l\'autre', 0, minuteurs.size);
  b.rendre();
  check('la derniere partie, le compte a rebours commence', 1, minuteurs.size);
}

console.log('\n=== Une session qui ne livre plus se jette, pour tout le monde ===');
{
  const { reserve, ouvertes, minuteurs } = banc();
  const [a, b] = await Promise.all([reserve.prendre(URL_G5, 'cle'), reserve.prendre(URL_G5, 'cle')]);
  a.jeter();
  check('jetee : fermee tout de suite', [1, 0], [ouvertes[0].fermetures, reserve.etat().sessions]);
  const c = await reserve.prendre(URL_G5, 'cle');
  check('la reprise obtient une session NEUVE, pas la morte', [2, true], [ouvertes.length, c.neuve]);
  b.jeter();
  check('l\'autre tuile la jette a son tour : la neuve n\'en souffre pas', 0, c.session.fermetures);
  b.rendre();
  a.rendre();
  check('rendre apres avoir jete ne fait rien', 0, minuteurs.size);
  c.jeter();
  c.jeter();
  check('jeter deux fois reste sans effet sur la reserve', 0, reserve.etat().sessions);
}

console.log('\n=== Une session morte ne se rend jamais ===');
for (const etat of ['closed', 'failed', 'disconnected']) {
  const { reserve, ouvertes } = banc();
  (await reserve.prendre(URL_G5, 'cle')).rendre();
  ouvertes[0].pc.connectionState = etat;
  const b = await reserve.prendre(URL_G5, 'cle');
  check(`${etat} : on en rouvre une`, [2, true, 1], [ouvertes.length, b.neuve, ouvertes[0].fermetures]);
}
{
  const { reserve, ouvertes } = banc();
  (await reserve.prendre(URL_G5, 'ancienne')).rendre();
  const b = await reserve.prendre(URL_G5, 'nouvelle');
  check('le relais a redemarre (autre mot de passe) : session neuve', [2, 'nouvelle', 1],
    [ouvertes.length, b.session.autorisation, ouvertes[0].fermetures]);
}
{
  const { reserve } = banc({ refuser: () => true });
  let message = null;
  try { await reserve.prendre(URL_G5, 'cle'); } catch (e) { message = e.message; }
  check('une connexion refusee remonte a la tuile', 'refuse', message);
  check('et ne laisse rien dans la reserve', 0, reserve.etat().sessions);
}
{
  // La tuile part pendant la negociation et son rappel rend la prise des qu'elle arrive.
  const { reserve, ouvertes } = banc();
  const attente = reserve.prendre(URL_G5, 'cle');
  (await attente).rendre();
  check('une prise rendue des son arrivee reste en reserve, ouverte', [0, 1],
    [ouvertes[0].fermetures, reserve.etat().sansPreneur]);
}

console.log('\n=== Masquer une camera la coupe pour de bon ===');
{
  const { reserve, ouvertes, minuteurs } = banc();
  (await reserve.prendre(URL_G6, 'cle')).rendre();
  const g5 = await reserve.prendre(URL_G5, 'cle');
  reserve.oublier((url) => url.includes('/g6_'));
  check('la camera masquee est fermee sans attendre', [1, 0], [ouvertes[0].fermetures, minuteurs.size]);
  reserve.oublier((url) => url.includes('/g5_'));
  check('une session qu\'une tuile tient n\'est pas coupee', 0, g5.session.fermetures);
}

console.log('\n=== La sante d\'un flux : lire le navigateur ===');
{
  const rapport = new Map([
    ['A', { type: 'inbound-rtp', kind: 'audio', packetsReceived: 999, codecId: 'CA' }],
    ['V', { type: 'inbound-rtp', kind: 'video', framesDecoded: 12, framesReceived: 40, packetsReceived: 800, codecId: 'CV' }],
    ['CV', { type: 'codec', mimeType: 'video/H265' }],
  ]);
  check('le flux VIDEO, pas l\'audio', { decodees: 12, recues: 40, paquets: 800, codec: 'video/H265' }, lireDecodage(rapport));
  // Le navigateur ne promet aucun ordre : l'audio peut aussi venir apres.
  check('le flux VIDEO, meme si l\'audio est lu en dernier', { decodees: 12, recues: 40, paquets: 800, codec: 'video/H265' },
    lireDecodage(new Map([...rapport].reverse())));
  check('aucun flux video : rien a conclure', null, lireDecodage(new Map()));
  check('un rapport precoce vaut zero, sans erreur', { decodees: 0, recues: 0, paquets: 0, codec: null },
    lireDecodage(new Map([['V', { type: 'inbound-rtp', kind: 'video' }]])));
}

console.log('\n=== Le decodeur manquant : la signature du 05.11.2026 ===');
{
  // Releve au banc : apres la perte du GPU, H.265 donne dec=0 recu=300.
  check('des images recues, aucune decodee : le decodeur manque', true,
    sansDecodeur({ decodees: 0, recues: 300, paquets: 5848, codec: 'video/H265' }));
  check('une seule image decodee : le decodeur existe', false,
    sansDecodeur({ decodees: 1, recues: 300, paquets: 5848, codec: 'video/H265' }));
  check('rien de recu : c\'est la source, pas le decodeur', false,
    sansDecodeur({ decodees: 0, recues: 0, paquets: 0, codec: null }));
  check('quelques images : le flux attend peut-etre encore son image cle', false,
    sansDecodeur({ decodees: 0, recues: 10, paquets: 200, codec: 'video/H264' }));
  check('H.265 se dit comme Protect le dit', 'H.265', nomCodec('video/H265'));
  check('H.264 aussi', 'H.264', nomCodec('video/h264'));
  check('un autre codec garde son nom', 'AV1', nomCodec('video/AV1'));
  check('un codec inconnu ne fait pas planter', '?', nomCodec(null));
}

console.log('\n=== Le constat d\'un gel tranche entre la source et ce poste ===');
{
  const avant = { decodees: 100, recues: 100, paquets: 2000, codec: 'video/H265' };
  check('plus aucun paquet : en amont',
    'packets +0, received +0, decoded +0, codec H.265, ice disconnected',
    constatDeGel(avant, { ...avant }, 'disconnected'));
  check('des paquets et des images sans decodage : ce poste',
    'packets +900, received +50, decoded +0, codec H.265, ice connected',
    constatDeGel(avant, { ...avant, paquets: 2900, recues: 150 }, 'connected'));
  check('sans repere, on compte depuis zero',
    'packets +10, received +2, decoded +0, codec ?, ice new',
    constatDeGel(null, { decodees: 0, recues: 2, paquets: 10, codec: null }, 'new'));
}

console.log('\n=== Quand reprendre ===');
{
  const seuils = { gelMs: 6000, premiereImageMs: 12000 };
  const etat = (o) => ({ connexion: 'connected', demarre: true, immobileMs: 0, visible: true, ...o });
  check('un flux vivant : rien a faire', null, causeDeReprise(etat({ immobileMs: 1000 }), seuils));
  check('fige au-dela du seuil : plus d\'image', 'frames stopped', causeDeReprise(etat({ immobileMs: 7000 }), seuils));
  check('une montee reste plus patiente', null, causeDeReprise(etat({ demarre: false, immobileMs: 7000 }), seuils));
  check('mais pas indefiniment', 'no frame yet', causeDeReprise(etat({ demarre: false, immobileMs: 13000 }), seuils));
  check('fenetre masquee : on ne conclut rien', null, causeDeReprise(etat({ immobileMs: 99999, visible: false }), seuils));
  check('connexion echouee : tout de suite', 'connection failed', causeDeReprise(etat({ connexion: 'failed' }), seuils));
  check('session fermee par une autre tuile : tout de suite', 'connection closed', causeDeReprise(etat({ connexion: 'closed' }), seuils));
  const paliers = [1000, 2000, 4000];
  check('l\'attente croit puis plafonne', [1000, 2000, 4000, 4000],
    [0, 1, 2, 9].map((n) => attenteReprise(n, paliers, () => 0)));
}

console.log(`\n${echecs === 0 ? 'TOUS LES TESTS PASSENT' : `${echecs} TEST(S) EN ECHEC`}`);
process.exit(echecs === 0 ? 0 : 1);
