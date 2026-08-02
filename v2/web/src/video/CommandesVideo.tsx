import { Camera, Maximize2, Minimize2, Volume2, VolumeX, ZoomIn } from 'lucide-react';
import { nombre, useLangue } from '../i18n';

/**
 * Les commandes d'une vue video, montees UNE fois pour les trois ecrans.
 *
 * Elles n'existaient que dans le direct. Releve a l'usage le 01.08.2026 : « je peux zoomer
 * et gerer l'audio dans le flux en direct, mais ces memes options ne sont pas disponibles
 * dans les autres pages ». C'est pourtant en relecture qu'on cherche un detail — une plaque,
 * un visage, le vetement de quelqu'un — et qu'on veut entendre ce qui s'est dit.
 *
 * Le composant ne DECIDE rien : il rend ce qu'on lui donne et rappelle l'appelant. Chaque
 * ecran garde ainsi ses particularites — le direct change de canal en zoomant, la relecture
 * n'a qu'un fichier — sans les faire remonter ici.
 *
 * Une commande dont l'appelant ne fournit pas le rappel n'est pas rendue : il n'y a jamais
 * de bouton mort. Une commande fournie mais momentanement inapplicable — pas de piste audio
 * dans ce flux — reste VISIBLE et le dit, parce que la faire disparaitre laisserait croire
 * qu'elle n'existe pas.
 */

export interface CommandesVideoProps {
  /** Zoom courant. Absent, le bouton de remise a l'echelle ne parait pas. */
  zoom?: number;
  onReinitialiserZoom?: () => void;
  /** Nul quand le flux ne porte aucune piste : le bouton le dira. */
  aDuSon?: boolean;
  sonActif?: boolean;
  onSon?: () => void;
  onCapture?: () => void;
  pleinEcran?: boolean;
  onPleinEcran?: () => void;
  /** Pose les commandes en bas a droite plutot qu'en haut. */
  enBas?: boolean;
}

function Bouton({ titre, onClick, actif, eteint, children }: {
  titre: string;
  onClick?: () => void;
  actif?: boolean;
  eteint?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="group/bt relative">
      <button
        onClick={onClick}
        aria-label={titre}
        disabled={eteint}
        className="grid h-[26px] w-[26px] place-items-center rounded-md border transition-colors disabled:cursor-default"
        style={{
          borderColor: actif ? 'var(--accent)' : 'var(--line2)',
          color: eteint ? 'var(--soft)' : actif ? 'var(--accent-d)' : 'var(--on-2)',
          background: actif ? 'var(--accent-soft)' : 'transparent',
        }}
      >
        {children}
      </button>
      {/* Aligne a DROITE : centre, il sortait de l'ecran pour les derniers boutons. */}
      <span className="pointer-events-none absolute right-0 top-[30px] z-30 hidden whitespace-nowrap rounded-md px-2 py-1 text-[11.5px] group-hover/bt:block"
            style={{ background: 'rgba(14,17,22,.94)', color: 'var(--on-1)',
                     border: '1px solid rgba(255,255,255,.14)' }}>
        {titre}
      </span>
    </div>
  );
}

export function CommandesVideo({
  zoom, onReinitialiserZoom, aDuSon, sonActif, onSon, onCapture,
  pleinEcran, onPleinEcran, enBas,
}: CommandesVideoProps) {
  const t = useLangue();
  const agrandi = (zoom ?? 1) > 1.001;
  return (
    <div className={`pointer-events-auto absolute z-20 flex items-center gap-1.5 ${
      enBas ? 'bottom-3 right-3' : 'right-2 top-2'}`}>
      {onReinitialiserZoom && agrandi && (
        <Bouton titre={t('video.revenirImage', { zoom: nombre(zoom!, 2) })}
                onClick={onReinitialiserZoom} actif>
          <ZoomIn className="h-3.5 w-3.5" />
        </Bouton>
      )}
      {onSon && (
        <Bouton
          titre={aDuSon === false ? t('video.pasDeSon')
            : sonActif ? t('video.couperSon') : t('video.activerSon')}
          onClick={onSon}
          actif={sonActif}
          eteint={aDuSon === false}
        >
          {sonActif ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
        </Bouton>
      )}
      {onCapture && (
        <Bouton titre={t('video.capturer')} onClick={onCapture}>
          <Camera className="h-3.5 w-3.5" />
        </Bouton>
      )}
      {onPleinEcran && (
        <Bouton titre={pleinEcran ? t('video.quitterPleinEcran') : t('video.pleinEcran')} onClick={onPleinEcran}>
          {pleinEcran ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </Bouton>
      )}
    </div>
  );
}
