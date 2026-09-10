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

  it("matches the visible reputation milestones and sanitizes invalid inputs", () => {
    expect([20, 60, 150, 300, 600].map((reputation) => (
      calculateKqPlacardScore({ rating: 1000, seasonPoints: 0, reputation }).reputationBonus
    ))).toEqual([18, 31, 49, 69, 98]);
    expect(calculateKqPlacardScore({ rating: Number.NaN, seasonPoints: -1, reputation: Number.NaN }))
      .toMatchObject({ score: 1000, seasonBonus: 0, reputationBonus: 0 });
  });

  it("uses increasing permanent thresholds", () => {
    expect(KQ_REPUTATION_TIERS[0].minimum).toBe(0);
    expect(KQ_REPUTATION_TIERS.map((tier) => tier.minimum)).toEqual([0, 20, 60, 150, 300, 600]);
    expect(new Set(KQ_REPUTATION_TIERS.map((tier) => tier.name)).size).toBe(KQ_REPUTATION_TIERS.length);
  });

  it("reports the current tier and progress toward the next one", () => {
    expect(getKqReputationProgress(19)).toMatchObject({
      tier: { code: "novice" },
      nextTier: { code: "steady-hand" },
      pointsToNext: 1,
      progressPercent: 95,
    });
    expect(getKqReputationProgress(60)).toMatchObject({
      tier: { code: "lot-artisan" },
      nextTier: { code: "local-signature" },
      pointsToNext: 90,
      progressPercent: 0,
    });
    expect(getKqReputationProgress(900)).toMatchObject({
      tier: { code: "jury-reference" },
      nextTier: null,
      pointsToNext: 0,
      progressPercent: 100,
    });
  });

  it("detects a promotion without treating ordinary gains as a tier change", () => {
    expect(didKqReputationTierChange(19, 20)).toBe(true);
    expect(didKqReputationTierChange(20, 59)).toBe(false);
    expect(getKqReputationProgress(Number.NaN).reputation).toBe(0);
  });

  it("publishes the reputation title in both Placard leaderboards", () => {
    const placardClient = readFileSync(
      join(process.cwd(), "src/components/placard/KanabQuestDicePrototype.tsx"),
      "utf8",
    );
    const arenaClient = readFileSync(
      join(process.cwd(), "src/components/contest/ContestHubClient.tsx"),
      "utf8",
    );
    expect(placardClient).toContain("reputationTier: getKqReputationProgress(entry.reputation).tier.name");
    expect(placardClient).toContain("{entry.reputationTier} · {entry.reputation} rép.");
    expect(placardClient).toContain("<small>Score Placard</small>");
    expect(placardClient).toContain("<strong>{entry.placardScore}</strong>");
    expect(arenaClient).toContain("getKqReputationProgress(item.reputation).tier.name");
    expect(arenaClient).toContain("score: String(item.placardScore)");
  });
});
