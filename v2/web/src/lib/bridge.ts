import { LANGUES, t, type CodeLangue } from '../i18n';
import type {
  Credentials, DiscoveredCamera, EntreeAlerte, EtatExport, ProtectBridge, RelayState, StepResult, TestOutcome,
} from '../types/protect';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Choix de langue du mode demonstration — vit le temps de la session, rien de plus. */
let langueDemo: CodeLangue | null = null;

/** La langue du navigateur si on la connait, l'anglais sinon — meme regle que le principal. */
function langueNavigateur(): CodeLangue {
  const code = (navigator.language || 'en').toLowerCase().slice(0, 2);
  return code in LANGUES ? (code as CodeLangue) : 'en';
}

const JOUR = 86_400_000;

/** Chemin d'exemple du simulateur. Fictif, comme tout ce qui se montre hors d'Electron. */
const DOSSIER_DEMO = 'C:\\Users\\exemple\\Images\\Alcora';

/**
 * Bornes d'archive du simulateur, calquees sur la mesure du 29.07.2026 : 162 jours au
 * total, dont les 29 derniers en pleine definition. Des valeurs rondes et courtes
 * cacheraient justement le cas que la frise doit savoir dessiner.
 */
const archiveDemo = () => {
  const fin = Date.now();
  return { debut: fin - 162 * JOUR, frontiere: fin - 29 * JOUR, fin };
};

/*
 * L'export d'une plage, simule : la progression defile comme sur le poste — une heure par
 * fichier, l'une apres l'autre —, sans rien ecrire nulle part. Le debit est ralenti pour
 * qu'on ait le temps de voir chaque etat.
 */
const ecouteursExport = new Set<(e: EtatExport) => void>();
let etatExportDemo: EtatExport = { etat: 'aucun' };
let minuterieExport: number | null = null;
function pousserExportDemo(e: EtatExport) {
  etatExportDemo = e;
  for (const h of ecouteursExport) h(e);
}
const NOMS_DEMO: Record<string, string> = { g6: 'G6 Bullet', g5: 'G5 Turret Ultra' };

/*
 * L'historique des alertes, simule : quelques bulles des trois derniers jours, dont une sans
 * image, une avec des retenues et une alerte d'urgence. Fictif, comme tout le simulateur.
 */
const ecouteursAlertes = new Set<(e: { nonVues: number }) => void>();
let alertesDemo: EntreeAlerte[] | null = null;
let vuDemo = 0;
function alertesDeDemo(): EntreeAlerte[] {
  if (alertesDemo) return alertesDemo;
  const m = Date.now();
  const une = (minutes: number, sujet: string, camera: 'g6' | 'g5', veille: [string, string], extra: Partial<EntreeAlerte> = {}): EntreeAlerte => ({
    envoye: m - minutes * 60_000,
    detection: { id: null, type: 'smartDetectZone', camera, debut: m - minutes * 60_000 - 2000, fin: m - minutes * 60_000 + 15_000,
      sujets: [sujet], score: 81 },
    cameraNom: NOMS_DEMO[camera], veilleId: veille[0], veilleNom: veille[1], sujet, image: true, son: true, retenues: 0, ...extra,
  });
  const personne: [string, string] = ['personne', 'Une personne est détectée'];
  const urgence: [string, string] = ['urgence', 'Bris de verre, fumée, sirène, monoxyde'];
  alertesDemo = [
    une(14, 'person', 'g6', personne, { retenues: 3 }),
    une(100, 'person', 'g5', personne, { image: false }),
    une(16 * 60, 'person', 'g6', personne),
    une(26 * 60, 'verre', 'g5', urgence),
    une(50 * 60, 'person', 'g6', personne, { son: false, retenues: 1 }),
  ];
  vuDemo = m - 60 * 60_000;
  return alertesDemo;
}
const nonVuesDemo = () => alertesDeDemo().filter((e) => e.envoye > vuDemo).length;
const pousserAlertesDemo = () => { for (const h of ecouteursAlertes) h({ nonVues: nonVuesDemo() }); };

/**
 * Client simule, pour developper l'interface hors d'Electron.
 *
 * Il reproduit les cas reellement rencontres — pas seulement le chemin heureux. Un
 * formulaire qui n'a jamais ete dessine en situation d'echec est un formulaire qui
 * ressemblera a un plantage le jour ou il echouera.
 */
const mock: ProtectBridge = {
  async isConfigured() { return false; },

  async testConnection(credentials, onStep): Promise<TestOutcome> {
    const fail = (step: StepResult, after: StepResult['step'][]): TestOutcome => {
      onStep(step);
      for (const s of after) onStep({ step: s, state: 'ignore', message: t('etape.nonVerifie') });
      return { ok: false, cameras: [] };
    };

    onStep({ step: 'reseau', state: 'encours', message: t('etape.contact') });
    await sleep(900);

    if (!/^\d+\.\d+\.\d+\.\d+$/.test(credentials.host) && !credentials.host.includes('.')) {
      return fail(
        { step: 'reseau', state: 'echoue',
          message: t('erreur.nomNonResolu', { host: credentials.host }),
          remedy: t('erreur.nomNonResoluRemede') },
        ['certificat', 'identifiants', 'inventaire', 'flux'],
      );
    }
    onStep({ step: 'reseau', state: 'reussi', message: t('etape.repond', { host: credentials.host }) });

    onStep({ step: 'certificat', state: 'encours', message: t('etape.verifIdentite') });
    await sleep(700);
    onStep({ step: 'certificat', state: 'reussi', message: t('etape.premierAppairage') });

    onStep({ step: 'identifiants', state: 'encours', message: t('etape.connexionEnCours') });
    await sleep(1100);

    if (credentials.password.length < 4) {
      return fail(
        { step: 'identifiants', state: 'echoue',
          message: t('erreur.identifiants'),
          remedy: t('erreur.identifiantsRemede') },
        ['inventaire', 'flux'],
      );
    }
    if (credentials.totpSeed && credentials.totpSeed.replace(/\s/g, '').length < 16) {
      return fail(
        { step: 'identifiants', state: 'echoue',
          message: t('erreur.totpRefuse'),
          remedy: t('erreur.totpVerifieCle'),
          technical: 'HTTP 499 — Ubic2faTokenRequired' },
        ['inventaire', 'flux'],
      );
    }
    onStep({ step: 'identifiants', state: 'reussi',
      message: t('etape.connexionAcceptee', { jours: 30 }) });

    onStep({ step: 'inventaire', state: 'encours', message: t('etape.lectureCameras') });
    await sleep(900);

    const cameras: DiscoveredCamera[] = [
      { id: 'g6', name: 'G6 Bullet', model: 'UVC G6 Bullet', online: true, channels: [
        { quality: 'high', width: 3840, height: 2160, fps: 30, bitrate: 16000000, streamable: true },
        { quality: 'medium', width: 1280, height: 720, fps: 30, bitrate: 2000000, streamable: true },
        { quality: 'low', width: 640, height: 360, fps: 30, bitrate: 300000, streamable: true },
      ], archive: archiveDemo() },
      { id: 'g5', name: 'G5 Turret Ultra', model: 'UVC G5 Turret Ultra', online: true, channels: [
        { quality: 'high', width: 2688, height: 1512, fps: 30, bitrate: 10000000, streamable: true },
        { quality: 'medium', width: 1280, height: 720, fps: 30, bitrate: 2000000, streamable: true },
        { quality: 'low', width: 640, height: 360, fps: 30, bitrate: 400000, streamable: true },
      ], archive: archiveDemo() },
    ];

    onStep({ step: 'inventaire', state: 'reussi',
      message: t('etape.camerasTrouvees', { n: 2, nvr: 'UDM-PRO', version: '7.1.87' }) });

    onStep({ step: 'flux', state: 'encours', message: t('etape.verifFlux') });
    await sleep(600);
    onStep({ step: 'flux', state: 'reussi', message: t('etape.diffusables', { n: 2, port: 7447 }) });

    return { ok: true, cameras, discoveredPin: 'sK9v2Qd1', nvrName: 'UDM-PRO', protectVersion: '7.1.87' };
  },

  async save() { /* simule */ },

  async getCameras(): Promise<DiscoveredCamera[]> {
    return [
      { id: 'g6', name: 'G6 Bullet', model: 'UVC G6 Bullet', online: true, channels: [
        { quality: 'high', width: 3840, height: 2160, fps: 30, bitrate: 16000000, streamable: true },
        { quality: 'medium', width: 1280, height: 720, fps: 30, bitrate: 2000000, streamable: true },
        { quality: 'low', width: 640, height: 360, fps: 30, bitrate: 300000, streamable: true },
      ], archive: archiveDemo() },
      { id: 'g5', name: 'G5 Turret Ultra', model: 'UVC G5 Turret Ultra', online: true, channels: [
        { quality: 'high', width: 2688, height: 1512, fps: 30, bitrate: 10000000, streamable: true },
        { quality: 'medium', width: 1280, height: 720, fps: 30, bitrate: 2000000, streamable: true },
        { quality: 'low', width: 640, height: 360, fps: 30, bitrate: 400000, streamable: true },
      ], archive: archiveDemo() },
    ];
  },
  // Chiffres du simulateur : la profondeur vient de la mesure du 29.07, le disque est
  // volontairement presque plein — c'est l'etat NORMAL d'un enregistreur, et c'est ce cas
  // que la colonne doit savoir presenter sans inquieter.
  async systeme() {
    return {
      nom: 'UDM-PRO', version: '7.1.87', versionDisponible: null, versionOs: '5.1.26',
      disque: { total: 5_940_000_000_000, utilise: 5_850_000_000_000 },
      /* La retention annoncee est un FLOTTANT brut chez Protect (393,163460…
         constate en reel le 03.08) et differe de la profondeur mesuree : la
         ligne « Retention annoncee » doit paraitre, ARRONDIE. */
      retentionHaute: 29, retentionBasse: 393.16346061196833,
      parJourHaute: 120_000_000_000, parJourBasse: 9_000_000_000,
      parDefinition: { hd: 0, '2k': 1, '4k': 1 },
      armement: 'disarmed', depuis: Date.now() - 41 * JOUR,
      etatDisque: 'ok', enregistrementSuspendu: false,
      cameras: { total: 2, enLigne: 2 },
      archive: [archiveDemo()],
      alcora: '0.0.0-démo',
    };
  },
  /*
   * Recherche simulee : proportions du releve reel du 29.07.2026 — SUV majoritaires, gris
   * et blanc dominants, une seule camionnette. Des chiffres ronds cacheraient justement ce
   * que l'ecran doit rendre evident.
   */
  async recherche(criteres: import('../types/protect').CriteresRecherche) {
    await sleep(380);
    const TYPES = [['suv', 221], ['car', 37], ['van', 15], ['motorcycle', 12], ['bike', 6], ['truck', 1]] as const;
    const COULEURS = [['gray', 104], ['white', 80], ['black', 43], ['blue', 18], ['yellow', 7]] as const;
    const fin = criteres.jusqua ?? Date.now();
    const objets = Array.from({ length: 48 }, (_, i) => {
      const t = TYPES[i % TYPES.length];
      const c = COULEURS[i % COULEURS.length];
      return {
        id: `demo-${i}`, objectId: `o-${i}`,
        camera: i % 3 ? 'g6' : 'g5', cameraNom: i % 3 ? 'G6 Bullet' : 'G5 Turret Ultra',
        debut: fin - i * 37 * 60000,
        type: 'vehicle',
        confiance: 58 + ((i * 7) % 32),
        vehicule: { valeur: t[0], confiance: 80 + (i % 18) },
        couleur: { valeur: c[0], confiance: 62 + (i % 25) },
        identifie: i % 4 === 0,
        vignette: i % 6 !== 0,
      };
    });
    return {
      objets, total: objets.length, tronque: false,
      recensement: {
        sujets: [{ valeur: 'person', n: 391 }, { valeur: 'vehicle', n: 321 },
                 { valeur: 'animal', n: 63 }, { valeur: 'face', n: 12 }],
        types: TYPES.map(([valeur, n]) => ({ valeur, n })),
        couleurs: COULEURS.map(([valeur, n]) => ({ valeur, n })),
      },
      fenetre: { debut: fin - 7 * JOUR, fin },
    };
  },
  async confort() { return { dossierCaptures: DOSSIER_DEMO, sonParDefaut: false }; },
  async confortEnregistrer(c) { await sleep(200); return c; },
  async choisirDossierCaptures() { return { dossierCaptures: DOSSIER_DEMO, sonParDefaut: false }; },
  async ouvrirCaptures() { /* simule */ },
  async capturer(nom: string) { await sleep(300); return `${DOSSIER_DEMO}\\${nom}.jpg`; },

  /*
   * Veilles simulees : la configuration de depart du processus principal, et les VOLUMES
   * REELS releves sur le poste de reference le 29.07.2026. Des chiffres inventes cacheraient justement
   * ce que l'ecran doit rendre evident — 157 mouvements par jour contre une personne.
   */
  async veilles() {
    return {
      armee: true,
      profils: [{ id: 'nuit', nom: 'Nuit',
        plages: [{ jours: [0, 1, 2, 3, 4, 5, 6], debut: '22:00', fin: '07:00' }] }],
      veilles: [
        { id: 'personne', nom: 'Une personne est détectée', actif: true,
          sujets: ['person'], cameras: [], quand: 'armee' as const, profils: ['nuit'],
          son: true, retenueMs: 300_000 },
        { id: 'urgences', nom: 'Bris de verre, fumée, sirène, monoxyde', actif: true,
          sujets: ['verre', 'fumee', 'sirene', 'co'], cameras: [], quand: 'toujours' as const,
          profils: [], son: true, retenueMs: 60_000 },
      ],
    };
  },
  async veillesEnregistrer(v: import('../types/protect').ConfigVeilles) { await sleep(250); return v; },
  async volumes() {
    await sleep(300);
    return { motion: 157, vehicle: 40, animal: 7, person: 1, aboiement: 1 };
  },
  /**
   * En demonstration, la liaison temps reel est simulee.
   *
   * Sans cela, le bloc des detections recentes reste invisible hors d'Electron et ne peut
   * ni se regarder ni se corriger. Les detections sont fictives, et leur image sera celle
   * d'un instantane absent : c'est exactement l'etat degrade qu'il faut voir aussi.
   */
  onDetectionVive(handler: (d: import('../types/protect').DetectionVive) => void) {
    const modeles = [
      { type: 'smartDetectZone', sujets: ['person'], cam: ['g6', 'G6 Bullet'] },
      { type: 'smartDetectZone', sujets: ['vehicle', 'licensePlate'], cam: ['g5', 'G5 Turret Ultra'] },
      { type: 'smartAudioDetect', sujets: ['alrmBark'], cam: ['g6', 'G6 Bullet'] },
    ];
    let n = 0;
    const minuteurs: ReturnType<typeof setTimeout>[] = [];
    const emettre = () => {
      const m = modeles[n % modeles.length];
      const debut = Date.now() - (n % modeles.length) * 47_000;
      const id = `vive-${n}`;
      n += 1;
      handler({
        id, commence: true, type: m.type, camera: m.cam[0], cameraNom: m.cam[1],
        debut, fin: null, sujets: m.sujets, score: 70 + (n * 9) % 30,
      });
      // La fin arrive plus tard : c'est elle qui rend la vignette disponible.
      minuteurs.push(setTimeout(() => handler({
        id, commence: false, type: m.type, camera: m.cam[0], cameraNom: m.cam[1],
        debut, fin: Date.now(), sujets: m.sujets, score: 70 + (n * 9) % 30,
      }), 6000));
    };
    minuteurs.push(setTimeout(emettre, 900), setTimeout(emettre, 2600), setTimeout(emettre, 5200));
    const boucle = setInterval(emettre, 25_000);
    return () => { clearInterval(boucle); minuteurs.forEach(clearTimeout); };
  },
  onOuvrirDetection() { return () => {}; },
  onRelayState(handler: (s: RelayState) => void) {
    handler({ running: true, message: t('relais.pret') });
    return () => {};
  },
  // La demo n'a pas de vrai relais : l'en-tete est fictif, comme la camera.
  async relais() { return { base: 'http://127.0.0.1:8889', autorisation: 'Basic ZGVtbzpkZW1v' }; },
  async pleinEcran(actif: boolean) { return actif; },
  async retry() { /* simule */ },
  async reconfigure() { /* simule */ },
  async sauvegarde() { return { existe: true, date: new Date().toISOString(), host: '10.0.0.1' }; },
  async restaurer() { return true; },
  async journalPath() { return 'C:\\…\\Alcora\\journal.txt'; },
  async infos() {
    return {
      version: '0.0.0-démo', journal: 'C:\\…\\journal.txt', donnees: 'C:\\…\\Alcora',
      host: '10.0.0.1', username: 'demo@exemple.test', appaire: true,
      electron: '0.0.0-démo', relais: 'v0.0.0-démo',
    };
  },
  async ouvrirJournal() { /* simule */ },
  // La démo n'a pas d'installation : pas de fichier de licences à côté d'un exécutable.
  async ouvrirLicences() { return false; },
  async etats() {
    return {
      relais: { running: true, message: t('relais.pret') },
      maj: { etat: 'aucune' as const },
      progression: { etape: 'demarrage' as const },
      fenetre: { pleinEcran: false },
    };
  },
  // Detections simulees : volumes et sujets repris de la mesure du 28.07.2026, pour que
  // l'ecran soit dessine sur des ordres de grandeur reels et non sur trois exemples.
  async evenements({ avant, limite = 60 } = {}) {
    await sleep(420);
    const fin = avant ?? Date.now();
    const modeles = [
      { type: 'smartDetectZone', sujets: ['person'], cam: ['g6', 'G6 Bullet'] },
      { type: 'motion', sujets: [], cam: ['g6', 'G6 Bullet'] },
      { type: 'smartDetectZone', sujets: ['vehicle', 'licensePlate'], cam: ['g5', 'G5 Turret Ultra'] },
      { type: 'smartAudioDetect', sujets: ['alrmBark'], cam: ['g6', 'G6 Bullet'] },
      { type: 'smartDetectZone', sujets: ['animal'], cam: ['g5', 'G5 Turret Ultra'] },
      { type: 'motion', sujets: [], cam: ['g5', 'G5 Turret Ultra'] },
    ];
    return Array.from({ length: limite }, (_, i) => {
      const m = modeles[i % modeles.length];
      const debut = fin - (i + 1) * 5 * 60_000;
      return {
        id: `demo-${debut}`,
        type: m.type,
        camera: m.cam[0],
        cameraNom: m.cam[1],
        debut,
        // La toute premiere est en cours : c'est le cas que la mesure n'a pas pu trancher.
        fin: i === 0 && !avant ? null : debut + 14_000,
        sujets: m.sujets,
        score: 60 + ((i * 7) % 40),
        vignette: i % 5 !== 0,
      };
    });
  },
  /*
   * Une VRAIE video, meme en demonstration.
   *
   * Jusqu'au 02.08.2026 l'adresse rendue ne designait rien : le lecteur echouait, et tout
   * ce qui exige des pixels reels — le zoom, la detection de piste audio, la capture —
   * etait invisible en developpement. C'est exactement ainsi que le zoom de la relecture a
   * ete livre MORT en 2.18.0 : l'etiquette vivait, l'image non, et rien ici ne pouvait le
   * montrer. Le fichier est une mire synthetique produite par ffmpeg (scripts/fixture) :
   * compteur qui defile — chaque image differe —, details fins a retrouver au zoom, et un
   * la 440 Hz pour la piste audio. Aucune donnee reelle.
   */
  async extraire() { await sleep(700); return { url: '/demo-extrait.mp4', octets: 219_596, marge: 3000 }; },
  onExtraitProgres(handler: (e: { jeton: string; etat: 'demande' | 'obtention' | 'pret'; pourcent: number }) => void) {
    const t: number[] = [];
    for (const p of [15, 45, 80, 100]) {
      t.push(window.setTimeout(
        () => handler({ jeton: 'demo', etat: p === 100 ? 'pret' : 'obtention', pourcent: p }), p * 6));
    }
    return () => t.forEach(clearTimeout);
  },
  // Meme video de mire pour la relecture : les DEUX lecteurs qui se relaient, la cle
  // d'image et le zoom en pause s'exercent ainsi sur de vrais pixels.
  async sequence({ instant, depuis, duree = 10_000 }) {
    await sleep(500);
    const debut = Number.isFinite(depuis)
      ? depuis!
      : Math.floor((instant ?? Date.now()) / duree) * duree;
    return { url: `/demo-extrait.mp4#${debut}`, debut, fin: debut + duree, octets: 219_596 };
  },
  async enregistrerExtrait() { return { enregistre: false }; },
  async exporterPlage({ camera, debut, fin, estimation }) {
    if (minuterieExport !== null) return { lance: false, raison: 'occupe' as const };
    const f = Math.min(fin, Date.now());
    if (!(f - debut >= 1000)) return { lance: false, raison: 'plage' as const };
    const parties = Math.ceil((f - debut) / 3_600_000);
    const commun = { camera: NOMS_DEMO[camera] ?? camera, debut, fin: f, parties, estimation };
    // Le poids de la demo : celui de la mire, ou l'estimation de la page quand elle en a une.
    const total = estimation > 0 ? estimation / parties : 4_000_000;
    let partie = 1;
    let recu = 0;
    pousserExportDemo({ etat: 'encours', ...commun, partie, recu: 0, total: 0, recuAvant: 0 });
    minuterieExport = window.setInterval(() => {
      recu = Math.min(total, recu + total / 24);
      const recuAvant = (partie - 1) * total;
      if (recu < total) {
        pousserExportDemo({ etat: 'encours', ...commun, partie, recu, total, recuAvant, debit: total / 6 });
        return;
      }
      if (partie < parties) { partie += 1; recu = 0; return; }
      window.clearInterval(minuterieExport!);
      minuterieExport = null;
      const fichiers = Array.from({ length: parties }, (_, i) =>
        parties === 1 ? 'exemple.mp4' : `exemple (${i + 1}-${parties}).mp4`);
      pousserExportDemo({ etat: 'termine', ...commun, octets: total * parties, vides: 0, fichiers,
        dossier: 'C:\\Users\\exemple\\Videos' });
    }, 250);
    return { lance: true, fichiers: [] };
  },
  async exportAnnuler() {
    if (minuterieExport === null || etatExportDemo.etat !== 'encours') return false;
    window.clearInterval(minuterieExport);
    minuterieExport = null;
    const { camera, debut, fin, parties, estimation } = etatExportDemo;
    pousserExportDemo({ etat: 'annule', camera, debut, fin, parties, estimation, faits: 0 });
    return true;
  },
  async exportEtat() { return etatExportDemo; },
  async alertes() { return { entrees: [...alertesDeDemo()], nonVues: nonVuesDemo() }; },
  async alertesVues() { vuDemo = Date.now(); pousserAlertesDemo(); },
  async alertesEffacer() { alertesDemo = []; pousserAlertesDemo(); },
  onAlertes(handler: (e: { nonVues: number }) => void) {
    ecouteursAlertes.add(handler);
    return () => { ecouteursAlertes.delete(handler); };
  },
  async exportMontrer() { return false; },
  onExportEtat(handler: (e: EtatExport) => void) {
    ecouteursExport.add(handler);
    return () => { ecouteursExport.delete(handler); };
  },
  async autoDemarrage() { return { actif: false, disponible: true }; },
  async autoDemarrageChanger(actif: boolean) { return { actif, disponible: true }; },
  onMajState() { return () => {}; },
  // Les jalons defilent comme sur le poste reel, pour repeter l'introduction en
  // developpement sans controleur.
  onProgression(handler: (p: { etape: 'demarrage' | 'session' | 'inventaire' }) => void) {
    const t1 = setTimeout(() => handler({ etape: 'session' }), 700);
    const t2 = setTimeout(() => handler({ etape: 'inventaire' }), 1400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  },
  // En demonstration, la langue suit le navigateur et le choix ne vit que pour la session.
  async langue() {
    return { choix: langueDemo ?? ('auto' as const), effective: langueDemo ?? langueNavigateur() };
  },
  async langueChanger(choix: CodeLangue | 'auto') {
    langueDemo = choix === 'auto' ? null : choix;
    return { choix: langueDemo ?? ('auto' as const), effective: langueDemo ?? langueNavigateur() };
  },
  // En demonstration on presente les trois dernieres versions : l'ecran se regarde
  // et se regle sans attendre une vraie mise a jour.
  async nouveautes() {
    const { VERSIONS } = await import('../versions');
    return VERSIONS.length > 3
      ? { de: VERSIONS[3].version, a: VERSIONS[0].version }
      : null;
  },
  async nouveautesVues() { /* simule */ },
  async contexteMesure() { /* la demo ne mesure rien */ },
  async majVerifier() { /* simule */ },
  async majRedemarrer() { return false; },
};

/*
 * Le simulateur ne doit JAMAIS servir de secours dans l'application livree.
 *
 * Il donnait auparavant le dernier mot au simulateur des que le pont manquait. Dans
 * l'application installee, un preload defaillant affichait donc deux cameras inventees,
 * l'air parfaitement en ordre, et un relais fictif : l'utilisateur voyait une application
 * qui « marche » sans une seule image, et rien nulle part n'expliquait pourquoi.
 *
 * « import.meta.env.DEV » est resolu a la construction : en production, le simulateur et
 * ses fausses cameras sont retires du paquet, ils ne peuvent donc plus surgir.
 */
export const pontDisponible = Boolean(window.protect) || import.meta.env.DEV;

// La conversion est sure derriere « pontDisponible », que l'interface verifie avant tout
// autre affichage — sans quoi elle refuse de se dessiner.
export const bridge = (window.protect ?? (import.meta.env.DEV ? mock : undefined)) as ProtectBridge;

export const isMocked = !window.protect;

export type { Credentials, DiscoveredCamera, StepResult, TestOutcome };
