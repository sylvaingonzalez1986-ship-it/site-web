import "server-only";

import { getOrderByIdByBackend } from "@/lib/order-backend";
import { processPaidOrder } from "@/lib/order-paid-effects";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import {
  createSwissBitcoinInvoice,
  fetchSwissBitcoinInvoice,
  inspectSwissBitcoinInvoice,
  isSwissBitcoinPayEnabled,
  SwissBitcoinCreationError,
  swissBitcoinCheckoutUrl,
  swissBitcoinId,
  swissBitcoinInvoicePage,
  swissBitcoinInvoiceReference,
} from "@/lib/swiss-bitcoin-pay";
import type {
  SwissBitcoinAttemptState,
  SwissBitcoinPaymentStatus,
  SwissBitcoinPaymentSummary,
} from "@/lib/swiss-bitcoin-pay-types";
import { beginWebhookEvent, completeWebhookEvent, failWebhookEvent } from "@/lib/webhook-idempotency";
import type { CmsOrder } from "@/types/store";

export type { SwissBitcoinPaymentSummary } from "@/lib/swiss-bitcoin-pay-types";

const attemptsTable = "swiss_bitcoin_payment_attempts";
const attemptColumns = "id,order_id,invoice_id,expected_eur_minor,state,checkout_url,created_at,expires_at,last_checked_at,next_check_at,paid_at,paid_sats,payment_reference,issue,effects_pending,provider_status";

type Attempt = {
  id: string;
  order_id: string;
  invoice_id: string | null;
  expected_eur_minor: number;
  state: SwissBitcoinAttemptState;
  checkout_url: string | null;
  created_at: string;
  expires_at: string | null;
  last_checked_at: string | null;
  next_check_at: string | null;
  paid_at: string | null;
  paid_sats: number | null;
  payment_reference: string | null;
  issue: string | null;
  effects_pending: boolean;
  provider_status: string | null;
};

async function rpc<Result>(name: string, args: Record<string, unknown>): Promise<Result> {
  const { data, error } = await createSupabaseServiceClient().rpc(name, args);
  if (error) throw new Error(`Swiss Bitcoin Pay database operation failed: ${name}`);
  return data as Result;
}

function attempts() {
  return createSupabaseServiceClient().from(attemptsTable).select(attemptColumns);
}

async function attemptsForOrders(orderIds: string[]) {
  const result: Attempt[] = [];
  const distinctIds = [...new Set(orderIds)];
  const orderBatchSize = 50;
  const pageSize = 200;
  for (let index = 0; index < distinctIds.length; index += orderBatchSize) {
    const batch = distinctIds.slice(index, index + orderBatchSize);
    for (let start = 0; ; start += pageSize) {
      const { data, error } = await attempts()
        .in("order_id", batch)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(start, start + pageSize - 1)
        .returns<Attempt[]>();
      if (error) throw new Error("Swiss Bitcoin Pay attempts unavailable");
      result.push(...data);
      if (data.length < pageSize) break;
    }
  }
  return result;
}

export async function listSwissBitcoinPayments(orderIds: string[]): Promise<Record<string, SwissBitcoinPaymentSummary[]>> {
  const grouped = new Map<string, SwissBitcoinPaymentSummary[]>();
  for (const attempt of await attemptsForOrders(orderIds)) {
    const summary: SwissBitcoinPaymentSummary = {
      id: attempt.id,
      invoiceId: attempt.invoice_id,
      expectedEurMinor: attempt.expected_eur_minor,
      state: attempt.state,
      createdAt: attempt.created_at,
      expiresAt: attempt.expires_at,
      lastCheckedAt: attempt.last_checked_at,
      paidAt: attempt.paid_at,
      paidSats: attempt.paid_sats,
      paymentReference: attempt.payment_reference,
      issue: attempt.issue,
      providerStatus: attempt.provider_status,
    };
    const summaries = grouped.get(attempt.order_id);
    if (summaries) summaries.push(summary);
    else grouped.set(attempt.order_id, [summary]);
  }
  return Object.fromEntries(grouped);
}

export async function prepareSwissBitcoinPayment(orderId: string, retry = false): Promise<void> {
  if (!isSwissBitcoinPayEnabled()) return;
  const result = await rpc<{
    action: "create" | "existing" | "blocked";
    attempt_id?: string;
    expected_eur_minor?: number;
  }>("rpc_begin_swiss_bitcoin_payment", { p_order_id: orderId, p_retry: retry });
  if (result.action !== "create") return;
  const attemptId = swissBitcoinId(result.attempt_id);
  if (!attemptId || typeof result.expected_eur_minor !== "number") {
    throw new Error("Invalid Swiss Bitcoin Pay attempt allocation");
  }

  let invoice;
  try {
    invoice = await createSwissBitcoinInvoice(orderId, attemptId, result.expected_eur_minor);
  } catch (error) {
    await rpc("rpc_note_swiss_bitcoin_creation", {
      p_attempt_id: attemptId,
      p_definitive: error instanceof SwissBitcoinCreationError && error.definitive,
    });
    return;
  }

  const args = {
    p_attempt_id: attemptId,
    p_invoice_id: invoice.invoiceId,
    p_checkout_url: invoice.checkoutUrl,
  };
  // The attachment is idempotent. Recover a transient write failure without a second provider POST.
  const attached = await rpc<boolean>("rpc_attach_swiss_bitcoin_invoice", args)
    .catch(() => rpc<boolean>("rpc_attach_swiss_bitcoin_invoice", args));
  if (!attached) throw new Error("Swiss Bitcoin Pay invoice association failed");
}

async function deliverPaidEffects(attempt: Attempt) {
  const key = { provider: "swiss_bitcoin_pay", externalId: attempt.order_id, eventType: "paid_order_effects" };
  const claim = await beginWebhookEvent(key);
  if (claim === "busy") return;
  if (claim === "process") {
    try {
      const order = await getOrderByIdByBackend(attempt.order_id);
      if (!order || order.paymentState !== "paid") throw new Error("Paid order unavailable for Swiss Bitcoin Pay effects");
      await processPaidOrder(order);
      await completeWebhookEvent(key);
    } catch (error) {
      await failWebhookEvent(key, new Error("Swiss Bitcoin Pay paid order effects failed"));
      throw error;
    }
  }
  await rpc("rpc_complete_swiss_bitcoin_effects", { p_attempt_id: attempt.id });
}

async function observeInvoice(attempt: Attempt, invoiceId: string, invoice: unknown) {
  const observed = inspectSwissBitcoinInvoice(invoice, invoiceId, attempt.id, attempt.expected_eur_minor);
  if (!attempt.invoice_id && !observed.associationVerified) return false;
  const result = await rpc<{ effects_pending: boolean }>("rpc_observe_swiss_bitcoin_payment", {
    p_attempt_id: attempt.id,
    p_invoice_id: invoiceId,
    p_state: observed.state,
    p_eur_minor: observed.eurMinor,
    p_currency: observed.currency,
    p_provider_status: observed.providerStatus,
    p_paid_at: observed.paidAt,
    p_paid_sats: observed.paidSats,
    p_payment_reference: observed.paymentReference,
    p_expires_at: observed.expiresAt,
    p_issue: observed.issue,
  });
  if (result.effects_pending) await deliverPaidEffects(attempt);
  if (observed.state === "pending" && !swissBitcoinCheckoutUrl(attempt.checkout_url)) {
    // The official app uses this URL when sharing an invoice by ID.
    await rpc("rpc_attach_swiss_bitcoin_invoice", {
      p_attempt_id: attempt.id,
      p_invoice_id: invoiceId,
      p_checkout_url: swissBitcoinInvoicePage(invoiceId),
    });
  }
  return true;
}

export async function receiveSwissBitcoinNotification(invoiceId: string): Promise<void> {
  const { data: known, error } = await attempts().eq("invoice_id", invoiceId).returns<Attempt[]>().maybeSingle();
  if (error) throw new Error("Swiss Bitcoin Pay invoice attempt lookup failed");
  const invoice = await fetchSwissBitcoinInvoice(invoiceId);
  if (known) {
    await observeInvoice(known, invoiceId, invoice);
    return;
  }

  // A checkout POST can time out after the provider creates its invoice.
  // Recover its attempt using only the independently fetched invoice.
  const attemptId = swissBitcoinInvoiceReference(invoice);
  if (!attemptId) return;
  const { data: attempt, error: attemptError } = await attempts().eq("id", attemptId).returns<Attempt[]>().maybeSingle();
  if (attemptError) throw new Error("Swiss Bitcoin Pay recovery attempt lookup failed");
  if (!attempt || (attempt.invoice_id && attempt.invoice_id !== invoiceId)) return;
  await observeInvoice(attempt, invoiceId, invoice);
}

export async function recoverSwissBitcoinInvoice(orderId: string, invoiceId: string): Promise<boolean> {
  const validatedId = swissBitcoinId(invoiceId);
  if (!validatedId) return false;
  const invoice = await fetchSwissBitcoinInvoice(validatedId);
  const attemptId = swissBitcoinInvoiceReference(invoice);
  if (!attemptId) return false;
  const { data: attempt, error } = await attempts().eq("id", attemptId).eq("order_id", orderId).returns<Attempt[]>().maybeSingle();
  if (error) throw new Error("Swiss Bitcoin Pay recovery attempt lookup failed");
  if (!attempt || attempt.state !== "unknown" || attempt.invoice_id) return false;
  if (!await observeInvoice(attempt, validatedId, invoice)) return false;
  const { data: recovered, error: recoveryError } = await attempts().eq("id", attemptId).returns<Attempt[]>().maybeSingle();
  if (recoveryError) throw new Error("Swiss Bitcoin Pay recovered attempt lookup failed");
  return recovered?.invoice_id === validatedId;
}

async function reconcileAttempt(attempt: Attempt) {
  try {
    if (attempt.effects_pending) {
      await deliverPaidEffects(attempt);
    } else if (attempt.invoice_id) {
      await observeInvoice(attempt, attempt.invoice_id, await fetchSwissBitcoinInvoice(attempt.invoice_id));
    } else {
      await rpc("rpc_defer_swiss_bitcoin_check", { p_attempt_id: attempt.id });
    }
  } catch (error) {
    await rpc("rpc_defer_swiss_bitcoin_check", { p_attempt_id: attempt.id });
    throw error;
  }
}

export async function reconcileSwissBitcoinPayments(): Promise<{ checked: number; failed: number; archived: number }> {
  const { data, error } = await attempts()
    .lte("next_check_at", new Date().toISOString())
    .order("next_check_at", { ascending: true })
    .limit(16)
    .returns<Attempt[]>();
  if (error) throw new Error("Swiss Bitcoin Pay reconciliation queue unavailable");
  let failed = 0;
  for (let offset = 0; offset < data.length; offset += 4) {
    const settled = await Promise.allSettled(data.slice(offset, offset + 4).map(reconcileAttempt));
    failed += settled.filter((result) => result.status === "rejected").length;
  }
  const archived = await rpc<number>("rpc_archive_idle_swiss_bitcoin_orders", { p_limit: 25 });
  return { checked: data.length, failed, archived };
}

function paymentStatus(order: CmsOrder, rows: Attempt[]): SwissBitcoinPaymentStatus | null {
  if (order.paymentProvider !== "swiss_bitcoin_pay" && !rows.length && !order.swissBitcoinCardStartedAt) return null;
  const attempt = rows[0];
  const latestState = attempt?.state;
  const unresolvedCardSwitch = order.swissBitcoinCardStartedAt && !order.vivaOrderCode &&
    Date.now() - Date.parse(order.swissBitcoinCardStartedAt) >= 60_000;
  const review = order.paymentReviewRequired || rows.some((row) => row.state === "review");
  const cancelled = order.status === "cancelled" || Boolean(order.archivedAt);
  const canAct = !review && order.status === "pending_payment" && !cancelled &&
    order.paymentState === "pending" && order.paymentProvider === "swiss_bitcoin_pay";
  const canReplace = canAct && !order.vivaOrderCode && !order.swissBitcoinCardStartedAt &&
    Date.now() - Date.parse(order.createdAt) < 60 * 60_000 &&
    rows.every((row) => row.state === "failed" || row.state === "expired");
  const checkoutUrl = latestState === "pending" && (!attempt.expires_at || Date.parse(attempt.expires_at) > Date.now())
    ? swissBitcoinCheckoutUrl(attempt.checkout_url) : null;
  const resumeCardUrl = !review && !cancelled && order.paymentState === "pending" && order.vivaOrderCode
    ? `/api/account/orders/${encodeURIComponent(order.id)}/resume-payment` : null;
  const state = review ? "review"
    : order.paymentState === "paid" ? "paid"
    : cancelled ? "cancelled"
    : unresolvedCardSwitch || latestState === "unknown" ? "review"
    : order.swissBitcoinCardStartedAt && !resumeCardUrl ? "confirming"
    : !canAct || resumeCardUrl ? "unavailable"
    : latestState === "expired" ? "expired"
    : latestState === "confirming" || latestState === "paid" ? "confirming"
    : latestState === "pending" ? (checkoutUrl ? "pending" : "confirming")
    : latestState === "creating" ? "preparing"
    : "unavailable";
  return {
    orderId: order.id,
    totalAmount: order.totalAmount,
    state,
    ...(state === "pending" && checkoutUrl ? { checkoutUrl } : {}),
    ...(resumeCardUrl ? { resumeCardUrl } : {}),
    ...(attempt?.expires_at ? { expiresAt: attempt.expires_at } : {}),
    canRetry: canReplace && isSwissBitcoinPayEnabled(),
    canPayByCard: canReplace,
  };
}

export async function getSwissBitcoinPaymentStatus(order: CmsOrder, reconcile = true): Promise<SwissBitcoinPaymentStatus | null> {
  const rows = await attemptsForOrders([order.id]);
  const attempt = rows[0];
  if (reconcile && attempt?.invoice_id && attempt.next_check_at &&
      Date.parse(attempt.next_check_at) <= Date.now() &&
      (attempt.state === "pending" || attempt.state === "confirming" || attempt.state === "expired")) {
    try {
      await reconcileAttempt(attempt);
    } catch {
      console.warn("[swiss-bitcoin-pay] customer reconciliation deferred");
    }
    const refreshed = await getOrderByIdByBackend(order.id);
    if (!refreshed || refreshed.customerId !== order.customerId) return null;
    return paymentStatus(refreshed, await attemptsForOrders([order.id]));
  }
  return paymentStatus(order, rows);
}
