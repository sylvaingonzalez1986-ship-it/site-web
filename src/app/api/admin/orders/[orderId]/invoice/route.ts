import PDFDocument from "pdfkit/js/pdfkit.standalone";
import { NextResponse } from "next/server";
import { denyIfNotAdminApi } from "@/lib/admin-guard";
import { readStoreByBackend } from "@/lib/data-backend";
import { INVOICE_COMPANY, INVOICE_SETTINGS, getInvoiceLegalFooter } from "@/lib/invoice-config";
import { issueInvoiceForOrder } from "@/lib/invoice-store";
import { isInvoiceEligibleOrder } from "@/lib/invoice-utils";
import { computeFromTtc, computeOrderTaxTotals, sanitizeOrderVatRate } from "@/lib/tax";

export const runtime = "nodejs";

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

export async function GET(
  _: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }

  const { orderId } = await params;
  const store = await readStoreByBackend();
  const order = store.orders.find((item) => item.id === orderId);

  if (!order) {
    return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
  }

  if (!isInvoiceEligibleOrder(order)) {
    return NextResponse.json(
      { error: "Facture indisponible tant que la commande n'est pas payee." },
      { status: 409 },
    );
  }

  const issuedInvoice = await issueInvoiceForOrder(order.id);

  const customerName = order.customerName?.trim() || "Client";
  const customerEmail = order.customerEmail?.trim() || "";
  const customerPhone = order.shippingPhone?.trim() || "";
  const shippingAddress = order.shippingAddress?.trim() || "";
  const shippingCity = order.shippingCity?.trim() || "";
  const shippingPostalCode = order.shippingPostalCode?.trim() || "";
  const shippingCountry = order.shippingCountry?.trim() || "";

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
  const vatBreakdown = Array.isArray(order.vatBreakdown) && order.vatBreakdown.length > 0
    ? order.vatBreakdown
    : fallbackTaxTotals.vatBreakdown;

  const doc = new PDFDocument({ size: "A4", margin: 48 });
  const pdfPromise = buildPdfBuffer(doc);

  doc.fontSize(17).text(INVOICE_COMPANY.legalName, { align: "left" });
  doc
    .fontSize(10)
    .text(INVOICE_COMPANY.legalForm)
    .text(INVOICE_COMPANY.addressLine)
    .text(`SIRET: ${INVOICE_COMPANY.siret}`)
    .text(`SIREN: ${INVOICE_COMPANY.siren}`)
    .text(`TVA: ${INVOICE_COMPANY.vatNumber}`)
    .text(`RCS: ${INVOICE_COMPANY.rcs}`)
    .text(`NAF: ${INVOICE_COMPANY.nafCode}`);

  doc.moveDown(1.1);
  doc.fontSize(14).text(`FACTURE N° ${issuedInvoice.invoiceNumber}`, { align: "left" });
  doc
    .fontSize(10)
    .text(`Date d'emission: ${formatDateFr(issuedInvoice.issuedAt)}`)
    .text(`Commande: ${order.id}`)
    .text(`Date commande: ${formatDateFr(order.createdAt)}`);

  doc.moveDown(1.1);
  doc.fontSize(12).text("Client");
  doc.fontSize(10).text(customerName);
  if (shippingAddress) {
    doc.text(shippingAddress);
  }
  const cityLine = [shippingPostalCode, shippingCity, shippingCountry].filter(Boolean).join(" ");
  if (cityLine) {
    doc.text(cityLine);
  }
  if (customerEmail) {
    doc.text(customerEmail);
  }
  if (customerPhone) {
    doc.text(customerPhone);
  }

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

  doc.moveTo(48, y).lineTo(547, y).stroke("#111111");
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

  doc.moveDown(2);
  doc.fontSize(9).text(getInvoiceLegalFooter(), { align: "left" });
  doc
    .fontSize(9)
    .text(`${INVOICE_COMPANY.legalName} - ${INVOICE_COMPANY.legalForm}`, { align: "left" })
    .text(`RCS ${INVOICE_COMPANY.rcs}`, { align: "left" });

  doc.end();
  const pdfBuffer = await pdfPromise;

  return new Response(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=\"facture-${issuedInvoice.invoiceNumber}.pdf\"`,
      "Cache-Control": "private, no-store",
    },
  });
}
