import { useState } from 'react';
import { Camera, Maximize2, Play, ScanSearch, Search, Volume2 } from 'lucide-react';
import { t, useLangue } from '../i18n';
import { Bouton } from './Bouton';
import { Segment } from './Segment';
import { Puce } from './Puce';
import { Interrupteur } from './Interrupteur';
import { Champ } from './Champ';
import { Carte, EnTete, Rangee, Section, Touche } from './Cadre';

/**
 * Le catalogue des composants partagés — en DÉVELOPPEMENT seulement (`?catalogue`).
 *
 * C'est l'outil de vérification de la direction « Observatoire » : chaque composant, dans
 * chacune de ses variantes, sur le vrai fond. main.tsx ne le charge que si
 * import.meta.env.DEV est vrai : la construction livrée n'en contient pas une ligne.
 * Les libellés viennent des dictionnaires — ceux que les écrans emploieront.
 */
export function Catalogue() {
  useLangue();
  const [periode, setPeriode] = useState<'jour' | 'semaine' | 'mois'>('semaine');
  const [sujets, setSujets] = useState<string[]>(['vehicle']);
  const [allume, setAllume] = useState(true);
  const bascule = (s: string) => setSujets((l) => (l.includes(s) ? l.filter((x) => x !== s) : [...l, s]));

  return (
    <div className="h-full overflow-y-auto bg-bg">
      <EnTete titre={t('reglages.titre')} precision={t('reglages.sousTitre')}
              actions={<Bouton icone={Maximize2}>{t('video.pleinEcran')} <Touche>F11</Touche></Bouton>} />

      <div className="mx-auto flex max-w-[960px] flex-col gap-8 px-6 py-8">
        <Section titre="text-micro · text-meta · text-corps · text-titre · text-ecran">
          <Carte className="flex flex-col gap-2 p-5">
            <span className="text-micro text-soft">11 — {t('relecture.revoirJournee')}</span>
            <span className="text-meta text-muted">12 — {t('setup.adresse.hint')}</span>
            <span className="text-corps">13 — {t('setup.sousTitre')}</span>
            <span className="text-titre font-semibold">15 — {t('setup.compte.titre')}</span>
            <span className="text-ecran font-semibold">19 — {t('setup.titre')}</span>
          </Carte>
        </Section>

        <Section titre="Bouton">
          <Carte className="flex flex-col gap-4 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Bouton>{t('reglages.version.verifier')}</Bouton>
              <Bouton variante="primaire">{t('setup.reprise.bouton')}</Bouton>
              <Bouton variante="fantome">{t('reglages.connexion.annuler')}</Bouton>
              <Bouton variante="vert">{t('relecture.revenirDirect')}</Bouton>
              <Bouton variante="danger">{t('reglages.connexion.effacer')}</Bouton>
              <Bouton disabled>{t('setup.actions.tester')}</Bouton>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <Bouton taille="petit" variante="fantome" icone={Play}>{t('tuile.revoir')}</Bouton>
              <Bouton taille="petit" variante="fantome" icone={ScanSearch}>{t('tuile.detections')}</Bouton>
              <Bouton taille="petit" variante="fantome" icone={Camera}>{t('video.capturer')}</Bouton>
              <Bouton taille="petit" variante="actif" icone={Volume2}>{t('video.couperSon')}</Bouton>
              <Bouton taille="petit" variante="fantome" icone={Camera} titre={t('video.capturer')} />
              <Bouton icone={Maximize2} titre={t('video.pleinEcran')} />
            </div>
          </Carte>
        </Section>

        <Section titre="Segment · Puce · Interrupteur">
          <Carte className="flex flex-col gap-4 p-5">
            <Segment etiquette={t('recherche.periode')} valeur={periode} onChange={setPeriode}
                     options={[{ valeur: 'jour', libelle: t('colonne.aujourdhui') },
                               { valeur: 'semaine', libelle: t('recherche.periode7') },
                               { valeur: 'mois', libelle: t('recherche.periode30') }]} />
            <div className="flex flex-wrap gap-1.5">
              <Puce allumee={sujets.includes('person')} onClick={() => bascule('person')} compte={381}>{t('sujet.person')}</Puce>
              <Puce allumee={sujets.includes('vehicle')} onClick={() => bascule('vehicle')} compte={321}>{t('sujet.vehicle')}</Puce>
              <Puce allumee={sujets.includes('animal')} onClick={() => bascule('animal')} compte={63}>{t('sujet.animal')}</Puce>
              <Puce allumee={false} onClick={() => {}} echantillon="#8a8a8a" compte={106}>gris</Puce>
              <Puce allumee={false} onClick={() => {}} urgence>{t('sujet.alrmGlassBreak')}</Puce>
              <Puce allumee={false} onClick={() => {}} compte="157/j" tonCompte="var(--bad)">{t('sujet.motion')}</Puce>
            </div>
            <div className="flex items-center gap-6">
              <Interrupteur allume={allume} onChange={setAllume} etiquette={t('reglages.apparence.fond')} />
              <Interrupteur allume={allume} onChange={setAllume} etiquette={t('veilles.active')} ton="vert" />
              <Interrupteur allume={false} onChange={() => {}} etiquette={t('reglages.demarrage.ouvrir')} desactive />
            </div>
          </Carte>
        </Section>

        <Section titre="Champ">
          <Carte className="flex flex-col gap-4 p-5">
            <Champ id="cat-cherche" libelle={t('recherche.chercher')} icone={Search}
                   placeholder={t('recherche.placeholder')} aide={t('recherche.confianceDetail')} />
            <Champ id="cat-adresse" libelle={t('setup.adresse.label')} aide={t('setup.adresse.hint')}
                   placeholder="192.168.1.1" />
          </Carte>
        </Section>

        <Section titre="Rangee">
          <Carte>
            <Rangee titre={t('reglages.apparence.fond')} explication={t('reglages.apparence.fondDetail')}>
              <Interrupteur allume={allume} onChange={setAllume} etiquette={t('reglages.apparence.fond')} />
            </Rangee>
            <Rangee titre={t('reglages.confort.dossier')} explication={<span className="font-mono">C:\Users\Exemple\Pictures\Alcora</span>}>
              <Bouton>{t('reglages.confort.changer')}</Bouton>
              <Bouton variante="fantome">{t('commun.ouvrirDossier')}</Bouton>
            </Rangee>
          </Carte>
        </Section>
      </div>
    </div>
  );
}
