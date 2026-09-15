import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  calculateKqPlacardScore,
  didKqReputationTierChange,
  getKqReputationProgress,
  KQ_REPUTATION_TIERS,
} from "@/lib/kanab-quest-reputation";

describe("Kanab Quest reputation progression", () => {
  it("adds capped season activity and diminishing reputation to the Placard score", () => {
    expect(calculateKqPlacardScore({ rating: 1000, seasonPoints: 100, reputation: 0 }))
      .toMatchObject({ score: 1025, seasonBonus: 25, reputationBonus: 0 });
    expect(calculateKqPlacardScore({ rating: 980, seasonPoints: 100, reputation: 150 }))
      .toMatchObject({ score: 1054, seasonBonus: 25, reputationBonus: 49 });
    expect(calculateKqPlacardScore({ rating: 1000, seasonPoints: 9999, reputation: 9999 }))
      .toMatchObject({ score: 1250, seasonBonus: 150, reputationBonus: 100 });
  });

  it("keeps ranking bonuses independent from market tier thresholds and sanitizes invalid inputs", () => {
    expect([20, 60, 150, 300, 600].map((reputation) => (
      calculateKqPlacardScore({ rating: 1000, seasonPoints: 0, reputation }).reputationBonus
    ))).toEqual([18, 31, 49, 69, 98]);
    expect(calculateKqPlacardScore({ rating: Number.NaN, seasonPoints: -1, reputation: Number.NaN }))
      .toMatchObject({ score: 1000, seasonBonus: 0, reputationBonus: 0 });
  });

  it("uses increasing permanent thresholds", () => {
    expect(KQ_REPUTATION_TIERS[0].minimum).toBe(0);
    expect(KQ_REPUTATION_TIERS.map((tier) => tier.minimum)).toEqual([0, 60, 200, 600, 1500, 3000]);
    expect(new Set(KQ_REPUTATION_TIERS.map((tier) => tier.name)).size).toBe(KQ_REPUTATION_TIERS.length);
  });

  it("reports the current tier and progress toward the next one", () => {
    expect(getKqReputationProgress(59)).toMatchObject({
      tier: { code: "novice" },
      nextTier: { code: "steady-hand" },
      pointsToNext: 1,
      progressPercent: 98,
    });
    expect(getKqReputationProgress(200)).toMatchObject({
      tier: { code: "lot-artisan" },
      nextTier: { code: "local-signature" },
      pointsToNext: 400,
      progressPercent: 0,
    });
    expect(getKqReputationProgress(3000)).toMatchObject({
      tier: { code: "jury-reference" },
      nextTier: null,
      pointsToNext: 0,
      progressPercent: 100,
    });
  });

  it("detects a promotion without treating ordinary gains as a tier change", () => {
    expect(didKqReputationTierChange(59, 60)).toBe(true);
    expect(didKqReputationTierChange(60, 199)).toBe(false);
    expect(getKqReputationProgress(Number.NaN).reputation).toBe(0);
  });

  it("keeps reputation titles and Placard scores in the full Arena leaderboard", () => {
    const arenaClient = readFileSync(
      join(process.cwd(), "src/components/contest/ContestHubClient.tsx"),
      "utf8",
    );
    expect(arenaClient).toContain("getKqReputationProgress(item.reputation).tier.name");
    expect(arenaClient).toContain("score: String(item.placardScore)");
  });
});
