import type { KqCommerceSnapshot } from "./kanab-quest-commerce";

export type KqCommerceFlowerSelection =
  | { status: "none" }
  | { status: "missing"; flowerId: string }
  | { status: "selected"; flowerId: string; selectedId: string };

/** A verdict points to its own harvest. Names, list order and other remaining
 * stock must never turn that destination into another player's choice. */
export function getKqCommerceFlowerSelection(snapshot: Pick<KqCommerceSnapshot, "rawLots" | "stocks">, flowerId?: string): KqCommerceFlowerSelection {
  if (!flowerId) return { status: "none" };
  const raw = snapshot.rawLots.find(lot => lot.flowerId === flowerId);
  if (raw) return { status: "selected", flowerId, selectedId: `raw:${raw.flowerId}` };
  const prepared = snapshot.stocks.find(lot => lot.flowerId === flowerId && Number.isFinite(lot.remainingUnits) && lot.remainingUnits > 0);
  return prepared ? { status: "selected", flowerId, selectedId: prepared.id } : { status: "missing", flowerId };
}
