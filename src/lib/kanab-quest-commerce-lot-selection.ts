import type { KqCommerceSnapshot } from "./kanab-quest-commerce";

export type KqCommerceFlowerSelection =
  | { status: "none" }
  | { status: "missing"; flowerId?: string }
  | { status: "selected"; flowerId: string; selectedId: string };

/** A verdict points to its own harvest. Names, list order and other remaining
 * stock must never turn that destination into another player's choice. */
export function getKqCommerceFlowerSelection(snapshot: Pick<KqCommerceSnapshot, "rawLots" | "stocks">, flowerId?: string, lotId?: string): KqCommerceFlowerSelection {
  if (lotId) {
    const raw = snapshot.rawLots.find(lot => `raw:${lot.flowerId}` === lotId && (!flowerId || lot.flowerId === flowerId));
    if (raw && Number.isFinite(raw.harvestGrams) && raw.harvestGrams > 0) return { status: "selected", flowerId: raw.flowerId, selectedId: lotId };
    const stock = snapshot.stocks.find(lot => lot.id === lotId && (!flowerId || lot.flowerId === flowerId) && Number.isFinite(lot.remainingUnits) && lot.remainingUnits > 0);
    return stock ? { status: "selected", flowerId: stock.flowerId, selectedId: stock.id } : { status: "missing", flowerId };
  }
  if (!flowerId) return { status: "none" };
  const raw = snapshot.rawLots.find(lot => lot.flowerId === flowerId);
  if (raw) return { status: "selected", flowerId, selectedId: `raw:${raw.flowerId}` };
  const prepared = snapshot.stocks.find(lot => lot.flowerId === flowerId && Number.isFinite(lot.remainingUnits) && lot.remainingUnits > 0);
  return prepared ? { status: "selected", flowerId, selectedId: prepared.id } : { status: "missing", flowerId };
}
