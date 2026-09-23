import { describe, expect, it } from "vitest";
import { getKqBankerDialogue, getKqBankTerms, isKqBankSnapshot, parseKqBankCommand, type KqBankSnapshot } from "./kanab-quest-bank";
const id = "12345678-1234-4123-8123-123456789abc";
export const bankFixture = (): KqBankSnapshot => ({
  version: 1, serverNow: "2026-09-23T12:00:00Z", cashCents: 35000, reputation: 200,
  eligibleAt: "2026-09-21T12:00:00Z", market: { id, scenario: "confidence", rateBps: 500, changeBps: -150, startsAt: "2026-09-23T00:00:00Z", expiresAt: "2026-09-24T00:00:00Z" },
  offer: { quoteId: id, minCents: 10000, maxCents: 50000, rateBps: 500, termDays: 7, expiresAt: "2026-09-24T00:00:00Z" },
  blockedReason: null, loan: null, history: [], autoPaidCents: 0, replayed: false,
});
describe("bank contracts", () => {
  it("normalizes commands and discards user ownership or client totals", () => {
    const value = { action: "borrow", requestKey: id, quoteId: id, amountCents: 10000, expectedRateBps: 500 };
    expect(parseKqBankCommand({ ...value, userId: "victim", interestCents: 0 })).toEqual(value);
  });
  it.each([0, 9999, 1000001, 10000.5, Number.MAX_SAFE_INTEGER, "10000", null])("rejects invalid amount %s", amountCents => {
    expect(parseKqBankCommand({ action: "borrow", requestKey: id, quoteId: id, amountCents, expectedRateBps: 500 })).toBeNull();
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
  });
  it("validates signed debt including the sum of scheduled paid cents", () => {
    const terms = getKqBankTerms(10000, 500);
    const value = { ...bankFixture(), offer: null, blockedReason: "active", loan: {
      id, principalCents: 10000, rateBps: 500, ...terms, paidCents: 0, remainingCents: terms.totalCents,
      acceptedAt: "2026-09-23T12:00:00Z", dueAt: "2026-09-30T12:00:00Z", paidAt: null, overdueCents: 0,
      schedule: terms.installments.map((amountCents, i) => ({ at: `2026-09-${24 + i}T12:00:00Z`, amountCents, paidCents: 0 })),
    } };
    expect(isKqBankSnapshot(value)).toBe(true);
    expect(isKqBankSnapshot({ ...value, loan: { ...value.loan, interestCents: 0 } })).toBe(false);
    expect(isKqBankSnapshot({ ...value, loan: { ...value.loan, paidCents: 1, remainingCents: terms.totalCents - 1 } })).toBe(false);
  });
  it("personalizes refusals and successful offers", () => {
    expect(getKqBankerDialogue({ ...bankFixture(), reputation: 80, blockedReason: "reputation" })).toContain("80 points");
    expect(getKqBankerDialogue({ ...bankFixture(), blockedReason: "experience" })).toContain("24 heures");
    expect(getKqBankerDialogue({ ...bankFixture(), blockedReason: "arrears" })).toContain("retard");
    expect(getKqBankerDialogue(bankFixture())).toContain("500 €");
  });
});
