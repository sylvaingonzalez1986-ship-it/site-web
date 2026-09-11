import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Product } from "@/data/products";
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
import { ProductJsonLd } from "./JsonLd";

const product: Product = { id: "test", name: "Fleur", category: "fleurs", price: 3, image: "/flower.jpg", description: "Fleur test" };
async function data(overrides: Partial<Product>) {
  const element = await ProductJsonLd({ product: { ...product, ...overrides } });
  return element.props.data;
}

describe("product structured data availability", () => {
  beforeEach(() => vi.clearAllMocks());
  it("does not invent a base offer when all configured variants are disabled", async () => {
    expect((await data({ variantOptions: [{ id: "disabled", label: "5 g", price: 10, enabled: false }] })).offers).toEqual([]);
  });
  it("uses the same stock precedence as the purchase selector", async () => {
    const result = await data({ variantOptions: [{ id: "available", label: "5 g", price: 10, stockQuantity: 3, inStock: false }, { id: "empty", label: "10 g", price: 15, stockQuantity: 0, inStock: true }] });
    expect(result.offers.map((offer: { availability: string }) => offer.availability)).toEqual(["https://schema.org/InStock", "https://schema.org/OutOfStock"]);
  });
  it("does not call unknown tracked inventory available", async () => {
    expect((await data({ trackStock: true })).offers.availability).toBe("https://schema.org/OutOfStock");
  });
  it("never emits an invalid numeric price", async () => {
    expect((await data({ price: NaN })).offers).toBeUndefined();
    expect((await data({ variantOptions: [{ id: "bad", label: "1 g", price: Infinity }] })).offers).toEqual([]);
  });
});
