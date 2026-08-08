export type KqProducerRewardEntryProgress = {
  entryId: string;
  title: string;
  track: "regular" | "concours";
  reviewed: boolean;
  boosterGranted: boolean;
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
  heritageGranted: boolean;
  reviewedCount: number;
  requiredCount: number;
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
};

export function findKqProducerRewardForEntry(
  campaigns: readonly KqProducerRewardProgress[],
  entryId: string,
) {
  return campaigns.find((campaign) => campaign.entries.some((entry) => entry.entryId === entryId)) ?? null;
}

// Producer Heritage cards are awarded automatically after an eligible review
// is approved. The database operation is idempotent per customer and producer.
export const KQ_PRODUCER_NOTEBOOK_REWARDS_LIVE = true;

export function buildKqProducerRewardProgress(input: {
  campaignId: string;
  producerId: string;
  producerName: string;
  producerImage?: string | null;
  heritageCode: string;
  heritageName: string;
  heritageDescription: string;
  heritageImage?: string | null;
  entries: Array<{ entryId: string; title: string; track: "regular" | "concours" }>;
  approvedEntryIds: Iterable<string>;
  rewardedEntryIds: Iterable<string>;
  packProgressByEntryId?: ReadonlyMap<string, {
    grantedPacks: number;
    availablePacks: number;
    openedPacks: number;
    availableEntitlementIds: string[];
  }>;
  heritageGranted: boolean;
}): KqProducerRewardProgress {
  const approved = new Set(input.approvedEntryIds);
  const rewarded = new Set(input.rewardedEntryIds);
  const entries = input.entries.map((entry) => {
    const persisted = input.packProgressByEntryId?.get(entry.entryId);
    const eligible = entry.track === "concours";
    const grantedPacks = eligible
      ? Math.max(0, persisted?.grantedPacks ?? (rewarded.has(entry.entryId) ? 1 : 0))
      : 0;
    const availablePacks = Math.min(grantedPacks, Math.max(0, persisted?.availablePacks ?? 0));
    const openedPacks = Math.min(
      Math.max(0, grantedPacks - availablePacks),
      Math.max(0, persisted?.openedPacks ?? grantedPacks - availablePacks),
    );
    return {
      ...entry,
      reviewed: approved.has(entry.entryId),
      boosterGranted: grantedPacks > 0,
      packReward: {
        eligible,
        totalPacks: eligible ? 5 : 0,
        grantedPacks,
        availablePacks,
        openedPacks,
        availableEntitlementIds: eligible
          ? (persisted?.availableEntitlementIds ?? []).slice(0, availablePacks)
          : [],
      },
    };
  });
  const reviewedCount = entries.filter((entry) => entry.reviewed).length;
  return {
    campaignId: input.campaignId,
    producerId: input.producerId,
    producerName: input.producerName,
    producerImage: input.producerImage ?? "",
    heritageCode: input.heritageCode,
    heritageName: input.heritageName,
    heritageDescription: input.heritageDescription,
    heritageImage: input.heritageImage ?? "",
    completed: reviewedCount > 0,
    heritageGranted: input.heritageGranted,
    reviewedCount,
    requiredCount: entries.length,
    entries,
  };
}
