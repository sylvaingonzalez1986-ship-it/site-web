import { describe, expect, it } from "vitest";

import { getCustomerCheckoutEligibility } from "@/lib/customer-checkout-eligibility";
import type { PublicCustomer } from "@/types/customer";

function makeCustomer(overrides: Partial<PublicCustomer> = {}): PublicCustomer {
  return {
    id: "c1",
    email: "test@example.com",
    firstName: "Jean",
    lastName: "Dupont",
    dateOfBirth: "1990-01-01",
    phone: "0600000000",
    address: "1 rue test",
    city: "Rennes",
    postalCode: "35000",
    country: "France",
    loyaltyPoints: 0,
    loyaltyPointsSpent: 0,
    contestBetaEnabled: false,
    promoCodes: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("customer-checkout-eligibility", () => {
  it("allows a complete adult profile", () => {
    expect(getCustomerCheckoutEligibility(makeCustomer())).toEqual({ allowed: true });
  });

  it("rejects an incomplete profile", () => {
    expect(getCustomerCheckoutEligibility(makeCustomer({ phone: "" }))).toEqual({
      allowed: false,
      error: "Profil incomplet. Complète ton profil avant de commander.",
    });
  });

  it("rejects a minor profile", () => {
    expect(getCustomerCheckoutEligibility(makeCustomer({ dateOfBirth: "2010-01-01" }))).toEqual({
      allowed: false,
      error: "Commande réservée aux personnes majeures (18+).",
    });
  });

  it("rejects an invalid birth date", () => {
    expect(getCustomerCheckoutEligibility(makeCustomer({ dateOfBirth: "bad-date" }))).toEqual({
      allowed: false,
      error: "Commande réservée aux personnes majeures (18+).",
    });
  });
});
