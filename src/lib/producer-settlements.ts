import type {
  ProducerPayment,
  ProducerRate,
  ProducerSalesPeriod,
  ProducerSettlementSources,
  ProducerSettlementsDashboard,
} from "@/types/producer-settlements";

export class ProducerSettlementError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "ProducerSettlementError";
  }
}

const parisMonth = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris", year: "numeric", month: "2-digit",
});
const cents = (amount: number) => Math.round(amount * 100);
export const DEFAULT_PRODUCER_SHARE_PERCENT = 80;

export function saleMonth(createdAt: string): string | null {
  const date = new Date(createdAt);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = parisMonth.formatToParts(date);
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}`;
}

export function buildProducerSettlementsDashboard(
  input: ProducerSettlementSources,
  generatedAt = new Date().toISOString(),
): ProducerSettlementsDashboard {
  const producerNames = new Map(input.producers.map((producer) => [producer.id, producer.name]));
  const periods = new Map<string, ProducerSalesPeriod & { orderIds: Set<string> }>();
  const ratesByProduct = new Map<string, ProducerRate[]>();
  for (const rate of input.rates) {
    const key = JSON.stringify([rate.producerId, rate.productId]);
    const rates = ratesByProduct.get(key) ?? [];
    rates.push(rate);
    ratesByProduct.set(key, rates);
  }
  for (const rates of ratesByProduct.values()) {
    rates.sort((a, b) => b.effectiveMonth.localeCompare(a.effectiveMonth));
  }
  const getPeriod = (producerId: string, producerName: string, month: string) => {
    if (!producerNames.has(producerId)) producerNames.set(producerId, producerName);
    const key = JSON.stringify([producerId, month]);
    let period = periods.get(key);
    if (!period) {
      period = {
        producerId, producerName: producerNames.get(producerId) || producerName, month,
        ordersCount: 0, orderIds: new Set(), quantity: 0, gramsSold: 0, revenueTtcCents: 0,
        revenueHtCents: 0, dueCents: 0, missingRateCount: 0,
        paidCents: 0, balanceCents: 0, products: [],
      };
      periods.set(key, period);
    }
    return period;
  };
  const unattributed = { quantity: 0, revenueTtcCents: 0 };
  for (const sale of input.sales) {
    if (!["paid", "not_configured"].includes(sale.paymentState)
      || sale.status === "cancelled" || sale.archivedAt
      || !Number.isInteger(sale.quantity) || sale.quantity <= 0
      || !Number.isFinite(sale.lineTotal) || sale.lineTotal < 0) continue;
    // Synthetic rewards are not supplier sales; a real free product may still
    // incur its agreed unit cost, so zero-price catalog products remain included.
    if (sale.lineTotal === 0 && (sale.productId.startsWith("gift-reward-")
      || sale.productName.toLowerCase().startsWith("lot ticket:"))) continue;
    const month = saleMonth(sale.createdAt);
    if (!month || sale.attribution === "own") continue;
    const revenueTtcCents = cents(sale.lineTotal);
    if (sale.attribution === "unknown" || !sale.producerId) {
      unattributed.quantity += sale.quantity;
      unattributed.revenueTtcCents += revenueTtcCents;
      continue;
    }
    const ht = sale.lineTotalHt;
    const revenueHtCents = ht !== null && Number.isFinite(ht)
      ? cents(ht) : Math.round(revenueTtcCents / (1 + sale.vatRate / 100));
    const period = getPeriod(sale.producerId, sale.producerName || sale.producerId, month);
    period.orderIds.add(sale.orderId);
    period.quantity += sale.quantity;
    const saleWeight = sale.unitWeightGrams;
    period.gramsSold = period.gramsSold !== null && typeof saleWeight === "number" && Number.isFinite(saleWeight) && saleWeight > 0
      ? (period.gramsSold ?? 0) + saleWeight * sale.quantity : null;
    period.revenueTtcCents += revenueTtcCents;
    period.revenueHtCents += revenueHtCents;
    let product = period.products.find((item) => item.productId === sale.productId);
    if (!product) {
      const rate = ratesByProduct.get(JSON.stringify([sale.producerId, sale.productId]))
        ?.find((candidate) => candidate.effectiveMonth <= month) ?? {
          producerId: sale.producerId, productId: sale.productId,
          effectiveMonth: "2000-01", mode: "percent_ht" as const,
          rate: DEFAULT_PRODUCER_SHARE_PERCENT, gramsPerUnit: null,
        };
      product = {
        productId: sale.productId, productName: sale.productName,
        quantity: 0, gramsSold: 0, revenueTtcCents: 0, revenueHtCents: 0, rate, dueCents: null,
      };
      period.products.push(product);
    }
    product.quantity += sale.quantity;
    const weight = sale.unitWeightGrams;
    product.gramsSold = product.gramsSold !== null && typeof weight === "number" && Number.isFinite(weight) && weight > 0
      ? (product.gramsSold ?? 0) + weight * sale.quantity : null;
    product.revenueTtcCents += revenueTtcCents;
    product.revenueHtCents += revenueHtCents;
  }
  for (const payment of input.payments) {
    // Keep even voided/fully cancelled periods visible for their audit history.
    getPeriod(payment.producerId, payment.producerName, payment.salesMonth);
  }
  for (const period of periods.values()) {
    for (const product of period.products) {
      const rate = product.rate;
      if (!rate || (rate.mode === "gram" && !(Number(rate.gramsPerUnit) > 0))) {
        period.missingRateCount++;
        continue;
      }
      // Round once per product/month, in cents. Percentage applies to net item
      // revenue excluding shipping; fixed costs remain independent of discounts.
      product.dueCents = rate.mode === "percent_ht"
        ? Math.round(product.revenueHtCents * rate.rate / 100)
        : Math.round(product.quantity * rate.rate * 100 * (rate.mode === "gram" ? rate.gramsPerUnit! : 1));
      period.dueCents += product.dueCents;
    }
    period.products.sort((a, b) => a.productName.localeCompare(b.productName, "fr"));
  }
  // One actual payment may cover several sales months. Apply it to the oldest
  // outstanding month within its chosen range; keep any surplus as an advance
  // on the last month. Never split or duplicate the persisted payment itself.
  const orderedPayments = [...input.payments].filter((payment) => !payment.voidedAt)
    .sort((a, b) => a.paidOn.localeCompare(b.paidOn) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  for (const payment of orderedPayments) {
    let remaining = payment.amountCents;
    const covered = [...periods.values()].filter((period) => period.producerId === payment.producerId
      && period.month >= (payment.salesFromMonth ?? payment.salesMonth) && period.month <= payment.salesMonth)
      .sort((a, b) => a.month.localeCompare(b.month));
    for (const period of covered) {
      const allocated = Math.min(remaining, Math.max(0, period.dueCents - period.paidCents));
      period.paidCents += allocated;
      remaining -= allocated;
      if (!remaining) break;
    }
    if (remaining) getPeriod(payment.producerId, payment.producerName, payment.salesMonth).paidCents += remaining;
  }
  const finalized: ProducerSalesPeriod[] = [];
  for (const period of periods.values()) {
    const { orderIds, ...summary } = period;
    finalized.push({ ...summary, ordersCount: orderIds.size, balanceCents: period.dueCents - period.paidCents });
  }
  return {
    generatedAt,
    producers: [...producerNames].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "fr")),
    periods: finalized.sort((a, b) => b.month.localeCompare(a.month) || a.producerName.localeCompare(b.producerName, "fr")),
    rates: input.rates, payments: input.payments, unattributed,
  };
}

function text(value: unknown, label: string, max: number, required = true): string {
  if (value === undefined && !required) return "";
  if (typeof value !== "string" || value.trim().length > max || (required && !value.trim())) {
    throw new ProducerSettlementError(`${label} invalide.`);
  }
  return value.trim();
}

function month(value: unknown): string {
  if (typeof value !== "string" || !/^(20\d{2})-(0[1-9]|1[0-2])$/.test(value)) {
    throw new ProducerSettlementError("Mois invalide (AAAA-MM attendu).");
  }
  return value;
}

function uuid(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new ProducerSettlementError("Identifiant de règlement invalide.");
  }
  return value.toLowerCase();
}

export function parseProducerRate(body: Record<string, unknown>): ProducerRate {
  const mode = body.mode;
  if (mode !== "unit" && mode !== "gram" && mode !== "percent_ht") throw new ProducerSettlementError("Mode de calcul invalide.");
  const rate = body.rate;
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate < 0 || rate > (mode === "percent_ht" ? 100 : 1000000)
    || Math.abs(rate * 10000 - Math.round(rate * 10000)) > 0.00001) {
    throw new ProducerSettlementError("Tarif invalide (4 décimales maximum, pourcentage de 0 à 100).");
  }
  const grams = body.gramsPerUnit;
  if (mode === "gram" && (typeof grams !== "number" || !Number.isFinite(grams) || grams <= 0 || grams > 100000
    || Math.abs(grams * 1000 - Math.round(grams * 1000)) > 0.00001)) {
    throw new ProducerSettlementError("Indique un poids par unité valide (3 décimales maximum).");
  }
  return {
    producerId: text(body.producerId, "Producteur", 200),
    productId: text(body.productId, "Produit", 400),
    effectiveMonth: month(body.effectiveMonth), mode, rate,
    gramsPerUnit: mode === "gram" ? grams as number : null,
  };
}

export function parseProducerPayment(body: Record<string, unknown>, today: string): Omit<ProducerPayment, "createdAt" | "voidedAt" | "voidReason"> {
  const amount = body.amountCents;
  if (typeof amount !== "number" || !Number.isSafeInteger(amount) || amount <= 0 || amount > 100000000) {
    throw new ProducerSettlementError("Le montant payé doit être positif, avec 2 décimales maximum (1 000 000 € maximum).");
  }
  const paidOn = body.paidOn;
  if (typeof paidOn !== "string" || !/^20\d{2}-\d{2}-\d{2}$/.test(paidOn)
    || !Number.isFinite(Date.parse(paidOn)) || new Date(paidOn).toISOString().slice(0, 10) !== paidOn
    || paidOn > today) throw new ProducerSettlementError("La date de paiement doit être valide et ne peut pas être future.");
  const salesMonth = month(body.salesMonth);
  const salesFromMonth = month(body.salesFromMonth ?? salesMonth);
  if (salesFromMonth > salesMonth) throw new ProducerSettlementError("Le début de la période doit précéder sa fin.");
  return {
    id: uuid(body.id), producerId: text(body.producerId, "Producteur", 200),
    producerName: text(body.producerName, "Nom du producteur", 300), salesMonth, salesFromMonth,
    amountCents: amount, paidOn, reference: text(body.reference, "Référence", 200, false),
    note: text(body.note, "Note", 1000, false),
  };
}

export function parseVoidProducerPayment(body: Record<string, unknown>): { id: string; reason: string } {
  return { id: uuid(body.id), reason: text(body.reason, "Motif d’annulation", 500) };
}
