'use strict';

/**
 * V-Attributs — la mesure qui precede l'ecran de detections avance.
 *
 *   node test-attributs.js
 *
 * Les captures de Protect transmises le 29.07.2026 montrent un seuil de confiance reglable,
 * des filtres par TYPE et par COULEUR de vehicule, des plaques et des visages. Reste a
 * savoir ce qui, de tout cela, remonte reellement dans les EVENEMENTS — et ce qui ne vit
 * que dans leur interface, calcule ailleurs et jamais expose.
 *
 * V-Events avait releve qu'un evenement porte un champ « metadata », sans jamais l'ouvrir.
 * C'est tres probablement la que tout se joue.
 *
 *   1. Que contient « metadata », sujet par sujet ?
 *   2. Le type et la couleur d'un vehicule y sont-ils, ou faut-il les renoncer ?
 *   3. Le texte d'une plaque y est-il, et sous quelle forme ?
 *   4. Comment se repartissent les SCORES ? Un seuil reglable n'a de sens que si les
 *      valeurs s'etalent — s'ils valent tous 100, le curseur ne filtrerait rien.
 *   5. Le controleur sait-il filtrer lui-meme, ou faudra-t-il tout tirer et trier ici ?
 *
 * Lecture seule. Les identifiants sont saisis a l'execution et jamais ecrits. Les PLAQUES
 * sont masquees dans la sortie — on releve leur forme, jamais leur valeur : ce sont des
 * donnees reelles, et elles n'ont rien a faire dans un compte rendu.
 */

const readline = require('node:readline');
const { ProtectClient } = require('./protect/client');
const { normalizeSecret } = require('./protect/totp');
const { ProtectError } = require('./protect/errors');

function ok(l, d = '') { console.log(`  OK      ${l}${d ? '  — ' + d : ''}`); }
function ko(l, d = '') { console.log(`  ECHEC   ${l}${d ? '  — ' + d : ''}`); }
function info(l, d = '') { console.log(`  ·       ${l}${d ? '  — ' + d : ''}`); }

function ask(question, { hidden = false, fallback = '' } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      const onData = (char) => {
        if (['\n', '\r', ''].includes(char.toString())) process.stdin.removeListener('data', onData);
        else {
          readline.moveCursor(process.stdout, -1, 0);
          process.stdout.write('*');
        }
      };
      process.stdin.on('data', onData);
    }
    rl.question(fallback ? `${question} [${fallback}] : ` : `${question} : `, (a) => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(a.trim() || fallback);
    });
  });
}

/**
 * Cles dont la VALEUR est une donnee reelle et ne doit pas paraitre.
 *
 * Le premier passage masquait tout ce qui ressemblait a une plaque — et masquait donc
 * « disabled », huit caracteres alphanumeriques. On masque desormais par le NOM de la cle,
 * ce qui protege ce qu'il faut sans aveugler le reste.
 */
const CLES_SENSIBLES =
  /plate|licen|name|person|face|user|owner|email|candidate|matched|group|embed|landmark/i;

/**
 * Une valeur qui RESSEMBLE a une plaque, quel que soit le nom de sa cle.
 *
 * Le masquage par nom de cle seul a laisse fuiter des plaques reelles : « topKCandidate »
 * et « group.id » ne contenaient aucun des mots surveilles, et leur contenu a ete affiche
 * en clair. Deux garde-fous valent mieux qu'un — celui-ci regarde la VALEUR, et il attrape
 * ce que le premier laisse passer.
 */
const RESSEMBLE_A_UNE_PLAQUE = /\b[A-Z]{1,3}[ -]?\d{3,7}\b/;

/** Vrai si l'on ne doit rien montrer de cette valeur. */
function sensible(cle, valeur) {
  if (CLES_SENSIBLES.test(cle)) return true;
  const texte = typeof valeur === 'string' ? valeur : JSON.stringify(valeur ?? '');
  return RESSEMBLE_A_UNE_PLAQUE.test(texte);
}

function forme(cle, v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return `liste[${v.length}]`;
  if (typeof v === 'object') return `objet{${Object.keys(v).join(',')}}`;
  if (typeof v === 'string') {
    if (!v) return 'texte vide';
    if (sensible(cle, v)) return `texte masqué (${v.length} car.)`;
    return `texte «${v.slice(0, 22)}»`;
  }
  return `${typeof v} ${v}`;
}

/**
 * Aplatit un objet imbrique en chemins.
 *
 * DESCEND DANS LES LISTES, ce que le premier passage ne faisait pas — et c'est precisement
 * la que tout se joue : « detectedThumbnails » est une liste dont les elements portent
 * « attributes », « labels » et « conf ». La sonde s'arretait au seuil de la seule chose
 * qu'on cherchait, et concluait « aucun champ de plaque » a tort.
 */
function chemins(obj, prefixe = '', sortie = new Map(), profondeur = 0) {
  if (!obj || typeof obj !== 'object' || profondeur > 5) return sortie;
  for (const [cle, v] of Object.entries(obj)) {
    const chemin = prefixe ? `${prefixe}.${cle}` : cle;
    if (Array.isArray(v)) {
      sortie.set(chemin, `liste[${v.length}]`);
      // Le premier element suffit a montrer la forme : ils sont homogenes.
      if (v.length && v[0] && typeof v[0] === 'object') {
        chemins(v[0], `${chemin}[]`, sortie, profondeur + 1);
      } else if (v.length) {
        sortie.set(`${chemin}[]`, forme(cle, v[0]));
      }
    } else if (v && typeof v === 'object') {
      chemins(v, chemin, sortie, profondeur + 1);
    } else {
      sortie.set(chemin, forme(cle, v));
    }
  }
  return sortie;
}

(async () => {
  console.log('=== V-Attributs : que sait-on vraiment d’une détection ? ===\n');
  console.log('Lecture seule. Les plaques sont masquées : on relève leur forme, pas leur valeur.\n');

  const host = await ask('Adresse du controleur', { fallback: process.env.PV_HOST });
  const username = await ask('Compte applicatif (e-mail)');
  const password = await ask('Mot de passe', { hidden: true });
  const totpSeed = await ask('Cle a deux facteurs (vide si aucune)', { hidden: true });
  console.log('');

  if (totpSeed) {
    const n = normalizeSecret(totpSeed);
    if (!n.ok) { ko('cle a deux facteurs', n.error); process.exit(1); }
  }

  const client = new ProtectClient({ host, pins: [], onFirstUse: () => {} });
  client.setCredentials({ username, password, totpSeed: totpSeed || undefined });

  try {
    await client.login();
    ok('session ouverte');
  } catch (e) {
    ko('session', e instanceof ProtectError ? e.userMessage : String(e));
    process.exit(1);
  }

  const fin = Date.now();
  const debut = fin - 7 * 86_400_000;
  let evenements;
  try {
    evenements = await client.getEvents({
      debut, fin, limite: 3000, types: ['smartDetectZone', 'smartAudioDetect'],
    });
    ok(`${evenements.length} détection(s) intelligente(s) sur sept jours`);
  } catch (e) {
    ko('lecture des evenements', String(e && e.message));
    process.exit(1);
  }

  /* ---- 1. la structure de « metadata » ---- */
  console.log('\n--- 1. Que contient « metadata » ? ---');
  {
    const avecMeta = evenements.filter((e) => e.metadata && Object.keys(e.metadata).length);
    info('détections portant un « metadata » non vide',
      `${avecMeta.length} sur ${evenements.length}`);

    if (!avecMeta.length) {
      ko('aucune metadonnee', 'les attributs de vehicule ne sont pas exposes par les evenements');
    } else {
      const compte = new Map();
      for (const e of avecMeta) {
        for (const [chemin, f] of chemins(e.metadata)) {
          const c = compte.get(chemin) ?? { n: 0, exemples: new Set() };
          c.n += 1;
          if (c.exemples.size < 3) c.exemples.add(f);
          compte.set(chemin, c);
        }
      }
      console.log('');
      for (const [chemin, c] of [...compte].sort((a, b) => b[1].n - a[1].n)) {
        console.log(`  ${String(c.n).padStart(5)} × ${chemin.padEnd(34)} ${[...c.exemples].join(' | ').slice(0, 70)}`);
      }
    }
  }

  /* ---- 2. attributs par sujet ---- */
  console.log('\n--- 2. Quel sujet porte quels attributs ? ---');
  {
    const parSujet = new Map();
    for (const e of evenements) {
      for (const s of e.smartDetectTypes ?? []) {
        const set = parSujet.get(s) ?? new Set();
        for (const [chemin] of chemins(e.metadata ?? {})) set.add(chemin);
        parSujet.set(s, set);
      }
    }
    for (const [sujet, cles] of parSujet) {
      info(sujet.padEnd(14), cles.size ? [...cles].join(', ').slice(0, 100) : '(aucun attribut)');
    }
  }

  /* ---- 3. les attributs, la ou ils vivent vraiment ---- */
  console.log('\n--- 3. Type, couleur, plaque : que porte « detectedThumbnails » ? ---');
  {
    /*
     * Le premier passage cherchait au premier niveau et concluait « aucun champ de
     * plaque ». Faux : « detectedThumbnails » est une LISTE dont les elements portent
     * « attributes », « labels » et « conf ». On ouvre.
     */
    const vignettes = [];
    for (const e of evenements) {
      for (const t of e.metadata?.detectedThumbnails ?? []) {
        vignettes.push({ sujets: e.smartDetectTypes ?? [], t });
      }
    }
    info('objets détectés au total', String(vignettes.length));

    if (vignettes.length) {
      const compte = new Map();
      for (const { t } of vignettes) {
        for (const [chemin, f] of chemins(t)) {
          const c = compte.get(chemin) ?? { n: 0, ex: new Set() };
          c.n += 1;
          if (c.ex.size < 4) c.ex.add(f);
          compte.set(chemin, c);
        }
      }
      console.log('');
      for (const [chemin, c] of [...compte].sort((a, b) => b[1].n - a[1].n)) {
        console.log(`  ${String(c.n).padStart(5)} × ${chemin.padEnd(38)} ${[...c.ex].join(' | ').slice(0, 66)}`);
      }

      // Les attributs d'un vehicule : c'est eux qui decident des filtres de l'ecran.
      console.log('');
      const parType = new Map();
      for (const { t } of vignettes) {
        const cle = String(t.type ?? '?');
        const set = parType.get(cle) ?? new Set();
        for (const a of Object.keys(t.attributes ?? {})) set.add(a);
        parType.set(cle, set);
      }
      for (const [type, attrs] of parType) {
        info(`type « ${type} »`, attrs.size ? [...attrs].join(', ') : '(aucun attribut)');
      }

      // Valeurs REELLEMENT observees pour chaque attribut : c'est ce qui remplira les
      // listes de choix. Inutile d'offrir « camion » si aucun n'est jamais passe.
      const valeurs = new Map();
      for (const { t } of vignettes) {
        for (const [a, v] of Object.entries(t.attributes ?? {})) {
          /*
           * On ne prend QUE les valeurs scalaires simples.
           *
           * La version precedente faisait « JSON.stringify » d'un objet complexe faute de
           * mieux : c'est ainsi que des plaques reelles sont sorties en clair, la liste
           * « topKCandidate » ayant ete serialisee entiere. Un objet ou une liste n'est
           * desormais JAMAIS deplie — on n'en dit que la forme.
           */
          const set = valeurs.get(a) ?? new Map();
          if (v !== null && typeof v === 'object') {
            const brut = 'val' in v ? v.val : undefined;
            const k = (brut === undefined || (brut !== null && typeof brut === 'object'))
              ? (Array.isArray(v) ? `liste[${v.length}]` : `objet{${Object.keys(v).join(',')}}`)
              : String(brut);
            set.set(k, (set.get(k) ?? 0) + 1);
          } else {
            set.set(String(v), (set.get(String(v)) ?? 0) + 1);
          }
          valeurs.set(a, set);
        }
      }
      if (valeurs.size) {
        console.log('');
        for (const [a, set] of valeurs) {
          const tri = [...set].sort((x, y) => y[1] - x[1]).slice(0, 8);
          // Masqué si la clé l'exige, OU si l'une des valeurs ressemble à une plaque.
          const masque = tri.some(([v]) => sensible(a, v));
          info(`valeurs de « ${a} »`, masque
            ? `${set.size} valeur(s) distincte(s), masquées`
            : tri.map(([v, n]) => `${v} (${n})`).join(', '));
        }
      }
    }

    const favoris = evenements.filter((e) => e.isFavorite || (e.favoriteObjectIds ?? []).length);
    info('détections marquées « d’intérêt »', String(favoris.length));
  }

  /* ---- 4. la repartition des scores ---- */
  console.log('\n--- 4. Un seuil de confiance aurait-il du sens ? ---');
  {
    const parSujetScores = new Map();
    for (const e of evenements) {
      if (typeof e.score !== 'number') continue;
      for (const s of e.smartDetectTypes ?? []) {
        const l = parSujetScores.get(s) ?? [];
        l.push(e.score);
        parSujetScores.set(s, l);
      }
    }
    if (!parSujetScores.size) {
      ko('aucun score exploitable');
    } else {
      console.log('');
      for (const [sujet, scores] of parSujetScores) {
        scores.sort((a, b) => a - b);
        const q = (p) => scores[Math.min(scores.length - 1, Math.floor(scores.length * p))];
        const distincts = new Set(scores).size;
        console.log(`  ${sujet.padEnd(14)} ${String(scores.length).padStart(5)} détections  `
          + `min ${String(scores[0]).padStart(3)}  médiane ${String(q(0.5)).padStart(3)}  `
          + `max ${String(scores[scores.length - 1]).padStart(3)}  `
          + `${distincts} valeur(s) distincte(s)`);
      }
      const tous = [...parSujetScores.values()].flat();
      const distincts = new Set(tous).size;
      console.log('');
      if (distincts <= 2) {
        ko('les scores ne s’étalent pas', 'un curseur de seuil ne filtrerait rien : inutile');
      } else {
        ok('les scores s’étalent', `${distincts} valeurs distinctes — un seuil a du sens`);
      }
    }
  }

  /* ---- 5. le controleur sait-il filtrer ? ---- */
  console.log('\n--- 5. Peut-on demander au contrôleur de filtrer, ou faut-il trier ici ? ---');
  {
    /*
     * Premier passage : limite a 50, et les deux essais rendaient 50. Le test ne pouvait
     * rien distinguer — il mesurait sa propre limite. On prend donc une limite LARGE, et
     * l'on compare toujours a une reference tiree juste avant, sur la meme fenetre.
     */
    const LIMITE = 3000;
    const requete = async (extra) => {
      const q = new URLSearchParams({
        start: String(Math.round(debut)), end: String(Math.round(fin)), limit: String(LIMITE),
      });
      const res = await client.getJson(
        `/proxy/protect/api/events?${q}&types=smartDetectZone${extra}`);
      return Array.isArray(res) ? res : [];
    };

    let reference;
    try {
      reference = await requete('');
      ok(`référence sans filtre : ${reference.length} détection(s)`);
    } catch (e) { ko('reference', String(e && e.message)); reference = []; }

    if (reference.length) {
      if (reference.length >= LIMITE) {
        info('attention', 'la reference atteint la limite : le test resterait ambigu');
      }
      const essais = [
        ['score minimal (minScore=80)', '&minScore=80'],
        ['sujet (smartDetectTypes=person)', '&smartDetectTypes=person'],
      ];
      for (const [nom, extra] of essais) {
        try {
          const r = await requete(extra);
          const change = r.length !== reference.length;
          if (change) {
            ok(`${nom} : HONORÉ`, `${r.length} au lieu de ${reference.length}`);
          } else {
            info(`${nom} : ignoré`, `${r.length}, identique à la référence`);
          }
        } catch (e) {
          info(`${nom} : refusé`, String(e && e.message).slice(0, 60));
        }
      }
      info('conséquence', 'ignoré = tout tirer et trier ici, avec ~266 détections par jour');
    }
  }

  console.log('\n=== Ce que cette mesure décide ===');
  console.log('  · attributs de véhicule présents  → filtres par type et couleur, comme Protect ;');
  console.log('  · absents                         → on ne les promet pas, et l’écran se');
  console.log('    concentre sur ce qui existe vraiment plutôt que d’imiter une capture ;');
  console.log('  · scores étalés                   → curseur de seuil utile ;');
  console.log('  · scores tous identiques          → pas de curseur, ce serait un leurre.');
  console.log('');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
