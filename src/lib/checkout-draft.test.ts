import { describe, expect, it } from "vitest";
import { alignCheckoutDraft, resolveCheckoutDraft, type CheckoutDraftState } from "@/lib/checkout-draft";
import type { PublicCustomer } from "@/types/customer";

const customer: PublicCustomer = {
  id: "customer-a", firstName: "Anne", lastName: "Test", email: "anne@example.test",
  dateOfBirth: "1990-01-01", phone: "0600000000", address: "1 rue du Profil",
  city: "Rennes", postalCode: "35000", country: "France", loyaltyPoints: 0,
  loyaltyPointsSpent: 0, contestBetaEnabled: false, promoCodes: [], createdAt: "2026-01-01",
};
const relay = { id: "relay-a", name: "Relais choisi", address: "2 rue du Relais", city: "Brest", postalCode: "29200", country: "FR" };

describe("checkout draft", () => {
  it("prefills delivery from the customer as soon as the session arrives", () => {
    const visitor: CheckoutDraftState = { customerId: null, edits: {} };
    expect(resolveCheckoutDraft(visitor, customer)).toMatchObject({
      shippingName: "Anne Test", shippingEmail: customer.email, shippingAddress: customer.address,
      shippingPhone: customer.phone, deliveryMethod: "home", selectedRelayPoint: null,
    });
  });

  it("preserves edited delivery and relay when the same profile is refreshed", () => {
    const draft: CheckoutDraftState = {
      customerId: customer.id,
      edits: { shippingAddress: "8 rue de Livraison", shippingPhone: "", deliveryMethod: "relay", selectedRelayPoint: relay },
    };
    const refreshed = { ...customer, phone: "0699999999", city: "Nantes" };
    expect(resolveCheckoutDraft(alignCheckoutDraft(draft, customer.id), refreshed)).toMatchObject({
      shippingAddress: "8 rue de Livraison", shippingPhone: "", shippingCity: "Nantes",
      deliveryMethod: "relay", selectedRelayPoint: relay,
    });
  });

  it("uses updated profile values only for fields the client has not edited", () => {
    const draft: CheckoutDraftState = { customerId: customer.id, edits: { shippingCity: "Brest" } };
    expect(resolveCheckoutDraft(draft, { ...customer, phone: "0677777777", city: "Nantes" })).toMatchObject({
      shippingPhone: "0677777777", shippingCity: "Brest",
    });
  });

  it("carries the visitor's delivery estimate through login without carrying personal data", () => {
    const draft: CheckoutDraftState = {
      customerId: null,
      edits: { deliveryMethod: "relay", shippingEmail: "old@example.test", selectedRelayPoint: relay },
    };
    expect(alignCheckoutDraft(draft, customer.id)).toEqual({ customerId: customer.id, edits: { deliveryMethod: "relay" } });
    expect(resolveCheckoutDraft(draft, customer)).toMatchObject({ shippingEmail: customer.email, selectedRelayPoint: null, deliveryMethod: "relay" });
  });

  it("discards all delivery edits and relay on logout and cannot revive them on re-login", () => {
    const draft: CheckoutDraftState = { customerId: customer.id, edits: { shippingAddress: "Private address", selectedRelayPoint: relay, deliveryMethod: "relay" } };
    const signedOut = alignCheckoutDraft(draft, null);
    expect(signedOut).toEqual({ customerId: null, edits: {} });
    expect(resolveCheckoutDraft(signedOut, null)).toMatchObject({ shippingName: "", shippingEmail: "", shippingAddress: "", selectedRelayPoint: null });
    expect(resolveCheckoutDraft(signedOut, customer)).toMatchObject({ shippingAddress: customer.address, selectedRelayPoint: null, deliveryMethod: "home" });
  });

  it("never exposes another customer's draft, even before state synchronization", () => {
    const draft: CheckoutDraftState = { customerId: customer.id, edits: { shippingEmail: "private@example.test", shippingAddress: "Private address", selectedRelayPoint: relay } };
    const other = { ...customer, id: "customer-b", email: "b@example.test", address: "Another address" };
    expect(resolveCheckoutDraft(draft, other)).toMatchObject({ shippingEmail: other.email, shippingAddress: other.address, selectedRelayPoint: null });
    expect(alignCheckoutDraft(draft, other.id)).toEqual({ customerId: other.id, edits: {} });
  });
});
