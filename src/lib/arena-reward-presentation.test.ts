import { describe, expect, it } from "vitest";
import { getArenaRewardJarFill, getArenaRewardMilestone, isArenaRewardSeasonOpen } from "./arena-reward-presentation";

describe("Arena reward presentation", () => {
  it("never empties the jar when sales cross a milestone", () => {
    for (const grams of [25, 50, 100, 200, 500, 1000, 2000]) {
      expect(getArenaRewardJarFill(grams)).toBeGreaterThanOrEqual(getArenaRewardJarFill(grams - 0.1));
      expect(getArenaRewardJarFill(grams + 0.1)).toBeGreaterThanOrEqual(getArenaRewardJarFill(grams));
    }
    expect(getArenaRewardJarFill(0)).toBe(0);
    expect(getArenaRewardJarFill(5000)).toBe(100);
  });
  it("continues milestones without skipping a kilogram", () => {
    expect(getArenaRewardMilestone(1001)).toEqual({ previousGrams: 1000, nextGrams: 2000, progressPercent: 0 });
    expect(getArenaRewardMilestone(2500)).toEqual({ previousGrams: 2000, nextGrams: 3000, progressPercent: 50 });
  });
  it("closes rolling at the deadline even before admin settlement", () => {
    const pool = { status: "active", startsAt: "2026-09-01T00:00:00Z", endsAt: "2026-10-01T00:00:00Z" };
    expect(isArenaRewardSeasonOpen(pool, Date.parse("2026-09-12"))).toBe(true);
    expect(isArenaRewardSeasonOpen(pool, Date.parse(pool.endsAt))).toBe(false);
    expect(isArenaRewardSeasonOpen(pool, Date.parse("2026-08-01"))).toBe(false);
    expect(isArenaRewardSeasonOpen({ ...pool, status: "settled" }, Date.parse("2026-09-12"))).toBe(false);
  });
});
