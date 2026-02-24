import type { Product } from "@/data/products";

type ProductVariant = NonNullable<Product["variantOptions"]>[number];

export function normalizeStockQuantity(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return Math.floor(parsed);
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

    const variantStock = normalizeStockQuantity(selectedVariant.stockQuantity);
    return variantStock;
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



