import { isKqStorageCapacity, type KqStorageCapacity } from "./kanab-quest-storage";
import type { KqOnlineListing } from "./kanab-quest-online";
import type { KqCommerceStock } from "./kanab-quest-commerce";

/** Masses use 0.1 g of raw-flower equivalent, including fractional equivalents
 * for extracts. Packet count is a count, never a mass. Active refers to listing
 * status, independently of whether its shop is currently open. */
export type KqStorageStockBreakdown = {
  bulkUnits: number; bulkProtectedUnits: number; bulkOverflowUnits: number;
  packedUnits: number; packedActiveUnits: number; packedPausedUnits: number; packedOtherUnits: number; packedPackets: number;
};

/** Simulators use the same mutually exclusive pools as the SQL snapshot.
 * Missing conversion data must remain unknown, not become zero or a guessed ratio. */
export function getKqStorageStockBreakdown(input: {
  capacities: readonly KqStorageCapacity[];
  listings: readonly KqOnlineListing[];
  stocks: readonly Pick<KqCommerceStock, "id" | "initialUnits" | "equivalentUnits">[];
}): KqStorageStockBreakdown | undefined {
  if (!input.capacities.every(isKqStorageCapacity)) return undefined;
  const result: KqStorageStockBreakdown = { bulkUnits: 0, bulkProtectedUnits: 0, bulkOverflowUnits: 0,
    packedUnits: 0, packedActiveUnits: 0, packedPausedUnits: 0, packedOtherUnits: 0, packedPackets: 0 };
  for (const capacity of input.capacities) {
    result.bulkUnits += capacity.totalUnits;
    result.bulkProtectedUnits += capacity.allocations.reduce((sum, allocation) => sum + allocation.storedUnits, 0);
  }
  result.bulkOverflowUnits = result.bulkUnits - result.bulkProtectedUnits;
  for (const listing of input.listings) {
    if (!Number.isSafeInteger(listing.remainingPackets) || listing.remainingPackets < 0) return undefined;
    if (listing.remainingPackets === 0) continue;
    const stock = input.stocks.find(item => item.id === listing.stockId);
    const ratio = listing.equivalentUnitsPerProductUnit ?? (stock && stock.initialUnits > 0 ? stock.equivalentUnits / stock.initialUnits : undefined);
    if (ratio === undefined || !Number.isFinite(ratio) || ratio <= 0 || ![5, 10].includes(listing.formatGrams)) return undefined;
    const units = listing.remainingPackets * listing.formatGrams * 10 * ratio;
    result.packedUnits += units;
    result.packedPackets += listing.remainingPackets;
    if (listing.status === "active" && listing.qualityScore >= 5.8) result.packedActiveUnits += units;
    else if (listing.status === "paused") result.packedPausedUnits += units;
    else result.packedOtherUnits += units;
  }
  return result;
}
