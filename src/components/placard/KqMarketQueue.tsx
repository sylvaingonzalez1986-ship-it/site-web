import { queuedOrderReason, type KqQueuedOrder } from "@/lib/kanab-quest-market-queue";

export function KqMarketQueue({ orders, label }: { orders?: KqQueuedOrder[]; label: (id: string) => string }) {
  const visible = orders?.filter(order => order.status !== "executed") ?? [];
  if (!visible.length) return null;
  return <section aria-label="Ordres transmis"><h4>Ordres transmis</h4><p>Le prix sera celui du premier cours admissible reçu après l’envoi. Fonds et titres non réservés : l’ordre sera rejeté s’ils manquent à l’exécution.</p><ul>{visible.map(order => <li key={order.orderId}>
    <strong>{order.side === "buy" ? "Achat" : "Vente"} · {label(order.assetId)}</strong> · {order.side === "buy" ? `${(order.budgetCents / 100).toLocaleString("fr-FR")} € de jeu` : `${order.quantity} unités`} — {order.status === "pending" ? "En attente du prochain cours" : "Rejeté"}
    {order.status === "rejected" ? <p>{queuedOrderReason(order.reason)}</p> : <p>Sans nouveau cours avant le {new Date(order.deadlineAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}, l’ordre sera rejeté sans échange.</p>}
  </li>)}</ul></section>;
}
