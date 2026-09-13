import { describe, expect, it } from "vitest";
import type { Product } from "@/data/products";
import { addCartItem, changeCartQuantity } from "./cart-mutations";

const product: Product = { id: "flower", name: "Fleur", category: "fleurs", price: 2.5, image: "/flower.jpg", description: "", trackStock: true, stockQuantity: 3 };

describe("cart mutations without an account", () => {
  it("adds a product without requiring customer data", () => {
    const added = addCartItem([], product, undefined, 2);
    expect(added.result).toEqual({ ok: true });
    expect(added.items[0].quantity).toBe(2);
  });
  it("rejects repeated additions beyond stock without changing the cart", () => {
    const first = addCartItem([], product, undefined, 2);
    const second = addCartItem(first.items, product, undefined, 2);
    expect(second.result).toEqual({ ok: false, reason: "stock_limit", maxAvailable: 3 });
    expect(second.items).toBe(first.items);
  });
  it("uses the first purchasable variant and its stock instead of the disabled first option", () => {
    const variants = { ...product, variantOptions: [
      { id: "off", label: "Épuisé", price: 3, enabled: false, stockQuantity: 0 },
      { id: "5g", label: "5 g", price: 10, enabled: true, stockQuantity: 2 },
    ] };
    const result = addCartItem([], variants);
    expect(result.items[0]).toMatchObject({ id: "flower::5g", price: 10, quantity: 1 });
    expect(addCartItem([], variants, "off").result.ok).toBe(false);
    expect(addCartItem([], variants, "missing").result.ok).toBe(false);
    expect(addCartItem(result.items, variants, "5g", 2).result.ok).toBe(false);
  });
  it("rejects out of stock and invalid quantities", () => {
    expect(addCartItem([], { ...product, stockQuantity: 0 }).result.ok).toBe(false);
    for (const qty of [NaN, Infinity, -1, 0]) expect(addCartItem([], product, undefined, qty).result.ok).toBe(false);
  });
  it("clamps edited quantities and removes unavailable lines", () => {
    const items = addCartItem([], product).items;
    expect(changeCartQuantity(items, product.id, 10)).toMatchObject({ result: { reason: "stock_limit" }, items: [{ quantity: 3 }] });
    expect(changeCartQuantity([{ ...items[0], stockQuantity: 0 }], product.id, 1).items).toEqual([]);
  });
});
