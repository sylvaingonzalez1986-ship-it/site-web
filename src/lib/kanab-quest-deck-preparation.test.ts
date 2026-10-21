import { describe, expect, it } from "vitest";
import { getKqDeckPreparation, getKqPreparationStartingXp, type KqPreparationStartingXpInput } from "./kanab-quest-deck-preparation";
import { KQ_HERITAGE_CARDS, type KqHeritageCard } from "./kanab-quest-heritage";
import { startKqGame } from "./kanab-quest-game";

const common = "HH2026-020";
const silver = "HH2026-010";
const gold = "HH2026-005";
const legendary = "HH2026-001";
const heritage = (code: string) => KQ_HERITAGE_CARDS.find(card => card.code === code)!;
const official = (overrides: Partial<KqPreparationStartingXpInput> = {}): KqPreparationStartingXpInput => ({
  source: "official", buddieCodes: [common], heritageCard: null, chanvrierStrength: null, ...overrides,
});

describe("deck preparation without predicting the campaign", () => {
  it("keeps an empty deck distinct from missing stock or missing XP", () => {
    const known = getKqDeckPreparation({ deckCodes: [], inventory: {}, startingXp: 1 });
    expect(known).toMatchObject({ copies: 0, references: 0, availableCopies: 0, missingCopies: 0,
      handCapacity: 10, openingHandSize: 0, beforeRollCopies: 0, afterRollCopies: 0,
      affordableCopies: 0, expensiveCopies: 0, coverage: { compatibleCount: 0, total: 50 } });
    expect(known.coverage.uncoveredCodes).toHaveLength(50);
    expect(getKqDeckPreparation({ deckCodes: [], inventory: null, startingXp: null })).toMatchObject({
      copies: 0, availableCopies: null, missingCopies: null, affordableCopies: null, expensiveCopies: null,
    });
  });

  it("counts physical copies and timing separately from references and the ten-card hand", () => {
    const deckCodes = [...Array<string>(8).fill("BOTTE-005"), ...Array<string>(4).fill("BOTTE-006")];
    const result = getKqDeckPreparation({ deckCodes, inventory: { "BOTTE-005": 8, "BOTTE-006": 4 }, startingXp: 1 });
    expect(result).toMatchObject({ copies: 12, references: 2, availableCopies: 12, missingCopies: 0,
      openingHandSize: 10, beforeRollCopies: 8, afterRollCopies: 4, affordableCopies: 8, expensiveCopies: 4 });
    expect(result.coverage).toMatchObject({ compatibleCount: 50, uncoveredCodes: [] });
    expect(result).not.toHaveProperty("chance");
    expect(result).not.toHaveProperty("playableCopies");
    expect(result).not.toHaveProperty("openingHandCodes");
  });

  it("retains the selection when stock is unknown instead of inventing shortages", () => {
    const result = getKqDeckPreparation({ deckCodes: ["BOTTE-005", "BOTTE-005", "BOTTE-013"], inventory: null, startingXp: 1 });
    expect(result).toMatchObject({ copies: 3, references: 2, openingHandSize: 3, availableCopies: null,
      missingCopies: null, affordableCopies: 3, expensiveCopies: 0, coverage: { compatibleCount: 8 } });
  });

  it("excludes missing stock from compatibility and affordable costs while retaining selected copy counts", () => {
    const result = getKqDeckPreparation({ deckCodes: ["BOTTE-005", "BOTTE-005", "BOTTE-017"], inventory: { "BOTTE-005": 1 }, startingXp: 2 });
    expect(result).toMatchObject({ copies: 3, references: 2, openingHandSize: 3, beforeRollCopies: 3,
      availableCopies: 1, missingCopies: 2, affordableCopies: 1, expensiveCopies: 0, coverage: { compatibleCount: 5 } });
    // The unavailable universal card must not claim coverage of every incident.
    expect(result.coverage.uncoveredCodes).toContain("SIT-024");
  });

  it.each([NaN, Infinity, -1, 0, 0.5, 2.5])("does not credit invalid or empty stock (%s) with coverage", stock => {
    const result = getKqDeckPreparation({ deckCodes: ["BOTTE-017"], inventory: { "BOTTE-017": stock }, startingXp: 10 });
    expect(result).toMatchObject({ copies: 1, availableCopies: 0, missingCopies: 1,
      affordableCopies: 0, expensiveCopies: 0, coverage: { compatibleCount: 0 } });
  });

  it("ignores inactive observation, PBI, retired substrates and unknown codes", () => {
    const result = getKqDeckPreparation({ deckCodes: ["BOTTE-001", "BOTTE-002", "BOTTE-004", "BOTTE-025", "UNKNOWN", "BOTTE-005"], inventory: null, startingXp: 1 });
    expect(result).toMatchObject({ copies: 1, references: 1, beforeRollCopies: 1, afterRollCopies: 0,
      affordableCopies: 1, coverage: { compatibleCount: 5 } });
  });

  it("uses actual incident compatibility instead of broad card tags", () => {
    const water = getKqDeckPreparation({ deckCodes: ["BOTTE-005"], inventory: null, startingXp: 1 });
    expect(water.coverage.compatibleCount).toBe(5);
    expect(water.coverage.uncoveredCodes).toContain("SIT-017");
    expect(water.coverage.byStage.map(stage => stage.compatibleCount)).toEqual([2, 3, 0, 0, 0, 0]);
    const shade = getKqDeckPreparation({ deckCodes: ["BOTTE-013"], inventory: null, startingXp: 1 });
    expect(shade.coverage.compatibleCount).toBe(3);
    expect(shade.coverage.uncoveredCodes).toContain("SIT-039");
    const paperwork = getKqDeckPreparation({ deckCodes: ["BOTTE-027"], inventory: null, startingXp: 3 });
    expect(paperwork.coverage.compatibleCount).toBe(1);
    expect(paperwork.coverage.uncoveredCodes).toContain("SIT-048");
    expect(paperwork.coverage.uncoveredCodes).not.toContain("SIT-024");
  });

  it("deduplicates compatible incidents without presenting copies or broad compatibility as guaranteed successive answers", () => {
    const single = getKqDeckPreparation({ deckCodes: ["BOTTE-005"], inventory: null, startingXp: 1 });
    const repeated = getKqDeckPreparation({ deckCodes: ["BOTTE-005", "BOTTE-005"], inventory: null, startingXp: 1 });
    expect(repeated.coverage).toEqual(single.coverage);
    expect(repeated.affordableCopies).toBe(2);
    const universal = getKqDeckPreparation({ deckCodes: ["BOTTE-017"], inventory: null, startingXp: 1 });
    expect(universal).toMatchObject({ copies: 1, affordableCopies: 0, expensiveCopies: 1, coverage: { compatibleCount: 50 } });
    expect(universal.coverage.byStage.map(stage => stage.total)).toEqual([8, 9, 8, 9, 8, 8]);
    expect(universal.coverage.byStage.map(stage => stage.stage)).toEqual(["Germination", "Enracinement", "Croissance", "Floraison", "Récolte", "Séchage & affinage"]);
  });

  it.each([null, NaN, Infinity, -1, 1.5])("keeps invalid or missing XP (%s) unknown without changing catalogue compatibility", startingXp => {
    const result = getKqDeckPreparation({ deckCodes: ["BOTTE-005"], inventory: { "BOTTE-005": 1 }, startingXp });
    expect(result).toMatchObject({ availableCopies: 1, affordableCopies: null, expensiveCopies: null, coverage: { compatibleCount: 5 } });
  });

  it("treats zero XP as a real budget and does not mutate the selected deck or stock", () => {
    const deckCodes = Object.freeze(["BOTTE-006", "BOTTE-005", "BOTTE-005"]);
    const inventory = Object.freeze({ "BOTTE-006": 1, "BOTTE-005": 2 });
    const result = getKqDeckPreparation({ deckCodes, inventory, startingXp: 0 });
    expect(result).toMatchObject({ affordableCopies: 0, expensiveCopies: 3 });
    expect(deckCodes).toEqual(["BOTTE-006", "BOTTE-005", "BOTTE-005"]);
    expect(inventory).toEqual({ "BOTTE-006": 1, "BOTTE-005": 2 });
  });
});

describe("starting XP from the actual launch source", () => {
  it.each([
    { buddie: common, strength: null, tokens: 0, heritage: null, base: 1, expected: 1 },
    { buddie: silver, strength: "green-thumb", tokens: 2, heritage: heritage("HERITAGE-001"), base: 5, expected: 8 },
    { buddie: gold, strength: "merchant", tokens: 1, heritage: heritage("HERITAGE-002"), base: 2, expected: 8 },
    { buddie: legendary, strength: "green-thumb", tokens: 0, heritage: heritage("HERITAGE-008"), base: 3, expected: 9 },
  ] as const)("matches the official solo engine for $buddie / $strength", entry => {
    const xp = getKqPreparationStartingXp(official({ buddieCodes: [entry.buddie], chanvrierStrength: entry.strength,
      cultureTokens: entry.tokens, heritageCard: entry.heritage }));
    expect(xp).toBe(entry.expected);
    expect(startKqGame(18, { varietyCode: entry.buddie, startingXp: entry.base,
      ...(entry.heritage ? { heritageCard: entry.heritage } : {}) }).xp).toBe(xp);
  });

  it("uses the strongest campaign member once regardless of leader or participant order", () => {
    const base = official({ buddieCodes: [common, gold, legendary], chanvrierStrength: "green-thumb",
      cultureTokens: 1, heritageCard: heritage("HERITAGE-001") });
    expect(getKqPreparationStartingXp(base)).toBe(10);
    expect(getKqPreparationStartingXp({ ...base, buddieCodes: [legendary, common, gold] })).toBe(10);
    const leader = startKqGame(31, { varietyCode: common, startingXp: 4, heritageCard: heritage("HERITAGE-001") });
    // The backend replaces the common leader's zero advantage with the max (+4).
    expect(leader.xp + 4).toBe(getKqPreparationStartingXp(base));
  });

  it("uses the supplied Heritage effect, including dynamic producer cards, rather than a hard-coded code", () => {
    const dynamic: KqHeritageCard = { ...heritage("HERITAGE-001"), code: "HERITAGE-999", effect: "starting-xp-two" };
    expect(getKqPreparationStartingXp(official({ heritageCard: dynamic }))).toBe(5);
    const changed: KqHeritageCard = { ...heritage("HERITAGE-002"), effect: "root-danger-to-spark" };
    expect(getKqPreparationStartingXp(official({ heritageCard: changed }))).toBe(3);
    expect(startKqGame(18, { varietyCode: common, heritageCard: dynamic }).xp).toBe(5);
    expect(startKqGame(18, { varietyCode: common, heritageCard: changed }).xp).toBe(3);
  });

  it("does not confuse unresolved profile or Heritage data with an intentional absence", () => {
    expect(getKqPreparationStartingXp(official({ chanvrierStrength: undefined }))).toBeNull();
    expect(getKqPreparationStartingXp(official({ heritageCard: undefined }))).toBeNull();
    expect(getKqPreparationStartingXp(official({ buddieCodes: [] }))).toBeNull();
    expect(getKqPreparationStartingXp(official({ buddieCodes: [common, "UNKNOWN"] }))).toBeNull();
    expect(getKqPreparationStartingXp(official())).toBe(1);
  });

  it("uses local/tutorial base XP without importing official profile or token bonuses", () => {
    for (const source of ["local", "tutorial"] as const) {
      const input = official({ source, buddieCodes: [gold], chanvrierStrength: "green-thumb", cultureTokens: 2,
        heritageCard: heritage("HERITAGE-007") });
      expect(getKqPreparationStartingXp(input)).toBe(5);
      expect(getKqPreparationStartingXp({ ...input, chanvrierStrength: undefined })).toBe(5);
      expect(getKqPreparationStartingXp({ ...input, localBaseXp: 2 })).toBe(6);
      expect(startKqGame(18, { varietyCode: gold, startingXp: 2, heritageCard: heritage("HERITAGE-007") }).xp).toBe(6);
      expect(getKqPreparationStartingXp({ ...input, localBaseXp: 0 })).toBe(5);
    }
    expect(getKqPreparationStartingXp(official({ source: "local", buddieCodes: [common, gold] }))).toBeNull();
    expect(getKqPreparationStartingXp(official({ source: "tutorial", heritageCard: undefined }))).toBeNull();
  });

  it("matches the token floor and cap of server launch without converting invalid input into an XP bonus", () => {
    expect(getKqPreparationStartingXp(official({ cultureTokens: 2.9 }))).toBe(3);
    for (const cultureTokens of [NaN, Infinity, -0.1, 3]) {
      expect(getKqPreparationStartingXp(official({ cultureTokens }))).toBeNull();
    }
    for (const localBaseXp of [NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER]) {
      expect(getKqPreparationStartingXp(official({ source: "tutorial", buddieCodes: [gold], localBaseXp }))).toBeNull();
    }
    expect(getKqPreparationStartingXp(official({ localBaseXp: 100 }))).toBe(1);
  });
});
