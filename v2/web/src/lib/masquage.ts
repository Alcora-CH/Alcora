import { t } from '../i18n';
import type { DiscoveredCamera } from '../types/protect';

/**
 * Le masquage d'une camera dans la mosaique — une seule regle, pour le menu « Cameras » du
 * direct et le tableau de la page Systeme.
 *
 * On cache une IMAGE, pas une camera : les veilles et les detections continuent, et la
 * relecture reste accessible. La derniere camera visible ne se masque pas : le direct
 * n'aurait plus rien a montrer, et rien ne dirait pourquoi.
 *
 * Le compte part des cameras PRESENTES : la liste des masquees garde aussi celles qui ont
 * quitte l'inventaire, pour qu'elles restent cachees a leur retour. Les compter ferait
 * croire qu'il reste une autre camera visible quand il n'y en a plus.
 */
export function seuleVisible(cameras: DiscoveredCamera[], masquees: string[], id: string): boolean {
  return !masquees.includes(id) && cameras.filter((c) => !masquees.includes(c.id)).length <= 1;
}

export function titreMasquage(cameras: DiscoveredCamera[], masquees: string[], id: string): string {
  if (seuleVisible(cameras, masquees, id)) return t('app.derniereCamera');
  return masquees.includes(id) ? t('app.reafficher') : t('app.masquerMosaique');
}
