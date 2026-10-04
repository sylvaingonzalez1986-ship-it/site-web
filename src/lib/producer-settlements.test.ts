import { describe, expect, it } from "vitest";
import {
  buildProducerSettlementsDashboard,
  parseProducerPayment,
  parseProducerRate,
  parseVoidProducerPayment,
} from "@/lib/producer-settlements";
import type { ProducerPayment, ProducerSaleSource, ProducerSettlementSources } from "@/types/producer-settlements";

const sale: ProducerSaleSource = {
  orderId: "order1", createdAt: "2026-09-10T12:00:00Z", paymentState: "paid", status: "shipped", archivedAt: null,
  productId: "flower::5g", productName: "Fleur 5g", producerId: "farm", producerName: "La ferme", attribution: "producer",
  quantity: 2, lineTotal: 120, lineTotalHt: 100, vatRate: 20,
};
const payment: ProducerPayment = {
  id: "36c50da6-64f9-4092-ae4c-f19b4deaa9af", producerId: "farm", producerName: "La ferme", salesMonth: "2026-09",
  amountCents: 3000, paidOn: "2026-10-02", reference: "VIR123", note: "", createdAt: "2026-10-02T10:00:00Z", voidedAt: null, voidReason: null,
};
function build(input: Partial<ProducerSettlementSources> = {}) {
  return buildProducerSettlementsDashboard({ sales: [sale], producers: [], rates: [], payments: [], ...input });
}

describe("producer settlements accounting", () => {
  it("owes 80% of net HT sales, subtracts partial payment against sale month, not payment date", () => {
    const { periods } = build({ payments: [payment] });
    expect(periods).toHaveLength(1);
    expect(periods[0]).toMatchObject({ month: "2026-09", dueCents: 8000, paidCents: 3000, balanceCents: 5000, missingRateCount: 0 });
  });
  it("keeps distinct producers and variant formats and counts multi-product orders once", () => {
    const { periods } = build({ sales: [sale, { ...sale, productId: "flower::10g" }, { ...sale, producerId: "farm2" }] });
    expect(periods).toHaveLength(2);
    expect(periods.find((period) => period.producerId === "farm")).toMatchObject({ ordersCount: 1, quantity: 4, dueCents: 16000 });
    expect(periods.find((period) => period.producerId === "farm")?.products).toHaveLength(2);
  });
  it("settles one 100g batch across months with a single payment and keeps the unpaid balance", () => {
    const result = build({ sales: [
      { ...sale, quantity: 60, unitWeightGrams: 1, lineTotal: 72, lineTotalHt: 60 },
      { ...sale, quantity: 50, unitWeightGrams: 1, createdAt: "2026-10-02T12:00:00Z", lineTotal: 60, lineTotalHt: 50 },
    ], payments: [{ ...payment, salesFromMonth: "2026-09", salesMonth: "2026-10", amountCents: 8000 }] });
    expect(result.periods).toMatchObject([
      { month: "2026-10", gramsSold: 50, dueCents: 4000, paidCents: 3200, balanceCents: 800 },
      { month: "2026-09", gramsSold: 60, dueCents: 4800, paidCents: 4800, balanceCents: 0 },
    ]);
    expect(result.payments).toHaveLength(1);
    expect(result.periods.reduce((sum, period) => sum + period.paidCents, 0)).toBe(8000);
  });
  it("excludes pending, failed, cancelled, archived, own production and synthetic gifts", () => {
    const excluded: ProducerSaleSource[] = [
      { ...sale, paymentState: "pending" }, { ...sale, paymentState: "failed" },
      { ...sale, status: "cancelled" }, { ...sale, archivedAt: "2026-10-01" },
      { ...sale, attribution: "own", producerId: null },
      { ...sale, productId: "gift-reward-1", lineTotal: 0 },
    ];
    expect(build({ sales: excluded }).periods).toEqual([]);
    expect(build({ sales: [{ ...sale, paymentState: "not_configured" }] }).periods[0].dueCents).toBe(8000);
  });
  it("reports unresolved historical products without attributing them to own production", () => {
    const result = build({ sales: [{ ...sale, attribution: "unknown", producerId: null }] });
    expect(result.periods).toEqual([]);
    expect(result.unattributed).toEqual({ quantity: 2, revenueTtcCents: 12000 });
  });
  it("uses Paris month boundaries including midnight UTC offsets", () => {
    expect(build({ sales: [{ ...sale, createdAt: "2026-09-30T22:30:00Z" }] }).periods[0].month).toBe("2026-10");
    expect(build({ sales: [{ ...sale, createdAt: "2026-01-31T23:30:00Z" }] }).periods[0].month).toBe("2026-02");
  });
  it("shows grams only when every line has a recorded weight", () => {
    expect(build({ sales: [{ ...sale, unitWeightGrams: 5 }] }).periods[0].products[0].gramsSold).toBe(10);
    expect(build({ sales: [{ ...sale, unitWeightGrams: 5 }, sale] }).periods[0].products[0].gramsSold).toBeNull();
  });
  it("uses dated per-gram tariffs with explicit weight per format, falling back to 80% before tariff", () => {
    const result = build({
      sales: [sale, { ...sale, createdAt: "2026-10-04T12:00:00Z" }, { ...sale, createdAt: "2026-11-04T12:00:00Z" }],
      rates: [
        { producerId: "farm", productId: "flower::5g", effectiveMonth: "2026-10", mode: "gram", rate: 2.125, gramsPerUnit: 5 },
        { producerId: "farm", productId: "flower::5g", effectiveMonth: "2026-11", mode: "unit", rate: 12, gramsPerUnit: null },
      ],
    });
    expect(result.periods.map((period) => [period.month, period.dueCents])).toEqual([["2026-11", 2400], ["2026-10", 2125], ["2026-09", 8000]]);
  });
  it("rounds cents once per product/month and computes missing historic HT without interpreting null as zero", () => {
    expect(build({ sales: [{ ...sale, lineTotal: 10.55, lineTotalHt: null, vatRate: 5.5 }] }).periods[0].dueCents).toBe(800);
    expect(build({ sales: Array.from({ length: 3 }, () => ({ ...sale, lineTotal: 0.01, lineTotalHt: 0.01 })) }).periods[0].dueCents).toBe(2);
  });
  it("preserves advances and voided payment history, including periods without remaining sales", () => {
    const voided = { ...payment, id: "void", voidedAt: "2026-10-03", voidReason: "Erreur" };
    const result = build({ payments: [{ ...payment, amountCents: 9000 }, voided] });
    expect(result.periods[0]).toMatchObject({ paidCents: 9000, balanceCents: -1000 });
    expect(result.payments).toHaveLength(2);
    expect(build({ sales: [], payments: [payment] }).periods[0].balanceCents).toBe(-3000);
  });
});

describe("producer settlement input validation", () => {
  it("allows historical partial payments but rejects fractional cents, invalid/future dates and missing IDs", () => {
    expect(parseProducerPayment(payment, "2026-10-03")).toMatchObject({ amountCents: 3000 });
    for (const change of [{ amountCents: 0 }, { amountCents: 1.2 }, { amountCents: "3000" }, { amountCents: Infinity },
      { paidOn: "2026-02-30" }, { paidOn: "2026-10-04" }, { id: "bad" }]) {
      expect(() => parseProducerPayment({ ...payment, ...change }, "2026-10-03")).toThrow();
    }
  });
  it("requires real gram weights and bounded percent and month without coercion", () => {
    const base = { producerId: "farm", productId: "flower::5g", effectiveMonth: "2026-10", mode: "gram", rate: 1.125, gramsPerUnit: 5 };
    expect(parseProducerRate(base)).toEqual(base);
    for (const change of [{ gramsPerUnit: null }, { gramsPerUnit: 0 }, { rate: -1 }, { rate: "1" }, { effectiveMonth: "2026-13" },
      { mode: "percent_ht", rate: 101 }, { rate: 0.12345 }]) expect(() => parseProducerRate({ ...base, ...change })).toThrow();
  });
  it("requires a reason to void a payment", () => {
    expect(() => parseVoidProducerPayment({ id: payment.id, reason: " " })).toThrow();
    expect(parseVoidProducerPayment({ id: payment.id, reason: " Saisie en double " })).toEqual({ id: payment.id, reason: "Saisie en double" });
  });
});
