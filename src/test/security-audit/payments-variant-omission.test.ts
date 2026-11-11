import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Offline audit fixture: the server catalogue contains a disabled tracked variant.
const mocks = vi.hoisted(() => ({ append: vi.fn(), provider: vi.fn(), store: vi.fn() }));
vi.mock("@/lib/customer-backend", () => ({
  getCurrentCustomerSessionByBackend: async () => ({ customerId: "11111111-1111-4111-8111-111111111111", customer: {
    email: "audit@example.test", firstName: "Audit", lastName: "Fixture", dateOfBirth: "1990-01-01", loyaltyPoints: 0, loyaltyPointsSpent: 0,
  } }), previewPromoCodeByBackend: vi.fn(),
}));
vi.mock("@/lib/data-backend", () => ({ readPublicStoreByBackend: mocks.store }));
vi.mock("@/lib/invoice-config", () => ({ INVOICE_SETTINGS: { vatMode: "taxable" } }));
vi.mock("@/lib/checkout-attempt", () => ({
  beginCheckoutAttempt: async () => ({ action: "create" }), completeCheckoutAttempt: vi.fn(),
  createCheckoutFingerprint: () => "audit", failCheckoutAttempt: vi.fn(),
}));
vi.mock("@/lib/order-backend", () => ({ appendOrderByBackend: mocks.append, archiveIncompleteOrderByBackend: vi.fn(), getCustomerOrdersForLoyaltyByBackend: async () => [] }));
vi.mock("@/lib/lottery-backend", () => ({ getRedeemableLotteryRewardClaimBenefitByBackend: vi.fn(), getLotteryConfigByBackend: async () => null, reserveLotteryRewardClaimForOrderByBackend: vi.fn() }));
vi.mock("@/lib/referral-backend", () => ({ isReferralFirstOrderDiscountEligibleByBackend: async () => false }));
vi.mock("@/lib/security-rate-limit", () => ({ getRequestIp: () => "127.0.0.1", hitRateLimit: async () => ({ allowed: true }), logRateLimitRejection: vi.fn() }));
vi.mock("@/lib/viva-payment", () => ({ getVivaConfig: () => ({ isConfigured: true }), getVivaAccessToken: async () => "audit", createVivaCheckoutOrder: mocks.provider, buildVivaCheckoutUrl: () => "https://example.test/audit" }));
import { POST } from "@/app/api/checkout/viva/route";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Audit prohibits network access"); }));
  vi.stubEnv("SHIPPING_HOME_FEE_EUR", "6.9");
  mocks.append.mockResolvedValue({ id: "AUDIT-ONLY" });
  mocks.provider.mockResolvedValue("1234567890");
  mocks.store.mockResolvedValue({ content: { profile: {} }, products: [{
    id: "variant-product", name: "Audit product", category: "accessoires", price: 10, vatRate: 20, trackStock: false,
    variantOptions: [{ id: "large", label: "Large", price: 30, stockQuantity: 5, enabled: false, inStock: false }],
  }] });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

function checkout(id: string) {
  return POST(new Request("http://localhost/api/checkout/viva", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
    checkoutAttemptId: "22222222-2222-4222-8222-222222222222", items: [{ id, quantity: 1 }],
    shippingName: "Audit Fixture", shippingEmail: "audit@example.test", shippingPhone: "0612345678", deliveryMethod: "home",
    shippingAddress: "1 rue Test", shippingCity: "Rennes", shippingPostalCode: "35000", shippingCountry: "FR",
  }) }));
}

describe("Payment audit: variant omission", () => {
  it("rejects both the disabled explicit variant and its bare product ID", async () => {
    expect((await checkout("variant-product::large")).status).toBe(400);
    expect(mocks.append).not.toHaveBeenCalled();
    expect((await checkout("variant-product")).status).toBe(400);
    expect(mocks.append).not.toHaveBeenCalled();
    expect(mocks.provider).not.toHaveBeenCalled();
  });

  it("charges the selected enabled variant price and persists its canonical SKU", async () => {
    const store = await mocks.store();
    store.products[0].variantOptions[0].enabled = true;
    store.products[0].variantOptions[0].inStock = true;
    expect((await checkout("variant-product::large")).status).toBe(200);
    expect(mocks.append).toHaveBeenCalledWith(expect.objectContaining({
      items: [expect.objectContaining({ productId: "variant-product::large", unitPrice: 30 })],
    }));
  });

  it.each(["variant-product::", "variant-product::large::alias", "variant-product ::large"])("rejects a noncanonical SKU %s", async (id) => {
    expect((await checkout(id)).status).toBe(400);
    expect(mocks.provider).not.toHaveBeenCalled();
  });

  it("rejects a pack whose component has no explicit variant selection", async () => {
    const store = await mocks.store();
    store.products.push({ id: "pack", name: "Pack", price: 20, isPack: true, packProductIds: ["variant-product"] });
    expect((await checkout("pack")).status).toBe(400);
    expect(mocks.provider).not.toHaveBeenCalled();
  });

  it("production inventory RPC rejects a bare-ID order without marking inventory applied", async () => {
    const db = new PGlite();
    try {
      await db.exec(`CREATE TABLE orders(id TEXT PRIMARY KEY,payment_state TEXT,stock_applied_at TIMESTAMPTZ);
        CREATE TABLE products(id TEXT PRIMARY KEY,track_stock BOOLEAN,stock_quantity INTEGER,variant_options JSONB);
        CREATE TABLE order_items(id INTEGER,order_id TEXT,product_id TEXT,quantity INTEGER,unit_price NUMERIC);
        INSERT INTO orders VALUES('AUDIT-ONLY','paid',NULL);
        INSERT INTO products VALUES('variant-product',false,NULL,'[{"id":"large","stockQuantity":5}]');
        INSERT INTO order_items VALUES(1,'AUDIT-ONLY','variant-product',1,10);`);
      const sql = readFileSync("supabase/migrations/20261110000300_security_payment_boundaries.sql", "utf8");
      const start = sql.indexOf("CREATE OR REPLACE FUNCTION public.rpc_apply_order_inventory(");
      await db.exec(sql.slice(start, sql.indexOf("$$;", start) + 3));
      await expect(db.query("SELECT rpc_apply_order_inventory('AUDIT-ONLY')")).rejects.toThrow("inventory_variant_required");
      expect((await db.query("SELECT variant_options->0->>'stockQuantity' AS stock FROM products")).rows[0]).toEqual({ stock: "5" });
      expect((await db.query("SELECT stock_applied_at IS NOT NULL AS applied FROM orders")).rows[0]).toEqual({ applied: false });
    } finally { await db.close(); }
  }, 30_000);
});
