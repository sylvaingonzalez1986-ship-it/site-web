import { describe, expect, it } from "vitest";
import { advanceKqStage, canPlayKqCard, getKqRunProjection, KQ_CARDS, KQ_SITUATIONS, resolveKqStage, startKqGame, type KqGameState } from "./kanab-quest-game";
import { applyKqCareProduct, canApplyKqCareProduct, createKqCareState, getKqCannabinoidProfile, getKqCannabinoidReport, isKqCareState, KQ_CANNABINOID_FAMILIES, observeKqCareStage, performKqBasicCare, resolveKqCareStage, type KqCareProblem } from "./kanab-quest-care";
import { createKqIntegrityCode, encodeKqSave, parseKqGameSave } from "./kanab-quest-persistence";
import { getKqCultureAnalysis } from "./kanab-quest-culture-analysis";

const problem = (code: string, severity: 1 | 2 | 3 = 1): KqCareProblem => ({ code, severity, status: "confirmed", trend: "stable", appearedAt: 0, variant: 0 });
function position(code = "SIT-003"): KqGameState {
  const situation = KQ_SITUATIONS.find(item => item.code === code)!;
  const stageIndex = ["Germination", "Enracinement", "Croissance", "Floraison", "Récolte", "Séchage & affinage"].indexOf(situation.stage);
  const state = startKqGame(9);
  state.stageIndex = stageIndex;
  state.situationCodes[stageIndex] = code;
  state.care = createKqCareState();
  return observeKqCareStage(state, situation);
}
const finishStage = (state: KqGameState, dice: [number, number, number]) => resolveKqStage({ ...state, phase: "rolled", dice });

describe("persistent culture care v3", () => {
  it("starts new rules, removes replaced cards and preserves explicit historical rules", () => {
    const current = startKqGame(15, { deckCodes: ["BOTTE-004", "BOTTE-003", "BOTTE-025"] });
    expect(current.rulesVersion).toBe(3);
    expect(current.deckCodes).toEqual(["BOTTE-003"]);
    expect(current.care?.vitality).toBe(100);
    expect(canPlayKqCard(current, KQ_CARDS.find(card => card.code === "BOTTE-004")!).allowed).toBe(false);
    expect(startKqGame(15, { rulesVersion: 2, deckCodes: ["BOTTE-004"] }).care).toBeUndefined();
    expect(startKqGame(15, { rulesVersion: 2, deckCodes: ["BOTTE-004"] }).deckCodes).toEqual(["BOTTE-004"]);
  });

  it("keeps two zero-success stages alive while vitality remains, unlike v2", () => {
    let current = startKqGame(101);
    current = advanceKqStage(finishStage(current, [2, 2, 2]));
    current = finishStage(current, [2, 2, 2]);
    expect(current.phase).toBe("resolved");
    expect(current.care!.vitality).toBeGreaterThan(0);
    expect(parseKqGameSave(encodeKqSave(current))).toEqual(current);
    let historical = startKqGame(101, { rulesVersion: 2 });
    historical = advanceKqStage(finishStage(historical, [2, 2, 2]));
    expect(finishStage(historical, [2, 2, 2]).cultureDead).toBe(true);
  });

  it("makes reading idempotent and keeps installation delayed until an operation resolves", () => {
    const state = position();
    const situation = KQ_SITUATIONS.find(item => item.code === "SIT-003")!;
    expect(observeKqCareStage(state, situation)).toBe(state);
    const applied = applyKqCareProduct(state, "CARE-APHIDIUS");
    expect(applied.care?.vitality).toBe(state.care?.vitality);
    expect(applied.care?.problems).toEqual(state.care?.problems);
    expect(applied.care?.interventions[0].status).toBe("installing");
    expect(applyKqCareProduct(applied, "CARE-APHIDIUS")).toBe(applied);
    expect(canApplyKqCareProduct(applied, "CARE-COCCINELLA").allowed).toBe(false);
    expect(canApplyKqCareProduct(state, "CARE-PHYTOSEIULUS").allowed).toBe(false);
    const resolved = finishStage(applied, [2, 2, 2]);
    expect(resolved.care?.problems[0].severity).toBe(1);
    expect(resolved.care?.problems[0].trend).toBe("stable");
    expect(resolved.care?.interventions[0].status).toBe("active");
    const next = finishStage(advanceKqStage(resolved), [2, 2, 2]);
    expect(next.care?.problems.some(item => item.code === "APHIDS")).toBe(false);
    expect(resolved.combos).toContain("PBI ciblée");
    expect(resolved.dice).toEqual([2, 2, 2]);
  });

  it("lets an activated care decision reduce damage on the same failed dice", () => {
    const state = position();
    state.care!.problems = [problem("APHIDS", 2)];
    const supported = performKqBasicCare(state);
    expect(performKqBasicCare(supported)).toBe(supported);
    expect(finishStage(supported, [2, 2, 2]).care!.vitality).toBeGreaterThan(finishStage(state, [2, 2, 2]).care!.vitality);
  });

  it("limits compatible organic inputs and preserves lasting losses after recovery", () => {
    const state = position("SIT-004");
    state.care!.problems = [problem("NITROGEN", 2)];
    state.care!.yieldLossPercent = 8;
    const applied = applyKqCareProduct(state, "CARE-ORGANIC-FEED");
    expect(canApplyKqCareProduct(applied, "CARE-SEAWEED").allowed).toBe(false);
    const resolved = finishStage(applied, [6, 6, 6]);
    expect(resolved.care!.yieldBonusPercent).toBe(5);
    expect(resolved.care!.yieldLossPercent).toBe(8);
    const salty = { ...state, care: { ...state.care!, problems: [problem("SALTS")] } };
    expect(canApplyKqCareProduct(salty, "CARE-ORGANIC-FEED").allowed).toBe(false);
    const baseline = { ...resolved, care: { ...resolved.care!, yieldBonusPercent: 0 } };
    expect(getKqRunProjection(resolved).harvestGrams).toBeGreaterThan(getKqRunProjection(baseline).harvestGrams);
    expect(getKqRunProjection(resolved).harvestGrams).toBeLessThanOrEqual(getKqRunProjection(baseline).harvestGrams * 1.101);
  });

  it("does not attribute biological damage or terpene penalties to administrative and theft events", () => {
    for (const code of ["SIT-024", "SIT-027", "SIT-048"]) {
      const state = position(code);
      state.care = createKqCareState();
      const after = finishStage(state, [2, 2, 2]);
      expect(after.care?.vitality).toBe(100);
      expect(after.care?.terpenes).toBe(55);
      expect(after.care?.yieldLossPercent).toBe(0);
    }
  });

  it("preserves terpene contributions separately and makes relevant operation choices count", () => {
    const state = position("SIT-006");
    const plain = finishStage(state, [6, 6, 6]);
    const skilled = finishStage({ ...state, playedThisStage: ["BOTTE-016"] }, [6, 6, 6]);
    expect(skilled.care!.terpenes - plain.care!.terpenes).toBe(2);
    expect(finishStage(state, [2, 2, 2]).care!.terpenes).toBeLessThan(55);
    expect(finishStage(state, [2, 2, 2]).care!.vitality).toBe(state.care!.vitality);
    expect(finishStage(state, [2, 2, 2]).care!.yieldLossPercent).toBe(state.care!.yieldLossPercent);
    expect(canApplyKqCareProduct(state, "CARE-SEAWEED").allowed).toBe(false);
  });

  it("retains accumulated explicit problems within the five-problem bound and varies observations", () => {
    const observed = new Set<string>();
    for (let seed = 1; seed < 200; seed++) {
      let state = startKqGame(seed);
      for (let stage = 0; stage < 5; stage++) {
        expect(state.care!.problems.length).toBeLessThanOrEqual(5);
        state.care!.problems.forEach(item => observed.add(item.code));
        state = advanceKqStage(finishStage(state, [6, 6, 6]));
      }
    }
    expect(observed.size).toBeGreaterThanOrEqual(10);
  });

  it("validates v3 saves, binds health to integrity and rejects forged care payloads", () => {
    const state = performKqBasicCare(startKqGame(42));
    expect(parseKqGameSave(encodeKqSave(state))).toEqual(state);
    expect(createKqIntegrityCode(state)).not.toBe(createKqIntegrityCode({ ...state, care: { ...state.care!, terpenes: 90 } }));
    for (const patch of [{ vitality: 101 }, { terpenes: 100 }, { cannabinoidExpression: 100 }, { cannabinoidExpression: undefined }, { yieldBonusPercent: 11 }, { problems: [problem("ALIEN")] }, { interventions: [{ productCode: "CARE-APHIDIUS", stageIndex: 0, status: "active", remainingSteps: 2 }] }]) {
      expect(parseKqGameSave(encodeKqSave({ ...state, care: { ...state.care, ...patch } }))).toBeNull();
    }
    expect(parseKqGameSave(encodeKqSave({ ...state, care: undefined }))).toBeNull();
    expect(isKqCareState(createKqCareState())).toBe(true);
  });

  it("replays decision snapshots with the health state at validation, including later interventions", () => {
    let state = performKqBasicCare(startKqGame(87));
    state = finishStage(state, [6, 6, 6]);
    state = applyKqCareProduct(state, "CARE-SEAWEED");
    const restored = parseKqGameSave(encodeKqSave(state))!;
    expect(restored).not.toBeNull();
    const analysis = getKqCultureAnalysis(restored);
    expect(analysis.coverage).toBe("detailed");
    expect(analysis.stages[0].evidence.some(item => item.includes("Expression des terpènes"))).toBe(true);
  });

  it("ends exhausted cultures and gives an eligible first culture exactly one vitality rescue", () => {
    const state = startKqGame(18);
    state.care!.vitality = 1;
    const dead = finishStage(state, [2, 2, 2]);
    expect(dead.cultureDead).toBe(true);
    expect(parseKqGameSave(encodeKqSave(dead))).toEqual(dead);
    const rescued = finishStage({ ...state, firstCultureRescue: true }, [2, 2, 2]);
    expect(rescued.care!.vitality).toBe(15);
    expect(rescued.history[0].rescued).toBe(true);
    expect(parseKqGameSave(encodeKqSave(rescued))).toEqual(rescued);
    const next = advanceKqStage(rescued);
    next.care!.vitality = 1;
    expect(finishStage(next, [2, 2, 2]).cultureDead).toBe(true);
  });

  it("finishes a complete v3 culture with reloadable health and full analysis", () => {
    let state = startKqGame(231);
    for (let index = 0; index < 6; index++) {
      state = advanceKqStage(finishStage(performKqBasicCare(state), [6, 6, 6]));
      expect(parseKqGameSave(encodeKqSave(state))).toEqual(state);
    }
    expect(state.phase).toBe("complete");
    expect(getKqCultureAnalysis(state).coverage).toBe("detailed");
  });

  it("does not give a benefit when an input has no compatible observation", () => {
    const state = position("SIT-003");
    const applied = applyKqCareProduct(state, "CARE-ORGANIC-FEED");
    const situation = KQ_SITUATIONS.find(item => item.code === "SIT-003")!;
    expect(resolveKqCareStage(applied, situation, "success", false)?.yieldBonusPercent).toBe(0);
  });

  it("assigns an explicitly fictional stable profile to a variety, independent of the run", () => {
    const first = startKqGame(11, { varietyCode: "HH2026-020" });
    const second = startKqGame(982, { varietyCode: "HH2026-020" });
    expect(getKqCannabinoidReport(first).profile).toEqual(getKqCannabinoidReport(second).profile);
    expect(getKqCannabinoidProfile(first.varietyCode).name).toContain("fictif");
    expect(getKqCannabinoidReport(first).simulated).toBe(true);
    const profiles = new Set(Array.from({ length: 52 }, (_, index) => getKqCannabinoidProfile(`HH2026-${String(index + 1).padStart(3, "0")}`).code));
    expect(profiles.size).toBeGreaterThanOrEqual(3);
    const edited = getKqCannabinoidProfile(first.varietyCode);
    edited.targets.cbd = 999;
    expect(getKqCannabinoidProfile(first.varietyCode).targets.cbd).not.toBe(999);
  });

  it("reports bounded simulated rates and evaluates expression rather than raw THC", () => {
    const state = startKqGame(11);
    for (const score of [35, 55, 99]) {
      state.care!.cannabinoidExpression = score;
      const report = getKqCannabinoidReport(state);
      expect(report.score).toBe(score);
      for (const code of ["cbd", "cbg", "thc"] as const) {
        expect(report.totals[code]).toBeCloseTo(report.profile.targets[code] * score / 99, 3);
        expect(report.rates[code]).toBeLessThanOrEqual(report.profile.targets[code]);
      }
    }
    const other = { ...state, varietyCode: "HH2026-027" };
    expect(getKqCannabinoidReport(other).score).toBe(getKqCannabinoidReport(state).score);
  });

  it("develops cannabinoid expression only in the final operations, independently of input quantity", () => {
    expect(finishStage(position("SIT-003"), [6, 6, 6]).care!.cannabinoidExpression).toBe(55);
    const state = position("SIT-004");
    state.care!.problems = [problem("NITROGEN")];
    const plain = finishStage(state, [6, 6, 6]);
    const fertilized = finishStage(applyKqCareProduct(state, "CARE-ORGANIC-FEED"), [6, 6, 6]);
    expect(plain.care!.cannabinoidExpression).toBeGreaterThan(55);
    expect(fertilized.care!.cannabinoidExpression).toBe(plain.care!.cannabinoidExpression);
    expect(fertilized.care!.yieldBonusPercent).toBeGreaterThan(plain.care!.yieldBonusPercent);
    expect(finishStage(position("SIT-048"), [2, 2, 2]).care!.cannabinoidExpression).toBe(55);
    expect(finishStage(position("SIT-006"), [2, 2, 2]).care!.cannabinoidExpression).toBeLessThan(55);
  });

  it("binds the cannabinoid expression and its contribution to saved decisions and integrity", () => {
    let state = startKqGame(231);
    for (let index = 0; index < 4; index++) state = advanceKqStage(finishStage(state, [6, 6, 6]));
    expect(parseKqGameSave(encodeKqSave(state))).toEqual(state);
    expect(state.history[3].decision!.care!.cannabinoidExpression).toBe(55);
    expect(state.care!.history.find(item => item.kind === "resolution" && item.stageIndex === 3)?.cannabinoidDelta).toBe(20);
    expect(createKqIntegrityCode(state)).not.toBe(createKqIntegrityCode({ ...state, care: { ...state.care!, cannabinoidExpression: 90 } }));
    expect(getKqCultureAnalysis(state).coverage).toBe("detailed");
  });

  it("reports 14 compounds and seven calculated potentials without counting totals as extra molecules", () => {
    const report = getKqCannabinoidReport(startKqGame(19));
    expect(Object.keys(report.rates)).toHaveLength(14);
    expect(Object.keys(report.totals)).toHaveLength(7);
    for (const family of KQ_CANNABINOID_FAMILIES) {
      expect(report.totals[family.code]).toBeCloseTo(report.rates[family.neutralCode] + family.acidFactor * report.rates[family.acidCode], 3);
    }
    expect(report.rates.cbda).toBeGreaterThan(report.rates.cbd);
    expect(report.rates.thca).toBeGreaterThan(report.rates.thc);
  });

  it("redistributes acid and neutral forms during drying without creating potential", () => {
    const state = position("SIT-006");
    const before = getKqCannabinoidReport(state);
    const result = finishStage(state, [6, 6, 6]);
    const after = getKqCannabinoidReport(result);
    expect(after.score).toBe(before.score);
    expect(after.rates.cbd).toBeGreaterThan(before.rates.cbd);
    expect(after.rates.cbda).toBeLessThan(before.rates.cbda);
    expect(after.totals.cbd).toBeCloseTo(before.totals.cbd, 3);
    expect(after.totals.thc).toBeCloseTo(before.totals.thc, 3);
    expect(after.totals.cbn).toBe(0);
  });

  it("allows CBN to rise with aging while the quality score decreases", () => {
    const state = position("SIT-006");
    const before = getKqCannabinoidReport(state);
    const after = getKqCannabinoidReport(finishStage(state, [2, 2, 2]));
    expect(after.totals.cbn).toBeGreaterThan(before.totals.cbn);
    expect(after.rates.cbn).toBeGreaterThan(before.rates.cbn);
    expect(after.rates.cbna).toBeGreaterThan(before.rates.cbna);
    expect(after.totals.thc).toBeLessThan(before.totals.thc);
    expect(after.score).toBeLessThan(before.score);
    expect(Object.values(after.totals).reduce((sum, amount) => sum + amount, 0)).toBeLessThan(Object.values(before.totals).reduce((sum, amount) => sum + amount, 0));
  });

  it("rejects impossible conversion or oxidation states", () => {
    const state = startKqGame(12);
    for (const patch of [{ cannabinoidConversion: 21 }, { cannabinoidConversion: -1 }, { cannabinoidOxidation: NaN }, { cannabinoidOxidation: 21 }]) {
      expect(parseKqGameSave(encodeKqSave({ ...state, care: { ...state.care, ...patch } }))).toBeNull();
    }
  });

  it("can reach full expression through two perfect relevant operations without creating potential at drying", () => {
    let state = position("SIT-004");
    state = finishStage({ ...state, playedThisStage: ["BOTTE-026"] }, [6, 6, 6]);
    expect(state.care!.cannabinoidExpression).toBe(77);
    state = advanceKqStage(state);
    state.situationCodes[4] = "SIT-005";
    state = finishStage({ ...state, playedThisStage: ["BOTTE-032"] }, [6, 6, 6]);
    expect(state.care!.cannabinoidExpression).toBe(99);
    const harvested = getKqCannabinoidReport(state);
    state = advanceKqStage(state);
    state.situationCodes[5] = "SIT-006";
    state = finishStage({ ...state, playedThisStage: ["BOTTE-016"] }, [6, 6, 6]);
    const dried = getKqCannabinoidReport(state);
    expect(dried.score).toBe(99);
    expect(dried.totals.cbd).toBeCloseTo(dried.profile.targets.cbd, 3);
    expect(dried.totals.cbd).toBeCloseTo(harvested.totals.cbd, 3);
  });
});
