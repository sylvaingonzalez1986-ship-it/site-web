import { describe, expect, it } from "vitest";
import { parseKqSaleQuantity } from "./kanab-quest-sale-quantity";

describe("sale quantity in tenths of a gram", () => {
  it("distinguishes the available maximum from an erased field", () => {
    expect(parseKqSaleQuantity(null)).toEqual({ valid: true });
    expect(parseKqSaleQuantity("")).toEqual({ valid: false });
  });
  it.each(["20.1", "20,1", " 20.1 "])("preserves the requested quantity %s", value => {
    expect(parseKqSaleQuantity(value)).toEqual({ valid: true, units: 201 });
  });
  it("accepts decimal floating point noise at a valid tenth", () => {
    expect(parseKqSaleQuantity("4.1")).toEqual({ valid: true, units: 41 });
  });
  it.each([" ", "0", "-1", "0.05", "1.05", "NaN", "Infinity", "abc", "9007199254740992"])("rejects %s instead of changing the sale quantity", value => {
    expect(parseKqSaleQuantity(value)).toEqual({ valid: false });
  });
});
