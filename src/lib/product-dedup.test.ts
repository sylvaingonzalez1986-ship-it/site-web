import { describe, expect, it } from "vitest";

import { dedupeProducts, getProductDedupKey } from "@/lib/product-dedup";

describe("product-dedup", () => {
  it("builds identical keys for equivalent products", () => {
    const a = {
      name: " Fleur CBD ",
      category: "fleurs",
      price: 9.9,
      producerId: "p1",
      isPack: false,
    };
    const b = {
      name: "fleur cbd",
      category: "fleurs",
      price: 9.9,
      producerId: "p1",
      isPack: false,
    };

    expect(getProductDedupKey(a as never)).toBe(getProductDedupKey(b as never));
  });

  it("keeps only the first product for duplicate keys", () => {
    const first = { id: "1", name: "Fleur CBD", category: "fleurs", price: 9.9, producerId: "p1", isPack: false };
    const duplicate = { id: "2", name: "Fleur CBD", category: "fleurs", price: 9.9, producerId: "p1", isPack: false };
    const other = { id: "3", name: "Huile CBD", category: "huiles", price: 19.9, producerId: "p1", isPack: false };

    expect(dedupeProducts([first, duplicate, other] as never)).toEqual([first, other]);
  });
});
