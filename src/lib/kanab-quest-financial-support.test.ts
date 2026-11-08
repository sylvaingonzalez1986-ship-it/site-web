import { describe, expect, it } from "vitest";
import { getKqFinancialSupportUrl } from "./kanab-quest-financial-support";

describe("voluntary financial support link", () => {
  it.each([undefined, "", "  ", "/checkout", "not a URL", "http://pay.vivawallet.com/support", "javascript:alert(1)", "https://user:password@pay.vivawallet.com/support", "https://pay.vivawallet.com:8080/support", "https://example.org/support", "https://pay.vivawallet.com.example.org/support", "https://pay.vivawallet.com", "https://www.vivapayments.com/web/checkout?ref=123"])("keeps support unavailable for invalid configuration: %s", value => {
    expect(getKqFinancialSupportUrl(value)).toBeNull();
  });

  it("preserves the configured recipient and query without adding a player or amount", () => {
    expect(getKqFinancialSupportUrl(" https://pay.vivawallet.com/les-champs-bretons?reference=game "))
      .toBe("https://pay.vivawallet.com/les-champs-bretons?reference=game");
  });
});
