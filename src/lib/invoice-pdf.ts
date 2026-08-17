import type { CmsOrder } from "@/types/store";
import type { IssuedInvoice } from "@/types/invoice";
import {
  INVOICE_CBD_DRIVING_NOTICE,
  INVOICE_COMPANY,
  INVOICE_CUSTOMER_THANK_YOU,
  INVOICE_SETTINGS,
  getInvoiceLegalFooter,
} from "@/lib/invoice-config";
import { computeFromTtc, computeOrderTaxTotals, sanitizeOrderVatRate } from "@/lib/tax";
import { readFile } from "node:fs/promises";
import path from "node:path";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export type InvoiceCustomerInfo = {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function formatMoney(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: INVOICE_SETTINGS.defaultCurrency,
  }).format(value);
}

function formatDateFr(value: string): string {
  return new Date(value).toLocaleDateString("fr-FR");
}

function buildPdfBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

/** Dark navy ink — avoids pure black so the PDF prints correctly on
 *  printers that only have colour cartridges installed. */
const INK_COLOR = "#00205B";
const INVOICE_LOGO_PATH = path.join(process.cwd(), "public", "invoice-logo.png");
const INVOICE_THANK_YOU_IMAGE_PATH = path.join(
  process.cwd(),
  "public",
  "invoice-sylvain-thank-you-v1.png",
);

let invoiceLogoDataUriPromise: Promise<string | null> | null = null;
let invoiceThankYouImageDataUriPromise: Promise<string | null> | null = null;

async function tintLogoDataUri(logoBuffer: Buffer, color: string): Promise<string> {
  const { createCanvas, loadImage } = await import("@napi-rs/canvas");
  const logo = await loadImage(logoBuffer);
  const canvas = createCanvas(logo.width, logo.height);
  const context = canvas.getContext("2d");

  context.drawImage(logo, 0, 0);
  context.globalCompositeOperation = "source-in";
  context.fillStyle = color;
  context.fillRect(0, 0, logo.width, logo.height);

  const tintedLogoBuffer = await canvas.encode("png");
  return `data:image/png;base64,${tintedLogoBuffer.toString("base64")}`;
}

async function getInvoiceLogoDataUri(): Promise<string | null> {
  invoiceLogoDataUriPromise ??= readFile(INVOICE_LOGO_PATH)
    .then(async (logoBuffer) => {
      try {
        return await tintLogoDataUri(logoBuffer, INK_COLOR);
      } catch {
        return `data:image/png;base64,${logoBuffer.toString("base64")}`;
      }
    })
    .catch(() => null);
  return invoiceLogoDataUriPromise;
}

async function getInvoiceThankYouImageDataUri(): Promise<string | null> {
  invoiceThankYouImageDataUriPromise ??= readFile(INVOICE_THANK_YOU_IMAGE_PATH)
    .then((imageBuffer) => `data:image/png;base64,${imageBuffer.toString("base64")}`)
    .catch(() => null);
  return invoiceThankYouImageDataUriPromise;
}

/* ------------------------------------------------------------------ */
/*  PDF generation – PDFKit is lazy-loaded at first call              */
/* ------------------------------------------------------------------ */

/**
 * Generate a professional French invoice PDF buffer for the given order.
 *
 * PDFKit is loaded dynamically so that `pdfkit/js/pdfkit.standalone`
 * is never evaluated at build time — this avoids the Node.js
 * `--localstorage-file` deprecation warning emitted during
 * Next.js "Collecting page data" workers.
 */
export async function generateInvoicePdf(
  order: CmsOrder,
  issuedInvoice: IssuedInvoice,
  customer: InvoiceCustomerInfo,
): Promise<Buffer> {
  // Lazy-load PDFKit — only imported at runtime, never at build time.
  const { default: PDFDocument } = await import("pdfkit/js/pdfkit.standalone");

  /* ---------- computed amounts ---------- */

  const itemsSubTotalTtc = Number(
    order.items.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2),
  );
  const deliveryFee = Number.isFinite(order.deliveryFee)
    ? Number((order.deliveryFee ?? 0).toFixed(2))
    : 0;
  const discountAmount = Number.isFinite(order.discountAmount)
    ? Number((order.discountAmount ?? 0).toFixed(2))
    : 0;
  const totalTtc = Number(order.totalAmount.toFixed(2));

  const fallbackTaxTotals = computeOrderTaxTotals(order.items, {
    taxable: INVOICE_SETTINGS.vatMode === "taxable",
  });
  const totalHt = Number.isFinite(order.totalHt)
    ? Number(order.totalHt.toFixed(2))
    : fallbackTaxTotals.totalHt;
  const totalVat = Number.isFinite(order.totalVat)
    ? Number(order.totalVat.toFixed(2))
    : fallbackTaxTotals.totalVat;
  const vatBreakdown =
    Array.isArray(order.vatBreakdown) && order.vatBreakdown.length > 0
      ? order.vatBreakdown
      : fallbackTaxTotals.vatBreakdown;

  /* ---------- build PDF ---------- */

  const doc = new PDFDocument({ size: "A4", margin: 48 });
  doc.fillColor(INK_COLOR);
  const pdfPromise = buildPdfBuffer(doc);

  // --- Company header ---
  const [logoDataUri, thankYouImageDataUri] = await Promise.all([
    getInvoiceLogoDataUri(),
    getInvoiceThankYouImageDataUri(),
  ]);
  const headerTop = 42;
  const logoSize = 76;
  const logoX = 48;
  const companyX = logoDataUri ? logoX + logoSize + 18 : logoX;
  const companyY = logoDataUri ? headerTop + 18 : headerTop;

  if (logoDataUri) {
    doc.image(logoDataUri, logoX, headerTop, {
      fit: [logoSize, logoSize],
    });
  }

  doc.font("Helvetica-Bold").fontSize(17).text(INVOICE_COMPANY.legalName, companyX, companyY, {
    align: "left",
  });
  doc
    .font("Helvetica")
    .fontSize(10)
    .text(`SIRET: ${INVOICE_COMPANY.siret}`, companyX, doc.y + 4, { align: "left" });
  doc.y = Math.max(doc.y, headerTop + logoSize + 14);

  // --- Invoice meta ---
  doc.moveDown(1.1);
  doc.fontSize(14).text(`FACTURE N° ${issuedInvoice.invoiceNumber}`, { align: "left" });
  doc
    .fontSize(10)
    .text(`Date d'emission: ${formatDateFr(issuedInvoice.issuedAt)}`)
    .text(`Commande: ${order.id}`)
    .text(`Date commande: ${formatDateFr(order.createdAt)}`);

  // --- Customer block ---
  doc.moveDown(1.1);
  doc.fontSize(12).text("Client");
  doc.fontSize(10).text(customer.name);
  if (customer.address) {
    doc.text(customer.address);
  }
  const cityLine = [customer.postalCode, customer.city, customer.country]
    .filter(Boolean)
    .join(" ");
  if (cityLine) {
    doc.text(cityLine);
  }
  if (customer.email) {
    doc.text(customer.email);
  }
  if (customer.phone) {
    doc.text(customer.phone);
  }

  // --- Line items ---
  doc.moveDown(1.2);
  doc.fontSize(12).text("Detail des articles");
  doc.moveDown(0.4);

  const startY = doc.y;
  const xDesignation = 50;
  const xQty = 300;
  const xUnitHt = 345;
  const xRate = 430;
  const xTotalHt = 485;
  doc.fontSize(10).text("Designation", xDesignation, startY);
  doc.text("Qte", xQty, startY);
  doc.text("P.U. HT", xUnitHt, startY);
  doc.text("TVA", xRate, startY);
  doc.text("Total HT", xTotalHt, startY);

  let y = startY + 18;
  for (const item of order.items) {
    const itemVatRate = sanitizeOrderVatRate(item.vatRate);
    const displayName = item.parentPackName
      ? `${item.name} (Pack: ${item.parentPackName})`
      : item.name;
    const fallbackSplit = computeFromTtc(item.lineTotal, itemVatRate, {
      taxable: INVOICE_SETTINGS.vatMode === "taxable",
    });
    const itemUnitHt = Number.isFinite(item.unitPriceHt)
      ? item.unitPriceHt
      : Number((fallbackSplit.ht / Math.max(item.quantity, 1)).toFixed(2));
    const itemLineHt = Number.isFinite(item.lineTotalHt)
      ? item.lineTotalHt
      : fallbackSplit.ht;
    doc.text(displayName, xDesignation, y, { width: 265 });
    doc.text(String(item.quantity), xQty, y);
    doc.text(formatMoney(itemUnitHt), xUnitHt, y);
    doc.text(`${itemVatRate.toFixed(1)}%`, xRate, y);
    doc.text(formatMoney(itemLineHt), xTotalHt, y);
    y += 18;
  }

  // --- Totals ---
  doc.moveTo(48, y).lineTo(547, y).strokeColor(INK_COLOR).stroke();
  y += 10;
  doc.text("Sous-total TTC", xUnitHt - 10, y, { width: 120 });
  doc.text(formatMoney(itemsSubTotalTtc), xTotalHt, y);
  y += 16;

  if (discountAmount > 0) {
    const discountLabel = order.promoCode
      ? `Remise promo incluse (${order.promoCode}${order.discountPercent ? ` - ${order.discountPercent}%` : ""})`
      : "Remise promo incluse";
    doc.text(discountLabel, xUnitHt - 90, y, { width: 210 });
    doc.text(`-${formatMoney(discountAmount)}`, xTotalHt, y);
    y += 16;
  }

  doc.text("Livraison", xUnitHt - 10, y, { width: 120 });
  doc.text(deliveryFee > 0 ? formatMoney(deliveryFee) : "Offerte", xTotalHt, y);
  y += 16;

  if (INVOICE_SETTINGS.vatMode === "taxable") {
    doc.text("Total HT", xUnitHt - 10, y, { width: 120 });
    doc.text(formatMoney(totalHt), xTotalHt, y);
    y += 16;
    for (const vatLine of vatBreakdown) {
      doc.text(`TVA ${vatLine.rate}%`, xUnitHt - 10, y, { width: 120 });
      doc.text(formatMoney(vatLine.vatAmount), xTotalHt, y);
      y += 16;
    }
    doc.text("Total TVA", xUnitHt - 10, y, { width: 120 });
    doc.text(formatMoney(totalVat), xTotalHt, y);
    y += 16;
    doc.font("Helvetica-Bold").text("Total TTC", xUnitHt - 10, y, { width: 120 });
    doc.text(formatMoney(totalTtc), xTotalHt, y);
    doc.font("Helvetica");
  } else {
    doc.font("Helvetica-Bold").text("Total", xUnitHt - 10, y, { width: 120 });
    doc.text(formatMoney(totalTtc), xTotalHt, y);
    doc.font("Helvetica");
  }

  // --- Customer thank-you and CBD driving notice ---
  const messageX = 48;
  const messageWidth = 499;
  const messagePadding = 12;
  const messageTextWidth = messageWidth - messagePadding * 2;
  const thankYouImageSize = thankYouImageDataUri ? 66 : 0;
  const thankYouImageGap = thankYouImageDataUri ? 12 : 0;
  const thankYouTextWidth = messageTextWidth - thankYouImageSize - thankYouImageGap;
  doc.font("Helvetica").fontSize(8.8);
  const thankYouBodyHeight = doc.heightOfString(INVOICE_CUSTOMER_THANK_YOU.body, {
    width: thankYouTextWidth,
    lineGap: 1.5,
  });
  const thankYouContentHeight = Math.max(thankYouImageSize, 13 + 7 + thankYouBodyHeight);
  const thankYouHeight = messagePadding + thankYouContentHeight + messagePadding;

  const noticeBody = INVOICE_CBD_DRIVING_NOTICE.paragraphs
    .map((paragraph) => `- ${paragraph}`)
    .join("\n");

  doc.font("Helvetica").fontSize(8.2);
  const noticeBodyHeight = doc.heightOfString(noticeBody, {
    width: messageTextWidth,
    lineGap: 1.5,
  });
  doc.font("Helvetica").fontSize(7.2);
  const noticeSourceHeight = doc.heightOfString(INVOICE_CBD_DRIVING_NOTICE.source, {
    width: messageTextWidth,
  });
  const noticeHeight =
    messagePadding + 13 + 7 + noticeBodyHeight + 7 + noticeSourceHeight + messagePadding;
  const pageBottom = doc.page.height - 48;
  const messageGap = 12;
  let thankYouY = Math.max(doc.y + 22, y + 36);

  if (thankYouY + thankYouHeight + messageGap + noticeHeight + 34 > pageBottom) {
    doc.addPage();
    doc.fillColor(INK_COLOR);
    thankYouY = 48;
  }

  doc.save();
  doc
    .roundedRect(messageX, thankYouY, messageWidth, thankYouHeight, 8)
    .fillAndStroke("#E7F3EC", "#006F70");
  if (thankYouImageDataUri) {
    doc.image(thankYouImageDataUri, messageX + messagePadding, thankYouY + messagePadding, {
      fit: [thankYouImageSize, thankYouImageSize],
    });
  }
  const thankYouTextX =
    messageX + messagePadding + thankYouImageSize + thankYouImageGap;
  doc
    .fillColor("#006F70")
    .font("Helvetica-Bold")
    .fontSize(10.5)
    .text(INVOICE_CUSTOMER_THANK_YOU.title, thankYouTextX, thankYouY + messagePadding + 2, {
      width: thankYouTextWidth,
      align: "left",
    });
  doc
    .fillColor(INK_COLOR)
    .font("Helvetica-Oblique")
    .fontSize(8.8)
    .text(
      INVOICE_CUSTOMER_THANK_YOU.body,
      thankYouTextX,
      thankYouY + messagePadding + 22,
      {
        width: thankYouTextWidth,
        align: "left",
        lineGap: 1.5,
      },
    );
  doc.restore();

  const noticeY = thankYouY + thankYouHeight + messageGap;
  doc.save();
  doc
    .roundedRect(messageX, noticeY, messageWidth, noticeHeight, 8)
    .fillAndStroke("#FFF4D6", INK_COLOR);
  doc
    .fillColor(INK_COLOR)
    .font("Helvetica-Bold")
    .fontSize(10)
    .text(INVOICE_CBD_DRIVING_NOTICE.title, messageX + messagePadding, noticeY + messagePadding, {
      width: messageTextWidth,
    });
  let noticeTextY = noticeY + messagePadding + 20;
  doc
    .font("Helvetica")
    .fontSize(8.2)
    .text(noticeBody, messageX + messagePadding, noticeTextY, {
      width: messageTextWidth,
      lineGap: 1.5,
    });
  noticeTextY += noticeBodyHeight + 7;
  doc
    .font("Helvetica-Oblique")
    .fontSize(7.2)
    .text(INVOICE_CBD_DRIVING_NOTICE.source, messageX + messagePadding, noticeTextY, {
      width: messageTextWidth,
    });
  doc.restore();
  doc.y = noticeY + noticeHeight + 14;

  // --- Legal footer ---
  doc.fillColor(INK_COLOR).font("Helvetica").fontSize(9).text(getInvoiceLegalFooter(), {
    align: "left",
  });

  doc.end();
  return pdfPromise;
}

/**
 * Build a standard invoice PDF `Response` with proper headers.
 */
export async function buildInvoiceResponse(
  order: CmsOrder,
  issuedInvoice: IssuedInvoice,
  customer: InvoiceCustomerInfo,
): Promise<Response> {
  const pdfBuffer = await generateInvoicePdf(order, issuedInvoice, customer);

  return new Response(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=\"facture-${issuedInvoice.invoiceNumber}.pdf\"`,
      "Cache-Control": "private, no-store",
    },
  });
}
