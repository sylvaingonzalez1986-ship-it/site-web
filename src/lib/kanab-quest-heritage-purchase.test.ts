import { describe, expect, it } from "vitest";
import {
  buildKqHeritagePurchaseDrawPlan,
  getKqBaseProductId,
  KQ_HERITAGE_PURCHASE_DRAWS_LIVE,
} from "@/lib/kanab-quest-heritage-purchase";

describe("Kanab Quest purchase Heritage awards", () => {
  it("enables Heritage attribution for verified paid purchases", () => {
    expect(KQ_HERITAGE_PURCHASE_DRAWS_LIVE).toBe(true);
  });

  it("normalizes variant product identifiers", () => {
    expect(getKqBaseProductId(" flower-1::size-large ")).toBe("flower-1");
  });

  it("creates one stable draw per eligible purchased unit", () => {
    expect(buildKqHeritagePurchaseDrawPlan([
      { id: 41, productId: "flower-1::5g", quantity: 2 },
      { id: 42, productId: "regular-1", quantity: 4 },
      { id: 43, productId: "flower-2", quantity: 1 },
    ], ["flower-1", "flower-2"])).toEqual([
      { orderItemId: 41, unitIndex: 1 },
      { orderItemId: 41, unitIndex: 2 },
      { orderItemId: 43, unitIndex: 1 },
    ]);
  });

  it("ignores invalid quantities instead of creating phantom draws", () => {
    expect(buildKqHeritagePurchaseDrawPlan([
      { id: 51, productId: "flower-1", quantity: -2 },
      { id: 52, productId: "flower-1", quantity: 1.9 },
    ], ["flower-1"])).toEqual([{ orderItemId: 52, unitIndex: 1 }]);
  });
});
