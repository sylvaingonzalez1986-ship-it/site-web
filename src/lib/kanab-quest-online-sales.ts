import { KQ_MARKET_ROUTE_CODES, type KqMarketRouteCode } from "./kanab-quest-market";
import { KQ_MERCH_PRODUCTS } from "./kanab-quest-merch";
import type { KqShopActivityReceipt } from "./kanab-quest-shop-activity";

/** Completed online sales, including packets whose listing has since sold out. */
export type KqOnlineSalesReceipt = KqShopActivityReceipt & { route?: KqMarketRouteCode };

export type KqOnlineSalesPage = {
  receipts: KqOnlineSalesReceipt[];
  /** Opaque continuation token; null means every older receipt has been read. */
  nextCursor: string | null;
};

const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const count = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const optionalAmount = (value: unknown) => value === null || count(value);

/** Both official pages and the local tutorial use the same receipt contract.
 * Unknown historical amounts stay null instead of being displayed as zero. */
export function isKqOnlineSalesPage(value: unknown): value is KqOnlineSalesPage {
  if (!record(value) || !Array.isArray(value.receipts) || value.receipts.length > 100
    || (value.nextCursor !== null && (typeof value.nextCursor !== "string" || value.nextCursor.length < 1 || value.nextCursor.length > 512))) return false;
  const ids = new Set<string>();
  return value.receipts.every((sale: unknown) => {
    if (!record(sale) || typeof sale.id !== "string" || !sale.id || ids.has(sale.id)
      || typeof sale.name !== "string" || !sale.name.trim() || typeof sale.soldAt !== "string" || !Number.isFinite(Date.parse(sale.soldAt))
      || !count(sale.quantity) || sale.quantity < 1 || !optionalAmount(sale.netPayoutCents)
      || !optionalAmount(sale.revenueCents) || !optionalAmount(sale.feesCents) || !optionalAmount(sale.costCents)) return false;
    ids.add(sale.id);
    if (sale.kind === "merch") return sale.unitLabel === "articles" && sale.formatGrams === null && sale.satisfaction === null
      && KQ_MERCH_PRODUCTS.some(product => product.code === sale.code);
    return sale.kind === "flower" && sale.unitLabel === "paquets" && (sale.formatGrams === null || sale.formatGrams === 5 || sale.formatGrams === 10)
      && sale.costCents === null && (sale.satisfaction === null || (typeof sale.satisfaction === "number" && Number.isFinite(sale.satisfaction)
        && sale.satisfaction >= 0 && sale.satisfaction <= 100))
      && (sale.route === undefined || KQ_MARKET_ROUTE_CODES.includes(sale.route as KqMarketRouteCode));
  });
}
