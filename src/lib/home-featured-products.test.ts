import { describe, expect, it } from "vitest";
import type { Product } from "@/data/products";
import { getHomeFeaturedProducts } from "./home-featured-products";
const flower: Product = { id: "home", name: "Maison", category: "fleurs", price: 2, image: "/flower.jpg", description: "", trackStock: true, stockQuantity: 2 };
describe("home featured products", () => {
  it("replaces unavailable own products with available partner products", () => {
    expect(getHomeFeaturedProducts([{ ...flower, stockQuantity: 0 }, { ...flower, id: "partner", producerId: "farm" }]).map(p => p.id)).toEqual(["partner"]);
  });
  it("prefers available own products and limits the selection", () => {
    const products = Array.from({ length: 5 }, (_, i) => ({ ...flower, id: "partner-" + i, name: "Fleur " + i, producerId: "farm" }));
    const result = getHomeFeaturedProducts([...products, flower]);
    expect(result).toHaveLength(4);
    expect(result[0].id).toBe("home");
  });
  it("excludes products with no purchasable format", () => {
    expect(getHomeFeaturedProducts([{ ...flower, variantOptions: [{ id: "5g", label: "5 g", price: 10, enabled: false, stockQuantity: 9 }] }])).toEqual([]);
  });
});
