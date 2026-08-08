import { readFileSync } from "node:fs";
import { join } from "node:path";
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

const approvedReviewMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260805000100_kq_heritage_on_approved_review.sql"),
  "utf8",
);
const approvedReviewBackfillMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260805000300_kq_backfill_approved_review_heritage.sql"),
  "utf8",
);
const fiveContestFlowerPacksMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260808000100_kq_five_contest_flower_packs.sql"),
  "utf8",
);

describe("producer notebook reward progress", () => {
  it("unlocks a producer campaign after any eligible approved review", () => {
    const progress = buildKqProducerRewardProgress({
      ...base,
      approvedEntryIds: ["regular-1", "regular-2"],
      rewardedEntryIds: [],
      heritageGranted: false,
    });
    expect(progress.reviewedCount).toBe(2);
    expect(progress.requiredCount).toBe(3);
    expect(progress.completed).toBe(true);
    expect(progress.entries[0]?.boosterGranted).toBe(false);
    expect(progress.entries[2]?.track).toBe("concours");
  });

  it("stays unlocked when every configured flower has an approved review", () => {
    const progress = buildKqProducerRewardProgress({
      ...base,
      approvedEntryIds: base.entries.map((entry) => entry.entryId),
      rewardedEntryIds: base.entries.map((entry) => entry.entryId),
      heritageGranted: true,
    });
    expect(progress.completed).toBe(true);
    expect(progress.heritageGranted).toBe(true);
  });

  it("tracks five independently openable packs only for contest flowers", () => {
    const progress = buildKqProducerRewardProgress({
      ...base,
      approvedEntryIds: ["regular-1", "contest-1"],
      rewardedEntryIds: ["contest-1"],
      packProgressByEntryId: new Map([["contest-1", {
        grantedPacks: 5,
        availablePacks: 3,
        openedPacks: 2,
        availableEntitlementIds: ["pack-3", "pack-4", "pack-5"],
      }]]),
      heritageGranted: true,
    });
    expect(progress.entries[0]?.packReward).toMatchObject({ eligible: false, totalPacks: 0 });
    expect(progress.entries[2]?.packReward).toEqual({
      eligible: true,
      totalPacks: 5,
      grantedPacks: 5,
      availablePacks: 3,
      openedPacks: 2,
      availableEntitlementIds: ["pack-3", "pack-4", "pack-5"],
    });
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

  it("keeps Heritage tied to an approved eligible review", () => {
    expect(approvedReviewMigration).toContain("campaign_entry.entry_id = v_entry.id");
    expect(approvedReviewMigration).toContain("AND status = 'approved'");
    expect(approvedReviewMigration).toContain("'heritageGranted', 1");
    expect(approvedReviewMigration).not.toContain("INSERT INTO public.kq_support_booster_entitlements");
    expect(approvedReviewMigration).toContain(
      "REVOKE ALL ON FUNCTION public.rpc_kq_draw_heritage_for_purchase",
    );
  });

  it("grants five ten-card packs for each approved contest flower idempotently", () => {
    expect(fiveContestFlowerPacksMigration).toContain("IF v_entry.track = 'concours'");
    expect(fiveContestFlowerPacksMigration).toContain("FOR v_pack_index IN 2..5 LOOP");
    expect(fiveContestFlowerPacksMigration).toContain("card_count");
    expect(fiveContestFlowerPacksMigration).toContain("ON CONFLICT (reward_key) DO UPDATE");
    expect(fiveContestFlowerPacksMigration).toContain("PRIMARY KEY (flower_grant_id, pack_index)");
    expect(fiveContestFlowerPacksMigration).toContain("WHERE review.status = 'approved'");
  });

  it("reconciles reviews approved before Heritage activation", () => {
    expect(approvedReviewBackfillMigration).toContain("WHERE review.status = 'approved'");
    expect(approvedReviewBackfillMigration).toContain("rpc_kq_grant_producer_notebook_rewards");
    expect(approvedReviewBackfillMigration).toContain("campaign.status = 'active'");
  });
});
