import { describe, expect, it } from "vitest";
import { addKqBoosterToInventory, applyKqArenaStreakReward, KQ_SUPPORT_BOOSTER_POINTS_COST, openKqSupportBooster } from "@/lib/kanab-quest-booster";
import { createKqRankProfile } from "@/lib/kanab-quest-ranking";

describe("La Botte du Chanvrier boosters", () => {
  it("costs five loyalty points in the Arena shop", () => {
    expect(KQ_SUPPORT_BOOSTER_POINTS_COST).toBe(5);
  });

  it("draws ten deterministic playable cards with a guaranteed common", () => {
    const first = openKqSupportBooster(2026);
    expect(first).toEqual(openKqSupportBooster(2026));
    expect(first).toHaveLength(10);
    expect(first[0].rarity).toBe("common");
  });

  it("turns duplicates into additional burnable copies", () => {
    const cards = openKqSupportBooster(7);
    const inventory = addKqBoosterToInventory({}, cards);
    expect(Object.values(inventory).reduce((sum, count) => sum + count, 0)).toBe(10);
  });

  it("keeps rare cards scarce over a large deterministic sample", () => {
    const randomSlots = Array.from({ length: 1000 }, (_, seed) => openKqSupportBooster(seed).slice(1)).flat();
    const rareRate = randomSlots.filter((card) => card.rarity === "rare").length / randomSlots.length;
    const uncommonRate = randomSlots.filter((card) => card.rarity === "uncommon").length / randomSlots.length;
    expect(rareRate).toBeGreaterThan(0.04);
    expect(rareRate).toBeLessThan(0.08);
    expect(uncommonRate).toBeGreaterThan(0.2);
    expect(uncommonRate).toBeLessThan(0.28);
  });

  it("awards one idempotent booster every third consecutive win", () => {
    const profile = { ...createKqRankProfile(), wins: 3, streak: 3 };
    const once = applyKqArenaStreakReward(profile, {}, 42);
    const twice = applyKqArenaStreakReward(once.profile, once.inventory, 42);
    expect(once.cards).toHaveLength(10);
    expect(Object.values(once.inventory).reduce((sum, count) => sum + count, 0)).toBe(10);
    expect(twice.cards).toHaveLength(0);
    expect(twice.inventory).toEqual(once.inventory);
  });

});
