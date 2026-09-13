import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CART_SESSION_STORAGE_KEY,
  readCartFromSession,
  saveCartToSession,
  readBrowserCart,
  saveBrowserCart,
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
  afterEach(() => vi.unstubAllGlobals());

  it("keeps the cart after closing the tab and does not resurrect a cleared cart", () => {
    const localStorage = createStorage();
    const oldTab = createStorage();
    vi.stubGlobal("window", { localStorage, sessionStorage: oldTab });
    saveBrowserCart([line]);
    vi.stubGlobal("window", { localStorage, sessionStorage: createStorage() });
    expect(readBrowserCart()).toEqual([line]);
    saveBrowserCart([]);
    vi.stubGlobal("window", { localStorage, sessionStorage: oldTab });
    expect(readBrowserCart()).toEqual([]);
  });

  it("migrates the previous tab cart without duplicating its lines", () => {
    const localStorage = createStorage();
    const sessionStorage = createStorage();
    saveCartToSession(sessionStorage, [line]);
    vi.stubGlobal("window", { localStorage, sessionStorage });
    expect(readBrowserCart()).toEqual([line]);
    expect(readCartFromSession(localStorage)).toEqual([line]);
  });

  it("expires old snapshots and tolerates unavailable browser storage", () => {
    const storage = createStorage();
    storage.setItem(CART_SESSION_STORAGE_KEY, JSON.stringify({ version: 1, updatedAt: Date.now() - 49 * 60 * 60 * 1000, items: [line] }));
    expect(readCartFromSession(storage)).toEqual([]);
    vi.stubGlobal("window", { get localStorage() { throw new Error("blocked"); }, get sessionStorage() { throw new Error("blocked"); } });
    expect(readBrowserCart()).toEqual([]);
    expect(() => saveBrowserCart([line])).not.toThrow();
  });
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
