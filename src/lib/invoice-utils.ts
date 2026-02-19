import type { CmsOrder } from "@/types/store";

export function isInvoiceEligibleOrder(order: CmsOrder): boolean {
  if (order.status === "cancelled") {
    return false;
  }

  if (order.paymentState === "pending" || order.paymentState === "failed") {
    return false;
  }

  return order.paymentState === "paid" || order.paymentState === "not_configured";
}

export function calculateOrderSubtotal(order: CmsOrder): number {
  return Number(
    order.items.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2),
  );
}

