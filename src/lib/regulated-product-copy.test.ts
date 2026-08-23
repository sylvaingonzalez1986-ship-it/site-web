import { describe, expect, it } from "vitest";
import {
  sanitizePublicProductDescription,
  UNSUPPORTED_PUBLIC_PRODUCT_CLAIM,
} from "@/lib/regulated-product-copy";

describe("regulated public product copy", () => {
  it.each([
    ["myrcène (relaxant et enveloppant)", "myrcène (aromatique et enveloppant)"],
    ["β-Myrcène : terreux, rond, relaxant", "β-Myrcène : terreux, rond, aromatique"],
    ["Une vape douce et apaisante.", "Une vape douce et agréable."],
  ])("neutralizes an unsupported effect term", (source, expected) => {
    const sanitized = sanitizePublicProductDescription(source);

    expect(sanitized).toBe(expected);
    expect(sanitized).not.toMatch(UNSUPPORTED_PUBLIC_PRODUCT_CLAIM);
  });

  it("removes the unsupported effects sentence while preserving aromatic copy", () => {
    const description = [
      "La Lemon Nerds offre des arômes de citron acidulé.",
      "Appréciée pour ses effets relaxants et équilibrés, elle procure une détente douce tout en conservant une sensation de clarté mentale.",
      "Saveurs : citron et agrumes.",
    ].join("\n\n");

    const sanitized = sanitizePublicProductDescription(description);

    expect(sanitized).toContain("arômes de citron acidulé");
    expect(sanitized).toContain("Saveurs : citron et agrumes");
    expect(sanitized).not.toMatch(UNSUPPORTED_PUBLIC_PRODUCT_CLAIM);
  });

  it("leaves factual aromatic descriptions untouched", () => {
    const description = "Notes de fruits noirs, base boisée et finale épicée.";

    expect(sanitizePublicProductDescription(description)).toBe(description);
  });
});
