export type KqProducerRewardEntryProgress = {
  entryId: string;
  title: string;
  track: "regular" | "concours";
  reviewed: boolean;
  boosterGranted: boolean;
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

// Producer cards are now awarded by the paid-purchase pipeline. Keeping the
// former per-review pipeline off prevents duplicate or contradictory rewards.
export const KQ_PRODUCER_NOTEBOOK_REWARDS_LIVE = false;

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
  heritageGranted: boolean;
}): KqProducerRewardProgress {
  const approved = new Set(input.approvedEntryIds);
  const rewarded = new Set(input.rewardedEntryIds);
  const entries = input.entries.map((entry) => ({
    ...entry,
    reviewed: approved.has(entry.entryId),
    boosterGranted: rewarded.has(entry.entryId),
  }));
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
    completed: entries.length > 0 && reviewedCount === entries.length,
    heritageGranted: input.heritageGranted,
    reviewedCount,
    requiredCount: entries.length,
    entries,
  };
}
