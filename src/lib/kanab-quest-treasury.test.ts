import { describe, expect, it } from "vitest";
import { getKqTreasuryReport, isKqTreasurySnapshot, type KqTreasuryAccount, type KqTreasuryBalances,
  type KqTreasuryEntry, type KqTreasurySnapshot } from "./kanab-quest-treasury";

const from = "2026-09-21T00:00:00.000Z", to = "2026-09-26T00:00:00.000Z";
const opening: KqTreasuryBalances = { cash: 35000, opening_equity: -35000 };
function entry(id: string, amounts: KqTreasuryBalances): KqTreasuryEntry {
  const postings = Object.entries(amounts).map(([account, deltaCents]) => ({ account: account as KqTreasuryAccount, deltaCents: deltaCents! }));
  expect(postings.reduce((sum, posting) => sum + posting.deltaCents, 0), `balanced fixture ${id}`).toBe(0);
  return { id, kind: id, reference: `fixture:${id}`, occurredAt: "2026-09-23T12:00:00.000Z", postings };
}
function snapshot(entries: KqTreasuryEntry[] = [], initial = opening): KqTreasurySnapshot {
  const closing: KqTreasuryBalances = { ...initial };
  let inflows = 0, outflows = 0;
  for (const item of entries) for (const posting of item.postings) {
    closing[posting.account] = (closing[posting.account] ?? 0) + posting.deltaCents;
    if (posting.account === "cash") {
      inflows += Math.max(0, posting.deltaCents);
      outflows += Math.max(0, -posting.deltaCents);
    }
  }
  return {
    version: 1, serverNow: to, startedAt: from, businessStartedAt: from,
    period: { key: "current", from, to }, openingBalances: { ...initial }, closingBalances: closing,
    series: [{ from, to, cashOpeningCents: initial.cash ?? 0, cashClosingCents: closing.cash ?? 0,
      inflowsCents: inflows, outflowsCents: outflows, revenueCents: 0, expenseCents: 0 }],
    journal: { items: entries, total: entries.length, offset: 0, limit: 25 },
    checks: { walletCashCents: closing.cash ?? 0, vatReserveCents: closing.vat_reserve ?? 0, savingsCents: closing.savings ?? 0,
      labDebtCents: -(closing.lab_payable ?? 0), energyDebtCents: -(closing.energy_payable ?? 0), vatDebtCents: -(closing.vat_payable ?? 0),
      loanDebtCents: -(closing.loan_payable ?? 0), cryptoCostCents: closing.crypto_assets ?? 0, securitiesCostCents: closing.securities_assets ?? 0 },
  };
}
function report(entries: KqTreasuryEntry[], initial = opening) {
  const data = snapshot(entries, initial);
  expect(isKqTreasurySnapshot(data)).toBe(true);
  const result = getKqTreasuryReport(data);
  expect(result.balanceSheet.differenceCents).toBe(0);
  expect(result.reconciled).toBe(true);
  return result;
}

describe("treasury accrual accounting", () => {
  it.each(["revenue_online", "revenue_shop", "revenue_wholesale"] as const)("separates a 120 EUR TTC sale from its VAT liability in %s", account => {
    const sale = entry("sale", { cash: 10000, vat_reserve: 2000, vat_payable: -2000, [account]: -10000 });
    const result = report([sale]);
    expect(result.income).toMatchObject({ salesHtCents: 10000, revenueCents: 10000, expenseCents: 0, resultCents: 10000 });
    expect(result.cash).toMatchObject({ availableCents: 45000, reservedVatCents: 2000, inflowsCents: 10000 });
    expect(result.balanceSheet).toMatchObject({ assetsCents: 47000, debtCents: 2000, equityCents: 45000, liabilitiesCents: 47000 });
    const remitted = report([sale, entry("vat-paid", { vat_reserve: -2000, vat_payable: 2000 })]);
    expect(remitted.income.resultCents).toBe(10000);
    expect(remitted.cash.availableCents).toBe(45000);
    expect(remitted.cash.reservedVatCents).toBe(0);
    expect(remitted.balanceSheet.debtCents).toBe(0);
  });

  it("recognizes the 45 EUR laboratory charge before payment and never expenses its payment again", () => {
    const invoice = entry("lab-issued", { expense_lab: 4500, lab_payable: -4500 });
    const billed = report([invoice]);
    expect(billed.income).toMatchObject({ expenseCents: 4500, resultCents: -4500 });
    expect(billed.cash).toMatchObject({ availableCents: 35000, changeCents: 0, unpaidCents: 4500, afterDebtCents: 30500 });
    const paid = report([invoice, entry("lab-paid", { cash: -4500, lab_payable: 4500 })]);
    expect(paid.income).toMatchObject({ expenseCents: 4500, resultCents: -4500 });
    expect(paid.cash).toMatchObject({ availableCents: 30500, unpaidCents: 0, outflowsCents: 4500 });
  });

  it("keeps sale profit distinct from cash after paying a prior-period invoice", () => {
    const prior = snapshot([entry("lab-issued", { expense_lab: 4500, lab_payable: -4500 })]).closingBalances;
    const result = report([
      entry("sale", { cash: 10000, vat_reserve: 2000, vat_payable: -2000, revenue_shop: -10000 }),
      entry("lab-paid", { cash: -4500, lab_payable: 4500 }),
    ], prior);
    expect(result.income.resultCents).toBe(10000);
    expect(result.cash.changeCents).toBe(5500);
    expect(result.balanceSheet.equity.find(line => line.account === "retained_result")?.cents).toBe(-4500);
  });

  it("capitalizes equipment and website purchases and recognizes depreciation without cash spending", () => {
    const initial = { cash: 200000, opening_equity: -200000 };
    const purchases = [entry("equipment-purchase", { equipment: 45000, cash: -45000 }),
      entry("shop-created", { website: 100000, cash: -100000 })];
    const purchased = report(purchases, initial);
    expect(purchased.income.resultCents).toBe(0);
    expect(purchased.cash).toMatchObject({ availableCents: 55000, outflowsCents: 145000 });
    expect(purchased.balanceSheet.assetsCents).toBe(200000);
    const amortized = report([...purchases, entry("depreciation", { expense_depreciation: 1900, equipment: -900, website: -1000 })], initial);
    expect(amortized.income).toMatchObject({ expenseCents: 1900, resultCents: -1900 });
    expect(amortized.cash.availableCents).toBe(55000);
    expect(amortized.balanceSheet.assetsCents).toBe(198100);
  });

  it("releases prepaid charges only as service is consumed", () => {
    const payment = entry("domicile-paid", { prepaid: 5000, cash: -5000 });
    expect(report([payment]).income.resultCents).toBe(0);
    const consumed = report([payment, entry("prepaid-release", { prepaid: -1500, expense_domiciliation: 1500 })]);
    expect(consumed.income.resultCents).toBe(-1500);
    expect(consumed.cash.availableCents).toBe(30000);
    expect(consumed.balanceSheet.assets.find(line => line.account === "prepaid")?.cents).toBe(3500);
  });

  it("carries unsold production costs as stock, then expenses that cost upon sale", () => {
    const production = [entry("lab-issued", { expense_lab: 4500, lab_payable: -4500 }),
      entry("energy-issued", { expense_energy: 603, energy_payable: -603 }),
      entry("stock-valuation", { stock: 5103, stock_variation: -5103 })];
    const unsold = report(production);
    expect(unsold.income).toMatchObject({ revenueCents: 0, expenseCents: 0, resultCents: 0 });
    expect(unsold.balanceSheet.assets.find(line => line.account === "stock")?.cents).toBe(5103);
    expect(unsold.cash.unpaidCents).toBe(5103);
    const sold = report([entry("sale", { cash: 10000, vat_reserve: 2000, vat_payable: -2000, revenue_wholesale: -10000 }),
      entry("stock-valuation", { stock: -5103, stock_variation: 5103 })], snapshot(production).closingBalances);
    expect(sold.income).toMatchObject({ revenueCents: 10000, expenseCents: 5103, resultCents: 4897 });
    expect(sold.balanceSheet.assets.find(line => line.account === "stock")?.cents).toBe(0);
  });

  it("treats savings deposits and withdrawals as transfers while interest is income", () => {
    const deposit = entry("savings", { cash: -10000, savings: 10000 });
    const saved = report([deposit]);
    expect(saved.income).toMatchObject({ revenueCents: 0, resultCents: 0 });
    expect(saved.balanceSheet.assetsCents).toBe(35000);
    const earned = report([deposit, entry("interest", { savings: 500, revenue_interest: -500 }),
      entry("withdrawal", { cash: 3000, savings: -3000 })]);
    expect(earned.income).toMatchObject({ revenueCents: 500, resultCents: 500, operatingResultCents: 0 });
    expect(earned.cash).toMatchObject({ availableCents: 28000, savingsCents: 7500, inflowsCents: 3000, outflowsCents: 10000 });
    expect(earned.balanceSheet.assetsCents).toBe(35500);
  });

  it("keeps loan proceeds out of revenue and does not expense principal repayments", () => {
    const issued = [entry("loan-issued", { cash: 50000, loan_payable: -50000 }),
      entry("loan-interest", { expense_loan_interest: 3500, loan_payable: -3500 })];
    const borrowed = report(issued);
    expect(borrowed.income).toMatchObject({ revenueCents: 0, expenseCents: 3500, resultCents: -3500, operatingResultCents: 0 });
    expect(borrowed.cash).toMatchObject({ availableCents: 85000, loanDebtCents: 53500, unpaidCents: 0 });
    expect(borrowed.balanceSheet.debtCents).toBe(53500);
    const repaid = report([...issued, entry("loan-repayment", { cash: -10000, loan_payable: 10000 })]);
    expect(repaid.cash).toMatchObject({ availableCents: 75000, loanDebtCents: 43500 });
    expect(repaid.income.resultCents).toBe(-3500);
    expect(repaid.sourceDifferences.loan).toBe(0);
  });

  it("carries crypto at acquisition cost and recognizes only realized partial-sale gains and losses", () => {
    const purchase = entry("crypto-buy", { cash: -10000, crypto_assets: 10000 });
    const bought = report([purchase]);
    expect(bought.income.resultCents).toBe(0);
    expect(bought.balanceSheet.assetsCents).toBe(35000);
    expect(bought.cash).toMatchObject({ availableCents: 25000, cryptoCostCents: 10000 });
    const profitableSale = entry("crypto-sell", { cash: 6000, crypto_assets: -4000, revenue_crypto_gains: -2000 });
    const partial = report([purchase, profitableSale]);
    expect(partial.cash).toMatchObject({ availableCents: 31000, cryptoCostCents: 6000 });
    expect(partial.income).toMatchObject({ revenueCents: 2000, resultCents: 2000, salesHtCents: 0, operatingResultCents: 0 });
    const closed = report([purchase, profitableSale, entry("crypto-loss", { cash: 3000, crypto_assets: -6000, expense_crypto_losses: 3000 })]);
    expect(closed.cash).toMatchObject({ availableCents: 34000, cryptoCostCents: 0 });
    expect(closed.income).toMatchObject({ resultCents: -1000, operatingResultCents: 0 });
    expect(closed.sourceDifferences.crypto).toBe(0);
  });

  it("keeps securities separate from crypto and recognizes only realized financial returns", () => {
    const purchase = entry("stock-buy", { cash: -10000, securities_assets: 10000 });
    const crypto = entry("crypto-buy", { cash: -2000, crypto_assets: 2000 });
    const bought = report([purchase, crypto]);
    expect(bought.cash).toMatchObject({ availableCents: 23000, securitiesCostCents: 10000, cryptoCostCents: 2000 });
    expect(bought.income.resultCents).toBe(0);
    const gain = entry("stock-sell", { cash: 6000, securities_assets: -4000, revenue_stock_gains: -2000 });
    const partial = report([purchase, crypto, gain]);
    expect(partial.cash.securitiesCostCents).toBe(6000);
    expect(partial.income).toMatchObject({ resultCents: 2000, salesHtCents: 0, operatingResultCents: 0 });
    const loss = entry("stock-sell", { cash: 3000, securities_assets: -6000, expense_stock_losses: 3000 });
    const closed = report([purchase, crypto, gain, loss]);
    expect(closed.cash).toMatchObject({ securitiesCostCents: 0, cryptoCostCents: 2000 });
    expect(closed.income).toMatchObject({ resultCents: -1000, operatingResultCents: 0 });
    expect(closed.sourceDifferences.securities).toBe(0);
    const divergent = snapshot([purchase]); divergent.checks.securitiesCostCents = 9900;
    expect(getKqTreasuryReport(divergent)).toMatchObject({ reconciled: false, sourceDifferences: { securities: 100 } });
    divergent.checks.securitiesCostCents = -1; expect(isKqTreasurySnapshot(divergent)).toBe(false);
  });

  it("flags loan or crypto ledger differences instead of showing balanced sources", () => {
    const data = snapshot([entry("crypto-buy", { cash: -10000, crypto_assets: 10000 }), entry("loan-issued", { cash: 50000, loan_payable: -50000 })]);
    data.checks.cryptoCostCents = 9900;
    data.checks.loanDebtCents = 49900;
    expect(getKqTreasuryReport(data)).toMatchObject({ reconciled: false, sourceDifferences: { crypto: 100, loan: 100 } });
    data.checks.cryptoCostCents = -1;
    expect(isKqTreasurySnapshot(data)).toBe(false);
  });

  it("separates a starting-capital grant from an earned reward", () => {
    const result = report([entry("capital", { cash: 65000, capital: -65000 }),
      entry("reward", { cash: 1000, revenue_rewards: -1000 })]);
    expect(result.income).toMatchObject({ revenueCents: 1000, resultCents: 1000, salesHtCents: 0 });
    expect(result.cash.changeCents).toBe(66000);
    expect(result.balanceSheet.equity.find(line => line.account === "capital")?.cents).toBe(65000);
  });

  it.each([1200, -700])("keeps an unidentified cash movement %i in suspense rather than invented profit or expense", amount => {
    const result = report([entry("unknown", { cash: amount, suspense: -amount })]);
    expect(result.income).toMatchObject({ revenueCents: 0, expenseCents: 0, resultCents: 0 });
    expect(result.suspenseCents).toBe(-amount);
    const side = amount > 0 ? result.balanceSheet.debts : result.balanceSheet.assets;
    expect(side.find(line => line.account === "suspense")?.cents).toBe(Math.abs(amount));
  });

  it("shows negative equity and available funds after debts without concealing a loss", () => {
    const result = report([entry("energy-issued", { expense_energy: 50000, energy_payable: -50000 })]);
    expect(result.income.resultCents).toBe(-50000);
    expect(result.balanceSheet).toMatchObject({ assetsCents: 35000, debtCents: 50000, equityCents: -15000, liabilitiesCents: 35000 });
    expect(result.cash.afterDebtCents).toBe(-15000);
  });
});

describe("treasury periods and complete aggregates", () => {
  it("carries earlier results into equity without counting them as current-period income", () => {
    const prior = { cash: 50000, opening_equity: -35000, revenue_shop: -15000 };
    const result = report([entry("lab-issued", { expense_lab: 4500, lab_payable: -4500 })], prior);
    expect(result.income).toMatchObject({ revenueCents: 0, expenseCents: 4500, resultCents: -4500 });
    expect(result.balanceSheet.equity).toEqual(expect.arrayContaining([
      expect.objectContaining({ account: "retained_result", cents: 15000 }),
      expect.objectContaining({ account: "period_result", cents: -4500 }),
    ]));
  });

  it("never computes totals from a paginated journal", () => {
    const data = snapshot([entry("lab-issued", { expense_lab: 4500, lab_payable: -4500 }),
      entry("lab-paid", { cash: -4500, lab_payable: 4500 }),
      entry("sale", { cash: 10000, vat_reserve: 2000, vat_payable: -2000, revenue_online: -10000 })]);
    const complete = getKqTreasuryReport(data);
    for (const offset of [0, 1, 2, 3]) {
      const page = { ...data, journal: { ...data.journal, offset, limit: 1, items: data.journal.items.slice(offset, offset + 1) } };
      expect(isKqTreasurySnapshot(page)).toBe(true);
      expect(getKqTreasuryReport(page)).toEqual(complete);
    }
  });

  it("does not compare a previous month's balances against today's physical wallet", () => {
    const data = snapshot(); data.period.key = "previous";
    data.checks.walletCashCents = 10000;
    const result = getKqTreasuryReport(data);
    expect(result.reconciled).toBeNull();
    expect(result.cash.availableCents).toBe(35000);
    expect(result.sourceDifferences.cash).toBe(25000);
  });

  it("exposes source discrepancies independently of a mathematically balanced ledger", () => {
    const data = snapshot();
    data.checks.walletCashCents -= 1;
    data.checks.vatReserveCents = 200;
    data.checks.savingsCents = 300;
    data.checks.labDebtCents = 4500;
    const result = getKqTreasuryReport(data);
    expect(result.reconciled).toBe(false);
    expect(result.balanceSheet.differenceCents).toBe(0);
    expect(result.sourceDifferences).toMatchObject({ cash: 1, vatReserve: -200, savings: -300, lab: -4500 });
  });
});

describe("treasury snapshot validation", () => {
  it("accepts a complete aggregate with an empty journal page", () => {
    expect(isKqTreasurySnapshot(snapshot())).toBe(true);
  });

  it.each([
    ["missing version", (data: Record<string, unknown>) => { delete data.version; }],
    ["unsupported version", (data: Record<string, unknown>) => { data.version = 2; }],
    ["invalid date", (data: Record<string, unknown>) => { data.serverNow = "invalid"; }],
    ["missing source checks", (data: Record<string, unknown>) => { delete data.checks; }],
    ["unknown balance account", (data: Record<string, unknown>) => { data.closingBalances = { invented_profit: -10000 }; }],
    ["fractional cents", (data: Record<string, unknown>) => { data.closingBalances = { cash: 0.1 }; }],
    ["unsafe cents", (data: Record<string, unknown>) => { data.closingBalances = { cash: Number.MAX_SAFE_INTEGER + 1 }; }],
    ["non-finite cents", (data: Record<string, unknown>) => { data.closingBalances = { cash: Infinity }; }],
    ["unavailable period", (data: Record<string, unknown>) => { data.period = { key: "future", from, to }; }],
    ["negative source balance", (data: Record<string, unknown>) => { data.checks = { ...snapshot().checks, walletCashCents: -1 }; }],
    ["oversized page", (data: Record<string, unknown>) => { data.journal = { items: [], total: 0, offset: 0, limit: 101 }; }],
    ["fractional offset", (data: Record<string, unknown>) => { data.journal = { items: [], total: 0, offset: 0.5, limit: 25 }; }],
    ["missing series", (data: Record<string, unknown>) => { delete data.series; }],
  ])("rejects %s instead of silently replacing it with zero", (_label, mutate) => {
    const data = structuredClone(snapshot()) as unknown as Record<string, unknown>;
    mutate(data);
    expect(isKqTreasurySnapshot(data)).toBe(false);
  });

  it("rejects an unbalanced journal transaction or an unknown posting account", () => {
    const data = snapshot([entry("lab-issued", { expense_lab: 4500, lab_payable: -4500 })]);
    data.journal.items[0].postings[0].deltaCents = 4501;
    expect(isKqTreasurySnapshot(data)).toBe(false);
    const unknown = snapshot();
    unknown.journal.items = [{ id: "x", kind: "x", reference: "x", occurredAt: from,
      postings: [{ account: "unknown" as KqTreasuryAccount, deltaCents: 0 }] }];
    expect(isKqTreasurySnapshot(unknown)).toBe(false);
  });

  it.each([null, [], 42, {}, { version: 1 }])("rejects a partial or non-object response %#", value => {
    expect(isKqTreasurySnapshot(value)).toBe(false);
  });
});
