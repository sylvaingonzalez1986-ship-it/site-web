import { describe, expect, it } from "vitest";
import {
  CART_SESSION_STORAGE_KEY,
  readCartFromSession,
  saveCartToSession,
  type StoredCartLine,
} from "@/lib/cart-session-storage";

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

const line: StoredCartLine = {
  id: "fleur-test::2g",
  name: "Fleur test - 2 g",
  category: "fleurs",
  price: 12.5,
  image: "/test.jpg",
  description: "Produit test",
  quantity: 2,
};

describe("cart session storage", () => {
  it("restores a valid cart after an external navigation", () => {
    const storage = createStorage();
    saveCartToSession(storage, [line]);
    expect(readCartFromSession(storage)).toEqual([line]);
  });

  it("removes malformed cart data", () => {
    const storage = createStorage();
    storage.setItem(
      CART_SESSION_STORAGE_KEY,
      JSON.stringify({ version: 1, updatedAt: Date.now(), items: [{ ...line, quantity: 0 }] }),
    );
    expect(readCartFromSession(storage)).toEqual([]);
    expect(storage.getItem(CART_SESSION_STORAGE_KEY)).toBeNull();
  });

  it("removes the stored snapshot when the cart is cleared", () => {
    const storage = createStorage();
    saveCartToSession(storage, [line]);
    saveCartToSession(storage, []);
    expect(storage.getItem(CART_SESSION_STORAGE_KEY)).toBeNull();
  });
});
