import { getKqOnlineAudience, getKqOnlinePriceAcceptance, KQ_ONLINE_SITE_TIERS, type KqOnlineSnapshot } from './kanab-quest-online';
import { getKqStudioMerchMultiplier } from './kanab-quest-studio';

/** Virtual merchandise. Production is prepaid; the stock is independent of flower lots. */
export const KQ_MERCH_MODULES = [
  { code: 'paper', name: 'Papeterie de marque', costCents: 12000, minimumLevel: 2, minimumOrders: 5, minimumConfidence: 45 },
  { code: 'textile', name: 'Collection textile', costCents: 65000, minimumLevel: 3, minimumOrders: 30, minimumConfidence: 60 },
  { code: 'objects', name: 'Objets du quotidien', costCents: 95000, minimumLevel: 4, minimumOrders: 80, minimumConfidence: 70 },
] as const;
export type KqMerchModuleCode = typeof KQ_MERCH_MODULES[number]['code'];
export const KQ_MERCH_PRODUCTS = [
  { code: 'stickers', name: 'Stickers', module: 'paper', unitCostCents: 80, referencePriceCents: 400, demandMultiplier: 3, description: 'Petit prix et rotation rapide : un stock à renouveler plus souvent.' },
  { code: 'poster', name: 'Affiche', module: 'paper', unitCostCents: 300, referencePriceCents: 1200, demandMultiplier: 1.2, description: 'Une illustration de ton univers, avec une rotation assez régulière.' },
  { code: 'tote', name: 'Tote bag', module: 'textile', unitCostCents: 650, referencePriceCents: 1800, demandMultiplier: .9, description: 'Un sac imprimé à ta marque : un coût de fabrication et une cadence intermédiaires.' },
  { code: 'tshirt', name: 'T-shirt', module: 'textile', unitCostCents: 1100, referencePriceCents: 2800, demandMultiplier: .65, description: 'Une belle marge par pièce, mais une fabrication chère et des ventes plus lentes.' },
  { code: 'mug', name: 'Mug', module: 'objects', unitCostCents: 550, referencePriceCents: 1600, demandMultiplier: 1, description: 'Un objet du quotidien, entre rotation régulière et marge par pièce.' },
  { code: 'cap', name: 'Casquette', module: 'objects', unitCostCents: 850, referencePriceCents: 2200, demandMultiplier: .8, description: 'Une pièce de collection plus chère, à vendre avec un peu de patience.' },
] as const;
export type KqMerchProductCode = typeof KQ_MERCH_PRODUCTS[number]['code'];
export type KqMerchInventory = {
  code: KqMerchProductCode; quantity: number; priceCents: number; active: boolean; sold: number; progress: number;
};
export type KqMerchSnapshot = {
  version: 1;
  modules: KqMerchModuleCode[];
  inventory: KqMerchInventory[];
  stats: { unitsSold: number; revenueCents: number; netRevenueCents: number; feesCents: number; stockCostCents: number; costOfGoodsSoldCents: number; moduleCostCents: number };
  recentSales: Array<{ id: string; code: KqMerchProductCode; quantity: number; soldAt: string; priceCents: number; netPayoutCents: number; feesCents: number; costCents: number }>;
};

/** Active references, not units: broadening the range shares the existing audience. */
export function getKqMerchSlots(online: Pick<KqOnlineSnapshot, 'site'>) {
  const level = KQ_ONLINE_SITE_TIERS.find(tier => tier.code === online.site.tier)?.level ?? 0;
  return level >= 2 ? level : 0;
}

/** Guidance only. The server validates funds and prerequisites again when purchasing. */
export function getKqMerchModuleEligibility(online: KqOnlineSnapshot, moduleCode: string, cashCents: number): { allowed: boolean; blockers: string[] } {
  const collection = KQ_MERCH_MODULES.find(item => item.code === moduleCode);
  if (!collection) return { allowed: false, blockers: ['Cette collection est inconnue.'] };
  if (online.merch?.version !== 1) return { allowed: false, blockers: ['Le merchandising n’est pas encore disponible dans cette partie.'] };
  const blockers: string[] = [];
  if (online.merch.modules.includes(collection.code)) blockers.push('Cette collection est déjà acquise.');
  if (online.site.active !== true) blockers.push('Réactive ta boutique avant cet achat.');
  if (online.upgrades.branding !== true) blockers.push('Fais créer ton identité de marque.');
  if (getKqMerchSlots(online) < collection.minimumLevel) blockers.push(`Une boutique de niveau ${collection.minimumLevel} est nécessaire.`);
  if (!Number.isSafeInteger(online.stats.orders) || online.stats.orders < collection.minimumOrders) blockers.push(`Réalise ${collection.minimumOrders} commandes de fleurs.`);
  if (!Number.isFinite(online.confidence) || online.confidence > 100 || online.confidence < collection.minimumConfidence) blockers.push(`Atteins ${collection.minimumConfidence}/100 de confiance.`);
  if (!Number.isSafeInteger(cashCents) || cashCents < collection.costCents) blockers.push('La trésorerie disponible ne couvre pas cette collection.');
  return { allowed: blockers.length === 0, blockers };
}

/** Current organic demand estimate; no campaign traffic, visitors or buyers are invented. */
export function estimateKqMerchOffer(input: {
  online: KqOnlineSnapshot; code: string; priceCents: number; reputation: number; clients: number; activeProductCount?: number;
}) {
  const product = KQ_MERCH_PRODUCTS.find(item => item.code === input.code);
  if (!product) throw new Error('Article de merchandising inconnu.');
  if (!Number.isSafeInteger(input.priceCents) || input.priceCents < 1 || input.priceCents > 100000) throw new Error('Choisis un prix de 0,01 € à 1 000 €.');
  const feesCents = Math.round(input.priceCents * .025);
  const actualActiveCount = input.online.merch?.inventory.filter(row => row.active && row.quantity > 0).length ?? 0;
  const count = input.activeProductCount ?? Math.max(1, actualActiveCount);
  const validCount = Number.isSafeInteger(count) && count >= 1;
  const confidence = input.online.confidence;
  const validAudience = Number.isFinite(input.reputation) && input.reputation >= 0 && Number.isSafeInteger(input.clients) && input.clients >= 0;
  const available = input.online.merch?.version === 1 && input.online.merch.modules.includes(product.module)
    && input.online.site.active === true && input.online.upgrades.branding === true && getKqMerchSlots(input.online) > 0 && validCount && validAudience
    && Number.isFinite(confidence) && confidence >= 0 && confidence <= 100;
  const organicOnline = { ...input.online, marketing: { ...input.online.marketing, active: null } };
  const audience = available ? getKqOnlineAudience({ online: organicOnline, reputation: input.reputation, clients: input.clients, advertisingMultiplier: 1 }) : 0;
  const conversion = KQ_ONLINE_SITE_TIERS.find(tier => tier.code === input.online.site.tier)?.conversionMultiplier ?? 0;
  return {
    unitsPerDay: available ? audience * .04 * conversion * (.25 + .75 * confidence / 100) * product.demandMultiplier
      * getKqOnlinePriceAcceptance(input.priceCents / product.referencePriceCents)
      * getKqStudioMerchMultiplier(input.online, product.code, input.priceCents / product.referencePriceCents) / count : 0,
    referencePriceCents: product.referencePriceCents,
    feesCents,
    marginBeforeTaxCents: input.priceCents - product.unitCostCents - feesCents,
  };
}
