export const KQ_HERITAGE_PURCHASE_DRAWS_LIVE: boolean = false;

export type KqHeritagePurchaseItem = {
  id: number;
  productId: string;
  quantity: number;
};

export type KqHeritagePurchaseDraw = {
  orderItemId: number;
  unitIndex: number;
};

export function getKqBaseProductId(productId: string) {
  return productId.trim().split("::", 1)[0]?.trim() ?? "";
}

export function buildKqHeritagePurchaseDrawPlan(
  items: KqHeritagePurchaseItem[],
  eligibleProductIds: Iterable<string>,
): KqHeritagePurchaseDraw[] {
  const eligible = new Set(Array.from(eligibleProductIds, (id) => id.trim()).filter(Boolean));
  return items.flatMap((item) => {
    if (!eligible.has(getKqBaseProductId(item.productId))) return [];
    const quantity = Math.max(0, Math.floor(item.quantity));
    return Array.from({ length: quantity }, (_, index) => ({
      orderItemId: item.id,
      unitIndex: index + 1,
    }));
  });
}
