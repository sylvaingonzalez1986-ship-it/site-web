import type { SwissBitcoinPaymentSummary } from "@/lib/swiss-bitcoin-pay-types";
import type { CmsOrder } from "@/types/store";

export function escapeOrderCsvCell(value: string | number): string {
  // Quoting alone does not prevent a spreadsheet from executing a formula.
  const text = String(value);
  const neutralized = typeof value === "string" && /^(?:\s*[=+@-]|[\t\r\n])/.test(text)
    ? `'${text}`
    : text;
  return `"${neutralized.replaceAll('"', '""')}"`;
}

type PaymentHistory = Record<string, SwissBitcoinPaymentSummary[]>;

export function buildBitcoinPaymentsCsv(orders: CmsOrder[], history: PaymentHistory): string {
  const columns = [
    "order_id", "order_total_eur_ttc", "order_payment_provider", "invoice_id", "invoice_expected_eur",
    "paid_sats", "payment_state", "provider_status", "invoice_created_at", "invoice_expires_at",
    "paid_at", "last_checked_at", "review_reason", "conversion", "fees", "settlement",
  ];
  const rows = orders.flatMap((order) => (history[order.id] ?? []).map((payment) => [
    order.id,
    order.totalAmount.toFixed(2),
    order.paymentProvider,
    payment.invoiceId ?? "",
    (payment.expectedEurMinor / 100).toFixed(2),
    payment.paidSats ?? "",
    payment.state,
    payment.providerStatus ?? "",
    payment.createdAt,
    payment.expiresAt ?? "",
    payment.paidAt ?? "",
    payment.lastCheckedAt ?? "",
    payment.issue ?? "",
    "indisponible",
    "indisponible",
    "indisponible",
  ].map(escapeOrderCsvCell).join(",")));
  return [columns.join(","), ...rows].join("\n");
}
