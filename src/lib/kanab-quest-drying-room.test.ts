import { describe, expect, it } from "vitest";
import { getKqEquipmentAtLevel, getKqEquipmentUpgradeCost, projectKqEquipmentLoadout } from "./kanab-quest-equipment";
import { quoteKqEnergy } from "./kanab-quest-energy";
import { startKqGame, rollKqDice, resolveKqStage, advanceKqStage, getKqHarvestBreakdown } from "./kanab-quest-game";
import { calculateKqEquipmentQualityBonus } from "./kanab-quest-market";
import { encodeKqSave, parseKqGameSave } from "./kanab-quest-persistence";

describe("flower drying room",()=>{
  it("coexists with the hash freeze-dryer and is independently installed",()=>{
    const projection=projectKqEquipmentLoadout({equippedCodes:["FREEZE-DRYER"],candidateCodes:["DRYING-ROOM"],ownedCodes:["FREEZE-DRYER","DRYING-ROOM"]});
    expect(projection.equipmentCodes).toEqual(["FREEZE-DRYER","DRYING-ROOM"]);
    expect(projection.ambiguousSlots).toEqual([]);
    expect(projection.qualityMaxBonus).toBe(4);
    expect(getKqEquipmentAtLevel("DRYING-ROOM")?.priceCents).toBe(60000);
  });
  it("earns quality progressively without giving failed runs a free quality bonus",()=>{
    expect([1,4,7,10].map(level=>getKqEquipmentAtLevel("DRYING-ROOM",level)?.effects.qualityMaxBonus)).toEqual([1,2,3,4]);
    expect(getKqEquipmentAtLevel("DRYING-ROOM",10)?.effects.regularityPercent).toBe(11);
    expect(getKqEquipmentUpgradeCost("DRYING-ROOM",1)).toBe(6000);
    expect(getKqEquipmentUpgradeCost("DRYING-ROOM",9)).toBe(54000);
    expect(getKqEquipmentUpgradeCost("DRYING-ROOM",10)).toBeNull();
    expect(calculateKqEquipmentQualityBonus(4,0)).toBe(0);
    expect(calculateKqEquipmentQualityBonus(4,3)).toBe(2);
  });
  it("charges installed drying equipment and freezes levels and energy for the run",()=>{
    expect(quoteKqEnergy(["DRYING-ROOM"]).totalCents).toBe(162);
    expect(quoteKqEnergy(["DRYING-ROOM"],{"DRYING-ROOM":10}).totalCents).toBe(308);
    const levels={"DRYING-ROOM":4};
    let run=startKqGame(212,{equipmentCodes:["DRYING-ROOM"],equipmentLevels:levels,energyMode:"balanced"});
    const energy=structuredClone(run.energy);levels["DRYING-ROOM"]=10;
    expect(run.equipment?.qualityMaxBonus).toBe(2);
    while(run.phase!=="complete"){
      if(run.phase==="prepare")run=rollKqDice(run);
      if(run.phase==="rolled")run=resolveKqStage(run);
      if(run.phase==="resolved")run=advanceKqStage(run);
    }
    const breakdown=getKqHarvestBreakdown(run);
    expect(breakdown.equipmentQualityBonus).toBe(calculateKqEquipmentQualityBonus(2,breakdown.successfulStages));
    expect(breakdown.finalQuality).toBe(breakdown.stageQuality+breakdown.equipmentQualityBonus);
    expect(run.energy).toEqual(energy);
    expect(parseKqGameSave(encodeKqSave(run))).not.toBeNull();
    expect(parseKqGameSave(encodeKqSave({...run,equipment:{...run.equipment,qualityMaxBonus:100}}))).toBeNull();
  });
});
