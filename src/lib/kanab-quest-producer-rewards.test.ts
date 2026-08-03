import { describe, expect, it } from "vitest";
import {
  buildKqProducerRewardProgress,
  findKqProducerRewardForEntry,
} from "@/lib/kanab-quest-producer-rewards";

const base = {
  campaignId: "campaign-1",
  producerId: "producer-1",
  producerName: "Ferme bretonne",
  heritageCode: "HERITAGE-001",
  heritageName: "Racines solides",
  heritageDescription: "Un avantage propre au producteur.",
  entries: [
    { entryId: "regular-1", title: "Fleur A", track: "regular" as const },
    { entryId: "regular-2", title: "Fleur B", track: "regular" as const },
    { entryId: "contest-1", title: "Fleur C", track: "concours" as const },
  ],
};

describe("producer notebook reward progress", () => {
  it("keeps Regular and Concours entries in the same frozen campaign", () => {
    const progress = buildKqProducerRewardProgress({
      ...base,
      approvedEntryIds: ["regular-1", "regular-2"],
      rewardedEntryIds: ["regular-1"],
      heritageGranted: false,
    });
    expect(progress.reviewedCount).toBe(2);
    expect(progress.requiredCount).toBe(3);
    expect(progress.completed).toBe(false);
    expect(progress.entries[0]?.boosterGranted).toBe(true);
    expect(progress.entries[2]?.track).toBe("concours");
  });

  it("completes only after every configured flower has an approved review", () => {
    const progress = buildKqProducerRewardProgress({
      ...base,
      approvedEntryIds: base.entries.map((entry) => entry.entryId),
      rewardedEntryIds: base.entries.map((entry) => entry.entryId),
      heritageGranted: true,
    });
    expect(progress.completed).toBe(true);
    expect(progress.heritageGranted).toBe(true);
  });

  it("never completes an empty campaign", () => {
    const progress = buildKqProducerRewardProgress({
      ...base,
      entries: [],
      approvedEntryIds: [],
      rewardedEntryIds: [],
      heritageGranted: false,
    });
    expect(progress.completed).toBe(false);
  });

  it("links every flower sheet to its producer Heritage campaign", () => {
    const progress = buildKqProducerRewardProgress({
      ...base,
      approvedEntryIds: [],
      rewardedEntryIds: [],
      heritageGranted: false,
    });
    expect(findKqProducerRewardForEntry([progress], "regular-2")?.heritageCode).toBe("HERITAGE-001");
    expect(findKqProducerRewardForEntry([progress], "unknown")).toBeNull();
  });
});
