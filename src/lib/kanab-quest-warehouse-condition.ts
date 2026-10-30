import { KQ_WAREHOUSE_CATALOG } from "./kanab-quest-warehouse-catalog";
import { getKqWarehouseOption } from "./kanab-quest-warehouse-options";
import { getKqWarehouseZoneQuote, type KqWarehouseState } from "./kanab-quest-warehouse";

export type KqWarehouseAsset = {
  id: string;
  kind: "device" | "option";
  code: string;
  quantity: number;
  /** Actual funded equipment cost, excluding installation and conversion credit. Null means unknown history. */
  purchaseUnitCents: number | null;
  wearPercent: number;
  zoneId: string | null;
  sourceAssetKey?: string;
};
export type KqWarehouseCondition = { version: 1; assets: KqWarehouseAsset[] };
export type KqWarehouseRemovalQuote = {
  zoneId: string; revision: number; resaleCents: number; unknownPurchaseCount: number;
  lines: Array<{ code: string; name: string; quantity: number; wearPercent: number; purchaseCents: number | null; resaleCents: number | null }>;
};

const equipmentKey = (item: Pick<KqWarehouseAsset, "kind" | "code">) => `${item.kind}:${item.code}`;
const natural = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const device = (code: string) => KQ_WAREHOUSE_CATALOG.find(item => item.code === code && (item.kind === "lighting" || item.kind === "air"));

export function isKqWarehouseCondition(value: unknown): value is KqWarehouseCondition {
  if (!record(value) || value.version !== 1 || !Array.isArray(value.assets) || value.assets.length > 20000) return false;
  const ids = new Set<string>();
  for (const item of value.assets) {
    if (!record(item) || typeof item.id !== "string" || !item.id || item.id.length > 200 || ids.has(item.id)
      || typeof item.code !== "string" || (item.kind === "device" ? !device(item.code) : item.kind !== "option" || !getKqWarehouseOption(item.code))
      || !natural(item.quantity) || item.quantity < 1 || item.quantity > 100000
      || (item.purchaseUnitCents !== null && (!natural(item.purchaseUnitCents) || item.purchaseUnitCents > 2147483647))
      || !natural(item.wearPercent) || item.wearPercent > 100
      || (item.zoneId !== null && (typeof item.zoneId !== "string" || !item.zoneId || item.zoneId.length > 80))
      || (item.sourceAssetKey !== undefined && (typeof item.sourceAssetKey !== "string" || !item.sourceAssetKey || item.sourceAssetKey.length > 200))) return false;
    ids.add(item.id);
  }
  return true;
}

export function getKqWarehouseZoneCondition(zoneId: string, assets: readonly KqWarehouseAsset[]) {
  const selected = assets.filter(asset => asset.zoneId === zoneId);
  const quantity = selected.reduce((sum, asset) => sum + asset.quantity, 0);
  if (!quantity) return { wearPercent: null, yieldPercent: null };
  const wearPercent = selected.reduce((sum, asset) => sum + asset.quantity * asset.wearPercent, 0) / quantity;
  return { wearPercent, yieldPercent: 100 - wearPercent / 2 };
}

/** The resale value follows the remaining condition of the funded purchase. */
export function getKqWarehouseAssetResaleCents(asset: KqWarehouseAsset): number | null {
  return asset.purchaseUnitCents === null ? null : Math.floor(asset.purchaseUnitCents * asset.quantity * (100 - asset.wearPercent) / 100);
}

function inventory(state: KqWarehouseState) {
  return [
    ...state.equipment.filter(item => device(item.code)).map(item => ({ ...item, kind: "device" as const })),
    ...(state.optionInventory ?? []).map(item => ({ ...item, kind: "option" as const })),
  ];
}
function demands(state: KqWarehouseState) {
  return state.zones.flatMap(zone => {
    const quote = getKqWarehouseZoneQuote(zone);
    return [...quote.devices.map(item => ({ code: item.code, quantity: item.quantity, kind: "device" as const })),
      ...quote.options.map(item => ({ code: item.code, quantity: item.quantity, kind: "option" as const }))]
      .map(item => ({ ...item, zoneId: zone.id }));
  });
}

/** Validate both the owned totals and the physical allocation, including paused zones. */
export function assertKqWarehouseCondition(state: KqWarehouseState, condition: KqWarehouseCondition) {
  if (!isKqWarehouseCondition(condition)) throw new Error("L’état du matériel est incomplet. Actualise l’entrepôt.");
  const expected = new Map(inventory(state).map(item => [equipmentKey(item), item.quantity]));
  const assigned = new Map(demands(state).map(item => [`${item.zoneId}:${equipmentKey(item)}`, item.quantity]));
  for (const asset of condition.assets) {
    const key = equipmentKey(asset);
    expected.set(key, (expected.get(key) ?? 0) - asset.quantity);
    if (asset.zoneId !== null) {
      const zoneKey = `${asset.zoneId}:${key}`;
      assigned.set(zoneKey, (assigned.get(zoneKey) ?? 0) - asset.quantity);
    }
  }
  if ([...expected.values(), ...assigned.values()].some(quantity => quantity !== 0)) throw new Error("L’affectation du matériel a changé. Actualise l’entrepôt.");
}

/** Keep existing assignments first, then reuse reserve. Splitting never resets condition or price. */
function allocate(state: KqWarehouseState, assets: KqWarehouseAsset[], newId: () => string): KqWarehouseCondition {
  const remaining = new Map(demands(state).map(item => [`${item.zoneId}:${equipmentKey(item)}`, { ...item }]));
  const allocated: KqWarehouseAsset[] = [], reserve: KqWarehouseAsset[] = [];
  for (const asset of assets) {
    const requirement = asset.zoneId === null ? undefined : remaining.get(`${asset.zoneId}:${equipmentKey(asset)}`);
    const kept = Math.min(asset.quantity, requirement?.quantity ?? 0);
    if (kept && requirement) { allocated.push({ ...asset, quantity: kept }); requirement.quantity -= kept; }
    if (asset.quantity > kept) reserve.push({ ...asset, id: kept ? newId() : asset.id, quantity: asset.quantity - kept, zoneId: null });
  }
  for (const requirement of remaining.values()) {
    for (const asset of reserve) {
      if (!requirement.quantity) break;
      if (equipmentKey(asset) !== equipmentKey(requirement) || asset.quantity === 0) continue;
      const quantity = Math.min(requirement.quantity, asset.quantity);
      allocated.push({ ...asset, id: quantity === asset.quantity ? asset.id : newId(), zoneId: requirement.zoneId, quantity });
      asset.quantity -= quantity; requirement.quantity -= quantity;
    }
    if (requirement.quantity) throw new Error("Le matériel de cette zone doit être acheté avant son installation.");
  }
  const result: KqWarehouseCondition = { version: 1, assets: [...allocated, ...reserve.filter(asset => asset.quantity > 0)] };
  assertKqWarehouseCondition(state, result);
  return result;
}

/** Existing acquisition history is unknown; a newly granted starter is explicitly free. */
export function initializeKqWarehouseCondition(state: KqWarehouseState, freeStarter = false, newId: () => string = () => crypto.randomUUID()): KqWarehouseCondition {
  return allocate(state, inventory(state).map(item => ({ ...item, id: newId(), purchaseUnitCents: freeStarter ? 0 : null, wearPercent: 0, zoneId: null })), newId);
}

export function reconcileKqWarehouseCondition(previous: KqWarehouseState, next: KqWarehouseState, condition: KqWarehouseCondition,
  purchase: { requestKey: string; fundedFraction: number; fundedCents?: number; investmentCents?: number }, newId: () => string = () => crypto.randomUUID()): KqWarehouseCondition {
  assertKqWarehouseCondition(previous, condition);
  if (!Number.isFinite(purchase.fundedFraction) || purchase.fundedFraction < 0 || purchase.fundedFraction > 1) throw new Error("Financement du matériel invalide.");
  const exactFunding = purchase.fundedCents !== undefined || purchase.investmentCents !== undefined;
  if (exactFunding && (!natural(purchase.fundedCents) || !natural(purchase.investmentCents) || purchase.fundedCents > purchase.investmentCents)) throw new Error("Financement du matériel invalide.");
  // Integer arithmetic matches PostgreSQL's exact numeric calculation, including a partial conversion credit.
  const fundedUnitPrice = (price: number) => exactFunding
    ? purchase.investmentCents === 0 ? 0 : Number(BigInt(price) * BigInt(purchase.fundedCents!) / BigInt(purchase.investmentCents!))
    : Math.floor(price * purchase.fundedFraction);
  const before = new Map(inventory(previous).map(item => [equipmentKey(item), item.quantity]));
  const nextAssets = condition.assets.map(asset => ({ ...asset }));
  for (const item of inventory(next)) {
    const quantity = item.quantity - (before.get(equipmentKey(item)) ?? 0);
    if (quantity < 0) throw new Error("Une revente doit être confirmée séparément.");
    if (quantity) {
      const price = item.kind === "device" ? device(item.code)!.priceCents : getKqWarehouseOption(item.code)!.equipmentCentsPerM2;
      nextAssets.push({ ...item, id: newId(), quantity, purchaseUnitCents: fundedUnitPrice(price), wearPercent: 0, zoneId: null, sourceAssetKey: `warehouse:${purchase.requestKey}` });
    }
  }
  return allocate(next, nextAssets, newId);
}

export function getKqWarehouseRemovalQuote(state: KqWarehouseState, condition: KqWarehouseCondition, zoneId: string, revision: number): KqWarehouseRemovalQuote {
  assertKqWarehouseCondition(state, condition);
  if (!state.zones.some(zone => zone.id === zoneId)) throw new Error("Cette zone de culture n’existe plus.");
  const assets = condition.assets.filter(asset => asset.zoneId === zoneId);
  return { zoneId, revision, resaleCents: assets.reduce((sum, asset) => sum + (getKqWarehouseAssetResaleCents(asset) ?? 0), 0),
    unknownPurchaseCount: assets.filter(asset => asset.purchaseUnitCents === null).reduce((sum, asset) => sum + asset.quantity, 0),
    lines: assets.map(asset => ({ code: asset.code, name: asset.kind === "device" ? device(asset.code)!.name : getKqWarehouseOption(asset.code)!.name,
      quantity: asset.quantity, wearPercent: asset.wearPercent, purchaseCents: asset.purchaseUnitCents === null ? null : asset.purchaseUnitCents * asset.quantity,
      resaleCents: getKqWarehouseAssetResaleCents(asset) })),
  };
}

export function removeKqWarehouseZone(state: KqWarehouseState, condition: KqWarehouseCondition, zoneId: string, resell: boolean) {
  assertKqWarehouseCondition(state, condition);
  if (!state.zones.some(zone => zone.id === zoneId)) throw new Error("Cette zone de culture n’existe plus.");
  const sold = condition.assets.filter(asset => asset.zoneId === zoneId && resell && asset.purchaseUnitCents !== null);
  const soldIds = new Set(sold.map(asset => asset.id));
  const remaining: KqWarehouseCondition = { version: 1, assets: condition.assets.filter(asset => !soldIds.has(asset.id))
    .map(asset => asset.zoneId === zoneId ? { ...asset, zoneId: null } : { ...asset }) };
  const reduce = (kind: KqWarehouseAsset["kind"], items: KqWarehouseState["equipment"]) => items.map(item => ({ ...item,
    quantity: item.quantity - sold.filter(asset => asset.kind === kind && asset.code === item.code).reduce((sum, asset) => sum + asset.quantity, 0) })).filter(item => item.quantity > 0);
  const next: KqWarehouseState = { ...state, zones: state.zones.filter(zone => zone.id !== zoneId), equipment: reduce("device", state.equipment),
    ...(state.optionInventory === undefined ? {} : { optionInventory: reduce("option", state.optionInventory) }) };
  assertKqWarehouseCondition(next, remaining);
  return { state: next, condition: remaining, sold };
}
