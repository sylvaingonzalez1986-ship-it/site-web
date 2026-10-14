import { afterEach, describe, expect, it, vi } from "vitest";
import { readSupportPackPurchaseKey, saveSupportPackPurchaseKey } from "./KqSupportBoosterShop.client";

const key = "11111111-1111-4111-8111-111111111111";
afterEach(() => vi.unstubAllGlobals());

describe("Botte purchase recovery", () => {
  it("retains the same request key across reads and scopes it to the account", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", {});
    vi.stubGlobal("sessionStorage", {
      getItem: (id: string) => values.get(id) ?? null,
      setItem: (id: string, value: string) => values.set(id, value),
      removeItem: (id: string) => values.delete(id),
    });
    saveSupportPackPurchaseKey("customer-1", key);
    expect(readSupportPackPurchaseKey("customer-1")).toBe(key);
    expect(readSupportPackPurchaseKey("customer-1")).toBe(key);
    expect(readSupportPackPurchaseKey("customer-2")).toBeNull();
    saveSupportPackPurchaseKey("customer-2", "22222222-2222-4222-8222-222222222222");
    saveSupportPackPurchaseKey("customer-1", null);
    expect(readSupportPackPurchaseKey("customer-1")).toBeNull();
    expect(readSupportPackPurchaseKey("customer-2")).toBe("22222222-2222-4222-8222-222222222222");
  });

  it("never accesses account storage for a tutorial", () => {
    const getItem = vi.fn(), setItem = vi.fn(), removeItem = vi.fn();
    vi.stubGlobal("window", {});
    vi.stubGlobal("sessionStorage", { getItem, setItem, removeItem });
    expect(readSupportPackPurchaseKey(null)).toBeNull();
    saveSupportPackPurchaseKey(null, key);
    saveSupportPackPurchaseKey(null, null);
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
  });

  it("ignores malformed recovery keys and survives blocked browser storage", () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("sessionStorage", { getItem: () => "not-a-request-key" });
    expect(readSupportPackPurchaseKey("customer")).toBeNull();
    vi.stubGlobal("sessionStorage", {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
      removeItem: () => { throw new Error("blocked"); },
    });
    expect(readSupportPackPurchaseKey("customer")).toBeNull();
    expect(() => saveSupportPackPurchaseKey("customer", key)).not.toThrow();
    expect(() => saveSupportPackPurchaseKey("customer", null)).not.toThrow();
  });
});
