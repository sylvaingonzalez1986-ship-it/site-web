import { describe, expect, it } from "vitest";
import { PDFDocument as PdfLibDocument } from "pdf-lib";
import { generateInvoicePdf } from "@/lib/invoice-pdf";
import { getInvoiceLegalFooter, INVOICE_CBD_DRIVING_NOTICE, INVOICE_CUSTOMER_THANK_YOU } from "@/lib/invoice-config";
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

const customer = {
  name: "Client Test",
  email: "client@example.com",
  phone: "0600000000",
  address: "1 rue du Test",
  city: "Quimper",
  postalCode: "29000",
  country: "France",
};

type ExtractedText = {
  text: string;
  page: number;
  x: number;
  top: number;
  width: number;
  height: number;
};

async function extractPdfText(buffer: Buffer): Promise<ExtractedText[]> {
  const { WorkerMessageHandler } = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  const workerGlobal = globalThis as typeof globalThis & {
    pdfjsWorker?: { WorkerMessageHandler: typeof WorkerMessageHandler };
  };
  workerGlobal.pdfjsWorker ??= { WorkerMessageHandler };
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = getDocument({ data: new Uint8Array(buffer), useSystemFonts: true });
  try {
    const document = await loadingTask.promise;
    const result: ExtractedText[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const height = page.view[3] - page.view[1];
      for (const item of content.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        result.push({
          text: item.str,
          page: pageNumber,
          x: item.transform[4],
          top: height - item.transform[5] - item.height,
          width: item.width,
          height: item.height,
        });
      }
    }
    return result;
  } finally {
    await loadingTask.destroy();
  }
}

function expectTextInsidePage(items: ExtractedText[]): void {
  for (const item of items) {
    expect(item.x, item.text).toBeGreaterThanOrEqual(47);
    expect(item.x + item.width, item.text).toBeLessThanOrEqual(549);
    expect(item.top, item.text).toBeGreaterThanOrEqual(42);
    expect(item.top + item.height, item.text).toBeLessThanOrEqual(794);
  }
}

function expectBefore(first: ExtractedText, second: ExtractedText): void {
  if (first.page === second.page) {
    expect(first.top + first.height).toBeLessThan(second.top);
  } else {
    expect(first.page).toBeLessThan(second.page);
  }
}

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
    const rawPdf = pdfBuffer.toString("latin1");

    expect(pdfBuffer.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.getPageCount()).toBe(1);
    expect(rawPdf).toContain("SpaceGrotesk");
    expect(rawPdf).toContain("BarlowCondensed");
  });

  it("keeps a typical multi-item invoice and both messages on one A4 page", async () => {
    const items = Array.from({ length: 8 }, (_, index) => ({
      ...order.items[0],
      productId: `cbd-test-${index + 1}`,
      name: `Fleur CBD artisanale ${index + 1}`,
    }));
    const pdfBuffer = await generateInvoicePdf(
      { ...order, items, itemsCount: items.length },
      issuedInvoice,
      {
        name: "Client Test",
        email: "client@example.com",
        phone: "0600000000",
        address: "1 rue du Test",
        city: "Quimper",
        postalCode: "29000",
        country: "France",
      },
    );
    const pdf = await PdfLibDocument.load(pdfBuffer);

    expect(pdf.getPageCount()).toBe(1);
  });
});

describe("invoice PDF personal message", () => {
  it.each([undefined, "", "  \r\n  "])("omits the personal message block for %j", async (personalMessage) => {
    const buffer = await generateInvoicePdf(order, issuedInvoice, customer, { personalMessage });
    const text = await extractPdfText(buffer);

    expect(text.some((item) => item.text.includes("Un petit mot pour vous"))).toBe(false);
    expect((await PdfLibDocument.load(buffer)).getPageCount()).toBe(1);
  });

  it("preserves French accents and line breaks between the totals and existing notices", async () => {
    const lines = ["Merci Élodie pour votre fidélité !", "À bientôt à Quimper,", "Sylvain"];
    const buffer = await generateInvoicePdf(order, issuedInvoice, customer, {
      personalMessage: lines.join("\r\n"),
    });
    const text = await extractPdfText(buffer);
    const findText = (value: string) => {
      const item = text.find((entry) => entry.text === value);
      expect(item, value).toBeDefined();
      return item!;
    };

    const footer = findText(getInvoiceLegalFooter());
    const title = findText("Un petit mot pour vous");
    const messageLines = lines.map(findText);
    const thankYou = findText(INVOICE_CUSTOMER_THANK_YOU.title);
    expectBefore(footer, title);
    expectBefore(title, messageLines[0]);
    expectBefore(messageLines[0], messageLines[1]);
    expectBefore(messageLines[1], messageLines[2]);
    expectBefore(messageLines[2], thankYou);
    expect(text.some((item) => item.text.includes(issuedInvoice.invoiceNumber))).toBe(true);
    findText(INVOICE_CBD_DRIVING_NOTICE.title);
    expectTextInsidePage(text);
  });

  it("wraps a 1,000-character word without dropping text or crossing the page edges", async () => {
    const personalMessage = "é".repeat(1_000);
    const buffer = await generateInvoicePdf(order, issuedInvoice, customer, { personalMessage });
    const text = await extractPdfText(buffer);
    const messageLines = text.filter((item) => /^é+$/.test(item.text));

    expect(messageLines.length).toBeGreaterThan(1);
    expect(messageLines.map((item) => item.text).join("")).toBe(personalMessage);
    expectTextInsidePage(text);
  });

  it("moves a 20-line message onto a new page when the invoice table leaves too little space", async () => {
    const items = Array.from({ length: 20 }, (_, index) => ({
      ...order.items[0],
      productId: `product-${index}`,
      name: `Fleur du producteur ${index + 1}`,
    }));
    const lines = Array.from({ length: 20 }, (_, index) => `Message personnel, ligne ${index + 1}.`);
    const buffer = await generateInvoicePdf(
      { ...order, items, itemsCount: items.length },
      issuedInvoice,
      customer,
      { personalMessage: lines.join("\n") },
    );
    const text = await extractPdfText(buffer);
    const footer = text.find((item) => item.text === getInvoiceLegalFooter())!;
    const title = text.find((item) => item.text === "Un petit mot pour vous")!;
    const messageLines = lines.map((line) => text.find((item) => item.text === line));
    const thankYou = text.find((item) => item.text === INVOICE_CUSTOMER_THANK_YOU.title)!;

    expect(title.page).toBeGreaterThan(footer.page);
    expect(messageLines.every(Boolean)).toBe(true);
    expectBefore(title, messageLines[0]!);
    expectBefore(messageLines.at(-1)!, thankYou);
    expectTextInsidePage(text);
  });

  it.each([31, 65])("keeps all rows, totals and the personal message readable on a %i-item invoice", async (itemCount) => {
    const items = Array.from({ length: itemCount }, (_, index) => ({
      ...order.items[0],
      productId: `product-${index}`,
      name: `Article facture ${index + 1}`,
    }));
    const buffer = await generateInvoicePdf(
      { ...order, items, itemsCount: items.length },
      issuedInvoice,
      customer,
      { personalMessage: "Merci pour cette belle commande !" },
    );
    const text = await extractPdfText(buffer);
    const lastArticle = text.find((item) => item.text === `Article facture ${itemCount}`)!;
    const subtotal = text.find((item) => item.text === "Sous-total TTC")!;
    const footer = text.find((item) => item.text === getInvoiceLegalFooter())!;
    const message = text.find((item) => item.text === "Merci pour cette belle commande !")!;

    expect(text.filter((item) => /^Article facture \d+$/.test(item.text))).toHaveLength(items.length);
    expectBefore(lastArticle, subtotal);
    expectBefore(subtotal, footer);
    expectBefore(footer, message);
    expect(text.some((item) => item.text === INVOICE_CBD_DRIVING_NOTICE.title)).toBe(true);
    expectTextInsidePage(text);
  });
});
