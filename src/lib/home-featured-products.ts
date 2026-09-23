import type { Product } from "@/data/products";
import { dedupeProducts } from "./product-dedup";
import { rotateProductsForDay } from "./product-rotation";
import { isProductInStock } from "./product-stock";

export function getHomeFeaturedProducts(products: Product[], day: number): Product[] {
  return rotateProductsForDay(
    dedupeProducts(products.filter(isProductInStock)),
    day,
    "home:featured",
    { ownProductsFirst: true },
  ).slice(0, 4);
}
