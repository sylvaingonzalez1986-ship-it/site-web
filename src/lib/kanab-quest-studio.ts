import type { KqOnlineSnapshot } from './kanab-quest-online';

export type KqStudioTrack = 'photography' | 'branding' | 'editorial';
export type KqStudioStyle = 'clear' | 'craft' | 'signature';
export type KqStudioSnapshot = {
  version: 1;
  levels: Record<KqStudioTrack, number>;
  style: KqStudioStyle;
};
export type KqStudioLevelDefinition = {
  track: KqStudioTrack; level: number; name: string; costCents: number;
  minimumSiteLevel: number; minimumOrders: number; minimumConfidence: number;
  requiredLevels: Partial<Record<KqStudioTrack, number>>; description: string;
};
export const KQ_STUDIO_TRACKS = [
  { code: 'photography', name: 'Photo', description: 'Travaille la lumière et les compositions pour rendre tes fleurs plus lisibles.' },
  { code: 'branding', name: 'Identité', description: 'Construis un univers cohérent pour les fleurs, les emballages et le merch.' },
  { code: 'editorial', name: 'Fiches & récits', description: 'Choisis un ton et des produits qui lui correspondent : un bon accord aide à vendre.' },
] as const;
/** Each amount pays only the next step; acquired work is retained. */
export const KQ_STUDIO_LEVELS = [
  { track: 'photography', level: 1, name: 'Photos et fiches produits', costCents: 30000, minimumSiteLevel: 1, minimumOrders: 0, minimumConfidence: 0, requiredLevels: {}, description: 'Des images nettes : conversion des fleurs ×1,10. Aucun effet sur le merch.' },
  { track: 'photography', level: 2, name: 'Studio lumière douce', costCents: 55000, minimumSiteLevel: 2, minimumOrders: 15, minimumConfidence: 55, requiredLevels: {}, description: 'Des prises de vue régulières : conversion des fleurs ×1,18 au total.' },
  { track: 'photography', level: 3, name: 'Éditorial de collection', costCents: 110000, minimumSiteLevel: 4, minimumOrders: 80, minimumConfidence: 70, requiredLevels: {}, description: 'Des compositions abouties : conversion des fleurs ×1,26 au total.' },
  { track: 'branding', level: 1, name: 'Identité par un graphiste', costCents: 70000, minimumSiteLevel: 1, minimumOrders: 0, minimumConfidence: 0, requiredLevels: {}, description: 'Une première identité : fleurs ×1,08, doypacks imprimés et ateliers de merch accessibles selon leurs prérequis.' },
  { track: 'branding', level: 2, name: 'Charte complète', costCents: 100000, minimumSiteLevel: 3, minimumOrders: 40, minimumConfidence: 65, requiredLevels: { photography: 1 }, description: 'Une gamme cohérente : conversion des fleurs ×1,14 et du merch ×1,08 au total.' },
  { track: 'branding', level: 3, name: 'Univers signature', costCents: 180000, minimumSiteLevel: 5, minimumOrders: 180, minimumConfidence: 80, requiredLevels: { photography: 2 }, description: 'Un univers reconnaissable : conversion des fleurs ×1,20 et du merch ×1,16 au total.' },
  { track: 'editorial', level: 1, name: 'Fiches détaillées', costCents: 18000, minimumSiteLevel: 2, minimumOrders: 5, minimumConfidence: 45, requiredLevels: { photography: 1 }, description: 'Ton et offre en accord : conversion +4 %. Si le produit ne correspond pas : −2 %.' },
  { track: 'editorial', level: 2, name: 'Récits de collection', costCents: 45000, minimumSiteLevel: 3, minimumOrders: 30, minimumConfidence: 60, requiredLevels: { branding: 1 }, description: 'Ton et offre en accord : conversion +8 %. Si le produit ne correspond pas : −4 %.' },
  { track: 'editorial', level: 3, name: 'Direction éditoriale', costCents: 95000, minimumSiteLevel: 4, minimumOrders: 80, minimumConfidence: 75, requiredLevels: { photography: 2, branding: 2 }, description: 'Ton et offre en accord : conversion +12 %. Si le produit ne correspond pas : −6 %.' },
] as const satisfies readonly KqStudioLevelDefinition[];
export const KQ_STUDIO_STYLES = [
  { code: 'clear', name: 'Clair & accessible', description: 'Un message direct, pour une gamme à prix doux.', flowerHint: 'Toute qualité vendable, prix ≤105 % de la référence.', merchHint: 'Stickers et affiches, prix ≤105 % de la référence.' },
  { code: 'craft', name: 'Atelier artisanal', description: 'Les matières, les gestes et une offre régulière.', flowerHint: 'Qualité ≥7,5/10, prix ≤130 % de la référence.', merchHint: 'Tote bags et mugs, prix ≤130 % de la référence.' },
  { code: 'signature', name: 'Collection signature', description: 'Une sélection exigeante et des pièces de collection.', flowerHint: 'Qualité ≥8,5/10, prix entre 100 et 150 % de la référence.', merchHint: 'T-shirts et casquettes, prix entre 100 et 150 % de la référence.' },
] as const;

type StudioOnline = Pick<KqOnlineSnapshot, 'studio' | 'upgrades'>;
const validLevel = (value: number | undefined) => Number.isSafeInteger(value) && value! >= 0 && value! <= 3 ? value! : 0;

/** Original one-off purchases remain the first level, including old snapshots. */
export function getKqStudioLevels(online: StudioOnline): Record<KqStudioTrack, number> {
  const levels = online.studio?.version === 1 ? online.studio.levels : undefined;
  return {
    photography: Math.max(validLevel(levels?.photography), online.upgrades.photography === true ? 1 : 0),
    branding: Math.max(validLevel(levels?.branding), online.upgrades.branding === true ? 1 : 0),
    editorial: validLevel(levels?.editorial),
  };
}
export function getKqStudioStyle(online: Pick<KqOnlineSnapshot, 'studio'>): KqStudioStyle {
  return online.studio?.version === 1 && KQ_STUDIO_STYLES.some(style => style.code === online.studio!.style) ? online.studio.style : 'craft';
}

/** Guidance only. Purchases are validated again by the server. */
export function getKqStudioEligibility(online: KqOnlineSnapshot, track: string, level: number, cashCents: number): { allowed: boolean; costCents: number | null; blockers: string[] } {
  const target: KqStudioLevelDefinition | undefined = KQ_STUDIO_LEVELS.find(item => item.track === track && item.level === level);
  if (!target) return { allowed: false, costCents: null, blockers: ['Cette amélioration est inconnue.'] };
  const levels = getKqStudioLevels(online), blockers: string[] = [];
  if (level !== levels[target.track] + 1) blockers.push(level <= levels[target.track] ? 'Ce niveau est déjà acquis.' : 'Acquiers d’abord le niveau précédent de cet atelier.');
  if (online.studio?.version !== 1 && !(level === 1 && target.track !== 'editorial')) blockers.push('Cet atelier avancé n’est pas encore disponible dans cette partie.');
  if (!online.site.createdAt || online.site.active !== true) blockers.push('Active ta boutique avant cet achat.');
  const siteLevel = ({ basic: 1, improved: 2, pro: 3, studio: 4, signature: 5, flagship: 6 } as const)[online.site.tier];
  if (!siteLevel || siteLevel < target.minimumSiteLevel) blockers.push(`Une boutique de niveau ${target.minimumSiteLevel} est nécessaire.`);
  if (!Number.isSafeInteger(online.stats.orders) || online.stats.orders < target.minimumOrders) blockers.push(`Réalise ${target.minimumOrders} commandes de fleurs.`);
  if (!Number.isFinite(online.confidence) || online.confidence > 100 || online.confidence < target.minimumConfidence) blockers.push(`Atteins ${target.minimumConfidence}/100 de confiance.`);
  for (const required of KQ_STUDIO_TRACKS) {
    const requiredLevel = target.requiredLevels[required.code];
    if (requiredLevel && levels[required.code] < requiredLevel) blockers.push(`${required.name} doit atteindre le niveau ${requiredLevel}.`);
  }
  if (!Number.isSafeInteger(cashCents) || cashCents < target.costCents) blockers.push('La trésorerie disponible ne couvre pas cette amélioration.');
  return { allowed: blockers.length === 0, costCents: target.costCents, blockers };
}

/** Use the actual offer ratio, including any active customer request reference. */
export function getKqStudioEditorialFit(online: StudioOnline, input: { quality?: number; merchCode?: string; priceRatio: number }): { matched: boolean; multiplier: number } {
  const style = getKqStudioStyle(online), level = getKqStudioLevels(online).editorial;
  const ratio = input.priceRatio;
  const validRatio = Number.isFinite(ratio) && ratio >= 0;
  const quality = input.quality;
  const merch = input.merchCode !== undefined;
  const matched = validRatio && (style === 'clear'
    ? ratio <= 1.05 && (merch ? ['stickers', 'poster'].includes(input.merchCode!) : Number.isFinite(quality) && quality! >= 5.8)
    : style === 'craft'
      ? ratio <= 1.3 && (merch ? ['tote', 'mug'].includes(input.merchCode!) : Number.isFinite(quality) && quality! >= 7.5)
      : ratio >= 1 && ratio <= 1.5 && (merch ? ['tshirt', 'cap'].includes(input.merchCode!) : Number.isFinite(quality) && quality! >= 8.5));
  return { matched, multiplier: level === 0 ? 1 : matched ? [1, 1.04, 1.08, 1.12][level] : [1, .98, .96, .94][level] };
}
export function getKqStudioFlowerMultiplier(online: StudioOnline, quality: number, priceRatio: number) {
  const levels = getKqStudioLevels(online);
  return [1, 1.1, 1.18, 1.26][levels.photography] * [1, 1.08, 1.14, 1.2][levels.branding]
    * getKqStudioEditorialFit(online, { quality, priceRatio }).multiplier;
}
export function getKqStudioMerchMultiplier(online: StudioOnline, code: string, priceRatio: number) {
  return [1, 1, 1.08, 1.16][getKqStudioLevels(online).branding]
    * getKqStudioEditorialFit(online, { merchCode: code, priceRatio }).multiplier;
}
