import { createKqProcessingPlan, getKqProcessingMachineReference } from "./kanab-quest-processing-profiles";
import { getKqWorkshopMachineSpecification } from "./kanab-quest-workshop-machines";

export function getKqInvestmentPayback(investmentCents: number, gainPerCycleCents: number) {
  return gainPerCycleCents > 0 ? Math.ceil(investmentCents / gainPerCycleCents) : null;
}

export function getKqWorkshopInvestmentComparison(code: string, level: number, targetLevel: number) {
  if (![level, targetLevel].every(value => Number.isInteger(value) && value >= 1 && value <= 10) || targetLevel <= level) return null;
  const current = getKqWorkshopMachineSpecification(code, level);
  const target = getKqWorkshopMachineSpecification(code, targetLevel);
  const reference = getKqProcessingMachineReference(code, level);
  if (!current || !target || !reference) return null;
  const grams = Math.min(100, current.capacityGrams, target.capacityGrams);
  const plan = (atLevel: number) => createKqProcessingPlan({ inputGrams: grams, productGrams: grams,
    equipmentCodes: [code], levels: { [code]: atLevel } });
  // The profile uses its own mass basis. A fixed output mass does not imply a yield from flowers.
  const before = plan(level);
  const after = plan(targetLevel);
  if (!before || !after) return null;
  return { grams, material: reference.basis === "passive" ? "produit fini prévu" : reference.material,
    currentHours: before.nominalHours, targetHours: after.nominalHours, savedHours: Math.round((before.nominalHours - after.nominalHours) * 1e6) / 1e6,
    passiveHours: before.passiveHours };
}
