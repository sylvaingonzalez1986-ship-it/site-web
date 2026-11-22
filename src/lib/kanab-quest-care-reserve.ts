import { canApplyKqCareProduct, canPerformKqBasicCare, getKqCarePricing, getKqCareProblem, getKqCareProduct, kqCareProductMatchesProblem, KQ_CARE_PRODUCTS, type KqCareProduct } from "./kanab-quest-care";
import { getKqCareProblemPlants, getKqCareSectors, isKqRunSector, sectorKey, type KqCareSector } from "./kanab-quest-care-spatial";
import { getKqZoneIdentity } from "./kanab-quest-zone-identity";
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
  zoneQuantities?: Record<string, Record<string, number>>;
};

export type KqCareAvailabilityNotice = { scope: string; count: number | null };

export function getKqCareZoneStock(snapshot: KqCareReserveSnapshot, code: string, zoneId: string) {
  const zones = snapshot.zoneQuantities?.[code];
  return zones ? zones[zoneId] ?? 0 : snapshot.inventory[code] ?? 0;
}

export function getKqCareSectorLabel(state: KqGameState, target: KqCareSector) {
  const plan = state.campaign?.members.find(member => member.zoneId === target.zoneId)?.warehouse.sourceState ?? state.warehouse?.sourceState;
  const zone = plan && getKqZoneIdentity(plan, target.zoneId);
  const name = plan?.zones.find(zone => zone.id === target.zoneId)?.name;
  return `${zone?.label ?? target.zoneId}${name && name !== zone?.label ? ` · ${name}` : ""}, case ${target.x + 1}, ${target.y + 1}`;
}

export function getKqCareFocusSectors(state: KqGameState, product: KqCareProduct) {
  const sectors = new Map<string, KqCareSector>();
  for (const problem of state.care?.problems ?? []) {
    const definition = getKqCareProblem(problem.code);
    if (!definition || !kqCareProductMatchesProblem(product, definition)) continue;
    for (const { zoneId, x, y } of getKqCareProblemPlants(state, problem)) {
      const target = { zoneId, x, y };
      if (isKqRunSector(state, target)) sectors.set(sectorKey(target), target);
    }
  }
  return [...sectors.values()];
}

export function getKqCareStockQuantity(legacyQuantity: number, areaQuantity: number, pricingUnits: number, targeted: boolean) {
  return targeted ? legacyQuantity * pricingUnits + areaQuantity : legacyQuantity + Math.floor(areaQuantity / pricingUnits);
}

export function getKqCareInventoryRows(state: KqGameState | undefined, inventory: Record<string, number>, areaInventory?: Record<string, number>) {
  const { pricingUnits } = getKqCarePricing(state);
  const hasSectors = !!state && getKqCareSectors(state).length > 0;
  return KQ_CARE_PRODUCTS.map(({ code: productCode }) => {
    const legacyQuantity = inventory[productCode] ?? 0;
    const areaQuantity = areaInventory?.[productCode] ?? 0;
    return { productCode, legacyQuantity, areaQuantity,
      quantity: getKqCareStockQuantity(legacyQuantity, areaQuantity, pricingUnits, hasSectors) };
  });
}

/** A targeted release uses loose coverage first, opening a legacy passage only when needed. */
export function consumeKqCareStock(inventory: Record<string, number>, areaInventory: Record<string, number> | undefined,
  code: string, pricingUnits: number, targeted: boolean) {
  const area = areaInventory?.[code] ?? 0;
  const legacy = inventory[code] ?? 0;
  if (legacy > 0 && (!targeted || area === 0)) {
    const remainingArea = targeted ? { ...areaInventory, [code]: pricingUnits - 1 } : areaInventory;
    return { inventory: { ...inventory, [code]: legacy - 1 }, ...(remainingArea && { areaInventory: remainingArea }) };
  }
  const required = targeted ? 1 : pricingUnits;
  if (area < required) throw new Error("Réserve insuffisante pour la surface cultivée.");
  return { inventory, areaInventory: { ...areaInventory, [code]: area - required } };
}

/** A quote is tied to the culture, its surface and the exact intervention window. */
export function getKqCareAvailabilityScope(state: KqGameState, runId?: string | null): string {
  return JSON.stringify([runId ?? null, state.seed, state.startedAt, state.stageIndex, state.phase,
    state.rulesVersion, state.cultureDead, state.warehouse?.activeAreaM2, state.equipment?.productionUnits, state.campaign, state.care]);
}

/** Inventory expresses usable applications, either one sector or one complete passage. */
export function getKqCareActionAvailability(snapshot: KqCareReserveSnapshot | null, state?: KqGameState) {
  if (!snapshot) return null;
  const sectors = state && snapshot.zoneQuantities ? getKqCareSectors(state) : [];
  const usable = state ? KQ_CARE_PRODUCTS.filter(product => {
    if (!(snapshot.inventory[product.code] > 0) || !canApplyKqCareProduct(state, product.code).allowed) return false;
    if (!sectors.length || !snapshot.zoneQuantities?.[product.code]) return true;
    return sectors.some(target => getKqCareZoneStock(snapshot, product.code, target.zoneId) > 0
      && canApplyKqCareProduct(state, product.code, target).allowed);
  }) : [];
  const affordable = KQ_CARE_PRODUCTS.filter(product => snapshot.prices[product.code] !== undefined
    && snapshot.cashCents >= snapshot.prices[product.code]);
  const basic = !!state && canPerformKqBasicCare(state).allowed
    && snapshot.basicCarePriceCents !== undefined && snapshot.basicCarePriceCents > 0
    && snapshot.cashCents >= snapshot.basicCarePriceCents;
  const context = new Set(getKqCareReserveProducts(state).filter(match => {
    const sectors = state && getKqCareFocusSectors(state, match.product);
    return !state || !sectors?.length || sectors.some(target => getKqCareZoneStock(snapshot, match.product.code, target.zoneId) > 0
      && canApplyKqCareProduct(state, match.product.code, target).allowed);
  }).map(match => match.product.code));
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
      .filter(problem => kqCareProductMatchesProblem(product, problem))
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
  const zoneQuantities: Record<string, Record<string, number>> = {};
  const legacyInventory: Record<string, number> = {}, areaInventory: Record<string, number> = {};
  for (const item of value.inventory) {
    if (!isRecord(item) || typeof item.productCode !== "string" || !getKqCareProduct(item.productCode)
      || !isAmount(item.quantity) || Object.hasOwn(inventory, item.productCode)) return null;
    inventory[item.productCode] = item.quantity;
    if (item.zoneQuantities !== undefined) {
      if (!isRecord(item.zoneQuantities) || !Object.entries(item.zoneQuantities).every(([id, quantity]) =>
        id.length > 0 && id.length <= 128 && isAmount(quantity) && quantity <= (item.quantity as number))) return null;
      zoneQuantities[item.productCode] = item.zoneQuantities as Record<string, number>;
    }
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
    ...(Object.keys(zoneQuantities).length ? { zoneQuantities } : {}),
    ...(value.basicCarePriceCents !== undefined ? { basicCarePriceCents: value.basicCarePriceCents as number } : {}),
    ...(value.areaM2 !== undefined ? { areaM2: value.areaM2 as number | null } : {}),
    ...(value.pricingUnits !== undefined ? { pricingUnits: value.pricingUnits as number } : {}),
    ...(Object.keys(legacyInventory).length ? { legacyInventory } : {}),
    ...(Object.keys(areaInventory).length ? { areaInventory } : {}) };
}
