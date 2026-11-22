import type { KqCommerceReceipt } from "@/lib/kanab-quest-commerce";
import { formatKqCash } from "@/lib/kanab-quest-equipment";

export function KqSaleReceiptAmounts({ receipt, className }: { receipt: KqCommerceReceipt; className?: string }) {
  const rows = [
    { label: "Brut TTC", cents: receipt.payoutCents },
    { label: "TVA mise de côté", cents: receipt.vatCents, deduction: true },
    { label: "Analyses échues réglées", cents: receipt.labPaidCents, deduction: true },
    { label: "Électricité et soins réglés", cents: receipt.electricityPaidCents, deduction: true },
    { label: "Fournisseurs échus réglés", cents: receipt.supplierPaidCents, deduction: true },
    { label: "Factures restant à régler après la vente", cents: receipt.remainingInvoiceCents, balance: true },
  ];
  return <dl className={className}>{rows.map(({ label, cents, deduction, balance }) => <div key={label}>
    <dt>{label}</dt><dd data-sale-open-invoice-cents={balance ? cents : undefined}>{typeof cents === "number" ? `${deduction && cents > 0 ? "−" : ""}${formatKqCash(cents)}` : "Non renseigné"}</dd>
  </div>)}</dl>;
}
