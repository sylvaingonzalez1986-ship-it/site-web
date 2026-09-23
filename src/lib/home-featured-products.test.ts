import { describe, expect, it } from "vitest";
import type { Product } from "@/data/products";
import { getHomeFeaturedProducts } from "./home-featured-products";
const flower: Product = { id: "home", name: "Maison", category: "fleurs", price: 2, image: "/flower.jpg", description: "", trackStock: true, stockQuantity: 2 };
const day = 20_000;

function makeOwnProducts(count: number): Product[] {
  return Array.from({ length: count }, (_, index) => ({
    ...flower,
    id: `home-${index}`,
    name: `Maison ${index}`,
  }));
}

describe("home featured products", () => {
  it("replaces unavailable own products with available partner products", () => {
    expect(getHomeFeaturedProducts([{ ...flower, stockQuantity: 0 }, { ...flower, id: "partner", producerId: "farm" }], day).map(p => p.id)).toEqual(["partner"]);
  });
  it("prefers available own products and limits the selection", () => {
    const products = Array.from({ length: 5 }, (_, i) => ({ ...flower, id: "partner-" + i, name: "Fleur " + i, producerId: "farm" }));
    const result = getHomeFeaturedProducts([...products, flower], day);
    expect(result).toHaveLength(4);
    expect(result[0].id).toBe("home");
  });
  it("excludes products with no purchasable format", () => {
    expect(getHomeFeaturedProducts([{ ...flower, variantOptions: [{ id: "5g", label: "5 g", price: 10, enabled: false, stockQuantity: 9 }] }], day)).toEqual([]);
  });

  it("keeps a purchasable variant even when the base stock is empty", () => {
    const available = {
      ...flower,
      stockQuantity: 0,
      variantOptions: [{ id: "5g", label: "5 g", price: 10, stockQuantity: 2 }],
    };

    expect(getHomeFeaturedProducts([available], day)).toEqual([available]);
  });

  it("deduplicates available products before selecting the four cards", () => {
    const ownProducts = makeOwnProducts(4);
    const products = [
      { ...ownProducts[0], id: "unavailable-copy", stockQuantity: 0 },
      ...ownProducts,
      { ...ownProducts[0], id: "available-copy" },
    ];

    for (let offset = 0; offset < ownProducts.length; offset++) {
      expect(getHomeFeaturedProducts(products, day + offset).map(product => product.id).sort())
        .toEqual(ownProducts.map(product => product.id).sort());
    }
  });

  it("keeps the selection stable during a day and independent of catalog order", () => {
    const products = makeOwnProducts(7);

    expect(getHomeFeaturedProducts([...products].reverse(), day)).toEqual(getHomeFeaturedProducts(products, day));
    expect(getHomeFeaturedProducts(products, day + 1)).not.toEqual(getHomeFeaturedProducts(products, day));
  });

  it("gives every own product equal exposure over a complete cycle", () => {
    const products = makeOwnProducts(7);
    const appearances = new Map(products.map(product => [product.id, 0]));
    const firstProducts = new Set<string>();

    for (let offset = 0; offset < products.length; offset++) {
      const selection = getHomeFeaturedProducts(products, day + offset);
      expect(selection).toHaveLength(4);
      firstProducts.add(selection[0].id);
      for (const product of selection) {
        appearances.set(product.id, appearances.get(product.id)! + 1);
      }
    }

    expect(firstProducts.size).toBe(products.length);
    expect([...appearances.values()]).toEqual(products.map(() => 4));
  });

  it("includes added products and excludes removed ones in the next complete cycle", () => {
    const originalProducts = makeOwnProducts(7);
    const products = [
      ...originalProducts.slice(1),
      { ...flower, id: "new-harvest", name: "Nouvelle recolte" },
      { ...flower, id: "new-harvest-2", name: "Deuxieme recolte" },
    ];
    const appearances = new Map(products.map(product => [product.id, 0]));

    for (let offset = 0; offset < products.length; offset++) {
      const selection = getHomeFeaturedProducts(products, day + 3 + offset);
      expect(selection.some(product => product.id === originalProducts[0].id)).toBe(false);
      for (const product of selection) {
        appearances.set(product.id, appearances.get(product.id)! + 1);
      }
    }

    expect([...appearances.values()]).toEqual(products.map(() => 4));
  });

  it("rotates partners through the remaining places after own products", () => {
    const partners = makeOwnProducts(6).map(product => ({
      ...product,
      id: `partner-${product.id}`,
      producerId: "farm",
    }));
    const appearances = new Map(partners.map(product => [product.id, 0]));

    for (let offset = 0; offset < partners.length; offset++) {
      const selection = getHomeFeaturedProducts([...partners, flower], day + offset);
      expect(selection[0].id).toBe(flower.id);
      for (const product of selection.slice(1)) {
        appearances.set(product.id, appearances.get(product.id)! + 1);
      }
    }

    expect([...appearances.values()]).toEqual(partners.map(() => 3));
  });
});
