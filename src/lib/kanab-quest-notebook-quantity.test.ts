import { describe, expect, it } from "vitest";
import { getKqNotebookBuddieOdds, getKqNotebookQuantityReward } from "@/lib/kanab-quest-notebook-quantity";

describe("notebook quantity incentives", () => {
  it.each([
    [0, 0, 0], [1, 10_000, 0], [2, 20_000, 10_000], [2.9, 29_000, 19_000],
    [3, 33_000, 23_000], [4, 44_000, 34_000], [4.9, 53_900, 43_900],
    [5, 60_000, 50_000], [9, 108_000, 98_000], [9.9, 118_800, 108_800],
    [10, 130_000, 120_000], [50, 130_000, 120_000],
  ])("quotes %sg with %s total cents and %s supplemental cents", (grams, totalCashCents, bonusCashCents) => {
    expect(getKqNotebookQuantityReward(grams)).toEqual({ grams: Math.min(grams, 10), totalCashCents, bonusCashCents });
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1])("does not promise money for invalid grams %s", (grams) => {
    expect(getKqNotebookQuantityReward(grams)).toEqual({ grams: 0, totalCashCents: 0, bonusCashCents: 0 });
  });

  it("makes grouping more rewarding than spreading the same grams between flowers", () => {
    expect(getKqNotebookQuantityReward(5).totalCashCents).toBeGreaterThan(5 * getKqNotebookQuantityReward(1).totalCashCents);
    expect(getKqNotebookQuantityReward(10).totalCashCents).toBeGreaterThan(2 * getKqNotebookQuantityReward(5).totalCashCents);
  });

  it.each([
    [1, 1, 3], [2.9, 1, 3], [3, 1.25, 3.75], [4.9, 1.25, 3.75],
    [5, 1.5, 4.5], [9.9, 1.5, 4.5], [10, 2, 6], [50, 2, 6],
  ])("keeps exact rarity probabilities for %sg", (grams, regularGold, concoursGold) => {
    expect(getKqNotebookBuddieOdds("regular", grams)).toEqual({ common: 90 - regularGold, silver: 10, gold: regularGold });
    expect(getKqNotebookBuddieOdds("concours", grams)).toEqual({ common: 82 - concoursGold, silver: 18, gold: concoursGold });
  });
});
