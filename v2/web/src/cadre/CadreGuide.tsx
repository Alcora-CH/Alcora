import { t, useLangue } from '../i18n';

/**
 * Le guide d'activation du RTSP, POSÉ dans la page — sur l'écran de connexion et dans les
 * Réglages. Plus de fenêtre par-dessus l'application (décision de Thomas, 24.10.2026 : « une
 * fenêtre unique tout-en-un ») : le guide se déplie là où on le demande.
 *
 * C'est un CADRE sur le fichier embarqué (v2/web/public/guide-rtsp.html, copié depuis site/ à
 * la construction), et non un composant récrit : deux versions du même guide finiraient par
 * diverger, et c'est celle qu'on ne relit pas qui resterait fausse.
 *
 * « sandbox » sans « allow-same-origin » est le point qui compte : le cadre partagerait sinon
 * l'origine de l'interface et pourrait atteindre le pont vers le processus principal. Privé de
 * cette permission, il obtient une origine opaque — ses scripts tournent, son animation vit,
 * mais il ne voit rien de l'application. Le guide sait déjà se passer de stockage local, qui
 * échoue dans ce cas.
 *
 * La hauteur est la SEULE chose qui change, et elle est animée — l'exception assumée de la
 * règle « Mouvement », comme le dépliement d'une veille : le guide ne se recharge pas, son
 * animation ne repart pas de zéro.
 */
export function CadreGuide({ hauteur }: { hauteur: number | string }) {
  useLangue();
  return (
    <div className="overflow-hidden rounded-[10px] border border-line2"
         style={{ height: hauteur, background: '#0b1017', transition: 'height var(--ample) var(--pose)' }}>
      <iframe src="guide-rtsp.html?integre=1" title={t('camera.guide')} sandbox="allow-scripts"
              className="h-full w-full" style={{ border: 0 }} />
    </div>
  );
}
