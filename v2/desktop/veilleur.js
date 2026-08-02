'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { Notification } = require('electron');
const { SUJETS, sujetsDe, veillesDeclenchees, Retenue } = require('./veilles');
const { t, localeHeure } = require('./i18n');

/**
 * Le veilleur : il recoit les detections, decide s'il faut prevenir, et pose la bulle.
 *
 * C'est la seule chose qu'Alcora fait et que Protect ne fait pas — prevenir SUR CE PC, sans
 * compte, sans nuage, sans Internet. Ubiquiti n'a pas d'application de bureau : sur ce
 * poste, il n'y a rien d'autre.
 *
 * Toute la DECISION vit dans veilles.js, qui est pur et eprouve. Ici il ne reste que ce qui
 * touche au monde : l'image, la bulle, le journal.
 */

/** Taille de l'image posee dans la bulle. Windows la reduit ; inutile de la charger grande. */
const IMAGE_L = 360;
const IMAGE_H = 202;

/**
 * Delai laisse a l'instantane.
 *
 * Une bulle qui arrive avec dix secondes de retard n'est plus une alerte. Passe ce delai on
 * previent SANS image : mieux vaut nu et a l'heure qu'illustre et en retard.
 */
const DELAI_IMAGE_MS = 900;

/* Les identifiants des sujets sont AUSSI leurs cles de traduction (sujet.person…) :
   le titre d'une bulle se traduit a l'instant ou elle part, dans la langue du moment. */
const SUJETS_CONNUS = new Set([...SUJETS.map((s) => s.id), 'motion']);
const libelleSujet = (id) => (SUJETS_CONNUS.has(id) ? t(`sujet.${id}`) : t('sujet.detection'));

class Veilleur {
  /**
   * @param {object} o
   * @param {() => object} o.config      rend la configuration des veilles, a chaque detection
   * @param {() => object|null} o.client client authentifie du moment
   * @param {(id: string) => string} o.nomCamera
   * @param {string} o.dossier           ou deposer les images des bulles
   * @param {object} o.journal
   * @param {(d: object) => void} [o.onDetection]  pour la page : liste vivante
   * @param {(d: object) => void} [o.onOuvrir]     l'utilisateur a clique la bulle
   */
  constructor({ config, client, nomCamera, dossier, journal, onDetection, onOuvrir }) {
    this.config = config;
    this.client = client;
    this.nomCamera = nomCamera;
    this.dossier = dossier;
    this.journal = journal;
    this.onDetection = onDetection || (() => {});
    this.onOuvrir = onOuvrir || (() => {});
    this.retenue = new Retenue();
    /** Ecart mesure entre le debut d'une detection et son arrivee ici. */
    this.latences = [];
    try { fs.mkdirSync(dossier, { recursive: true }); } catch { /* sans image, alors */ }
  }

  /** Point d'entree : une detection vient d'arriver par la liaison temps reel. */
  async recevoir(detection) {
    // La page reçoit TOUT, veille ou pas : sa liste doit vivre meme desarmee.
    this.onDetection(detection);

    /*
     * Latence reelle, consignee ici faute d'avoir su la mesurer par sonde.
     *
     * La premiere methode faisait chronometrer a la main, ce qui ne pouvait pas marcher : avec
     * ~266 detections par jour, rien ne permettait d'attribuer une trame a son passage. Ici
     * la correlation est certaine — c'est LA detection dont on tient le debut.
     */
    if (detection.commence && Number.isFinite(detection.debut)) {
      const ecart = Date.now() - detection.debut;
      if (ecart >= 0 && ecart < 120_000) {
        this.latences.push(ecart);
        if (this.latences.length === 10) {
          const moy = Math.round(this.latences.reduce((a, b) => a + b, 0) / this.latences.length);
          const pire = Math.max(...this.latences);
          this.journal?.info('watch',
            `real-time latency over 10 detections: ${moy} ms average, ${pire} ms worst`);
          this.latences = [];
        }
      }
    }

    const config = this.config();
    const declenchees = veillesDeclenchees(detection, config, new Date());
    if (!declenchees.length) return;

    const sujets = sujetsDe(detection);
    const sujet = sujets[0] ?? 'motion';

    for (const veille of declenchees) {
      const delai = Number.isFinite(veille.retenueMs) ? veille.retenueMs : 300_000;
      if (!this.retenue.autorise(veille.id, sujet, delai, Date.now())) continue;
      await this.prevenir(detection, veille, sujet);
    }
  }

  async prevenir(detection, veille, sujet) {
    if (!Notification.isSupported()) {
      this.journal?.alerte('watch', 'notifications unavailable on this system');
      return;
    }

    const camera = detection.camera ? this.nomCamera(detection.camera) : null;
    const titre = libelleSujet(sujet);
    const heure = new Date(detection.debut ?? Date.now())
      .toLocaleTimeString(localeHeure(), { hour: '2-digit', minute: '2-digit' });

    const icone = await this.image(detection);

    const bulle = new Notification({
      title: camera ? `${titre} — ${camera}` : titre,
      body: `${heure} · ${t('veilleur.cliquerVoir')}`,
      icon: icone ?? undefined,
      silent: veille.son === false,
    });
    bulle.on('click', () => this.onOuvrir(detection));
    bulle.show();

    this.journal?.info('watch',
      `${titre}${camera ? ` on ${camera}` : ''} — bubble shown${icone ? ' with image' : ''}`);
  }

  /**
   * Image de la bulle : un instantane de la camera, pas la vignette de l'evenement.
   *
   * La vignette n'existe QU'APRES la fin de l'evenement (mesure du 21.07.2026, 404 pendant).
   * Au commencement d'une detection elle n'existe donc pas — et l'attendre reviendrait a
   * prevenir apres coup. L'instantane, lui, montre ce qui se passe A CET INSTANT, ce qui
   * vaut mieux.
   *
   * @returns {Promise<string|null>} chemin du fichier, ou null
   */
  async image(detection) {
    const c = this.client();
    if (!c || !detection.camera || typeof c.getCameraSnapshot !== 'function') return null;

    try {
      const obtenu = await Promise.race([
        c.getCameraSnapshot(detection.camera, { w: IMAGE_L, h: IMAGE_H }),
        new Promise((_, rejette) => setTimeout(() => rejette(new Error('trop long')), DELAI_IMAGE_MS)),
      ]);
      if (!obtenu?.corps?.length) return null;

      // Un seul fichier par camera, reecrit : ces images ne servent qu'une seconde, et
      // en accumuler une par detection remplirait le dossier sans que personne n'y revienne.
      const propre = String(detection.camera).replace(/[^A-Za-z0-9_-]/g, '');
      const cible = path.join(this.dossier, `bulle-${propre}.jpg`);
      await fs.promises.writeFile(cible, obtenu.corps);
      return cible;
    } catch (e) {
      // Le silence serait pire : sans cette ligne, on ne saurait jamais POURQUOI les bulles
      // arrivent nues. Une fois suffit — le journal ne doit pas se remplir de ca.
      if (!this.imagePlainte) {
        this.imagePlainte = true;
        this.journal?.info('watch',
          `bubbles without image: ${e.message}. The notification goes out anyway.`);
      }
      return null;
    }
  }
}

module.exports = { Veilleur, libelleSujet };
