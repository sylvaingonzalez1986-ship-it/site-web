import { canApplyKqCareProduct, canPerformKqBasicCare, getKqCareProblem, getKqCareProduct, KQ_CARE_PRODUCTS, type KqCareProduct } from "./kanab-quest-care";
import type { KqGameState } from "./kanab-quest-game";

export type KqCareReserveMatch = { product: KqCareProduct; problemLabels: string[] };
export type KqCareReserveSnapshot = {
  cashCents: number;
  inventory: Record<string, number>;
  prices: Record<string, number>;
  basicCarePriceCents?: number;
  areaM2?: number | null;
  pricingUnits?: number;
  legacyInventory?: Record<string, number>;
  areaInventory?: Record<string, number>;
};

export type KqCareAvailabilityNotice = { scope: string; count: number | null };

/** A quote is tied to the culture, its surface and the exact intervention window. */
export function getKqCareAvailabilityScope(state: KqGameState, runId?: string | null): string {
  return JSON.stringify([runId ?? null, state.seed, state.startedAt, state.stageIndex, state.phase,
    state.rulesVersion, state.cultureDead, state.warehouse?.activeAreaM2, state.equipment?.productionUnits, state.campaign, state.care]);
}

/** Counts choices, never doses or catalogue matches. The inventory already contains
 * complete passages for the quoted surface; partial coverage is not usable stock. */
export function getKqCareActionAvailability(snapshot: KqCareReserveSnapshot | null, state?: KqGameState) {
  if (!snapshot) return null;
  const usable = state ? KQ_CARE_PRODUCTS.filter(product => (snapshot.inventory[product.code] ?? 0) > 0
    && canApplyKqCareProduct(state, product.code).allowed) : [];
  const affordable = KQ_CARE_PRODUCTS.filter(product => snapshot.prices[product.code] !== undefined
    && snapshot.cashCents >= snapshot.prices[product.code]);
  const basic = !!state && canPerformKqBasicCare(state).allowed
    && snapshot.basicCarePriceCents !== undefined && snapshot.basicCarePriceCents > 0
    && snapshot.cashCents >= snapshot.basicCarePriceCents;
  const context = new Set(getKqCareReserveProducts(state).map(match => match.product.code));
  return {
    total: usable.length + Number(basic), products: usable.length, basic: Number(basic),
    usable: { input: usable.filter(product => product.kind === "input").length,
      pbi: usable.filter(product => product.kind === "pbi").length,
      context: usable.filter(product => context.has(product.code)).length },
    affordable: { input: affordable.filter(product => product.kind === "input").length,
      pbi: affordable.filter(product => product.kind === "pbi").length },
  };
}

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
  const legacyInventory: Record<string, number> = {}, areaInventory: Record<string, number> = {};
  for (const item of value.inventory) {
    if (!isRecord(item) || typeof item.productCode !== "string" || !getKqCareProduct(item.productCode)
      || !isAmount(item.quantity) || Object.hasOwn(inventory, item.productCode)) return null;
    inventory[item.productCode] = item.quantity;
    if (item.legacyQuantity !== undefined) { if (!isAmount(item.legacyQuantity)) return null; legacyInventory[item.productCode] = item.legacyQuantity; }
    if (item.areaQuantity !== undefined) { if (!isAmount(item.areaQuantity)) return null; areaInventory[item.productCode] = item.areaQuantity; }
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
  if (value.areaM2 !== undefined && value.areaM2 !== null && (!isAmount(value.areaM2) || value.areaM2 <= 0)) return null;
  if (value.pricingUnits !== undefined && (!isAmount(value.pricingUnits) || value.pricingUnits <= 0)) return null;
  if (value.basicCarePriceCents !== undefined && !isAmount(value.basicCarePriceCents)) return null;
  return { cashCents: value.cashCents, inventory, prices,
    ...(value.basicCarePriceCents !== undefined ? { basicCarePriceCents: value.basicCarePriceCents as number } : {}),
    ...(value.areaM2 !== undefined ? { areaM2: value.areaM2 as number | null } : {}),
    ...(value.pricingUnits !== undefined ? { pricingUnits: value.pricingUnits as number } : {}),
    ...(Object.keys(legacyInventory).length ? { legacyInventory } : {}),
    ...(Object.keys(areaInventory).length ? { areaInventory } : {}) };
}
