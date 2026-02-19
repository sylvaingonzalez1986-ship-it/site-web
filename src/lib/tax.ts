import { VAT_RATE_OPTIONS, type VatRate } from "@/data/products";
import type { OrderItem, OrderVatBreakdown } from "@/types/store";

type ComputeFromTtcOptions = {
  taxable?: boolean;
};

type PackComponent = {
  price: number;
  vatRate: VatRate;
};

type DistributedComponent = {
  priceTtc: number;
  vatRate: VatRate;
};

const VAT_RATE_SET = new Set<VatRate>(VAT_RATE_OPTIONS);

function toCents(value: number): number {
  return Math.round(value * 100);
}

function fromCents(value: number): number {
  return Number((value / 100).toFixed(2));
}

function sanitizeVatRate(value: unknown): VatRate {
  const parsed = Number(value);
  if (VAT_RATE_SET.has(parsed as VatRate)) {
    return parsed as VatRate;
  }

  return 20;
}

function distributeCents(totalCents: number, weights: number[]): number[] {
  if (weights.length === 0) {
    return [];
  }

  const safeTotal = Math.max(0, Math.round(totalCents));
  const safeWeights = weights.map((weight) => Math.max(0, Math.round(weight)));
  const sumWeights = safeWeights.reduce((sum, weight) => sum + weight, 0);

  if (sumWeights <= 0) {
    const equalBase = Math.floor(safeTotal / safeWeights.length);
    const result = safeWeights.map(() => equalBase);
    let remainder = safeTotal - equalBase * safeWeights.length;
    for (let index = 0; index < result.length && remainder > 0; index += 1) {
      result[index] += 1;
      remainder -= 1;
    }
    return result;
  }

  const exactValues = safeWeights.map((weight) => (safeTotal * weight) / sumWeights);
  const result = exactValues.map((value) => Math.floor(value));
  let remainder = safeTotal - result.reduce((sum, value) => sum + value, 0);

  const remainders = exactValues
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder);

  for (const item of remainders) {
    if (remainder <= 0) {
      break;
    }
    result[item.index] += 1;
    remainder -= 1;
  }

  return result;
}

export function computeFromTtc(
  ttc: number,
  vatRate: number,
  options?: ComputeFromTtcOptions,
): { ht: number; vat: number } {
  const ttcCents = Math.max(0, toCents(Number.isFinite(ttc) ? ttc : 0));
  const taxable = options?.taxable ?? true;
  if (!taxable) {
    return { ht: fromCents(ttcCents), vat: 0 };
  }

  const safeVatRate = sanitizeVatRate(vatRate);
  const htCents = Math.round((ttcCents * 100) / (100 + safeVatRate));
  const vatCents = ttcCents - htCents;

  return {
    ht: fromCents(htCents),
    vat: fromCents(vatCents),
  };
}

export function computeOrderTaxTotals(
  items: OrderItem[],
  options?: ComputeFromTtcOptions,
): {
  totalHt: number;
  totalVat: number;
  vatBreakdown: OrderVatBreakdown[];
} {
  const taxable = options?.taxable ?? true;
  if (!taxable) {
    const totalTtc = fromCents(
      items.reduce((sum, item) => sum + toCents(Number.isFinite(item.lineTotal) ? item.lineTotal : 0), 0),
    );

    return {
      totalHt: totalTtc,
      totalVat: 0,
      vatBreakdown: [],
    };
  }

  const totals = new Map<VatRate, { baseHtCents: number; vatCents: number }>();
  let totalHtCents = 0;
  let totalVatCents = 0;

  for (const item of items) {
    const rate = sanitizeVatRate(item.vatRate);
    const lineTotal = Number.isFinite(item.lineTotal) ? item.lineTotal : 0;
    const lineTax = computeFromTtc(lineTotal, rate, { taxable });
    const lineHtCents = toCents(lineTax.ht);
    const lineVatCents = toCents(lineTax.vat);

    totalHtCents += lineHtCents;
    totalVatCents += lineVatCents;

    const previous = totals.get(rate) ?? { baseHtCents: 0, vatCents: 0 };
    totals.set(rate, {
      baseHtCents: previous.baseHtCents + lineHtCents,
      vatCents: previous.vatCents + lineVatCents,
    });
  }

  const vatBreakdown = Array.from(totals.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([rate, values]) => ({
      rate,
      baseHt: fromCents(values.baseHtCents),
      vatAmount: fromCents(values.vatCents),
    }));

  return {
    totalHt: fromCents(totalHtCents),
    totalVat: fromCents(totalVatCents),
    vatBreakdown,
  };
}

export function distributePackDiscount(
  components: PackComponent[],
  packPriceTtc: number,
): DistributedComponent[] {
  if (components.length === 0) {
    return [];
  }

  const componentCents = components.map((component) =>
    Math.max(0, toCents(Number.isFinite(component.price) ? component.price : 0)),
  );
  const totalComponentsCents = componentCents.reduce((sum, cents) => sum + cents, 0);
  if (totalComponentsCents <= 0) {
    return components.map((component) => ({ priceTtc: 0, vatRate: sanitizeVatRate(component.vatRate) }));
  }

  const packPriceCents = Math.max(0, toCents(Number.isFinite(packPriceTtc) ? packPriceTtc : 0));
  const distributed = distributeCents(packPriceCents, componentCents);

  return components.map((component, index) => ({
    priceTtc: fromCents(distributed[index] ?? 0),
    vatRate: sanitizeVatRate(component.vatRate),
  }));
}

export function applyDiscountOnLines(
  lines: Array<{ lineTotal: number }>,
  discountAmount: number,
): number[] {
  const lineTotalsCents = lines.map((line) => Math.max(0, toCents(line.lineTotal)));
  const totalCents = lineTotalsCents.reduce((sum, value) => sum + value, 0);
  const targetDiscountCents = Math.max(0, Math.min(toCents(discountAmount), totalCents));
  const distributedDiscounts = distributeCents(targetDiscountCents, lineTotalsCents);

  return lineTotalsCents.map((lineTotalCents, index) =>
    fromCents(Math.max(0, lineTotalCents - (distributedDiscounts[index] ?? 0))),
  );
}

export function sanitizeOrderVatRate(value: unknown): VatRate {
  return sanitizeVatRate(value);
}
