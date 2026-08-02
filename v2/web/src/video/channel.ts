import { t } from '../i18n';
import type { Cle } from '../i18n/fr';
import type { DiscoveredCamera, DiscoveredChannel } from '../types/protect';

const ORDER: DiscoveredChannel['quality'][] = ['low', 'medium', 'high', 'package'];

/**
 * Choisit le canal a diffuser.
 *
 * Regle unique : il faut « largeur de tuile x zoom » pixels source pour eviter toute
 * interpolation. Le plein cadre agrandit la tuile, le zoom retrecit la portion visible —
 * les deux montent donc naturellement en gamme, sans cas particulier.
 *
 * La marge evite qu'une petite tuile se contente du canal le plus degrade : mesure sur
 * l'installation, une mosaique en Medium coute environ 1 Mbit/s par camera contre 7,4 en
 * High, tout en gardant de la marge de zoom immediate.
 */
export function pickChannel(
  camera: DiscoveredCamera,
  tileWidth: number,
  zoom = 1,
  headroom = 2,
): DiscoveredChannel | null {
  const usable = camera.channels
    .filter((c) => c.streamable)
    .sort((a, b) => a.width - b.width);

  if (usable.length === 0) return null;

  const needed = Math.max(1, tileWidth) * Math.max(1, zoom) * Math.max(1, headroom);
  return usable.find((c) => c.width >= needed) ?? usable[usable.length - 1];
}

/** Chemin publie par le relais pour un canal donne. */
export function relayPath(camera: DiscoveredCamera, channel: DiscoveredChannel): string {
  return `${camera.id}_${channel.quality}`;
}

/** Le canal le plus fin disponible, pour l'affichage plein cadre. */
export function bestChannel(camera: DiscoveredCamera): DiscoveredChannel | null {
  return camera.channels
    .filter((c) => c.streamable)
    .sort((a, b) => b.width - a.width)[0] ?? null;
}

export function qualityLabel(channel: DiscoveredChannel): string {
  const cles: Record<DiscoveredChannel['quality'], Cle> = {
    high: 'canal.haute', medium: 'canal.moyenne', low: 'canal.basse', package: 'canal.colis',
  };
  return `${t(cles[channel.quality])} ${channel.height}p`;
}

export { ORDER as QUALITY_ORDER };
