import { describe, expect, it } from "vitest";
import { KQ_GAME_DAY_MS } from "./kanab-quest-business";
import { createKqCareState } from "./kanab-quest-care";
import { getKqStageDisplayName, KQ_STAGES } from "./kanab-quest-game";
import { changeKqStorageCapacity, changeKqStorageMethod, createKqStorageLot, fillKqStorageCapacity, getKqStorageExposureRates, getKqStorageInventory, isKqStorageCapacity, isKqStorageLot, KQ_CURING_DURATION_MS, KQ_STARTER_STORAGE_CONTAINERS, KQ_STORAGE_CONTAINERS, KQ_STORAGE_METHODS, KQ_STORAGE_OVERFLOW_GRACE_MS, planKqStorageAllocation, projectKqStorageCapacity, projectKqStorageLot, resizeKqStorageCapacity, settleKqStorageLot } from "./kanab-quest-storage";

const origin = Date.parse("2026-10-10T12:00:00.000Z");
const baseline = { varietyCode: "KANAB-001", juryScore: 9, aroma: 92,
  care: { ...createKqCareState(), terpenes: 92, cannabinoidExpression: 90 } };
const createLot = () => createKqStorageLot({ flowerId: "flower-1", harvestedAt: new Date(origin - 3 * KQ_GAME_DAY_MS).toISOString(), curingStartedAt: new Date(origin).toISOString(), baseline });
const atDay = (days: number) => origin + days * KQ_GAME_DAY_MS;

describe("warehouse curing and conservation", () => {
  it("starts six real hours at the verdict, independently of harvest", () => {
    const lot = createLot();
    expect(lot.readyAt).toBe(new Date(origin + KQ_CURING_DURATION_MS).toISOString());
    expect(KQ_CURING_DURATION_MS).toBe(6 * 60 * 60 * 1000);
    expect(projectKqStorageLot(lot, origin + 3 * 60 * 60 * 1000)).toMatchObject({ stage: "curing", remainingMs: 3 * 60 * 60 * 1000, progressPercent: 50 });
    expect(projectKqStorageLot(lot, origin + 6 * 60 * 60 * 1000 - 1)).toMatchObject({ stage: "curing", remainingMs: 1, nextChangeAt: lot.readyAt });
    expect(projectKqStorageLot(lot, origin + 6 * 60 * 60 * 1000)).toMatchObject({ stage: "ready", remainingMs: 0, progressPercent: 100 });
    expect(lot.harvestedAt).not.toBe(lot.curingStartedAt);
  });

  it("does not change an archived stage key when displaying the final operation", () => {
    expect(KQ_STAGES[5]).toBe("Séchage & affinage");
    expect(getKqStageDisplayName(KQ_STAGES[5])).toBe("Séchage");
    expect(getKqStageDisplayName(KQ_STAGES[4])).toBe(KQ_STAGES[4]);
  });

  it("keeps loss projections stable during a day without mutating or advancing the lot", () => {
    const lot = createLot(), before = structuredClone(lot);
    const a = projectKqStorageLot(lot, atDay(59) + 1), b = projectKqStorageLot(lot, atDay(60) - 1);
    expect(a.cannabinoidReport).toEqual(b.cannabinoidReport);
    expect(a.qualityDelta).toBe(b.qualityDelta);
    expect(a.aroma).toBe(b.aroma);
    expect(a.nextChangeAt).toBe(b.nextChangeAt);
    expect(projectKqStorageLot(lot, atDay(59) + 1)).toEqual(a);
    expect(lot).toEqual(before);
  });

  it("checkpoints exact exposure so fractional settlements cannot erase aging", () => {
    const original = createLot();
    let settled = original;
    for (let i = 1; i <= 1000; i++) settled = settleKqStorageLot(settled, origin + i * KQ_GAME_DAY_MS / 10);
    const once = settleKqStorageLot(original, atDay(100));
    expect(settled).toEqual(once);
    expect(projectKqStorageLot(settled, atDay(100))).toEqual(projectKqStorageLot(original, atDay(100)));
  });

  it("uses the old installation until purchase, with no retroactive recovery", () => {
    const lot = createLot(), buyAt = atDay(61.5);
    const before = projectKqStorageLot(lot, buyAt);
    const upgraded = changeKqStorageMethod(lot, "STORAGE-CANNATROL", buyAt);
    expect(upgraded.exposure.aromaWeightedMs).toBe((buyAt - origin) * 100);
    expect(upgraded.readyAt).toBe(lot.readyAt);
    expect(projectKqStorageLot(upgraded, buyAt).terpenes).toBeLessThanOrEqual(before.terpenes);
    const after = projectKqStorageLot(upgraded, atDay(180));
    expect(after.terpenes).toBeGreaterThan(projectKqStorageLot(lot, atDay(180)).terpenes);
    expect(after.terpenes).toBeLessThanOrEqual(before.terpenes);
    expect(after.cannabinoidReport.score).toBeLessThanOrEqual(before.cannabinoidReport.score);
  });

  it("cannot rejuvenate or restart maturity by moving the supplied clock backwards", () => {
    const settled = settleKqStorageLot(createLot(), atDay(180));
    expect(settleKqStorageLot(settled, origin)).toEqual(settled);
    expect(projectKqStorageLot(settled, origin)).toEqual(projectKqStorageLot(settled, atDay(180)));
    expect(changeKqStorageMethod(settled, "STORAGE-CANNATROL", origin).lastSettledAt).toBe(settled.lastSettledAt);
  });

  it("slows losses across tiers without creating terpenes, chemical potential or shorter curing", () => {
    const original = createLot(), initial = projectKqStorageLot(original, origin);
    const projections = KQ_STORAGE_METHODS.map(method => projectKqStorageLot(changeKqStorageMethod(original, method.code, origin), atDay(60)));
    expect(projections.map(item => item.terpenes)).toEqual([88, 89, 90, 91, 91]);
    expect(projections.map(item => item.qualityLoss)).toEqual([0.2, 0.12, 0.08, 0.04, 0.04]);
    const sum = (totals: Record<string, number>) => Object.values(totals).reduce((a, b) => a + b, 0);
    for (const projected of projections) {
      expect(projected.readyAt).toBe(original.readyAt);
      expect(projected.terpenes).toBeLessThanOrEqual(initial.terpenes);
      expect(projected.cannabinoidReport.score).toBeLessThanOrEqual(initial.cannabinoidReport.score);
      expect(sum(projected.cannabinoidReport.totals)).toBeLessThanOrEqual(sum(initial.cannabinoidReport.totals) + .001);
      expect(projected.conditionScore).toBeLessThanOrEqual(baseline.juryScore);
    }
  });

  it("can show more neutral compounds and CBN while quality and total potential decline", () => {
    const lot = createLot(), initial = projectKqStorageLot(lot, origin), older = projectKqStorageLot(lot, atDay(360));
    expect(older.cannabinoidReport.rates.cbd).toBeGreaterThan(initial.cannabinoidReport.rates.cbd);
    expect(older.cannabinoidReport.rates.cbda).toBeLessThan(initial.cannabinoidReport.rates.cbda);
    expect(older.cannabinoidReport.totals.cbd).toBeLessThan(initial.cannabinoidReport.totals.cbd);
    expect(older.cannabinoidReport.totals.cbn).toBeGreaterThan(initial.cannabinoidReport.totals.cbn);
    expect(older.cannabinoidReport.totals.thc).toBeLessThan(initial.cannabinoidReport.totals.thc);
    expect(older.conditionScore).toBeLessThan(initial.conditionScore);
  });

  it("allows the actual verdict as a reference without rewriting chemistry or baseline", () => {
    const lot = createLot(), saved = structuredClone(lot);
    const original = projectKqStorageLot(lot, atDay(60)), override = projectKqStorageLot(lot, atDay(60), 6.1);
    expect(override.conditionScore).toBe(5.9);
    expect(override.qualityDelta).toBe(original.qualityDelta);
    expect(override.cannabinoidReport).toEqual(original.cannabinoidReport);
    expect(lot).toEqual(saved);
  });

  it("rejects malformed or non-monotonic persisted lots and invalid clocks", () => {
    const lot = createLot();
    expect(isKqStorageLot(lot)).toBe(true);
    for (const invalid of [null, {}, { ...lot, methodCode: "invented" }, { ...lot, curingStartedAt: "invalid" },
      { ...lot, readyAt: lot.curingStartedAt }, { ...lot, exposure: { aromaWeightedMs: -1, chemistryWeightedMs: 0 } },
      { ...lot, baseline: { ...lot.baseline, care: { ...lot.baseline.care, cannabinoidExpression: 100 } } }]) expect(isKqStorageLot(invalid)).toBe(false);
    expect(() => projectKqStorageLot(lot, NaN)).toThrow();
    expect(() => projectKqStorageLot(lot, origin, 11)).toThrow();
    expect(() => createKqStorageLot({ flowerId: "x", harvestedAt: new Date(origin).toISOString(), curingStartedAt: new Date(origin - 1).toISOString(), baseline })).toThrow();
  });
});

describe("finite warehouse containers", () => {
  const allocate = (totalUnits: number, ownedContainers: Record<string, number> = { ...KQ_STARTER_STORAGE_CONTAINERS }) => planKqStorageAllocation({ totalUnits, ownedContainers, nowMs: origin, preferredMethodCode: "STORAGE-GLASS" });

  it("offers several real container sizes and a finite 100 g starter capacity", () => {
    expect(KQ_STORAGE_CONTAINERS).toHaveLength(10);
    expect(new Set(KQ_STORAGE_CONTAINERS.map(item => item.code)).size).toBe(10);
    expect(KQ_STORAGE_CONTAINERS.every(item => item.capacityUnits > 0 && Number.isInteger(item.capacityUnits) && item.priceCents > 0)).toBe(true);
    const inventory = getKqStorageInventory(KQ_STARTER_STORAGE_CONTAINERS);
    expect(inventory.reduce((sum, item) => sum + item.ownedQuantity * item.capacityUnits, 0)).toBe(1000);
    expect(allocate(1001).overflowDeadlineAt).toBe(new Date(origin + 60 * 60 * 1000).toISOString());
    expect(KQ_STORAGE_OVERFLOW_GRACE_MS).toBe(60 * 60 * 1000);
  });

  it("reserves a whole jar even when the lot only fills a small part", () => {
    const first = allocate(10);
    expect(first.allocations).toEqual([{ containerCode: "GLASS-1L", quantity: 1, storedUnits: 10 }]);
    const second = planKqStorageAllocation({ totalUnits: 800, ownedContainers: KQ_STARTER_STORAGE_CONTAINERS, reservedAllocations: first.allocations, nowMs: origin });
    expect(projectKqStorageCapacity(second, origin)).toMatchObject({ protectedUnits: 500, overflowUnits: 300, reservedCapacityUnits: 500 });
    expect(getKqStorageInventory(KQ_STARTER_STORAGE_CONTAINERS, [...first.allocations, ...second.allocations])[0]).toMatchObject({ occupiedQuantity: 2, freeQuantity: 0, storedUnits: 510 });
    expect(() => getKqStorageInventory({ "GLASS-1L": 1 }, [...first.allocations, ...second.allocations])).toThrow();
  });

  it("reserves finite 60 L drums without sharing their unused room between harvests", () => {
    const capacity = allocate(30_001, { "CURTEC-60L": 1 });
    expect(capacity.allocations).toEqual([{ containerCode: "CURTEC-60L", quantity: 1, storedUnits: 30_000 }]);
    expect(projectKqStorageCapacity(capacity, origin)).toMatchObject({ protectedUnits: 30_000, overflowUnits: 1 });
    expect(getKqStorageInventory({ "CURTEC-60L": 1 }, capacity.allocations).find(item => item.code === "CURTEC-60L")).toMatchObject({ freeQuantity: 0 });
  });

  it("fills mixed formats without treating one purchased jar as unlimited protection", () => {
    const capacity = allocate(2400, { "GLASS-1L": 1, "GLASS-2L": 1, "GLASS-3L": 1 });
    expect(capacity.allocations).toEqual([
      { containerCode: "GLASS-3L", quantity: 1, storedUnits: 1500 },
      { containerCode: "GLASS-2L", quantity: 1, storedUnits: 900 },
    ]);
    expect(capacity.overflowDeadlineAt).toBe(new Date(origin + KQ_STORAGE_OVERFLOW_GRACE_MS).toISOString());
    expect(projectKqStorageCapacity(allocate(4000, { "GLASS-2L": 1 }), origin)).toMatchObject({ protectedUnits: 1000, overflowUnits: 3000 });
  });

  it("prioritizes the selected method and then the best available protection", () => {
    const capacity = allocate(1500, { "GLASS-1L": 1, "GROVE-1OZ": 5, "CVAULT-2OZ": 1 });
    expect(capacity.allocations).toEqual([
      { containerCode: "GLASS-1L", quantity: 1, storedUnits: 500 },
      { containerCode: "CVAULT-2OZ", quantity: 1, storedUnits: 560 },
      { containerCode: "GROVE-1OZ", quantity: 2, storedUnits: 440 },
    ]);
    const lot = changeKqStorageCapacity(createLot(), capacity, origin);
    expect(getKqStorageExposureRates(lot)).toEqual({ aromaRate: 73, chemistryRate: 76 });
    expect(projectKqStorageLot(lot, origin).methodName).toBe("Contenants mixtes");
  });

  it("includes unprotected overflow in the weighted exposure and resolves the exact real deadline", () => {
    const capacity = allocate(1000, { "CVAULT-2OZ": 1 });
    const lot = changeKqStorageCapacity(createLot(), capacity, origin);
    expect(getKqStorageExposureRates(lot)).toEqual({ aromaRate: 70, chemistryRate: 72 });
    expect(projectKqStorageCapacity(capacity, origin + KQ_STORAGE_OVERFLOW_GRACE_MS - 1).overflowDue).toBe(false);
    expect(projectKqStorageCapacity(capacity, origin + KQ_STORAGE_OVERFLOW_GRACE_MS).overflowDue).toBe(true);
    expect(projectKqStorageLot(lot, origin + KQ_STORAGE_OVERFLOW_GRACE_MS)).toMatchObject({
      stage: "curing", remainingMs: 5 * 60 * 60 * 1000,
      nextChangeAt: new Date(origin + KQ_GAME_DAY_MS).toISOString(),
    });
    expect(projectKqStorageLot(lot, origin + KQ_STORAGE_OVERFLOW_GRACE_MS - 1).nextChangeAt).toBe(capacity.overflowDeadlineAt);
    expect(projectKqStorageLot(lot, origin).readyAt).toBe(createLot().readyAt);
  });

  it("fills existing shortages after purchases without moving previously protected flowers", () => {
    const capacity = allocate(1600);
    const filled = fillKqStorageCapacity(capacity, { ownedContainers: { ...KQ_STARTER_STORAGE_CONTAINERS, "CVAULT-2OZ": 2 }, preferredMethodCode: "STORAGE-CVAULT", nowMs: origin + 1000 });
    expect(filled.allocations).toEqual([
      { containerCode: "GLASS-1L", quantity: 2, storedUnits: 1000 },
      { containerCode: "CVAULT-2OZ", quantity: 2, storedUnits: 600 },
    ]);
    expect(projectKqStorageCapacity(filled, origin)).toMatchObject({ protectedUnits: 1600, overflowUnits: 0, reservedCapacityUnits: 2120 });
    expect(filled.overflowDeadlineAt).toBe(capacity.overflowDeadlineAt);
    expect(capacity.allocations).toEqual([{ containerCode: "GLASS-1L", quantity: 2, storedUnits: 1000 }]);
  });

  it("does not move premium-stored flowers into spare space in earlier merged jars", () => {
    const deadline = new Date(origin + KQ_STORAGE_OVERFLOW_GRACE_MS).toISOString();
    const capacity = { totalUnits: 1260, overflowDeadlineAt: deadline, allocations: [
      { containerCode: "GLASS-1L" as const, quantity: 1, storedUnits: 500 },
      { containerCode: "CVAULT-2OZ" as const, quantity: 1, storedUnits: 560 },
    ] };
    const filled = fillKqStorageCapacity(capacity, { ownedContainers: { "GLASS-1L": 2, "CVAULT-2OZ": 1 }, nowMs: origin });
    expect(filled.allocations).toEqual([
      { containerCode: "GLASS-1L", quantity: 2, storedUnits: 700 },
      { containerCode: "CVAULT-2OZ", quantity: 1, storedUnits: 560 },
    ]);
    expect(fillKqStorageCapacity(filled, { ownedContainers: { "GLASS-1L": 2, "CVAULT-2OZ": 1, "CANNATROL": 1 }, nowMs: origin + 1 })).toEqual(filled);
    expect(resizeKqStorageCapacity(filled, 1160).allocations).toEqual([
      { containerCode: "GLASS-1L", quantity: 2, storedUnits: 700 },
      { containerCode: "CVAULT-2OZ", quantity: 1, storedUnits: 460 },
    ]);
  });

  it("keeps a shortage deadline through resolving it, changing protection and overflowing again", () => {
    const initial = changeKqStorageCapacity(createLot(), allocate(1600), origin);
    const protectedCapacity = allocate(1600, { "CANNATROL": 1 });
    const protectedLot = changeKqStorageCapacity(initial, protectedCapacity, origin + 1000);
    expect(protectedLot.capacity?.overflowDeadlineAt).toBe(initial.capacity?.overflowDeadlineAt);
    expect(protectedLot.exposure.aromaWeightedMs).toBe(100000);
    const newShortage = planKqStorageAllocation({ totalUnits: 1600, ownedContainers: KQ_STARTER_STORAGE_CONTAINERS, nowMs: origin + 2000 });
    const reassigned = changeKqStorageCapacity(protectedLot, newShortage, origin + 2000);
    expect(reassigned.capacity?.overflowDeadlineAt).toBe(initial.capacity?.overflowDeadlineAt);
    expect(reassigned.exposure.aromaWeightedMs).toBe(125000);
    expect(reassigned.readyAt).toBe(initial.readyAt);
  });

  it("anchors the one hour at the verdict even when the initial harvest fits", () => {
    const capacity = allocate(1000);
    expect(projectKqStorageCapacity(capacity, origin).overflowUnits).toBe(0);
    const initial = changeKqStorageCapacity(createLot(), capacity, origin);
    const changedAt = origin + 40 * 60 * 1000;
    const newCapacity = planKqStorageAllocation({ totalUnits: 1000, ownedContainers: { "GLASS-1L": 1 }, nowMs: changedAt });
    const changed = changeKqStorageCapacity(initial, newCapacity, changedAt);
    expect(changed.capacity?.overflowDeadlineAt).toBe(new Date(origin + KQ_STORAGE_OVERFLOW_GRACE_MS).toISOString());
    expect(projectKqStorageLot(changed, origin + KQ_STORAGE_OVERFLOW_GRACE_MS).capacity?.overflowDue).toBe(true);
  });

  it("frees only whole containers after sales and sells overflow before protected volume", () => {
    const initial = allocate(1800);
    const overflowSold = resizeKqStorageCapacity(initial, 1000);
    expect(overflowSold.allocations).toEqual(initial.allocations);
    expect(projectKqStorageCapacity(overflowSold, origin).overflowUnits).toBe(0);
    expect(resizeKqStorageCapacity(overflowSold, 501).allocations).toEqual([{ containerCode: "GLASS-1L", quantity: 2, storedUnits: 501 }]);
    expect(resizeKqStorageCapacity(overflowSold, 500).allocations).toEqual([{ containerCode: "GLASS-1L", quantity: 1, storedUnits: 500 }]);
    expect(resizeKqStorageCapacity(overflowSold, 0).allocations).toEqual([]);
    expect(resizeKqStorageCapacity(overflowSold, 0).overflowDeadlineAt).toBe(initial.overflowDeadlineAt);
    expect(() => resizeKqStorageCapacity(initial, 1801)).toThrow();
  });

  it("rejects duplicated, fractional, oversized or unbounded reservations", () => {
    const valid = allocate(1000);
    for (const invalid of [
      { ...valid, totalUnits: 1.5 }, { ...valid, allocations: [...valid.allocations, ...valid.allocations] },
      { ...valid, totalUnits: 1001, overflowDeadlineAt: null },
      { ...valid, allocations: [{ containerCode: "GLASS-1L", quantity: 1, storedUnits: 501 }] },
      { ...valid, allocations: [{ containerCode: "GLASS-1L", quantity: 3, storedUnits: 1000 }] },
      { ...valid, allocations: [{ containerCode: "fake", quantity: 1, storedUnits: 10 }] },
    ]) expect(isKqStorageCapacity(invalid)).toBe(false);
    expect(isKqStorageLot({ ...createLot(), capacity: { ...valid, overflowDeadlineAt: "tomorrow" } })).toBe(false);
    expect(() => allocate(1, { "GLASS-1L": -1 })).toThrow();
    expect(() => allocate(1, { "GLASS-1L": .5 })).toThrow();
  });

  it("conserves volume and whole-container ownership across varied harvests and sales", () => {
    for (let sample = 0; sample < 150; sample++) {
      const ownedContainers = Object.fromEntries(KQ_STORAGE_CONTAINERS.map((container, index) => [container.code, (sample * (index + 3) + index) % 5]));
      const first = planKqStorageAllocation({ totalUnits: (sample * 997) % 70000, ownedContainers, preferredMethodCode: KQ_STORAGE_METHODS[sample % KQ_STORAGE_METHODS.length].code, nowMs: origin });
      const second = planKqStorageAllocation({ totalUnits: (sample * 587) % 50000, ownedContainers, reservedAllocations: first.allocations, nowMs: origin });
      for (const capacity of [first, second]) {
        const projection = projectKqStorageCapacity(capacity, origin);
        expect(isKqStorageCapacity(capacity)).toBe(true);
        expect(projection.protectedUnits + projection.overflowUnits).toBe(capacity.totalUnits);
        expect(projection.reservedCapacityUnits).toBeGreaterThanOrEqual(projection.protectedUnits);
        const sold = resizeKqStorageCapacity(capacity, Math.floor(capacity.totalUnits / 3));
        expect(isKqStorageCapacity(sold)).toBe(true);
        expect(sold.overflowDeadlineAt).toBe(capacity.overflowDeadlineAt);
      }
      const inventory = getKqStorageInventory(ownedContainers, [...first.allocations, ...second.allocations]);
      expect(inventory.every(item => item.occupiedQuantity <= item.ownedQuantity && item.freeQuantity >= 0)).toBe(true);
      if (projectKqStorageCapacity(second, origin).overflowUnits > 0) expect(inventory.every(item => item.freeQuantity === 0)).toBe(true);
    }
  });
});
