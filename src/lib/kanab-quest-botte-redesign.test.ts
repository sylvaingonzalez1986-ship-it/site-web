import { describe, expect, it } from "vitest";
import {
  advanceKqStage, canPlayKqCard, doesKqCardMatchSituation, KQ_ACTIVE_CARDS, KQ_CARDS,
  KQ_COLLECTIONS, KQ_SITUATIONS, KQ_STAGES, playKqCard, previewKqResolution,
  resolveKqStage, rollKqDice, startKqGame, type KqGameState,
} from "./kanab-quest-game";
import { encodeKqSave, parseKqGameSave } from "./kanab-quest-persistence";
import { buildKqRecommendedDeck } from "./kanab-quest-economy";

const card = (code: string) => KQ_CARDS.find(item => item.code === code)!;
function position(code: string, situationCode: string, dice: [number, number, number]): KqGameState {
  const stageIndex = KQ_STAGES.indexOf(KQ_SITUATIONS.find(item => item.code === situationCode)!.stage);
  const state = startKqGame(42, { deckCodes: [code], startingXp: 20 });
  return { ...state, stageIndex, handCodes: [code], phase: "rolled", dice,
    situationCodes: state.situationCodes.map((value, index) => index === stageIndex ? situationCode : value) };
}

describe("Botte compatible with the permanent culture follow-up", () => {
  it("has four rarities and keeps obsolete definitions only for archived receipts", () => {
    expect(KQ_ACTIVE_CARDS).toHaveLength(KQ_COLLECTIONS.support.totalCards);
    expect(KQ_ACTIVE_CARDS).toHaveLength(30);
    expect(Object.fromEntries(["common", "uncommon", "rare", "epic"].map(rarity => [rarity, KQ_ACTIVE_CARDS.filter(item => item.rarity === rarity).length])))
      .toEqual({ common: 12, uncommon: 7, rare: 7, epic: 4 });
    const retired = ["BOTTE-002", "BOTTE-004", "BOTTE-010", "BOTTE-011", "BOTTE-012", "BOTTE-022", "BOTTE-023", "BOTTE-025"];
    for (const code of retired) {
      expect(KQ_CARDS.some(item => item.code === code)).toBe(true);
      expect(KQ_ACTIVE_CARDS.some(item => item.code === code)).toBe(false);
    }
    expect(startKqGame(12, { deckCodes: [...retired, "BOTTE-037"] }).deckCodes).toEqual(["BOTTE-037"]);
  });

  it.each([
    ["BOTTE-024", "SIT-017"], ["BOTTE-024", "SIT-018"], ["BOTTE-024", "SIT-020"],
    ["BOTTE-033", "SIT-007"], ["BOTTE-031", "SIT-033"], ["BOTTE-032", "SIT-027"],
    ["BOTTE-032", "SIT-048"], ["BOTTE-036", "SIT-027"], ["BOTTE-018", "SIT-031"],
    ["BOTTE-026", "SIT-028"], ["BOTTE-019", "SIT-035"], ["BOTTE-029", "SIT-043"],
  ])("rejects %s against unrelated problem %s despite a shared family", (code, situationCode) => {
    const state = position(code, situationCode, [1, 2, 5]);
    if (card(code).timing === "before-roll") state.phase = "prepare";
    expect(doesKqCardMatchSituation(card(code), KQ_SITUATIONS.find(item => item.code === situationCode)!)).toBe(false);
    expect(canPlayKqCard(state, card(code)).allowed).toBe(false);
    expect(playKqCard(state, code)).toBe(state);
  });

  it("offers a targeted containment decision for unwanted pollen without curing the crop", () => {
    const state = position("BOTTE-035", "SIT-046", [1, 2, 5]);
    const next = playKqCard(state, "BOTTE-035");
    expect(next.dice).toEqual([3, 2, 5]);
    expect(next.care).toEqual(state.care);
    expect(next.quality).toBe(state.quality);
  });

  it("uses exact compatibility for the operation bonus as well as the card permission", () => {
    const state = position("BOTTE-003", "SIT-007", [4, 4, 5]);
    const baseline = resolveKqStage(state);
    // A stale receipt naming an unrelated tool must not invent an operation bonus.
    expect(resolveKqStage({ ...state, playedThisStage: ["BOTTE-003"] }).care).toEqual(baseline.care);
    const pollen = position("BOTTE-035", "SIT-046", [4, 4, 5]);
    const usual = resolveKqStage(pollen);
    const isolated = resolveKqStage({ ...pollen, playedThisStage: ["BOTTE-035"] });
    expect(isolated.care!.terpenes).toBe(usual.care!.terpenes + 2);
    expect(isolated.care!.cannabinoidExpression).toBe(usual.care!.cannabinoidExpression + 2);
  });

  it("keeps every active card reachable and every authored scope valid", () => {
    for (const item of KQ_ACTIVE_CARDS) {
      if (item.tags.length) expect(item.situationCodes?.length, item.code).toBeGreaterThan(0);
      for (const code of item.situationCodes ?? []) expect(KQ_SITUATIONS.some(situation => situation.code === code), code).toBe(true);
      expect(KQ_SITUATIONS.some(situation => {
        const state = position(item.code, situation.code, [1, 2, 5]);
        if (item.effect === "cross-diagnosis") state.dice = [2, 4, 5];
        if (item.timing === "before-roll") state.phase = "prepare";
        return canPlayKqCard(state, item).allowed;
      }), item.code).toBe(true);
    }
    for (const code of ["SIT-029", "SIT-038", "SIT-049"]) {
      const situation = KQ_SITUATIONS.find(item => item.code === code)!;
      expect(`${situation.name} ${situation.story}`).not.toMatch(/bocal|bocaux/i);
    }
  });

  it("gives neutral root rolls an affordable correction without creating a rescue for three dangers", () => {
    expect(playKqCard(position("BOTTE-037", "SIT-041", [1, 2, 6]), "BOTTE-037").dice).toEqual([1, 4, 6]);
    const danger = position("BOTTE-037", "SIT-041", [1, 1, 1]);
    expect(canPlayKqCard(danger, card("BOTTE-037")).allowed).toBe(false);
  });

  it("balances humidity before the roll while keeping danger protection distinct from a success", () => {
    const state = { ...position("BOTTE-038", "SIT-017", [1, 2, 3]), phase: "prepare" as const, pressure: 3 };
    const prepared = playKqCard(state, "BOTTE-038");
    expect(prepared.pressure).toBe(2);
    const rolled = rollKqDice(prepared);
    expect(rolled.dice).toEqual(rollKqDice(state).dice);
    expect(rolled.cancelledDangers).toBe(1);
    expect(prepared.xp).toBe(state.xp - 1);
  });
});

describe("limited epic support", () => {
  it.each([
    ["BOTTE-039", "SIT-001"], ["BOTTE-040", "SIT-004"],
    ["BOTTE-041", "SIT-005"], ["BOTTE-042", "SIT-006"],
  ])("checks %s over all 216 rolls without changing existing successes or past biological losses", (code, situationCode) => {
    for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) for (let c = 1; c <= 6; c++) {
      const state = position(code, situationCode, [a, b, c]);
      const original = structuredClone(state);
      const weakCount = state.dice!.filter(die => die < 4).length;
      expect(canPlayKqCard(state, card(code)).allowed).toBe(weakCount > 0);
      const next = playKqCard(state, code);
      expect(state).toEqual(original);
      if (!weakCount) { expect(next).toBe(state); continue; }
      expect(next.xp).toBe(state.xp - card(code).xpCost);
      expect(next.usedCards).toEqual([code]);
      expect(next.care).toEqual(state.care);
      expect(next.quality).toBe(state.quality);
      state.dice!.forEach((die, index) => { if (die >= 4) expect(next.dice![index]).toBe(die); });
      expect(next.dice!.filter(die => die >= 4)).toHaveLength(code === "BOTTE-042" ? 3 : Math.min(3, 3 - weakCount + 2));
      if (code === "BOTTE-039") expect(previewKqResolution(next)?.dangers).toBe(0);
      if (code === "BOTTE-040") expect(next.pressure).toBe(0);
      if (code === "BOTTE-041") expect(next.dice!.filter(die => die === 6)).toHaveLength(state.dice!.filter(die => die === 6).length + 1);
      if (code === "BOTTE-042") expect(previewKqResolution(next)?.outcome).toBe("critical");
    }
  });

  it("makes the emergency adjustment useful for pressure alone but refuses an empty effect", () => {
    const state = { ...position("BOTTE-040", "SIT-004", [4, 5, 6]), pressure: 4 };
    expect(playKqCard(state, "BOTTE-040")).toMatchObject({ dice: [4, 5, 6], pressure: 0, usedCards: ["BOTTE-040"] });
    expect(canPlayKqCard({ ...state, pressure: 0 }, card("BOTTE-040")).allowed).toBe(false);
  });

  it("requires enough XP and refuses a second epic of any code after reloading", () => {
    const base = position("BOTTE-039", "SIT-001", [1, 1, 1]);
    expect(canPlayKqCard({ ...base, xp: 3 }, card("BOTTE-039")).reason).toContain("4 XP");
    const played = playKqCard({ ...base, deckCodes: ["BOTTE-039", "BOTTE-040"] }, "BOTTE-039");
    const restored = parseKqGameSave(encodeKqSave(played));
    expect(restored).not.toBeNull();
    const next = { ...advanceKqStage(resolveKqStage(restored!)), xp: 20, handCodes: ["BOTTE-040"], phase: "rolled" as const, dice: [1, 2, 5] as [number, number, number] };
    expect(canPlayKqCard(next, card("BOTTE-040")).reason).toContain("épique a déjà");
    expect(playKqCard(next, "BOTTE-040")).toBe(next);
    expect(parseKqGameSave(encodeKqSave({ ...played, usedCards: ["BOTTE-039", "BOTTE-040"] }))).toBeNull();
  });

  it("awards harvest-team quality only on success and keeps a useful preparation stack", () => {
    const state = position("BOTTE-041", "SIT-005", [1, 2, 5]);
    const rescued = playKqCard(state, "BOTTE-041");
    expect(resolveKqStage(rescued).history.at(-1)?.qualityDelta).toBe(4);
    expect(resolveKqStage({ ...rescued, playedThisStage: ["BOTTE-032", "BOTTE-041"] }).history.at(-1)?.qualityDelta).toBe(5);
    const fragile = playKqCard(position("BOTTE-041", "SIT-025", [1, 1, 1]), "BOTTE-041");
    expect(resolveKqStage(fragile).history.at(-1)).toMatchObject({ outcome: "fragile", qualityDelta: 1 });
  });

  it("never recommends several epics in the same deck", () => {
    const inventory = Object.fromEntries(KQ_ACTIVE_CARDS.map(item => [item.code, 1]));
    for (const buddie of [undefined, "HH2026-001", "HH2026-052"]) {
      const deck = buildKqRecommendedDeck("starting-xp-4", inventory, ["critical-touch", "no-failure"], buddie);
      expect(deck.support.filter(code => card(code).rarity === "epic").length).toBeLessThanOrEqual(1);
    }
  });
});
