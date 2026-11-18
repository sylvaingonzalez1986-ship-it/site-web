import { describe, expect, it } from "vitest";
import { applyKqCareProduct, canApplyKqCareProduct, createKqCareState, isKqCareState, observeKqCareStage, resolveKqCareStage } from "./kanab-quest-care";
import { getKqCareProblemPlants, getKqCareSectors, type KqCareSector } from "./kanab-quest-care-spatial";
import { getKqRoomCare } from "./kanab-quest-care-presentation";
import { getKqSituation, KQ_SITUATIONS, startKqGame, type KqGameState } from "./kanab-quest-game";
import { createKqWarehouseStarter, getKqWarehouseQuote, getKqWarehouseRunSnapshot } from "./kanab-quest-warehouse";
import { encodeKqSave, parseKqGameSave } from "./kanab-quest-persistence";

const initial = createKqWarehouseStarter();
const paid = getKqWarehouseQuote({ ...initial, zones: [{ ...initial.zones[0], width: 3, height: 2, rotation: 90 }] }, initial).nextState;
const warehouse = getKqWarehouseRunSnapshot(paid);
const product = "CARE-APHIDIUS";
const first = { zoneId: "starter", x: 0, y: 0 };
const distant = { ...first, x: 2, y: 1 };
function outbreak(seed: number) {
  const state = startKqGame(seed, {warehouse});
  state.care = createKqCareState();
  return observeKqCareStage(state, KQ_SITUATIONS.find(s => s.pest === "aphids")!);
}
function tick(state: KqGameState) {
  return resolveKqCareStage(state, getKqSituation(state), "fragile", false)!.problems.find(p => p.code === "APHIDS")?.plants ?? [];
}
function fixed(seed: number) {
  const state = outbreak(seed);
  state.care!.problems[0].plants = [{ ...first, slot: 0, severity: 1 }];
  return state;
}
describe("local outbreaks and one-square-metre game interventions", () => {
  const operation = { ...KQ_SITUATIONS[0], incident: undefined, tags: [] };
  it.each([
    ["CARE-VERMICOMPOST", "NITROGEN", 0], ["CARE-ORGANIC-FEED", "POTASSIUM", 1],
    ["CARE-COMPOST-TEA", "ROOTS", 0], ["CARE-SEAWEED", "HEAT", 0],
  ] as const)("applies %s only to matching plants in the chosen square", (code, problemCode, yieldBonus) => {
    const game = fixed(42);
    const problem = game.care!.problems[0];
    problem.code = problemCode;
    problem.plants = [first, distant].map(cell => ({ ...cell, slot: 0, severity: 2 }));
    problem.severity = 2;
    expect(applyKqCareProduct(game, code)).toBe(game);
    expect(applyKqCareProduct(game, code, { ...first, x: 3 })).toBe(game);
    const elsewhere = applyKqCareProduct(game, code, { ...first, x: 1 });
    const plain = resolveKqCareStage(game, operation, "success", false)!;
    const missed = resolveKqCareStage(elsewhere, operation, "success", false)!;
    expect([missed.problems, missed.vitality, missed.yieldBonusPercent]).toEqual([plain.problems, plain.vitality, plain.yieldBonusPercent]);
    const applied = applyKqCareProduct(game, code, first);
    expect(parseKqGameSave(encodeKqSave(applied))?.care).toEqual(applied.care);
    expect(applied.care?.problems).toEqual(game.care?.problems);
    const result = resolveKqCareStage(applied, operation, "success", false)!;
    expect(result.yieldBonusPercent).toBe(yieldBonus);
    expect(result.problems[0].plants).toEqual([{ ...first, slot: 0, severity: 1 }, { ...distant, slot: 0, severity: 2 }]);
    if (code === "CARE-VERMICOMPOST") {
      expect(result.interventions[0]).toMatchObject({ target: first, status: "active", remainingSteps: 1 });
      const second = resolveKqCareStage({ ...applied, care: result, stageIndex: 1 }, operation, "success", false)!;
      expect(second.interventions).toEqual([]);
      expect(second.problems[0].plants).toEqual([{ ...distant, slot: 0, severity: 2 }]);
    }
  });
  it("counts an input spread across the room as one pass and scales the crop-wide bonus to its coverage", () => {
    const game = fixed(52);
    const cells = getKqCareSectors(game);
    game.care!.problems[0] = { ...game.care!.problems[0], code: "NITROGEN", severity: 2,
      plants: cells.map(cell => ({ ...cell, slot: 0, severity: 2 })) };
    const code = "CARE-ORGANIC-FEED";
    let applied = game;
    for (const cell of cells) {
      expect(canApplyKqCareProduct(applied, code).allowed).toBe(true);
      applied = applyKqCareProduct(applied, code, cell);
      expect(canApplyKqCareProduct(applied, code, cell).allowed).toBe(false);
      expect(canApplyKqCareProduct(applied, "CARE-SEAWEED", cell).allowed).toBe(false);
    }
    expect(canApplyKqCareProduct(applied, code).allowed).toBe(false);
    expect(applied.care!.history.filter(event => event.productCode === code)).toHaveLength(1);
    expect(parseKqGameSave(encodeKqSave(applied))?.care?.applications).toHaveLength(cells.length);
    const care = resolveKqCareStage(applied, operation, "success", false)!;
    expect(care.yieldBonusPercent).toBe(5);
    const next = { ...applied, care, stageIndex: 1 };
    expect(canApplyKqCareProduct(next, code, first).allowed).toBe(false);
    const secondInput = applyKqCareProduct(next, "CARE-SEAWEED", first);
    expect(canApplyKqCareProduct(secondInput, "CARE-SEAWEED", distant).allowed).toBe(true);
    expect(canApplyKqCareProduct({ ...secondInput, stageIndex: 2 }, "CARE-VERMICOMPOST", distant).allowed).toBe(false);
    expect(isKqCareState({ ...care, applications: [...care.applications, { productCode: code, stageIndex: 0 }] })).toBe(false);
  });
  it("keeps an input paid before sector selection effective over the whole saved culture", () => {
    const game = fixed(27);
    game.care!.problems = [{ ...game.care!.problems[0], code: "NITROGEN", plants: undefined }];
    game.care!.applications = [{ productCode: "CARE-ORGANIC-FEED", stageIndex: 0 }];
    game.care!.interventions = [{ ...game.care!.applications[0], remainingSteps: 1, status: "installing" }];
    const restored = parseKqGameSave(encodeKqSave(game))!;
    expect(canApplyKqCareProduct(restored, "CARE-ORGANIC-FEED", distant).allowed).toBe(false);
    expect(resolveKqCareStage(restored, operation, "success", false)).toMatchObject({ yieldBonusPercent: 5, problems: [] });
  });
  it("starts on precisely one pot, migrates a historical focus deterministically and reads without advancing", () => {
    const game = outbreak(185);
    const initialProblem = game.care!.problems[0];
    expect(initialProblem.plants).toHaveLength(1);
    const historical = { ...initialProblem, plants: undefined };
    expect(getKqCareProblemPlants(game, historical)).toEqual(initialProblem.plants);
    expect(observeKqCareStage(game, getKqSituation(game))).toBe(game);
    expect(parseKqGameSave(encodeKqSave(game))?.care?.problems).toEqual(game.care?.problems);
    expect(getKqCareSectors(game)).toHaveLength(6);
  });
  it("spreads only to an adjacent plant and a treatment on a distant square leaves that spread unaffected", () => {
    const game = fixed(18);
    const original = tick(game);
    expect(original).toHaveLength(2);
    expect(original[1]).toMatchObject(first);
    expect([1, 2]).toContain(original[1].slot);
    const elsewhere = applyKqCareProduct(game, product, distant);
    expect(tick(elsewhere)).toEqual(original);
    expect(canApplyKqCareProduct(elsewhere, product, first).allowed).toBe(true);
    expect(canApplyKqCareProduct(elsewhere, product, distant).allowed).toBe(false);
    expect(applyKqCareProduct(game, product)).toBe(game);
    expect(applyKqCareProduct(game, product, { ...first, zoneId: "starter-drying" })).toBe(game);
    expect(applyKqCareProduct(game, product, { ...first, y: 2 })).toBe(game);
    const both = applyKqCareProduct(elsewhere, product, first);
    expect(parseKqGameSave(encodeKqSave(both))?.care?.applications).toEqual(both.care?.applications);
    const corrupt = structuredClone(both);
    corrupt.care!.problems[0].plants![0].y = 2;
    expect(parseKqGameSave(encodeKqSave(corrupt))).toBeNull();
  });
  it("keeps the one-in-ten escape branch reproducible across retries, including when the treated plant recovers", () => {
    const template = applyKqCareProduct(fixed(123), "CARE-COCCINELLA", first);
    let escapes = 0;
    for (let seed = 1; seed <= 1000; seed++) {
      const game = { ...template, seed };
      const plants = tick(game);
      if (plants.length) {
        escapes++;
        expect(plants).toHaveLength(1);
        expect([1, 2]).toContain(plants[0].slot);
      }
      expect(tick(game)).toEqual(plants);
    }
    expect(escapes).toBeGreaterThan(70);
    expect(escapes).toBeLessThan(130);
  });
  it("keeps each plant's severity local when covered and uncovered plants share a problem", () => {
    const game = fixed(123);
    game.care!.problems[0].plants!.push({ ...distant, slot: 3, severity: 3 });
    const plants = tick(applyKqCareProduct(game, "CARE-COCCINELLA", first));
    expect(plants).not.toContainEqual({ ...first, slot: 0, severity: 1 });
    expect(plants).toContainEqual({ ...distant, slot: 3, severity: 3 });
    const invalid: KqCareSector = { ...first, x: -.5 };
    expect(canApplyKqCareProduct(game, product, invalid).allowed).toBe(false);
  });
  it("shows markers, severity and deployed auxiliaries in their recorded zones", () => {
    const care = applyKqCareProduct(fixed(17), product, first).care!;
    care.problems[0].severity = 3;
    care.problems[0].plants!.push({ ...first, zoneId: "neighbour", slot: 2, severity: 3 });
    expect(getKqRoomCare(0, care, first.zoneId)).toMatchObject({ attention: "À surveiller", effects: [expect.any(String)], affectedPlants: [{ ...first, slot: 0, severity: 1 }] });
    expect(getKqRoomCare(0, care, "neighbour")).toMatchObject({ attention: "Alerte critique", effects: [], affectedPlants: [{ zoneId: "neighbour", slot: 2 }] });
    expect(getKqRoomCare(0, care, "healthy")).toMatchObject({ attention: undefined, effects: [] });
    expect(getKqRoomCare(5, care)).not.toHaveProperty("affectedPlants");
  });
});
