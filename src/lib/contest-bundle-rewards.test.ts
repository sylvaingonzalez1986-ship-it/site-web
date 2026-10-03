import { describe, expect, it } from "vitest";
import { getContestBundleCartProgress } from "@/lib/contest-bundle-rewards";

const flowers = [{ productId: "a", title: "Fleur A", unitWeightGrams: 1 }, { productId: "b", title: "Fleur B", unitWeightGrams: 2.5 }];

describe("contest flower bundle preview", () => {
  it("requires 3 grams of EVERY flower, not 3 grams altogether", () => {
    const result = getContestBundleCartProgress(flowers, [{ id: "a", quantity: 3 }, { id: "b", quantity: 1 }]);
    expect(result.eligible).toBe(false);
    expect(result.completedCount).toBe(1);
    expect(result.flowers[1]).toMatchObject({ grams: 2.5, missingGrams: 0.5 });
  });
  it("includes the exact 3 gram boundary and sums duplicate lines", () => {
    const result = getContestBundleCartProgress(flowers, [{ id: "a", quantity: 1 }, { id: "a", quantity: 2 }, { id: "b", quantity: 2 }]);
    expect(result.eligible).toBe(true);
    expect(result.completedCount).toBe(2);
    expect(result.flowers.every((flower) => flower.missingGrams === 0)).toBe(true);
  });
  it("deduplicates contest entries, ignores unrelated items and never awards an empty catalogue", () => {
    expect(getContestBundleCartProgress([], [{ id: "a", quantity: 99 }]).eligible).toBe(false);
    const result = getContestBundleCartProgress([...flowers, flowers[0]], [{ id: "a", quantity: 3 }, { id: "b", quantity: 2 }, { id: "regular", quantity: 99 }]);
    expect(result.requiredCount).toBe(2);
    expect(result.eligible).toBe(true);
  });
  it("counts flower components bought in a pack alongside individual flowers", () => {
    const result = getContestBundleCartProgress(flowers, [{ id: "discovery-pack", isPack: true, packProductIds: ["a", "b"], price: 12, quantity: 2 }, { id: "a", quantity: 1 }]);
    expect(result.eligible).toBe(true);
    expect(result.flowers.map((flower) => flower.grams)).toEqual([3, 5]);
  });
  it("does not interpret variant suffixes as weights or count free/invalid lines", () => {
    const result = getContestBundleCartProgress(flowers, [
      { id: "a::3g", quantity: 99 }, { id: "a", quantity: 3, price: 0 },
      { id: "a", quantity: -2 }, { id: "a", quantity: 2.5 }, { id: "a", quantity: Infinity },
      { id: "b", quantity: 2, price: NaN },
    ]);
    expect(result.flowers.map((flower) => flower.grams)).toEqual([0, 0]);
    expect(result.eligible).toBe(false);
  });
  it("uses authoritative catalogue weights with integer decimal arithmetic", () => {
    const result = getContestBundleCartProgress([{ productId: "a", title: "Fleur", unitWeightGrams: .1 }], [{ id: "a", quantity: 30 }]);
    expect(result.flowers[0].grams).toBe(3);
    expect(result.eligible).toBe(true);
  });
  it("rejects 2.9 grams and keeps the remaining tenth exact", () => {
    const result = getContestBundleCartProgress([{ productId: "a", title: "Fleur", unitWeightGrams: .1 }], [{ id: "a", quantity: 29 }]);
    expect(result.flowers[0]).toMatchObject({ grams: 2.9, missingGrams: .1, complete: false });
    expect(result.eligible).toBe(false);
  });
  it("adds past purchases to the current basket separately for each flower", () => {
    const result = getContestBundleCartProgress(flowers, [{ id: "a", quantity: 1 }], [
      { productId: "a", purchasedGrams: 2, complete: false },
      { productId: "b", purchasedGrams: 5, complete: true },
    ]);
    expect(result.eligible).toBe(true);
    expect(result.flowers[0]).toMatchObject({ purchasedGrams: 2, cartGrams: 1, grams: 3, missingGrams: 0 });
    expect(result.flowers[1]).toMatchObject({ purchasedGrams: 5, cartGrams: 0, grams: 5 });
  });
  it("retains already completed flowers when the basket is empty", () => {
    const result = getContestBundleCartProgress(flowers, [], [
      { productId: "a", purchasedGrams: 3, complete: true },
      { productId: "b", purchasedGrams: 2.9, complete: false },
    ]);
    expect(result.completedCount).toBe(1);
    expect(result.eligible).toBe(false);
    expect(result.flowers[1]).toMatchObject({ cartGrams: 0, missingGrams: .1 });
  });
  it("uses grams, not a supplied completion flag, and ignores invalid or unrelated history", () => {
    const result = getContestBundleCartProgress(flowers, [], [
      { productId: "a", purchasedGrams: 2, complete: true },
      { productId: "b", purchasedGrams: Infinity, complete: true },
      { productId: "unrelated", purchasedGrams: 99, complete: true },
    ]);
    expect(result.completedCount).toBe(0);
    expect(result.flowers.map((flower) => flower.grams)).toEqual([2, 0]);
  });
});
