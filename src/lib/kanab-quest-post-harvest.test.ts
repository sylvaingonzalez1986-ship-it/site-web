import { describe, expect, it } from "vitest";
import { createKqCareState } from "./kanab-quest-care";
import { KQ_GAME_DAY_MS } from "./kanab-quest-business";
import { getKqPostHarvestDeviceBenefits, getKqPostHarvestTierBenefits, getKqWarehousePostHarvestProfile, getKqWarehouseRunPostHarvestProfile } from "./kanab-quest-post-harvest";
import { createKqWarehouseStarter, getKqWarehouseEquipmentDemand, getKqWarehouseQuote, getKqWarehouseRunSnapshot, getKqWarehouseSummary, isKqWarehouseRunSnapshot, validateKqWarehouseState, type KqWarehouseState } from "./kanab-quest-warehouse";
import { changeKqStorageCapacity, changeKqStoragePostHarvest, createKqStorageLot, getKqStorageExposureRates, isKqStorageLot, KQ_CURING_DURATION_MS, planKqStorageAllocation, projectKqStorageLot, settleKqStorageLot } from "./kanab-quest-storage";
import { getKqWarehouseProductArtwork } from "./kanab-quest-warehouse-product-artwork";

const origin = Date.parse("2026-10-18T12:00:00Z");
const premium = { dryingQualityBonus: .4, storageQualityBonus: .3, climateQualityBonus: .3, aromaRateFactor: 42, chemistryRateFactor: 42 };
const baseline = { varietyCode: "KANAB-001", juryScore: 8, aroma: 92, care: createKqCareState() };
const newLot = (withProfile = true, capacity = planKqStorageAllocation({ totalUnits: 500, ownedContainers: { "GLASS-1L": 1 }, nowMs: origin })) => createKqStorageLot({
  flowerId: "lot-test", harvestedAt: new Date(origin).toISOString(), baseline, capacity,
  ...(withProfile ? { postHarvest: premium } : {}),
});

describe("separate post-harvest room quality", () => {
  it("weights installed quality by capacity and excludes devices left in reserve", () => {
    const starter = createKqWarehouseStarter();
    const plan: KqWarehouseState = { ...starter, serviceZones: [
      { id: "dry-basic", name: "Basic", x: 1, y: 8, width: 1, height: 1, kind: "drying", deviceCode: "SJ-DRYIT90" },
      { id: "dry-pro", name: "Pro", x: 3, y: 8, width: 1, height: 1, kind: "drying", deviceCode: "SIM-DRYING-03" },
      { id: "storage", name: "Storage", x: 6, y: 8, width: 1, height: 1, kind: "storage", deviceCode: "BROR-JARS-48" },
    ], storageClimateCode: "SIM-STORAGE-CLIMATE-02", equipment: [...starter.equipment, { code: "SIM-DRYING-03", quantity: 200 }, { code: "SIM-STORAGE-CLIMATE-03", quantity: 10 }] };
    expect(getKqWarehousePostHarvestProfile(plan)).toEqual({ dryingQualityBonus: .6, storageQualityBonus: .3, climateQualityBonus: .25, aromaRateFactor: 57, chemistryRateFactor: 57 });
    expect(getKqWarehousePostHarvestProfile(plan, 1)).toEqual({ dryingQualityBonus: .34, storageQualityBonus: .15, climateQualityBonus: .2, aromaRateFactor: 64, chemistryRateFactor: 64 });
    expect(getKqWarehousePostHarvestProfile({ ...starter, serviceZones: [] })).toEqual({ dryingQualityBonus: 0, storageQualityBonus: 0, climateQualityBonus: 0, aromaRateFactor: 100, chemistryRateFactor: 100 });
    expect(getKqPostHarvestDeviceBenefits("CURTEC-60L")).toEqual({ qualityBonus: .6, retentionPercent: 45 });
  });

  it("funds one selected climate unit, keeps replaced equipment and rejects invalid placement", () => {
    const starter = createKqWarehouseStarter();
    const quote = getKqWarehouseQuote({ ...starter, storageClimateCode: "SIM-STORAGE-CLIMATE-01" }, starter);
    expect(quote.totalCostCents).toBe(57_385);
    expect(quote.purchases).toMatchObject([{ code: "SIM-STORAGE-CLIMATE-01", quantity: 1 }]);
    expect(getKqWarehouseEquipmentDemand(quote.nextState.zones, quote.nextState.serviceZones, quote.nextState.storageClimateCode)).toContainEqual({ code: "SIM-STORAGE-CLIMATE-01", quantity: 1 });
    const upgrade = getKqWarehouseQuote({ ...quote.nextState, storageClimateCode: "SIM-STORAGE-CLIMATE-03" }, quote.nextState);
    expect(upgrade.nextState.equipment).toContainEqual({ code: "SIM-STORAGE-CLIMATE-01", quantity: 1 });
    expect(getKqWarehouseSummary(upgrade.nextState).reserve).toContainEqual({ code: "SIM-STORAGE-CLIMATE-01", quantity: 1 });
    expect(getKqWarehouseQuote({ ...upgrade.nextState, storageClimateCode: "SIM-STORAGE-CLIMATE-01" }, upgrade.nextState).totalCostCents).toBe(0);
    expect(validateKqWarehouseState({ ...starter, storageClimateCode: "MH-TS1000" })).not.toEqual([]);
    expect(validateKqWarehouseState({ ...starter, storageClimateCode: "SIM-STORAGE-CLIMATE-01", serviceZones: [] })).not.toEqual([]);
    expect(() => getKqWarehouseRunSnapshot({ ...starter, storageClimateCode: "SIM-STORAGE-CLIMATE-01" })).toThrow("financé");
    expect(getKqWarehouseProductArtwork("SIM-STORAGE-CLIMATE-03")?.src).toBe("/placard/equipment-sylvain-v1/climate-3.webp");
  });

  it("rounds the exact mixed-room half-centipoint like PostgreSQL", () => {
    const starter = createKqWarehouseStarter();
    const profile = getKqWarehousePostHarvestProfile({ ...starter, serviceZones: [
      { id: "standard", name: "Standard", x: 0, y: 7, width: 5, height: 1, kind: "storage", deviceCode: "BROR-JARS-48" },
      { id: "premium", name: "Premium", x: 0, y: 8, width: 9, height: 1, kind: "storage", deviceCode: "CURTEC-60L" },
    ] }, 1);
    // (12,000 × 15 + 108,000 × 30) / 120,000 = exactly 28.5 centipoints.
    expect(profile.storageQualityBonus).toBe(.29);
    const current = getKqWarehousePostHarvestProfile({ ...starter, serviceZones: [
      { id: "standard", name: "Standard", x: 0, y: 7, width: 7, height: 1, kind: "storage", deviceCode: "BROR-JARS-48" },
      { id: "premium", name: "Premium", x: 0, y: 8, width: 1, height: 1, kind: "storage", deviceCode: "CURTEC-60L" },
    ] });
    // (16,800 × 30 + 12,000 × 60) / 28,800 = exactly 42.5 centipoints.
    expect(current.storageQualityBonus).toBe(.43);
  });

  it("keeps monthly climate out of new cycles and preserves earlier run snapshots", () => {
    const starter = createKqWarehouseStarter();
    const historical = getKqWarehouseRunSnapshot(starter);
    const base = getKqWarehouseQuote({ ...starter, zones: [starter.zones[0], { ...starter.zones[0], id: "second", x: 3, width: 2 }] }, starter).nextState;
    const equipped = getKqWarehouseQuote({ ...base, storageClimateCode: "SIM-STORAGE-CLIMATE-01" }, base).nextState;
    const total = getKqWarehouseSummary(equipped), a = getKqWarehouseRunSnapshot(equipped, 1, "starter"), b = getKqWarehouseRunSnapshot(equipped, 1, "second");
    expect(total.energyKwh).toBe(getKqWarehouseSummary(base).energyKwh);
    expect(a.powerWatts).toBe(getKqWarehouseRunSnapshot(base, 1, "starter").powerWatts);
    expect(b.powerWatts).toBe(getKqWarehouseRunSnapshot(base, 1, "second").powerWatts);
    expect(a.energyKwh + b.energyKwh).toBeCloseTo(total.energyKwh);
    expect(a.energyCostCents + b.energyCostCents).toBe(total.energyCostCents);
    expect(isKqWarehouseRunSnapshot(historical)).toBe(true);
    expect(isKqWarehouseRunSnapshot(a)).toBe(true);
    const legacy = getKqWarehouseRunSnapshot(equipped, 1, "starter", 2, 1);
    expect(legacy.climateBillingVersion).toBeUndefined();
    expect(legacy.powerWatts - a.powerWatts).toBe(40);
    expect(legacy.energyKwh - a.energyKwh).toBeCloseTo(57.6);
    expect(isKqWarehouseRunSnapshot(legacy)).toBe(true);
    expect(isKqWarehouseRunSnapshot({ ...legacy, climateBillingVersion: 2 })).toBe(false);
  });
});

describe("earned commercial quality during curing", () => {
  it("applies drying once and gradually earns curing up to the exact ready timestamp", () => {
    const lot = newLot();
    expect(projectKqStorageLot(lot, origin)).toMatchObject({ conditionScore: 8.4, postHarvest: { dryingQualityBonus: .4, curingQualityBonus: 0 } });
    expect(projectKqStorageLot(lot, origin + KQ_CURING_DURATION_MS / 2)).toMatchObject({ conditionScore: 8.7, postHarvest: { curingQualityBonus: .3 } });
    expect(projectKqStorageLot(lot, origin + KQ_CURING_DURATION_MS)).toMatchObject({ stage: "ready", conditionScore: 9, qualityDelta: 1, postHarvest: { curingQualityBonus: .6 } });
    expect(projectKqStorageLot(lot, origin + KQ_CURING_DURATION_MS * 2).postHarvest?.curingQualityBonus).toBe(.6);
    expect(lot.baseline.juryScore).toBe(8);
    expect(projectKqStorageLot(lot, origin + KQ_CURING_DURATION_MS, 9.8)).toMatchObject({ conditionScore: 10, qualityDelta: .2 });
  });

  it("earns better container quality without giving overflow the room protection", () => {
    const capacity = planKqStorageAllocation({ totalUnits: 1000, ownedContainers: { "BOVEDA-1L": 1 }, nowMs: origin });
    const halfProtected = newLot(true, capacity);
    expect(halfProtected.postHarvest?.containerQualityBonus).toBe(.08);
    expect(getKqStorageExposureRates(halfProtected)).toEqual({ aromaRate: 63, chemistryRate: 64 });
    expect(projectKqStorageLot(halfProtected, origin + KQ_CURING_DURATION_MS).postHarvest?.curingQualityBonus).toBe(.38);
    const empty = newLot(true, { ...capacity, allocations: [] });
    expect(getKqStorageExposureRates(empty)).toEqual({ aromaRate: 100, chemistryRate: 100 });
    expect(projectKqStorageLot(empty, origin + KQ_CURING_DURATION_MS).postHarvest?.curingQualityBonus).toBe(0);
    const filled = changeKqStorageCapacity(empty, capacity, origin + KQ_CURING_DURATION_MS / 2);
    expect(projectKqStorageLot(filled, origin + KQ_CURING_DURATION_MS).postHarvest?.curingQualityBonus).toBe(.19);
  });

  it("does not retroactively award drying or elapsed curing when upgrading old lots", () => {
    const original = newLot(false), half = origin + KQ_CURING_DURATION_MS / 2;
    const upgraded = changeKqStoragePostHarvest(original, premium, half);
    expect(upgraded.postHarvest).toMatchObject({ dryingQualityBonus: 0, curingBonusWeightedMs: 0 });
    expect(projectKqStorageLot(upgraded, half).conditionScore).toBe(projectKqStorageLot(original, half).conditionScore);
    expect(projectKqStorageLot(upgraded, origin + KQ_CURING_DURATION_MS).postHarvest?.curingQualityBonus).toBe(.3);
    const tooLate = changeKqStoragePostHarvest(original, premium, origin + KQ_CURING_DURATION_MS * 2);
    expect(projectKqStorageLot(tooLate, origin + KQ_CURING_DURATION_MS * 3).postHarvest?.qualityBonus).toBe(0);
  });

  it("rounds partially protected container bonuses before accumulating curing", () => {
    const lot = newLot(true, { totalUnits: 30_000,
      allocations: [{ containerCode: "BOVEDA-1L", quantity: 58, storedUnits: 29_000 }], overflowDeadlineAt: new Date(origin + 3_600_000).toISOString() });
    // 29,000 × 15 / 30,000 = exactly 14.5 centipoints, not 14.
    expect(lot.postHarvest?.containerQualityBonus).toBe(.15);
    expect(projectKqStorageLot(lot, origin + KQ_CURING_DURATION_MS)).toMatchObject({
      conditionScore: 9.13, qualityDelta: 1.13, postHarvest: { curingQualityBonus: .73, qualityBonus: 1.13 },
    });
  });

  it("matches decimal PostgreSQL score and signed delta rounding for precise jury overrides", () => {
    const lot = newLot(), ready = origin + KQ_CURING_DURATION_MS;
    expect(projectKqStorageLot(lot, ready, 8.285)).toMatchObject({ conditionScore: 9.29, qualityDelta: 1.01 });
    expect(projectKqStorageLot(lot, ready, 9.995)).toMatchObject({ conditionScore: 10, qualityDelta: .01 });
    const noBonus = { ...lot, postHarvest: { ...lot.postHarvest!, dryingQualityBonus: 0,
      storageQualityBonus: 0, climateQualityBonus: 0, aromaRateFactor: 100, chemistryRateFactor: 100 } };
    expect(projectKqStorageLot(noBonus, origin + 15 * KQ_GAME_DAY_MS, 8.285)).toMatchObject({
      qualityLoss: .04, conditionScore: 8.25, qualityDelta: -.04,
    });
    const historical = newLot(false);
    const aged = projectKqStorageLot(historical, origin + 15 * KQ_GAME_DAY_MS, 8.285);
    expect(aged.conditionScore).toBe(Math.round((8.285 - aged.qualityLoss) * 100) / 100);
    expect(aged.qualityDelta).toBe(-aged.qualityLoss);
  });

  it("preserves fractional gains through repeated settlement and backwards clocks", () => {
    const lot = newLot();
    let many = lot;
    for (let i = 1; i <= 100; i++) many = settleKqStorageLot(many, origin + i * KQ_CURING_DURATION_MS / 100);
    const once = settleKqStorageLot(lot, origin + KQ_CURING_DURATION_MS);
    expect(many).toEqual(once);
    expect(settleKqStorageLot(once, origin)).toEqual(once);
    expect(isKqStorageLot({ ...lot, postHarvest: { ...lot.postHarvest, dryingQualityBonus: 4 } })).toBe(false);
    expect(isKqStorageLot({ ...lot, postHarvest: { ...lot.postHarvest, curingBonusWeightedMs: KQ_CURING_DURATION_MS * 211 } })).toBe(false);
    expect(isKqStorageLot({ ...lot, postHarvest: { ...lot.postHarvest, aromaRateFactor: 0 } })).toBe(false);
  });
});

describe("meaningful post-harvest tiers without retroactive rewards", () => {
  const tierPlan = (tier: number): KqWarehouseState => ({ ...createKqWarehouseStarter(), serviceZones: [
    { id: "dry", name: "Séchage", x: 0, y: 7, width: 1, height: 1, kind: "drying", deviceCode: ["SJ-DRYIT90", "SIM-DRYING-02", "SIM-DRYING-03"][tier] },
    { id: "store", name: "Stockage", x: 2, y: 7, width: 1, height: 1, kind: "storage", deviceCode: ["LP-SUPER-1L", "BROR-JARS-48", "CURTEC-60L"][tier] },
  ], storageClimateCode: `SIM-STORAGE-CLIMATE-0${tier + 1}` });
  const make = (tier: number) => createKqStorageLot({ flowerId: `tier-${tier}`, harvestedAt: new Date(origin).toISOString(),
    baseline: { ...baseline, juryScore: 6 }, postHarvest: getKqWarehousePostHarvestProfile(tierPlan(tier)),
    capacity: planKqStorageAllocation({ totalUnits: 500, ownedContainers: { "GLASS-1L": 1 }, nowMs: origin }) });

  it("raises the same base-six harvest to 6.1, 6.9 or 7.8, with distinct long-term preservation", () => {
    const lots = [0, 1, 2].map(make);
    const comparison = (["economy", "standard", "premium"] as const).map(getKqPostHarvestTierBenefits);
    expect(comparison.map(tier => tier.qualityBonus)).toEqual([.1, .9, 1.8]);
    expect(comparison.map(tier => tier.retentionPercent)).toEqual([10, 43, 67]);
    expect(lots.map(lot => projectKqStorageLot(lot, origin).conditionScore)).toEqual([6, 6.35, 6.7]);
    expect(lots.map(lot => projectKqStorageLot(lot, origin + KQ_CURING_DURATION_MS).conditionScore)).toEqual([6.1, 6.9, 7.8]);
    expect(lots.map(lot => getKqStorageExposureRates(lot).aromaRate)).toEqual([90, 57, 33]);
    expect(lots.map(lot => lot.baseline.juryScore)).toEqual([6, 6, 6]);
    expect(lots.every(isKqStorageLot)).toBe(true);
    const aged = lots.map(lot => projectKqStorageLot(lot, origin + 90 * KQ_GAME_DAY_MS));
    expect(aged[0].qualityLoss).toBeGreaterThan(aged[1].qualityLoss);
    expect(aged[1].qualityLoss).toBeGreaterThan(aged[2].qualityLoss);
  });

  it("keeps drying captured by previous runs while new runs receive the new tier", () => {
    const plan = getKqWarehouseQuote(tierPlan(2)).nextState;
    const legacy = getKqWarehouseRunSnapshot(plan, 0, undefined, 2, 2, 1);
    const current = getKqWarehouseRunSnapshot(plan);
    expect(legacy.postHarvestBalanceVersion).toBeUndefined();
    expect(current.postHarvestBalanceVersion).toBe(2);
    expect([legacy, current].map(isKqWarehouseRunSnapshot)).toEqual([true, true]);
    expect(isKqWarehouseRunSnapshot({ ...current, postHarvestBalanceVersion: 3 })).toBe(false);
    expect(getKqWarehouseRunPostHarvestProfile(legacy)).toMatchObject({ dryingQualityBonus: .4, storageQualityBonus: .6, climateQualityBonus: .5 });
    expect(getKqWarehouseRunPostHarvestProfile(current)).toMatchObject({ dryingQualityBonus: .7, storageQualityBonus: .6, climateQualityBonus: .5 });
    expect(getKqWarehouseRunPostHarvestProfile(current, tierPlan(0))).toMatchObject({ dryingQualityBonus: .7, storageQualityBonus: 0, climateQualityBonus: .1 });
  });

  it("preserves earned quality and exposure when old premium equipment changes rate halfway", () => {
    const original = newLot(), half = origin + KQ_CURING_DURATION_MS / 2;
    const changed = changeKqStoragePostHarvest(original, getKqWarehousePostHarvestProfile(tierPlan(2)), half);
    expect(changed.postHarvest).toMatchObject({ dryingQualityBonus: .4, storageQualityBonus: .6, climateQualityBonus: .5,
      curingBonusWeightedMs: KQ_CURING_DURATION_MS * 30 });
    expect(projectKqStorageLot(changed, half)).toMatchObject({ conditionScore: 8.7, postHarvest: { curingQualityBonus: .3 } });
    expect(projectKqStorageLot(changed, origin + KQ_CURING_DURATION_MS)).toMatchObject({ conditionScore: 9.25, postHarvest: { curingQualityBonus: .85 } });
    expect(changed.exposure).toEqual(settleKqStorageLot(original, half).exposure);
    const ready = changeKqStoragePostHarvest(original, getKqWarehousePostHarvestProfile(tierPlan(2)), origin + KQ_CURING_DURATION_MS);
    expect(projectKqStorageLot(ready, origin + 2 * KQ_CURING_DURATION_MS).postHarvest?.qualityBonus).toBe(1);
  });

  it("earns at most 1.4 curing bonus, retains the score cap, and protects no overflow", () => {
    const lot = createKqStorageLot({ flowerId: "maximum", harvestedAt: new Date(origin).toISOString(), baseline,
      postHarvest: getKqWarehousePostHarvestProfile(tierPlan(2)), methodCode: "STORAGE-CANNATROL" });
    const ready = settleKqStorageLot(lot, origin + KQ_CURING_DURATION_MS);
    expect(isKqStorageLot(ready)).toBe(true);
    expect(ready.postHarvest?.curingBonusWeightedMs).toBe(KQ_CURING_DURATION_MS * 140);
    expect(projectKqStorageLot(ready, origin + KQ_CURING_DURATION_MS)).toMatchObject({ conditionScore: 10,
      postHarvest: { curingQualityBonus: 1.4, qualityBonus: 2.1 } });
    const half = createKqStorageLot({ flowerId: "half", harvestedAt: new Date(origin).toISOString(), baseline: { ...baseline, juryScore: 6 },
      postHarvest: getKqWarehousePostHarvestProfile(tierPlan(2)),
      capacity: planKqStorageAllocation({ totalUnits: 1000, ownedContainers: { "GLASS-1L": 1 }, nowMs: origin }) });
    expect(getKqStorageExposureRates(half)).toEqual({ aromaRate: 67, chemistryRate: 67 });
    expect(projectKqStorageLot(half, origin + KQ_CURING_DURATION_MS).postHarvest?.curingQualityBonus).toBe(.55);
  });

  it("keeps earlier local saves with already-earned quality readable", () => {
    const saved = settleKqStorageLot(createKqStorageLot({ flowerId: "earlier-local", harvestedAt: new Date(origin).toISOString(), baseline,
      postHarvest: { dryingQualityBonus: 1.2, storageQualityBonus: 1, climateQualityBonus: .8, aromaRateFactor: 14, chemistryRateFactor: 14 },
      methodCode: "STORAGE-CANNATROL" }), origin + KQ_CURING_DURATION_MS);
    expect(isKqStorageLot(saved)).toBe(true);
    expect(saved.postHarvest?.curingBonusWeightedMs).toBe(KQ_CURING_DURATION_MS * 210);
    const changed = changeKqStoragePostHarvest(saved, getKqWarehousePostHarvestProfile(tierPlan(2)), origin + KQ_CURING_DURATION_MS);
    expect(isKqStorageLot(changed)).toBe(true);
    expect(changed.postHarvest).toMatchObject({ dryingQualityBonus: 1.2, storageQualityBonus: .6, climateQualityBonus: .5,
      curingBonusWeightedMs: saved.postHarvest?.curingBonusWeightedMs });
  });
});
