import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getSwissBitcoinPaymentStatus,
  prepareSwissBitcoinPayment,
  receiveSwissBitcoinNotification,
  recoverSwissBitcoinInvoice,
  reconcileSwissBitcoinPayments,
} from "@/lib/swiss-bitcoin-pay-service";
import type { CmsOrder } from "@/types/store";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  createInvoice: vi.fn(),
  fetchInvoice: vi.fn(),
  enabled: vi.fn(),
  getOrder: vi.fn(),
  paidEffects: vi.fn(),
  beginEvent: vi.fn(),
  completeEvent: vi.fn(),
  failEvent: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient: () => ({ rpc: mocks.rpc, from: mocks.from }) }));
vi.mock("@/lib/order-backend", () => ({ getOrderByIdByBackend: mocks.getOrder }));
vi.mock("@/lib/order-paid-effects", () => ({ processPaidOrder: mocks.paidEffects }));
vi.mock("@/lib/webhook-idempotency", () => ({
  beginWebhookEvent: mocks.beginEvent,
  completeWebhookEvent: mocks.completeEvent,
  failWebhookEvent: mocks.failEvent,
}));
vi.mock("@/lib/swiss-bitcoin-pay", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/swiss-bitcoin-pay")>(),
  createSwissBitcoinInvoice: mocks.createInvoice,
  fetchSwissBitcoinInvoice: mocks.fetchInvoice,
  isSwissBitcoinPayEnabled: mocks.enabled,
}));

const orderId = "ORD-20261121-4321";
const invoiceId = "10111111-1111-4111-8111-111111111111";
const attemptId = "20222222-2222-4222-8222-222222222222";
const checkoutUrl = `https://pay.swiss-bitcoin-pay.ch/${invoiceId}`;
const pendingOrder: CmsOrder = {
  id: orderId,
  createdAt: new Date().toISOString(),
  status: "pending_payment",
  paymentProvider: "swiss_bitcoin_pay",
  paymentState: "pending",
  source: "web",
  totalAmount: 21.50,
  totalHt: 20,
  totalVat: 1.50,
  vatBreakdown: [],
  itemsCount: 0,
  items: [],
};
const activeAttempt = {
  id: attemptId,
  order_id: orderId,
  invoice_id: invoiceId,
  expected_eur_minor: 2150,
  state: "pending",
  checkout_url: checkoutUrl,
  effects_pending: false,
};
const unknownAttempt = { ...activeAttempt, invoice_id: null, state: "unknown", checkout_url: null };
const paidInvoice = {
  id: invoiceId,
  extra: { reference: attemptId },
  input: { amount: 21.50, unit: "EUR" },
  status: "paid",
  createdAt: 1795260000,
  delay: 600,
  paidAt: 1795260010,
};

function queries(...results: unknown[]) {
  return results.map((data) => {
    const builder = {
      select: vi.fn().mockReturnThis(),
      returns: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
      then: (resolve: (value: { data: unknown; error: null }) => unknown) =>
        Promise.resolve({ data, error: null }).then(resolve),
    };
    mocks.from.mockReturnValueOnce(builder);
    return builder;
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.enabled.mockReturnValue(true);
  mocks.rpc.mockResolvedValue({ data: { effects_pending: false }, error: null });
});

describe("Swiss Bitcoin Pay attempt reconciliation", () => {
  it("preserves an ambiguous checkout creation and does not ask the provider for a second invoice", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: { action: "create", attempt_id: attemptId, expected_eur_minor: 2150 },
    });
    mocks.createInvoice.mockRejectedValueOnce(new Error("Timed out"));
    await prepareSwissBitcoinPayment(orderId);

    mocks.rpc.mockResolvedValueOnce({ data: { action: "existing" } });
    await prepareSwissBitcoinPayment(orderId, true);
    expect(mocks.createInvoice).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("rpc_note_swiss_bitcoin_creation", {
      p_attempt_id: attemptId,
      p_definitive: false,
    });
  });

  it("retries a failed attachment using the same provider invoice", async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: { action: "create", attempt_id: attemptId, expected_eur_minor: 2150 } })
      .mockResolvedValueOnce({ error: { message: "Transient update failure" } })
      .mockResolvedValueOnce({ data: true });
    mocks.createInvoice.mockResolvedValueOnce({ invoiceId, checkoutUrl });
    await prepareSwissBitcoinPayment(orderId);
    expect(mocks.createInvoice).toHaveBeenCalledTimes(1);
    const repeated = mocks.rpc.mock.calls.filter(([name]) => name === "rpc_attach_swiss_bitcoin_invoice");
    expect(repeated).toHaveLength(2);
    expect(repeated[0]).toEqual(repeated[1]);
  });

  it("never opens a replacement while a creating or unconfirmed attempt is outstanding", async () => {
    queries([unknownAttempt], [{ ...activeAttempt, state: "confirming" }]);
    for (const state of ["review", "confirming"]) {
      expect(await getSwissBitcoinPaymentStatus(pendingOrder, false))
        .toMatchObject({ state, canRetry: false, canPayByCard: false });
    }
  });

  it("keeps polling and card fallback available when Bitcoin creation is disabled", async () => {
    mocks.enabled.mockReturnValue(false);
    queries([activeAttempt], [{ ...activeAttempt, state: "expired" }]);
    expect(await getSwissBitcoinPaymentStatus(pendingOrder, false))
      .toMatchObject({ state: "pending", checkoutUrl, canRetry: false, canPayByCard: false });
    expect(await getSwissBitcoinPaymentStatus(pendingOrder, false))
      .toMatchObject({ state: "expired", canRetry: false, canPayByCard: true });
    await prepareSwissBitcoinPayment(orderId);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("does not execute paid effects for a conflicting provider observation", async () => {
    queries(activeAttempt);
    mocks.fetchInvoice.mockResolvedValueOnce({ ...paidInvoice, input: { amount: 1, unit: "EUR" } });
    await receiveSwissBitcoinNotification(invoiceId);
    expect(mocks.rpc).toHaveBeenCalledWith("rpc_observe_swiss_bitcoin_payment", expect.objectContaining({
      p_issue: "invoice_amount_mismatch",
      p_state: "review",
    }));
    expect(mocks.paidEffects).not.toHaveBeenCalled();
  });

  it("recovers a timed-out creation using the provider reference and reuses the paid effects claim", async () => {
    const [, recovered] = queries(null, unknownAttempt, activeAttempt);
    mocks.fetchInvoice.mockResolvedValue(paidInvoice);
    mocks.getOrder.mockResolvedValue({ ...pendingOrder, paymentState: "paid" });
    mocks.beginEvent.mockResolvedValueOnce("process").mockResolvedValueOnce("duplicate");
    mocks.rpc.mockImplementation(async (name: string) => ({
      data: name === "rpc_observe_swiss_bitcoin_payment" ? { effects_pending: true } : true,
      error: null,
    }));
    await receiveSwissBitcoinNotification(invoiceId);
    await receiveSwissBitcoinNotification(invoiceId);

    expect(recovered.eq).toHaveBeenCalledWith("id", attemptId);
    expect(mocks.rpc).toHaveBeenCalledWith("rpc_observe_swiss_bitcoin_payment", expect.objectContaining({
      p_attempt_id: attemptId,
      p_invoice_id: invoiceId,
      p_state: "paid",
      p_eur_minor: 2150,
      p_currency: "EUR",
    }));
    expect(mocks.paidEffects).toHaveBeenCalledTimes(1);
    expect(mocks.rpc.mock.calls.filter(([name]) => name === "rpc_complete_swiss_bitcoin_effects")).toHaveLength(2);
  });

  it("requires a matching amount before admin recovery can attach an unknown invoice", async () => {
    const [lookup] = queries(unknownAttempt);
    mocks.fetchInvoice.mockResolvedValue({ ...paidInvoice, input: { amount: 1, unit: "EUR" } });
    expect(await recoverSwissBitcoinInvoice(orderId, invoiceId)).toBe(false);
    expect(lookup.eq).toHaveBeenCalledWith("order_id", orderId);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("uses the official share URL for a recovered unpaid invoice", async () => {
    queries(null, unknownAttempt);
    mocks.fetchInvoice.mockResolvedValue({ ...paidInvoice, status: "open" });
    await receiveSwissBitcoinNotification(invoiceId);
    expect(mocks.rpc).toHaveBeenCalledWith("rpc_attach_swiss_bitcoin_invoice", {
      p_attempt_id: attemptId,
      p_invoice_id: invoiceId,
      p_checkout_url: `https://app.swiss-bitcoin-pay.ch/invoice/${invoiceId}`,
    });
  });

  it("restores a missing checkout URL only after verifying the open invoice", async () => {
    queries({ ...activeAttempt, checkout_url: null });
    mocks.fetchInvoice.mockResolvedValue({ ...paidInvoice, status: "open" });
    await receiveSwissBitcoinNotification(invoiceId);
    expect(mocks.rpc).toHaveBeenCalledWith("rpc_attach_swiss_bitcoin_invoice", {
      p_attempt_id: attemptId,
      p_invoice_id: invoiceId,
      p_checkout_url: `https://app.swiss-bitcoin-pay.ch/invoice/${invoiceId}`,
    });
  });

  it("keeps both replacement actions disabled when a stored active checkout URL fails validation", async () => {
    queries([{ ...activeAttempt, checkout_url: "https://lookalike.example.test/" }]);
    const status = await getSwissBitcoinPaymentStatus(pendingOrder, false);
    expect(status).toMatchObject({ state: "confirming", canRetry: false, canPayByCard: false });
    expect(status?.checkoutUrl).toBeUndefined();
  });

  it("backs off provider outages and still tries to archive idle orders in the cron batch", async () => {
    const [lookup] = queries([activeAttempt]);
    mocks.fetchInvoice.mockRejectedValue(new Error("Provider unavailable"));
    mocks.rpc.mockResolvedValueOnce({ data: true }).mockResolvedValueOnce({ data: 3 });
    expect(await reconcileSwissBitcoinPayments()).toEqual({ checked: 1, failed: 1, archived: 3 });
    expect(lookup.limit).toHaveBeenCalledWith(16);
    expect(mocks.rpc).toHaveBeenCalledWith("rpc_defer_swiss_bitcoin_check", { p_attempt_id: attemptId });
    expect(mocks.rpc).toHaveBeenCalledWith("rpc_archive_idle_swiss_bitcoin_orders", { p_limit: 25 });
  });
});
