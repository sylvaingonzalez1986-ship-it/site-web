import { getKqWarehouseQuote, getKqWarehouseZoneQuote, type KqWarehouseState } from "./kanab-quest-warehouse";
import { initializeKqWarehouseCondition, reconcileKqWarehouseCondition, type KqWarehouseAsset, type KqWarehouseCondition } from "./kanab-quest-warehouse-condition";

export type KqWarehouseReuseOrigin = "kept" | "reused" | "new";
export type KqWarehouseReusePreview = {
  keptQuantity: number;
  reusedQuantity: number;
  newQuantity: number;
  newCostCents: number;
  groups: Array<{ origin: KqWarehouseReuseOrigin; quantity: number; wearPercent: number | null }>;
  planPurchaseQuantity: number;
  planPurchaseCents: number;
  /** Only available when all existing equipment has a recorded condition. */
  condition?: KqWarehouseCondition;
};

/** Project allocation without changing the inventory or treating missing wear as a new item. */
export function getKqWarehouseReusePreview(previous: KqWarehouseState, candidate: KqWarehouseState,
  zoneId: string, kind: KqWarehouseAsset["kind"], code: string, condition?: KqWarehouseCondition): KqWarehouseReusePreview | null {
  try {
    const zone = candidate.zones.find(item => item.id === zoneId);
    if (!zone) return null;
    const zoneQuote = getKqWarehouseZoneQuote(zone);
    const line = (kind === "option" ? zoneQuote.options : zoneQuote.devices).find(item => item.code === code);
    if (!line) return null;
    const plan = getKqWarehouseQuote(candidate, previous);
    // Source tags live only in this preview. They survive allocation splits, unlike asset IDs.
    let serial = 0;
    const newId = () => `reuse-preview-${serial++}`;
    const source = condition ?? initializeKqWarehouseCondition(previous, false, newId);
    const origins = new Map<string, KqWarehouseReuseOrigin>();
    const tagged: KqWarehouseCondition = { version: 1, assets: source.assets.map((asset, index) => {
      const sourceAssetKey = `reuse-preview-owned:${index}`;
      origins.set(sourceAssetKey, asset.zoneId === zoneId ? "kept" : "reused");
      return { ...asset, id: newId(), sourceAssetKey };
    }) };
    const projected = reconcileKqWarehouseCondition(previous, plan.nextState, tagged,
      { requestKey: "shop-preview", fundedFraction: 1 }, newId);
    const groups = new Map<string, KqWarehouseReusePreview["groups"][number]>();
    for (const asset of projected.assets.filter(item => item.zoneId === zoneId && item.kind === kind && item.code === code)) {
      const origin = asset.sourceAssetKey === "warehouse:shop-preview" ? "new" : origins.get(asset.sourceAssetKey!)!;
      const wearPercent = condition || origin === "new" ? asset.wearPercent : null;
      const key = `${origin}:${wearPercent}`;
      const group = groups.get(key) ?? { origin, wearPercent, quantity: 0 };
      group.quantity += asset.quantity;
      groups.set(key, group);
    }
    const ordered = [...groups.values()].sort((a, b) => ["kept", "reused", "new"].indexOf(a.origin) - ["kept", "reused", "new"].indexOf(b.origin) || (a.wearPercent ?? 0) - (b.wearPercent ?? 0));
    const quantity = (origin: KqWarehouseReuseOrigin) => ordered.filter(item => item.origin === origin).reduce((sum, item) => sum + item.quantity, 0);
    const purchase = (kind === "option" ? plan.optionPurchases : plan.purchases).find(item => item.code === code);
    return { keptQuantity: quantity("kept"), reusedQuantity: quantity("reused"), newQuantity: quantity("new"),
      newCostCents: Math.round(quantity("new") * line.totalCents / line.quantity), groups: ordered,
      planPurchaseQuantity: purchase?.quantity ?? 0, planPurchaseCents: purchase?.totalCents ?? 0,
      ...(condition ? { condition: projected } : {}) };
  } catch {
    // Invalid or stale plans are handled by the editor; no allocation or zero price is invented.
    return null;
  }
}
