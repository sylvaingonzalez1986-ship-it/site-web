import { describe, expect, it } from "vitest";
import type { Product } from "@/data/products";
import { OWN_PRODUCER_ID } from "./own-producer";
import { getProductRotationDay, rotateProductsForDay } from "./product-rotation";

function product(id: string, overrides: Partial<Product> = {}): Product {
  return {
    id,
    name: id,
    category: "fleurs",
    price: 12,
    image: "/flower.jpg",
    description: "",
    ...overrides,
  };
}

function ids(products: Product[]): string[] {
  return products.map(({ id }) => id);
}

describe("rotateProductsForDay", () => {
  const catalogue = Array.from({ length: 9 }, (_, index) => product(`flower-${index}`));

  it("gives every product every position exactly once over consecutive days", () => {
    const days = catalogue.map((_, index) =>
      rotateProductsForDay(catalogue, 20_856 + index, "boutique:own:fleurs"),
    );
    for (let position = 0; position < catalogue.length; position += 1) {
      expect(days.map((day) => day[position].id).sort()).toEqual(ids(catalogue).sort());
    }
    expect(rotateProductsForDay(catalogue, 20_856 + catalogue.length, "boutique:own:fleurs"))
      .toEqual(days[0]);
  });

  it("keeps an identical daily order across repeated calls and source permutations", () => {
    const result = rotateProductsForDay(catalogue, 20_856, "category:fleurs");
    expect(rotateProductsForDay([...catalogue].reverse(), 20_856, "category:fleurs"))
      .toEqual(result);
    expect(rotateProductsForDay([...catalogue.slice(3), ...catalogue.slice(0, 3)], 20_856, "category:fleurs"))
      .toEqual(result);
    expect(rotateProductsForDay(catalogue.map((entry) => ({ ...entry })), 20_856, "category:fleurs"))
      .toEqual(result);
  });

  it("uses the scope to select a stable shuffled base order", () => {
    const home = ids(rotateProductsForDay(catalogue, 0, "home"));
    const boutique = ids(rotateProductsForDay(catalogue, 0, "boutique"));
    expect(home).not.toEqual(boutique);
    expect(home).not.toEqual(ids(catalogue));
    expect(ids(rotateProductsForDay(catalogue, 0, "home"))).toEqual(home);
  });

  it("keeps purchasable products ahead of stockouts, including variant stock rules", () => {
    const available = [
      product("untracked", { stockQuantity: 0 }),
      product("simple", { trackStock: true, stockQuantity: 1 }),
      product("variant", {
        trackStock: true,
        stockQuantity: 0,
        variantOptions: [
          { id: "empty", label: "2 g", price: 12, stockQuantity: 0 },
          { id: "available", label: "5 g", price: 20, stockQuantity: 1 },
        ],
      }),
      product("variant-untracked", {
        variantOptions: [{ id: "available", label: "2 g", price: 12, inStock: true }],
      }),
    ];
    const unavailable = [
      product("simple-empty", { trackStock: true, stockQuantity: 0 }),
      product("disabled", {
        variantOptions: [{ id: "disabled", label: "2 g", price: 12, stockQuantity: 8, enabled: false }],
      }),
      product("invalid-price", {
        variantOptions: [{ id: "invalid", label: "2 g", price: -1, stockQuantity: 8 }],
      }),
      product("variant-empty", {
        variantOptions: [{ id: "empty", label: "2 g", price: 12, stockQuantity: 0, inStock: true }],
      }),
      product("variant-flag", {
        variantOptions: [{ id: "empty", label: "2 g", price: 12, inStock: false }],
      }),
    ];

    for (let day = 0; day < 10; day += 1) {
      const result = rotateProductsForDay([...unavailable, ...available], day, "stock");
      expect(ids(result.slice(0, available.length)).sort()).toEqual(ids(available).sort());
      expect(ids(result.slice(available.length)).sort()).toEqual(ids(unavailable).sort());
    }
  });

  it("preserves the production groups and rotates every group independently", () => {
    const groups = [
      [product("own-1"), product("own-2", { producerId: OWN_PRODUCER_ID })],
      [product("partner-1", { producerId: "farm-a" }), product("partner-2", { producerId: "farm-b" })],
      [product("own-empty-1", { trackStock: true, stockQuantity: 0 }), product("own-empty-2", { trackStock: true, stockQuantity: 0 })],
      [product("partner-empty-1", { producerId: "farm-a", trackStock: true, stockQuantity: 0 }), product("partner-empty-2", { producerId: "farm-b", trackStock: true, stockQuantity: 0 })],
    ];
    const first = rotateProductsForDay(groups.flat().reverse(), 20_856, "category", { ownProductsFirst: true });
    const second = rotateProductsForDay(groups.flat(), 20_857, "category", { ownProductsFirst: true });

    for (let group = 0; group < groups.length; group += 1) {
      const start = group * 2;
      expect(ids(first.slice(start, start + 2)).sort()).toEqual(ids(groups[group]).sort());
      expect(second.slice(start, start + 2)).toEqual(first.slice(start, start + 2).reverse());
    }
  });

  it("does not mutate the source array or product objects", () => {
    const frozen = Object.freeze(catalogue.map((entry) => Object.freeze({ ...entry })));
    const result = rotateProductsForDay(frozen, 20_856, "immutable");
    expect(result).not.toBe(frozen);
    expect(ids([...frozen])).toEqual(ids(catalogue));
    for (const entry of result) expect(frozen).toContain(entry);
  });

  it("handles empty lists, single products and negative day ordinals", () => {
    expect(rotateProductsForDay([], 0, "empty")).toEqual([]);
    expect(rotateProductsForDay([catalogue[0]], 20_856, "single")).toEqual([catalogue[0]]);
    expect(rotateProductsForDay(catalogue, -1, "negative"))
      .toEqual(rotateProductsForDay(catalogue, catalogue.length - 1, "negative"));
  });
});

describe("getProductRotationDay", () => {
  function ordinal(date: string): number {
    return getProductRotationDay(new Date(date));
  }

  it("changes at Paris midnight rather than UTC midnight in winter and summer", () => {
    expect(ordinal("2026-01-12T22:59:59.999Z")).toBe(Date.UTC(2026, 0, 12) / 86_400_000);
    expect(ordinal("2026-01-12T23:00:00.000Z")).toBe(Date.UTC(2026, 0, 13) / 86_400_000);
    expect(ordinal("2026-07-12T21:59:59.999Z")).toBe(Date.UTC(2026, 6, 12) / 86_400_000);
    expect(ordinal("2026-07-12T22:00:00.000Z")).toBe(Date.UTC(2026, 6, 13) / 86_400_000);
  });

  it("increments once across the 23-hour spring day", () => {
    const before = ordinal("2026-03-28T22:59:59.999Z");
    const midnight = ordinal("2026-03-28T23:00:00.000Z");
    expect(midnight).toBe(before + 1);
    expect(ordinal("2026-03-29T00:59:59.999Z")).toBe(midnight);
    expect(ordinal("2026-03-29T01:00:00.000Z")).toBe(midnight);
    expect(ordinal("2026-03-29T21:59:59.999Z")).toBe(midnight);
    expect(ordinal("2026-03-29T22:00:00.000Z")).toBe(midnight + 1);
  });

  it("increments once across the 25-hour autumn day and repeated hour", () => {
    const before = ordinal("2026-10-24T21:59:59.999Z");
    const midnight = ordinal("2026-10-24T22:00:00.000Z");
    expect(midnight).toBe(before + 1);
    expect(ordinal("2026-10-25T00:30:00.000Z")).toBe(midnight);
    expect(ordinal("2026-10-25T01:30:00.000Z")).toBe(midnight);
    expect(ordinal("2026-10-25T22:59:59.999Z")).toBe(midnight);
    expect(ordinal("2026-10-25T23:00:00.000Z")).toBe(midnight + 1);
  });
});
