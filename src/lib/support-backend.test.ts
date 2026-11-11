import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient: () => ({ rpc }) }));
import { applySupportTransaction, getSupportVivaConfig, supportStatus, type SupportRecord } from "./support-backend";
const id = "11111111-1111-4111-8111-111111111111", tx = "22222222-2222-4222-8222-222222222222";
const record: SupportRecord = { id, pseudonym: "Breton", amount_cents: 1000, publish_name: true, publish_amount: true, source_code: "4321", order_code: "123456789012345678", transaction_id: null, paid_at: null, checkout_state: "ready", expires_at: "2099-01-01T00:00:00Z", review_required: false };
beforeEach(() => { vi.resetAllMocks(); for (const [key, value] of Object.entries({ NODE_ENV: "test", VIVA_ENV: "demo", VIVA_CLIENT_ID: "test", VIVA_CLIENT_SECRET: "test", VIVA_SOURCE_CODE: "1234", VIVA_SUPPORT_SOURCE_CODE: "4321" })) vi.stubEnv(key, value); rpc.mockResolvedValue({ error: null, data: null }); });
afterEach(() => vi.unstubAllEnvs());
describe("support source and private status", () => {
  it("requires a separate configured source", () => {
    expect(getSupportVivaConfig().isConfigured).toBe(true); vi.stubEnv("VIVA_SUPPORT_SOURCE_CODE", "1234"); expect(getSupportVivaConfig().isConfigured).toBe(false);
    vi.stubEnv("VIVA_SUPPORT_SOURCE_CODE", ""); expect(getSupportVivaConfig().isConfigured).toBe(false);
  });
  it("never offers payment resumption after an early verified refund", () => {
    expect(supportStatus(record).checkoutUrl).toContain("/web/checkout?ref=");
    expect(supportStatus({ ...record, transaction_id: tx, support_reversals: [{ amount_cents: 300 }] })).toMatchObject({ state: "review", checkoutUrl: null });
    expect(supportStatus({ ...record, paid_at: "2026-11-11", transaction_id: tx, support_reversals: [{ amount_cents: 1000 }] })).toMatchObject({ state: "refunded", checkoutUrl: null });
  });
  it("refuses foreign source/currency/order before the SQL mutation", async () => {
    const payment = { orderCode: record.order_code!, transactionId: tx, sourceCode: "4321", amountInMinorUnits: 1000, currencyCode: "EUR", statusId: "F" };
    for (const change of [{ sourceCode: "shop" }, { currencyCode: "USD" }, { orderCode: "9" }]) await expect(applySupportTransaction(record, { ...payment, ...change })).rejects.toThrow("correspondent");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("requires the verified original for a refund on another source", async () => {
    const parent = { orderCode: record.order_code!, transactionId: tx, sourceCode: "4321", amountInMinorUnits: 1000, currencyCode: "978", statusId: "R" };
    const refund = { ...parent, transactionId: id, sourceCode: "Default", amountInMinorUnits: -300, parentTransactionId: tx, statusId: "F" };
    await expect(applySupportTransaction(record, refund)).rejects.toThrow("correspondent");
    await applySupportTransaction(record, refund, parent);
    expect(rpc).toHaveBeenCalledWith("rpc_support_apply_transaction", expect.objectContaining({ p_source: "4321", p_amount: -300, p_parent: tx }));
  });
});
