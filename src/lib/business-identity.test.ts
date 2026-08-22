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
});
