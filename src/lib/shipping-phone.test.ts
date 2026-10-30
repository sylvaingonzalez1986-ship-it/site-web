import { describe, expect, it } from "vitest";
import { normalizeShippingPhone } from "@/lib/shipping-phone";

describe("normalizeShippingPhone", () => {
  it.each([
    ["+32 470 12 34 56", "BE", "+32470123456"],
    ["0032 470 12 34 56", "Belgique", "+32470123456"],
    ["0470/12.34.56", "BE", "+32470123456"],
    ["02 123 45 67", "BE", "+3221234567"],
    ["061 23 45 67", "BE", "+3261234567"],
    ["06 12 34 56 78", "France", "+33612345678"],
    ["0033 6 12 34 56 78", "FR", "+33612345678"],
  ])("normalizes %s for %s", (phone, country, expected) => {
    expect(normalizeShippingPhone(phone, country)).toBe(expected);
  });

  it.each([
    ["+33 (6) 12 34 56 78", "BE", "+33612345678"],
    ["0032 470 12 34 56", "FR", "+32470123456"],
    ["+44 7700 900123", "BE", "+447700900123"],
  ])("preserves the explicit phone country in %s when shipping to %s", (phone, country, expected) => {
    expect(normalizeShippingPhone(phone, country)).toBe(expected);
  });

  it.each([
    ["+320470123456", "BE"],
    ["+32470", "BE"],
    ["+324701234567", "BE"],
    ["0612345678", "BE"],
    ["0712345678", "BE"],
    ["+32612345678", "BE"],
    ["0032612345678", "BE"],
    ["+330612345678", "FR"],
    ["++32470123456", "BE"],
    ["+32470123456 extension 1", "BE"],
    ["+1234567890123456", "BE"],
    ["0470;123456", "BE"],
    ["0470123456", "DE"],
    ["", "FR"],
  ])("rejects malformed or ambiguous phone %s for %s", (phone, country) => {
    expect(normalizeShippingPhone(phone, country)).toBe("");
  });
});
