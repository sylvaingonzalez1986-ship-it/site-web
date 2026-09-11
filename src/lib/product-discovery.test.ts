import { describe, expect, it } from "vitest";
import type { Product } from "@/data/products";
import { buildProductMetaDescription, getAffordableProducts, getFlowerPriceComparison, getPurchasableFormats } from "./product-discovery";

const flower = (overrides: Partial<Product> = {}): Product => ({ id: "flower", name: "Fleur", category: "fleurs", price: 10, weightGrams: 2, image: "/flower.jpg", description: "Fleur", ...overrides });

describe("catalogue price discovery", () => {
  it("sorts by a purchasable format, excludes sold-out products and accessories", () => {
    const products = [flower({ id: "sold", trackStock: true, stockQuantity: 0 }), flower({ id: "variant", name: "Variantes", price: 0.1, variantOptions: [{ id: "off", label: "1 g", price: 1, enabled: false }, { id: "sold", label: "2 g", price: 2, stockQuantity: 0 }, { id: "yes", label: "5 g", price: 20, inStock: true }] }), flower(), flower({ id: "accessory", category: "accessoires", price: 0.5 })];
    expect(getAffordableProducts(products).map(row => [row.product.id, row.format.price])).toEqual([["flower", 10], ["variant", 20]]);
  });
  it("distinguishes the cheapest pack from the best price per gram", () => {
    const product = flower({ variantOptions: [{ id: "small", label: "2 g", price: 8 }, { id: "large", label: "10 g", price: 25 }] });
    expect(getAffordableProducts([product])[0].format.price).toBe(8);
    expect(getFlowerPriceComparison([product])[0].format).toMatchObject({ price: 25, pricePerGram: 2.5, label: "10 g" });
  });
  it("does not invent a weight for unknown formats, liquids or mixed packs", () => {
    for (const product of [flower({ weightGrams: undefined }), flower({ isPack: true }), flower({ category: "e-liquide" }), flower({ variantOptions: [{ id: "dose", label: "1000 mg / 10 ml", price: 20 }] })]) {
      expect(getPurchasableFormats(product)[0].pricePerGram).toBeNull();
    }
  });
  it("handles explicit decimal and kilogram formats without rounding the comparison", () => {
    const product = flower({ variantOptions: [{ id: "a", label: "2,5 g", price: 6 }, { id: "b", label: "0.1 kg", price: 200 }] });
    expect(getFlowerPriceComparison([product])[0].format).toMatchObject({ weightGrams: 100, pricePerGram: 2 });
  });
  it("rejects invalid prices, fully disabled variants and unknown tracked stock", () => {
    expect(getAffordableProducts([flower({ price: NaN }), flower({ price: -1 }), flower({ trackStock: true }), flower({ variantOptions: [{ id: "a", label: "1 g", price: 1, enabled: false }] })])).toEqual([]);
  });
  it("uses real availability and analyses in a bounded metadata description", () => {
    expect(buildProductMetaDescription(flower({ trackStock: true, stockQuantity: 0 }), "Producteur")).toContain("Actuellement indisponible");
    expect(buildProductMetaDescription(flower(), "Producteur")).not.toContain("Analyse consultable");
    expect(buildProductMetaDescription(flower({ analysisPdf: "/test.pdf" }), "Producteur")).toContain("Analyse consultable");
    expect(buildProductMetaDescription(flower({ name: "Fleur ".repeat(50) }), "Producteur").length).toBeLessThanOrEqual(160);
  });
});
