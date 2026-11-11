import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  insert: vi.fn(),
  getOrder: vi.fn(),
  updatePayment: vi.fn(),
  finalizePayment: vi.fn(),
  retrieveTransaction: vi.fn(),
  invoice: vi.fn(),
  loyalty: vi.fn(),
  consumeClaims: vi.fn(),
  releaseClaims: vi.fn(),
  mintTickets: vi.fn(),
  referral: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseServiceClient: () => ({
    rpc: mocks.rpc,
    from: () => ({ insert: mocks.insert }),
  }),
}));
vi.mock("@/lib/order-backend", () => ({
  getOrderByVivaOrderCodeByBackend: mocks.getOrder,
  updateOrderPaymentByVivaOrderCodeByBackend: mocks.updatePayment,
  finalizeVivaPaymentByBackend: mocks.finalizePayment,
  applyOrderLoyaltyBonusByBackend: mocks.loyalty,
}));
vi.mock("@/lib/invoice-store", () => ({ issueInvoiceForOrder: mocks.invoice }));
vi.mock("@/lib/lottery-backend", () => ({
  consumeLotteryRewardClaimsForOrderByBackend: mocks.consumeClaims,
  releaseLotteryRewardClaimsForOrderByBackend: mocks.releaseClaims,
  mintLotteryTicketsForOrderByBackend: mocks.mintTickets,
}));
vi.mock("@/lib/referral-backend", () => ({
  applyReferralRewardForPaidOrderByBackend: mocks.referral,
}));
vi.mock("@/lib/audit-log", () => ({ logAuditEvent: vi.fn() }));
vi.mock("@/lib/security-rate-limit", () => ({
  getRequestIp: () => "127.0.0.1",
  hitRateLimit: vi.fn(async () => ({ allowed: true })),
  logRateLimitRejection: vi.fn(),
}));
vi.mock("@/lib/viva-payment", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/viva-payment")>(),
  retrieveVivaTransaction: mocks.retrieveTransaction,
}));

import { GET, POST } from "@/app/api/checkout/viva/webhook/route";

const orderCode = "6810910170372602";
const transactionId = "b1a3067c-321b-4ec6-bc9d-1778aef2a19d";
const paidOrder = {
  id: "ORD-TEST", customerId: "customer-test", totalAmount: 21.1,
  paymentState: "paid", status: "paid", extraLotteryTickets: 0,
};
const verifiedTransaction = {
  orderCode, transactionId, sourceCode: "3891", currencyCode: "978",
  amountInMinorUnits: 2110, statusId: "F",
};

function callback(token = "test-verification-key", rawOrderCode = orderCode, eventType = 1796) {
  return new Request("http://localhost/api/checkout/viva/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-viva-webhook-token": token },
    body: `{"EventTypeId":${eventType},"EventData":{"OrderCode":${rawOrderCode},"TransactionId":"${transactionId}","SourceCode":"3891"}}`,
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected network access in webhook test"); }));
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("VIVA_ENV", "demo");
  vi.stubEnv("VIVA_CLIENT_ID", "test-client");
  vi.stubEnv("VIVA_CLIENT_SECRET", "test-secret");
  vi.stubEnv("VIVA_SOURCE_CODE", "3891");
  vi.stubEnv("VIVA_WEBHOOK_TOKEN", "test-verification-key");
  vi.stubEnv("VIVA_WEBHOOK_VERIFICATION_KEY", "test-verification-key");
  vi.stubEnv("VIVA_WEBHOOK_ALLOWED_IPS", "");
  mocks.rpc.mockImplementation(async (name: string) => ({
    data: name === "rpc_begin_webhook_event" ? "process" : true, error: null,
  }));
  mocks.insert.mockResolvedValue({ error: null });
  mocks.getOrder.mockResolvedValue({ ...paidOrder, paymentState: "pending", status: "pending_payment" });
  mocks.updatePayment.mockResolvedValue(paidOrder);
  mocks.finalizePayment.mockResolvedValue({ order: paidOrder, reviewRequired: false });
  mocks.retrieveTransaction.mockResolvedValue(verifiedTransaction);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Viva webhook payment verification and recovery", () => {
  it("does not let the publicly returned verification key authorize an unverified payment", async () => {
    const verification = await GET(new Request("http://localhost/api/checkout/viva/webhook"));
    const { Key } = await verification.json();
    mocks.retrieveTransaction.mockRejectedValueOnce(new Error("Transaction does not exist"));

    const response = await POST(callback(Key));

    expect(response.status).toBe(503);
    expect(mocks.finalizePayment).not.toHaveBeenCalled();
    expect(mocks.updatePayment).not.toHaveBeenCalled();
    expect(mocks.invoice).not.toHaveBeenCalled();
  });

  it.each([
    { amountInMinorUnits: 1 },
    { currencyCode: "840" },
    { orderCode: "999999" },
    { transactionId: "different-transaction" },
    { sourceCode: "different-source" },
    { statusId: "E" },
  ])("rejects a provider transaction mismatch: %j", async (mismatch) => {
    mocks.retrieveTransaction.mockResolvedValueOnce({ ...verifiedTransaction, ...mismatch });

    const response = await POST(callback());

    expect(response.status).toBe(403);
    expect(mocks.finalizePayment).not.toHaveBeenCalled();
    expect(mocks.updatePayment).not.toHaveBeenCalled();
    expect(mocks.invoice).not.toHaveBeenCalled();
  });

  it("preserves an order code beyond JavaScript's safe integer range", async () => {
    const largeCode = "9007199254740993";
    mocks.retrieveTransaction.mockResolvedValueOnce({ ...verifiedTransaction, orderCode: largeCode });

    const response = await POST(callback("test-verification-key", largeCode));

    expect(response.status).toBe(200);
    expect(mocks.getOrder).toHaveBeenCalledWith(largeCode);
    expect(mocks.finalizePayment).toHaveBeenCalledWith(expect.objectContaining({ orderCode: largeCode }));
  });

  it("keeps an early callback retryable until the order exists", async () => {
    mocks.getOrder.mockResolvedValueOnce(null);
    mocks.updatePayment.mockResolvedValueOnce(null);

    const response = await POST(callback());

    expect(response.status).toBe(503);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("fails closed when event persistence is unavailable", async () => {
    const error = { code: "42501", message: "permission denied" };
    mocks.rpc.mockResolvedValueOnce({ error });
    mocks.insert.mockResolvedValueOnce({ error });

    const response = await POST(callback());

    expect(response.status).toBe(503);
    expect(mocks.finalizePayment).not.toHaveBeenCalled();
    expect(mocks.updatePayment).not.toHaveBeenCalled();
  });

  it("retries interrupted processing and skips a completed replay without granting rewards twice", async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: "process", error: null })
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: "process", error: null })
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: "duplicate", error: null });
    mocks.invoice.mockRejectedValueOnce(new Error("Temporary invoice failure"));

    expect((await POST(callback())).status).toBe(503);
    expect(mocks.rpc).toHaveBeenCalledWith("rpc_fail_webhook_event", expect.objectContaining({
      p_external_id: transactionId, p_error: "Temporary invoice failure",
    }));
    expect(mocks.loyalty).not.toHaveBeenCalled();

    expect((await POST(callback())).status).toBe(200);
    const replay = await POST(callback());
    expect(await replay.json()).toMatchObject({ ignored: true, reason: "duplicate_event" });
    expect(mocks.finalizePayment).toHaveBeenCalledTimes(2);
    expect(mocks.invoice).toHaveBeenCalledTimes(2);
    expect(mocks.loyalty).toHaveBeenCalledOnce();
    expect(mocks.mintTickets).toHaveBeenCalledOnce();
    expect(mocks.referral).toHaveBeenCalledOnce();
    expect(mocks.updatePayment).not.toHaveBeenCalled();
  });

  it("retains the paid order but withholds rewards when inventory needs review", async () => {
    mocks.finalizePayment.mockResolvedValueOnce({ order: paidOrder, reviewRequired: true });

    const response = await POST(callback());

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ paymentState: "paid", reviewRequired: true });
    expect(mocks.invoice).toHaveBeenCalledWith(paidOrder.id);
    expect(mocks.loyalty).not.toHaveBeenCalled();
    expect(mocks.consumeClaims).not.toHaveBeenCalled();
    expect(mocks.mintTickets).not.toHaveBeenCalled();
    expect(mocks.referral).not.toHaveBeenCalled();
  });

  it("records a late capture on an archived order for review without fulfilling its released claims", async () => {
    mocks.getOrder.mockResolvedValueOnce({ ...paidOrder, paymentState: "failed", status: "cancelled", archivedAt: "2026-11-10T12:00:00Z" });
    mocks.finalizePayment.mockResolvedValueOnce({ order: { ...paidOrder, status: "cancelled", paymentReviewRequired: true }, reviewRequired: true });
    const response = await POST(callback());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ paymentState: "paid", status: "cancelled", reviewRequired: true });
    expect(mocks.invoice).toHaveBeenCalledOnce();
    expect(mocks.consumeClaims).not.toHaveBeenCalled();
    expect(mocks.loyalty).not.toHaveBeenCalled();
    expect(mocks.mintTickets).not.toHaveBeenCalled();
    expect(mocks.referral).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledWith("rpc_complete_webhook_event", expect.any(Object));
  });

  it("acknowledges a delayed verified failure without releasing a paid order's rewards", async () => {
    mocks.getOrder.mockResolvedValueOnce(paidOrder);
    mocks.retrieveTransaction.mockResolvedValueOnce({ ...verifiedTransaction, statusId: "E" });
    mocks.updatePayment.mockResolvedValueOnce({ ...paidOrder, paymentReviewRequired: true });

    const response = await POST(callback("test-verification-key", orderCode, 1798));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ paymentState: "paid", reviewRequired: true });
    expect(mocks.updatePayment).toHaveBeenCalledWith({ orderCode, transactionId, paymentState: "failed" });
    expect(mocks.releaseClaims).not.toHaveBeenCalled();
    expect(mocks.finalizePayment).not.toHaveBeenCalled();
    expect(mocks.invoice).not.toHaveBeenCalled();
    expect(mocks.loyalty).not.toHaveBeenCalled();
    expect(mocks.mintTickets).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledWith("rpc_complete_webhook_event", expect.any(Object));
  });

  it("acknowledges an unpaid failure using only the atomic payment operation", async () => {
    mocks.retrieveTransaction.mockResolvedValueOnce({ ...verifiedTransaction, statusId: "E" });
    mocks.updatePayment.mockResolvedValueOnce({ ...paidOrder, paymentState: "failed", status: "pending_payment" });

    const response = await POST(callback("test-verification-key", orderCode, 1798));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ paymentState: "failed" });
    expect(mocks.updatePayment).toHaveBeenCalledOnce();
    expect(mocks.releaseClaims).not.toHaveBeenCalled();
    expect(mocks.invoice).not.toHaveBeenCalled();
    expect(mocks.loyalty).not.toHaveBeenCalled();
  });

  it("keeps a failed callback retryable if the protected payment RPC is not installed", async () => {
    mocks.retrieveTransaction.mockResolvedValueOnce({ ...verifiedTransaction, statusId: "E" });
    mocks.updatePayment.mockRejectedValueOnce(new Error("rpc_update_viva_payment not found"));

    const response = await POST(callback("test-verification-key", orderCode, 1798));

    expect(response.status).toBe(503);
    expect(mocks.releaseClaims).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledWith("rpc_fail_webhook_event", expect.any(Object));
    expect(mocks.rpc).not.toHaveBeenCalledWith("rpc_complete_webhook_event", expect.any(Object));
  });
});
