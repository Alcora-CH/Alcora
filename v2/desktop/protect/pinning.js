'use strict';

const crypto = require('node:crypto');
const https = require('node:https');
const { PinMismatchError } = require('./errors');

/**
 * Verification du controleur par epinglage de sa CLE PUBLIQUE.
 *
 * Le certificat d'une console UniFi est auto-signe et ne porte pas son adresse IP : la
 * validation standard echouera toujours. Plutot que de tout accepter, on epingle.
 *
 * On epingle la cle publique et non l'empreinte du certificat : celui-ci est regenere aux
 * mises a jour de firmware, ce qui transformerait chaque mise a jour en panne. L'epinglage
 * de la cle survit tant que la paire de cles est conservee.
 *
 * Contrainte de Node : la chaine est validee AVANT tout controle d'identite, donc avec un
 * certificat auto-signe on n'aurait jamais la main. On desactive la validation standard et
 * on verifie soi-meme a l'etablissement de la connexion securisee.
 */

/** Empreinte SHA-256 de la cle publique, en base64. Meme calcul que la version C#. */
function computePin(x509) {
  const spki = x509.publicKey.export({ type: 'spki', format: 'der' });
  return crypto.createHash('sha256').update(spki).digest('base64');
}

/**
 * Agent HTTPS epinglant.
 *
 * @param {object} options
 * @param {string[]} options.pins        empreintes acceptees. Une LISTE, pour couvrir une
 *                                       rotation ou l'ancienne et la nouvelle coexistent.
 * @param {(pin: string) => void} [options.onFirstUse] appele si aucune empreinte n'est
 *                                       encore memorisee : la connexion est acceptee et
 *                                       l'empreinte remontee pour confirmation.
 */
function createPinnedAgent({ pins = [], onFirstUse } = {}) {
  const agent = new https.Agent({
    // La validation standard ne peut pas reussir : la confiance vient de l'epinglage seul.
    rejectUnauthorized: false,
    keepAlive: true,
    maxSockets: 8,
    timeout: 15000,
  });

  const originalCreate = agent.createConnection.bind(agent);

  agent.createConnection = function (options, callback) {
    const socket = originalCreate(options, callback);

    socket.on('secureConnect', () => {
      const cert = socket.getPeerX509Certificate?.();
      if (!cert) {
        socket.destroy(new PinMismatchError('(aucun certificat)', pins));
        return;
      }

      const seen = computePin(cert);

      if (pins.length === 0) {
        // Premier appairage : on memorise ce qu'on voit, l'utilisateur confirmera.
        onFirstUse?.(seen);
        return;
      }

      const ok = pins.some((p) => {
        const a = Buffer.from(p, 'base64');
        const b = Buffer.from(seen, 'base64');
        return a.length === b.length && crypto.timingSafeEqual(a, b);
      });

      if (!ok) socket.destroy(new PinMismatchError(seen, pins));
    });

    return socket;
  };

  return agent;
}

module.exports = { computePin, createPinnedAgent };
