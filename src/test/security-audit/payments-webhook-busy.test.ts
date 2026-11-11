import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Regression: a claim owned by an interrupted worker remains retryable.
const mocks = vi.hoisted(() => ({ retrieve: vi.fn(), finalize: vi.fn(), begin: vi.fn(), complete: vi.fn() }));
vi.mock("@/lib/viva-payment", () => ({
  getVivaConfig: () => ({ isConfigured: true, sourceCode: "audit-source" }),
  extractVivaOrderCodeFromJson: () => "1234567890",
  retrieveVivaTransaction: mocks.retrieve,
}));
vi.mock("@/lib/order-backend", () => ({
  getOrderByVivaOrderCodeByBackend: async () => ({ id: "AUDIT-ONLY", totalAmount: 10, paymentState: "pending" }),
  finalizeVivaPaymentByBackend: mocks.finalize,
  updateOrderPaymentByVivaOrderCodeByBackend: vi.fn(), applyOrderLoyaltyBonusByBackend: vi.fn(),
}));
vi.mock("@/lib/webhook-idempotency", () => ({ beginWebhookEvent: mocks.begin, completeWebhookEvent: mocks.complete, failWebhookEvent: vi.fn() }));
vi.mock("@/lib/invoice-store", () => ({ issueInvoiceForOrder: vi.fn() }));
vi.mock("@/lib/lottery-backend", () => ({ consumeLotteryRewardClaimsForOrderByBackend: vi.fn(), mintLotteryTicketsForOrderByBackend: vi.fn() }));
vi.mock("@/lib/referral-backend", () => ({ applyReferralRewardForPaidOrderByBackend: vi.fn() }));
vi.mock("@/lib/audit-log", () => ({ logAuditEvent: vi.fn() }));
vi.mock("@/lib/security-rate-limit", () => ({ getRequestIp: () => "127.0.0.1", hitRateLimit: async () => ({ allowed: true }), logRateLimitRejection: vi.fn() }));
import { POST } from "@/app/api/checkout/viva/webhook/route";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("VIVA_WEBHOOK_ALLOWED_IPS", "");
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Audit prohibits network access"); }));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("Payment audit: webhook lease acknowledgement", () => {
  it("returns a retryable 503 for a busy event while payment is still pending", async () => {
    const transactionId = "11111111-1111-4111-8111-111111111111";
    mocks.retrieve.mockResolvedValue({ transactionId, orderCode: "1234567890", sourceCode: "audit-source", currencyCode: "978", amountInMinorUnits: 1000, statusId: "F" });
    mocks.begin.mockResolvedValue("busy");
    const response = await POST(new Request("http://localhost/api/checkout/viva/webhook", {
      method: "POST", body: JSON.stringify({ EventTypeId: 1796, EventData: { TransactionId: transactionId } }),
    }));
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("30");
    expect(await response.json()).toMatchObject({ reason: "event_processing" });
    expect(mocks.finalize).not.toHaveBeenCalled();
    expect(mocks.complete).not.toHaveBeenCalled();
  });
});
