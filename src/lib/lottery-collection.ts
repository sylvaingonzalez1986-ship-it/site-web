/**
 * lottery-collection.ts
 * ────────────────────────────────────────────────────────
 * Single source of truth for the TCG Collection Album.
 *
 * Shared between client components, API routes, and
 * Supabase backend service — keep this module dependency-light.
 * ────────────────────────────────────────────────────────
 */

import type {
  LotteryBurnableRarity,
  LotteryCollectionPageRarity,
} from "@/types/lottery";

/* ──────── Page ordering ──────── */

export const LOTTERY_COLLECTION_PAGE_ORDER: LotteryCollectionPageRarity[] = [
  "common",
  "silver",
  "gold",
  "epic",
  "legendary",
];

/* ──────── Page metadata ──────── */

export const LOTTERY_COLLECTION_PAGE_META: Record<
  LotteryCollectionPageRarity,
  {
    pageNumber: number;
    label: string;
    title: string;
    burnDiscountPercent?: number;
  }
> = {
  common: { pageNumber: 1, label: "Communes", title: "Page Commune", burnDiscountPercent: 10 },
  silver: { pageNumber: 2, label: "Silver", title: "Page Silver", burnDiscountPercent: 20 },
  gold: { pageNumber: 3, label: "Gold", title: "Page Gold", burnDiscountPercent: 30 },
  epic: { pageNumber: 4, label: "Epique", title: "Page Epique", burnDiscountPercent: 50 },
  legendary: { pageNumber: 5, label: "Legendaire", title: "Page Legendaire" },
};

/* ──────── Burn rules per burnable rarity ──────── */

export const LOTTERY_DUPLICATE_BURN_RULES: Record<
  LotteryBurnableRarity,
  { duplicatesRequired: number; discountPercent: number; giftWeightGrams: number }
> = {
  common: { duplicatesRequired: 10, discountPercent: 10, giftWeightGrams: 3 },
  silver: { duplicatesRequired: 10, discountPercent: 20, giftWeightGrams: 10 },
  gold: { duplicatesRequired: 10, discountPercent: 30, giftWeightGrams: 20 },
  epic: { duplicatesRequired: 10, discountPercent: 50, giftWeightGrams: 50 },
};

export const LOTTERY_POINTS_PACK_COST = 100;
export const LOTTERY_POINTS_PACK_MAX_PER_PURCHASE = 50;

/* ──────── Helpers ──────── */

const BURNABLE_RARITIES = new Set<string>(["common", "silver", "gold", "epic"]);

export function isBurnableRarity(rarity: string): rarity is LotteryBurnableRarity {
  return BURNABLE_RARITIES.has(rarity);
}

export function isValidCollectionPageRarity(rarity: string): rarity is LotteryCollectionPageRarity {
  return LOTTERY_COLLECTION_PAGE_ORDER.includes(rarity as LotteryCollectionPageRarity);
}

/** Number of pages in the album. */
export const LOTTERY_COLLECTION_PAGE_COUNT = LOTTERY_COLLECTION_PAGE_ORDER.length;
