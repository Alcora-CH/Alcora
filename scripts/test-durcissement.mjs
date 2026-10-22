/**
 * La politique de contenu de la page LIVREE.
 *
 *   node scripts/test-durcissement.mjs      depuis la racine du depot
 *
 * Construit la page avec la vraie configuration de v2/web, dans un dossier temporaire, et
 * la passe au controle que la construction applique (scripts/durcissement.mjs). Verifie
 * aussi que ce controle VOIT la politique laxiste du developpement : un controle qui ne
 * rougit sur rien ne prouve rien.
 *
 * Les fusibles, eux, ne sont pas ici : les eprouver demande d'empaqueter l'application,
 * ce que fait la construction elle-meme, qui s'arrete si une sonde echoue.
 */

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import { defautsPolitique, intrusDansArchive } from './durcissement.mjs';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const web = path.join(racine, 'v2', 'web');

let echecs = 0;
function check(label, condition, detail = '') {
  if (!condition) echecs++;
  console.log(`${condition ? '  OK  ' : ' ECHEC'}  ${label}${detail ? ` — ${detail}` : ''}`);
}

console.log('=== Le controle voit ce qu il doit voir ===');
{
  const source = defautsPolitique(readFileSync(path.join(web, 'index.html'), 'utf8'));
  check('la page source (developpement) est jugee laxiste', source.length > 0, source.join(' ; '));
  check('… pour ses scripts en ligne', source.some((d) => d.includes("'unsafe-inline'")));
  check('… et pour localhost', source.some((d) => d.includes('localhost')));
  const page = (csp) => `<meta http-equiv="Content-Security-Policy" content="${csp}" />`;
  check('une politique stricte passe', defautsPolitique(page("default-src 'self'; script-src 'self'")).length === 0);
  check('sans politique : refuse', defautsPolitique('<html></html>').length > 0);
  check('eval admis : refuse', defautsPolitique(page("script-src 'self' 'unsafe-eval'")).length > 0);
  check('joker : refuse', defautsPolitique(page('script-src *')).length > 0);
  check('scripts regis par default-src seul, laxiste : refuse',
    defautsPolitique(page("default-src 'self' 'unsafe-inline'")).length > 0);
  check('aucune directive pour les scripts : refuse', defautsPolitique(page("img-src 'self'")).length > 0);
}

console.log('\n=== L archive n emporte que le code et l interface ===');
{
  const requireDesktop = createRequire(path.join(racine, 'v2', 'desktop', 'package.json'));
  const asar = requireDesktop('@electron/asar');
  const atelier = mkdtempSync(path.join(os.tmpdir(), 'alcora-archive-'));
  try {
    const archive = async (nom, fichiers) => {
      const dossier = path.join(atelier, nom);
      for (const f of fichiers) {
        mkdirSync(path.dirname(path.join(dossier, f)), { recursive: true });
        writeFileSync(path.join(dossier, f), 'fictif');
      }
      await asar.createPackage(dossier, path.join(atelier, `${nom}.asar`));
      return intrusDansArchive(requireDesktop, path.join(atelier, `${nom}.asar`));
    };
    const code = ['main.js', 'relais-config.js', 'package.json', 'protect/client.js', 'ui/index.html',
      'ui/assets/index.js', 'assets/alcor.ico'];
    const propre = await archive('propre', code);
    check('le code et l interface passent', propre.length === 0, propre.join(', '));
    const sale = await archive('sale', [...code, 'electron.log', 'relais-defaut-v1.21.2.yml', 'test-store.js',
      '.env', 'vidage.dmp', 'config.json']);
    check('journal, YAML, test, .env, vidage, config : tous refuses',
      JSON.stringify(sale) === JSON.stringify(['.env', 'config.json', 'electron.log', 'relais-defaut-v1.21.2.yml',
        'test-store.js', 'vidage.dmp']), sale.join(', '));
  } finally {
    rmSync(atelier, { recursive: true, force: true });
  }
}

console.log('\n=== La page reellement construite ===');
const sortie = mkdtempSync(path.join(os.tmpdir(), 'alcora-page-'));
try {
  const requireWeb = createRequire(path.join(web, 'package.json'));
  const vite = await import(pathToFileURL(requireWeb.resolve('vite')).href);
  await vite.build({ root: web, logLevel: 'error', build: { outDir: sortie, emptyOutDir: true } });
  const defauts = defautsPolitique(readFileSync(path.join(sortie, 'index.html'), 'utf8'));
  check('la page construite porte la politique resserree', defauts.length === 0, defauts.join(' ; '));
} finally {
  rmSync(sortie, { recursive: true, force: true });
}

console.log('\n' + (echecs === 0 ? 'TOUS LES TESTS PASSENT' : `${echecs} TEST(S) EN ECHEC`));
process.exit(echecs === 0 ? 0 : 1);
