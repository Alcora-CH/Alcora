'use strict';

const fs = require('node:fs');
const path = require('node:path');

/**
 * Memoire de l'emplacement de la fenetre.
 *
 * Taille, position, etat (agrandie, plein ecran) : a la reouverture, la fenetre se remet
 * exactement ou elle etait — y compris sur le bon ecran d'un poste qui en a quatre.
 *
 * Le piege du multi-ecrans : un ecran debranche ou deplace laisse une position memorisee
 * qui ne correspond plus a aucun affichage. Restaurer aveuglement mettrait la fenetre hors
 * de vue, sans aucun moyen de la rattraper a la souris. D'ou positionSure() : la position
 * n'est reprise que si une part suffisante de la fenetre retombe sur un ecran encore
 * present ; sinon on laisse Windows centrer, comme au premier lancement.
 */

const FICHIER = 'fenetre.json';

/** Part minimale de la fenetre qui doit rester visible pour qu'une position soit reprise. */
const VISIBLE_MIN = 120;

/** Etat memorise, ou null s'il n'existe pas ou n'est pas exploitable. */
function chargerFenetre(dossier) {
  try {
    const f = JSON.parse(fs.readFileSync(path.join(dossier, FICHIER), 'utf8'));
    const nombres = [f.x, f.y, f.width, f.height];
    if (!nombres.every(Number.isFinite)) return null;
    if (f.width < 200 || f.height < 200) return null;   // fichier abime : ne pas en heriter
    return {
      x: Math.round(f.x), y: Math.round(f.y),
      width: Math.round(f.width), height: Math.round(f.height),
      maximisee: Boolean(f.maximisee),
      pleinEcran: Boolean(f.pleinEcran),
    };
  } catch {
    return null;
  }
}

function enregistrerFenetre(dossier, etat) {
  try {
    fs.mkdirSync(dossier, { recursive: true });
    fs.writeFileSync(path.join(dossier, FICHIER), JSON.stringify(etat, null, 2), 'utf8');
  } catch { /* un disque plein ne doit pas gener la fermeture */ }
}

/**
 * La position memorisee, si elle retombe sur un ecran encore present ; sinon null.
 *
 * @param sauvee  etat rendu par chargerFenetre, ou null
 * @param ecrans  zones de travail des ecrans presents : [{ x, y, width, height }]
 */
function positionSure(sauvee, ecrans) {
  if (!sauvee || !Array.isArray(ecrans)) return null;
  for (const e of ecrans) {
    const ix = Math.min(sauvee.x + sauvee.width, e.x + e.width) - Math.max(sauvee.x, e.x);
    const iy = Math.min(sauvee.y + sauvee.height, e.y + e.height) - Math.max(sauvee.y, e.y);
    // Les DEUX axes : une bande de 5 px qui depasse en haut d'un ecran ne se rattrape pas.
    if (ix >= VISIBLE_MIN && iy >= VISIBLE_MIN) return sauvee;
  }
  return null;
}

module.exports = { chargerFenetre, enregistrerFenetre, positionSure };
