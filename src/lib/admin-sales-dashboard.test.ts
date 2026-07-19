import { describe, expect, it } from "vitest";

import { buildAdminProductSalesDashboard } from "@/lib/admin-sales-dashboard";

describe("admin sales dashboard", () => {
  it("counts realized order items by product across all time, weeks and months", () => {
    const dashboard = buildAdminProductSalesDashboard({
      generatedAt: "2026-05-10T12:00:00.000Z",
      products: [
        { id: "p1", name: "Fleur Test", category: "fleurs" },
        { id: "p2", name: "Huile Test", category: "huiles" },
      ],
      orders: [
        {
          id: "paid-1",
          createdAt: "2026-05-06T10:00:00.000Z",
          paymentState: "paid",
          status: "paid",
        },
        {
          id: "paid-2",
          createdAt: "2026-05-12T10:00:00.000Z",
          paymentState: "not_configured",
          status: "paid",
        },
        {
          id: "pending-1",
          createdAt: "2026-05-13T10:00:00.000Z",
          paymentState: "pending",
          status: "pending_payment",
        },
        {
          id: "cancelled-1",
          createdAt: "2026-05-14T10:00:00.000Z",
          paymentState: "paid",
          status: "cancelled",
        },
      ],
      orderItems: [
        {
          orderId: "paid-1",
          productId: "p1",
          name: "Ancien nom",
          quantity: 2,
          lineTotal: 24,
          lineTotalHt: 20,
          lineVatAmount: 4,
          vatRate: 20,
        },
        {
          orderId: "paid-2",
          productId: "p1",
          name: "Fleur Test",
          quantity: 1,
          lineTotal: 12,
          lineTotalHt: 10,
          lineVatAmount: 2,
          vatRate: 20,
        },
        {
          orderId: "paid-2",
          productId: "p2",
          name: "Huile Test",
          quantity: 1,
          lineTotal: 10.55,
          vatRate: 5.5,
        },
        {
          orderId: "pending-1",
          productId: "p1",
          name: "Fleur Test",
          quantity: 10,
          lineTotal: 120,
          vatRate: 20,
        },
        {
          orderId: "cancelled-1",
          productId: "p1",
          name: "Fleur Test",
          quantity: 10,
          lineTotal: 120,
          vatRate: 20,
        },
      ],
    });

    expect(dashboard.allTime.ordersCount).toBe(2);
    expect(dashboard.allTime.quantitySold).toBe(4);
    expect(dashboard.allTime.revenueTtc).toBe(46.55);
    expect(dashboard.allTime.revenueHt).toBe(40);
    expect(dashboard.allTime.vatAmount).toBe(6.55);
    expect(dashboard.allTime.products).toMatchObject([
      {
        productId: "p1",
        productName: "Fleur Test",
        category: "fleurs",
        isCurrentProduct: true,
        quantitySold: 3,
        ordersCount: 2,
        revenueTtc: 36,
      },
      {
        productId: "p2",
        productName: "Huile Test",
        category: "huiles",
        isCurrentProduct: true,
        quantitySold: 1,
        ordersCount: 1,
        revenueTtc: 10.55,
      },
    ]);
    expect(dashboard.byWeek.map((week) => week.periodKey)).toEqual(["2026-W20", "2026-W19"]);
    expect(dashboard.byMonth).toHaveLength(1);
    expect(dashboard.byMonth[0]).toMatchObject({
      periodKey: "2026-05",
      quantitySold: 4,
      ordersCount: 2,
    });
  });

  it("keeps historical products and skips free lottery gift lines", () => {
    const dashboard = buildAdminProductSalesDashboard({
      generatedAt: "2026-05-10T12:00:00.000Z",
      products: [],
      orders: [
        {
          id: "paid-1",
          createdAt: "2026-05-06T10:00:00.000Z",
          paymentState: "paid",
          status: "paid",
        },
      ],
      orderItems: [
        {
          orderId: "paid-1",
          productId: "deleted-product",
          name: "Produit supprime",
          quantity: 1,
          lineTotal: 15,
          vatRate: 20,
        },
        {
          orderId: "paid-1",
          productId: "gift-reward-123",
          name: "Lot ticket: Cadeau",
          quantity: 1,
          lineTotal: 0,
          vatRate: 20,
        },
      ],
    });

    expect(dashboard.allTime.products).toHaveLength(1);
    expect(dashboard.allTime.products[0]).toMatchObject({
      productId: "deleted-product",
      productName: "Produit supprime",
      isCurrentProduct: false,
      quantitySold: 1,
      revenueTtc: 15,
    });
  });
});
