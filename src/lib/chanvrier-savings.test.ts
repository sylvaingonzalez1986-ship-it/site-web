import { describe, expect, it } from "vitest";
import { parseSavingsAmount, parseSavingsCommand } from "./chanvrier-savings";
const valid = { action: "deposit", amountCents: 10000, requestKey: "d5ec9e72-3d9a-4b54-8e39-02b0053d0e79" };
describe("savings transfers", () => {
  it("accepts only positive integer cents and a retry identifier", () => {
    expect(parseSavingsCommand({ ...valid, userId: "victim", rate: 100 })).toEqual(valid);
    for (const amountCents of [0, -1, .5, NaN, Infinity, 2000000001, "100"]) expect(parseSavingsCommand({ ...valid, amountCents })).toBeNull();
    for (const change of [{ action: "interest" }, { requestKey: "x" }, { requestKey: null }]) expect(parseSavingsCommand({ ...valid, ...change })).toBeNull();
  });
  it("parses French decimal input without accepting exponent or fractional cents", () => {
    expect(parseSavingsAmount(" 123,45 ")).toBe(12345);
    expect(parseSavingsAmount("0.29")).toBe(29);
    for (const text of ["", "0", "-2", "1,001", "1e3", "NaN", "20 000", "20000001"]) expect(parseSavingsAmount(text)).toBeNull();
  });
});
