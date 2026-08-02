import { describe, expect, it } from "vitest";
import { calculateArenaScore } from "@/lib/arena-ranking";

describe("calculateArenaScore", () => {
  it("requires at least one finalized Placard battle", () => {
    expect(calculateArenaScore({ notebookSeasonPoints: 300, placardSeasonPoints: 200, placardRating: 1200, placardBattles: 0 }))
      .toEqual({ total: 0, notebook: 300, placard: 475, eligible: false });
  });

  it("caps the two contributions at 300 and 700", () => {
    expect(calculateArenaScore({ notebookSeasonPoints: 9999, placardSeasonPoints: 9999, placardRating: 9999, placardBattles: 20 }))
      .toEqual({ total: 1000, notebook: 300, placard: 700, eligible: true });
  });

  it("sanitizes negative and invalid values", () => {
    expect(calculateArenaScore({ notebookSeasonPoints: -5, placardSeasonPoints: Number.NaN, placardRating: Number.NaN, placardBattles: 1 }))
      .toEqual({ total: 25, notebook: 0, placard: 25, eligible: true });
  });
});
