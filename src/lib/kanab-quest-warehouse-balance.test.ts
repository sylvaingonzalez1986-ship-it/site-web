import { describe, expect, it } from "vitest";
import { KQ_WAREHOUSE_CATALOG } from "./kanab-quest-warehouse-catalog";
import { KQ_WAREHOUSE_OPTIONS } from "./kanab-quest-warehouse-options";
import { createKqWarehouseStarter, getKqWarehouseQuote, getKqWarehouseRunSnapshot, getKqWarehouseZoneQuote, isKqWarehouseRunSnapshot } from "./kanab-quest-warehouse";
import { advanceKqStage, resolveKqStage, startKqGame, type KqGameState } from "./kanab-quest-game";
import { createKqFlower } from "./kanab-quest-battle";
import { createKqIntegrityCode, encodeKqSave, parseKqGameSave } from "./kanab-quest-persistence";

function equipped(lightingCode = "SIM-LIGHT-03", airCode = "SIM-AIR-03", optionCodes: string[] = []) {
  const starter = createKqWarehouseStarter();
  return getKqWarehouseQuote({ ...starter,
    zones: starter.zones.map(zone => ({ ...zone, lightingCode, airCode, optionCodes })),
  }, starter).nextState;
}

function finish(initial: KqGameState) {
  let state = initial;
  while (state.phase !== "complete") state = advanceKqStage(resolveKqStage({ ...state, phase: "rolled",
    dice: state.stageIndex === 0 ? [2, 2, 2] : [4, 4, 4] }));
  return state;
}

describe("warehouse balance versions", () => {
  it("applies each lighting and air advantage once per zone, not per purchased unit", () => {
    const base = { ...createKqWarehouseStarter().zones[0], lightingCode: "MH-TS1000", airCode: "SIM-AIR-01" };
    for (const kind of ["lighting", "air"] as const) {
      const devices = KQ_WAREHOUSE_CATALOG.filter(device => device.kind === kind && device.purchasable !== false);
      const advantages = devices.map(device => {
        const zone = { ...base, [kind === "lighting" ? "lightingCode" : "airCode"]: device.code };
        const small = getKqWarehouseZoneQuote(zone);
        const large = getKqWarehouseZoneQuote({ ...zone, width: 10, height: 10 });
        expect(large.equipmentQualityBonus).toBe(small.equipmentQualityBonus);
        expect(large.qualityBonus).toBe(small.qualityBonus);
        return small.equipmentQualityBonus;
      });
      expect(advantages).toEqual([0, 1, 2]);
    }
    expect(getKqWarehouseZoneQuote({ ...base, lightingCode: "MH-FCE3000" }).equipmentQualityBonus).toBe(0);
  });

  it("keeps device quality available after the module cap and preserves each premium yield gain", () => {
    const options = KQ_WAREHOUSE_OPTIONS.filter(option => option.tier === "premium").map(option => option.code);
    const plan = equipped("SIM-LIGHT-03", "SIM-AIR-03", options);
    expect(getKqWarehouseZoneQuote(plan.zones[0])).toMatchObject({
      qualityBonus: 8, equipmentQualityBonus: 4, moduleQualityBonus: 4, yieldBonusPercent: 24, estimatedHarvestGrams: 310,
    });
    const standard = options.map(code => code.replace(/03$/, "02"));
    const allStandard = getKqWarehouseZoneQuote({ ...plan.zones[0], optionCodes: standard });
    expect(allStandard.yieldBonusPercent).toBe(16);
    for (const premium of options) {
      const upgrade = standard.map(code => code.slice(0, -2) === premium.slice(0, -2) ? premium : code);
      expect(getKqWarehouseZoneQuote({ ...plan.zones[0], optionCodes: upgrade }).yieldBonusPercent).toBe(17);
    }
  });

  it("preserves old snapshots and saves with the exact original bonuses", () => {
    const plan = equipped("SIM-LIGHT-03", "SIM-AIR-03", ["SIM-CLIMATE-03", "SIM-NUTRITION-03"]);
    for (const zoneId of [undefined, plan.zones[0].id]) {
      const legacy = getKqWarehouseRunSnapshot(plan, 6, zoneId, 1);
      expect(legacy).not.toHaveProperty("balanceVersion");
      expect(legacy).toMatchObject({ qualityBonus: 2, estimatedHarvestGrams: 257.5 });
      const initial = startKqGame(300, { warehouse: legacy });
      const oldReceipt = encodeKqSave(initial);
      const oldIntegrity = createKqIntegrityCode(initial);
      const current = getKqWarehouseRunSnapshot(plan, 6, zoneId);
      expect(current).toMatchObject({ balanceVersion: 2, qualityBonus: 7, estimatedHarvestGrams: 265 });
      expect(isKqWarehouseRunSnapshot(legacy)).toBe(true);
      expect(parseKqGameSave(oldReceipt)).toEqual(initial);
      expect(createKqIntegrityCode(parseKqGameSave(oldReceipt)!)).toBe(oldIntegrity);
      expect(isKqWarehouseRunSnapshot({ ...legacy, balanceVersion: 2 })).toBe(false);
      const withoutVersion = { ...current };
      delete withoutVersion.balanceVersion;
      expect(isKqWarehouseRunSnapshot(withoutVersion)).toBe(false);
      for (const balanceVersion of [1, 3, "2", null]) {
        expect(isKqWarehouseRunSnapshot({ ...current, balanceVersion })).toBe(false);
      }
      expect(isKqWarehouseRunSnapshot({ ...current, qualityBonus: current.qualityBonus! + 1 })).toBe(false);
      expect(isKqWarehouseRunSnapshot({ ...current, estimatedHarvestGrams: 999 })).toBe(false);
    }
  });

  it("keeps an all-economy plan at zero bonus without inserting a false score", () => {
    const run = getKqWarehouseRunSnapshot(equipped("MH-TS1000", "SIM-AIR-01"));
    expect(run.balanceVersion).toBe(2);
    expect(run).not.toHaveProperty("qualityBonus");
    expect(startKqGame(300, { warehouse: run }).quality).toBe(0);
    expect(isKqWarehouseRunSnapshot(run)).toBe(true);
  });

  it("carries better equipment through completed quality, harvest and jury appearance", () => {
    const economy = finish(startKqGame(300, { warehouse: getKqWarehouseRunSnapshot(equipped("MH-TS1000", "SIM-AIR-01")) }));
    const premium = finish(startKqGame(300, { warehouse: getKqWarehouseRunSnapshot(equipped()) }));
    expect(premium.history.map(stage => ({ outcome: stage.outcome, dice: stage.dice })))
      .toEqual(economy.history.map(stage => ({ outcome: stage.outcome, dice: stage.dice })));
    expect(premium.quality - economy.quality).toBe(4);
    expect(premium.harvestGrams).toBeGreaterThanOrEqual(economy.harvestGrams!);
    expect(createKqFlower(premium).stats.appearance).toBeGreaterThan(createKqFlower(economy).stats.appearance);
    expect(parseKqGameSave(encodeKqSave(premium))).toEqual(premium);
  });
});
