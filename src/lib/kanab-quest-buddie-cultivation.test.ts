import { describe, expect, it } from "vitest";
import { applyKqBuddieYield, getKqBuddieCultivationProfile, isKqBuddieCultivationProfile } from "./kanab-quest-buddie-cultivation";
import { advanceKqStage, getKqHarvestBreakdown, getKqRunProjection, KQ_BUDDIES, resolveKqStage, rollKqDice, startKqGame, type KqGameState } from "./kanab-quest-game";
import { getKqCannabinoidReport, getKqTerpeneReport } from "./kanab-quest-care";
import { createKqFlower } from "./kanab-quest-battle";
import { createKqIntegrityCode, encodeKqSave, parseKqGameSave } from "./kanab-quest-persistence";
import { createKqWarehouseStarter, getKqWarehouseRunSnapshot } from "./kanab-quest-warehouse";
import { getKqCampaignParticipants, type KqCampaign } from "./kanab-quest-campaign";

function finish(initial: KqGameState) {
  let state = initial;
  while (state.phase !== "complete") state = advanceKqStage(resolveKqStage({ ...state, phase: "rolled", dice: [6, 6, 6] }));
  return state;
}
function room() {
  const state = createKqWarehouseStarter();
  state.zones[0].buddieCode = "HH2026-003";
  return getKqWarehouseRunSnapshot(state, 4, state.zones[0].id);
}
const profile = () => getKqBuddieCultivationProfile("HH2026-003");

describe("frozen fictional Buddie profiles", () => {
  it("covers all 52 identities with bounded distinct results and catalogue rarities", () => {
    const profiles = KQ_BUDDIES.map(buddie => getKqBuddieCultivationProfile(buddie.code));
    expect(profiles).toHaveLength(52);
    expect(new Set(profiles.map(item => JSON.stringify([item.yieldFactor, item.cannabinoidTargets, item.terpenePotentialPercent]))).size).toBe(52);
    for (const [index, item] of profiles.entries()) {
      expect(item.rarity).toBe(KQ_BUDDIES[index].rarity);
      expect(isKqBuddieCultivationProfile(item)).toBe(true);
      expect(item.yieldFactor).toBeGreaterThanOrEqual(0.8);
      expect(item.yieldFactor).toBeLessThanOrEqual(1);
      expect(item.terpenePotentialPercent).toBeGreaterThan(0);
      expect(item.terpenePotentialPercent).toBeLessThan(3.1);
      expect(item.terpeneNotes[0]).not.toBe(item.terpeneNotes[1]);
    }
  });

  it("keeps quantity and expression as genuine alternatives at every rarity", () => {
    const profiles = KQ_BUDDIES.map(buddie => getKqBuddieCultivationProfile(buddie.code));
    const yields = profiles.filter(item => item.archetype === "yield");
    const balanced = profiles.filter(item => item.archetype === "balanced");
    const expression = profiles.filter(item => item.archetype === "expression");
    expect(Math.min(...yields.map(item => item.yieldFactor))).toBeGreaterThan(Math.max(...balanced.map(item => item.yieldFactor)));
    expect(Math.min(...balanced.map(item => item.yieldFactor))).toBeGreaterThan(Math.max(...expression.map(item => item.yieldFactor)));
    expect(Math.max(...yields.map(item => item.terpenePotentialPercent))).toBeLessThan(Math.min(...balanced.map(item => item.terpenePotentialPercent)));
    expect(Math.max(...balanced.map(item => item.terpenePotentialPercent))).toBeLessThan(Math.min(...expression.map(item => item.terpenePotentialPercent)));
    // A legendary quantity profile does not overtake common expression profiles.
    expect(profiles[0].terpenePotentialPercent).toBeLessThan(profiles[20].terpenePotentialPercent);
  });

  it("returns isolated snapshots and rejects fabricated identities or stronger values", () => {
    const altered = profile();
    altered.cannabinoidTargets.cbd = 90;
    altered.terpeneNotes[0] = "Changed";
    expect(profile().cannabinoidTargets.cbd).not.toBe(90);
    expect(isKqBuddieCultivationProfile(altered)).toBe(false);
    expect(isKqBuddieCultivationProfile({ ...profile(), yieldFactor: 1.1 })).toBe(false);
    expect(isKqBuddieCultivationProfile({ ...profile(), version: 2 })).toBe(false);
    for (const code of ["HH2026-000", "HH2026-053", "unknown"]) expect(() => getKqBuddieCultivationProfile(code)).toThrow();
  });

  it("requires explicit activation, freezes the profile, and leaves shared dice and care untouched", () => {
    const legacy = startKqGame(94, { varietyCode: "HH2026-003" });
    expect(legacy.cultivationProfile).toBeUndefined();
    const selected = profile();
    const current = startKqGame(94, { varietyCode: selected.buddieCode, cultivationProfile: selected });
    selected.yieldFactor = 0.1;
    expect(current.cultivationProfile).toEqual(profile());
    const { cultivationProfile: saved, ...withoutProfile } = current;
    expect(saved).toBeDefined();
    expect(withoutProfile).toEqual(legacy);
    expect(rollKqDice(current).dice).toEqual(rollKqDice(legacy).dice);
    const completed = finish(current), historical = finish(legacy);
    expect(completed.history).toEqual(historical.history);
    expect(completed.care).toEqual(historical.care);
    expect(completed.xp).toBe(historical.xp);
    expect(() => startKqGame(94, { varietyCode: "HH2026-004", cultivationProfile: profile() })).toThrow();
    expect(() => startKqGame(94, { rulesVersion: 2, varietyCode: "HH2026-003", cultivationProfile: profile() })).toThrow();
  });

  it("reduces final quantity once while respecting room reservations and energy receipts", () => {
    const warehouse = room();
    const legacy = finish(startKqGame(94, { varietyCode: "HH2026-003", warehouse }));
    const current = finish(startKqGame(94, { varietyCode: "HH2026-003", warehouse, cultivationProfile: profile() }));
    expect(current.harvestGrams).toBe(applyKqBuddieYield(legacy.harvestGrams!, profile()));
    expect(current.harvestGrams).toBeLessThanOrEqual(warehouse.estimatedHarvestGrams);
    expect(current.energy).toEqual(legacy.energy);
    expect(getKqRunProjection(current).harvestGrams).toBe(current.harvestGrams);
    expect(getKqHarvestBreakdown(current)).toMatchObject({ energyAdjustmentGrams: 0,
      cultivationAdjustmentGrams: Math.round((current.harvestGrams! - legacy.harvestGrams!) * 10) / 10 });
    expect(getKqRunProjection(parseKqGameSave(encodeKqSave(current))!).harvestGrams).toBe(current.harvestGrams);
    expect(parseKqGameSave(encodeKqSave({ ...current, harvestGrams: warehouse.estimatedHarvestGrams }))).toBeNull();
  });

  it("keeps dead campaigns empty regardless of profile potential", () => {
    const initial = startKqGame(94, { varietyCode: "HH2026-003", warehouse: room(), cultivationProfile: profile() });
    initial.care!.vitality = 1;
    const dead = resolveKqStage({ ...initial, phase: "rolled", dice: [1, 1, 1] });
    expect(dead.harvestGrams).toBe(0);
    expect(getKqHarvestBreakdown(dead).cultivationAdjustmentGrams).toBe(0);
    expect(() => createKqFlower(dead)).toThrow();
  });

  it("changes simulated reports without changing the common expression score", () => {
    const shared = startKqGame(94);
    const reports = ["HH2026-001", "HH2026-002", "HH2026-003"].map(code => {
      const state = { ...shared, varietyCode: code, cultivationProfile: getKqBuddieCultivationProfile(code) };
      const cannabinoids = getKqCannabinoidReport(state), terpenes = getKqTerpeneReport(state)!;
      expect(cannabinoids.score).toBe(shared.care!.cannabinoidExpression);
      expect(terpenes.score).toBe(shared.care!.terpenes);
      expect(terpenes.totalPercent).toBeLessThanOrEqual(terpenes.potentialPercent);
      expect(terpenes.simulated).toBe(true);
      return [cannabinoids.totals, terpenes.totalPercent];
    });
    expect(new Set(reports.map(item => JSON.stringify(item))).size).toBe(3);
    expect(getKqTerpeneReport(shared)).toBeUndefined();
    const profiled = { ...shared, cultivationProfile: profile() };
    const perfect = getKqTerpeneReport({ ...profiled, care: { ...shared.care!, terpenes: 99 } })!;
    expect(perfect.totalPercent).toBe(profile().terpenePotentialPercent);
  });

  it("gives shared-dice flowers distinct identities and retains frozen reports", () => {
    const completed = finish(startKqGame(94));
    const first = { ...completed, varietyCode: "HH2026-003", cultivationProfile: profile() };
    const second = { ...completed, varietyCode: "HH2026-004", cultivationProfile: getKqBuddieCultivationProfile("HH2026-004") };
    const flower = createKqFlower(first);
    expect(flower.id).not.toBe(createKqFlower(second).id);
    expect(flower.cultivationProfile).toEqual(profile());
    expect(flower.terpeneReport).toEqual(getKqTerpeneReport(first));
    expect(flower.cannabinoidReport).toEqual(getKqCannabinoidReport(first));
    first.cultivationProfile.terpenePotentialPercent = 90;
    expect(flower.cultivationProfile?.terpenePotentialPercent).not.toBe(90);
    expect(createKqFlower(completed).terpeneReport).toBeUndefined();
    expect(createKqFlower(completed).cultivationProfile).toBeUndefined();
  });

  it("validates and signs profile snapshots without changing legacy save contents", () => {
    const initial = startKqGame(94, { varietyCode: "HH2026-003", cultivationProfile: profile() });
    expect(parseKqGameSave(encodeKqSave(initial))).toEqual(initial);
    expect(createKqIntegrityCode(initial)).not.toBe(createKqIntegrityCode(startKqGame(94, { varietyCode: "HH2026-003" })));
    expect(parseKqGameSave(encodeKqSave({ ...initial, cultivationProfile: { ...profile(), yieldFactor: 1 } }))).toBeNull();
    expect(parseKqGameSave(encodeKqSave({ ...initial, cultivationProfile: getKqBuddieCultivationProfile("HH2026-004") }))).toBeNull();
  });

  it("checks the current run against the immutable campaign membership", () => {
    const warehouse = room();
    const runId = "40000000-0000-4000-8000-000000000001";
    const campaign: KqCampaign = { version: 1, id: "40000000-0000-4000-8000-000000000002", leaderRunId: runId,
      members: getKqCampaignParticipants(warehouse.sourceState, warehouse.revision).map(item => ({ ...item, runId })) };
    const initial = { ...startKqGame(94, { varietyCode: "HH2026-003", warehouse, cultivationProfile: profile() }), campaign };
    expect(parseKqGameSave(encodeKqSave(initial))).toEqual(initial);
    const wrong = structuredClone(initial);
    wrong.campaign.members[0].buddieCode = "HH2026-004";
    expect(parseKqGameSave(encodeKqSave(wrong))).toBeNull();
    expect(createKqIntegrityCode(initial)).not.toBe(createKqIntegrityCode({ ...initial, campaign: undefined }));
  });
});
