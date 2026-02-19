import type { Product } from "@/data/products";

export function hasActiveProductPromo(
  product: Pick<Product, "price" | "promoPercent" | "originalPrice">,
): product is Pick<Product, "price"> & { promoPercent: number; originalPrice: number } {
  return (
    typeof product.promoPercent === "number" &&
    Number.isFinite(product.promoPercent) &&
    product.promoPercent > 0 &&
    typeof product.originalPrice === "number" &&
    Number.isFinite(product.originalPrice) &&
    product.originalPrice > 0 &&
    product.originalPrice > product.price
  );
}
