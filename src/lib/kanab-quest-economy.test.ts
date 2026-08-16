import { describe, expect, it } from "vitest";
import { buildKqCollectionDeck, buildKqRecommendedDeck, getKqCardChallengeFit, getKqDeckCoverage, getKqOpeningHandChance, sanitizeKqDeckSelection, summarizeKqCardEconomy } from "@/lib/kanab-quest-economy";
import { KQ_CARDS } from "@/lib/kanab-quest-game";

describe("Kanab Quest card economy", () => {
  it("explains the opening-hand tradeoff of a larger deck", () => {
    expect(getKqOpeningHandChance(10, 1)).toBe(50);
    expect(getKqOpeningHandChance(20, 1)).toBe(25);
    expect(getKqOpeningHandChance(20, 2)).toBe(45);
    expect(getKqOpeningHandChance(0, 0)).toBe(0);
  });

  it("summarizes situational coverage and counts physical copies", () => {
    expect(getKqDeckCoverage(["BOTTE-003", "BOTTE-003", "BOTTE-004", "BOTTE-017"])).toEqual({
      roots: 0,
      water: 0,
      climate: 2,
      pest: 1,
      flower: 0,
      drying: 2,
      versatile: 1,
    });
  });

  it("builds quick decks from the exact available collection", () => {
    const inventory = { "BOTTE-003": 2, "BOTTE-004": 1, "BOTTE-002": 4, "BOTTE-001": 3 };
    expect(buildKqCollectionDeck(inventory, "one-each")).toEqual(["BOTTE-003", "BOTTE-004"]);
    expect(buildKqCollectionDeck(inventory, "all-copies")).toEqual(["BOTTE-003", "BOTTE-003", "BOTTE-004"]);
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

  it("builds a four-card recommendation without exhausted copies", () => {
    const inventory = Object.fromEntries(Array.from({ length: 18 }, (_, index) => [`BOTTE-${String(index + 1).padStart(3, "0")}`, 1]));
    inventory["BOTTE-006"] = 0;
    const deck = buildKqRecommendedDeck("starting-xp-1", inventory);
    expect(deck.support).toHaveLength(4);
    expect(deck.support).not.toContain("BOTTE-006");
    expect(deck.substrate).toBe("BOTTE-001");
  });

  it("marks only cards whose effect directly supports a daily objective", () => {
    const loupe = KQ_CARDS.find((card) => card.code === "BOTTE-004")!;
    const ventilateur = KQ_CARDS.find((card) => card.code === "BOTTE-003")!;
    expect(getKqCardChallengeFit(loupe, ["biocontrol"])).toBe(true);
    expect(getKqCardChallengeFit(ventilateur, ["biocontrol"])).toBe(false);
    expect(getKqCardChallengeFit(ventilateur, ["no-failure"])).toBe(true);
  });

  it("puts daily challenge support ahead of the Buddie fallback", () => {
    const inventory = Object.fromEntries(KQ_CARDS.map((card) => [card.code, 1]));
    const deck = buildKqRecommendedDeck("starting-xp-1", inventory, ["biocontrol"]);
    expect(deck.support).toContain("BOTTE-004");
    expect(deck.support).toHaveLength(4);
  });
});
