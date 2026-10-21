import { describe, expect, it } from "vitest";
import { buildKqCollectionDeck, buildKqRecommendedDeck, getKqCardChallengeFit, getKqDeckCoverage, getKqOpeningHandChance, sanitizeKqDeckSelection, summarizeKqCardEconomy } from "@/lib/kanab-quest-economy";
import { KQ_ACTIVE_CARDS, KQ_CARDS, KQ_SITUATIONS, doesKqCardMatchSituation } from "@/lib/kanab-quest-game";

describe("Kanab Quest card economy", () => {
  it("explains the opening-hand tradeoff of a larger deck", () => {
    expect(getKqOpeningHandChance(10, 1)).toBe(100);
    expect(getKqOpeningHandChance(20, 1)).toBe(50);
    expect(getKqOpeningHandChance(20, 2)).toBe(76);
    expect(getKqOpeningHandChance(20, 2, 5)).toBe(45);
    expect(getKqOpeningHandChance(0, 0)).toBe(0);
  });

  it("summarizes situational coverage and counts physical copies", () => {
    expect(getKqDeckCoverage(["BOTTE-003", "BOTTE-003", "BOTTE-004", "BOTTE-017"])).toEqual({
      roots: 0,
      water: 0,
      climate: 2,
      pest: 0,
      flower: 0,
      drying: 2,
      versatile: 1,
    });
  });

  it("builds quick decks from the exact available collection", () => {
    const inventory = { "BOTTE-003": 2, "BOTTE-004": 1, "BOTTE-002": 4, "BOTTE-001": 3 };
    expect(buildKqCollectionDeck(inventory, "one-each")).toEqual(["BOTTE-003"]);
    expect(buildKqCollectionDeck(inventory, "all-copies")).toEqual(["BOTTE-003", "BOTTE-003"]);
  });

  it("separates burned copies from unused deck cards", () => {
    const summary = summarizeKqCardEconomy({
      deckCodes: ["BOTTE-001", "BOTTE-003", "BOTTE-004", "BOTTE-006"],
      usedCards: ["BOTTE-001", "BOTTE-004"],
    });
    expect(summary.burnedCodes).toEqual(["BOTTE-001", "BOTTE-004"]);
    expect(summary.preservedCodes).toEqual(["BOTTE-003", "BOTTE-006"]);
    expect(summary.categoryBurns.substrate).toBe(1);
    expect(summary.categoryBurns.equipment).toBe(1);
  });

  it("counts every burned physical copy and preserves unused duplicates", () => {
    const summary = summarizeKqCardEconomy({ deckCodes: ["BOTTE-001", "BOTTE-003", "BOTTE-003"], usedCards: ["BOTTE-001", "BOTTE-003"] });
    expect(summary.totalBurned).toBe(2);
    expect(summary.preservedCodes).toEqual(["BOTTE-003"]);
  });

  it("removes exhausted cards before rebuilding a deck", () => {
    expect(sanitizeKqDeckSelection(["BOTTE-003", "BOTTE-004", "BOTTE-006"], { "BOTTE-003": 1, "BOTTE-004": 0 })).toEqual(["BOTTE-003"]);
  });

  it("keeps at most as many deck copies as the collection owns", () => {
    expect(sanitizeKqDeckSelection(["BOTTE-003", "BOTTE-003", "BOTTE-003"], { "BOTTE-003": 2 })).toEqual(["BOTTE-003", "BOTTE-003"]);
  });

  it("builds a ten-card recommendation without exhausted copies", () => {
    const inventory = Object.fromEntries(KQ_ACTIVE_CARDS.map(card => [card.code, 1]));
    inventory["BOTTE-006"] = 0;
    const deck = buildKqRecommendedDeck("starting-xp-1", inventory);
    expect(deck.support).toHaveLength(10);
    expect(deck.support).not.toContain("BOTTE-006");
    expect(deck).not.toHaveProperty("substrate");
  });

  it("marks only cards whose effect directly supports a daily objective", () => {
    const loupe = KQ_CARDS.find((card) => card.code === "BOTTE-004")!;
    const ventilateur = KQ_CARDS.find((card) => card.code === "BOTTE-003")!;
    expect(getKqCardChallengeFit(loupe, ["biocontrol"])).toBe(false);
    expect(getKqCardChallengeFit(ventilateur, ["biocontrol"])).toBe(false);
    expect(getKqCardChallengeFit(ventilateur, ["no-failure"])).toBe(true);
  });

  it("does not recommend obsolete observation cards for biological control", () => {
    const inventory = Object.fromEntries(KQ_CARDS.map((card) => [card.code, 1]));
    const deck = buildKqRecommendedDeck("starting-xp-1", inventory, ["biocontrol"]);
    expect(deck.support).not.toContain("BOTTE-004");
    expect(deck.support).not.toContain("BOTTE-025");
    expect(deck.support).toHaveLength(10);
  });

  it("fills a recommended hand from owned copies and never adds a second epic", () => {
    const inventory = { "BOTTE-005": 4, "BOTTE-006": 4, "BOTTE-017": 4, "BOTTE-018": 4 };
    for (const buddieCode of [undefined, "HH2026-020"]) {
      const { support } = buildKqRecommendedDeck("none", inventory, [], buddieCode);
      expect(support).toHaveLength(10);
      for (const code of new Set(support)) expect(support.filter(item => item === code).length).toBeLessThanOrEqual(inventory[code as keyof typeof inventory]);
      expect(buildKqRecommendedDeck("none", { "BOTTE-005": 2 }, [], buddieCode).support).toEqual(["BOTTE-005", "BOTTE-005"]);
      expect(buildKqRecommendedDeck("none", {}, [], buddieCode).support).toEqual([]);
      const epic = KQ_ACTIVE_CARDS.find(card => card.rarity === "epic")!;
      expect(buildKqRecommendedDeck("none", { [epic.code]: 12 }, [], buddieCode).support).toEqual([epic.code]);
    }
  });

  it("prefers actual incident coverage over broad but misleading card tags", () => {
    // These cost one XP and are both preparations. Humidity supports eleven
    // exact situations; the shade veil supports three, despite broad tags.
    const inventory = { "BOTTE-013": 5, "BOTTE-038": 5 };
    const { support } = buildKqRecommendedDeck("none", inventory, [], "HH2026-020", { startingXp: 1 });
    expect(support[0]).toBe("BOTTE-038");
    expect(support).toHaveLength(10);
    expect(inventory).toEqual({ "BOTTE-013": 5, "BOTTE-038": 5 });
  });

  it("uses the actual starting XP to favor affordable alternatives without discarding later options", () => {
    const inventory = Object.fromEntries(KQ_ACTIVE_CARDS.map(card => [card.code, 2]));
    const low = buildKqRecommendedDeck("none", inventory, [], "HH2026-020", { startingXp: 1 }).support;
    const rich = buildKqRecommendedDeck("none", inventory, [], "HH2026-020", { startingXp: 5 }).support;
    const cheapCount = (codes: string[]) => codes.filter(code => KQ_ACTIVE_CARDS.find(card => card.code === code)!.xpCost <= 1).length;
    expect(low).not.toEqual(rich);
    expect(cheapCount(low)).toBeGreaterThan(cheapCount(rich));
    expect(low.some(code => KQ_ACTIVE_CARDS.find(card => card.code === code)!.xpCost > 1)).toBe(true);
    for (const deck of [low, rich]) {
      const cards = deck.map(code => KQ_ACTIVE_CARDS.find(card => card.code === code)!);
      expect(deck).toHaveLength(10);
      expect(new Set(cards.map(card => card.timing)).size).toBe(2);
      expect(cards.filter(card => card.rarity === "epic").length).toBeLessThanOrEqual(1);
      expect(KQ_SITUATIONS.filter(situation => cards.some(card => doesKqCardMatchSituation(card, situation))).length).toBeGreaterThanOrEqual(40);
    }
  });

  it("does not invent a budget from the leader when the official bonuses are unknown", () => {
    const inventory = Object.fromEntries(KQ_ACTIVE_CARDS.map(card => [card.code, 1]));
    expect(buildKqRecommendedDeck("none", inventory, [], "HH2026-020", { startingXp: null }))
      .toEqual(buildKqRecommendedDeck("starting-xp-4", inventory, [], undefined, { startingXp: null }));
    expect(buildKqRecommendedDeck("none", { "BOTTE-005": .5 }, [], undefined, { startingXp: 1 }).support).toEqual([]);
    for (const copies of [Infinity, NaN, 1.5, -1, Number.MAX_SAFE_INTEGER + 1]) {
      expect(buildKqRecommendedDeck("none", { "BOTTE-005": copies }, [], undefined, { startingXp: 1 }).support).toEqual([]);
    }
  });
});
