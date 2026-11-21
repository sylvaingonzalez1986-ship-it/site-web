import { describe, expect, it } from "vitest";
import { KQ_STARTING_CASH_CENTS } from "./kanab-quest-equipment";
import { createKqWarehouseEmpty, getKqWarehouseQuote, getKqWarehouseSummary, validateKqWarehouseState } from "./kanab-quest-warehouse";
import { validateKqWarehouseSpatialTransition } from "./kanab-quest-warehouse-spatial";
import { proposeFirstWarehousePlan } from "./kanab-quest-warehouse-first-plan";

describe("Première installation du Quartier", () => {
  it("fits the starting wallet, the whole first cycle and both harvest capacities", () => {
    const empty = createKqWarehouseEmpty();
    const draft = proposeFirstWarehousePlan(empty)!;
    const quote = getKqWarehouseQuote(draft, empty);
    const summary = getKqWarehouseSummary(quote.nextState);
    expect(validateKqWarehouseState(draft)).toEqual([]);
    expect(validateKqWarehouseSpatialTransition(empty, quote.nextState)).toEqual([]);
    expect(summary.activeAreaM2).toBe(1);
    expect(summary.estimatedHarvestGrams).toBeGreaterThan(0);
    expect(summary.storageCapacityGrams).toBeGreaterThanOrEqual(summary.estimatedHarvestGrams);
    expect(summary.dryingCapacityGrams).toBeGreaterThanOrEqual(summary.estimatedHarvestGrams);
    expect(draft.airPlacements).toEqual([]);
    expect(quote.totalCostCents + summary.operatingCostCents).toBeLessThanOrEqual(KQ_STARTING_CASH_CENTS);
    expect(empty).toEqual(createKqWarehouseEmpty());
    expect(draft.equipment).toEqual([]);
    expect(proposeFirstWarehousePlan(quote.nextState)).toBeNull();
    expect(getKqWarehouseQuote(quote.nextState, quote.nextState).totalCostCents).toBe(0);
  });
});
