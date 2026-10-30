import { describe, expect, it } from "vitest";
import { getKqStorageStockBreakdown } from "./kanab-quest-storage-breakdown";
import type { KqOnlineListing } from "./kanab-quest-online";
import type { KqStorageCapacity } from "./kanab-quest-storage";

const listing = (overrides: Partial<KqOnlineListing> = {}): KqOnlineListing => ({ id: "listing", stockId: "stock", name: "Lot", route: "raw",
  formatGrams: 5, packagingCode: "kraft-5", packetPriceCents: 1000, initialPackets: 147, remainingPackets: 147,
  soldPackets: 0, status: "active", qualityScore: 8, baseUnitCents: 1, createdAt: "2026-10-29T12:00:00Z", equivalentUnitsPerProductUnit: 1, ...overrides });
const capacities: KqStorageCapacity[] = [{ totalUnits: 1000, allocations: [{ containerCode: "GLASS-1L", quantity: 1, storedUnits: 500 }], automaticOverflowSale: false, overflowDeadlineAt: null }];

describe("explicit storage inventory pools", () => {
  it("reports 735 g entirely packaged with no occupied bulk container", () => {
    expect(getKqStorageStockBreakdown({ capacities: [], listings: [listing()], stocks: [] })).toEqual({
      bulkUnits: 0, bulkProtectedUnits: 0, bulkOverflowUnits: 0, packedUnits: 7350,
      packedActiveUnits: 7350, packedPausedUnits: 0, packedOtherUnits: 0, packedPackets: 147,
    });
  });
  it("keeps overflow inside bulk and separates active, paused, closed and quality-blocked packets", () => {
    expect(getKqStorageStockBreakdown({ capacities, listings: [
      listing({ remainingPackets: 2 }), listing({ status: "paused", remainingPackets: 3 }), listing({ status: "closed", remainingPackets: 4 }),
      listing({ status: "active", qualityScore: 5, remainingPackets: 1 }), listing({ status: "discarded", remainingPackets: 0 }), listing({ status: "sold-out", remainingPackets: 0 }),
    ], stocks: [] })).toEqual({ bulkUnits: 1000, bulkProtectedUnits: 500, bulkOverflowUnits: 500, packedUnits: 500,
      packedActiveUnits: 100, packedPausedUnits: 150, packedOtherUnits: 250, packedPackets: 10 });
  });
  it("preserves the actual extraction ratio even when no bulk stock remains", () => {
    const result = getKqStorageStockBreakdown({ capacities: [], listings: [listing({ route: "rosin-selection", remainingPackets: 1, equivalentUnitsPerProductUnit: 10 / 3 })], stocks: [] })!;
    expect(result.packedUnits).toBeCloseTo(500 / 3);
    expect(result.packedPackets).toBe(1);
  });
  it("uses an explicit source-stock ratio for older saved listings and never guesses a missing ratio", () => {
    const old = listing({ equivalentUnitsPerProductUnit: undefined, remainingPackets: 1 });
    expect(getKqStorageStockBreakdown({ capacities: [], listings: [old], stocks: [{ id: "stock", initialUnits: 100, equivalentUnits: 300 }] })?.packedUnits).toBe(150);
    expect(getKqStorageStockBreakdown({ capacities: [], listings: [old], stocks: [] })).toBeUndefined();
  });
});
