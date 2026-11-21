import { describe, expect, it } from "vitest";
import retail from "./kanab-quest-warehouse-retail-equipment.json";
import { createKqWarehouseStarter, getKqWarehouseQuote, getKqWarehouseRunSnapshot, getKqWarehouseSummary, getKqWarehouseZoneQuote, isKqWarehouseRunSnapshot, validateKqWarehouseState } from "./kanab-quest-warehouse";
import { getKqWarehouseZoneOptionQuantity, isKqWarehouseZoneDevice, KQ_WAREHOUSE_HANDLING_CART, KQ_WAREHOUSE_OPTIONS, KQ_WAREHOUSE_OPTION_FAMILIES } from "./kanab-quest-warehouse-options";
import { initializeKqWarehouseCondition, reconcileKqWarehouseCondition } from "./kanab-quest-warehouse-condition";
import { KQ_WAREHOUSE_HANDLING, isKqWarehouseHandlingCode } from "./kanab-quest-warehouse-handling";
import { advanceKqStage, resolveKqStage, startKqGame } from "./kanab-quest-game";
import { encodeKqSave, parseKqGameSave } from "./kanab-quest-persistence";

const starter = () => createKqWarehouseStarter();
const fit = (codes: string[], width = 1) => {
  const previous = starter();
  return getKqWarehouseQuote({ ...previous, zones: previous.zones.map(zone => ({ ...zone, width, optionCodes: codes })) }, previous);
};

describe("fictional warehouse modules", () => {
  it.each(Object.entries(KQ_WAREHOUSE_HANDLING))("sells %s once without installation or culture effects", (code, item) => {
    const previous = starter();
    const optionInventory = [{ code, quantity: 1 }];
    const quote = getKqWarehouseQuote({ ...previous, optionInventory }, previous);
    expect(quote).toMatchObject({ totalCostCents: item.priceCents, installationCostCents: 0,
      optionPurchases: [{ code, unit: "handling", quantity: 1, consumablesCostCents: 0 }] });
    expect(getKqWarehouseQuote({ ...quote.nextState, optionInventory: [] }, quote.nextState))
      .toMatchObject({ totalCostCents: 0, nextState: { optionInventory } });
    expect(getKqWarehouseSummary(quote.nextState).optionReserve).toEqual([]);
    const baseline = getKqWarehouseRunSnapshot(previous);
    expect(getKqWarehouseRunSnapshot(quote.nextState)).toMatchObject({
      estimatedHarvestGrams: baseline.estimatedHarvestGrams, consumablesCostCents: baseline.consumablesCostCents,
    });
    expect(() => getKqWarehouseQuote({ ...previous, optionInventory: [{ ...optionInventory[0], quantity: 2 }] }, previous)).toThrow();
    expect(() => fit([code])).toThrow();
  });

  it("adds all three handling tools in the same purchase without treating them as one tier", () => {
    const previous = starter();
    const optionInventory = Object.keys(KQ_WAREHOUSE_HANDLING).map(code => ({ code, quantity: 1 }));
    const totalCostCents = retail["SIM-LOGISTICS-01"].unitPriceCents + retail["SIM-LOGISTICS-02"].unitPriceCents
      + retail["SIM-LOGISTICS-03"].unitPriceCents;
    expect(getKqWarehouseQuote({ ...previous, optionInventory }, previous))
      .toMatchObject({ totalCostCents, installationCostCents: 0, addedAreaM2: 0, nextState: { optionInventory } });
  });

  it("reads a frozen culture with the original zone cart profile and supplies", () => {
    const previous = starter();
    const legacy = { ...previous, optionInventory: [{ code: KQ_WAREHOUSE_HANDLING_CART, quantity: 1 }],
      zones: previous.zones.map(zone => ({ ...zone, optionCodes: [KQ_WAREHOUSE_HANDLING_CART] })) };
    const run = getKqWarehouseRunSnapshot(legacy);
    expect(run).toMatchObject({ estimatedHarvestGrams: 255, consumablesCostCents: 2280 });
    expect(isKqWarehouseRunSnapshot(run)).toBe(true);
  });
  it("offers three explicit game profiles in every family and leaves historical plans unchanged", () => {
    for (const family of KQ_WAREHOUSE_OPTION_FAMILIES) expect(KQ_WAREHOUSE_OPTIONS.filter(option => option.family === family.code)).toHaveLength(3);
    const old = starter();
    expect(old).not.toHaveProperty("optionInventory");
    expect(getKqWarehouseRunSnapshot(old, 0, undefined, 1)).not.toHaveProperty("qualityBonus");
    expect(getKqWarehouseRunSnapshot(old)).toMatchObject({ balanceVersion: 2, qualityBonus: 1 });
    expect(getKqWarehouseRunSnapshot(old)).toMatchObject({ estimatedHarvestGrams: 250, consumablesCostCents: 2200 });
    expect(isKqWarehouseRunSnapshot(getKqWarehouseRunSnapshot(old))).toBe(true);
  });

  it("charges every square metre once, including installation, and reuses paid coverage", () => {
    const first = fit(["SIM-NUTRITION-02"], 2);
    expect(first.optionPurchases).toMatchObject([{ code: "SIM-NUTRITION-02", quantity: 2, totalCents: 1000 }]);
    const noOptions = getKqWarehouseQuote({ ...starter(), zones: starter().zones.map(zone => ({ ...zone, width: 2 })) }, starter());
    expect(first.totalCostCents - noOptions.totalCostCents).toBe(1150);
    const moved = getKqWarehouseQuote({ ...first.nextState, zones: first.nextState.zones.map(zone => ({ ...zone, x: 8 })) }, first.nextState);
    expect(moved.totalCostCents).toBe(0);
    const removed = getKqWarehouseQuote({ ...first.nextState, zones: first.nextState.zones.map(zone => ({ ...zone, optionCodes: [] })), optionInventory: [] }, first.nextState);
    expect(removed.nextState.optionInventory).toEqual(first.nextState.optionInventory);
    expect(getKqWarehouseSummary(removed.nextState).optionReserve).toEqual(first.nextState.optionInventory);
    expect(getKqWarehouseQuote(first.nextState, removed.nextState).totalCostCents).toBe(0);
  });

  it("does not trust claimed inventory and does not run unfunded profiles", () => {
    const old = starter();
    const draft = { ...old, optionInventory: [{ code: "SIM-CLIMATE-UNIT-03", quantity: 1 }], zones: old.zones.map(zone => ({ ...zone, optionCodes: ["SIM-CLIMATE-UNIT-03"] })) };
    expect(getKqWarehouseQuote(draft, old).optionEquipmentCostCents).toBe(retail["SIM-CLIMATE-UNIT-03"].unitPriceCents);
    expect(() => getKqWarehouseRunSnapshot({ ...draft, optionInventory: [] })).toThrow("financé");
  });

  it.each(KQ_WAREHOUSE_OPTIONS.filter(isKqWarehouseZoneDevice))("rounds $code in each zone and applies its effect and cycle charges to the actual area", option => {
    const { code, capacityM2, unitPriceCents, consumablesCentsPerM2 } = option;
    const old = starter(), zone = old.zones[0];
    expect([1, capacityM2, capacityM2 + 1].map(area => getKqWarehouseZoneOptionQuantity(code, area))).toEqual([1, 1, 2]);
    const line = getKqWarehouseZoneQuote({ ...zone, width: 11, height: 10, optionCodes: [code] });
    const quantity = Math.ceil(110 / capacityM2);
    expect(line.options[0]).toMatchObject({ unit: "device", quantity, treatedAreaM2: 110, totalCents: quantity * unitPriceCents,
      consumablesCostCents: 110 * consumablesCentsPerM2 });
    expect(line.yieldBonusPercent).toBe(option.yieldBonusPercent);
    expect(line.moduleQualityBonus).toBe(option.qualityBonus);
    const zones = [zone, { ...zone, id: "second", x: 3, active: false }];
    const baseline = getKqWarehouseQuote({ ...old, zones }, old).nextState;
    const fitted = getKqWarehouseQuote({ ...baseline, zones: zones.map(item => ({ ...item, optionCodes: [code] })) }, baseline);
    expect(fitted).toMatchObject({ optionPurchases: [{ code, unit: "device", quantity: 2, totalCents: 2 * unitPriceCents }],
      addedAreaM2: 0, installationCostCents: option.installationIncluded ? 0 : Math.round(2 * unitPriceCents * 15 / 100) });
    expect(getKqWarehouseSummary(fitted.nextState)).toMatchObject({ optionReserve: [], consumablesCostCents: 2200 + consumablesCentsPerM2 });
    expect(getKqWarehouseQuote(fitted.nextState, fitted.nextState).totalCostCents).toBe(0);
    expect(() => getKqWarehouseQuote({ ...fitted.nextState, optionInventory: [{ code, quantity: 3 }] }, baseline)).toThrow("zone de culture");
  });

  it("keeps legacy square metres, funded prices, wear and old snapshots when replacing and reusing a model", () => {
    const base = fit([], 2).nextState;
    const code = "SIM-CLIMATE-01", newCode = "SIM-CLIMATE-UNIT-01";
    const before = { ...base, optionInventory: [{ code, quantity: 2 }], zones: base.zones.map(zone => ({ ...zone, optionCodes: [code] })) };
    const historical = getKqWarehouseRunSnapshot(before, 1);
    const condition = initializeKqWarehouseCondition(before);
    const oldAsset = condition.assets.find(item => item.code === code)!;
    Object.assign(oldAsset, { purchaseUnitCents: 1234, wearPercent: 37 });
    expect(getKqWarehouseZoneQuote(before.zones[0]).options[0]).toMatchObject({ quantity: 2, totalCents: 2 * retail[code].unitPriceCents });
    const replaced = getKqWarehouseQuote({ ...before, zones: before.zones.map(zone => ({ ...zone, optionCodes: [newCode] })) }, before);
    expect(replaced.totalCostCents).toBe(retail[newCode].unitPriceCents);
    expect(getKqWarehouseSummary(replaced.nextState).optionReserve).toEqual([{ code, quantity: 2 }]);
    const assets = reconcileKqWarehouseCondition(before, replaced.nextState, condition, { requestKey: "switch", fundedFraction: 1 });
    expect(assets.assets).toContainEqual({ ...oldAsset, zoneId: null });
    expect(assets.assets.find(item => item.code === newCode)).toMatchObject({ quantity: 1, zoneId: "starter", purchaseUnitCents: retail[newCode].unitPriceCents });

    const reused = getKqWarehouseQuote(before, replaced.nextState);
    expect(reused.totalCostCents).toBe(0);
    expect(getKqWarehouseSummary(reused.nextState).optionReserve).toEqual([{ code: newCode, quantity: 1 }]);
    const restored = reconcileKqWarehouseCondition(replaced.nextState, reused.nextState, assets, { requestKey: "restore", fundedFraction: 1 });
    expect(restored.assets).toContainEqual(oldAsset);
    expect(() => getKqWarehouseQuote({ ...before, zones: before.zones.map(zone => ({ ...zone, width: 3 })) }, before)).toThrow("réserve");
    expect(() => getKqWarehouseQuote({ ...before, optionInventory: [{ code, quantity: 3 }] }, before)).toThrow("réserve");
    expect(isKqWarehouseRunSnapshot(historical)).toBe(true);
    expect(isKqWarehouseRunSnapshot(getKqWarehouseRunSnapshot(replaced.nextState, 2))).toBe(true);
  });

  it("rejects unknown profiles, duplicate families and malformed coverage", () => {
    const old = starter();
    for (const optionCodes of [["UNKNOWN"], ["SIM-WATER-01", "SIM-WATER-02"], null, "SIM-WATER-01", [1]]) {
      expect(validateKqWarehouseState({ ...old, zones: old.zones.map(zone => ({ ...zone, optionCodes })) }).length).toBeGreaterThan(0);
    }
    for (const optionInventory of [null, [{ code: "SIM-WATER-01", quantity: -1 }], [{ code: "SIM-WATER-01", quantity: 0.5 }], [{ code: "SIM-WATER-01", quantity: 1 }, { code: "SIM-WATER-01", quantity: 2 }]]) {
      expect(validateKqWarehouseState({ ...old, optionInventory }).length).toBeGreaterThan(0);
    }
  });

  it("freezes recurring game supplies and gives inactive zones no recurring charge or yield", () => {
    const equipped = fit(["SIM-NUTRITION-02", "SIM-CLIMATE-UNIT-02"], 2).nextState;
    const quote = getKqWarehouseZoneQuote(equipped.zones[0]);
    expect(quote).toMatchObject({ consumablesCostCents: 2 * (2200 + 320 + 190), estimatedHarvestGrams: 520,
      qualityBonus: 2, moduleQualityBonus: 1, equipmentQualityBonus: 1 });
    const inactive = getKqWarehouseZoneQuote({ ...equipped.zones[0], active: false });
    expect(inactive).toMatchObject({ consumablesCostCents: 0, estimatedHarvestGrams: 0, operatingCostCents: 0 });
    expect(inactive.equipmentCostCents).toBe(quote.equipmentCostCents);
    const run = getKqWarehouseRunSnapshot(equipped);
    equipped.zones[0].optionCodes!.push("SIM-HYGIENE-03");
    equipped.optionInventory![0].quantity = 99;
    expect(run.zones[0].optionCodes).toHaveLength(2);
    expect(run.sourceState.optionInventory).toEqual([{ code: "SIM-CLIMATE-UNIT-02", quantity: 1 }, { code: "SIM-NUTRITION-02", quantity: 2 }]);
    expect(isKqWarehouseRunSnapshot(run)).toBe(true);
    expect(isKqWarehouseRunSnapshot({ ...run, consumablesCostCents: 0 })).toBe(false);
    expect(isKqWarehouseRunSnapshot({ ...run, qualityBonus: 4 })).toBe(false);
  });

  it("weights starting quality by active surface and caps stacks", () => {
    const state = fit(["SIM-CLIMATE-UNIT-02", "SIM-HYGIENE-02"], 1).nextState;
    const second = { ...state.zones[0], id: "second", x: 4, width: 3, optionCodes: [] };
    const mixed = getKqWarehouseQuote({ ...state, zones: [...state.zones, second] }, state).nextState;
    expect(getKqWarehouseRunSnapshot(mixed).qualityBonus).toBe(1);
    const all = fit(KQ_WAREHOUSE_OPTIONS.filter(option => option.code.endsWith("03") && !isKqWarehouseHandlingCode(option.code)).map(option => option.code)).nextState;
    expect(getKqWarehouseRunSnapshot(all).qualityBonus).toBe(5);
    expect(getKqWarehouseZoneQuote(all.zones[0])).toMatchObject({ yieldBonusPercent: 21, moduleQualityBonus: 4, equipmentQualityBonus: 1 });
  });

  it("changes actual game quality and bounded harvest and round-trips saves", () => {
    const paid = fit(["SIM-CLIMATE-UNIT-03", "SIM-NUTRITION-03"]).nextState;
    const initial = startKqGame(300, { warehouse: getKqWarehouseRunSnapshot(paid) });
    expect(initial.quality).toBe(4);
    expect(initial.effectNotices?.some(line => line.includes("bonus de simulation"))).toBe(true);
    let completed = initial;
    while (completed.phase !== "complete") completed = advanceKqStage(resolveKqStage({ ...completed, phase: "rolled", dice: [6, 6, 6] }));
    expect(completed.harvestGrams).toBeGreaterThan(250);
    expect(completed.harvestGrams).toBeLessThanOrEqual(initial.warehouse!.estimatedHarvestGrams);
    expect(parseKqGameSave(encodeKqSave(completed))).toEqual(completed);
  });
});
