import { describe, expect, it } from "vitest";
import { calculateArenaScore } from "@/lib/arena-ranking";

describe("calculateArenaScore", () => {
  it("requires at least one finalized Placard battle", () => {
    expect(calculateArenaScore({ notebookSeasonPoints: 300, placardSeasonPoints: 200, placardRating: 1200, placardBattles: 0 }))
      .toEqual({ total: 0, notebook: 300, placard: 475, business: 0, eligible: false });
  });

  it("caps the three contributions at 300, 500 and 200", () => {
    expect(calculateArenaScore({ notebookSeasonPoints: 9999, placardSeasonPoints: 9999, placardRating: 9999, placardBattles: 20, businessScore: 9999 }))
      .toEqual({ total: 1000, notebook: 300, placard: 500, business: 200, eligible: true });
  });

  it("rewards company development independently of duel activity while preserving eligibility", () => {
    const input = { notebookSeasonPoints: 100, placardSeasonPoints: 20, placardRating: 1100, placardBattles: 1 };
    expect(calculateArenaScore({ ...input, businessScore: 120 }))
      .toEqual({ total: 310, notebook: 100, placard: 90, business: 120, eligible: true });
    expect(calculateArenaScore({ ...input, businessScore: 200, placardBattles: 0 }).total).toBe(0);
  });

  it("sanitizes negative and invalid values", () => {
    expect(calculateArenaScore({ notebookSeasonPoints: -5, placardSeasonPoints: Number.NaN, placardRating: Number.NaN, placardBattles: 1 }))
      .toEqual({ total: 25, notebook: 0, placard: 25, business: 0, eligible: true });
    for (const businessScore of [-10, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(calculateArenaScore({ notebookSeasonPoints: 0, placardSeasonPoints: 0, placardRating: 1000, placardBattles: 1, businessScore }).business).toBe(0);
    }
  });
});
