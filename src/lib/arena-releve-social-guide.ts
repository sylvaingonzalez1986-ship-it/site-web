import type { ReleveGuideStep } from './arena-releve-guide';
import type { KqReleveCommerceState } from './kanab-quest-releve-commerce';
import { getReleveSocialLearning } from './kanab-quest-releve-social';

/** Guides the current social desk; publishing and reading remain explicit player actions. */
export function getReleveSocialGuide(state: KqReleveCommerceState): ReleveGuideStep[] {
  const learning = getReleveSocialLearning(state);
  if (learning.complete) return [];
  const steps: ReleveGuideStep[] = [
    { id: 'social-return', title: 'Retrouve tes réseaux', instruction: 'Reviens aux réseaux de ce dossier pour poursuivre ton essai.', selector: '[data-releve-guide="return-social"]' },
    { id: 'social-result', title: 'Lis les conséquences de ton choix', instruction: 'Compare les réactions enregistrées : abonnés, confiance, pression et mental. Puis choisis Continuer.', selector: '[data-social-result] [data-social-result-continue]:not(:disabled)' },
  ];
  if (learning.nextPlatform) {
    const platform = learning.nextPlatform, name = platform === 'instagram' ? 'Instagram' : 'X';
    steps.push(
      { id: 'social-story', title: 'Ouvre l’aventure', instruction: 'Retrouve les situations et les brouillons à publier.', selector: '[data-social-view="story"][aria-pressed="false"]' },
      { id: `social-network-${platform}`, title: `Essaie ${name}`, instruction: `Choisis ${name}. Chaque réseau a ses situations et ses réactions.`, selector: `[data-platform="${platform}"][aria-pressed="false"]` },
      { id: `social-publish-${platform}`, title: `Choisis ton message sur ${name}`, instruction: 'Lis la situation et compare les brouillons, leur coût mental et leurs enjeux. Publie celui qui te convient.', selector: `[data-social-scene][data-network="${platform}"] [data-social-choice]:not(:disabled)` },
      { id: 'social-recover', title: 'Retrouve de l’énergie mentale', instruction: 'Une pause peut rendre jusqu’à 30 points. Son prochain délai est affiché.', selector: '[data-social-recover]:not(:disabled)' },
      { id: 'social-time', title: 'Fais avancer l’essai', instruction: 'Avance de 5 minutes fictives pour laisser reposer le fil et récupérer du mental. Aucune attente réelle.', selector: '[data-releve-guide="advance-social-time"]' },
    );
  } else {
    steps.push(
      { id: 'social-partnerships', title: 'Découvre les marques', instruction: 'Ouvre Partenariats pour lire les conditions d’audience, de confiance et de publication.', selector: '[data-social-view="sponsors"][aria-pressed="false"]' },
      { id: 'social-read-partnerships', title: 'Repère les conditions d’un contrat', instruction: 'Lis les seuils, les deux contenus attendus et les publications disponibles. Valide leur lecture : tu n’as pas besoin d’accepter le contrat.', selector: '[data-releve-guide="read-social-partnerships"]' },
    );
  }
  return steps;
}
