import { afterEach, describe, expect, it, vi } from "vitest";
import { createKqTreasuryTutorial } from "./kanab-quest-treasury-tutorial";
import { isKqBankSnapshot } from "./kanab-quest-bank";
import { isKqCryptoOrder, isKqCryptoSnapshot, isKqCryptoTrade } from "./kanab-quest-crypto";
import { isKqStockOrder, isKqStockSnapshot, isKqStockTrade } from "./kanab-quest-stocks";
import { getKqTreasuryReport, isKqTreasurySnapshot } from "./kanab-quest-treasury";

const now = Date.parse("2026-10-07T15:00:00Z");
let serial = 0;
const key = () => `72000000-0000-4000-8000-${(++serial).toString(16).padStart(12, "0")}`;
const create = () => createKqTreasuryTutorial({ now: () => now });
const get = async (sandbox: ReturnType<typeof create>, path: string) => (await sandbox.request(path)).json();
const post = async (sandbox: ReturnType<typeof create>, path: string, body: object) => {
  const response = await sandbox.request(path, { method: "POST", body: JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
};
afterEach(() => vi.unstubAllGlobals());

describe("isolated real-screen Bureau tutorial transport", () => {
  it("pays the issued lab and energy bills together and replays without another debit", async () => {
    const sandbox = create();
    const before = sandbox.snapshot();
    expect(before.business.suppliers).toEqual({ outstandingCents: 0, overdueCents: 0, invoices: [] });
    const action = { action: "pay-all-invoices", expectedCents: 4914, requestKey: key() };
    const paid = await post(sandbox, "/api/arena/placard/commerce", action);
    expect(paid.status).toBe(200);
    expect(paid.body).toEqual({ action: "pay-all-invoices", paidCents: 4914, labPaidCents: 4500, supplierPaidCents: 0,
      electricityPaidCents: 414, storageClimatePaidCents: 0, invoiceCount: 2, cashAfterCents: 495086, replayed: false });
    const saved = sandbox.snapshot();
    expect(saved.business.lab.outstandingCents).toBe(0);
    expect(saved.energyDue).toBe(0);
    expect(saved.business.vat).toEqual(before.business.vat);
    expect(saved.business.shop).toEqual(before.business.shop);
    expect(saved.actions).toContain("lab-paid");
    expect((await post(sandbox, "/api/arena/placard/commerce", action)).body).toEqual({ ...paid.body, replayed: true });
    expect((await post(sandbox, "/api/arena/placard/commerce", { ...action, expectedCents: 4913 })).status).toBe(400);
    expect(sandbox.snapshot()).toEqual(saved);
    const report = getKqTreasuryReport(await get(sandbox, "/api/arena/placard/treasury"));
    expect(report.reconciled).toBe(true); expect(report.balanceSheet.differenceCents).toBe(0);
  });

  it("does not partly pay when the global amount changed or exceeds the fictitious wallet", async () => {
    for (const [cash, expectedCents] of [[500000, 4913], [4913, 4914], [500000, 2_147_483_648], [500000, -1], [500000, 4914.5]]) {
      const sandbox = createKqTreasuryTutorial({ now: () => now, initialCashCents: cash });
      const before = sandbox.snapshot();
      expect((await post(sandbox, "/api/arena/placard/commerce", { action: "pay-all-invoices", expectedCents, requestKey: key() })).status).toBe(400);
      expect(sandbox.snapshot()).toEqual(before);
    }
  });

  it("rejects reusing an individual invoice payment key for a global payment", async () => {
    const sandbox = create(), requestKey = key();
    const invoiceId = sandbox.snapshot().business.lab.invoices[0].id;
    expect((await post(sandbox, "/api/arena/placard/commerce", { action: "pay-lab", invoiceId, requestKey })).status).toBe(200);
    const before = sandbox.snapshot();
    expect((await post(sandbox, "/api/arena/placard/commerce", { action: "pay-all-invoices", expectedCents: 414, requestKey })).status).toBe(400);
    expect(sandbox.snapshot()).toEqual(before);
  });

  it("returns snapshots accepted by all live screen validators", async () => {
    const sandbox = create();
    expect(isKqBankSnapshot(await get(sandbox, "/api/arena/placard/bank"))).toBe(true);
    expect(isKqCryptoSnapshot(await get(sandbox, "/api/arena/placard/crypto"))).toBe(true);
    expect(isKqStockSnapshot(await get(sandbox, "/api/arena/placard/stocks?ids=%5EFCHI,AAPL"))).toBe(true);
    const treasury = await get(sandbox, "/api/arena/placard/treasury");
    expect(isKqTreasurySnapshot(treasury)).toBe(true);
    expect(getKqTreasuryReport(treasury).reconciled).toBe(true);
    expect(getKqTreasuryReport(treasury).balanceSheet.differenceCents).toBe(0);
  });

  it("rejects unknown and remote URLs without ever calling fetch", async () => {
    const fetch = vi.fn(() => { throw new Error("Unexpected network"); });
    vi.stubGlobal("fetch", fetch);
    const sandbox = create();
    for (const path of ["/api/arena/placard/runs", "https://example.com/api/arena/placard/bank", "/api/admin/placard/bank"]) {
      expect((await sandbox.request(path, { method: "POST", body: "{}" })).status).toBe(404);
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it("honors cancellation before any mutation", async () => {
    const sandbox = create();
    const controller = new AbortController(); controller.abort();
    await expect(sandbox.request("/api/arena/placard/commerce", { method: "POST", body: JSON.stringify({ action: "create-shop", name: "Essai annulé" }), signal: controller.signal })).rejects.toThrow();
    expect((await get(sandbox, "/api/arena/placard/commerce")).business.shop.createdAt).toBeNull();
  });

  it("signs a real-rule repayment schedule once and allows full repayment", async () => {
    const sandbox = create();
    const before = await get(sandbox, "/api/arena/placard/bank");
    const body = { action: "borrow", requestKey: key(), quoteId: before.offer.quoteId, amountCents: 100000, expectedRateBps: before.offer.rateBps };
    const signed = await post(sandbox, "/api/arena/placard/bank", body);
    expect(signed.status).toBe(200); expect(isKqBankSnapshot(signed.body)).toBe(true);
    expect(signed.body.cashCents).toBe(before.cashCents + 100000);
    expect((await post(sandbox, "/api/arena/placard/bank", body)).body).toEqual(signed.body);
    const paid = await post(sandbox, "/api/arena/placard/bank", { action: "repay", requestKey: key(), loanId: signed.body.loan.id, amountCents: signed.body.loan.remainingCents });
    expect(paid.status).toBe(200); expect(isKqBankSnapshot(paid.body)).toBe(true);
    expect(paid.body.loan).toBeNull(); expect(paid.body.history).toHaveLength(1);
    const treasury = await get(sandbox, "/api/arena/placard/treasury");
    expect(getKqTreasuryReport(treasury).balanceSheet.differenceCents).toBe(0);
  });

  it("tracks completed bank objectives only after actual local mutations", async () => {
    const sandbox = create();
    expect(sandbox.progress("bank").complete).toBe(false);
    const bank = await get(sandbox, "/api/arena/placard/bank");
    await post(sandbox, "/api/arena/placard/bank", { action: "borrow", requestKey: key(), quoteId: bank.offer.quoteId, amountCents: 100000, expectedRateBps: bank.offer.rateBps });
    await post(sandbox, "/api/arena/chanvrier/savings", { action: "deposit", amountCents: 10000, requestKey: key() });
    expect(sandbox.progress("bank").complete).toBe(false);
    await post(sandbox, "/api/arena/chanvrier/savings", { action: "withdraw", amountCents: 5000, requestKey: key() });
    expect(sandbox.progress("bank").complete).toBe(true);
    expect((await get(sandbox, "/api/arena/chanvrier/savings")).balanceCents).toBe(5000);
  });

  it.each(["stocks", "crypto"] as const)("previews then confirms and sells %s without duplicate debits", async market => {
    const sandbox = create(); const path = `/api/arena/placard/${market}`;
    const assetId = market === "stocks" ? "AAPL" : 1;
    const order = await post(sandbox, path, { action: "preview", side: "buy", assetId, amountCents: 10000 });
    expect((market === "stocks" ? isKqStockOrder : isKqCryptoOrder)(order.body)).toBe(true);
    expect((await get(sandbox, path)).cashCents).toBe(500000);
    const buy = await post(sandbox, path, { action: "confirm", orderId: order.body.orderId });
    expect((market === "stocks" ? isKqStockTrade : isKqCryptoTrade)(buy.body.trade)).toBe(true);
    expect(buy.body.trade.cashAfterCents).toBe(490000);
    expect((await post(sandbox, path, { action: "confirm", orderId: order.body.orderId })).body).toEqual(buy.body);
    const sellOrder = await post(sandbox, path, { action: "preview", side: "sell", assetId, quantity: "1" });
    const sold = await post(sandbox, path, { action: "confirm", orderId: sellOrder.body.orderId });
    expect(sold.body.trade.cashAfterCents).toBe(500000);
    expect((await get(sandbox, path)).positions).toHaveLength(0);
    expect(getKqTreasuryReport(await get(sandbox, "/api/arena/placard/treasury")).reconciled).toBe(true);
  });

  it("rejects an overdraw and an excessive sale without changing balances", async () => {
    const sandbox = create();
    expect((await post(sandbox, "/api/arena/chanvrier/savings", { action: "withdraw", amountCents: 10, requestKey: key() })).status).toBe(400);
    expect((await post(sandbox, "/api/arena/placard/stocks", { action: "preview", side: "buy", assetId: "AAPL", amountCents: 600000 })).status).toBe(400);
    expect((await post(sandbox, "/api/arena/placard/crypto", { action: "preview", side: "sell", assetId: 1, quantity: "1" })).status).toBe(400);
    expect((await get(sandbox, "/api/arena/placard/bank")).cashCents).toBe(500000);
  });

  it("creates the site, advertises and pays the invoice with coherent accounting", async () => {
    const sandbox = create();
    expect((await post(sandbox, "/api/arena/placard/commerce", { action: "advertise", kind: "flyers" })).status).toBe(400);
    expect(sandbox.progress("business").complete).toBe(false);
    await post(sandbox, "/api/arena/placard/commerce", { action: "create-shop", name: "Le shop école", requestKey: key() });
    await post(sandbox, "/api/arena/placard/commerce", { action: "advertise", kind: "flyers", requestKey: key() });
    const before = await get(sandbox, "/api/arena/placard/commerce");
    expect(before.cashCents).toBe(394000);
    await post(sandbox, "/api/arena/placard/commerce", { action: "pay-lab", invoiceId: before.business.lab.invoices[0].id, requestKey: key() });
    expect(sandbox.progress("business").complete).toBe(true);
    const treasury = await get(sandbox, "/api/arena/placard/treasury");
    expect(isKqTreasurySnapshot(treasury)).toBe(true);
    expect(getKqTreasuryReport(treasury).reconciled).toBe(true);
    expect(getKqTreasuryReport(treasury).balanceSheet.differenceCents).toBe(0);
    expect(treasury.journal.items).toHaveLength(3);
  });

  it.each(["home", "external"])("rejects a new %s address command without debiting the local budget", async mode => {
    const sandbox = create();
    const before = sandbox.snapshot();
    const result = await post(sandbox, "/api/arena/placard/commerce", { action: "domiciliation", mode, requestKey: key() });
    expect(result.status).toBe(400);
    expect(result.body.error).toContain("retirée");
    expect(sandbox.snapshot()).toEqual(before);
    expect(before.business.domiciliation).toMatchObject({ retired: true, active: false, renew: false });
  });

  it("retires a restored local contract without rewriting prepaid periods, accounting or old receipts", async () => {
    let time = now;
    const saved = create().snapshot();
    const paidUntil = new Date(now + 432_000_000).toISOString();
    saved.business.domiciliation = { mode: "external", paidUntil, active: true, renew: true };
    saved.business.ledger.push({ id: key(), kind: "domiciliation", amountCents: 5000, occurredAt: new Date(now).toISOString() });
    saved.balances.cash = 495000;
    saved.balances.expense_domiciliation = 5000;
    saved.journal.push({ id: key(), occurredAt: new Date(now).toISOString(), kind: "domicile-paid", reference: "Didacticiel · opération fictive", postings: [{ account: "cash", deltaCents: -5000 }, { account: "expense_domiciliation", deltaCents: 5000 }] });
    const oldKey = key();
    const oldReceipt = { business: structuredClone(saved.business), cashCents: 495000 };
    saved.replayed.push([`/api/arena/placard/commerce:${oldKey}`, JSON.stringify(oldReceipt)]);
    const original = structuredClone(saved);
    const sandbox = createKqTreasuryTutorial({ now: () => time, state: saved });
    time += 3 * 432_000_000;
    const current = await get(sandbox, "/api/arena/placard/commerce");
    expect(current.business.domiciliation).toEqual({ mode: "external", paidUntil, active: false, renew: false, retired: true });
    expect(current.cashCents).toBe(495000);
    const replay = await post(sandbox, "/api/arena/placard/commerce", { action: "domiciliation", mode: "external", requestKey: oldKey });
    expect(replay.body).toEqual(oldReceipt);
    expect(sandbox.snapshot().journal).toEqual(original.journal);
    expect(sandbox.snapshot().business.ledger).toEqual(original.business.ledger);
    expect(sandbox.snapshot().replayed).toEqual(original.replayed);
    expect(saved).toEqual(original);
  });

  it("keeps independent lesson budgets and rejects an expired order", async () => {
    let time = now;
    const first = createKqTreasuryTutorial({ now: () => time }); const second = create();
    await post(first, "/api/arena/chanvrier/savings", { action: "deposit", amountCents: 10000, requestKey: key() });
    expect((await get(second, "/api/arena/chanvrier/savings")).balanceCents).toBe(0);
    const order = await post(first, "/api/arena/placard/stocks", { action: "preview", side: "buy", assetId: "AAPL", amountCents: 10000 });
    time += 61000;
    expect((await post(first, "/api/arena/placard/stocks", { action: "confirm", orderId: order.body.orderId })).status).toBe(400);
    expect((await get(first, "/api/arena/placard/stocks")).cashCents).toBe(490000);
  });
});
