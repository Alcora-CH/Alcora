'use strict';

/**
 * Etat d'une session authentifiee : le cookie, le jeton anti-CSRF et l'expiration.
 *
 * Le jeton anti-CSRF TOURNE : le controleur en renvoie un nouveau dans les en-tetes de
 * reponse. Le corps de la reponse de connexion, lui, contient un champ vide — s'y fier
 * donne un refus a la premiere ecriture. On recolte donc sur TOUTES les reponses.
 */

/** Revendications utiles du jeton. On ne verifie pas sa signature : ce n'est pas notre role. */
function parseJwt(token) {
  try {
    const parts = String(token).split('.');
    if (parts.length < 2) return {};
    const payload = Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    const claims = JSON.parse(payload);
    return {
      csrfToken: typeof claims.csrfToken === 'string' ? claims.csrfToken : undefined,
      expiresAt: Number.isFinite(claims.exp) ? new Date(claims.exp * 1000) : undefined,
    };
  } catch {
    return {};
  }
}

class Session {
  constructor() {
    this.cookieName = null;
    this.cookieValue = null;
    this.csrf = null;
    this.expiresAt = null;
  }

  get cookieHeader() {
    return this.cookieValue ? `${this.cookieName}=${this.cookieValue}` : null;
  }

  /** Utilisable s'il reste plus d'une minute de validite. */
  get usable() {
    return Boolean(this.cookieValue) && this.expiresAt instanceof Date
      && this.expiresAt.getTime() > Date.now() + 60_000;
  }

  setCookie(name, value) {
    const { csrfToken, expiresAt } = parseJwt(value);
    this.cookieName = name;
    this.cookieValue = value;
    this.expiresAt = expiresAt ?? new Date(Date.now() + 3_600_000);
    // Le jeton du JWT sert d'amorce en attendant la premiere rotation par en-tete.
    if (!this.csrf && csrfToken) this.csrf = csrfToken;
  }

  setCsrf(token) {
    if (token && token !== this.csrf) this.csrf = token;
  }

  clear() {
    this.cookieName = this.cookieValue = this.csrf = null;
    this.expiresAt = null;
  }

  /**
   * Recolte cookie et jeton sur une reponse. UniFi OS a utilise TOKEN puis UOS_TOKEN
   * selon les versions : on accepte les deux.
   */
  harvest(headers) {
    const updated = headers['x-updated-csrf-token'] ?? headers['x-csrf-token'];
    if (updated) this.setCsrf(Array.isArray(updated) ? updated[0] : updated);

    const raw = headers['set-cookie'];
    if (!raw) return;

    for (const line of Array.isArray(raw) ? raw : [raw]) {
      const pair = line.split(';')[0];
      const eq = pair.indexOf('=');
      if (eq <= 0) continue;
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      if (!/^(UOS_)?TOKEN$/i.test(name) || !value) continue;
      this.setCookie(name, value);
    }
  }

  toJSON() {
    return { name: this.cookieName, value: this.cookieValue, csrf: this.csrf };
  }

  static fromJSON(data) {
    const s = new Session();
    if (data?.name && data?.value) {
      s.setCookie(data.name, data.value);
      if (data.csrf) s.setCsrf(data.csrf);
    }
    return s;
  }
}

module.exports = { Session, parseJwt };
