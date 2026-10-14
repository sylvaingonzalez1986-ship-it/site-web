import { describe, expect, it } from "vitest";
import { createKqWarehouseStarter, getKqWarehouseQuote, getKqWarehouseRunSnapshot, getKqWarehouseSummary, getKqWarehouseZoneQuote, isKqWarehouseRunSnapshot, validateKqWarehouseState } from "./kanab-quest-warehouse";
import { KQ_WAREHOUSE_OPTIONS, KQ_WAREHOUSE_OPTION_FAMILIES } from "./kanab-quest-warehouse-options";
import { advanceKqStage, resolveKqStage, startKqGame } from "./kanab-quest-game";
import { encodeKqSave, parseKqGameSave } from "./kanab-quest-persistence";

const starter = () => createKqWarehouseStarter();
const fit = (codes: string[], width = 1) => {
  const previous = starter();
  return getKqWarehouseQuote({ ...previous, zones: previous.zones.map(zone => ({ ...zone, width, optionCodes: codes })) }, previous);
};

describe("fictional warehouse modules", () => {
  it("offers three explicit game profiles in every family and leaves historical plans unchanged", () => {
    for (const family of KQ_WAREHOUSE_OPTION_FAMILIES) expect(KQ_WAREHOUSE_OPTIONS.filter(option => option.family === family.code)).toHaveLength(3);
    const old = starter();
    expect(old).not.toHaveProperty("optionInventory");
    expect(getKqWarehouseRunSnapshot(old)).not.toHaveProperty("qualityBonus");
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
    const draft = { ...old, optionInventory: [{ code: "SIM-CLIMATE-03", quantity: 1 }], zones: old.zones.map(zone => ({ ...zone, optionCodes: ["SIM-CLIMATE-03"] })) };
    expect(getKqWarehouseQuote(draft, old).optionEquipmentCostCents).toBe(4600);
    expect(() => getKqWarehouseRunSnapshot({ ...draft, optionInventory: [] })).toThrow("financé");
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
    const equipped = fit(["SIM-NUTRITION-02", "SIM-CLIMATE-02"], 2).nextState;
    const quote = getKqWarehouseZoneQuote(equipped.zones[0]);
    expect(quote).toMatchObject({ consumablesCostCents: 2 * (2200 + 320 + 190), estimatedHarvestGrams: 510, qualityBonus: 1 });
    const inactive = getKqWarehouseZoneQuote({ ...equipped.zones[0], active: false });
    expect(inactive).toMatchObject({ consumablesCostCents: 0, estimatedHarvestGrams: 0, operatingCostCents: 0 });
    expect(inactive.equipmentCostCents).toBe(quote.equipmentCostCents);
    const run = getKqWarehouseRunSnapshot(equipped);
    equipped.zones[0].optionCodes!.push("SIM-HYGIENE-03");
    equipped.optionInventory![0].quantity = 99;
    expect(run.zones[0].optionCodes).toHaveLength(2);
    expect(run.sourceState.optionInventory?.every(item => item.quantity === 2)).toBe(true);
    expect(isKqWarehouseRunSnapshot(run)).toBe(true);
    expect(isKqWarehouseRunSnapshot({ ...run, consumablesCostCents: 0 })).toBe(false);
    expect(isKqWarehouseRunSnapshot({ ...run, qualityBonus: 4 })).toBe(false);
  });

  it("weights starting quality by active surface and caps stacks", () => {
    const state = fit(["SIM-CLIMATE-02", "SIM-HYGIENE-02"], 1).nextState;
    const second = { ...state.zones[0], id: "second", x: 4, width: 3, optionCodes: [] };
    const mixed = getKqWarehouseQuote({ ...state, zones: [...state.zones, second] }, state).nextState;
    expect(getKqWarehouseRunSnapshot(mixed).qualityBonus).toBe(0);
    const all = fit(KQ_WAREHOUSE_OPTIONS.filter(option => option.code.endsWith("03")).map(option => option.code)).nextState;
    expect(getKqWarehouseRunSnapshot(all).qualityBonus).toBe(4);
    expect(getKqWarehouseZoneQuote(all.zones[0]).yieldBonusPercent).toBeLessThanOrEqual(20);
  });

  it("changes actual game quality and bounded harvest and round-trips saves", () => {
    const paid = fit(["SIM-CLIMATE-03", "SIM-NUTRITION-03"]).nextState;
    const initial = startKqGame(300, { warehouse: getKqWarehouseRunSnapshot(paid) });
    expect(initial.quality).toBe(2);
    expect(initial.effectNotices?.some(line => line.includes("bonus de simulation"))).toBe(true);
    let completed = initial;
    while (completed.phase !== "complete") completed = advanceKqStage(resolveKqStage({ ...completed, phase: "rolled", dice: [6, 6, 6] }));
    expect(completed.harvestGrams).toBeGreaterThan(250);
    expect(completed.harvestGrams).toBeLessThanOrEqual(initial.warehouse!.estimatedHarvestGrams);
    expect(parseKqGameSave(encodeKqSave(completed))).toEqual(completed);
  });
});
