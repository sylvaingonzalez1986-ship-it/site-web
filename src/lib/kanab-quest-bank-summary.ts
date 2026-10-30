import type { KqBankLoan } from "./kanab-quest-bank";

export type KqBankLoanSummary = {
  nextInstallment: {
    number: number;
    at: string;
    amountCents: number;
    paidCents: number;
    remainingCents: number;
    status: "overdue" | "upcoming";
  } | null;
  remainingCents: number;
  overdueCents: number;
  paidInstallments: number;
  installmentCount: number;
  missingCents: number;
  cashAfterRepaymentCents: number | null;
  canRepay: boolean;
};

/** Presents a validated server contract without recalculating its debt or terms. */
export function getKqBankLoanSummary(loan: KqBankLoan, serverNow: string, cashCents: number): KqBankLoanSummary {
  // Snapshot validation already guarantees the schedule's chronological order.
  const nextIndex = loan.schedule.findIndex(item => item.paidCents < item.amountCents);
  const next = nextIndex >= 0 ? loan.schedule[nextIndex] : null;
  const missingCents = Math.max(0, loan.remainingCents - cashCents);

  return {
    nextInstallment: next ? {
      number: nextIndex + 1,
      at: next.at,
      amountCents: next.amountCents,
      paidCents: next.paidCents,
      remainingCents: next.amountCents - next.paidCents,
      status: Date.parse(next.at) <= Date.parse(serverNow) ? "overdue" : "upcoming",
    } : null,
    remainingCents: loan.remainingCents,
    overdueCents: loan.overdueCents,
    paidInstallments: loan.schedule.filter(item => item.paidCents === item.amountCents).length,
    installmentCount: loan.schedule.length,
    missingCents,
    cashAfterRepaymentCents: missingCents > 0 ? null : cashCents - loan.remainingCents,
    canRepay: loan.remainingCents > 0 && cashCents >= loan.remainingCents,
  };
}
