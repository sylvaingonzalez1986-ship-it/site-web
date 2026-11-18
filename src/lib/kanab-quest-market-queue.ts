export type KqQueuedOrder = { orderId: string; market: "crypto" | "stocks"; assetId: string; side: "buy" | "sell"; budgetCents: number; quantity: string; submittedAt: string; deadlineAt: string; status: "pending" | "executed" | "rejected"; reason: string | null; executionAt: string | null };
export type KqQueuedReceipt = { queuedOrder: KqQueuedOrder; replayed: boolean };
export function isKqQueuedOrder(value: unknown): value is KqQueuedOrder {
  if (!value || typeof value !== "object") return false;
  const q = value as KqQueuedOrder;
  return typeof q.orderId === "string" && /^[0-9a-f-]{36}$/i.test(q.orderId) && ["crypto", "stocks"].includes(q.market)
    && typeof q.assetId === "string" && q.assetId.length > 0 && ["buy", "sell"].includes(q.side)
    && Number.isSafeInteger(q.budgetCents) && q.budgetCents > 0 && typeof q.quantity === "string" && /^\d+(\.\d+)?$/.test(q.quantity)
    && Number.isFinite(Date.parse(q.submittedAt)) && Number.isFinite(Date.parse(q.deadlineAt)) && ["pending", "executed", "rejected"].includes(q.status)
    && (q.reason === null || typeof q.reason === "string") && (q.executionAt === null || Number.isFinite(Date.parse(q.executionAt)));
}
export function isKqQueuedReceipt(value: unknown): value is KqQueuedReceipt {
  return !!value && typeof value === "object" && "queuedOrder" in value && isKqQueuedOrder(value.queuedOrder) && "replayed" in value && typeof value.replayed === "boolean";
}
export function queuedOrderReason(reason: string | null) {
  if (reason?.endsWith("_cash")) return "Trésorerie insuffisante au moment de l’exécution.";
  if (reason?.endsWith("_quantity")) return "Quantité disponible insuffisante au moment de l’exécution.";
  if (reason === "no_new_quote") return "Aucun nouveau cours admissible reçu dans les sept jours.";
  return "Le montant ou la position dépasserait les limites du jeu.";
}
