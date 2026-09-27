import { describe, expect, it } from "vitest";
import { estimateOrderCashCents, formatOrderCash } from "./kanab-quest-order-cash";

describe("order game cash preview", () => {
  it.each([[50, 50_000], [12.34, 12_340], [0.01, 10], [19.99, 19_990]])(
    "estimates %s euros of products in game cents", (amount, expected) => {
      expect(estimateOrderCashCents(amount, 10)).toBe(expected);
    },
  );
  it("never rewards splitting the same total across multiple orders", () => {
    expect(estimateOrderCashCents(12.34, 10) + estimateOrderCashCents(37.66, 10))
      .toBe(estimateOrderCashCents(50, 10));
  });
  it.each([0, -10, NaN, Infinity, 2_147_483_647])("does not promise invalid or overflowing amounts: %s", amount => {
    expect(estimateOrderCashCents(amount, 10)).toBe(0);
  });
  it.each([0, -1, 1.5, NaN, Infinity])("hides previews for invalid rates: %s", rate => {
    expect(estimateOrderCashCents(50, rate)).toBe(0);
  });
  it("formats fractional rewards without losing cents", () => {
    expect(formatOrderCash(12_340).replace(/\s/g, " ")).toBe("123,4 €");
    expect(formatOrderCash(50_000).replace(/\s/g, " ")).toBe("500 €");
  });
});
