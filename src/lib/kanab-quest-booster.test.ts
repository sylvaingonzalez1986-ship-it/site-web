import { describe, expect, it } from "vitest";
import { addKqBoosterToInventory, applyKqArenaStreakReward, drawKqSupportCard, KQ_SUPPORT_BOOSTER_POINTS_COST, KQ_SUPPORT_RARITY_WEIGHTS, openKqSupportBooster, pickKqSupportRarity } from "@/lib/kanab-quest-booster";
import { KQ_ACTIVE_CARDS } from "@/lib/kanab-quest-game";
import { createKqRankProfile } from "@/lib/kanab-quest-ranking";

describe("Botte du Chanvrier boosters", () => {
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
    const epicRate = randomSlots.filter((card) => card.rarity === "epic").length / randomSlots.length;
    expect(rareRate).toBeGreaterThan(0.04);
    expect(rareRate).toBeLessThan(0.08);
    expect(uncommonRate).toBeGreaterThan(0.2);
    expect(uncommonRate).toBeLessThan(0.28);
    expect(epicRate).toBeGreaterThan(0.005);
    expect(epicRate).toBeLessThan(0.015);
  });

  it("gives random slots and standalone rewards exactly the same rarity law", () => {
    const counts = { common: 0, uncommon: 0, rare: 0, epic: 0 };
    for (let roll = 0; roll < 100; roll++) counts[pickKqSupportRarity((roll + 0.5) / 100)]++;
    expect(counts).toEqual(KQ_SUPPORT_RARITY_WEIGHTS);
    expect(pickKqSupportRarity(0.7)).toBe("uncommon");
    expect(pickKqSupportRarity(0.93)).toBe("rare");
    expect(pickKqSupportRarity(0.99)).toBe("epic");
    expect(() => pickKqSupportRarity(1)).toThrow();
    expect(() => pickKqSupportRarity(Number.NaN)).toThrow();
    const rewards = Array.from({ length: 10000 }, (_, seed) => drawKqSupportCard(seed));
    expect(rewards.filter(card => card.rarity === "epic").length).toBeGreaterThan(60);
    expect(rewards.filter(card => card.rarity === "epic").length).toBeLessThan(140);
    expect(rewards.every(card => KQ_ACTIVE_CARDS.includes(card) && card.category !== "pbi")).toBe(true);
    expect(rewards.some(card => ["BOTTE-004", "BOTTE-025"].includes(card.code))).toBe(false);
    expect(new Set(rewards.map(card => card.code))).toEqual(new Set(KQ_ACTIVE_CARDS.map(card => card.code)));
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
