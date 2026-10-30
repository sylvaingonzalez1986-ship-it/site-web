import { describe, expect, it } from "vitest";
import { normalizeShippingCountryCode } from "@/lib/shipping-country";

describe("normalizeShippingCountryCode", () => {
  it.each(["BE", "be", " Belgique ", "Belgium", "België", "Belgie\u0308", "Belgien"])(
    "recognizes Belgium as BE: %s",
    (value) => expect(normalizeShippingCountryCode(value)).toBe("BE"),
  );

  it.each(["FR", " fr ", "France", "france"])("recognizes France: %s", (value) => {
    expect(normalizeShippingCountryCode(value)).toBe("FR");
  });

  it.each(["NL", " de ", "es", "LU"])("preserves existing country codes: %s", (value) => {
    expect(normalizeShippingCountryCode(value)).toBe(value.trim().toUpperCase());
  });

  it.each([undefined, null, "", " ", "B", "B-E", "BE123", "Belgique inconnue", "Brazil", "<FR>"])(
    "leaves absent or unrecognized countries invalid: %s",
    (value) => expect(normalizeShippingCountryCode(value)).toBe(""),
  );
});
