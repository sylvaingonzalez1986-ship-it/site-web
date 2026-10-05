import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicCustomer } from "@/types/customer";

const {
  getCurrentCustomerSessionByBackend,
  readPublicStoreByBackend,
  beginCheckoutAttempt,
  completeCheckoutAttempt,
  appendOrderByBackend,
  createVivaCheckoutOrder,
} = vi.hoisted(() => ({
  getCurrentCustomerSessionByBackend: vi.fn(),
  readPublicStoreByBackend: vi.fn(),
  beginCheckoutAttempt: vi.fn(),
  completeCheckoutAttempt: vi.fn(),
  appendOrderByBackend: vi.fn(),
  createVivaCheckoutOrder: vi.fn(),
}));

vi.mock("@/lib/customer-backend", () => ({
  getCurrentCustomerSessionByBackend,
  previewPromoCodeByBackend: vi.fn(),
}));
vi.mock("@/lib/data-backend", () => ({ readPublicStoreByBackend }));
vi.mock("@/lib/checkout-attempt", () => ({
  beginCheckoutAttempt,
  completeCheckoutAttempt,
  createCheckoutFingerprint: vi.fn(() => "cart-fingerprint"),
  failCheckoutAttempt: vi.fn(),
}));
vi.mock("@/lib/order-backend", () => ({
  appendOrderByBackend,
  archiveIncompleteOrderByBackend: vi.fn(),
  getCustomerOrdersForLoyaltyByBackend: vi.fn(async () => []),
}));
vi.mock("@/lib/lottery-backend", () => ({
  getRedeemableLotteryRewardClaimBenefitByBackend: vi.fn(),
  getLotteryConfigByBackend: vi.fn(async () => null),
  reserveLotteryRewardClaimForOrderByBackend: vi.fn(),
}));
vi.mock("@/lib/referral-backend", () => ({
  isReferralFirstOrderDiscountEligibleByBackend: vi.fn(async () => false),
}));
vi.mock("@/lib/security-rate-limit", () => ({
  getRequestIp: vi.fn(() => "127.0.0.1"),
  hitRateLimit: vi.fn(async () => ({ allowed: true })),
  logRateLimitRejection: vi.fn(),
}));
vi.mock("@/lib/viva-payment", () => ({
  getVivaConfig: vi.fn(() => ({ isConfigured: true })),
  getVivaAccessToken: vi.fn(async () => "test-token"),
  createVivaCheckoutOrder,
  buildVivaCheckoutUrl: vi.fn(() => "https://payment.example.test/checkout"),
}));

import { POST } from "@/app/api/checkout/viva/route";

function makeCustomer(overrides: Partial<PublicCustomer> = {}): PublicCustomer {
  return {
    id: "customer-1",
    email: "account@example.test",
    firstName: "Camille",
    lastName: "Martin",
    dateOfBirth: "1990-01-01",
    phone: "",
    address: "",
    city: "",
    postalCode: "",
    country: "",
    loyaltyPoints: 0,
    loyaltyPointsSpent: 0,
    contestBetaEnabled: false,
    promoCodes: [],
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function setCustomer(overrides: Partial<PublicCustomer> = {}) {
  const customer = makeCustomer(overrides);
  getCurrentCustomerSessionByBackend.mockResolvedValue({ customerId: customer.id, customer });
}

const contact = {
  shippingName: "Camille Martin",
  shippingEmail: "delivery@example.test",
  shippingPhone: "06 12 34 56 78",
};

const homeDelivery = {
  ...contact,
  deliveryMethod: "home",
  shippingAddress: "12 rue du Marché",
  shippingCity: "Rennes",
  shippingPostalCode: "35000",
  shippingCountry: "France",
};

const relayDelivery = {
  ...contact,
  deliveryMethod: "relay",
  relayId: "relay-1",
  relayName: "Relais du marché",
  relayAddress: "2 rue du Relais",
  relayCity: "Brest",
  relayPostalCode: "29200",
  relayCountry: "FR",
};

function checkout(delivery: Record<string, unknown>) {
  return POST(new Request("http://localhost/api/checkout/viva", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      checkoutAttemptId: "12345678-1234-4123-8123-123456789012",
      items: [{ id: "flower", quantity: 2, price: 0.01 }],
      amount: 0.02,
      deliveryFeeEur: 0,
      ...delivery,
    }),
  }));
}

describe("POST /api/checkout/viva delivery details", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T12:00:00Z"));
    vi.stubEnv("SHIPPING_HOME_FEE_EUR", "6.9");
    vi.stubEnv("SHIPPING_RELAY_FEE_EUR", "4.9");
    vi.stubEnv("SHIPPING_FREE_THRESHOLD_EUR", "89");
    setCustomer();
    readPublicStoreByBackend.mockResolvedValue({
      content: { profile: {} },
      products: [{
        id: "flower",
        name: "Fleur du marché",
        category: "fleurs",
        price: 10,
        vatRate: 20,
        trackStock: true,
        stockQuantity: 10,
      }],
    });
    beginCheckoutAttempt.mockResolvedValue({ action: "create" });
    completeCheckoutAttempt.mockResolvedValue(undefined);
    createVivaCheckoutOrder.mockResolvedValue("viva-order-1");
    appendOrderByBackend.mockResolvedValue({ id: "order-1" });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("uses the cart's home delivery details for an adult without a saved delivery profile", async () => {
    const response = await checkout(homeDelivery);

    expect(response.status).toBe(200);
    expect(appendOrderByBackend).toHaveBeenCalledWith(expect.objectContaining({
      customer: { id: "customer-1", email: contact.shippingEmail, name: contact.shippingName },
      shipping: expect.objectContaining({
        address: homeDelivery.shippingAddress,
        city: "Rennes",
        postalCode: "35000",
        country: "France",
        phone: contact.shippingPhone,
        deliveryMethod: "home",
        deliveryFee: 6.9,
      }),
      totalAmount: 26.9,
    }));
    expect(createVivaCheckoutOrder).toHaveBeenCalledWith(expect.objectContaining({ amount: 26.9 }));
  });

  it("allows a complete relay and contact details without asking for a personal address, city or postcode", async () => {
    const response = await checkout(relayDelivery);

    expect(response.status).toBe(200);
    expect(appendOrderByBackend).toHaveBeenCalledWith(expect.objectContaining({
      shipping: expect.objectContaining({
        address: relayDelivery.relayAddress,
        city: "Brest",
        postalCode: "29200",
        country: "FR",
        phone: contact.shippingPhone,
        deliveryMethod: "relay",
        relayId: "relay-1",
        deliveryFee: 4.9,
      }),
      totalAmount: 24.9,
    }));
  });

  it("prefers the current order's address over a previously saved address", async () => {
    setCustomer({ address: "Ancienne adresse", city: "Paris", postalCode: "75001", country: "France" });

    expect((await checkout(homeDelivery)).status).toBe(200);
    expect(appendOrderByBackend).toHaveBeenCalledWith(expect.objectContaining({
      shipping: expect.objectContaining({ address: homeDelivery.shippingAddress, city: "Rennes" }),
    }));
  });

  it("still requires an authenticated customer", async () => {
    getCurrentCustomerSessionByBackend.mockResolvedValue(null);

    expect((await checkout(homeDelivery)).status).toBe(401);
    expect(createVivaCheckoutOrder).not.toHaveBeenCalled();
  });

  it.each([undefined, "2010-01-01", "1990-02-30"])("rejects a missing, underage or invalid profile birth date: %s", async (dateOfBirth) => {
    setCustomer({ dateOfBirth });

    // A request body cannot replace the account's majority check.
    expect((await checkout({ ...homeDelivery, dateOfBirth: "1990-01-01" })).status).toBe(403);
    expect(createVivaCheckoutOrder).not.toHaveBeenCalled();
    expect(appendOrderByBackend).not.toHaveBeenCalled();
  });

  it.each([
    { ...homeDelivery, shippingAddress: "" },
    { ...homeDelivery, shippingCity: "" },
    { ...homeDelivery, shippingPostalCode: "" },
    { ...homeDelivery, shippingEmail: "invalid" },
    { ...homeDelivery, shippingPhone: "123" },
    { ...relayDelivery, shippingPhone: "" },
    { ...relayDelivery, relayId: "" },
    { ...relayDelivery, relayName: "" },
    { ...relayDelivery, relayAddress: "" },
    { ...relayDelivery, relayCity: "" },
    { ...relayDelivery, relayPostalCode: "!" },
    { ...relayDelivery, relayCountry: "invalid" },
  ])("rejects incomplete or invalid delivery before payment: %j", async (delivery) => {
    expect((await checkout(delivery)).status).toBe(400);
    expect(createVivaCheckoutOrder).not.toHaveBeenCalled();
    expect(appendOrderByBackend).not.toHaveBeenCalled();
  });

  it("still rejects quantities exceeding server stock", async () => {
    const response = await checkout({ ...homeDelivery, items: [{ id: "flower", quantity: 11 }] });

    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("Stock insuffisant");
    expect(createVivaCheckoutOrder).not.toHaveBeenCalled();
  });
});
