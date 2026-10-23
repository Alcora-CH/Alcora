/**
 * Ce que les scripts des cles demandent a la personne devant le terminal : une saisie
 * cachee, une touche Entree, le presse-papiers de Windows.
 */

import { spawnSync } from 'node:child_process';

/** Une ligne tapee sans echo — phrase de passe. Exige un vrai terminal. */
export function demanderCache(question) {
  return new Promise((resoudre, rejeter) => {
    const entree = process.stdin;
    if (!entree.isTTY) {
      rejeter(new Error('a lancer dans un terminal : la saisie doit rester cachee'));
      return;
    }
    process.stdout.write(question);
    entree.setRawMode(true);
    entree.setEncoding('utf8');
    entree.resume();
    let texte = [];
    const fin = () => {
      entree.off('data', lire);
      entree.setRawMode(false);
      entree.pause();
      process.stdout.write('\n');
    };
    function lire(morceau) {
      for (const c of morceau) {
        if (c === '\r' || c === '\n') { fin(); resoudre(texte.join('')); return; }
        if (c === '\u0003') { fin(); rejeter(new Error('interrompu')); return; }
        if (c === '\u007f' || c === '\b') { texte = texte.slice(0, -1); continue; }
        if (c >= ' ') texte.push(c);
      }
    }
    entree.on('data', lire);
  });
}

/** Attend la touche Entree. */
export function attendreEntree(question) {
  return new Promise((resoudre) => {
    process.stdout.write(question);
    process.stdin.setEncoding('utf8');
    process.stdin.resume();
    process.stdin.once('data', () => { process.stdin.pause(); resoudre(); });
  });
}

function powershell(script, env = {}) {
  const r = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Sta', '-Command',
    `[Console]::OutputEncoding = [Text.Encoding]::UTF8\n${script}`], {
    env: { ...process.env, ...env }, encoding: 'utf8', windowsHide: true,
  });
  if (r.status !== 0) throw new Error(`presse-papiers inaccessible : ${(r.stderr || r.error?.message || '').trim()}`);
  return r.stdout;
}

/**
 * Pose un texte dans le presse-papiers SANS qu'il entre dans l'historique de Windows
 * (Windows + V) ni dans sa synchronisation entre appareils : les formats que Windows
 * documente pour cela accompagnent le texte.
 */
export function copier(texte) {
  powershell([
    'Add-Type -AssemblyName System.Windows.Forms',
    '$d = New-Object System.Windows.Forms.DataObject',
    '$d.SetData([System.Windows.Forms.DataFormats]::UnicodeText, $env:ALCORA_TEXTE)',
    "foreach ($f in 'ExcludeClipboardContentFromMonitorProcessing', 'CanIncludeInClipboardHistory', 'CanUploadToCloudClipboard') {",
    '  $d.SetData($f, (New-Object System.IO.MemoryStream (, [byte[]](0, 0, 0, 0))))',
    '}',
    '[System.Windows.Forms.Clipboard]::SetDataObject($d, $true)',
  ].join('\n'), { ALCORA_TEXTE: texte });
}

/** Le texte du presse-papiers, ou une chaine vide. */
export const lirePressePapiers = () => powershell('Get-Clipboard -Raw').trim();

export function viderPressePapiers() {
  powershell('Add-Type -AssemblyName System.Windows.Forms\n[System.Windows.Forms.Clipboard]::Clear()');
}
