export const CONTEST_BUNDLE_MIN_GRAMS = 3;
export const CONTEST_BUNDLE_BUDDIES_PACKS = 3;
export const CONTEST_BUNDLE_BOTTE_PACKS = 5;

export type ContestBundleFlower = {
  productId: string;
  title: string;
  unitWeightGrams: number;
};

export type ContestBundleReceipt = {
  orderId: string;
  grantedAt: string;
  card: { id: string; code: string; name: string; imageUrl: string; rarity: "epic" };
  buddiesPacks: number;
  bottePacks: number;
  requiredProductIds: string[];
};

export type ContestBundleFlowerProgress = {
  productId: string;
  purchasedGrams: number;
  complete: boolean;
};

export type ContestBundleProgress = {
  flowers: ContestBundleFlowerProgress[];
  completedCount: number;
  requiredCount: number;
  eligible: boolean;
  rewarded: boolean;
  grantedAt: string | null;
};

export type ContestBundleRewards = {
  available: boolean;
  startsAt: string | null;
  minGrams: number;
  buddiesPacks: number;
  bottePacks: number;
  flowers: ContestBundleFlower[];
  progress: ContestBundleProgress | null;
  receipts: ContestBundleReceipt[];
};

/** Offer and the current viewer's checklist, without their order receipts. */
export type ContestBundleOffer = Omit<ContestBundleRewards, "receipts">;

export type ContestBundleCartItem = {
  id: string;
  quantity: number;
  price?: number;
  isPack?: boolean;
  packProductIds?: string[];
};

/** Preview only. Actual rewards use paid order lines and their immutable weights. */
export function getContestBundleCartProgress(
  flowers: readonly ContestBundleFlower[],
  items: readonly ContestBundleCartItem[],
  purchased: readonly ContestBundleFlowerProgress[] = [],
) {
  const requirements = [...new Map(flowers.map((flower) => [flower.productId, flower])).values()];
  const purchasedByProduct = new Map(purchased
    .filter((flower) => Number.isFinite(flower.purchasedGrams) && flower.purchasedGrams >= 0)
    .map((flower) => [flower.productId, Math.round(flower.purchasedGrams * 10)]));
  const quantityByProduct = new Map<string, number>();
  for (const item of items) {
    if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0 || item.quantity > 99
      || item.id.includes("::") || (item.price !== undefined && (!Number.isFinite(item.price) || item.price <= 0))) continue;
    // Checkout expands a paid pack into one line per component, with the pack's quantity.
    const ids = item.isPack ? item.packProductIds ?? [] : [item.id];
    for (const id of ids) {
      if (id.includes("::")) continue;
      quantityByProduct.set(id, (quantityByProduct.get(id) ?? 0) + item.quantity);
    }
  }
  const progress = requirements.map((flower) => {
    // Snapshots are NUMERIC(..., 1); integer tenths avoid decimal rounding errors.
    const validWeight = Number.isFinite(flower.unitWeightGrams) && flower.unitWeightGrams > 0;
    const cartTenths = validWeight ? Math.round(flower.unitWeightGrams * 10) * (quantityByProduct.get(flower.productId) ?? 0) : 0;
    const purchasedTenths = purchasedByProduct.get(flower.productId) ?? 0;
    const grams = (purchasedTenths + cartTenths) / 10;
    return { ...flower, purchasedGrams: purchasedTenths / 10, cartGrams: cartTenths / 10, grams, missingGrams: Math.max(0, Math.round((CONTEST_BUNDLE_MIN_GRAMS - grams) * 10) / 10), complete: grams >= CONTEST_BUNDLE_MIN_GRAMS };
  });
  return {
    flowers: progress,
    completedCount: progress.filter((flower) => flower.complete).length,
    requiredCount: progress.length,
    eligible: progress.length > 0 && progress.every((flower) => flower.complete),
  };
}
