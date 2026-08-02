/**
 * Rassemble les licences des composants redistribues.
 *
 * La licence MIT est permissive mais pose une condition : sa notice doit accompagner
 * toute copie du logiciel. Livrer mediamtx ou React sans leur notice n'est donc pas une
 * negligence de forme, c'est une condition non tenue — y compris pour un installeur remis
 * a une seule personne.
 *
 * Ce fichier est engendre a chaque construction : une liste tenue a la main finirait par
 * mentir sur ce que le paquet contient reellement.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

/** Composants livres sous forme de binaire, dont la licence n'est pas dans node_modules. */
const BINAIRES = [
  {
    nom: 'mediamtx',
    version: 'v1.x',
    url: 'https://github.com/bluenviron/mediamtx',
    licence: 'MIT',
    texte: `Copyright (c) 2019 aler9

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`,
  },
  {
    nom: 'Velopack',
    version: '',
    url: 'https://github.com/velopack/velopack',
    licence: 'MIT',
    texte: `Copyright © 2021 Caelan Sayler
Copyright © 2024 Velopack Ltd.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`,
  },
];

/**
 * Paquets dont le code ou la production se retrouve dans l'interface livree.
 * Tailwind y figure : le CSS engendre est distribue avec l'application.
 */
const EMBARQUES = ['react', 'react-dom', 'lucide-react', 'scheduler', 'tailwindcss'];

const NOMS_LICENCE = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENCE', 'license', 'LICENSE-MIT'];

function lireLicence(dossier) {
  if (!existsSync(dossier)) return null;
  const fichiers = readdirSync(dossier);
  const trouve = NOMS_LICENCE.find((n) => fichiers.includes(n))
    ?? fichiers.find((f) => /^licen[cs]e/i.test(f));
  if (!trouve) return null;
  return readFileSync(path.join(dossier, trouve), 'utf8').trim();
}

/**
 * @param {string} racineWeb  dossier contenant node_modules de l'interface
 * @returns {string} le contenu du fichier de notices
 */
export function construireNotices(racineWeb) {
  const morceaux = [
    'ProtectViewer — composants de tiers',
    '='.repeat(72),
    '',
    "ProtectViewer redistribue les composants ci-dessous. Chacun reste soumis a sa",
    'propre licence, reproduite integralement.',
    '',
    "ProtectViewer n'est ni affilie ni approuve par Ubiquiti Inc. « UniFi » et",
    '« UniFi Protect » sont des marques de Ubiquiti Inc.',
    '',
  ];

  const bloc = (nom, version, url, licence, texte) => [
    '-'.repeat(72),
    `${nom}${version ? ` ${version}` : ''}`,
    url,
    `Licence : ${licence}`,
    '-'.repeat(72),
    '',
    texte,
    '',
    '',
  ];

  for (const b of BINAIRES) {
    morceaux.push(...bloc(b.nom, b.version, b.url, b.licence, b.texte));
  }

  const modules = path.join(racineWeb, 'node_modules');
  const manquants = [];

  for (const nom of EMBARQUES) {
    const dossier = path.join(modules, ...nom.split('/'));
    const pkgPath = path.join(dossier, 'package.json');
    if (!existsSync(pkgPath)) { manquants.push(nom); continue; }
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    const texte = lireLicence(dossier);
    if (!texte) { manquants.push(nom); continue; }
    morceaux.push(...bloc(
      nom, pkg.version,
      typeof pkg.repository === 'string' ? pkg.repository : (pkg.repository?.url ?? pkg.homepage ?? ''),
      pkg.license ?? 'voir texte',
      texte,
    ));
  }

  // Electron apporte les siennes : @electron/packager depose « LICENSE » et
  // « LICENSES.chromium.html » a cote de l'executable. On y renvoie plutot que de les
  // recopier — le fichier de Chromium fait a lui seul neuf megaoctets.
  morceaux.push(
    '-'.repeat(72),
    'Electron, Chromium et Node.js',
    'https://github.com/electron/electron',
    'Licence : MIT, et diverses licences pour les composants de Chromium',
    '-'.repeat(72),
    '',
    "Voir les fichiers « LICENSE » et « LICENSES.chromium.html », livres a cote de",
    "l'executable de l'application.",
    '',
  );

  return { texte: morceaux.join('\n'), manquants };
}
