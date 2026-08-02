# Security Policy

## Reporting a vulnerability

Please report security issues **privately** to **security@alcora.ch**.
Do not open a public issue for anything that could put users' cameras,
credentials or recordings at risk.

You can expect an acknowledgement within a few days. Please include enough
detail to reproduce the problem — the version (Settings screen), your
UniFi Protect version, and the steps involved.

## Supported versions

Only the **latest published version** is supported. Alcora updates itself
automatically at launch, so in practice every installation should be on the
latest version within hours of a release.

## Scope and design notes

Facts that matter when assessing a report:

- **Everything is local.** Alcora talks only to your UniFi Protect console on
  your own network, plus GitHub for updates. There is no vendor cloud, no
  telemetry, no account.
- **The console's identity is pinned.** After pairing, Alcora only accepts the
  TLS public key it paired with. A report that assumes an attacker can swap
  the console's certificate unnoticed should account for this.
- **Credentials are encrypted at rest** with Windows DPAPI, bound to the local
  Windows account and to the application's data directory.
- **The video relay listens on localhost only.** It never exposes a port on
  the network.
- Updates are verified by **SHA-256 against a signed manifest** before being
  applied, and the installer is code-signed.

## Politique de sécurité (français)

Signalez toute faille **en privé** à **security@alcora.ch** — jamais dans une
issue publique. Seule la **dernière version publiée** est maintenue ;
l'application se met à jour seule. Alcora ne parle qu'à votre console UniFi
Protect sur votre réseau (et à GitHub pour les mises à jour) : pas de nuage,
pas de télémétrie, pas de compte.
