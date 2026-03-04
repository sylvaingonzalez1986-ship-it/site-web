import { describe, expect, it } from "vitest";

import {
  computeFromTtc,
  computeOrderTaxTotals,
  sanitizeOrderVatRate,
} from "@/lib/tax";
import type { OrderItem } from "@/types/store";

describe("tax", () => {
  it("computes HT and VAT from TTC at 20%", () => {
    expect(computeFromTtc(12, 20)).toEqual({ ht: 10, vat: 2 });
  });

  it("computes HT and VAT from TTC at 5.5%", () => {
    expect(computeFromTtc(10.55, 5.5)).toEqual({ ht: 10, vat: 0.55 });
  });

  it("returns TTC as HT when taxation is disabled", () => {
    expect(computeFromTtc(19.99, 20, { taxable: false })).toEqual({
      ht: 19.99,
      vat: 0,
    });
  });

  it("aggregates mixed VAT rates across order items", () => {
    const items: OrderItem[] = [
      {
        productId: "1",
        name: "A",
        unitPrice: 12,
        quantity: 1,
        lineTotal: 12,
        vatRate: 20,
        unitPriceHt: 10,
        lineTotalHt: 10,
        lineVatAmount: 2,
      },
      {
        productId: "2",
        name: "B",
        unitPrice: 10.55,
        quantity: 1,
        lineTotal: 10.55,
        vatRate: 5.5,
        unitPriceHt: 10,
        lineTotalHt: 10,
        lineVatAmount: 0.55,
      },
    ];

    expect(computeOrderTaxTotals(items)).toEqual({
      totalHt: 20,
      totalVat: 2.55,
      vatBreakdown: [
        { rate: 5.5, baseHt: 10, vatAmount: 0.55 },
        { rate: 20, baseHt: 10, vatAmount: 2 },
      ],
    });
  });

  it("returns TTC totals only when order is VAT exempt", () => {
    const items: OrderItem[] = [
      {
        productId: "1",
        name: "A",
        unitPrice: 12.34,
        quantity: 1,
        lineTotal: 12.34,
        vatRate: 20,
        unitPriceHt: 0,
        lineTotalHt: 0,
        lineVatAmount: 0,
      },
    ];

    expect(computeOrderTaxTotals(items, { taxable: false })).toEqual({
      totalHt: 12.34,
      totalVat: 0,
      vatBreakdown: [],
    });
  });

  it("sanitizes unsupported VAT rates to 20%", () => {
    expect(sanitizeOrderVatRate("17")).toBe(20);
    expect(sanitizeOrderVatRate(5.5)).toBe(5.5);
  });
});
