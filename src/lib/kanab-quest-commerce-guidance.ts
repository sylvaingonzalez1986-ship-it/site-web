import type { KqStorageSnapshot } from "./kanab-quest-api";
import { quoteKqCommerce, type KqCommerceSnapshot } from "./kanab-quest-commerce";
import { getKqStorageHarvestOverview, isKqHarvestBeforeJury } from "./kanab-quest-harvests";

/** Read only the fields needed for advice; absent conservation details stay unknown. */
export function isKqCommerceWaitingStorage(value: unknown): value is KqStorageSnapshot {
  if (!value || typeof value !== "object") return false;
  const storage = value as KqStorageSnapshot;
  return Number.isFinite(Date.parse(storage.serverNow)) && Array.isArray(storage.lots) && storage.lots.every(lot =>
    lot && typeof lot.flowerId === "string" && typeof lot.varietyName === "string"
    && typeof lot.flowerStatus === "string" && lot.projection
    && ["curing", "ready"].includes(lot.projection.stage)
    && (lot.projection.capacity?.overflowUnits === undefined || (Number.isFinite(lot.projection.capacity.overflowUnits) && lot.projection.capacity.overflowUnits >= 0)));
}

export function getKqCommerceWaitingHarvest(storage: KqStorageSnapshot | null) {
  return getKqStorageHarvestOverview(storage ? { ...storage, lots: storage.lots.filter(lot =>
    isKqHarvestBeforeJury(lot) || (Number.isFinite(lot.projection.capacity?.overflowUnits) && lot.projection.capacity!.overflowUnits > 0)) } : null).advice;
}

export function getKqCommercePackagedStock(data: KqCommerceSnapshot) {
  const listings = data.online?.listings;
  if (!Array.isArray(listings) || listings.some(listing => !Number.isFinite(listing.remainingPackets) || listing.remainingPackets < 0
    || !Number.isFinite(listing.formatGrams) || listing.formatGrams <= 0)) return null;
  return listings.reduce((total, listing) => ({ packets: total.packets + listing.remainingPackets, grams: total.grams + listing.remainingPackets * listing.formatGrams }), { packets: 0, grams: 0 });
}

/** A professional sale needs neither a website nor a computer. Quotes keep their own gates. */
export function hasKqCommerceProfessionalLot(data: KqCommerceSnapshot, now?: number) {
  return data.rawLots.some(lot => lot.harvestGrams > 0 && lot.options.some(option => option.available && ["raw", "biomass"].includes(option.route)))
    || data.stocks.some(stock => stock.remainingUnits > 0 && (["wholesale", "cbd-shop"] as const).some(channel => quoteKqCommerce(data, stock, channel, "advised", undefined, now).maxUnits > 0));
}
