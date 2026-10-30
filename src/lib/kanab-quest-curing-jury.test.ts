import { describe, expect, it } from "vitest";
import { createKqCareState } from "./kanab-quest-care";
import { applyKqStorageToJury, createKqStorageLot, KQ_CURING_DURATION_MS, projectKqStorageLot } from "./kanab-quest-storage";

const start = Date.parse("2026-10-29T00:00:00Z");
const stats = { appearance: 60, aroma: 60, vigor: 60, mastery: 60, regularity: 60, cannabinoids: 60 };
function fixture() {
  return createKqStorageLot({ flowerId: "harvest", harvestedAt: new Date(start).toISOString(), preJury: true,
    baseline: { varietyCode: "KANAB-001", juryScore: 6, aroma: 60, care: createKqCareState() },
    capacity: { totalUnits: 500, allocations: [{ containerCode: "GLASS-1L", quantity: 1, storedUnits: 500 }], automaticOverflowSale: false, overflowDeadlineAt: null },
    postHarvest: { dryingQualityBonus: .35, storageQualityBonus: .3, climateQualityBonus: .25, aromaRateFactor: 60, chemistryRateFactor: 60 },
  });
}
describe("curing before the jury", () => {
  it("requires the full existing six hours and freezes the acquired effect exactly once", () => {
    const lot = fixture();
    expect(() => applyKqStorageToJury(lot, stats, start + KQ_CURING_DURATION_MS - 1)).toThrow("curing");
    const prepared = applyKqStorageToJury(lot, stats, start + KQ_CURING_DURATION_MS);
    expect(prepared.stats).toEqual(Object.fromEntries(Object.keys(stats).map(key => [key, 69])));
    expect(prepared.lot.juryApplied).toMatchObject({ qualityDelta: .9, originalStats: stats, stats: prepared.stats });
    expect(prepared.lot.readyAt).toBe(lot.readyAt);
    expect(prepared.lot.baseline).toEqual(lot.baseline);
    expect(applyKqStorageToJury(prepared.lot, prepared.stats, start + KQ_CURING_DURATION_MS + 60_000)).toEqual(prepared);
    expect(lot.juryApplied).toBeUndefined();
  });
  it("does not award the same drying and curing gains a second time after the verdict", () => {
    const prepared = applyKqStorageToJury(fixture(), stats, start + KQ_CURING_DURATION_MS);
    expect(projectKqStorageLot(prepared.lot, start + KQ_CURING_DURATION_MS).conditionScore).toBe(6.9);
    const commercial = projectKqStorageLot(prepared.lot, start + KQ_CURING_DURATION_MS, 7.2);
    expect(commercial.conditionScore).toBe(7.2);
    expect(commercial.qualityDelta).toBe(0);
    expect(commercial.stage).toBe("ready");
    const aged = projectKqStorageLot(prepared.lot, start + 30 * 24 * 3_600_000, 7.2);
    expect(aged.conditionScore).toBeLessThan(7.2);
  });
  it("preserves legacy after-verdict lots and clamps jury stats without touching harvest evidence", () => {
    const lot = fixture();
    delete lot.preJury;
    expect(projectKqStorageLot(lot, start + KQ_CURING_DURATION_MS, 7.2).conditionScore).toBe(8.1);
    const prepared = applyKqStorageToJury(lot, { ...stats, aroma: 98 }, start + KQ_CURING_DURATION_MS);
    expect(prepared.stats.aroma).toBe(99);
    expect(prepared.lot.baseline).toEqual(lot.baseline);
  });
});
