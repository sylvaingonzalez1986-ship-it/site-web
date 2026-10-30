import { describe, expect, it } from "vitest";
import { getKqBankTerms, KQ_BANK_INSTALLMENT_MS, type KqBankLoan } from "./kanab-quest-bank";
import { getKqBankLoanSummary } from "./kanab-quest-bank-summary";

const acceptedAt = "2026-10-01T12:00:00.000Z";
function contract(paidInstallments = 0, partialCents = 0): KqBankLoan {
  const terms = getKqBankTerms(100_001, 575);
  const schedule = terms.installments.map((amountCents, index) => ({
    at: new Date(Date.parse(acceptedAt) + (index + 1) * KQ_BANK_INSTALLMENT_MS).toISOString(),
    amountCents,
    paidCents: index < paidInstallments ? amountCents : index === paidInstallments ? partialCents : 0,
  }));
  const paidCents = schedule.reduce((sum, item) => sum + item.paidCents, 0);
  return {
    id: "12345678-1234-4123-8123-123456789abc",
    principalCents: 100_001,
    interestCents: terms.interestCents,
    totalCents: terms.totalCents,
    paidCents,
    remainingCents: terms.totalCents - paidCents,
    rateBps: 575,
    acceptedAt,
    dueAt: schedule.at(-1)!.at,
    paidAt: paidInstallments === schedule.length ? schedule.at(-1)!.at : null,
    overdueCents: 0,
    schedule,
  };
}

describe("bank loan summary", () => {
  it("announces the first installment rather than the final contractual date", () => {
    const loan = contract();
    const summary = getKqBankLoanSummary(loan, acceptedAt, 200_000);
    expect(summary.nextInstallment).toEqual({ number: 1, ...loan.schedule[0], remainingCents: loan.schedule[0].amountCents, status: "upcoming" });
    expect(summary.nextInstallment!.at).not.toBe(loan.dueAt);
    expect(summary.paidInstallments).toBe(0);
    expect(summary.installmentCount).toBe(7);
  });

  it("moves to the second installment when the first is fully paid", () => {
    const loan = contract(1);
    const summary = getKqBankLoanSummary(loan, loan.schedule[0].at, 200_000);
    expect(summary.nextInstallment).toMatchObject({ number: 2, at: loan.schedule[1].at, status: "upcoming" });
    expect(summary.paidInstallments).toBe(1);
  });

  it("keeps a partially paid installment and announces only its outstanding cents", () => {
    const loan = contract(1, 2_345);
    const summary = getKqBankLoanSummary(loan, loan.schedule[1].at, 200_000);
    expect(summary.nextInstallment).toEqual({ number: 2, ...loan.schedule[1], remainingCents: loan.schedule[1].amountCents - 2_345, status: "overdue" });
    expect(summary.paidInstallments).toBe(1);
  });

  it("counts an installment as due at the exact server deadline", () => {
    const loan = contract();
    const deadline = Date.parse(loan.schedule[0].at);
    expect(getKqBankLoanSummary(loan, new Date(deadline - 1).toISOString(), 0).nextInstallment!.status).toBe("upcoming");
    expect(getKqBankLoanSummary(loan, new Date(deadline).toISOString(), 0).nextInstallment!.status).toBe("overdue");
  });

  it("uses instants rather than comparing date strings with different UTC offsets", () => {
    const loan = contract();
    expect(getKqBankLoanSummary(loan, "2026-10-06T14:00:00+02:00", 0).nextInstallment!.status).toBe("overdue");
    expect(getKqBankLoanSummary(loan, "2026-10-06T13:59:59+02:00", 0).nextInstallment!.status).toBe("upcoming");
  });

  it("keeps the earliest unpaid installment even after the final contractual deadline", () => {
    const loan = contract(2, 157);
    const afterFinal = new Date(Date.parse(loan.dueAt) + KQ_BANK_INSTALLMENT_MS).toISOString();
    expect(getKqBankLoanSummary(loan, afterFinal, 0).nextInstallment).toMatchObject({ number: 3, at: loan.schedule[2].at, status: "overdue" });
  });

  it("preserves the server overdue balance instead of recomputing it from dates", () => {
    const loan = { ...contract(1, 2_345), overdueCents: 711 };
    const summary = getKqBankLoanSummary(loan, loan.dueAt, 0);
    expect(summary.overdueCents).toBe(711);
    expect(summary.remainingCents).toBe(loan.remainingCents);
  });

  it("allows repayment with exactly enough cash and projects a true zero balance", () => {
    const loan = contract(1);
    expect(getKqBankLoanSummary(loan, acceptedAt, loan.remainingCents)).toMatchObject({ canRepay: true, missingCents: 0, cashAfterRepaymentCents: 0 });
  });

  it("shows the exact shortfall and no cash projection when funds are insufficient", () => {
    const loan = contract(1);
    expect(getKqBankLoanSummary(loan, acceptedAt, loan.remainingCents - 1)).toMatchObject({ canRepay: false, missingCents: 1, cashAfterRepaymentCents: null });
    expect(getKqBankLoanSummary(loan, acceptedAt, 0)).toMatchObject({ canRepay: false, missingCents: loan.remainingCents, cashAfterRepaymentCents: null });
  });

  it("keeps all fixed contractual interest in an early repayment", () => {
    const loan = contract();
    const summary = getKqBankLoanSummary(loan, acceptedAt, 200_000);
    expect(summary.remainingCents).toBe(loan.principalCents + loan.interestCents);
    expect(summary.cashAfterRepaymentCents).toBe(200_000 - loan.totalCents);
    expect(summary.canRepay).toBe(true);
  });

  it("does not offer repayment or invent a next payment for a fully settled loan", () => {
    const loan = contract(7);
    expect(getKqBankLoanSummary(loan, loan.dueAt, 1_200)).toEqual({ nextInstallment: null, remainingCents: 0, overdueCents: 0, paidInstallments: 7, installmentCount: 7, missingCents: 0, cashAfterRepaymentCents: 1_200, canRepay: false });
  });

  it("presents a closed historical daily schedule without rewriting its dates", () => {
    const loan = contract(7);
    loan.schedule = loan.schedule.map((item, index) => ({ ...item, at: new Date(Date.parse(acceptedAt) + (index + 1) * 86_400_000).toISOString() }));
    loan.dueAt = loan.schedule.at(-1)!.at;
    loan.paidAt = loan.dueAt;
    const before = structuredClone(loan);
    expect(getKqBankLoanSummary(loan, loan.dueAt, 0)).toMatchObject({ nextInstallment: null, paidInstallments: 7, remainingCents: 0, canRepay: false });
    expect(loan).toEqual(before);
  });
});
