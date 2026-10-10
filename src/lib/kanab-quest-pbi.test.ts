import { describe, expect, it } from "vitest";
import {
  applyKqCareProduct, canApplyKqCareProduct, createKqCareState, isKqCareState,
  KQ_CARE_PRODUCTS, observeKqCareStage, performKqBasicCare, resolveKqCareStage,
  type KqCareProblem,
} from "./kanab-quest-care";
import {
  advanceKqStage, getKqSituation, KQ_BUDDIES, KQ_SITUATIONS, KQ_STAGES,
  resolveKqStage, startKqGame, type KqGameState,
} from "./kanab-quest-game";
import { encodeKqSave, parseKqGameSave } from "./kanab-quest-persistence";

const pestCodes = ["APHIDS", "MITES", "THRIPS"] as const;
const pbi = KQ_CARE_PRODUCTS.filter(product => product.kind === "pbi");
const quietSituations = ["SIT-001", "SIT-002", "SIT-009", "SIT-010", "SIT-005", "SIT-006"];
const problem = (code: string, severity: 1 | 2 | 3 = 3): KqCareProblem => ({
  code, severity, status: "confirmed", trend: "stable", appearedAt: 0, variant: 0,
});
function position(stageIndex = 1, seed = 42): KqGameState {
  return { ...startKqGame(seed), stageIndex, care: createKqCareState() };
}
function observation(state: KqGameState, code = quietSituations[state.stageIndex]) {
  return observeKqCareStage(state, KQ_SITUATIONS.find(situation => situation.code === code)!);
}
function careTick(state: KqGameState): KqGameState {
  const situation = KQ_SITUATIONS.find(item => item.code === quietSituations[state.stageIndex])!;
  // A fragile operation adds no successful-operation recovery: only the PBI
  // can reduce pest severity in these comparisons.
  return { ...state, care: resolveKqCareStage(state, situation, "fragile", false) };
}
const finishStage = (state: KqGameState, dice: [number, number, number] = [6, 6, 6]) =>
  resolveKqStage({ ...state, phase: "rolled", dice });

describe("parasite observations independent of operation cards", () => {
  it.each([1, 2, 3])("can reveal each pest in stage %i without a pest situation", stageIndex => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 512; seed++) {
      const before = position(stageIndex, seed);
      const after = observation(before);
      expect(after).toEqual(observation(before));
      expect(observation(after)).toBe(after);
      expect(after.care!.vitality).toBe(100);
      expect(after.care!.problems.length).toBeLessThanOrEqual(1);
      for (const issue of after.care!.problems) {
        if (!pestCodes.includes(issue.code as typeof pestCodes[number])) continue;
        seen.add(issue.code);
        expect(issue).toMatchObject({ severity: 1, status: "confirmed", appearedAt: stageIndex });
      }
    }
    expect([...seen].sort()).toEqual([...pestCodes].sort());
  });

  it("avoids extra ambient problems after a large loss and once two problems are present", () => {
    for (const stageIndex of [1, 2, 3]) {
      for (let seed = 1; seed <= 128; seed++) {
        const wounded = position(stageIndex, seed);
        wounded.care!.history.push({ stageIndex: stageIndex - 1, kind: "resolution", message: "Bilan difficile", vitalityDelta: -15, terpenesDelta: 0 });
        expect(observation(wounded).care!.problems).toEqual([]);
        const crowded = position(stageIndex, seed);
        crowded.care!.problems = [problem("NITROGEN"), problem("ROOTS")];
        expect(observation(crowded).care!.problems).toEqual(crowded.care!.problems);
      }
    }
  });

  it.each([0, 4, 5])("does not introduce ambient pests at stage %i", stageIndex => {
    for (let seed = 1; seed <= 128; seed++) expect(observation(position(stageIndex, seed)).care!.problems).toEqual([]);
  });

  it.each(["SIT-003", "SIT-013", "SIT-014"])("preserves the explicit attack from %s when two troubles already exist", code => {
    const before = position(2);
    before.care!.problems = [problem("NITROGEN"), problem("ROOTS")];
    before.care!.history.push({ stageIndex: 1, kind: "resolution", message: "Bilan difficile", vitalityDelta: -15, terpenesDelta: 0 });
    const after = observation(before, code);
    const expected = KQ_SITUATIONS.find(item => item.code === code)!.pest!.toUpperCase();
    expect(after.care!.problems).toEqual([...before.care!.problems, expect.objectContaining({ code: expected, severity: 1 })]);
    expect(observation(after, code)).toBe(after);
  });

  it("retains all five accumulated problems and round-trips them through a save", () => {
    let before = startKqGame(42);
    for (let index = 0; index < 2; index++) before = advanceKqStage(finishStage(before));
    before.care = createKqCareState();
    before.care.problems = [problem("NITROGEN"), problem("ROOTS"), problem("HEAT"), problem("APHIDS")];
    const after = observation(before, "SIT-013");
    expect(after.care!.problems.map(item => item.code)).toEqual(["NITROGEN", "ROOTS", "HEAT", "APHIDS", "MITES"]);
    expect(isKqCareState(after.care)).toBe(true);
    expect(parseKqGameSave(encodeKqSave(after))).toEqual(after);
    expect(isKqCareState({ ...after.care, problems: [...after.care!.problems, problem("THRIPS")] })).toBe(false);
  });
});

describe("distinct auxiliary roles and intervention timing", () => {
  it.each([
    ["CARE-APHIDIUS", "APHIDS", 3, 1],
    ["CARE-COCCINELLA", "APHIDS", 2, 0],
    ["CARE-CHRYSOPERLA", "APHIDS", 3, 2],
    ["CARE-CHRYSOPERLA", "THRIPS", 3, 2],
    ["CARE-SWIRSKII", "THRIPS", 3, 2],
    ["CARE-ORIUS", "THRIPS", 3, 1],
    ["CARE-PHYTOSEIULUS", "MITES", 3, 1],
  ])("%s acts on %s over two operation checks", (productCode, target, firstSeverity, secondSeverity) => {
    const before = position();
    before.care!.problems = [problem(String(target))];
    const applied = applyKqCareProduct(before, String(productCode));
    expect(applied.care!.problems).toEqual(before.care!.problems);
    expect(applied.care!.vitality).toBe(before.care!.vitality);
    expect(applied.care!.applications).toHaveLength(1);
    const first = careTick(applied);
    expect(first.care!.problems.find(item => item.code === target)?.severity ?? 0).toBe(firstSeverity);
    expect(first.care!.interventions).toEqual([expect.objectContaining({ productCode, remainingSteps: 1, status: "active" })]);
    const second = careTick({ ...first, stageIndex: 2 });
    expect(second.care!.problems.find(item => item.code === target)?.severity ?? 0).toBe(secondSeverity);
    expect(second.care!.interventions).toEqual([]);
    expect(second.care!.applications).toHaveLength(1);
  });

  it("lets one lacewing charge cover both aphids and thrips without treating mites", () => {
    const before = position();
    before.care!.problems = [problem("APHIDS"), problem("THRIPS"), problem("MITES")];
    const first = careTick(applyKqCareProduct(before, "CARE-CHRYSOPERLA"));
    expect(first.care!.problems.map(item => item.severity)).toEqual([3, 3, 3]);
    const second = careTick({ ...first, stageIndex: 2 });
    expect(second.care!.problems.map(item => item.severity)).toEqual([2, 2, 3]);
    expect(second.care!.applications).toEqual([{ productCode: "CARE-CHRYSOPERLA", stageIndex: 1 }]);
  });

  it.each(pbi)("only allows $name on a compatible observed pest", product => {
    for (const code of pestCodes) {
      const before = position();
      before.care!.problems = [problem(code)];
      const compatible = product.targets.includes(code.toLowerCase());
      expect(canApplyKqCareProduct(before, product.code).allowed).toBe(compatible);
      if (!compatible) expect(applyKqCareProduct(before, product.code)).toBe(before);
    }
    expect(canApplyKqCareProduct(position(), product.code).allowed).toBe(false);
  });

  it.each(pbi)("refuses a new $name charge from the end of flowering onward", product => {
    for (const [stageIndex, phase] of [[3, "resolved"], [4, "prepare"], [4, "rolled"], [4, "resolved"], [5, "prepare"]] as const) {
      const before = { ...position(stageIndex), phase };
      before.care!.problems = [problem(product.targets[0].toUpperCase())];
      const permission = canApplyKqCareProduct(before, product.code);
      expect(permission.allowed).toBe(false);
      expect(permission.reason.length).toBeGreaterThan(10);
      expect(applyKqCareProduct(before, product.code)).toBe(before);
    }
    const harvest = position(4);
    harvest.care!.problems = [problem("HEAT")];
    expect(canApplyKqCareProduct(harvest, "CARE-SEAWEED").allowed).toBe(true);
  });

  it.each(pbi)("gives $name applied during flowering its second check at harvest", product => {
    const before = position(3);
    const target = product.targets[0].toUpperCase();
    before.care!.problems = [problem(target)];
    expect(canApplyKqCareProduct(before, product.code).allowed).toBe(true);
    const first = careTick(applyKqCareProduct(before, product.code));
    const second = careTick({ ...first, stageIndex: 4 });
    expect(second.care!.problems.find(item => item.code === target)?.severity ?? 0)
      .toBeLessThan(first.care!.problems.find(item => item.code === target)!.severity);
    expect(second.care!.interventions).toEqual([]);
  });

  it("refuses Persimilis during heat stress and restores eligibility after recovery", () => {
    const before = position();
    before.care!.problems = [problem("MITES"), problem("HEAT")];
    const permission = canApplyKqCareProduct(before, "CARE-PHYTOSEIULUS");
    expect(permission.allowed).toBe(false);
    expect(permission.reason).toMatch(/thermique|chaleur|chaud/i);
    expect(applyKqCareProduct(before, "CARE-PHYTOSEIULUS")).toBe(before);
    before.care!.problems = [problem("MITES")];
    expect(canApplyKqCareProduct(before, "CARE-PHYTOSEIULUS").allowed).toBe(true);
  });

  it("prevents overlapping auxiliaries from multiplying the effect on the same targets", () => {
    const before = position();
    before.care!.problems = [problem("APHIDS"), problem("THRIPS"), problem("MITES")];
    const broad = applyKqCareProduct(before, "CARE-CHRYSOPERLA");
    for (const code of ["CARE-CHRYSOPERLA", "CARE-APHIDIUS", "CARE-COCCINELLA", "CARE-SWIRSKII", "CARE-ORIUS"]) {
      expect(canApplyKqCareProduct(broad, code).allowed).toBe(false);
    }
    expect(canApplyKqCareProduct(broad, "CARE-PHYTOSEIULUS").allowed).toBe(true);
  });

  it("preserves imported valid states at the four-intervention and twelve-application limits", () => {
    const crowded = position(2);
    crowded.care!.problems = [problem("MITES")];
    const codes = ["CARE-APHIDIUS", "CARE-COCCINELLA", "CARE-CHRYSOPERLA", "CARE-SWIRSKII"];
    crowded.care!.applications = codes.map(productCode => ({ productCode, stageIndex: 1 }));
    crowded.care!.interventions = codes.map(productCode => ({ productCode, stageIndex: 1, remainingSteps: 1, status: "active" }));
    expect(isKqCareState(crowded.care)).toBe(true);
    expect(canApplyKqCareProduct(crowded, "CARE-PHYTOSEIULUS").allowed).toBe(false);
    expect(applyKqCareProduct(crowded, "CARE-PHYTOSEIULUS")).toBe(crowded);

    const full = position(2);
    full.care!.problems = [problem("APHIDS")];
    full.care!.applications = [0, 1].flatMap(stageIndex => pbi.map(product => ({ productCode: product.code, stageIndex })));
    expect(isKqCareState(full.care)).toBe(true);
    expect(canApplyKqCareProduct(full, "CARE-APHIDIUS").allowed).toBe(false);
    expect(applyKqCareProduct(full, "CARE-APHIDIUS")).toBe(full);
  });
});

describe("natural culture coverage", () => {
  it("reaches every pest outside scripted attacks and keeps supported cultures replayable", () => {
    const outsideAttacks = new Map<string, Set<string>>();
    let maximumConcurrentProblems = 0;
    let minimumFinalVitality = 100;
    const productWitnesses = new Set<string>();
    const seeds = 300;
    for (let seed = 1; seed <= seeds; seed++) {
      let state = startKqGame(seed, { varietyCode: KQ_BUDDIES[(seed - 1) % KQ_BUDDIES.length].code });
      for (let stage = 0; stage < KQ_STAGES.length; stage++) {
        maximumConcurrentProblems = Math.max(maximumConcurrentProblems, state.care!.problems.length);
        expect(state.care!.problems.length).toBeLessThanOrEqual(5);
        const situation = getKqSituation(state);
        for (const issue of state.care!.problems) {
          if (!pestCodes.includes(issue.code as typeof pestCodes[number]) || issue.appearedAt !== stage || situation.pest) continue;
          const seen = outsideAttacks.get(String(stage)) ?? new Set<string>();
          seen.add(issue.code);
          outsideAttacks.set(String(stage), seen);
        }
        for (const product of pbi) {
          if (canApplyKqCareProduct(state, product.code).allowed) productWitnesses.add(product.code);
        }
        state = advanceKqStage(finishStage(performKqBasicCare(state)));
        expect(parseKqGameSave(encodeKqSave(state))).toEqual(state);
      }
      expect(state.phase).toBe("complete");
      expect(state.cultureDead).not.toBe(true);
      minimumFinalVitality = Math.min(minimumFinalVitality, state.care!.vitality);
    }
    expect([...productWitnesses].sort()).toEqual(pbi.map(item => item.code).sort());
    for (const stage of [1, 2, 3]) expect([...(outsideAttacks.get(String(stage)) ?? [])].sort()).toEqual([...pestCodes].sort());
    console.info("PBI natural paths:", JSON.stringify({ seeds, varieties: KQ_BUDDIES.length, maximumConcurrentProblems, minimumFinalVitality, reachableProducts: productWitnesses.size, autonomousPestStages: [...outsideAttacks.keys()].sort() }));
  });
});
