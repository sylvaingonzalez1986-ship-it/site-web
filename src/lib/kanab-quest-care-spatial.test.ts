import { describe, expect, it } from "vitest";
import { applyKqCareProduct, canApplyKqCareProduct, createKqCareState, isKqCareState, observeKqCareStage, resolveKqCareStage } from "./kanab-quest-care";
import { getKqCareProblemPlants, getKqCareSectors, type KqCareSector } from "./kanab-quest-care-spatial";
import { getKqRoomCare } from "./kanab-quest-care-presentation";
import { getKqRunProjection, getKqSituation, KQ_SITUATIONS, startKqGame, type KqGameState } from "./kanab-quest-game";
import { getKqCampaignMemberState, getKqCampaignParticipants } from "./kanab-quest-campaign";
import { createKqWarehouseStarter, getKqWarehouseQuote, getKqWarehouseRunSnapshot } from "./kanab-quest-warehouse";
import { encodeKqSave, parseKqGameSave } from "./kanab-quest-persistence";
import { getKqWarehousePreparationEffects, type KqWarehouseRunPreparation } from "./kanab-quest-warehouse-preparations";

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

describe("warehouse hygiene prevention", () => {
  const ownWarehouse = getKqWarehouseRunSnapshot(paid, 0, "starter", 2, 2, 2, undefined, 1);
  const prepared = { vacuum: true, mop: true, hygieneM2: ownWarehouse.activeAreaM2, irrigatedM2: 0, used: {} };
  const aphids = KQ_SITUATIONS.find(situation => situation.pest === "aphids")!;
  const seeds = Array.from({ length: 64 }, (_, index) => index + 1);

  it("applies the entrance reduction to the remaining risk at every level of other protection", () => {
    const area = ownWarehouse.activeAreaM2;
    const prep = { ...prepared, vacuum: false, mop: false };
    const risk = (item: KqWarehouseRunPreparation, pest = true) => 100 - getKqWarehousePreparationEffects(area, item, pest).preventionPercent;
    expect(risk(prepared)).toBe(75);
    expect(risk({ ...prepared, entranceAirlock: false })).toBe(85);
    expect(risk({ ...prepared, entranceAirlock: true })).toBe(21.25);
    expect(risk({ ...prep, entranceAirlock: true })).toBe(25);
    for (const pest of [false, true]) {
      for (const measures of [prep, prepared, { ...prepared, used: { "WAREHOUSE-PBI": area, "WAREHOUSE-MAINTENANCE": area } }]) {
        expect(risk({ ...measures, entranceAirlock: true }, pest)).toBe(risk({ ...measures, entranceAirlock: false }, pest) / 4);
      }
    }
  });

  it("reduces insect, fungal and viral observations in a single zone and keeps noninfectious problems unchanged", () => {
    const game = { ...startKqGame(1, { warehouse: ownWarehouse }), stageIndex: 1, care: createKqCareState() };
    const prep = { ...prepared, vacuum: false, mop: false };
    const bare = { starter: { ...prep, entranceAirlock: false } };
    const secured = { starter: { ...prep, entranceAirlock: true } };
    const observations: Record<string, { total: number; escaped: number }> = { APHIDS: { total: 0, escaped: 0 }, MILDEW: { total: 0, escaped: 0 }, VIRUS: { total: 0, escaped: 0 } };
    for (let seed = 0; seed < 12000; seed++) {
      const state = { ...game, seed };
      const operation = seed % 8 === 0 ? aphids : KQ_SITUATIONS[0];
      const problem = observeKqCareStage({ ...state, warehousePreparations: bare }, operation).care!.problems[0];
      if (!problem || !observations[problem.code]) continue;
      const result = observeKqCareStage({ ...state, warehousePreparations: secured }, operation);
      observations[problem.code].total++;
      if (result.care!.problems.length) observations[problem.code].escaped++;
      if (problem.code === "VIRUS" && observations.VIRUS.total === 1) {
        expect(observeKqCareStage(state, operation).care!.problems[0]?.code).toBe("MILDEW");
      }
    }
    for (const { total, escaped } of Object.values(observations)) {
      expect(total).toBeGreaterThan(190);
      expect(escaped / total).toBeGreaterThan(0.17);
      expect(escaped / total).toBeLessThan(0.33);
    }
    const heat = KQ_SITUATIONS.find(situation => situation.code === "SIT-004")!;
    expect(observeKqCareStage({ ...game, warehousePreparations: secured }, heat).care)
      .toEqual(observeKqCareStage({ ...game, warehousePreparations: bare }, heat).care);
  });

  it("protects the whole campaign against worsening and secondary spread for each contagious problem", () => {
    const second = { ...paid.zones[0], id: "second", buddieCode: "HH2026-021", x: 5 };
    const plan = getKqWarehouseQuote({ ...paid, zones: [{ ...paid.zones[0], buddieCode: "HH2026-020" }, second] }, paid).nextState;
    const members = getKqCampaignParticipants(plan, 1, undefined, undefined, 1).map((member, index) => ({ ...member, runId: `00000000-0000-4000-8000-00000000000${index}` }));
    const leader = members[0];
    const crop = startKqGame(1, { warehouse: leader.warehouse, varietyCode: leader.buddieCode, cultivationProfile: leader.cultivationProfile });
    crop.campaign = { version: 1, id: "00000000-0000-4000-8000-000000000099", leaderRunId: leader.runId, members };
    const preparation = { ...prepared, entranceAirlock: true, vacuum: false, mop: false, hygieneM2: 0 };
    crop.warehousePreparations = Object.fromEntries(members.map(member => [member.zoneId, preparation]));
    for (const code of ["APHIDS", "MILDEW", "VIRUS"]) {
      crop.care = { ...createKqCareState(), problems: [{ code, status: "confirmed", trend: "stable", severity: 1, appearedAt: 0, variant: 0,
        plants: members.map(member => ({ zoneId: member.zoneId, x: 0, y: 0, slot: 0, severity: 1 })) }] };
      const worsened = members.map(() => 0);
      let spread = 0;
      for (let seed = 0; seed < 768; seed++) {
        const result = resolveKqCareStage({ ...crop, seed }, KQ_SITUATIONS[0], "failure", false)!.problems[0];
        members.forEach((member, i) => {
          if (result.plants!.some(plant => plant.zoneId === member.zoneId && plant.severity === 2)) worsened[i]++;
        });
        if (result.plants!.length > members.length) spread++;
      }
      for (const events of [...worsened, spread]) {
        expect(events / 768).toBeGreaterThan(0.18);
        expect(events / 768).toBeLessThan(0.32);
      }
    }
    expect(parseKqGameSave(encodeKqSave(crop))).toMatchObject({ care: { problems: [{ code: "VIRUS" }] }, warehousePreparations: crop.warehousePreparations });
    expect(parseKqGameSave(encodeKqSave({ ...crop, warehousePreparations: { starter: { ...preparation, entranceAirlock: false }, second: preparation } }))).toBeNull();
    expect(parseKqGameSave(encodeKqSave({ ...crop, warehousePreparations: { starter: { ...preparation, entranceAirlock: "false" }, second: preparation } }))).toBeNull();
  });

  it("can prevent a new pest observation without changing its replay", () => {
    const results = seeds.map(seed => {
      const crop = { ...startKqGame(seed, { warehouse: ownWarehouse }), stageIndex: 1, care: createKqCareState() };
      expect(observeKqCareStage(crop, aphids).care?.problems[0]?.code).toBe("APHIDS");
      const clean = { ...crop, warehousePreparations: { starter: prepared } };
      const observed = observeKqCareStage(clean, aphids);
      expect(observeKqCareStage(clean, aphids)).toEqual(observed);
      expect(observeKqCareStage(observed, aphids)).toBe(observed);
      return observed.care!.problems.length;
    });
    expect(results).toContain(0);
    expect(results).toContain(1);
  });

  it("contains fungal outbreaks through hygiene while the generic biological pest input targets insects only", () => {
    const operation = { ...KQ_SITUATIONS[0], pest: undefined };
    const starter = startKqGame(1, { warehouse: ownWarehouse });
    const observations = Array.from({ length: 1024 }, (_, index) => index + 1).flatMap(seed => {
      const crop = { ...starter, seed, stageIndex: 1, care: createKqCareState() };
      if (!observeKqCareStage(crop, operation).care?.problems.some(problem => problem.code === "MILDEW")) return [];
      const onlyPbi = { ...prepared, vacuum: false, mop: false, used: { "WAREHOUSE-PBI": ownWarehouse.activeAreaM2 } };
      expect(observeKqCareStage({ ...crop, warehousePreparations: { starter: onlyPbi } }, operation).care?.problems[0]?.code).toBe("MILDEW");
      return [observeKqCareStage({ ...crop, warehousePreparations: { starter: prepared } }, operation).care!.problems.length];
    });
    expect(observations).toContain(0);
    expect(observations).toContain(1);
  });

  it("contains worsening in the prepared zone of a shared crop and preserves already incurred losses", () => {
    const second = { ...paid.zones[0], id: "second", buddieCode: "HH2026-021", x: 5 };
    const plan = getKqWarehouseQuote({ ...paid, zones: [{ ...paid.zones[0], buddieCode: "HH2026-020" }, second] }, paid).nextState;
    const members = getKqCampaignParticipants(plan, 1, undefined, undefined, 1).map(member => ({ ...member, runId: member.zoneId }));
    const leader = members[0];
    const crop = startKqGame(2, { warehouse: leader.warehouse, varietyCode: leader.buddieCode, cultivationProfile: leader.cultivationProfile });
    crop.campaign = { version: 1, id: "fixture", leaderRunId: leader.runId, members };
    crop.care = { ...createKqCareState(), yieldLossPercent: 10,
      problems: [{ code: "APHIDS", status: "confirmed", trend: "stable", severity: 1, appearedAt: 0, variant: 0,
        plants: ["starter", "second"].map(zoneId => ({ zoneId, x: 0, y: 0, slot: 0, severity: 1 })) }] };
    const clean = { ...crop, warehousePreparations: { starter: prepared } };
    const operation = { ...aphids, tags: [] as typeof aphids.tags, incident: undefined };
    const outcomes = seeds.map(seed => resolveKqCareStage({ ...clean, seed }, operation, "failure", false)?.problems[0].plants);
    expect(outcomes.some(plants => plants?.some(plant => plant.zoneId === "starter" && plant.slot === 0 && plant.severity === 1))).toBe(true);
    expect(outcomes.every(plants => plants?.some(plant => plant.zoneId === "second" && plant.slot === 0 && plant.severity === 2))).toBe(true);
    const starter = members.find(member => member.zoneId === "starter")!;
    expect(getKqRunProjection(getKqCampaignMemberState(clean, starter)).harvestGrams)
      .toBe(getKqRunProjection(getKqCampaignMemberState(crop, starter)).harvestGrams);
  });
});

describe("local outbreaks and one-square-metre game interventions", () => {
  const operation = { ...KQ_SITUATIONS[0], incident: undefined, tags: [] };
  it.each([
    ["CARE-IRON", "IRON", "success", 0],
    ["CARE-IRON", "IRON", "fragile", 2],
    ["CARE-PERLITE", "ROOTS", "fragile", 1],
    ["CARE-SHADE", "HEAT", "failure", 2],
    ["CARE-SHADE", "HEAT", "success", 1],
    ["CARE-BLUE-TRAPS", "THRIPS", "failure", 2],
  ] as const)("checks the affected square for %s and applies its %s %s effect", (code, problemCode, outcome, expected) => {
    const game = fixed(42);
    const problem = game.care!.problems[0];
    expect(canApplyKqCareProduct(game, code, first).allowed).toBe(false);
    problem.code = problemCode;
    problem.plants = [first, distant].map(cell => ({ ...cell, slot: 0, severity: 2 }));
    problem.severity = 2;
    const wrong = { ...first, x: 1 };
    expect(applyKqCareProduct(game, code, wrong)).toBe(game);
    const applied = applyKqCareProduct(game, code, first);
    expect(applied).not.toBe(game);
    expect(applied.care?.problems).toEqual(game.care!.problems);
    expect(parseKqGameSave(encodeKqSave(applied))?.care).toEqual(applied.care);
    expect(canApplyKqCareProduct(applied, code, first).allowed).toBe(false);
    const care = resolveKqCareStage(applied, operation, outcome, false)!;
    const plants = care.problems[0]?.plants ?? [];
    expect(plants.find(p => p.x === first.x && p.y === first.y && p.slot === 0)?.severity ?? 0).toBe(expected);
    expect(plants.find(p => p.x === distant.x && p.y === distant.y && p.slot === 0)?.severity).toBe(outcome === "failure" ? 3 : 2);
    expect(care.yieldBonusPercent).toBe(0);
    expect(care.interventions).toEqual([]);
  });

  it("keeps iron distinct from other deficiencies, refuses it in salt stress and never treats viral outbreaks", () => {
    const game = fixed(42);
    const problem = game.care!.problems[0];
    for (const code of ["CALCIUM", "MAGNESIUM", "NITROGEN", "VIRUS"]) {
      problem.code = code;
      expect(canApplyKqCareProduct(game, "CARE-IRON", first).allowed).toBe(false);
    }
    for (const code of ["CARE-PERLITE", "CARE-SHADE", "CARE-BLUE-TRAPS"]) {
      expect(canApplyKqCareProduct(game, code, first).allowed).toBe(false);
    }
    problem.code = "IRON";
    game.care!.problems.push({ ...problem, code: "SALTS" });
    expect(canApplyKqCareProduct(game, "CARE-IRON", first).reason).toMatch(/salin/);
  });

  it("preserves the auxiliary's stronger effect when a blue trap is present on the same square", () => {
    const game = fixed(42);
    game.care!.problems[0] = { ...game.care!.problems[0], code: "THRIPS", severity: 3, plants: [{ ...first, slot: 0, severity: 3 }] };
    const withTraps = applyKqCareProduct(game, "CARE-BLUE-TRAPS", first);
    const combined = applyKqCareProduct(withTraps, "CARE-ORIUS", first);
    expect(combined.care!.interventions).toHaveLength(2);
    const next = resolveKqCareStage(combined, operation, "fragile", false)!;
    expect(next.interventions.map(i => i.productCode)).toEqual(["CARE-ORIUS"]);
    expect(resolveKqCareStage({ ...combined, stageIndex: 1, care: next }, operation, "fragile", false)?.problems[0]?.severity).toBe(1);
  });
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
