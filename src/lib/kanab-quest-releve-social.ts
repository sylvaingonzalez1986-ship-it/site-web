import type { KqReleveCommerceState } from './kanab-quest-releve-commerce';
import type { KqSocialHistoryEntry, KqSocialPlatform } from './kanab-quest-social';

/** Only a recorded narrative publication counts, never a recovery or sponsor event. */
export function getReleveSocialPublications(state: KqReleveCommerceState): KqSocialHistoryEntry[] {
  return state.operations.social?.version === 2
    ? state.operations.social.history.filter(entry => entry.narrativeVersion === 3 && !!entry.subject && (entry.platform === 'instagram' || entry.platform === 'x'))
    : [];
}

export function getReleveSocialLearning(state: KqReleveCommerceState) {
  const publications = getReleveSocialPublications(state);
  const platforms = (['instagram', 'x'] as const).map(platform => ({
    platform,
    published: publications.some(entry => entry.platform === platform) || state.milestones.includes(`social-${platform}-published`),
    read: state.milestones.includes(`social-${platform}-read`),
  }));
  const partnershipsRead = state.milestones.includes('social-partnerships-read');
  const next = platforms.find(platform => !platform.published || !platform.read);
  const pendingResult = next?.published && !next.read ? publications.find(entry => entry.platform === next.platform) : undefined;
  return { platforms, partnershipsRead, pendingResultId: pendingResult?.id, nextPlatform: next?.platform,
    complete: platforms.every(platform => platform.published && platform.read) && partnershipsRead };
}

export function getReleveSocialProgress(state: KqReleveCommerceState) {
  const learning = getReleveSocialLearning(state);
  const network = (platform: KqSocialPlatform) => platform === 'instagram' ? 'Instagram' : 'X';
  const next = learning.platforms.find(platform => !platform.published || !platform.read);
  return { complete: learning.complete, instruction: next
    ? !next.published ? `Sur ${network(next.platform)}, lis la situation, compare les brouillons et publie celui que tu choisis. Son coût mental est affiché.`
      : `Lis le résultat enregistré sur ${network(next.platform)} : abonnés, confiance, pression et mental. « Continuer » valide cette lecture.`
    : !learning.partnershipsRead ? 'Ouvre Partenariats, lis les conditions d’une marque puis valide leur lecture. Aucun contrat n’est nécessaire.'
      : 'Tu as publié sur les deux réseaux, lu leurs résultats et repéré les conditions des partenariats.' };
}
