import { describe, expect, it } from "vitest";
import { parseSupportEuros, parseSupportForm, parseSupportIdentity, supportCsv, type AdminSupportRow } from "./support-campaign";
describe("support form and export", () => {
  it("accepts French amounts without rounding extra decimals", () => {
    expect(parseSupportEuros(" 2,05 ")).toBe(205); expect(parseSupportEuros("1.1")).toBe(110);
    for (const value of ["", "1.001", "1e3", "-2", "Infinity", "1 000", "0x10"]) expect(parseSupportEuros(value)).toBeNull();
  });
  it("rejects unsafe pseudonyms, invalid amounts and implicit publication", () => {
    const valid = { pseudonym: "Breton", amountCents: 250, publishName: false, publishAmount: false };
    expect(parseSupportForm(valid)).toEqual(valid);
    for (const change of [{ pseudonym: "<img>" }, { pseudonym: "a\u202eb" }, { pseudonym: "" }, { amountCents: 99 }, { amountCents: 100001 }, { amountCents: 200.2 }, { publishName: undefined }]) expect(() => parseSupportForm({ ...valid, ...change })).toThrow();
    expect(() => parseSupportIdentity({ id: "known-public-id", token: "" })).toThrow();
  });
  it("exports unknown fees as empty and neutralises spreadsheet formulas", () => {
    const row = { id: "id", pseudonym: "=HYPERLINK(1)", amountCents: 1000, capturedCents: 1000, refundedCents: 200, feesCents: null, feeReference: null, reviewRequired: false } as AdminSupportRow;
    const csv = supportCsv([row]);
    expect(csv).toContain('"\'=HYPERLINK(1)"'); expect(csv).toContain('"10,00";"10,00";"2,00";"";""');
    expect(supportCsv([{ ...row, feesCents: 0 }])).toContain('"2,00";"0,00";"8,00"');
  });
});
