import { getKqCareProblem, getKqCareProduct, KQ_CARE_PRODUCTS, type KqCareProduct } from "./kanab-quest-care";
import type { KqGameState } from "./kanab-quest-game";

export type KqCareReserveMatch = { product: KqCareProduct; problemLabels: string[] };
export type KqCareReserveSnapshot = {
  cashCents: number;
  inventory: Record<string, number>;
  prices: Record<string, number>;
};

/** A matching target does not imply permission to apply the product now. */
export function getKqCareReserveProducts(state?: KqGameState): KqCareReserveMatch[] {
  const problems = (state?.care?.problems ?? []).flatMap(problem => {
    const definition = getKqCareProblem(problem.code);
    return definition ? [definition] : [];
  });
  return KQ_CARE_PRODUCTS.flatMap(product => {
    const problemLabels = [...new Set(problems
      .filter(problem => product.targets.includes(problem.target))
      .map(problem => problem.name))];
    return problemLabels.length ? [{ product, problemLabels }] : [];
  });
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const isAmount = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

/** Only a complete, valid inventory can establish that an absent item has zero stock.
 * A missing catalogue price remains unavailable; local reference prices are not substituted. */
export function parseKqCareReserveSnapshot(value: unknown): KqCareReserveSnapshot | null {
  if (!isRecord(value) || !isAmount(value.cashCents) || !Array.isArray(value.inventory) || !Array.isArray(value.catalog)) return null;
  const inventory: Record<string, number> = {};
  for (const item of value.inventory) {
    if (!isRecord(item) || typeof item.productCode !== "string" || !getKqCareProduct(item.productCode)
      || !isAmount(item.quantity) || Object.hasOwn(inventory, item.productCode)) return null;
    inventory[item.productCode] = item.quantity;
  }
  const prices: Record<string, number> = {};
  const catalogCodes = new Set<string>();
  for (const product of value.catalog) {
    if (!isRecord(product) || typeof product.code !== "string" || !getKqCareProduct(product.code) || catalogCodes.has(product.code)) return null;
    catalogCodes.add(product.code);
    if (product.priceCents === undefined) continue;
    if (!isAmount(product.priceCents)) return null;
    prices[product.code] = product.priceCents;
  }
  return { cashCents: value.cashCents, inventory, prices };
}
