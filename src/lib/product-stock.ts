import type { Product } from "@/data/products";

type ProductVariant = NonNullable<Product["variantOptions"]>[number];

const DEFAULT_MAX_PURCHASABLE_QTY = 99;
const LOW_STOCK_CATEGORIES = new Set<Product["category"]>(["fleurs", "resines"]);

export type StockDisplayInfo = {
  isOutOfStock: boolean;
  isLowStock: boolean;
  remainingGrams: number | null;
  maxPurchasableQty: number;
};

export function normalizeStockQuantity(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return Math.floor(parsed);
}

function normalizeThresholdGrams(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }

  return Math.floor(parsed);
}

function normalizeWeightGrams(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function parseWeightGramsFromLabel(label: string | undefined): number | null {
  if (!label) {
    return null;
  }

  const match = label.match(/(\d+(?:[.,]\d+)?)\s*g\b/i);
  if (!match) {
    return null;
  }

  return normalizeWeightGrams(match[1]?.replace(",", "."));
}

function isLowStockEligibleCategory(product: Product): boolean {
  return LOW_STOCK_CATEGORIES.has(product.category);
}

export function isVariantOptionPurchasable(option: ProductVariant): boolean {
  if (option.enabled === false) {
    return false;
  }

  if (!Number.isFinite(option.price) || option.price < 0) {
    return false;
  }

  const stockQuantity = normalizeStockQuantity(option.stockQuantity);
  if (stockQuantity !== null) {
    return stockQuantity > 0;
  }

  return option.inStock !== false;
}

export function getSelectableVariantOptions(product: Product): ProductVariant[] {
  if (!Array.isArray(product.variantOptions)) {
    return [];
  }

  return product.variantOptions.filter(isVariantOptionPurchasable);
}

export function getAvailableQuantity(
  product: Product,
  variantId: string,
): number | null {
  if (Array.isArray(product.variantOptions) && product.variantOptions.length > 0) {
    const selectedVariant = variantId
      ? product.variantOptions.find((option) => option.id === variantId)
      : product.variantOptions[0];

    if (!selectedVariant) {
      return 0;
    }

    return normalizeStockQuantity(selectedVariant.stockQuantity);
  }

  if (product.trackStock !== true) {
    return null;
  }

  return normalizeStockQuantity(product.stockQuantity) ?? 0;
}

export function isProductInStock(product: Product): boolean {
  if (Array.isArray(product.variantOptions) && product.variantOptions.length > 0) {
    return getSelectableVariantOptions(product).length > 0;
  }

  if (product.trackStock !== true) {
    return true;
  }

  const stockQuantity = normalizeStockQuantity(product.stockQuantity);
  return stockQuantity !== null && stockQuantity > 0;
}

function getRemainingGramsForSimpleProduct(product: Product): number | null {
  if (product.trackStock !== true) {
    return null;
  }

  const stockQuantity = normalizeStockQuantity(product.stockQuantity);
  const unitWeightGrams = normalizeWeightGrams(product.weightGrams);
  if (stockQuantity === null || unitWeightGrams === null) {
    return null;
  }

  return stockQuantity * unitWeightGrams;
}

function getRemainingGramsForSelectedVariant(
  product: Product,
  variantId: string,
): number | null {
  if (!Array.isArray(product.variantOptions) || product.variantOptions.length === 0) {
    return null;
  }

  const selectedVariant = product.variantOptions.find((option) => option.id === variantId);
  if (!selectedVariant) {
    return null;
  }

  const stockQuantity = normalizeStockQuantity(selectedVariant.stockQuantity);
  const unitWeightGrams = parseWeightGramsFromLabel(selectedVariant.label);
  if (stockQuantity === null || unitWeightGrams === null) {
    return null;
  }

  return stockQuantity * unitWeightGrams;
}

function getRemainingGramsForVariantCollection(product: Product): number | null {
  const selectableVariants = getSelectableVariantOptions(product);
  if (selectableVariants.length === 0) {
    return 0;
  }

  let totalGrams = 0;
  for (const option of selectableVariants) {
    const stockQuantity = normalizeStockQuantity(option.stockQuantity);
    const unitWeightGrams = parseWeightGramsFromLabel(option.label);
    if (stockQuantity === null || unitWeightGrams === null) {
      return null;
    }

    totalGrams += stockQuantity * unitWeightGrams;
  }

  return totalGrams;
}

function getRemainingGrams(product: Product, variantId?: string): number | null {
  if (!isLowStockEligibleCategory(product)) {
    return null;
  }

  if (Array.isArray(product.variantOptions) && product.variantOptions.length > 0) {
    if (variantId) {
      return getRemainingGramsForSelectedVariant(product, variantId);
    }

    return getRemainingGramsForVariantCollection(product);
  }

  return getRemainingGramsForSimpleProduct(product);
}

export function formatRemainingGrams(grams: number): string {
  if (Number.isInteger(grams)) {
    return `${grams}g`;
  }

  return `${grams.toFixed(1).replace(".", ",")}g`;
}

export function getStockDisplayInfo(
  product: Product,
  thresholdGrams: number,
  variantId?: string,
): StockDisplayInfo {
  const availableQuantity = getAvailableQuantity(product, variantId ?? "");
  const maxPurchasableQty = availableQuantity ?? DEFAULT_MAX_PURCHASABLE_QTY;
  const isOutOfStock =
    availableQuantity !== null ? availableQuantity <= 0 : !isProductInStock(product);
  const remainingGrams = getRemainingGrams(product, variantId);
  const normalizedThreshold = normalizeThresholdGrams(thresholdGrams);
  const isLowStock =
    !isOutOfStock &&
    normalizedThreshold > 0 &&
    remainingGrams !== null &&
    remainingGrams <= normalizedThreshold;

  return {
    isOutOfStock,
    isLowStock,
    remainingGrams,
    maxPurchasableQty,
  };
}
