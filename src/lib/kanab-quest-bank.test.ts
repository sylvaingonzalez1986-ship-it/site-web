import { describe, expect, it } from "vitest";
import { getKqBankerDialogue, getKqBankTerms, isKqBankSnapshot, parseKqBankCommand, parseKqBankEuros, KQ_BANK_INSTALLMENT_MS, KQ_BANK_TERM_DAYS, KQ_BANK_TIERS, KQ_BANK_MAX_CENTS, KQ_BANK_MAX_REPAYMENT_CENTS, type KqBankSnapshot } from "./kanab-quest-bank";
const id = "12345678-1234-4123-8123-123456789abc";
export const bankFixture = (): KqBankSnapshot => ({
  version: 1, serverNow: "2026-09-23T12:00:00Z", cashCents: 35000, reputation: 200,
  eligibleAt: "2026-09-21T12:00:00Z", market: { id, scenario: "confidence", rateBps: 500, changeBps: -150, startsAt: "2026-09-23T00:00:00Z", expiresAt: "2026-09-24T00:00:00Z" },
  offer: { quoteId: id, minCents: 10000, maxCents: KQ_BANK_TIERS[0].maxCents, rateBps: 500, termDays: KQ_BANK_TERM_DAYS, expiresAt: "2026-09-24T00:00:00Z" },
  blockedReason: null, loan: null, history: [], autoPaidCents: 0, replayed: false,
});
describe("bank contracts", () => {
  it("normalizes commands and discards user ownership or client totals", () => {
    const value = { action: "borrow", requestKey: id, quoteId: id, amountCents: 10000, expectedRateBps: 500 };
    expect(parseKqBankCommand({ ...value, userId: "victim", interestCents: 0 })).toEqual(value);
  });
  it.each([0, 9999, KQ_BANK_MAX_CENTS + 1, 10000.5, Number.MAX_SAFE_INTEGER, "10000", null])("rejects invalid amount %s", amountCents => {
    expect(parseKqBankCommand({ action: "borrow", requestKey: id, quoteId: id, amountCents, expectedRateBps: 500 })).toBeNull();
  });
  it.each(KQ_BANK_TIERS)("accepts an investment at the $reputation-point tier", tier => {
    const amountCents = tier.maxCents;
    expect(parseKqBankCommand({ action: "borrow", requestKey: id, quoteId: id, amountCents, expectedRateBps: 1400 })?.amountCents).toBe(amountCents);
    const terms = getKqBankTerms(amountCents, 1400);
    const exactInterest = Number((BigInt(amountCents) * BigInt(1400) + BigInt(9999)) / BigInt(10000));
    expect(terms.interestCents).toBe(exactInterest);
    expect(terms.installments.reduce((a, b) => a + b, 0)).toBe(amountCents + exactInterest);
    expect(Math.max(...terms.installments) - Math.min(...terms.installments)).toBeLessThanOrEqual(1);
    expect(isKqBankSnapshot({ ...bankFixture(), reputation: tier.reputation, offer: { ...bankFixture().offer!, maxCents: amountCents } })).toBe(true);
  });
  it("accepts repayment of the largest contractual debt and rejects one extra cent", () => {
    const repayment = { action: "repay", requestKey: id, loanId: id, amountCents: KQ_BANK_MAX_REPAYMENT_CENTS };
    expect(parseKqBankCommand(repayment)).toEqual(repayment);
    expect(parseKqBankCommand({ ...repayment, amountCents: KQ_BANK_MAX_REPAYMENT_CENTS + 1 })).toBeNull();
    expect(getKqBankTerms(KQ_BANK_MAX_CENTS, 1400).totalCents).toBe(KQ_BANK_MAX_REPAYMENT_CENTS);
    expect(() => getKqBankTerms(KQ_BANK_MAX_CENTS + 1, 1400)).toThrow();
  });
  it("parses six-digit euro inputs exactly without accepting scientific notation or excess decimals", () => {
    expect(parseKqBankEuros("100000,01")).toBe(10_000_001);
    expect(parseKqBankEuros(" 100000.01 ")).toBe(10_000_001);
    for (const amount of ["100 000,01", "100\u00a0000,01", "100\u202f000,01"]) expect(parseKqBankEuros(amount)).toBe(10_000_001);
    expect(parseKqBankEuros(String(KQ_BANK_MAX_CENTS / 100))).toBe(KQ_BANK_MAX_CENTS);
    expect(parseKqBankEuros((KQ_BANK_MAX_CENTS / 100 + 0.01).toFixed(2))).toBeNull();
    for (const amount of ["99.99", "-100", "1e5", "100.001", "", "10000000", "100 000foo", "1 00 000", "10 00", "0 100", "100.000,00"]) expect(parseKqBankEuros(amount)).toBeNull();
  });
  it("rejects missing request identity, forged rates and loan identifiers", () => {
    expect(parseKqBankCommand({ action: "borrow", quoteId: id, amountCents: 10000, expectedRateBps: 500 })).toBeNull();
    expect(parseKqBankCommand({ action: "borrow", requestKey: id, quoteId: id, amountCents: 10000, expectedRateBps: 0 })).toBeNull();
    expect(parseKqBankCommand({ action: "repay", requestKey: id, loanId: "another-player", amountCents: 10000 })).toBeNull();
  });
  it("rounds interest up once and distributes exact integer installments", () => {
    const terms = getKqBankTerms(12345, 575);
    expect(terms.interestCents).toBe(710);
    expect(terms.totalCents).toBe(13055);
    expect(terms.installments).toEqual([1865, 1865, 1865, 1865, 1865, 1865, 1865]);
    const uneven = getKqBankTerms(10001, 501);
    expect(uneven.installments.reduce((a, b) => a + b, 0)).toBe(uneven.totalCents);
    expect(Math.max(...uneven.installments) - Math.min(...uneven.installments)).toBeLessThanOrEqual(1);
  });
  it("validates server snapshots and fails closed on absent or incoherent offers", () => {
    expect(isKqBankSnapshot(bankFixture())).toBe(true);
    expect(isKqBankSnapshot({ ...bankFixture(), offer: null })).toBe(false);
    expect(isKqBankSnapshot({ ...bankFixture(), offer: null, blockedReason: "reputation" })).toBe(true);
    expect(isKqBankSnapshot({ ...bankFixture(), cashCents: -1 })).toBe(false);
    expect(isKqBankSnapshot({ ...bankFixture(), market: { ...bankFixture().market, scenario: "constructor" } })).toBe(false);
    expect(isKqBankSnapshot({ ...bankFixture(), version: 0 })).toBe(false);
    expect(isKqBankSnapshot({ ...bankFixture(), offer: { ...bankFixture().offer, termDays: 7 } })).toBe(false);
  });
  it("validates signed debt including the sum of scheduled paid cents", () => {
    const terms = getKqBankTerms(10000, 500);
    const value = { ...bankFixture(), offer: null, blockedReason: "active", loan: {
      id, principalCents: 10000, rateBps: 500, ...terms, paidCents: 0, remainingCents: terms.totalCents,
      acceptedAt: "2026-09-23T12:00:00Z", dueAt: "2026-10-28T12:00:00Z", paidAt: null, overdueCents: 0,
      schedule: terms.installments.map((amountCents, i) => ({ at: new Date(Date.parse("2026-09-23T12:00:00Z") + (i + 1) * KQ_BANK_INSTALLMENT_MS).toISOString(), amountCents, paidCents: 0 })),
    } };
    expect(isKqBankSnapshot(value)).toBe(true);
    expect(isKqBankSnapshot({ ...value, loan: { ...value.loan, interestCents: 0 } })).toBe(false);
    expect(isKqBankSnapshot({ ...value, loan: { ...value.loan, paidCents: 1, remainingCents: terms.totalCents - 1 } })).toBe(false);
    expect(isKqBankSnapshot({ ...value, loan: { ...value.loan, dueAt: "2026-09-30T12:00:00Z" } })).toBe(false);
    expect(isKqBankSnapshot({ ...value, loan: { ...value.loan, schedule: value.loan.schedule.map((item, i) => i === 0 ? { ...item, at: "2026-09-24T12:00:00Z" } : item) } })).toBe(false);
  });
  it("accepts closed daily loan history while requiring five real days between active instalments", () => {
    const terms = getKqBankTerms(10000, 500);
    const acceptedAt = "2026-09-23T12:00:00Z";
    const dailyLoan = {
      id, principalCents: 10000, rateBps: 500, ...terms, paidCents: terms.totalCents, remainingCents: 0,
      acceptedAt, dueAt: "2026-09-30T12:00:00Z", paidAt: "2026-09-24T12:00:00Z", overdueCents: 0,
      schedule: terms.installments.map(amountCents => ({ at: "", amountCents, paidCents: amountCents }))
        .map((item, i) => ({ ...item, at: new Date(Date.parse(acceptedAt) + (i + 1) * 86_400_000).toISOString() })),
    };
    expect(isKqBankSnapshot({ ...bankFixture(), history: [dailyLoan] })).toBe(true);
    expect(isKqBankSnapshot({ ...bankFixture(), offer: null, blockedReason: "active", loan: {
      ...dailyLoan, paidAt: null, paidCents: 0, remainingCents: terms.totalCents,
      schedule: dailyLoan.schedule.map(item => ({ ...item, paidCents: 0 })),
    } })).toBe(false);
  });
  it("personalizes refusals and successful offers", () => {
    expect(getKqBankerDialogue({ ...bankFixture(), reputation: 80, blockedReason: "reputation" })).toContain("80 points");
    expect(getKqBankerDialogue({ ...bankFixture(), blockedReason: "experience" })).toContain("24 heures");
    expect(getKqBankerDialogue({ ...bankFixture(), blockedReason: "arrears" })).toContain("retard");
    expect(getKqBankerDialogue(bankFixture())).toContain("5\u202f000 €");
  });
});
