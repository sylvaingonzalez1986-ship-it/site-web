import { describe, expect, it } from "vitest";
import {
  advanceKqStage, getKqUnrescuedZeroSuccessStageCount, getKqZeroSuccessStageCount,
  hasKqFirstCultureRescue, isKqCultureDead, playKqCard, resolveKqStage,
  startKqGame, type KqGameState,
} from "./kanab-quest-game";
import { createKqFlower } from "./kanab-quest-battle";
import { createKqIntegrityCode, encodeKqSave, parseKqGameSave } from "./kanab-quest-persistence";

const resolveDice = (state: KqGameState, dice: [number, number, number] = [2, 2, 3]) =>
  resolveKqStage({ ...state, phase: "rolled", dice });
const firstZero = () => resolveDice(startKqGame(300, { firstCultureRescue: true }));
const rescued = () => resolveDice(advanceKqStage(firstZero()));

describe("one rescue for the first official culture", () => {
  it("requires a server-granted right and keeps it for the first lethal zero", () => {
    expect(hasKqFirstCultureRescue(startKqGame(300))).toBe(false);
    const first = firstZero();
    expect(first.firstCultureRescue).toBe(true);
    expect(first.history[0].rescued).toBeUndefined();
    expect(hasKqFirstCultureRescue(first)).toBe(true);
    expect(getKqUnrescuedZeroSuccessStageCount(first)).toBe(1);
  });

  it("keeps the failed result, dice, pressure and earned rewards unchanged", () => {
    const before = advanceKqStage(firstZero());
    const saved = resolveDice(before, [1, 2, 3]);
    const ordinary = resolveDice({ ...before, firstCultureRescue: undefined }, [1, 2, 3]);
    expect(saved).toMatchObject({ phase: "resolved", quality: ordinary.quality, xp: ordinary.xp, pressure: ordinary.pressure, dice: ordinary.dice });
    expect(saved.history.at(-1)).toEqual({ ...ordinary.history.at(-1), rescued: true });
    expect(saved.history.at(-1)).toMatchObject({ outcome: "failure", total: 0, qualityDelta: -1, xpGain: 1 });
    expect(saved.effectNotices?.at(-1)).toContain("Dés, résultat et gains inchangés");
    expect(hasKqFirstCultureRescue(saved)).toBe(false);
    expect(getKqZeroSuccessStageCount(saved)).toBe(2);
    expect(getKqUnrescuedZeroSuccessStageCount(saved)).toBe(1);
    expect(advanceKqStage(saved).stageIndex).toBe(2);
    expect(resolveKqStage(saved)).toBe(saved);
  });

  it("rescues a second zero even when successful stages separate the failures", () => {
    const good = resolveDice(advanceKqStage(firstZero()), [4, 5, 6]);
    const saved = resolveDice(advanceKqStage(good));
    expect(saved.history.map(entry => entry.total)).toEqual([0, 3, 0]);
    expect(saved.history.at(-1)?.rescued).toBe(true);
    expect(isKqCultureDead(saved)).toBe(false);
  });

  it("does not consume the rescue when a real card corrects the dice first", () => {
    const first = resolveDice(startKqGame(300, { firstCultureRescue: true, deckCodes: ["BOTTE-024"], startingXp: 5 }));
    const situationCodes = [...first.situationCodes];
    situationCodes[1] = "SIT-008";
    const rolled: KqGameState = { ...advanceKqStage(first), situationCodes, phase: "rolled", dice: [1, 2, 3] };
    const corrected = resolveKqStage(playKqCard(rolled, "BOTTE-024"));
    expect(corrected.history.at(-1)?.total).toBe(1);
    expect(corrected.history.at(-1)?.rescued).toBeUndefined();
    expect(hasKqFirstCultureRescue(corrected)).toBe(true);
  });

  it("ends on the next zero, with no second rescue or flower", () => {
    const dead = resolveDice(advanceKqStage(rescued()));
    expect(dead).toMatchObject({ phase: "complete", cultureDead: true, harvestGrams: 0 });
    expect(dead.history.filter(entry => entry.rescued)).toHaveLength(1);
    expect(getKqZeroSuccessStageCount(dead)).toBe(3);
    expect(getKqUnrescuedZeroSuccessStageCount(dead)).toBe(2);
    expect(() => createKqFlower(dead)).toThrow("culture morte");
  });

  it("can rescue the last stage and complete a normal harvest", () => {
    let game = advanceKqStage(firstZero());
    while (game.stageIndex < 5) game = advanceKqStage(resolveDice(game, [4, 5, 6]));
    game = advanceKqStage(resolveDice(game));
    expect(game.phase).toBe("complete");
    expect(game.history.at(-1)?.rescued).toBe(true);
    expect(isKqCultureDead(game)).toBe(false);
    expect(game.harvestGrams).toBeGreaterThan(0);
    expect(createKqFlower(game).status).toBe("available");
    expect(parseKqGameSave(encodeKqSave(game))).toEqual(game);
  });

  it("round-trips the unused right, consumed rescue and later terminal loss", () => {
    for (const game of [startKqGame(300, { firstCultureRescue: true }), firstZero(), rescued(), advanceKqStage(rescued()), resolveDice(advanceKqStage(rescued()))]) {
      const loaded = parseKqGameSave(encodeKqSave(game));
      expect(loaded).toEqual(game);
      expect(hasKqFirstCultureRescue(loaded!)).toBe(hasKqFirstCultureRescue(game));
    }
  });

  it("rejects forged, repeated, misplaced or contradictory rescue metadata", () => {
    const game = rescued();
    for (const invalid of [
      { ...game, firstCultureRescue: "true" },
      { ...game, firstCultureRescue: false },
      { ...game, firstCultureRescue: undefined },
      { ...game, history: game.history.map(entry => ({ ...entry, rescued: true })) },
      { ...game, history: game.history.map(entry => ({ ...entry, rescued: undefined })) },
      { ...game, history: game.history.map(entry => ({ ...entry, rescued: "true" })) },
      { ...game, history: game.history.map(entry => entry.rescued ? { ...entry, total: 1 } : entry) },
      { ...firstZero(), history: firstZero().history.map(entry => ({ ...entry, rescued: true })) },
      { ...game, phase: "complete", cultureDead: true, harvestGrams: 0, equipmentQualityBonus: 0 },
    ]) expect(parseKqGameSave(encodeKqSave(invalid))).toBeNull();
    const forgedMarker = { ...game, firstCultureRescue: undefined };
    expect(getKqUnrescuedZeroSuccessStageCount(forgedMarker)).toBe(2);
  });

  it("includes the right and its use in integrity receipts without changing legacy states", () => {
    const game = rescued();
    expect(createKqIntegrityCode(game)).not.toBe(createKqIntegrityCode({ ...game, firstCultureRescue: undefined }));
    expect(createKqIntegrityCode(game)).not.toBe(createKqIntegrityCode({ ...game, history: game.history.map(entry => ({ ...entry, rescued: undefined })) }));
    const legacy = startKqGame(300);
    expect(createKqIntegrityCode(legacy)).toBe(createKqIntegrityCode({ ...legacy, firstCultureRescue: false }));
  });
});
