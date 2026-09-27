import { describe, expect, it } from "vitest";
import { getKqProductionExpansion, getKqProductionUnits } from "./kanab-quest-production";
import { getKqEquipmentCartTotal, getKqEquipmentUpgradeCost, getKqNextEquipmentGoal, validateKqEquipmentCart } from "./kanab-quest-equipment";

describe("production expansion", () => {
  it.each([[1,2],[2,3],[3,4],[4,8]])("adds capacity from %i to %i", (units, nextUnits) => {
    expect(getKqProductionExpansion(units, [])).toMatchObject({ units, nextUnits, addedUnits: nextUnits-units });
  });
  it("preserves the first warehouse and adds four equipped tents in the final warehouse", () => {
    expect(getKqProductionExpansion(4, [])).toMatchObject({ warehouseCount:1, nextUnits:8, equipmentCostCents:120000, propertyCostCents:2000000, totalCostCents:2120000 });
    expect(getKqProductionExpansion(8, [])).toMatchObject({ warehouseCount:2, nextUnits:null, addedUnits:0, totalCostCents:0 });
  });
  it("always supplies a basic starter tent for 300 euros", () => {
    expect(getKqProductionExpansion(1, []).totalCostCents).toBe(30000);
    expect(getKqProductionExpansion(1, ["TENT-120"]).totalCostCents).toBe(30000);
    expect(getKqProductionExpansion(1, ["TENT-120", "LED-300", "AIR-EC6"]).totalCostCents).toBe(30000);
  });
  it("never copies or charges existing upgrades and reserve equipment", () => {
    const codes = ["LED-300", "LED-300", "SECURITY-CAMERA", "SECURITY-FENCE"];
    expect(getKqProductionExpansion(2, codes, { "LED-300": 10 }).totalCostCents).toBe(30000);
    expect(getKqProductionExpansion(4, codes, { "LED-300": 10 }).totalCostCents).toBe(2120000);
  });
  it.each([undefined,0,-1,1.5,5,7,9,NaN,Infinity])("defaults legacy or invalid capacity %s to one tent", value => {
    expect(getKqProductionUnits(value)).toBe(1);
  });
  it.each([2,3,4,8])("charges purchases and upgrades for all %i tents", units => {
    expect(getKqEquipmentCartTotal(["LED-300"],units)).toBe(35900*units);
    expect(getKqEquipmentUpgradeCost("LED-300",3,units)).toBe(10770*units);
    const cart=validateKqEquipmentCart({cartCodes:["LED-300"],ownedCodes:[],cashCents:35900,productionUnits:units});
    expect(cart.cashAfterCents).toBe(35900-35900*units);
    expect(cart.errors.length).toBeGreaterThan(0);
    const base=getKqNextEquipmentGoal({ownedCodes:[],cashCents:0})!;
    const fleet=getKqNextEquipmentGoal({ownedCodes:[],cashCents:base.equipment.priceCents,productionUnits:units})!;
    expect(fleet.equipment.priceCents).toBe(base.equipment.priceCents*units);
    expect(fleet.affordable).toBe(false);
  });
});
