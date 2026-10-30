import { describe, expect, it } from "vitest";
import { buildMondialRelayCsv } from "@/lib/mondial-relay-export";
import type { PublicCustomer } from "@/types/customer";
import type { CmsOrder } from "@/types/store";

const order: CmsOrder = {
  id: "TEST-BE-001",
  createdAt: "2026-10-29T10:00:00.000Z",
  status: "paid",
  paymentProvider: "viva",
  paymentState: "paid",
  source: "web",
  customerId: "customer-1",
  customerName: "Alice Dupont",
  customerEmail: "alice@example.test",
  shippingAddress: "12 rue du Test",
  shippingCity: "Bruxelles",
  shippingPostalCode: "1000",
  shippingCountry: "Belgique",
  shippingPhone: "+32470123456",
  deliveryMethod: "relay",
  relayId: "123456",
  relayAddress: "12 rue du Test",
  relayCity: "Bruxelles",
  relayPostalCode: "1000",
  relayCountry: "BE",
  itemsCount: 1,
  totalHt: 20,
  totalVat: 4,
  vatBreakdown: [{ rate: 20, baseHt: 20, vatAmount: 4 }],
  totalAmount: 24,
  items: [{
    productId: "product-1",
    name: "Article test",
    unitPrice: 24,
    quantity: 1,
    lineTotal: 24,
    vatRate: 20,
    unitPriceHt: 20,
    lineTotalHt: 20,
    lineVatAmount: 4,
  }],
};

const changedCustomer: PublicCustomer = {
  id: "customer-1",
  email: "new@example.test",
  firstName: "Bob",
  lastName: "Martin",
  phone: "0612345678",
  address: "99 rue du Nouveau Profil",
  city: "Paris",
  postalCode: "75001",
  country: "France",
  loyaltyPoints: 0,
  loyaltyPointsSpent: 0,
  contestBetaEnabled: false,
  promoCodes: [],
  createdAt: "2026-01-01T10:00:00.000Z",
};

function exportOrder(patch: Partial<CmsOrder> = {}, customer: PublicCustomer | null = null) {
  return buildMondialRelayCsv({
    orders: [{ ...order, ...patch }],
    productsById: new Map(),
    customersById: new Map([["customer-1", customer]]),
    config: { collectionType: "R", collectionRelayId: "654321", collectionCountry: "France" },
  });
}

describe("Mondial Relay CSV delivery contacts", () => {
  it.each(["+32 470 12 34 56", "0032470123456", "0470123456"])(
    "exports a Belgian relay and international contact phone from %s",
    (shippingPhone) => {
      const result = exportOrder({ shippingPhone });
      expect(result.errors).toEqual([]);
      const row = result.csv.split(";");
      expect(row).toHaveLength(44);
      expect(row[7]).toBe("1000");
      expect(row[8]).toBe("BE");
      expect(row[10]).toBe("+32470123456");
      expect(row.slice(14, 19)).toEqual(["FR", "R", "123456", "BE", "24R"]);
    },
  );

  it("keeps French delivery and French phone numbers working", () => {
    const result = exportOrder({
      shippingCountry: "France",
      shippingPostalCode: "29200",
      shippingCity: "Brest",
      shippingPhone: "06 12 34 56 78",
      relayCountry: "FR",
    });
    expect(result.errors).toEqual([]);
    const row = result.csv.split(";");
    expect(row[8]).toBe("FR");
    expect(row[10]).toBe("+33612345678");
    expect(row[17]).toBe("FR");
  });

  it("keeps an explicit French phone number for a Belgian delivery", () => {
    const result = exportOrder({ shippingPhone: "+33612345678" });
    expect(result.errors).toEqual([]);
    expect(result.csv.split(";")[10]).toBe("+33612345678");
  });

  it("uses the order's recipient and contact snapshot after a profile changes", () => {
    const result = exportOrder({}, changedCustomer);
    expect(result.errors).toEqual([]);
    const row = result.csv.split(";");
    expect(row[2]).toBe("DUPONT ALICE");
    expect(row[4]).toBe("12 RUE DU TEST");
    expect(row.slice(6, 9)).toEqual(["BRUXELLES", "1000", "BE"]);
    expect(row[10]).toBe("+32470123456");
    expect(row[11]).toBe("ALICE@EXAMPLE.TEST");
  });

  it("does not combine a partial order address with a later customer address", () => {
    const result = exportOrder({ shippingCity: undefined }, changedCustomer);
    expect(result.csv).toBe("");
    expect(result.errors).toEqual(["TEST-BE-001: ville destinataire manquante."]);
  });

  it("uses a complete relay snapshot if an old order has no shipping address snapshot", () => {
    const result = exportOrder({
      shippingAddress: undefined,
      shippingCity: undefined,
      shippingPostalCode: undefined,
      shippingCountry: undefined,
    }, changedCustomer);
    expect(result.errors).toEqual([]);
    expect(result.csv.split(";").slice(6, 9)).toEqual(["BRUXELLES", "1000", "BE"]);
  });

  it("falls back to one complete customer address for legacy orders without a snapshot", () => {
    const result = exportOrder({
      deliveryMethod: "home",
      customerName: undefined,
      customerEmail: undefined,
      shippingAddress: undefined,
      shippingCity: undefined,
      shippingPostalCode: undefined,
      shippingCountry: undefined,
      shippingPhone: undefined,
    }, changedCustomer);
    expect(result.errors).toEqual([]);
    const row = result.csv.split(";");
    expect(row[2]).toBe("MARTIN BOB");
    expect(row[4]).toBe("99 RUE DU NOUVEAU PROFIL");
    expect(row.slice(6, 9)).toEqual(["PARIS", "75001", "FR"]);
    expect(row[10]).toBe("+33612345678");
    expect(row[11]).toBe("NEW@EXAMPLE.TEST");
  });

  it("normalizes a fallback profile phone with its own country instead of the relay country", () => {
    const result = exportOrder({ shippingPhone: undefined }, changedCustomer);
    expect(result.errors).toEqual([]);
    expect(result.csv.split(";")[10]).toBe("+33612345678");
    expect(result.csv.split(";")[17]).toBe("BE");
  });

  it("rejects a malformed order phone instead of silently replacing it with the profile phone", () => {
    const result = exportOrder({ shippingPhone: "+32470" }, changedCustomer);
    expect(result.csv).toBe("");
    expect(result.errors).toEqual(["TEST-BE-001: telephone invalide ou manquant."]);
  });
});
