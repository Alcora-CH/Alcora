'use strict';

/**
 * Traduction de l'inventaire du controleur vers le modele de l'application.
 *
 * Rien n'est code en dur : ni les resolutions, ni le port RTSP, ni le nombre de canaux.
 * Le controleur fait autorite sur tout cela, et les modeles de cameras different.
 */

const QUALITIES = ['high', 'medium', 'low', 'package'];

/** L'identifiant de canal EST l'indice de qualite chez Protect. */
function mapQuality(channelId) {
  return QUALITIES[channelId] ?? 'low';
}

/**
 * Bornes de l'archive d'une camera, telles que la frise doit les dessiner.
 *
 * Mesure du 29.07.2026 (V-Frise, voir docs/contraintes-verifiees.md) : les deux champs de
 * l'inventaire existent tous les deux, mais aucun ne signifie ce que son nom suggere.
 *
 *   recordingStartLQ  = debut REEL de l'archive          — 162 jours sur ce materiel
 *   recordingStart    = fin de la HAUTE definition       —  29 jours seulement
 *
 * Prendre `recordingStart` pour bord gauche amputerait la frise de 133 jours de video qui
 * existe et se lit parfaitement. Au-dela de cette frontiere, l'export rend 640 x 360 la ou
 * il rendait 3840 x 2160 : un facteur trente-six en pixels, que l'interface doit annoncer.
 *
 * Les valeurs sont reconstruites par min/max plutot que lues telles quelles : un firmware
 * qui inverserait les deux champs, ou n'en fournirait qu'un, ne doit pas produire une frise
 * a l'envers ou vide.
 */
function bornesArchive(dto, maintenant = Date.now()) {
  const v = dto?.stats?.video ?? {};
  const nombres = [v.recordingStart, v.recordingStartLQ].filter((n) => Number.isFinite(n) && n > 0);
  if (!nombres.length) return null;

  const debut = Math.min(...nombres);
  const fin = Number.isFinite(v.recordingEnd) && v.recordingEnd > debut ? v.recordingEnd : maintenant;

  // La frontiere n'a de sens que si elle tombe STRICTEMENT a l'interieur de l'archive.
  // Retentions egales (une seule qualite conservee) : rien a signaler, la barre est unie.
  const haute = Number.isFinite(v.recordingStart) ? v.recordingStart : null;
  const frontiere = haute !== null && haute > debut && haute < fin ? haute : null;

  return { debut, frontiere, fin };
}

function mapCamera(dto) {
  const channels = (dto.channels ?? [])
    .filter((c) => c.enabled !== false)
    .map((c) => ({
      quality: mapQuality(c.id),
      width: c.width ?? 0,
      height: c.height ?? 0,
      fps: c.fps ?? 0,
      bitrate: c.bitrate ?? 0,
      // Un canal dont le RTSP est desactive n'a pas d'alias : il devient
      // automatiquement indiffusable, sans cas particulier ailleurs.
      rtspAlias: c.isRtspEnabled === true ? c.rtspAlias ?? null : null,
      get streamable() { return Boolean(this.rtspAlias); },
    }))
    .sort((a, b) => QUALITIES.indexOf(a.quality) - QUALITIES.indexOf(b.quality));

  return {
    id: dto.id,
    name: dto.name?.trim() || 'Camera',
    model: dto.type,
    online: String(dto.state).toUpperCase() === 'CONNECTED',
    channels,
    /** { debut, frontiere, fin } en millisecondes, ou null si le controleur se tait. */
    archive: bornesArchive(dto),
  };
}

/** Lit une valeur imbriquee sans supposer que le chemin existe. */
function valeur(objet, chemin) {
  let v = objet;
  for (const cle of chemin.split('.')) {
    if (v === null || typeof v !== 'object') return undefined;
    v = v[cle];
  }
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined;
}

/**
 * Etat du controleur, pour la colonne d'etat.
 *
 * Les chemins du STOCKAGE sont cherches parmi plusieurs candidats au lieu d'etre supposes :
 * la sonde V-Frise n'a rien trouve la ou je les attendais, et les noms de champs changent
 * d'une version de Protect a l'autre. Ce qui n'est pas trouve n'est pas invente — le bloc
 * disparait de l'interface plutot que d'afficher un chiffre faux.
 *
 * `clesNvr` n'est PAS destinee a l'interface : elle part au journal, une fois, pour qu'on
 * puisse voir sur le poste reel comment ce controleur-la nomme ses champs.
 */
const CHEMINS_TOTAL = [
  'storageInfo.totalSize', 'systemInfo.storage.size', 'storageStats.capacity',
  'systemInfo.ustorage.space.0.size', 'storageInfo.capacity',
];
const CHEMINS_UTILISE = [
  'storageInfo.totalSpaceUsed', 'systemInfo.storage.used', 'storageStats.used',
  'systemInfo.ustorage.space.0.used', 'storageInfo.used',
];

/** Un apercu court et sur d'une valeur inconnue : son type, et sa forme si elle est breve. */
function apercu(valeur, max = 200) {
  if (valeur === undefined) return 'absent';
  if (valeur === null) return 'null';
  let rendu;
  try { rendu = JSON.stringify(valeur); } catch { return `${typeof valeur} (illisible)`; }
  if (rendu === undefined) return typeof valeur;
  return rendu.length > max ? `${typeof valeur} ${rendu.slice(0, max)}…` : rendu;
}

function etatSysteme(bootstrap) {
  const nvr = bootstrap?.nvr ?? {};
  const total = CHEMINS_TOTAL.map((c) => valeur(nvr, c)).find((v) => v !== undefined);
  const utilise = CHEMINS_UTILISE.map((c) => valeur(nvr, c)).find((v) => v !== undefined);

  const texte = (v) => (typeof v === 'string' && v ? v : null);
  const nombre = (v) => (Number.isFinite(v) ? v : null);

  return {
    nom: texte(nvr.name),
    version: texte(nvr.version),
    /** Mise a jour du controleur disponible. Montree, jamais appliquee : ce n'est pas a nous. */
    versionDisponible: texte(nvr.availableVersion),
    /** UniFi OS. Nom de champ releve dans le journal du poste, pas devine. */
    versionOs: texte(nvr.ucoreVersion) ?? texte(nvr.firmwareVersion),
    // Les deux doivent etre presents ET coherents, sinon la jauge mentirait.
    disque: total && utilise && utilise <= total ? { total, utilise } : null,
    /**
     * Retentions ESTIMEES par le controleur lui-meme, en jours.
     *
     * Elles disent ce qu'il PREVOIT de garder ; les bornes d'archive disent ce qu'il a
     * REELLEMENT. Les deux valent d'etre montrees : l'ecart previent d'un disque qui se
     * remplit plus vite que prevu.
     */
    retentionHaute: nombre(nvr.estimatedHqRetentionDays),
    retentionBasse: nombre(nvr.estimatedLqRetentionDays),
    /** Octets ecrits par jour, par qualite. Ce que coute la surveillance, chiffre. */
    parJourHaute: nombre(nvr.totalHqBytesPerDay),
    parJourBasse: nombre(nvr.totalLqBytesPerDay),
    /*
     * `cameraUtilization` et `maxCameraCapacity` existent bien dans l'inventaire de ce
     * controleur, mais leur UNITE n'a pas ete mesuree — un pourcentage et un nombre de
     * cameras se ressemblent trop pour qu'on devine. Rien n'est donc rendu : mieux vaut
     * une absence qu'un « 2 / 20 » qui voudrait dire tout autre chose.
     */
    /** Repartition des cameras par definition — HD, 2K, 4K/5K, comme chez Protect. */
    parDefinition: repartitionDefinitions(bootstrap),
    /**
     * Armement de PROTECT. Alcora a le sien, independant et assume ; les montrer cote a
     * cote vaut mieux que d'avertir qu'ils peuvent diverger.
     *
     * `armMode` n'est PAS une chaine — releve sur le poste le 31.07.2026, apres deux jours
     * ou la ligne restait muette sans qu'on sache pourquoi :
     *
     *   armMode = { status: 'disabled', armProfileId: '…', armedAt: null,
     *               willBeArmedAt: null, breachDetectedAt: …, breachEventCount: 0, … }
     *
     * La forme chaine reste acceptee : rien ne dit que toutes les versions de Protect
     * rendent un objet, et la lecture ne doit pas se casser sur l'autre forme.
     */
    armement: texte(nvr.armMode) ?? texte(nvr.armMode?.status),
    /** Allume depuis. */
    depuis: nombre(Date.parse(nvr.upSince)) ?? nombre(nvr.upSince),
    etatDisque: texte(nvr.hardDriveState),
    enregistrementSuspendu: nvr.isRecordingDisabled === true,
    clesNvr: Object.keys(nvr).sort(),
    /**
     * Forme BRUTE des champs dont la lecture a echoue sans qu'on sache pourquoi.
     *
     * Destinee au journal, jamais a l'interface — comme `clesNvr`, elle ne franchit pas le
     * pont. Bornee a quelques centaines de caracteres : il s'agit de voir une FORME, pas
     * de recopier un inventaire.
     */
    brut: {
      armMode: apercu(nvr.armMode),
      alarmSettings: apercu(nvr.alarmSettings),
    },
  };
}

/**
 * Combien de cameras dans chaque classe de definition.
 *
 * Protect affiche « HD x0, 2K x1, 4K/5K x1 ». On le recalcule depuis les canaux plutot que
 * de chercher un champ : c'est la meme information, et elle reste juste si une camera
 * change de reglage.
 */
function repartitionDefinitions(bootstrap) {
  const compte = { hd: 0, '2k': 0, '4k': 0 };
  for (const c of bootstrap?.cameras ?? []) {
    if (c?.isAdopted === false) continue;
    const h = Math.max(0, ...(c.channels ?? []).map((ch) => ch.height ?? 0));
    if (h >= 1800) compte['4k'] += 1;
    else if (h >= 1200) compte['2k'] += 1;
    else if (h > 0) compte.hd += 1;
  }
  return compte;
}

/**
 * @returns {{cameras: object[], warnings: string[], rtspPort: number|null,
 *            nvrName: string|undefined, protectVersion: string|undefined,
 *            systeme: object}}
 */
function fromBootstrap(bootstrap) {
  const cameras = [];
  const warnings = [];

  for (const dto of bootstrap.cameras ?? []) {
    if (!dto?.id) continue;
    if (dto.isAdopted === false) continue;   // appairee ailleurs

    const camera = mapCamera(dto);
    cameras.push(camera);

    if (!camera.channels.some((c) => c.rtspAlias)) {
      warnings.push(
        `${camera.name}: RTSP is disabled on all its channels. ` +
        'Enable it in Protect, on the camera, Advanced section.',
      );
    } else if (!camera.online) {
      warnings.push(`${camera.name}: offline.`);
    }
  }

  if (cameras.length === 0) warnings.push('The controller reported no camera.');

  return {
    cameras,
    warnings,
    // Le port RTSP est un reglage de console : il se lit, il ne se devine pas.
    rtspPort: bootstrap.nvr?.ports?.rtsp ?? null,
    nvrName: bootstrap.nvr?.name,
    protectVersion: bootstrap.nvr?.version,
    systeme: etatSysteme(bootstrap),
  };
}

/** Construit les chemins a publier par le relais, a partir des canaux diffusables. */
function relayPaths(cameras, { host, rtspPort }) {
  const paths = [];
  for (const cam of cameras) {
    for (const ch of cam.channels) {
      if (!ch.rtspAlias) continue;
      paths.push({
        path: `${cam.id}_${ch.quality}`,
        url: `rtsp://${host}:${rtspPort}/${ch.rtspAlias}`,
      });
    }
  }
  return paths;
}

/**
 * Ce que la PAGE recoit, a partir de ce que le controleur a dit.
 *
 * Fonction a part, et pure, pour une raison apprise le 30.07.2026 : cette projection vivait
 * dans un `ipcMain.handle` qui enumerait ses champs a la main. Six champs ajoutes ce jour-la
 * — definitions, UniFi OS, ecrit par jour, allume depuis, armement de Protect, retentions —
 * ont ete calcules par etatSysteme(), declares dans le contrat TypeScript, affiches par la
 * colonne… et silencieusement jetes au passage. Rien ne pouvait le voir : le contrat decrit
 * ce que la page ATTEND, et le processus principal est en JavaScript, ou aucun type ne
 * s'applique.
 *
 * Sortie d'ici, la projection est verifiable hors ligne : test-contrat.js compare ses cles a
 * celles de l'interface `SystemeEtat`, et echoue si l'une des deux prend de l'avance.
 *
 * `clesNvr` ne passe PAS : c'est une aide au diagnostic, destinee au journal, et une liste
 * de deux cents noms de champs n'a rien a faire dans l'interface.
 */
function etatPourInterface(systeme, cameras, alcora) {
  const s = systeme ?? {};
  return {
    nom: s.nom ?? null,
    version: s.version ?? null,
    versionDisponible: s.versionDisponible ?? null,
    versionOs: s.versionOs ?? null,
    disque: s.disque ?? null,
    retentionHaute: s.retentionHaute ?? null,
    retentionBasse: s.retentionBasse ?? null,
    parJourHaute: s.parJourHaute ?? null,
    parJourBasse: s.parJourBasse ?? null,
    parDefinition: s.parDefinition ?? null,
    armement: s.armement ?? null,
    depuis: s.depuis ?? null,
    etatDisque: s.etatDisque ?? null,
    enregistrementSuspendu: s.enregistrementSuspendu === true,
    cameras: {
      total: cameras.length,
      enLigne: cameras.filter((c) => c.online).length,
    },
    archive: cameras.map((c) => c.archive).filter(Boolean),
    alcora,
  };
}

/**
 * L'inventaire tel que la PAGE a le droit de le voir — sans les alias RTSP.
 *
 * Un alias est un mot de passe : le RTSP de Protect n'a aucune authentification (mesure
 * du 21.07.2026), et c'est lui seul qui protege le flux. Le relais en a besoin ; la page,
 * jamais — le contrat `DiscoveredChannel` ne le declare meme pas. L'envoyer quand meme
 * elargissait l'exposition sans contrepartie : une capture des outils de developpement,
 * ou une faille d'injection un jour, l'auraient livre.
 *
 * La projection est EXPLICITE, jamais une soustraction : on enumere ce qui sort, si bien
 * qu'un champ sensible ajoute plus tard au canal ne partira pas tout seul. C'est
 * l'inverse du defaut qui a fait naitre ce fichier de tests — mais le meme remede.
 *
 * Vit ici et non dans main.js pour qu'un test puisse l'appeler sans Electron.
 */
function camerasPourInterface(cameras) {
  return (cameras ?? []).map((c) => ({
    ...c,
    channels: (c.channels ?? []).map((ch) => ({
      quality: ch.quality,
      width: ch.width,
      height: ch.height,
      fps: ch.fps,
      bitrate: ch.bitrate,
      streamable: Boolean(ch.streamable),
    })),
  }));
}

module.exports = {
  fromBootstrap, mapCamera, relayPaths, bornesArchive, etatSysteme, etatPourInterface,
  camerasPourInterface,
};
