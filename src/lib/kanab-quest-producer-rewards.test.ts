import { describe, expect, it } from "vitest";
import { buildKqProducerRewardProgress, findKqProducerRewardForEntry } from "@/lib/kanab-quest-producer-rewards";

const base = {
  campaignId: "campaign-1", producerId: "producer-1", producerName: "Ferme bretonne",
  heritageCode: "HERITAGE-001", heritageName: "Racines solides", heritageDescription: "Un avantage propre au producteur.",
  heritageGranted: false,
  entries: [
    { entryId: "regular-a", productId: "product-a", title: "Fleur A", track: "regular" as const },
    { entryId: "concours-a", productId: "product-a", title: "Fleur A concours", track: "concours" as const },
    { entryId: "concours-b", productId: "product-b", title: "Fleur B", track: "concours" as const },
  ],
};

describe("unified producer notebook rewards", () => {
  it("counts a flower once across tracks and keeps Heritage distinct from completion", () => {
    const progress = buildKqProducerRewardProgress({ ...base, approvedEntryIds: ["concours-a"] });
    expect(progress).toMatchObject({ requiredCount: 2, reviewedCount: 1, completed: false, heritageEligible: true });
    expect(progress.entries[0].entryIds).toEqual(["regular-a", "concours-a"]);
    expect(findKqProducerRewardForEntry([progress], "concours-a")).toBe(progress);
    expect(findKqProducerRewardForEntry([progress], "missing")).toBeNull();
  });

  it("requires an approved review for every current product for the 100 game euro reward", () => {
    const progress = buildKqProducerRewardProgress({ ...base,
      approvedProductIds: ["product-a", "product-b", "old-product"], completionGranted: true });
    expect(progress).toMatchObject({ requiredCount: 2, reviewedCount: 2, completed: true,
      completionReward: { kind: "cash", cashCents: 10_000, granted: true } });
  });

  it("requires all distinct products purchased before the one-time Buddie draw", () => {
    const partial = buildKqProducerRewardProgress({ ...base, purchasedProductIds: ["product-a", "product-a"] });
    expect(partial.purchasedCount).toBe(1);
    expect(partial.purchaseReward.eligible).toBe(false);
    const card = { code: "HH2026-010", name: "Lifter", rarity: "silver" as const, imageUrl: "/lifter.webp" };
    const complete = buildKqProducerRewardProgress({ ...base, purchasedProductIds: ["product-a", "product-b"],
      purchaseGranted: true, purchaseCard: card });
    expect(complete.purchaseReward).toEqual({ eligible: true, granted: true, card });
    expect(complete.completed).toBe(false);
  });

  it("never promises new per-flower packs on either track", () => {
    const progress = buildKqProducerRewardProgress({ ...base, approvedProductIds: ["product-a", "product-b"] });
    for (const entry of progress.entries) {
      expect(entry.packReward).toEqual({ eligible: false, totalPacks: 0, grantedPacks: 0,
        availablePacks: 0, openedPacks: 0, availableEntitlementIds: [] });
    }
  });

  it("preserves historical available packs even on an alias entry", () => {
    const progress = buildKqProducerRewardProgress({ ...base, packProgressByEntryId: new Map([["concours-a", {
      grantedPacks: 5, availablePacks: 3, openedPacks: 2, availableEntitlementIds: ["pack-3", "pack-4", "pack-5"],
    }]]) });
    expect(progress.entries[0].packReward).toEqual({ eligible: false, totalPacks: 5, grantedPacks: 5,
      availablePacks: 3, openedPacks: 2, availableEntitlementIds: ["pack-3", "pack-4", "pack-5"] });
  });

  it("never unlocks an empty catalogue and keeps already earned rewards", () => {
    const progress = buildKqProducerRewardProgress({ ...base, entries: [], completionGranted: true, purchaseGranted: true });
    expect(progress.completed).toBe(false);
    expect(progress.heritageEligible).toBe(false);
    expect(progress.purchaseReward).toMatchObject({ eligible: false, granted: true });
    expect(progress.completionReward.granted).toBe(true);
  });
});
