export const SUPPORT_CAMPAIGN_ID = "producer-support";
export const SUPPORT_STORAGE_KEY = "lcb-support-attempt-v1";
export const SUPPORT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const SUPPORT_TOKEN = /^[0-9a-f]{64}$/;

export class SupportError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export type SupportCampaign = {
  title: string; goalCents: number | null; minCents: number; maxCents: number;
  active: boolean; createdAt: string;
};
export type PublicSupport = { id: string; pseudonym: string; amountCents: number | null; paidAt: string };
export type SupportSummary = {
  campaign: SupportCampaign; collectedCents: number; contributionCount: number;
  feesCents: number | null;
  needsReconciliation: boolean; contributions: PublicSupport[]; nextOffset: number | null;
  checkoutAvailable: boolean; updatedAt: string;
};
export type SupportForm = { pseudonym: string; amountCents: number; publishName: boolean; publishAmount: boolean };
export type SupportAttempt = SupportForm & { id: string; token: string };
export type SupportStatus = {
  id: string; state: "creating" | "ready" | "uncertain" | "cancelled" | "paid" | "refunded" | "review";
  amountCents: number; refundedCents: number; checkoutUrl: string | null; expiresAt: string;
};
export type AdminSupportRow = {
  id: string; pseudonym: string; publishName: boolean; publishAmount: boolean;
  amountCents: number; capturedCents: number; refundedCents: number; feesCents: number | null;
  feeReference: string | null; feeUpdatedAt: string | null; feeUpdatedBy: string | null;
  createdAt: string; paidAt: string | null; orderCode: string | null; transactionId: string | null;
  sourceCode: string; checkoutState: string; reviewRequired: boolean; hidden: boolean;
};
export type AdminSupportDashboard = {
  campaign: SupportCampaign; configured: boolean; configurationError: string | null;
  rows: AdminSupportRow[]; total: number; page: number;
  totals: { capturedCents: number; refundedCents: number; feesCents: number; missingFees: number; reviewCount: number };
};

export const supportEuros = (cents: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);

/** Parse a decimal euro amount without rounding away extra decimals. */
export function parseSupportEuros(value: string): number | null {
  const match = /^(\d{1,8})(?:[,.](\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;
  const cents = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}

export function parseSupportForm(body: Record<string, unknown>): SupportForm {
  const pseudonym = typeof body.pseudonym === "string" ? body.pseudonym.normalize("NFC").trim() : "";
  if (!pseudonym || [...pseudonym].length > 32 || /[\p{Cc}\p{Cf}<>]/u.test(pseudonym)) {
    throw new SupportError("Choisis un pseudo de 1 à 32 caractères, sans balise ni caractère invisible.");
  }
  if (!Number.isSafeInteger(body.amountCents) || (body.amountCents as number) < 100 || (body.amountCents as number) > 100_000) {
    throw new SupportError("Choisis un montant entre 1 € et 1 000 €, avec deux décimales au maximum.");
  }
  if (typeof body.publishName !== "boolean" || typeof body.publishAmount !== "boolean") {
    throw new SupportError("Précise tes préférences d’affichage.");
  }
  return { pseudonym, amountCents: body.amountCents as number, publishName: body.publishName, publishAmount: body.publishAmount };
}

export function parseSupportIdentity(body: Record<string, unknown>) {
  if (typeof body.id !== "string" || !SUPPORT_UUID.test(body.id) || typeof body.token !== "string" || !SUPPORT_TOKEN.test(body.token)) {
    throw new SupportError("Référence de soutien invalide.");
  }
  return { id: body.id.toLowerCase(), token: body.token };
}

export function supportCsv(rows: AdminSupportRow[]): string {
  // Quotes alone do not prevent spreadsheet formula execution.
  const cell = (value: unknown) => {
    const text = value == null ? "" : String(value);
    return `"${(/^[\s]*[=+@-]/.test(text) ? "'" : "") + text.replaceAll('"', '""')}"`;
  };
  const euros = (cents: number | null) => cents === null ? "" : (cents / 100).toFixed(2).replace(".", ",");
  return "\uFEFF" + [
    ["Type", "Référence soutien", "Créé le", "Confirmé le", "Pseudo", "Source Viva", "Commande Viva", "Transaction Viva", "Demandé EUR", "Encaissé EUR", "Remboursé EUR", "Frais EUR", "Net après frais EUR", "Justificatif frais", "À rapprocher"],
    ...rows.map(row => ["SOUTIEN", row.id, row.createdAt, row.paidAt, row.pseudonym, row.sourceCode, row.orderCode, row.transactionId,
      euros(row.amountCents), euros(row.capturedCents), euros(row.refundedCents), euros(row.feesCents),
      euros(row.feesCents === null || row.reviewRequired ? null : row.capturedCents - row.refundedCents - row.feesCents), row.feeReference, row.reviewRequired ? "oui" : "non"]),
  ].map(row => row.map(cell).join(";")).join("\r\n");
}
