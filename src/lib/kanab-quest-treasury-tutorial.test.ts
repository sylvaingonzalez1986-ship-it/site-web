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
