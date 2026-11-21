import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSwissBitcoinSupportInvoice: vi.fn(), fetchSwissBitcoinInvoice: vi.fn(), isSwissBitcoinSupportEnabled: vi.fn(),
  beginSupportCheckout: vi.fn(), claimSupportSwissChecks: vi.fn(), findSupportBySwissInvoice: vi.fn(), findSupportForReconciliation: vi.fn(),
  getOwnedSupport: vi.fn(), observeSupportSwissInvoice: vi.fn(), setSupportSwissCheckout: vi.fn(), supportStatus: vi.fn(),
}));

vi.mock("@/lib/swiss-bitcoin-pay", async (original) => ({ ...await original<typeof import("./swiss-bitcoin-pay")>(), ...mocks }));
vi.mock("@/lib/support-backend", () => mocks);

import { receiveSwissBitcoinSupportNotification, reconcileSwissBitcoinSupport, refreshOwnedSwissBitcoinSupport, startSwissBitcoinSupport } from "./support-swiss-bitcoin-pay";
import type { SupportRecord } from "./support-backend";

const id = "11111111-1111-4111-8111-111111111111";
const invoiceId = "22222222-2222-4222-8222-222222222222";
const attempt = { id, token: "a".repeat(64), pseudonym: "Breton", amountCents: 1000, publishName: true, publishAmount: false };
const record: SupportRecord = {
  id, provider: "swiss-bitcoin-pay", invoice_id: invoiceId, pseudonym: "Breton", amount_cents: 1000, publish_name: true, publish_amount: false,
  source_code: "producer-support", order_code: null, transaction_id: null, paid_at: null, checkout_state: "ready", expires_at: "2026-11-21T12:10:00Z", review_required: false,
};
const paidInvoice = {
  id: invoiceId, extra: { reference: id, purpose: "producer-support" }, input: { unit: "EUR", amount: 10 }, status: "paid",
  createdAt: Date.parse("2026-11-21T12:00:00Z"), delay: 10, paidAt: Date.parse("2026-11-21T12:01:00Z"), paymentMethod: "lightning",
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.isSwissBitcoinSupportEnabled.mockReturnValue(true);
  mocks.createSwissBitcoinSupportInvoice.mockResolvedValue({ invoiceId });
  mocks.beginSupportCheckout.mockResolvedValue({ created: true });
  mocks.setSupportSwissCheckout.mockResolvedValue(undefined);
  mocks.getOwnedSupport.mockResolvedValue(record);
  mocks.findSupportBySwissInvoice.mockResolvedValue(record);
  mocks.fetchSwissBitcoinInvoice.mockResolvedValue(paidInvoice);
});

describe("Lightning support checkout and reconciliation", () => {
  it("persists checkout before contacting the provider and does not repeat an ambiguous create", async () => {
    mocks.createSwissBitcoinSupportInvoice.mockRejectedValueOnce(new Error("timeout"));
    await expect(startSwissBitcoinSupport(attempt)).rejects.toThrow("référence est conservée");
    expect(mocks.beginSupportCheckout).toHaveBeenCalledWith({ ...attempt, provider: "swiss-bitcoin-pay" }, "producer-support");
    expect(mocks.beginSupportCheckout.mock.invocationCallOrder[0]).toBeLessThan(mocks.createSwissBitcoinSupportInvoice.mock.invocationCallOrder[0]);
    expect(mocks.setSupportSwissCheckout).toHaveBeenCalledWith(id, null);
    mocks.beginSupportCheckout.mockResolvedValueOnce({ created: false });
    await startSwissBitcoinSupport(attempt);
    expect(mocks.createSwissBitcoinSupportInvoice).toHaveBeenCalledTimes(1);
  });

  it("binds a successful create once even when the first write fails", async () => {
    mocks.setSupportSwissCheckout.mockRejectedValueOnce(new Error("write failed"));
    await startSwissBitcoinSupport(attempt);
    expect(mocks.setSupportSwissCheckout).toHaveBeenCalledTimes(2);
    expect(mocks.setSupportSwissCheckout).toHaveBeenLastCalledWith(id, invoiceId);
    expect(mocks.createSwissBitcoinSupportInvoice).toHaveBeenCalledTimes(1);
  });

  it("recovers a late binding from provider data and ignores invoices outside this purpose", async () => {
    mocks.findSupportBySwissInvoice.mockResolvedValue(null);
    mocks.findSupportForReconciliation.mockResolvedValue({ ...record, invoice_id: null });
    mocks.fetchSwissBitcoinInvoice.mockResolvedValueOnce({ ...paidInvoice, extra: { reference: id } });
    await receiveSwissBitcoinSupportNotification(invoiceId);
    expect(mocks.observeSupportSwissInvoice).not.toHaveBeenCalled();
    await receiveSwissBitcoinSupportNotification(invoiceId);
    expect(mocks.findSupportForReconciliation).toHaveBeenCalledWith(id);
    expect(mocks.observeSupportSwissInvoice).toHaveBeenCalledWith(id, invoiceId, expect.objectContaining({ state: "paid", eurMinor: 1000, currency: "EUR" }));
  });

  it("never confirms a currency, amount, reference or network mismatch from the provider", async () => {
    for (const changed of [
      { input: { unit: "USD", amount: 10 } }, { input: { unit: "EUR", amount: 9.99 } },
      { extra: { reference: invoiceId, purpose: "producer-support" } }, { paymentMethod: "onchain" }, { paymentMethod: undefined },
    ]) {
      mocks.fetchSwissBitcoinInvoice.mockResolvedValueOnce({ ...paidInvoice, ...changed });
      await receiveSwissBitcoinSupportNotification(invoiceId);
    }
    expect(mocks.observeSupportSwissInvoice).toHaveBeenCalledTimes(5);
    expect(mocks.observeSupportSwissInvoice.mock.calls.every(([, , result]) => result.state === "review")).toBe(true);
  });

  it("refreshes a known invoice via the private return or the cron with no notification", async () => {
    await refreshOwnedSwissBitcoinSupport(record, attempt.token);
    expect(mocks.getOwnedSupport).toHaveBeenCalledWith(id, attempt.token);
    mocks.claimSupportSwissChecks.mockResolvedValue([{ id, invoice_id: invoiceId, amount_cents: 1000 }]);
    await expect(reconcileSwissBitcoinSupport()).resolves.toEqual({ checked: 1, failed: 0 });
    expect(mocks.fetchSwissBitcoinInvoice).toHaveBeenCalledTimes(2);
    expect(mocks.observeSupportSwissInvoice).toHaveBeenLastCalledWith(id, invoiceId, expect.objectContaining({ state: "paid" }));
  });
});
