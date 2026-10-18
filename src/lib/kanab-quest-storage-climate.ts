import { KQ_GAME_MONTH_MS, type KqStorageClimateBilling } from "./kanab-quest-business";
import { getKqWarehouseStorageClimateQuote, KQ_WAREHOUSE_SIMULATION, type KqWarehouseState } from "./kanab-quest-warehouse";

type ClimateQuote = ReturnType<typeof getKqWarehouseStorageClimateQuote>;
export type KqStorageClimateAccrual = {
  updatedAt: number;
  periodStartedAt: number | null;
  nextBillingAt: number | null;
  /** Integer centime × milliseconds: preserves fractional cents across room changes. */
  accruedCentsMs: number;
  quote: ClimateQuote;
  invoices: KqStorageClimateBilling["invoices"];
};

export function createKqStorageClimateAccrual(warehouse: KqWarehouseState, now: number): KqStorageClimateAccrual {
  const quote = getKqWarehouseStorageClimateQuote(warehouse);
  return { updatedAt: now, periodStartedAt: quote.code ? now : null, nextBillingAt: quote.code ? now + KQ_GAME_MONTH_MS : null,
    accruedCentsMs: 0, quote, invoices: [] };
}

/** Settles the previous saved installation before changing its rate; drafts never accrue. */
export function settleKqStorageClimateAccrual(current: KqStorageClimateAccrual, warehouse: KqWarehouseState, now: number) {
  if (!Number.isSafeInteger(now) || now < current.updatedAt) throw new Error("Horloge de climatisation invalide.");
  const next = structuredClone(current);
  const issued: KqStorageClimateBilling["invoices"] = [];
  while (next.nextBillingAt !== null && next.nextBillingAt <= now) {
    next.accruedCentsMs += (next.nextBillingAt - next.updatedAt) * next.quote.monthlyCents;
    const amountCents = Math.floor(next.accruedCentsMs / KQ_GAME_MONTH_MS);
    next.accruedCentsMs -= amountCents * KQ_GAME_MONTH_MS;
    if (amountCents > 0) {
      const invoice = { id: `storage-climate:${next.nextBillingAt}`, periodStartedAt: new Date(next.periodStartedAt!).toISOString(),
        periodEndedAt: new Date(next.nextBillingAt).toISOString(), amountCents, remainingCents: amountCents };
      issued.push(invoice); next.invoices.push(invoice);
    }
    next.updatedAt = next.nextBillingAt;
    next.periodStartedAt = next.nextBillingAt;
    next.nextBillingAt += KQ_GAME_MONTH_MS;
  }
  if (next.periodStartedAt !== null) next.accruedCentsMs += (now - next.updatedAt) * next.quote.monthlyCents;
  next.updatedAt = now;
  next.quote = getKqWarehouseStorageClimateQuote(warehouse);
  if (next.periodStartedAt === null && next.quote.code) {
    next.periodStartedAt = now; next.nextBillingAt = now + KQ_GAME_MONTH_MS;
  }
  return { next, issued };
}

/** Shared electricity payments settle older culture invoices before these monthly invoices. */
export function payKqStorageClimateInvoices(accrual: KqStorageClimateAccrual, amountCents: number) {
  let remaining = Math.max(0, Math.floor(amountCents));
  for (const invoice of accrual.invoices) {
    const paid = Math.min(remaining, invoice.remainingCents);
    invoice.remainingCents -= paid; remaining -= paid;
  }
  return amountCents - remaining;
}

export function getKqStorageClimateBilling(accrual: KqStorageClimateAccrual): KqStorageClimateBilling {
  const quote = accrual.quote;
  const accruedCents = Math.floor(accrual.accruedCentsMs / KQ_GAME_MONTH_MS);
  return { version: 1, code: quote.code, areaM2: quote.code ? quote.areaM2 : 0, kwhPerM2Month: quote.kwhPerM2,
    tariffCentsPerKwh: KQ_WAREHOUSE_SIMULATION.electricityCentsPerKwh, monthlyKwh: quote.monthlyKwh, monthlyCostCents: quote.monthlyCents,
    periodStartedAt: accrual.periodStartedAt === null ? null : new Date(accrual.periodStartedAt).toISOString(),
    nextBillingAt: accrual.nextBillingAt === null || (quote.monthlyCents === 0 && accruedCents < 1) ? null : new Date(accrual.nextBillingAt).toISOString(),
    accruedCents, transitionCreditCents: 0,
    outstandingCents: accrual.invoices.reduce((sum, invoice) => sum + invoice.remainingCents, 0), invoices: accrual.invoices };
}
