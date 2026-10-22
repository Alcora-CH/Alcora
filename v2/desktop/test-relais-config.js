'use strict';

/**
 * La configuration du relais ne doit jamais rien ouvrir que l'on n'ait pas decide.
 *
 *   node test-relais-config.js
 *
 * Audit du 22.10.2026 (voir relais-config.js) : une API de controle ouverte a tous les
 * sites, un serveur MoQ ALLUME PAR DEFAUT sur toutes les interfaces que notre configuration
 * ignorait, une lecture video sans mot de passe. Le dernier point est le plus instructif :
 * on avait bien coupe RTSP, RTMP, HLS et SRT, un par un — et MediaMTX a ajoute un serveur.
 *
 * D'ou la regle centrale de cette suite : elle lit la configuration PAR DEFAUT du binaire
 * epingle, et exige que tout ce qui y est allume soit nomme dans la notre. Le jour ou une
 * version future ajoutera un serveur, ce test rougira avant que l'application ne l'ouvre.
 */

const fs = require('node:fs');
const path = require('node:path');
const R = require('./relais-config');

let failures = 0;
function checkBool(label, condition) {
  if (!condition) failures++;
  console.log(`${condition ? '  OK  ' : ' ECHEC'}  ${label}`);
}
function leve(fn) { try { fn(); return false; } catch { return true; } }

/** Les cles de premier niveau d'un YAML et leur valeur brute. */
function premierNiveau(texte) {
  const cles = new Map();
  for (const l of texte.split(/\r?\n/)) {
    const m = /^([A-Za-z0-9_]+):\s*(.*?)\s*$/.exec(l);
    if (m) cles.set(m[1], m[2]);
  }
  return cles;
}
const vrai = (v) => /^(true|yes|"true")$/.test(v);

const fichierDefaut = path.join(__dirname, `relais-defaut-${R.VERSION_RELAIS}.yml`);
const BASE = {
  ports: { webrtc: 18889, api: 19997, ice: 18189, iceTcp: 18289 },
  cameras: [{ path: 'camera_fictive_high', url: 'rtsp://192.0.2.10:7447/aliasFictif' }],
  identifiant: { utilisateur: 'alcora', motDePasse: 'mot-de-passe-fictif' },
  origines: ['app://viewer'],
};

console.log('=== La reference : la configuration par defaut du binaire epingle ===');
checkBool(`la configuration par defaut de ${R.VERSION_RELAIS} est dans le depot`, fs.existsSync(fichierDefaut));
const defaut = premierNiveau(fs.readFileSync(fichierDefaut, 'utf8'));
checkBool('elle se lit (plus de cent cles)', defaut.size > 100);

const allumesParDefaut = [...defaut].filter(([, v]) => vrai(v)).map(([k]) => k);
// Un serveur, c'est une cle booleenne qui possede au moins une adresse d'ecoute a son nom.
const serveursDuBinaire = [...defaut.keys()].filter((k) =>
  /^(true|false|yes|no)$/.test(defaut.get(k))
  && [...defaut.keys()].some((a) => a !== k && a.startsWith(k) && /^([A-Z][A-Za-z0-9]*)?Address$/.test(a.slice(k.length))));

checkBool(`serveurs connus du binaire : ${serveursDuBinaire.join(' ')}`, serveursDuBinaire.length >= 8);
for (const s of serveursDuBinaire) {
  checkBool(`le serveur « ${s} » est NOMME dans relais-config.js`, R.SERVEURS.includes(s));
}

console.log('\n=== Tout ce qui est allume par defaut est tranche chez nous ===');
const texte = R.configurationRelais(BASE);
const notre = premierNiveau(texte);
for (const k of allumesParDefaut) {
  checkBool(`« ${k} » (allume par defaut) est ecrit explicitement`, notre.has(k));
}

console.log('\n=== Un seul serveur : WebRTC ===');
for (const s of R.SERVEURS) {
  const attendu = s === 'webrtc';
  checkBool(`${s} : ${attendu ? 'allume' : 'eteint'}`, vrai(notre.get(s) ?? '') === attendu);
}
checkBool('aucune adresse d API n est ecrite quand l API est eteinte', !notre.has('apiAddress'));

console.log('\n=== Ecouter sur la boucle locale, sauf le chemin ICE ===');
for (const [k, v] of notre) {
  if (!k.endsWith('Address')) continue;
  const local = /^"127\.0\.0\.1:\d+"$/.test(v);
  if (k === 'webrtcLocalUDPAddress') {
    // Voulu et documente : le navigateur n'emet aucun candidat de boucle locale.
    checkBool(`${k} sur toutes les interfaces, comme documente`, /^":\d+"$/.test(v));
  } else {
    checkBool(`${k} ecoute en 127.0.0.1 (${v})`, local);
  }
}

console.log('\n=== Origines : celle de l interface, jamais « * » ===');
const p = R.parametresRelais(BASE);
checkBool('webrtcAllowOrigins = l origine de l interface', JSON.stringify(p.webrtcAllowOrigins) === '["app://viewer"]');
checkBool('« * » est ecarte meme s il est fourni',
  !R.parametresRelais({ ...BASE, origines: ['app://viewer', '*'] }).webrtcAllowOrigins.includes('*'));
checkBool('sans origine admise, le relais refuse de demarrer',
  leve(() => R.parametresRelais({ ...BASE, origines: ['*'] })));

console.log('\n=== Utilisateurs : jamais « any », lecture seule, boucle locale ===');
const users = p.authInternalUsers;
checkBool('un seul utilisateur', users.length === 1);
checkBool('jamais l utilisateur anonyme « any »', users.every((u) => u.user !== 'any'));
checkBool('un mot de passe est exige', users.every((u) => typeof u.pass === 'string' && u.pass.length > 0));
checkBool('depuis la boucle locale seulement',
  users.every((u) => u.ips.length > 0 && u.ips.every((ip) => ip === '127.0.0.1' || ip === '::1')));
checkBool('en LECTURE seule : ni publication, ni relecture, ni API',
  users.every((u) => u.permissions.every((x) => x.action === 'read')));
checkBool('sans identifiant, le relais refuse de demarrer',
  leve(() => R.parametresRelais({ ...BASE, identifiant: undefined })));
checkBool('le texte ne contient nulle part « any »', !/user:\s*"?any"?/.test(texte));

console.log('\n=== Le test manuel peut rallumer l API, et seulement lui ===');
const avecApi = R.parametresRelais({ ...BASE, api: true });
checkBool('API allumee sur demande, en boucle locale', avecApi.api === true && avecApi.apiAddress === '127.0.0.1:19997');
checkBool('...sans aucune origine etrangere', Array.isArray(avecApi.apiAllowOrigins) && avecApi.apiAllowOrigins.length === 0);
checkBool('...et derriere le mot de passe', avecApi.authInternalUsers[0].permissions.some((x) => x.action === 'api'));

console.log('\n=== Identifiant et en-tete ===');
const a = R.nouvelIdentifiant(), b = R.nouvelIdentifiant();
checkBool('deux lancements, deux mots de passe', a.motDePasse !== b.motDePasse);
checkBool('assez long pour ne pas se deviner (192 bits)', a.motDePasse.length >= 32);
checkBool('l en-tete est un Basic correct',
  R.autorisation({ utilisateur: 'u', motDePasse: 'p' }) === `Basic ${Buffer.from('u:p').toString('base64')}`);

console.log('\n=== Le YAML ne peut pas changer de sens ===');
const piege = R.configurationRelais({ ...BASE, identifiant: { utilisateur: 'alcora', motDePasse: `a: b # c' "d"` } });
checkBool('un mot de passe avec « : », « # » et des guillemets reste une seule valeur',
  piege.includes(JSON.stringify(`a: b # c' "d"`)));
checkBool('les chemins des cameras sont ecrits', texte.includes('camera_fictive_high:') && texte.includes('"rtsp://192.0.2.10:7447/aliasFictif"'));
checkBool('l en-tete nomme la version epinglee', texte.startsWith(`# Genere par Alcora pour MediaMTX ${R.VERSION_RELAIS}`));

console.log('\n' + (failures === 0 ? 'TOUS LES TESTS PASSENT' : `${failures} TEST(S) EN ECHEC`));
process.exit(failures === 0 ? 0 : 1);
