'use strict';

const https = require('node:https');
const { createPinnedAgent } = require('./pinning');
const { Session } = require('./session');
const { normalizeSecret, decodeSecret, computeTotp } = require('./totp');
const E = require('./errors');

/**
 * Client HTTP authentifie du controleur.
 *
 * Il porte quatre responsabilites que rien d'autre ne peut assumer :
 *   - l'epinglage de la cle publique (certificat auto-signe) ;
 *   - le jeton anti-CSRF, qui tourne a chaque reponse ;
 *   - la reconnexion silencieuse quand la session expire, sans effet de meute ;
 *   - la generation du code a deux facteurs, pour que l'utilisateur n'en saisisse jamais.
 */
class ProtectClient {
  /**
   * @param {object} options
   * @param {string} options.host
   * @param {string[]} [options.pins]
   * @param {(pin: string) => void} [options.onFirstUse]
   * @param {Session} [options.session]
   * @param {(s: Session) => void} [options.onSessionChanged]
   */
  constructor({ host, pins = [], onFirstUse, session, onSessionChanged }) {
    this.host = host;
    this.session = session ?? new Session();
    this.onSessionChanged = onSessionChanged;
    this.credentials = null;

    this.agent = createPinnedAgent({ pins, onFirstUse });

    // Anti-meute : une seule reconnexion a la fois, les autres attendent son resultat.
    this.refreshing = null;
    this.generation = 0;
    this.clockOffsetSeconds = undefined;
  }

  setCredentials({ username, password, totpSeed }) {
    this.credentials = { username, password, totpSeed };
  }

  /** Requete brute, avec epinglage et recolte des jetons. */
  request(method, path, { body, headers = {}, timeout = 30000 } = {}) {
    return new Promise((resolve, reject) => {
      const payload = body === undefined ? null : Buffer.from(JSON.stringify(body), 'utf8');

      const req = https.request(
        {
          host: this.host,
          port: 443,
          path,
          method,
          agent: this.agent,
          // Pas de servername sur une adresse IP : contraire au RFC 6066 et deprecie.
          headers: {
            'User-Agent': 'Alcora/2.2',
            Accept: 'application/json',
            ...(this.session.cookieHeader ? { Cookie: this.session.cookieHeader } : {}),
            ...(this.session.csrf ? { 'X-CSRF-Token': this.session.csrf } : {}),
            ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': payload.length } : {}),
            ...headers,
          },
          timeout,
        },
        (res) => {
          this.session.harvest(res.headers);

          // Horloge du controleur, pour distinguer un code refuse d'une horloge decalee.
          if (res.headers.date) {
            const serverMs = Date.parse(res.headers.date);
            if (Number.isFinite(serverMs)) this.clockOffsetSeconds = (serverMs - Date.now()) / 1000;
          }

          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () =>
            resolve({
              status: res.statusCode,
              headers: res.headers,
              body: Buffer.concat(chunks),
            }));
        },
      );

      req.on('timeout', () => req.destroy(new E.NetworkError('the controller did not answer', this.host)));
      req.on('error', (err) => reject(this.translate(err)));

      if (payload) req.write(payload);
      req.end();
    });
  }

  translate(err) {
    if (err instanceof E.ProtectError) return err;
    if (err.code === 'ENOTFOUND' || err.code === 'EAI_AGAIN') return new E.HostNotFoundError(this.host);
    if (err.code === 'ECONNREFUSED') return new E.ConnectionRefusedError(this.host);
    // Refus local, pas distant : c'est ce PC qui interdit la sortie a cette application.
    if (err.code === 'EACCES' || err.code === 'EPERM') {
      return new E.FirewallBlockedError(this.host, err.message);
    }
    return new E.NetworkError(err.message, this.host);
  }

  /** Ouvre une session. Le code a deux facteurs est produit ici, jamais demande. */
  async login() {
    if (!this.credentials) throw new E.CredentialsError('aucun identifiant fourni');

    const body = {
      username: this.credentials.username,
      password: this.credentials.password,
      rememberMe: true,
    };

    if (this.credentials.totpSeed) {
      const norm = normalizeSecret(this.credentials.totpSeed);
      if (!norm.ok) throw new E.TotpError(norm.error, this.clockOffsetSeconds);
      body.token = computeTotp(decodeSecret(norm.value));
    }

    const res = await this.request('POST', '/api/auth/login', { body });
    const text = res.body.toString('utf8').slice(0, 400);

    if (res.status >= 200 && res.status < 300) {
      if (!this.session.cookieHeader) {
        throw new E.ApiError(res.status, 'connection accepted but no session cookie received');
      }
      this.generation++;
      this.onSessionChanged?.(this.session);
      return this.session;
    }

    // 499 est le code maison d'UniFi OS : le second facteur est exige ou refuse.
    //
    // Les deux cas demandent des gestes opposes. Renvoyer « vérifie la clé saisie » a
    // quelqu'un qui n'a rien saisi l'envoie chercher une faute dans un champ vide.
    if (res.status === 499) {
      throw this.credentials.totpSeed
        ? new E.TotpError(text, this.clockOffsetSeconds)
        : new E.TotpRequiredError(text);
    }
    if (res.status === 403) throw new E.ForbiddenError('the connection');
    if (res.status === 429) {
      const after = Number(res.headers['retry-after']);
      throw new E.RateLimitedError(Number.isFinite(after) ? after : 30);
    }
    if (res.status === 401 || res.status === 400) {
      // Un mot de passe faux et un second facteur refuse arrivent tous deux ici.
      // Les confondre enverrait corriger le mauvais champ.
      return /2fa|ubic2fa|otp|token/i.test(text)
        ? Promise.reject(new E.TotpError(text, this.clockOffsetSeconds))
        : Promise.reject(new E.CredentialsError(text));
    }
    throw new E.ApiError(res.status, text);
  }

  /** Reconnecte, sauf si un autre appel l'a deja fait depuis la generation observee. */
  async refresh(observedGeneration) {
    if (this.generation !== observedGeneration) return true;
    if (this.refreshing) return this.refreshing;

    /*
     * La cause de l'echec est CONSERVEE.
     *
     * Elle etait avalee par un « catch(() => false) » : un mot de passe refuse, un
     * controleur injoignable et une limite de tentatives donnaient tous le meme booleen.
     * L'appelant ne pouvait donc ni afficher le bon message, ni distinguer ce qui se
     * corrige tout seul de ce qui exige une intervention.
     */
    this.refreshing = this.login()
      .then(() => { this.derniereCause = null; return true; })
      .catch((e) => { this.derniereCause = e; return false; })
      .finally(() => { this.refreshing = null; });

    return this.refreshing;
  }

  /** Requete authentifiee, avec UNE seule reprise en cas de session expiree. */
  async authed(method, path, options = {}) {
    const generation = this.generation;
    let res = await this.request(method, path, options);

    if (res.status === 401 && !options.noRetry) {
      const ok = await this.refresh(generation);
      if (ok) res = await this.request(method, path, { ...options, noRetry: true });
    }

    if (res.status === 403) throw new E.ForbiddenError(path);
    if (res.status === 401) throw new E.CredentialsError('session refused by the controller');
    if (res.status < 200 || res.status >= 300) {
      throw new E.ApiError(res.status, res.body.toString('utf8').slice(0, 300));
    }
    return res;
  }

  async getJson(path) {
    const res = await this.authed('GET', path);
    try {
      return JSON.parse(res.body.toString('utf8'));
    } catch (e) {
      throw new E.ApiError(200, `unreadable response: ${e.message}`);
    }
  }

  getBootstrap() { return this.getJson('/proxy/protect/api/bootstrap'); }

  /**
   * Journal des detections, sur une fenetre de temps.
   *
   * Le controleur rend les evenements du plus ANCIEN au plus recent (mesure du
   * 28.07.2026) : on inverse ici, une fois, pour que tout le reste du programme raisonne
   * en antichronologique — l'ordre dans lequel on lit un journal.
   *
   * « limit » conserve les plus RECENTS de la fenetre, ce qui rend la pagination possible
   * en reculant la borne haute. Deduit des chiffres du poste reel, a reverifier si le
   * comportement paraissait changer.
   *
   * @param {object} p
   * @param {number} p.debut  borne basse, en millisecondes
   * @param {number} p.fin    borne haute, en millisecondes
   * @param {number} [p.limite]
   * @param {string[]} [p.types] filtre applique par le controleur, quand il est fourni
   */
  async getEvents({ debut, fin, limite = 100, types, sujets } = {}) {
    const q = new URLSearchParams();
    q.set('start', String(Math.round(debut)));
    q.set('end', String(Math.round(fin)));
    q.set('limit', String(limite));
    // Le parametre se repete, il ne se joint pas par des virgules.
    for (const t of types ?? []) q.append('types', t);
    /*
     * Filtrage par sujet, cote CONTROLEUR.
     *
     * Mesure du 29.07.2026 : « smartDetectTypes=person » fait passer 624 detections a 310
     * — le parametre est HONORE. C'est lui qui rend la recherche tenable, avec ~266
     * detections par jour. « minScore », lui, est ignore : le seuil se calcule chez nous.
     */
    for (const s of sujets ?? []) q.append('smartDetectTypes', s);

    const liste = await this.getJson(`/proxy/protect/api/events?${q.toString()}`);
    if (!Array.isArray(liste)) return [];
    return liste.slice().sort((a, b) => (b.start ?? 0) - (a.start ?? 0));
  }

  /** Vignette d'un evenement. Rend le type et les octets, sans jamais les interpreter. */
  /**
   * Image instantanee d'une camera.
   *
   * Necessaire parce que la vignette d'un evenement n'existe QU'APRES sa fin — mesure du
   * 21.07.2026, 404 pendant. Une bulle envoyee au commencement d'une detection ne peut donc
   * pas porter l'image de cette detection : elle porte celle de l'instant, ce qui vaut
   * mieux, puisque c'est justement ce qui est en train de se passer.
   *
   * Best-effort assume : si le controleur ne la sert pas, la bulle part sans image plutot
   * que d'attendre. Prevenir vite compte plus que prevenir joliment.
   */
  async getCameraSnapshot(id, { w, h } = {}) {
    const q = new URLSearchParams();
    if (w) q.set('w', String(w));
    if (h) q.set('h', String(h));
    const suffixe = q.toString() ? `?${q}` : '';
    const res = await this.authed(
      'GET', `/proxy/protect/api/cameras/${encodeURIComponent(id)}/snapshot${suffixe}`);
    if (res.status !== 200) {
      const e = new Error(`snapshot unavailable (${res.status})`);
      e.absent = res.status === 404;
      throw e;
    }
    return { type: res.headers['content-type'] || 'image/jpeg', corps: res.body };
  }

  async getEventThumbnail(id, { w, h } = {}) {
    const q = new URLSearchParams();
    if (w) q.set('w', String(Math.round(w)));
    if (h) q.set('h', String(Math.round(h)));
    const suffixe = q.toString() ? `?${q.toString()}` : '';
    const res = await this.authed('GET', `/proxy/protect/api/events/${encodeURIComponent(id)}/thumbnail${suffixe}`);
    return { type: res.headers?.['content-type'] ?? 'image/jpeg', corps: res.body };
  }
}

module.exports = { ProtectClient };
