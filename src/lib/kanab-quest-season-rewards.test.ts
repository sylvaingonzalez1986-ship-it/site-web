import { describe, expect, it } from "vitest";
import {
  buildKqSeasonRewardPreview,
  getKqSeasonDisplayCode,
  getKqSeasonRewardTier,
  KQ_SEASON_REWARDS_LIVE,
} from "@/lib/kanab-quest-season-rewards";

const standing = (rank: number, battles = 3) => ({
  playerId: `player-${rank}`,
  rank,
  seasonPoints: 100 - rank,
  rating: 1100,
  wins: battles,
  losses: 0,
});

describe("Kanab Quest dormant season rewards", () => {
  it("keeps every season grant disabled before coordinated launch", () => {
    expect(KQ_SEASON_REWARDS_LIVE).toBe(false);
  });

  it("maps champion, podium, top 10 and participation tiers", () => {
    expect(getKqSeasonRewardTier(standing(1))?.code).toBe("champion");
    expect(getKqSeasonRewardTier(standing(3))?.code).toBe("podium");
    expect(getKqSeasonRewardTier(standing(10))?.code).toBe("finalist");
    expect(getKqSeasonRewardTier(standing(11))?.code).toBe("participant");
  });

  it("requires three completed battles to prevent passive farming", () => {
    expect(getKqSeasonRewardTier(standing(1, 2))).toBeNull();
  });

  it("builds stable idempotency keys and ignores duplicate players", () => {
    const preview = buildKqSeasonRewardPreview("KQ-2026-S1", [
      standing(1),
      standing(2),
      { ...standing(2), rank: 9 },
    ]);
    expect(preview.rewardsLive).toBe(false);
    expect(preview.eligiblePlayers).toBe(2);
    expect(preview.grants[0].grantKey).toBe("KQ-2026-S1:player-1:champion");
    expect(new Set(preview.grants.map((grant) => grant.grantKey)).size).toBe(preview.grants.length);
  });

  it("keeps power rewards modest and favors cosmetic recognition", () => {
    const champion = getKqSeasonRewardTier(standing(1))!;
    expect(champion.title).toBeTruthy();
    expect(champion.frame).toBe("or");
    expect(champion.supportBoosters).toBeLessThanOrEqual(3);
    expect(champion.heritageFragments).toBe(12);
  });

  it("labels cosmetic ribbons with the active season instead of S1", () => {
    const preview = buildKqSeasonRewardPreview("KQ-2027-S2", [standing(1), standing(11)]);
    expect(getKqSeasonDisplayCode("KQ-2027-S2")).toBe("S2");
    expect(preview.grants[0].tier.ribbon).toBe("Champion de saison S2");
    expect(preview.grants[1].tier.ribbon).toBe("Saison S2 complète");
  });
});
