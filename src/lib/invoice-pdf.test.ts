import { describe, expect, it } from "vitest";
import { PDFDocument as PdfLibDocument } from "pdf-lib";
import { generateInvoicePdf } from "@/lib/invoice-pdf";
import type { IssuedInvoice } from "@/types/invoice";
import type { CmsOrder } from "@/types/store";

const order: CmsOrder = {
  id: "ORD-CBD-NOTICE-001",
  createdAt: "2026-08-17T12:00:00.000Z",
  status: "paid",
  paymentProvider: "viva",
  paymentState: "paid",
  source: "web",
  itemsCount: 1,
  totalHt: 10,
  totalVat: 2,
  vatBreakdown: [{ rate: 20, baseHt: 10, vatAmount: 2 }],
  totalAmount: 12,
  deliveryFee: 0,
  items: [
    {
      productId: "cbd-test",
      name: "Fleur CBD test",
      unitPrice: 12,
      quantity: 1,
      lineTotal: 12,
      vatRate: 20,
      unitPriceHt: 10,
      lineTotalHt: 10,
      lineVatAmount: 2,
    },
  ],
};

const issuedInvoice: IssuedInvoice = {
  orderId: order.id,
  invoiceNumber: "2026-000001",
  sequence: 1,
  issuedAt: "2026-08-17T12:05:00.000Z",
};

describe("invoice PDF CBD notice", () => {
  it("generates a valid one-page invoice with room for the driving notice", async () => {
    const pdfBuffer = await generateInvoicePdf(order, issuedInvoice, {
      name: "Client Test",
      email: "client@example.com",
      phone: "0600000000",
      address: "1 rue du Test",
      city: "Quimper",
      postalCode: "29000",
      country: "France",
    });
    const pdf = await PdfLibDocument.load(pdfBuffer);

    expect(pdfBuffer.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.getPageCount()).toBe(1);
  });
});
