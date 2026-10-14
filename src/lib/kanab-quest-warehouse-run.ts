import type { KqEnergyQuote } from "./kanab-quest-energy";
import type { KqWarehouseRunSnapshot } from "./kanab-quest-warehouse";

/** Existing invoices retain their format; the amount comes from physical devices. */
export function quoteKqWarehouseEnergy(warehouse: KqWarehouseRunSnapshot): KqEnergyQuote {
  const wattHours = Math.round(warehouse.energyKwh * 1000);
  return {
    version: 1, mode: "balanced", solarPercent: 0,
    tariffCentsPerKwh: warehouse.energyKwh > 0
      ? Math.round(warehouse.energyCostCents / warehouse.energyKwh * 100) / 100 : 0,
    totalWattHours: wattHours, totalCents: warehouse.energyCostCents, savingsCents: 0,
    lines: [{ code: "WAREHOUSE-CULTURE", name: "Pièce de culture", level: 1,
      watts: warehouse.powerWatts, hours: warehouse.powerWatts > 0 ? wattHours / warehouse.powerWatts : 0, wattHours }],
  };
}

export function isKqWarehouseEnergyQuote(value: unknown, warehouse: KqWarehouseRunSnapshot): boolean {
  if (!value || typeof value !== "object") return false;
  const actual = value as Record<string, unknown>;
  const expected = quoteKqWarehouseEnergy(warehouse);
  return Object.keys(actual).length === Object.keys(expected).length
    && Object.entries(expected).every(([key, item]) => key === "lines"
      ? Array.isArray(actual.lines) && actual.lines.length === 1
        && Object.entries(expected.lines[0]).every(([field, entry]) => actual.lines !== undefined
          && (actual.lines as Record<string, unknown>[])[0]?.[field] === entry)
      : actual[key] === item);
}

/** A bounded simulation, separate from the physical manufacturer's specifications. */
export function calculateKqWarehouseHarvest(input: {
  warehouse: KqWarehouseRunSnapshot; quality: number; successfulStages: number;
  inputBonusPercent: number; healthLossPercent: number; incidentLossPercent: number;
}) {
  const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
  const round = (value: number) => Math.round(value * 10) / 10;
  const cycleFactor = clamp((55 + input.successfulStages * 7 + input.quality * 3) / 160, 0, 1);
  const grossGrams = round(input.warehouse.estimatedHarvestGrams
    * clamp(cycleFactor * (1 + input.inputBonusPercent / 100), 0, 1));
  const finalGrams = round(grossGrams * (1 - clamp(input.incidentLossPercent, 0, 80) / 100)
    * (1 - clamp(input.healthLossPercent, 0, 100) / 100));
  return { grossGrams, afterIncidentGrams: finalGrams, finalGrams, tentHarvests: [] };
}
