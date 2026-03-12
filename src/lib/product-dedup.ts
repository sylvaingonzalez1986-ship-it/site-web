import type { Product } from "@/data/products";

export function getProductDedupKey(product: Product): string {
  return [
    product.name.trim().toLowerCase(),
    product.category,
    product.cultureMode ?? "",
    Number(product.price || 0).toFixed(2),
    product.producerId ?? "",
    product.isPack ? "pack" : "single",
  ].join("|");
}

export function dedupeProducts(products: Product[]): Product[] {
  const seenKeys = new Set<string>();
  const uniqueProducts: Product[] = [];

  for (const product of products) {
    const key = getProductDedupKey(product);
    if (seenKeys.has(key)) {
      continue;
    }

    seenKeys.add(key);
    uniqueProducts.push(product);
  }

  return uniqueProducts;
}
