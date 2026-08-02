# Alcora

**A Windows desktop client for UniFi Protect that never touches the cloud.**

Alcora shows your cameras — live, recordings, detections, alerts — by talking
directly to your UniFi Protect console on your own network. No Ubiquiti cloud
account, no remote access, no telemetry. If your network is up, Alcora works.

🇫🇷 [Version française](README.fr.md) · 🌐 [alcora.ch](https://alcora.ch)

> Alcora is not affiliated with, nor endorsed by, Ubiquiti Inc.
> “UniFi” and “UniFi Protect” are trademarks of Ubiquiti Inc.

## What it does

- **Live wall** — every camera in an auto-arranged mosaic; drag to reorder,
  double-click (or keys `1`–`9`) to isolate, mouse-wheel to zoom into the
  *actual source pixels*, per-camera audio.
- **Timeline replay** — browse a full day of continuous recording, zoomable
  timeline with detections marked, smooth chained playback, frame stepping,
  audio, capture stills at source definition.
- **Detections & search** — filter by subject, vehicle type, colour, camera or
  licence plate; filters only offer what actually exists in your archive, with
  real counts. Plate search is tolerant of the controller's ambiguous reads.
- **Watches (alerts)** — your own arming rules, independent of Protect's:
  subjects, cameras, schedules, per-rule sound. Windows notifications arrive
  through a persistent realtime link to the console — measured *faster than
  Ubiquiti's own cloud notifications*.
- **Activity halo** — the camera where something is happening lights up while
  it lasts, and says *what* was detected.
- **Self-updating** — checks at launch, downloads, verifies by SHA-256 against
  a signed manifest, applies, restarts. A “What's new” window explains what
  changed.

## Requirements

- Windows 10/11 (x64 native; runs fine emulated on ARM64).
- A UniFi Protect console (UDM Pro, UNVR, Cloud Key G2+…) reachable on your
  network.
- **RTSP enabled** on each camera (Protect → camera → Advanced).
- A **dedicated local account** on the console for Alcora, with viewing
  rights — don't use your owner account.

## Install

Download the latest `Alcora-win-Setup.exe` from the
[releases](https://github.com/alcora-ch/Alcora-releases/releases) and run
it. Windows may show a SmartScreen warning the first time — the installer is
signed, but with a self-issued certificate. The application then keeps itself
up to date.

On first launch, enter the console's address, the dedicated account and, if
that account has one, its two-factor key: codes are generated locally, you
will never be asked for one again.

## Privacy model

- Alcora talks to **your console** and, for updates, to **GitHub**. Nothing
  else, ever.
- After pairing, the console's TLS public key is **pinned** — Alcora refuses
  to talk to anything else claiming its address.
- Credentials are stored encrypted with **Windows DPAPI**, bound to your
  Windows account.
- The video relay listens on **localhost only**.
- No images, plates or names ever leave your machine. Plate search happens
  in the main process; recognised text is never even displayed.

See [SECURITY.md](SECURITY.md) for reporting vulnerabilities.

## Build from source

```bash
npm run install:all   # dependencies for the interface and the desktop shell
npm test              # 13 offline verification suites — no controller needed
npm run dev           # dev server + Electron against your own console
npm run build         # installer (code signing optional)
```

The interface is React + Vite, the shell is Electron, video transport is
WebRTC via a bundled [MediaMTX](https://github.com/bluenviron/mediamtx) relay,
packaging is [Velopack](https://github.com/velopack/velopack). The
`docs/` folder holds the design history — including measurements made against
a real console (`docs/contraintes-verifiees.md`), which explain most of the
non-obvious choices in the code.

## License

[GPL-3.0](LICENSE) — © Thomas. Derivative works must remain open source under
the same terms.
