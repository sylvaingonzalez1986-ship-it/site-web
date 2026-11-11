import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ applySupportTransaction: vi.fn(), beginSupportCheckout: vi.fn(), findSupportByOrder: vi.fn(), getOwnedSupport: vi.fn(),
  getSupportVivaConfig: vi.fn(), setSupportCheckoutState: vi.fn(), supportStatus: vi.fn(), cancelVivaPaymentOrder: vi.fn(), createVivaCheckoutOrder: vi.fn(), getVivaAccessToken: vi.fn(), retrieveVivaTransaction: vi.fn() }));
vi.mock("./support-backend", () => mocks);
vi.mock("./viva-payment", () => mocks);
import { cancelOwnedSupport, handleSupportWebhook, reconcileAdminSupport, refreshOwnedSupport, startSupportPayment, verifySupportTransaction } from "./support-viva";
const id = "11111111-1111-4111-8111-111111111111", tx = "22222222-2222-4222-8222-222222222222", reversalId = "33333333-3333-4333-8333-333333333333";
const attempt = { id, token: "a".repeat(64), pseudonym: "Pseudo public", amountCents: 1000, publishName: true, publishAmount: false };
const config = { isConfigured: true, sourceCode: "4321" };
const row = { id, pseudonym: attempt.pseudonym, amount_cents: 1000, publish_name: true, publish_amount: false, source_code: "4321", order_code: "123456789012345678", transaction_id: null, paid_at: null, checkout_state: "ready" as const, expires_at: "2026-11-12T00:00:00Z", review_required: false };
const transaction = { orderCode: row.order_code, transactionId: tx, sourceCode: "4321", amountInMinorUnits: 1000, currencyCode: "978", statusId: "F", parentTransactionId: null };
beforeEach(() => {
  vi.resetAllMocks(); mocks.getSupportVivaConfig.mockReturnValue(config); mocks.getVivaAccessToken.mockResolvedValue("token");
  mocks.beginSupportCheckout.mockResolvedValue({ created: true, contribution: row }); mocks.getOwnedSupport.mockResolvedValue(row);
  mocks.createVivaCheckoutOrder.mockResolvedValue(row.order_code); mocks.supportStatus.mockReturnValue({ state: "ready" });
  mocks.retrieveVivaTransaction.mockResolvedValue(transaction); mocks.findSupportByOrder.mockResolvedValue(row);
});
describe("support payment isolation and recovery", () => {
  it("sends an exact euro amount and stable support reference without substituting the pseudonym for legal identity", async () => {
    await startSupportPayment(attempt);
    expect(mocks.createVivaCheckoutOrder).toHaveBeenCalledWith(expect.objectContaining({ amount: 10, merchantTrns: `SOUTIEN:${id}`, tags: ["SOUTIEN", "KANAB-QUEST"], exactEuroAmount: true }));
    expect(mocks.createVivaCheckoutOrder.mock.calls[0][0]).not.toHaveProperty("customerName");
    expect(mocks.beginSupportCheckout.mock.invocationCallOrder[0]).toBeLessThan(mocks.createVivaCheckoutOrder.mock.invocationCallOrder[0]);
    expect(mocks.setSupportCheckoutState).toHaveBeenCalledWith(id, "ready", row.order_code);
  });
  it("resumes a stored attempt without creating another Viva order", async () => {
    mocks.beginSupportCheckout.mockResolvedValue({ created: false, contribution: row });
    await startSupportPayment(attempt); expect(mocks.createVivaCheckoutOrder).not.toHaveBeenCalled();
  });
  it("allows retry after authentication fails before provider creation", async () => {
    mocks.getVivaAccessToken.mockRejectedValueOnce(new Error("offline"));
    await expect(startSupportPayment(attempt)).rejects.toThrow("même fiche");
    expect(mocks.beginSupportCheckout).not.toHaveBeenCalled(); expect(mocks.setSupportCheckoutState).not.toHaveBeenCalled();
    await startSupportPayment(attempt); expect(mocks.createVivaCheckoutOrder).toHaveBeenCalledTimes(1);
  });
  it("preserves an ambiguous create outcome without submitting a second order", async () => {
    mocks.createVivaCheckoutOrder.mockRejectedValue(new Error("timeout"));
    await expect(startSupportPayment(attempt)).rejects.toThrow("conservée");
    expect(mocks.setSupportCheckoutState).toHaveBeenCalledWith(id, "uncertain");
    mocks.beginSupportCheckout.mockResolvedValue({ created: false, contribution: { ...row, checkout_state: "uncertain" } });
    await startSupportPayment(attempt); expect(mocks.createVivaCheckoutOrder).toHaveBeenCalledTimes(1);
  });
  it("retries local binding only after successful remote creation", async () => {
    mocks.setSupportCheckoutState.mockRejectedValueOnce(new Error("db"));
    await startSupportPayment(attempt); expect(mocks.createVivaCheckoutOrder).toHaveBeenCalledTimes(1); expect(mocks.setSupportCheckoutState).toHaveBeenCalledTimes(2);
  });
  it("requires the private owner token before considering a browser transaction hint", async () => {
    mocks.getOwnedSupport.mockRejectedValue(new Error("not owned"));
    await expect(refreshOwnedSupport(id, attempt.token, tx)).rejects.toThrow("not owned");
    expect(mocks.retrieveVivaTransaction).not.toHaveBeenCalled();
  });
  it("rejects an inconsistent provider transaction identifier", async () => {
    mocks.retrieveVivaTransaction.mockResolvedValue({ ...transaction, transactionId: reversalId });
    await expect(verifySupportTransaction(row, tx)).rejects.toThrow("incohérente"); expect(mocks.applySupportTransaction).not.toHaveBeenCalled();
  });
  it("independently verifies refund and original payment even when the refund uses Default source", async () => {
    const reversed = { ...transaction, transactionId: reversalId, sourceCode: "Default", amountInMinorUnits: -300, parentTransactionId: null };
    mocks.retrieveVivaTransaction.mockResolvedValueOnce(reversed).mockResolvedValueOnce(transaction);
    await verifySupportTransaction(row, reversalId, tx);
    expect(mocks.retrieveVivaTransaction).toHaveBeenCalledTimes(2);
    expect(mocks.applySupportTransaction).toHaveBeenNthCalledWith(1, row, { ...reversed, parentTransactionId: tx }, transaction);
    expect(mocks.applySupportTransaction).toHaveBeenLastCalledWith(row, transaction);
  });
  it("rejects a forged refund parent belonging to another order or source", async () => {
    for (const change of [{ orderCode: "999" }, { sourceCode: "shop" }, { amountInMinorUnits: 999 }, { currencyCode: "USD" }]) {
      mocks.retrieveVivaTransaction.mockResolvedValueOnce({ ...transaction, transactionId: reversalId, amountInMinorUnits: -300 }).mockResolvedValueOnce({ ...transaction, ...change });
      await expect(verifySupportTransaction(row, reversalId, tx)).rejects.toThrow("origine");
    }
    expect(mocks.applySupportTransaction).not.toHaveBeenCalled();
  });
  it("keeps an early callback retryable and ignores another source with no known contribution", async () => {
    mocks.findSupportByOrder.mockResolvedValue(null);
    await expect(handleSupportWebhook("123", tx, "4321")).rejects.toMatchObject({ status: 503 });
    await handleSupportWebhook("123", tx, "shop"); expect(mocks.retrieveVivaTransaction).not.toHaveBeenCalled();
  });
  it("does not cancel captured payments or acknowledge failed provider cancellation", async () => {
    mocks.getOwnedSupport.mockResolvedValueOnce({ ...row, paid_at: "2026-11-11" });
    await expect(cancelOwnedSupport(id, attempt.token)).rejects.toThrow("déjà payé"); expect(mocks.cancelVivaPaymentOrder).not.toHaveBeenCalled();
    mocks.cancelVivaPaymentOrder.mockRejectedValue(new Error("provider"));
    await expect(cancelOwnedSupport(id, attempt.token)).rejects.toThrow("n’a pas confirmé"); expect(mocks.setSupportCheckoutState).not.toHaveBeenCalled();
  });
  it("recovers a missing local binding only from a verified matching merchant reference", async () => {
    mocks.retrieveVivaTransaction.mockResolvedValueOnce({ ...transaction, merchantTrns: "wrong" });
    await expect(reconcileAdminSupport({ ...row, order_code: null }, tx)).rejects.toThrow("référence de soutien");
    expect(mocks.setSupportCheckoutState).not.toHaveBeenCalled();
    mocks.retrieveVivaTransaction.mockResolvedValueOnce({ ...transaction, merchantTrns: `SOUTIEN:${id}` });
    await reconcileAdminSupport({ ...row, order_code: null }, tx);
    expect(mocks.setSupportCheckoutState).toHaveBeenCalledWith(id, "ready", row.order_code);
  });
});
