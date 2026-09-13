import type { Product } from "@/data/products";
import { dedupeProducts } from "./product-dedup";
import { sortOwnProductsFirst } from "./own-producer";
import { isProductInStock } from "./product-stock";

export function getHomeFeaturedProducts(products: Product[]): Product[] {
  return sortOwnProductsFirst(dedupeProducts(products.filter(isProductInStock))).slice(0, 4);
}
