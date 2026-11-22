import "server-only";

import { createHash } from "node:crypto";
import { inspectSwissBitcoinInvoice, isSwissBitcoinSupportEnabled, swissBitcoinInvoicePage } from "@/lib/swiss-bitcoin-pay";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import { buildVivaCheckoutUrl, getVivaConfig, type VivaConfig, type VivaVerifiedTransaction } from "@/lib/viva-payment";
import { SupportError, type AdminSupportDashboard, type AdminSupportRow, type SupportAttempt, type SupportCampaign, type SupportProvider, type SupportStatus, type SupportSummary } from "@/lib/support-campaign";

export type SupportRecord = {
  id: string; pseudonym: string; amount_cents: number; publish_name: boolean; publish_amount: boolean;
  source_code: string; order_code: string | null; transaction_id: string | null; paid_at: string | null;
  checkout_state: "creating" | "ready" | "uncertain" | "cancelled" | "expired"; expires_at: string; review_required: boolean;
  provider?: SupportProvider; invoice_id?: string | null; provider_issue?: string | null;
  last_checked_at?: string | null; created_at?: string;
  support_reversals?: { amount_cents: number }[];
};
const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const recordColumns = "id,pseudonym,amount_cents,publish_name,publish_amount,source_code,order_code,transaction_id,paid_at,checkout_state,expires_at,review_required,provider,invoice_id,provider_issue,last_checked_at,created_at,support_reversals(amount_cents)";

export function getSupportVivaConfig(): VivaConfig {
  const base = getVivaConfig();
  const sourceCode = process.env.VIVA_SUPPORT_SOURCE_CODE?.trim() ?? "";
  const configurationError = !sourceCode ? "Configurer VIVA_SUPPORT_SOURCE_CODE avec la source Viva dédiée aux soutiens."
    : sourceCode === base.sourceCode ? "La source Soutiens doit être distincte de la source Boutique."
    : base.configurationError;
  return { ...base, sourceCode, configurationError, isConfigured: !configurationError };
}

export function getConfiguredSupportProviders(): SupportProvider[] {
  const providers: SupportProvider[] = [];
  if (getSupportVivaConfig().isConfigured) providers.push("viva");
  if (isSwissBitcoinSupportEnabled()) providers.push("swiss-bitcoin-pay");
  return providers;
}

function check(error: { code?: string; message: string } | null) {
  if (!error) return;
  const messages: Record<string, [string, number]> = {
    support_closed: ["La cagnotte n’accepte pas de nouveaux soutiens pour le moment.", 409],
    support_conflict: ["Cette tentative existe déjà avec une autre fiche. Reprends la fiche enregistrée.", 409],
    support_amount: ["Ce montant n’est pas accepté par la cagnotte.", 400],
    support_invalid: ["Les informations du soutien sont invalides.", 400],
    support_not_found: ["Soutien introuvable.", 404],
    support_already_paid: ["Ce soutien a déjà été payé. Vérifie son état avant de recommencer.", 409],
    support_payment_mismatch: ["Les références du paiement ne correspondent pas au soutien.", 409],
    support_payment_pending: ["Le paiement est encore en cours de vérification.", 409],
    support_refund_exceeds_payment: ["Le remboursement nécessite un rapprochement manuel.", 409],
  };
  const match = Object.entries(messages).find(([key]) => error.message.includes(key));
  if (match) throw new SupportError(...match[1]);
  // Never expose SQL details or provider payloads through public endpoints.
  console.error("[support] Database operation failed", error.code ?? "unknown");
  throw new SupportError("La cagnotte est momentanément indisponible. Réessaie dans quelques instants.", 503);
}

export async function getSupportSummary(offset = 0): Promise<SupportSummary> {
  const result = await createSupabaseServiceClient().rpc("rpc_support_public_summary", { p_offset: offset });
  check(result.error);
  if (!result.data) throw new SupportError("La cagnotte est momentanément indisponible.", 503);
  const providers = result.data.campaign.active ? getConfiguredSupportProviders() : [];
  return { ...result.data, providers, checkoutAvailable: providers.length > 0 };
}

export async function beginSupportCheckout(attempt: SupportAttempt, source: string): Promise<{ created: boolean; contribution: SupportRecord }> {
  const result = await createSupabaseServiceClient().rpc("rpc_begin_support_checkout", {
    p_id: attempt.id, p_token_hash: hash(attempt.token), p_pseudonym: attempt.pseudonym, p_amount: attempt.amountCents,
    p_publish_name: attempt.publishName, p_publish_amount: attempt.publishAmount, p_source: source, p_provider: attempt.provider ?? "viva",
  });
  check(result.error);
  return result.data;
}

export async function setSupportCheckoutState(id: string, state: "ready" | "uncertain" | "cancelled", order: string | null = null) {
  const result = await createSupabaseServiceClient().rpc("rpc_support_checkout_state", { p_id: id, p_state: state, p_order: order });
  check(result.error);
}

export async function findSupportByOrder(order: string): Promise<SupportRecord | null> {
  const result = await createSupabaseServiceClient().from("support_contributions").select(recordColumns).eq("order_code", order).maybeSingle();
  check(result.error);
  return result.data as SupportRecord | null;
}

export async function findSupportBySwissInvoice(invoiceId: string): Promise<SupportRecord | null> {
  const result = await createSupabaseServiceClient().from("support_contributions").select(recordColumns)
    .eq("provider", "swiss-bitcoin-pay").eq("invoice_id", invoiceId).maybeSingle();
  check(result.error);
  return result.data as SupportRecord | null;
}

export async function setSupportSwissCheckout(id: string, invoiceId: string | null) {
  const result = await createSupabaseServiceClient().rpc("rpc_support_swiss_checkout", { p_id: id, p_invoice: invoiceId });
  check(result.error);
}

export async function recordSupportSwissCreationRefusal(id: string) {
  const result = await createSupabaseServiceClient().rpc("rpc_support_swiss_creation_refused", { p_id: id });
  check(result.error);
}

export async function observeSupportSwissInvoice(id: string, invoiceId: string, observed: ReturnType<typeof inspectSwissBitcoinInvoice>) {
  const result = await createSupabaseServiceClient().rpc("rpc_support_swiss_observe", {
    p_id: id, p_invoice: invoiceId, p_state: observed.state, p_amount: observed.eurMinor, p_currency: observed.currency,
    p_status: observed.providerStatus, p_expires: observed.expiresAt, p_paid: observed.paidAt, p_issue: observed.issue,
  });
  check(result.error);
}

export async function claimSupportSwissChecks(): Promise<{ id: string; invoice_id: string; amount_cents: number }[]> {
  const result = await createSupabaseServiceClient().rpc("rpc_claim_support_swiss_checks");
  check(result.error);
  return result.data;
}

export async function acknowledgeSupportSwissLate(id: string, invoiceId: string, actor: string) {
  const result = await createSupabaseServiceClient().rpc("rpc_ack_support_swiss_late", { p_id: id, p_invoice: invoiceId, p_actor: actor });
  check(result.error);
}

export async function getOwnedSupport(id: string, token: string): Promise<SupportRecord> {
  const result = await createSupabaseServiceClient().from("support_contributions").select(recordColumns)
    .eq("id", id).eq("access_token_hash", hash(token)).maybeSingle();
  check(result.error);
  if (!result.data) throw new SupportError("Cette référence de soutien n’est pas accessible depuis ce navigateur.", 404);
  return result.data as SupportRecord;
}

export function verifiedSupportVivaSource(record: SupportRecord, transaction: VivaVerifiedTransaction) {
  // Retrieve Transaction can omit the source. Our checkout set the reserved merchant reference.
  return transaction.sourceCode || (transaction.merchantTrns === `SOUTIEN:${record.id}` ? record.source_code : "");
}

export async function applySupportTransaction(record: SupportRecord, transaction: VivaVerifiedTransaction, verifiedParent?: VivaVerifiedTransaction) {
  const currency = transaction.currencyCode.toUpperCase();
  const sourceTransaction = transaction.amountInMinorUnits < 0 ? verifiedParent : transaction;
  const expectedSource = sourceTransaction && verifiedSupportVivaSource(record, sourceTransaction);
  if (record.provider === "swiss-bitcoin-pay" || transaction.orderCode !== record.order_code || expectedSource !== record.source_code || !["EUR", "978"].includes(currency)
    || (transaction.amountInMinorUnits < 0 && (!verifiedParent || verifiedParent.orderCode !== record.order_code
      || verifiedParent.transactionId.toLowerCase() !== transaction.parentTransactionId?.toLowerCase()))) {
    throw new SupportError("Les références du paiement ne correspondent pas au soutien.", 409);
  }
  const result = await createSupabaseServiceClient().rpc("rpc_support_apply_transaction", {
    p_id: record.id, p_order: transaction.orderCode, p_transaction: transaction.transactionId.toLowerCase(), p_source: expectedSource,
    p_amount: transaction.amountInMinorUnits, p_currency: "EUR", p_status: transaction.statusId, p_parent: transaction.parentTransactionId ?? null,
  });
  check(result.error);
}

export function supportStatus(record: SupportRecord): SupportStatus {
  const refundedCents = (record.support_reversals ?? []).reduce((sum, reversal) => sum + reversal.amount_cents, 0);
  const provider = record.provider ?? "viva";
  const checkoutState = stalledSupportCreation(record.checkout_state, record.created_at) ? "uncertain" : record.checkout_state;
  const state = record.review_required || (!record.paid_at && (record.transaction_id || refundedCents)) ? "review"
    : record.paid_at ? (refundedCents >= record.amount_cents ? "refunded" : "paid") : checkoutState;
  let checkoutUrl: string | null = null;
  if (state === "ready" && Date.parse(record.expires_at) > Date.now()) {
    if (provider === "swiss-bitcoin-pay" && record.invoice_id) checkoutUrl = swissBitcoinInvoicePage(record.invoice_id);
    if (provider === "viva" && record.order_code) {
      const config = getSupportVivaConfig();
      if (record.source_code === config.sourceCode) checkoutUrl = buildVivaCheckoutUrl(record.order_code, config) || null;
    }
  }
  return { id: record.id, provider, state, amountCents: record.amount_cents, refundedCents, checkoutUrl, expiresAt: record.expires_at };
}

function stalledSupportCreation(state: string, createdAt?: string) {
  return state === "creating" && createdAt !== undefined && Date.now() - Date.parse(createdAt) > 30_000;
}

type Row = Record<string, unknown>;
const integer = (value: unknown) => {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new SupportError("Données financières indisponibles.", 503);
  return number;
};
const nullableText = (value: unknown) => typeof value === "string" ? value : null;
const adminColumns = "id,pseudonym,publish_name,publish_amount,amount_cents,source_code,order_code,transaction_id,paid_at,checkout_state,review_required,hidden,fees_cents,fee_reference,fee_updated_at,fee_updated_by,created_at,provider,invoice_id,provider_status,provider_issue,support_reversals(amount_cents)";
export type SupportPeriod = { from: string | null; until: string | null };

export async function getAdminSupportRows(period: SupportPeriod): Promise<AdminSupportRow[]> {
  const rows: AdminSupportRow[] = [];
  for (let offset = 0; ; offset += 1000) {
    // Period is the contribution creation date, also explicitly labelled in the UI/export.
    let query = createSupabaseServiceClient().from("support_contributions").select(adminColumns).order("created_at", { ascending: false }).order("id");
    if (period.from) query = query.gte("created_at", period.from);
    if (period.until) query = query.lt("created_at", period.until);
    const result = await query.range(offset, offset + 999);
    check(result.error);
    for (const row of (result.data ?? []) as Row[]) {
      const paidAt = nullableText(row.paid_at), amountCents = integer(row.amount_cents);
      const createdAt = String(row.created_at), checkoutState = String(row.checkout_state);
      const uncertain = checkoutState === "uncertain" || stalledSupportCreation(checkoutState, createdAt);
      rows.push({ id: String(row.id), pseudonym: String(row.pseudonym), publishName: row.publish_name === true, publishAmount: row.publish_amount === true,
        amountCents, capturedCents: paidAt ? amountCents : 0,
        refundedCents: (row.support_reversals as { amount_cents: number }[]).reduce((sum, refund) => sum + integer(refund.amount_cents), 0),
        feesCents: row.fees_cents == null ? null : integer(row.fees_cents), feeReference: nullableText(row.fee_reference),
        feeUpdatedAt: nullableText(row.fee_updated_at), feeUpdatedBy: nullableText(row.fee_updated_by),
        createdAt, paidAt, orderCode: nullableText(row.order_code), transactionId: nullableText(row.transaction_id),
        provider: row.provider === "swiss-bitcoin-pay" ? "swiss-bitcoin-pay" : "viva", invoiceId: nullableText(row.invoice_id),
        providerStatus: nullableText(row.provider_status), providerIssue: nullableText(row.provider_issue) ?? (uncertain ? "creation_uncertain" : null),
        sourceCode: String(row.source_code), checkoutState: uncertain ? "uncertain" : checkoutState,
        reviewRequired: row.review_required === true || (!paidAt && Boolean(row.transaction_id)) || uncertain, hidden: row.hidden === true });
    }
    if ((result.data?.length ?? 0) < 1000) break;
    if (rows.length >= 50_000) throw new SupportError("Sélectionne une période plus courte pour consulter ou exporter ces soutiens.", 413);
  }
  return rows;
}

export async function getAdminSupportDashboard(period: SupportPeriod, page: number): Promise<AdminSupportDashboard> {
  const [summary, rows] = await Promise.all([getSupportSummary(), getAdminSupportRows(period)]);
  const providers = getConfiguredSupportProviders();
  return { campaign: summary.campaign, providers, configured: providers.length > 0,
    configurationError: providers.length ? null : "Configure au moins un moyen de paiement pour ouvrir la cagnotte.",
    rows: rows.slice(page * 50, page * 50 + 50), total: rows.length, page,
    totals: rows.reduce((total, row) => ({ capturedCents: total.capturedCents + row.capturedCents, refundedCents: total.refundedCents + row.refundedCents,
      feesCents: total.feesCents + (row.feesCents ?? 0), missingFees: total.missingFees + (row.paidAt && row.feesCents === null ? 1 : 0),
      reviewCount: total.reviewCount + (row.reviewRequired ? 1 : 0) }), { capturedCents: 0, refundedCents: 0, feesCents: 0, missingFees: 0, reviewCount: 0 }) };
}

export async function mutateSupportAdmin(action: string, id: string | null, value: Record<string, unknown>, actor: string) {
  const result = await createSupabaseServiceClient().rpc("rpc_support_admin", { p_action: action, p_id: id, p_value: value, p_actor: actor });
  check(result.error);
}

export async function findSupportForReconciliation(id: string): Promise<SupportRecord | null> {
  const result = await createSupabaseServiceClient().from("support_contributions").select(recordColumns).eq("id", id).maybeSingle();
  check(result.error);
  return result.data as SupportRecord | null;
}

export type { SupportCampaign };
