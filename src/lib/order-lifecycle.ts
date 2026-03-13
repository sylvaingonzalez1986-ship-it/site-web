import type { CmsOrder } from "@/types/store";

export function isOrderArchived(order: Pick<CmsOrder, "archivedAt">): boolean {
  return typeof order.archivedAt === "string" && order.archivedAt.trim().length > 0;
}

export function canArchiveIncompleteOrder(
  order: Pick<CmsOrder, "archivedAt" | "paymentState" | "status">,
): boolean {
  if (isOrderArchived(order)) {
    return false;
  }

  if (order.paymentState === "paid" || order.paymentState === "not_configured") {
    return false;
  }

  return order.status !== "processing" && order.status !== "shipped";
}
