import { useCallback, useEffect, useState } from 'react';

/**
 * Outils d'une vue video, partages par les trois ecrans.
 *
 * Separes de CommandesVideo.tsx pour une raison bien concrete : un fichier qui exporte a la
 * fois des composants et des fonctions casse le rechargement a chaud de Vite, et la regle
 * qui le signale est bloquante depuis le 31.07.2026.
 */

/**
 * Capture de l'image affichee, a la definition de la SOURCE.
 *
 * Partage entre les trois ecrans, mais son resultat differe et il faut le dire : en direct
 * la source est le canal demande au controleur, en pleine definition ; sur un extrait c'est
 * la definition de l'export, qui au-dela de vingt-neuf jours d'archive tombe a 640 x 360.
 * Reduire une capture a la taille d'affichage ne servirait a rien — c'est justement pour
 * garder le detail qu'on la prend.
 */
export function imageDeLaVideo(video: HTMLVideoElement | null): Promise<Blob | null> {
  return new Promise((resoudre) => {
    if (!video || !video.videoWidth) { resoudre(null); return; }
    const toile = document.createElement('canvas');
    toile.width = video.videoWidth;
    toile.height = video.videoHeight;
    const ctx = toile.getContext('2d');
    if (!ctx) { resoudre(null); return; }
    ctx.drawImage(video, 0, 0);
    toile.toBlob((b) => resoudre(b), 'image/jpeg', 0.92);
  });
}

/**
 * Le son d'une video, decouvert et non suppose.
 *
 * Meme regle que dans le direct : on regarde si le flux porte une piste plutot que de
 * parier. Sur un fichier telecharge la reponse est immediate ; sur un flux negocie elle
 * peut arriver apres la video, d'ou la surveillance.
 */
export function useSonVideo(video: React.RefObject<HTMLVideoElement | null>, pret: boolean) {
  const [aDuSon, setADuSon] = useState<boolean | undefined>(undefined);
  const [sonActif, setSonActif] = useState(false);

  const regarder = useCallback(() => {
    const v = video.current;
    if (!v) return;
    /*
     * L'etat du bouton se met au diapason de l'ELEMENT, pas l'inverse. En relecture les
     * lecteurs jouent non coupes depuis toujours : un bouton qui pretendrait le son eteint
     * pendant qu'on l'entend inviterait a cliquer pour l'activer — et le couperait.
     */
    setSonActif(!v.muted);
    const flux = v.srcObject as MediaStream | null;
    if (flux) { setADuSon(Boolean(flux.getAudioTracks?.().length)); return; }
    /*
     * Fichier plutot que flux negocie. `mozHasAudio` et `audioTracks` ne sont pas
     * universels : en leur absence on ne CONCLUT PAS a l'absence de son — on laisse
     * `undefined`, ce qui rend le bouton actif et laisse l'utilisateur juger. Repondre
     * « pas de son » a tort serait pire que ne rien dire.
     */
    const avec = v as HTMLVideoElement & { mozHasAudio?: boolean; audioTracks?: { length: number } };
    if (typeof avec.mozHasAudio === 'boolean') { setADuSon(avec.mozHasAudio); return; }
    if (avec.audioTracks) { setADuSon(avec.audioTracks.length > 0); return; }
    setADuSon(undefined);
  }, [video]);

  const basculer = useCallback(() => {
    const v = video.current;
    if (!v) return;
    v.muted = !v.muted;
    setSonActif(!v.muted);
  }, [video]);

  /* La piste peut arriver APRES la video : on regarde encore un peu, puis on s'arrête. */
  useEffect(() => {
    if (!pret) return;
    regarder();
    const id = setInterval(regarder, 800);
    const fin = setTimeout(() => clearInterval(id), 6000);
    return () => { clearInterval(id); clearTimeout(fin); };
  }, [pret, regarder]);

  return { aDuSon, sonActif, basculer };
}
