import "server-only";

import { getChanvrierSalesMultiplier } from "@/lib/arena-chanvrier";
import { getKqCommerceReplenishment, getKqShopBudget, KQ_DEMAND_REFILL_MS, type KqCommerceState } from "@/lib/kanab-quest-commerce";
import { createSupabaseServiceClient } from "./admin";

export type KqWarehouseSalesForecast = {
  /** Sustainable demand, in dry-flower-equivalent grams per 24 real hours. */
  salesGramsPerDay: number | null;
  wholesaleGramsPerDay: number;
  shopGramsPerDay: number;
  onlineGramsPerDay: number;
  availableNowGrams: number;
  periodHours: 24;
  basis: "raw-equivalent";
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const nonnegative = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
const round = (value: number) => Math.round(value * 100) / 100;

/** Reuses account-wide allowances and per-listing SQL forecasts, never production. */
export function projectKqWarehouseSalesForecast(state: KqCommerceState): KqWarehouseSalesForecast {
  const knownWholesale = nonnegative(state.wholesale?.capacityEquivalentUnits) && nonnegative(state.wholesale?.remainingEquivalentUnits);
  const wholesaleGramsPerDay = knownWholesale ? state.wholesale!.capacityEquivalentUnits / 10 : 0;
  // This is a sustainable daily throughput. Available demand today is reported
  // separately; an exhausted allowance must not become an unlimited buyer.
  const replenishment = state.campaign && state.demand ? getKqCommerceReplenishment(state, "cbd-shop") : null;
  const shopBudgetGrams = state.campaign && replenishment ? getKqShopBudget(state.campaign.shopPartnersStart ?? 0, state.campaign.event)
    * getChanvrierSalesMultiplier(state.strength) / 10 : 0;
  const shopGramsPerDay = shopBudgetGrams * (24 * 60 * 60 * 1000 / KQ_DEMAND_REFILL_MS["cbd-shop"]);
  let onlineGramsPerDay = 0;
  if (state.online?.version === 1 && state.online.site.active) {
    for (const listing of state.online.listings) {
      if (listing.status !== "active" || listing.remainingPackets <= 0 || !nonnegative(listing.offer?.ordersPerDay)) continue;
      const stock = state.stocks.find((item) => item.id === listing.stockId);
      // A gram of extract must be converted with this batch's actual material
      // ratio, not added to grams of flowers as if they were interchangeable.
      // Fully packed lots leave the bulk-stock snapshot. The listing therefore
      // carries its own server-authored ratio instead of losing its sales forecast.
      const ratio = nonnegative(listing.equivalentUnitsPerProductUnit) ? listing.equivalentUnitsPerProductUnit
        : stock && nonnegative(stock.equivalentUnits) && nonnegative(stock.initialUnits) && stock.initialUnits > 0
          ? stock.equivalentUnits / stock.initialUnits : listing.route === "raw" ? 1 : null;
      if (ratio === null || ratio <= 0) continue;
      const grams = Math.min(listing.remainingPackets, listing.offer!.ordersPerDay) * listing.formatGrams;
      onlineGramsPerDay += grams * ratio;
    }
  }
  return {
    salesGramsPerDay: knownWholesale ? round(wholesaleGramsPerDay + shopGramsPerDay + onlineGramsPerDay) : null,
    wholesaleGramsPerDay: round(wholesaleGramsPerDay), shopGramsPerDay: round(shopGramsPerDay), onlineGramsPerDay: round(onlineGramsPerDay),
    availableNowGrams: round((knownWholesale ? state.wholesale!.remainingEquivalentUnits / 10 : 0)
      + shopBudgetGrams * (replenishment?.availableFraction ?? 0)),
    periodHours: 24, basis: "raw-equivalent",
  };
}

export async function getKqWarehouseSalesForecast(userId: string): Promise<KqWarehouseSalesForecast> {
  if (!UUID.test(userId)) throw new Error("Identifiant d’entrepôt invalide.");
  const result = await createSupabaseServiceClient().rpc("rpc_kq_commerce_state", { p_user_id: userId });
  if (result.error) throw new Error(`[supabase:warehouse-flow] ${result.error.message}`);
  const current = result.data as KqCommerceState | null;
  if (!current || !Array.isArray(current.stocks)) throw new Error("[supabase:warehouse-flow] invalid_commerce_snapshot");
  return projectKqWarehouseSalesForecast(current);
}
