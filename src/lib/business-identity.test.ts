import { describe, expect, it } from "vitest";
import { BUSINESS_IDENTITY } from "@/lib/business-identity";

describe("business identity", () => {
  it("keeps SIREN, SIRET and French VAT identifiers consistent", () => {
    const { siren, siret, vatNumber } = BUSINESS_IDENTITY;
    const vatKey = (12 + 3 * (Number(siren) % 97)) % 97;

    expect(siret).toHaveLength(14);
    expect(siret.startsWith(siren)).toBe(true);
    expect(vatNumber).toBe(`FR${vatKey.toString().padStart(2, "0")}${siren}`);
  });

  it("links the legal identity to stable external registry records", () => {
    expect(BUSINESS_IDENTITY.officialRegistryUrl).toContain(BUSINESS_IDENTITY.siren);
    expect(BUSINESS_IDENTITY.externalRegistryUrl).toContain(BUSINESS_IDENTITY.siren);
    expect(BUSINESS_IDENTITY.foundingDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("keeps independent industry mentions distinct from first-party pages", () => {
    const mentionUrls = BUSINESS_IDENTITY.externalMentions.map((mention) => mention.url);

    expect(new Set(mentionUrls).size).toBe(mentionUrls.length);
    expect(mentionUrls).toHaveLength(3);
    expect(mentionUrls.every((url) => url.startsWith("https://"))).toBe(true);
    expect(mentionUrls.every((url) => !url.includes("leschanvriersbretons.com"))).toBe(true);
  });
});
