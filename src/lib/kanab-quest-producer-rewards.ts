import type { KqNotebookBuddieOdds } from "@/lib/kanab-quest-notebook-quantity";

export type { KqNotebookBuddieOdds } from "@/lib/kanab-quest-notebook-quantity";

export type KqNotebookQuantityProgress = {
  productId: string;
  bestOrderGrams: number;
  totalCashCents: number;
  bonusCashCents: number;
  grantedCashCents: number;
  availableCashCents: number;
};

export type KqProducerRewardCard = {
  code: string;
  name: string;
  rarity: "common" | "silver" | "gold";
  imageUrl: string;
};

export const KQ_PRODUCER_FLOWER_CASH_CENTS = 10_000;
export const KQ_PRODUCER_NOTEBOOK_REWARDS_LIVE = true;

export function getKqProducerCompletionCashCents(flowerCount: number): number {
  return Number.isSafeInteger(flowerCount) && flowerCount > 0
    ? flowerCount * KQ_PRODUCER_FLOWER_CASH_CENTS
    : 0;
}

export type KqProducerRewardEntryProgress = {
  entryId: string;
  entryIds: string[];
  productId: string;
  title: string;
  track: "regular" | "concours";
  reviewed: boolean;
  purchased: boolean;
  boosterGranted: boolean;
  quantityReward: KqNotebookQuantityProgress;
  packReward: {
    eligible: boolean;
    totalPacks: number;
    grantedPacks: number;
    availablePacks: number;
    openedPacks: number;
    availableEntitlementIds: string[];
  };
};

export type KqProducerRewardProgress = {
  campaignId: string;
  producerId: string;
  producerName: string;
  producerImage: string;
  heritageCode: string;
  heritageName: string;
  heritageDescription: string;
  heritageImage: string;
  completed: boolean;
  heritageEligible: boolean;
  heritageGranted: boolean;
  reviewedCount: number;
  purchasedCount: number;
  requiredCount: number;
  completionReward: { kind: "cash"; cashCents: number; granted: boolean };
  quantityRewardsAvailable: boolean;
  quantityReward: { bonusCashCents: number; grantedCashCents: number; availableCashCents: number };
  purchaseReward: { eligible: boolean; granted: boolean; card: KqProducerRewardCard | null; odds: KqNotebookBuddieOdds | null };
  entries: KqProducerRewardEntryProgress[];
};

export type KqProducerNotebookRewardReceipt = {
  live: boolean;
  flowerBoosterGranted: boolean;
  flowerBoostersGranted: number;
  flowerBoostersTotal: number;
  boosterCardCount: number;
  heritageGranted: number;
  heritageCodes: string[];
  completionGranted: number;
  cashCents: number;
  producerId: string;
};

export function findKqProducerRewardForEntry(
  campaigns: readonly KqProducerRewardProgress[],
  entryId: string,
) {
  return campaigns.find((campaign) => campaign.entries.some((entry) =>
    entry.entryId === entryId || entry.entryIds?.includes(entryId),
  )) ?? null;
}

type PackProgress = {
  grantedPacks: number;
  availablePacks: number;
  openedPacks: number;
  availableEntitlementIds: string[];
};

export function buildKqProducerRewardProgress(input: {
  campaignId: string;
  producerId: string;
  producerName: string;
  producerImage?: string | null;
  heritageCode: string;
  heritageName: string;
  heritageDescription: string;
  heritageImage?: string | null;
  entries: Array<{ entryId: string; productId?: string; title: string; track: "regular" | "concours" }>;
  approvedEntryIds?: Iterable<string>;
  approvedProductIds?: Iterable<string>;
  purchasedProductIds?: Iterable<string>;
  rewardedEntryIds?: Iterable<string>;
  packProgressByEntryId?: ReadonlyMap<string, PackProgress>;
  heritageGranted: boolean;
  heritageEligible?: boolean;
  completionGranted?: boolean;
  completionCashCents?: number;
  purchaseGranted?: boolean;
  purchaseCard?: KqProducerRewardCard | null;
  quantityRewardsAvailable?: boolean;
  quantityRewards?: KqNotebookQuantityProgress[];
  purchaseOdds?: KqNotebookBuddieOdds | null;
}): KqProducerRewardProgress {
  const approvedEntries = new Set(input.approvedEntryIds ?? []);
  const approvedProducts = new Set(input.approvedProductIds ?? []);
  const purchasedProducts = new Set(input.purchasedProductIds ?? []);
  const rewarded = new Set(input.rewardedEntryIds ?? []);
  const quantityByProduct = new Map(input.quantityRewardsAvailable
    ? input.quantityRewards?.map((quantity) => [quantity.productId, quantity])
    : []);
  const products = new Map<string, typeof input.entries>();
  for (const entry of input.entries) {
    const productId = entry.productId || entry.entryId;
    const aliases = products.get(productId) ?? [];
    if (!aliases.some((alias) => alias.entryId === entry.entryId)) aliases.push(entry);
    products.set(productId, aliases);
  }
  const entries: KqProducerRewardEntryProgress[] = [...products].map(([productId, aliases]) => {
    const entry = aliases.find((alias) => alias.track === "concours") ?? aliases[0];
    const packs = aliases.map((alias) => input.packProgressByEntryId?.get(alias.entryId) ?? {
      grantedPacks: rewarded.has(alias.entryId) ? 1 : 0,
      availablePacks: 0,
      openedPacks: rewarded.has(alias.entryId) ? 1 : 0,
      availableEntitlementIds: [],
    });
    const grantedPacks = packs.reduce((total, pack) => total + Math.max(0, pack.grantedPacks), 0);
    const availableEntitlementIds = [...new Set(packs.flatMap((pack) => pack.availableEntitlementIds))];
    const availablePacks = Math.min(grantedPacks, packs.reduce((total, pack) => total + Math.max(0, pack.availablePacks), 0));
    const openedPacks = Math.min(grantedPacks - availablePacks, packs.reduce((total, pack) => total + Math.max(0, pack.openedPacks), 0));
    return {
      ...entry,
      productId,
      entryIds: aliases.map((alias) => alias.entryId),
      reviewed: approvedProducts.has(productId) || aliases.some((alias) => approvedEntries.has(alias.entryId)),
      purchased: purchasedProducts.has(productId),
      boosterGranted: grantedPacks > 0,
      quantityReward: quantityByProduct.get(productId) ?? {
        productId, bestOrderGrams: 0, totalCashCents: 0,
        bonusCashCents: 0, grantedCashCents: 0, availableCashCents: 0,
      },
      // Previously awarded packs remain available; new reviews no longer promise packs.
      packReward: { eligible: false, totalPacks: grantedPacks, grantedPacks, availablePacks, openedPacks, availableEntitlementIds },
    };
  });
  const reviewedCount = entries.filter((entry) => entry.reviewed).length;
  const purchasedCount = entries.filter((entry) => entry.purchased).length;
  return {
    campaignId: input.campaignId,
    producerId: input.producerId,
    producerName: input.producerName,
    producerImage: input.producerImage ?? "",
    heritageCode: input.heritageCode,
    heritageName: input.heritageName,
    heritageDescription: input.heritageDescription,
    heritageImage: input.heritageImage ?? "",
    completed: entries.length > 0 && reviewedCount === entries.length,
    heritageEligible: input.heritageEligible ?? reviewedCount > 0,
    heritageGranted: input.heritageGranted,
    reviewedCount,
    purchasedCount,
    requiredCount: entries.length,
    completionReward: {
      kind: "cash",
      cashCents: input.completionCashCents ?? getKqProducerCompletionCashCents(entries.length),
      granted: input.completionGranted === true,
    },
    quantityRewardsAvailable: input.quantityRewardsAvailable === true,
    quantityReward: entries.reduce((total, entry) => ({
      bonusCashCents: total.bonusCashCents + entry.quantityReward.bonusCashCents,
      grantedCashCents: total.grantedCashCents + entry.quantityReward.grantedCashCents,
      availableCashCents: total.availableCashCents + entry.quantityReward.availableCashCents,
    }), { bonusCashCents: 0, grantedCashCents: 0, availableCashCents: 0 }),
    purchaseReward: {
      eligible: entries.length > 0 && purchasedCount === entries.length,
      granted: input.purchaseGranted === true,
      card: input.purchaseCard ?? null,
      odds: input.quantityRewardsAvailable ? input.purchaseOdds ?? null : null,
    },
    entries,
  };
}
