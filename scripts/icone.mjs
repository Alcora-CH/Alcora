/**
 * Fabrique l'icone Windows a partir de la marque Alcor.
 *
 * La marque est purement geometrique : une plaque a coins arrondis, deux disques perces
 * dedans (Mizar et sa voisine Alcor) et la barre fine qui les relie. On la rasterise donc
 * ici plutot que de dependre d'un convertisseur SVG : le trace vit dans ce fichier, le
 * resultat est reproductible a l'octet pres, et rien n'est a installer pour reconstruire.
 *
 * Sortie : v2/desktop/assets/alcor.ico (16 a 256 px) et docs/marque-alcor-512.png.
 *
 *   node scripts/icone.mjs            construit
 *   node scripts/icone.mjs --apercu   construit et dessine chaque taille en texte
 *
 * L'apercu existe parce qu'une icone ne se relit pas : sans lui, on ne peut pas savoir si
 * le petit trou d'Alcor survit a 16 px autrement qu'en ouvrant le fichier a la main.
 */

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* ------------------------------------------------------------------- la marque */

// Repere d'origine : le viewBox 64x64 de docs/marque-alcor.svg. Toute modification du
// trace doit etre reportee ici ET la-bas, les deux doivent rester le meme dessin.
const PLAQUE = { x0: 4, y0: 4, x1: 60, y1: 60, r: 14 };
const MIZAR = { x: 25, y: 37, r: 11 };
const ALCOR = { x: 45, y: 22, r: 4.4 };
const LIEN = [[35.64, 30.12], [40.74, 26.32], [39.66, 24.88], [34.56, 28.68]];

// L'accent de l'application (v2/web/src/index.css). L'icone porte la couleur du produit,
// pas une couleur a elle : un or chaud, lisible sur une barre des taches claire comme sombre.
const OR = { r: 0xd2, v: 0xa2, b: 0x63 };

function dansPlaque(x, y) {
  if (x < PLAQUE.x0 || x > PLAQUE.x1 || y < PLAQUE.y0 || y > PLAQUE.y1) return false;
  // Rectangle arrondi : on ramene le point dans le rectangle interieur, la distance
  // restante est celle au coin le plus proche.
  const cx = Math.min(Math.max(x, PLAQUE.x0 + PLAQUE.r), PLAQUE.x1 - PLAQUE.r);
  const cy = Math.min(Math.max(y, PLAQUE.y0 + PLAQUE.r), PLAQUE.y1 - PLAQUE.r);
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy <= PLAQUE.r * PLAQUE.r;
}

function dansDisque(x, y, d) {
  const dx = x - d.x, dy = y - d.y;
  return dx * dx + dy * dy <= d.r * d.r;
}

function dansPolygone(x, y, points) {
  let dedans = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i], [xj, yj] = points[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dedans = !dedans;
  }
  return dedans;
}

/** Vrai la ou il y a de la matiere : la plaque, moins les trous. */
function matiere(x, y) {
  if (!dansPlaque(x, y)) return false;
  if (dansDisque(x, y, MIZAR) || dansDisque(x, y, ALCOR)) return false;
  return !dansPolygone(x, y, LIEN);
}

/* ------------------------------------------------------------------ rasterisation */

const SUR = 4;   // 4x4 sous-echantillons par pixel : l'arrondi des coins l'exige

/** Rend la marque en RVBA de haut en bas, alpha = couverture. */
function rendre(taille) {
  const px = Buffer.alloc(taille * taille * 4);
  const pas = 64 / taille;
  for (let y = 0; y < taille; y += 1) {
    for (let x = 0; x < taille; x += 1) {
      let couvert = 0;
      for (let sy = 0; sy < SUR; sy += 1) {
        for (let sx = 0; sx < SUR; sx += 1) {
          const vx = (x + (sx + 0.5) / SUR) * pas;
          const vy = (y + (sy + 0.5) / SUR) * pas;
          if (matiere(vx, vy)) couvert += 1;
        }
      }
      const i = (y * taille + x) * 4;
      px[i] = OR.r; px[i + 1] = OR.v; px[i + 2] = OR.b;
      px[i + 3] = Math.round((couvert / (SUR * SUR)) * 255);
    }
  }
  return px;
}

/* --------------------------------------------------------------------- encodage PNG */

const TABLE_CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (const octet of buf) c = TABLE_CRC[(c ^ octet) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function bloc(type, donnees) {
  const taille = Buffer.alloc(4);
  taille.writeUInt32BE(donnees.length, 0);
  const corps = Buffer.concat([Buffer.from(type, 'ascii'), donnees]);
  const controle = Buffer.alloc(4);
  controle.writeUInt32BE(crc32(corps), 0);
  return Buffer.concat([taille, corps, controle]);
}

function png(taille, px) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(taille, 0);
  ihdr.writeUInt32BE(taille, 4);
  ihdr[8] = 8;    // 8 bits par canal
  ihdr[9] = 6;    // RVBA
  // compression, filtre et entrelacement restent a zero

  // Chaque ligne est prefixee de son octet de filtre. Filtre 0 : aucune prediction. Le
  // dessin est majoritairement uni, deflate s'en sort tres bien sans aide.
  const brut = Buffer.alloc(taille * (taille * 4 + 1));
  for (let y = 0; y < taille; y += 1) {
    brut[y * (taille * 4 + 1)] = 0;
    px.copy(brut, y * (taille * 4 + 1) + 1, y * taille * 4, (y + 1) * taille * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloc('IHDR', ihdr),
    bloc('IDAT', deflateSync(brut, { level: 9 })),
    bloc('IEND', Buffer.alloc(0)),
  ]);
}

/* --------------------------------------------------------------------- encodage ICO */

/**
 * Image matricielle a l'ancienne, pour les petites tailles.
 *
 * Un .ico accepte des entrees PNG depuis Windows Vista, mais les outils qui reecrivent les
 * ressources d'un executable ne les lisent pas tous. Les tailles courantes partent donc en
 * DIB 32 bits, format que tout le monde sait lire depuis toujours.
 */
function dib(taille, px) {
  const entete = Buffer.alloc(40);
  entete.writeUInt32LE(40, 0);
  entete.writeInt32LE(taille, 4);
  entete.writeInt32LE(taille * 2, 8);   // hauteur double : image + masque
  entete.writeUInt16LE(1, 12);
  entete.writeUInt16LE(32, 14);

  const image = Buffer.alloc(taille * taille * 4);
  for (let y = 0; y < taille; y += 1) {
    const source = (taille - 1 - y) * taille * 4;   // le DIB se lit de bas en haut
    for (let x = 0; x < taille; x += 1) {
      const s = source + x * 4;
      const d = (y * taille + x) * 4;
      image[d] = px[s + 2];        // bleu
      image[d + 1] = px[s + 1];    // vert
      image[d + 2] = px[s];        // rouge
      image[d + 3] = px[s + 3];    // alpha
    }
  }

  // Masque monochrome : inutilise en 32 bits, mais sa place doit etre reservee.
  const parLigne = Math.ceil(taille / 32) * 4;
  return Buffer.concat([entete, image, Buffer.alloc(parLigne * taille)]);
}

function ico(entrees) {
  const tete = Buffer.alloc(6);
  tete.writeUInt16LE(0, 0);
  tete.writeUInt16LE(1, 2);                 // 1 = icone
  tete.writeUInt16LE(entrees.length, 4);

  let position = 6 + entrees.length * 16;
  const table = [];
  for (const e of entrees) {
    const ligne = Buffer.alloc(16);
    ligne[0] = e.taille >= 256 ? 0 : e.taille;   // 0 signifie 256
    ligne[1] = e.taille >= 256 ? 0 : e.taille;
    ligne[2] = 0;                                 // palette : aucune
    ligne[3] = 0;
    ligne.writeUInt16LE(1, 4);                    // plans
    ligne.writeUInt16LE(32, 6);                   // bits par pixel
    ligne.writeUInt32LE(e.donnees.length, 8);
    ligne.writeUInt32LE(position, 12);
    position += e.donnees.length;
    table.push(ligne);
  }
  return Buffer.concat([tete, ...table, ...entrees.map((e) => e.donnees)]);
}

/* ------------------------------------------------------------------------ apercu */

const NUANCES = ' .:-=+*#%@';

function apercu(taille, px) {
  const lignes = [];
  for (let y = 0; y < taille; y += 1) {
    let ligne = '';
    for (let x = 0; x < taille; x += 1) {
      const a = px[(y * taille + x) * 4 + 3] / 255;
      ligne += NUANCES[Math.min(NUANCES.length - 1, Math.round(a * (NUANCES.length - 1)))];
    }
    lignes.push(ligne);
  }
  return lignes.join('\n');
}

/* ---------------------------------------------------------------------- execution */

const TAILLES = [16, 24, 32, 48, 64, 128, 256];
const montrer = process.argv.includes('--apercu');

const rendus = new Map(TAILLES.map((t) => [t, rendre(t)]));

const entrees = TAILLES.map((taille) => ({
  taille,
  // Au-dela de 64 px un DIB pese quatre fois plus qu'un PNG sans rien apporter.
  donnees: taille > 64 ? png(taille, rendus.get(taille)) : dib(taille, rendus.get(taille)),
}));

const dossierIcone = path.join(racine, 'v2', 'desktop', 'assets');
mkdirSync(dossierIcone, { recursive: true });
const cible = path.join(dossierIcone, 'alcor.ico');
writeFileSync(cible, ico(entrees));

const grand = rendre(512);
const avatar = path.join(racine, 'docs', 'marque-alcor-512.png');
writeFileSync(avatar, png(512, grand));

if (montrer) {
  for (const taille of [16, 32, 64]) {
    console.log(`\n--- ${taille} px ---`);
    console.log(apercu(taille, rendus.get(taille)));
  }
}

// Un trou qui ne couvre plus aucun pixel a fond a disparu : on le dit, plutot que de
// laisser croire que la marque tient a toutes les tailles.
for (const taille of TAILLES) {
  const px = rendus.get(taille);
  let creux = 0;
  const c = { x: ALCOR.x * taille / 64, y: ALCOR.y * taille / 64 };
  const rayon = Math.ceil(ALCOR.r * taille / 64) + 1;
  for (let y = Math.max(0, Math.floor(c.y - rayon)); y < Math.min(taille, c.y + rayon); y += 1) {
    for (let x = Math.max(0, Math.floor(c.x - rayon)); x < Math.min(taille, c.x + rayon); x += 1) {
      if (px[(y * taille + x) * 4 + 3] < 128) creux += 1;
    }
  }
  console.log(`  ${String(taille).padStart(3)} px — Alcor occupe ${creux} pixel(s) percé(s)`);
}

console.log(`\nIcône  : ${path.relative(racine, cible)}  (${TAILLES.join(', ')} px)`);
console.log(`Avatar : ${path.relative(racine, avatar)}  (512 px)`);
