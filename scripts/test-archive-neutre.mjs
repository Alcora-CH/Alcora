/**
 * L'archive Linux ne porte aucun nom de compte (scripts/archive-neutre.mjs).
 *
 *   node scripts/test-archive-neutre.mjs      depuis la racine du depot
 *
 * Le controle relit la sortie de « tar tv » : il doit refuser une archive dont un fichier
 * appartient a un compte nomme (la forme qu'avaient les archives 2.25.0 a 2.29.0), et
 * accepter celle ecrite avec « --owner=0 --group=0 --numeric-owner ». Noms fictifs.
 */

import { proprietaireNeutre } from './archive-neutre.mjs';

let echecs = 0;
function check(label, condition) {
  if (!condition) echecs++;
  console.log(`${condition ? '  OK  ' : ' ECHEC'}  ${label}`);
}

const neutre = [
  'drwxr-xr-x 0/0         0 2026-11-17 20:17 Alcora-9.9.9-linux-x64/',
  '-rwxr-xr-x 0/0 234483016 2026-11-17 20:17 Alcora-9.9.9-linux-x64/Alcora',
  '-rwxr-xr-x 0/0  56324825 2026-11-17 20:17 Alcora-9.9.9-linux-x64/resources/relay/mediamtx',
].join('\n');
const nomme = [
  '-rwxr-xr-x ada/ada 234483016 2026-11-17 20:17 Alcora-9.9.9-linux-x64/Alcora',
  '-rwxr-xr-x ada/ada  56324825 2026-11-17 20:17 Alcora-9.9.9-linux-x64/resources/relay/mediamtx',
].join('\n');
const melange = `${neutre}\n-rw-r--r-- ada/ada 12 2026-11-17 20:17 Alcora-9.9.9-linux-x64/LICENSE`;

check('une archive aux propriétaires 0/0 est acceptée', proprietaireNeutre(neutre));
check('une archive qui nomme un compte est refusée', !proprietaireNeutre(nomme));
check('un seul fichier nommé suffit à refuser', !proprietaireNeutre(melange));
check('un propriétaire numérique non nul est refusé', !proprietaireNeutre(neutre.replace('0/0 234483016', '1000/1000 234483016')));
check('une relecture vide est refusée (rien n\'a été relu)', !proprietaireNeutre(''));
check('les lignes étrangères à la liste sont ignorées', proprietaireNeutre(`droits vérifiés\n${neutre}\n`));

if (echecs) {
  console.error(`\n${echecs} échec(s)`);
  process.exit(1);
}
console.log('\nArchive Linux : propriétaire neutre vérifié');
