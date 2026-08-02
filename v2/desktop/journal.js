'use strict';

const fs = require('node:fs');
const path = require('node:path');

/**
 * Journal de diagnostic.
 *
 * Raison d'etre : l'application tourne aussi chez quelqu'un qui ne saura pas decrire une
 * panne. « Envoie-moi le fichier journal.txt » doit suffire a comprendre. Tout part donc
 * dans UN seul fichier — processus principal et page confondus — et rien n'est filtre.
 *
 * Contraintes tenues :
 *  - n'echoue jamais : un journal qui leve une exception casserait ce qu'il observe ;
 *  - ne grossit pas indefiniment : rotation a 2 Mo, une generation conservee.
 */

const TAILLE_MAX = 2 * 1024 * 1024;

let fichier = null;
let precedent = null;

/** @param {string} dossier dossier de donnees de l'application */
function ouvrir(dossier) {
  fichier = path.join(dossier, 'journal.txt');
  precedent = path.join(dossier, 'journal-precedent.txt');
  try { fs.mkdirSync(dossier, { recursive: true }); } catch { /* deja la */ }
}

function tourner() {
  try {
    if (fs.statSync(fichier).size < TAILLE_MAX) return;
    fs.rmSync(precedent, { force: true });
    fs.renameSync(fichier, precedent);
  } catch { /* fichier absent : rien a faire */ }
}

/**
 * @param {'info'|'alerte'|'erreur'} niveau
 * @param {string} sujet  d'ou vient la ligne, en un mot
 * @param {string} message
 */
function ecrire(niveau, sujet, message) {
  // Le journal est en ANGLAIS — la langue des rapports de defaut d'un projet ouvert.
  // Les fonctions gardent leurs noms francais (info/alerte/erreur) : c'est du code.
  const NIVEAUX = { info: 'info', alerte: 'warn', erreur: 'error' };
  const ligne = `${new Date().toISOString()} ${(NIVEAUX[niveau] ?? niveau).padEnd(6)} ${sujet.padEnd(12)} ${message}\n`;

  // En developpement la console est visible et immediate ; on ne s'en prive pas.
  if (!fichier || process.env.PROTECTVIEWER_DEV_URL) process.stdout.write(ligne);

  if (!fichier) return;
  try {
    tourner();
    fs.appendFileSync(fichier, ligne, 'utf8');
  } catch { /* un journal qui echoue ne doit rien casser */ }
}

const info = (sujet, message) => ecrire('info', sujet, message);
const alerte = (sujet, message) => ecrire('alerte', sujet, message);
const erreur = (sujet, message) => ecrire('erreur', sujet, message);

/** Met en forme une exception sans jamais lever a son tour. */
function deErreur(e) {
  if (!e) return 'erreur inconnue';
  if (e instanceof Error) return `${e.name}: ${e.message}\n${e.stack ?? ''}`.trimEnd();
  try { return String(e); } catch { return 'erreur non representable'; }
}

module.exports = { ouvrir, ecrire, info, alerte, erreur, deErreur, chemin: () => fichier };
