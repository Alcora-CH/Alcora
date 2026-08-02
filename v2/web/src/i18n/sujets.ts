import { t } from './index';
import type { Cle } from './fr';

/**
 * Les sujets de detection, tels que Protect les nomme, traduits pour l'ecran.
 *
 * PARTAGE : la colonne d'etat, le halo des tuiles, la recherche et les veilles nomment
 * tous les memes sujets — chacun portait sa propre table, et elles divergeaient deja
 * (la colonne ignorait la fumee et le bris de verre que le halo connaissait).
 *
 * Un sujet inconnu se montre TEL QUEL plutot que de disparaitre : le mot brut dit au
 * moins qu'il y a quelque chose a traduire. Protect ne documente pas cette liste.
 */
const SUJET_CLE: Record<string, Cle> = {
  person: 'sujet.person',
  vehicle: 'sujet.vehicle',
  animal: 'sujet.animal',
  face: 'sujet.face',
  licensePlate: 'sujet.licensePlate',
  alrmSpeak: 'sujet.alrmSpeak',
  alrmBark: 'sujet.alrmBark',
  alrmCarHorn: 'sujet.alrmCarHorn',
  alrmSmoke: 'sujet.alrmSmoke',
  alrmGlassBreak: 'sujet.alrmGlassBreak',
  motion: 'sujet.motion',
};

/** Le nom d'un sujet dans la langue courante, ou le mot brut si Protect en invente un. */
export function nomSujet(brut: string): string {
  const cle = SUJET_CLE[brut];
  return cle ? t(cle) : brut;
}

const VEHICULE_CLE: Record<string, Cle> = {
  suv: 'vehicule.suv',
  car: 'vehicule.car',
  van: 'vehicule.van',
  truck: 'vehicule.truck',
  motorcycle: 'vehicule.motorcycle',
  bike: 'vehicule.bike',
  bus: 'vehicule.bus',
};

/** Le type d'un vehicule dans la langue courante — meme regle que les sujets. */
export function nomVehicule(brut: string): string {
  const cle = VEHICULE_CLE[brut];
  return cle ? t(cle) : brut;
}
