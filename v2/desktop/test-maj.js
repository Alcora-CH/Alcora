'use strict';

/**
 * La chaine de mise a jour, eprouvee hors ligne.
 *
 *   node test-maj.js
 *
 * Ecrite APRES coup, le 30.07.2026, pour un defaut que rien ne surveillait : entre le 29 et
 * le 30 juillet, CINQ mises a jour d'affilee ont ete refusees sur le poste de reference avec
 * le meme message — « taille juste, contenu altere ». Les paquets etaient sains : leur
 * empreinte, recalculee depuis le disque, est juste pour les quinze qui y sont encore.
 *
 * Ce qui echouait etait la RELECTURE du fichier de 148 Mo, juste apres son ecriture, alors
 * que Windows l'examinait encore. L'erreur d'ouverture etait avalee :
 *
 *     .on('error', () => resoudre(false));
 *
 * et rendue exactement comme une empreinte differente. L'application effacait donc un
 * paquet intact, en retelechargeait 148 Mo, et abandonnait au second echec — au demarrage
 * seulement, la ou le disque est le plus sollicite. Manuellement, dix secondes plus tard,
 * la meme mise a jour passait.
 *
 * Ces verifications tiennent le contrat qui empeche ce defaut de revenir :
 *   · l'empreinte est calculee sur les octets RECUS, dans la meme passe que l'ecriture ;
 *   · « illisible » et « different » ne se confondent JAMAIS ;
 *   · un fichier illisible n'est pas efface, et ne fait pas conclure a une corruption.
 *
 * Aucun reseau, aucun controleur : le telechargement est simule par un lecteur de memoire.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { GestionnaireMaj } = require('./maj');

let echecs = 0;

function check(label, attendu, obtenu) {
  const ok = JSON.stringify(attendu) === JSON.stringify(obtenu);
  if (!ok) echecs++;
  console.log(`${ok ? '  OK  ' : ' ECHEC'}  ${label.padEnd(52)} ${ok ? '' : ''}`);
  if (!ok) {
    console.log(`          attendu = ${JSON.stringify(attendu)}`);
    console.log(`          obtenu  = ${JSON.stringify(obtenu)}`);
  }
}

function checkBool(label, condition) {
  if (!condition) echecs++;
  console.log(`${condition ? '  OK  ' : ' ECHEC'}  ${label}`);
}

const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex').toUpperCase();

/** Journal muet, dont on garde les lignes pour verifier CE QUI EST DIT. */
function journalDeTest() {
  const lignes = [];
  const noter = (niveau) => (quoi, message) => lignes.push(`${niveau} ${quoi} ${message}`);
  return {
    lignes,
    info: noter('info'),
    alerte: noter('alerte'),
    erreur: noter('erreur'),
    contient: (motif) => lignes.some((l) => l.includes(motif)),
  };
}

/** Reponse de type fetch, servie depuis la memoire. */
function reponseDe(octets) {
  return {
    ok: true,
    status: 200,
    body: new ReadableStream({
      start(controleur) {
        // En plusieurs morceaux : c'est ainsi que le reseau livre, et c'est ce qui
        // exerce le compteur et le hachage incremental.
        for (let i = 0; i < octets.length; i += 64 * 1024) {
          controleur.enqueue(new Uint8Array(octets.subarray(i, i + 64 * 1024)));
        }
        controleur.close();
      },
    }),
  };
}

function gestionnaire({ contenu, journal, version = '1.0.0' }) {
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'alcora-maj-'));
  const g = new GestionnaireMaj({
    version,
    dossier,
    executable: path.join(dossier, 'current', 'Alcora.exe'),
    fetcher: async () => reponseDe(contenu),
    journal,
    onEtat: () => {},
  });
  return { g, dossier };
}

const PAQUET = Buffer.from('paquet Alcora factice — '.repeat(4096), 'utf8');
const cibleDe = (octets, version = '2.0.0') => ({
  Version: version,
  FileName: `Alcora-${version}-full.nupkg`,
  Size: octets.length,
  SHA256: sha(octets),
  Type: 'Full',
  PackageId: 'Alcora',
});

(async () => {

  console.log('\n=== Le cas normal ===');
  {
    const journal = journalDeTest();
    const { g, dossier } = gestionnaire({ contenu: PAQUET, journal });
    const cible = cibleDe(PAQUET);
    const prete = await g.telechargerEtVerifier(cible);

    check('version declaree prete', '2.0.0', prete.version);
    checkBool('le fichier existe', fs.existsSync(prete.fichier));
    check('taille sur disque', PAQUET.length, fs.statSync(prete.fichier).size);
    checkBool('le journal l’annonce', journal.contient('ready to apply'));
    checkBool('aucun fichier .part ne reste',
      !fs.readdirSync(dossier).some((f) => f.endsWith('.part')));
  }

  console.log('\n=== L’empreinte porte sur les octets RECUS ===');
  {
    /*
     * Le coeur de la correction. Le fichier est efface du disque juste apres l'ecriture,
     * AVANT toute relecture : si la verification dependait encore du disque, elle
     * echouerait. Elle doit passer, puisque les octets recus etaient les bons.
     */
    const journal = journalDeTest();
    const { g } = gestionnaire({ contenu: PAQUET, journal });
    const cible = cibleDe(PAQUET);

    const vraiTelecharger = g.telecharger.bind(g);
    g.telecharger = async (...args) => {
      const r = await vraiTelecharger(...args);
      fs.rmSync(args[1], { force: true });   // le disque se derobe
      return r;
    };

    const prete = await g.telechargerEtVerifier(cible);
    check('acceptee malgre un disque illisible', '2.0.0', prete.version);
    checkBool('et le journal le DIT', journal.contient('on-disk check impossible'));
  }

  console.log('\n=== Une lecture impossible n’est pas une corruption ===');
  {
    const journal = journalDeTest();
    const { g, dossier } = gestionnaire({ contenu: PAQUET, journal });
    const chemin = path.join(dossier, 'absent.nupkg');

    const etat = await g.empreinteDuDisque(chemin, sha(PAQUET), 2);
    check('etat rendu', 'illisible', etat.etat);
    check('la cause est nommee', 'ENOENT', etat.code);
  }

  console.log('\n=== Une empreinte differente reste une corruption ===');
  {
    const journal = journalDeTest();
    const { g, dossier } = gestionnaire({ contenu: PAQUET, journal });
    const chemin = path.join(dossier, 'autre.nupkg');
    fs.writeFileSync(chemin, Buffer.from('autre chose'));

    const etat = await g.empreinteDuDisque(chemin, sha(PAQUET), 4);
    check('etat rendu', 'different', etat.etat);
    check('deux lectures concordantes suffisent', 2, etat.lectures);
    check('la taille obtenue est rapportee', 11, etat.taille);
  }

  console.log('\n=== Une relecture INCOHERENTE n’accuse pas le fichier ===');
  {
    /*
     * Le cas qui manquait, et que le poste a revele le 31.07.2026 : la premiere relecture
     * rend une empreinte fausse, la suivante la bonne. Le fichier n'a pas change — c'est la
     * LECTURE qui etait incoherente. Conclure « altere » des la premiere divergence faisait
     * abandonner une mise a jour dont les octets etaient pourtant justes.
     */
    const journal = journalDeTest();
    const { g, dossier } = gestionnaire({ contenu: PAQUET, journal });
    const chemin = path.join(dossier, 'sain.nupkg');
    fs.writeFileSync(chemin, PAQUET);

    let premiere = true;
    const vraie = g.lireEmpreinte.bind(g);
    g.lireEmpreinte = async (f) => {
      if (premiere) { premiere = false; return { ok: true, valeur: sha(Buffer.from('faux')) }; }
      return vraie(f);
    };

    const etat = await g.empreinteDuDisque(chemin, sha(PAQUET), 4);
    check('conclusion', 'conforme', etat.etat);
    check('obtenue a la deuxieme lecture', 2, etat.lectures);
    checkBool('et l’incohérence est CONSIGNÉE', journal.contient('inconsistent reread'));
  }

  console.log('\n=== Deux lectures fausses mais DIFFERENTES : on insiste ===');
  {
    // Deux valeurs fausses qui ne s'accordent pas ne prouvent rien non plus : seule leur
    // concordance condamne. Ici la troisieme lecture est bonne, et elle doit gagner.
    const journal = journalDeTest();
    const { g, dossier } = gestionnaire({ contenu: PAQUET, journal });
    const chemin = path.join(dossier, 'sain2.nupkg');
    fs.writeFileSync(chemin, PAQUET);

    let n = 0;
    const vraie = g.lireEmpreinte.bind(g);
    g.lireEmpreinte = async (f) => {
      n += 1;
      if (n === 1) return { ok: true, valeur: sha(Buffer.from('faux A')) };
      if (n === 2) return { ok: true, valeur: sha(Buffer.from('faux B')) };
      return vraie(f);
    };

    const etat = await g.empreinteDuDisque(chemin, sha(PAQUET), 4);
    check('conclusion', 'conforme', etat.etat);
    check('a la troisieme lecture', 3, etat.lectures);
  }

  console.log('\n=== Le verrou passager cede a la reprise ===');
  {
    /*
     * Un fichier verrouille aux deux premieres tentatives, lisible a la troisieme : c'est
     * le comportement de l'antivirus sur une archive fraichement fermee. La reprise doit
     * conclure « conforme », et non « different ».
     */
    const journal = journalDeTest();
    const { g, dossier } = gestionnaire({ contenu: PAQUET, journal });
    const chemin = path.join(dossier, 'verrouille.nupkg');
    fs.writeFileSync(chemin, PAQUET);

    let refus = 2;
    const vraie = g.lireEmpreinte.bind(g);
    g.lireEmpreinte = async (f) => (refus-- > 0 ? { ok: false, code: 'EBUSY' } : vraie(f));

    const etat = await g.empreinteDuDisque(chemin, sha(PAQUET), 4);
    check('etat apres deux refus', 'conforme', etat.etat);
    check('toutes les reprises n’ont pas ete consommees', true, refus < 0);
  }

  console.log('\n=== Contenu altere en transit : rejet franc ===');
  {
    const journal = journalDeTest();
    const abime = Buffer.from(PAQUET);
    abime[1234] ^= 0xff;                       // meme LONGUEUR, contenu different
    const { g } = gestionnaire({ contenu: abime, journal });
    const cible = cibleDe(PAQUET);              // on attend l'empreinte du bon paquet

    let erreur = null;
    await g.telechargerEtVerifier(cible).catch((e) => { erreur = e.message; });
    check('la mise a jour est refusee', 'invalid package fingerprint', erreur);
    checkBool('le message nomme le transit',
      journal.contient('size right, content altered in transit'));
    checkBool('deux essais ont eu lieu', journal.contient('attempt 2'));
  }

  console.log('\n=== Taille incorrecte : le message differe ===');
  {
    const journal = journalDeTest();
    const court = PAQUET.subarray(0, PAQUET.length - 500);
    const { g } = gestionnaire({ contenu: court, journal });
    const cible = cibleDe(PAQUET);

    await g.telechargerEtVerifier(cible).catch(() => {});
    checkBool('le message nomme la taille', journal.contient('(wrong size)'));
    checkBool('et non le transit', !journal.contient('content altered in transit'));
  }

  console.log('\n=== Un paquet deja present n’est pas retelecharge ===');
  {
    const journal = journalDeTest();
    const { g, dossier } = gestionnaire({ contenu: PAQUET, journal });
    const cible = cibleDe(PAQUET);
    fs.writeFileSync(path.join(dossier, cible.FileName), PAQUET);

    let telecharge = false;
    g.telecharger = async () => { telecharge = true; };

    const prete = await g.telechargerEtVerifier(cible);
    check('acceptee sans reseau', '2.0.0', prete.version);
    check('aucun telechargement', false, telecharge);
    checkBool('le journal le dit', journal.contient('already downloaded and verified'));
  }

  console.log('\n=== Un paquet present mais illisible n’est pas efface ===');
  {
    /*
     * Le scenario exact du poste, au lancement suivant : le paquet est la, intact, mais la
     * lecture echoue. L'ancienne version l'effacait et retelechargeait 148 Mo. Desormais
     * elle le retelecharge — c'est acceptable — mais elle ne l'ACCUSE plus, et le journal
     * dit ce qui s'est reellement passe.
     */
    const journal = journalDeTest();
    const { g, dossier } = gestionnaire({ contenu: PAQUET, journal });
    const cible = cibleDe(PAQUET);
    fs.writeFileSync(path.join(dossier, cible.FileName), PAQUET);

    let refus = 99;
    const vraie = g.lireEmpreinte.bind(g);
    g.lireEmpreinte = async (f) => (refus-- > 0 ? { ok: false, code: 'EBUSY' } : vraie(f));

    const prete = await g.telechargerEtVerifier(cible);
    check('la mise a jour aboutit quand meme', '2.0.0', prete.version);
    checkBool('« illisible » est dit', journal.contient('unreadable (EBUSY)'));
    checkBool('« altéré » n’est JAMAIS dit', !journal.contient('altered'));
  }

  console.log('\n=== Les octets haches sont CEUX qui partent au fichier ===');
  {
    /*
     * La correction du 31.07.2026, eprouvee sur son mecanisme meme.
     *
     * On simule ce que fait Chromium : la memoire du morceau est REUTILISEE juste apres
     * avoir ete remise au flux. Avec l'ancien montage — hachage synchrone dans un ecouteur
     * « data », ecriture asynchrone par-dessous — le fichier recevait les octets recycles
     * pendant que l'empreinte gardait les bons. Avec la copie defensive, le fichier et
     * l'empreinte decrivent la meme matiere.
     */
    /*
     * L'invariant, et non le scenario. Reproduire fidelement le recyclage de memoire de
     * Chromium hors d'Electron n'est pas possible : selon l'instant ou la memoire est
     * reprise, on obtiendrait tantot un fichier faux, tantot rien du tout. Ce qui SE teste,
     * en revanche, est la propriete qui rend ce defaut impossible :
     *
     *   l'empreinte rendue decrit TOUJOURS le fichier ecrit.
     *
     * Elle doit tenir quoi que fasse la source. Si elle tient, alors une empreinte conforme
     * garantit un fichier conforme, et le symptome du poste — « recu intact, disque
     * different » — ne peut plus se produire. L'ancien montage ne l'offrait pas : il hachait
     * une memoire qu'un tiers pouvait reprendre avant l'ecriture.
     */
    const journal = journalDeTest();
    const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'alcora-maj-'));
    const tampon = new Uint8Array(64 * 1024);
    let i = 0;
    const g = new GestionnaireMaj({
      version: '1.0.0',
      dossier,
      executable: path.join(dossier, 'Alcora.exe'),
      journal,
      onEtat: () => {},
      fetcher: async () => ({
        ok: true,
        status: 200,
        body: new ReadableStream({
          pull(controleur) {
            if (i >= PAQUET.length) { controleur.close(); return; }
            const tranche = PAQUET.subarray(i, i + 64 * 1024);
            i += 64 * 1024;
            // Un seul tampon, remis a la file… puis REPRIS peu apres, comme le ferait
            // le moteur reseau qui recycle ses memoires tampons.
            tampon.set(tranche);
            controleur.enqueue(tampon.subarray(0, tranche.length));
            setImmediate(() => tampon.fill(0x5a));
          },
        }),
      }),
    });

    const destination = path.join(dossier, 'essai.nupkg');
    const { empreinte, recu } = await g.telecharger('http://x', destination, PAQUET.length, '1');

    check('tous les octets sont passés', PAQUET.length, recu);
    check('l’empreinte rendue décrit le fichier écrit',
      empreinte, sha(fs.readFileSync(destination)));
  }

  console.log('\n=== Les anciens paquets sont effacés ===');
  {
    const journal = journalDeTest();
    const { g, dossier } = gestionnaire({ contenu: PAQUET, journal });
    // Trois versions appliquees jadis, plus un fichier qui n'est pas un paquet.
    for (const v of ['2.1.0', '2.2.0', '2.3.0']) {
      fs.writeFileSync(path.join(dossier, `Alcora-${v}-full.nupkg`), Buffer.alloc(1000));
    }
    fs.writeFileSync(path.join(dossier, 'journal-a-garder.txt'), 'x');

    const prete = await g.telechargerEtVerifier(cibleDe(PAQUET));
    const restants = fs.readdirSync(dossier).filter((f) => f.endsWith('.nupkg'));
    check('un seul paquet subsiste', ['Alcora-2.0.0-full.nupkg'], restants);
    checkBool('c’est celui qui vient d’arriver', prete.fichier.endsWith('Alcora-2.0.0-full.nupkg'));
    checkBool('les autres fichiers sont intacts',
      fs.existsSync(path.join(dossier, 'journal-a-garder.txt')));
    checkBool('la place libérée est dite', journal.contient('old packages deleted'));
  }

  console.log('\n=== Un paquet deja pret n’est pas efface par le balayage ===');
  {
    const journal = journalDeTest();
    const { g, dossier } = gestionnaire({ contenu: PAQUET, journal });
    const cible = cibleDe(PAQUET);
    fs.writeFileSync(path.join(dossier, cible.FileName), PAQUET);

    const prete = await g.telechargerEtVerifier(cible);
    checkBool('il est toujours la', fs.existsSync(prete.fichier));
    checkBool('et reconnu sans retelechargement',
      journal.contient('already downloaded and verified'));
  }

  console.log('\n=== Un seul telechargement par version a la fois ===');
  {
    const journal = journalDeTest();
    const { g } = gestionnaire({ contenu: PAQUET, journal });
    const cible = cibleDe(PAQUET);

    let appels = 0;
    const vraiTelecharger = g.telecharger.bind(g);
    g.telecharger = (...a) => { appels += 1; return vraiTelecharger(...a); };

    const [a, b] = await Promise.all([g.obtenir(cible), g.obtenir(cible)]);
    check('un seul telechargement', 1, appels);
    checkBool('les deux appelants ont le meme resultat', a === b);
  }

  console.log('\n=== Comparaison des versions ===');
  {
    checkBool('2.16.0 > 2.15.0', GestionnaireMaj.plusRecente('2.16.0', '2.15.0'));
    checkBool('2.10.0 > 2.9.1', GestionnaireMaj.plusRecente('2.10.0', '2.9.1'));
    checkBool('2.9.1 n’est pas > 2.10.0', !GestionnaireMaj.plusRecente('2.9.1', '2.10.0'));
    checkBool('egales : aucune n’est plus recente',
      !GestionnaireMaj.plusRecente('2.15.0', '2.15.0'));
    checkBool('2.15 vaut 2.15.0', !GestionnaireMaj.plusRecente('2.15', '2.15.0'));
  }

  console.log(echecs === 0 ? '\nTOUS LES TESTS PASSENT\n' : `\n${echecs} ÉCHEC(S)\n`);
  process.exit(echecs === 0 ? 0 : 1);
})().catch((e) => {
  // Une exception inattendue est un ECHEC, pas un plantage : elle doit se lire comme tel.
  console.log(`\n ECHEC  exception : ${e.message}\n`);
  process.exit(1);
});
