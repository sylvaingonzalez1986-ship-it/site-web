import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import type { SwissBitcoinAttemptState } from "@/lib/swiss-bitcoin-pay-types";

const checkoutApi = "https://api.swiss-bitcoin-pay.ch/checkout";
const providerDomain = "swiss-bitcoin-pay.ch";
const invoiceDelayMinutes = 10;
export const swissBitcoinWebhookHeader = "x-sbp-webhook-secret";
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export function swissBitcoinId(value: unknown): string | null {
  return typeof value === "string" && uuid.test(value) ? value.toLowerCase() : null;
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function swissBitcoinSiteOrigin(): string | null {
  try {
    const url = new URL(process.env.NEXT_PUBLIC_SITE_URL?.trim() ?? "");
    return url.protocol === "https:" && !url.username && !url.password ? url.origin : null;
  } catch {
    return null;
  }
}

function creationConfig() {
  const apiKey = process.env.SWISS_BITCOIN_PAY_API_KEY?.trim() || process.env.swiss_bitcoin?.trim();
  const webhookSecret = process.env.SWISS_BITCOIN_PAY_WEBHOOK_SECRET?.trim();
  const origin = swissBitcoinSiteOrigin();
  const cronSecret = process.env.CRON_SECRET?.trim();
  return process.env.SWISS_BITCOIN_PAY_ENABLED === "true" && apiKey && webhookSecret && origin && cronSecret
    ? { apiKey, webhookSecret, origin }
    : null;
}

export function isSwissBitcoinPayEnabled(): boolean {
  return Boolean(creationConfig());
}

export function matchesSwissBitcoinSecret(received: string | null, expected: string | undefined): boolean {
  if (!received || !expected) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(received), digest(expected));
}

export function swissBitcoinCheckoutUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    if (url.hostname !== providerDomain && !url.hostname.endsWith(`.${providerDomain}`)) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function swissBitcoinInvoicePage(invoiceId: string): string {
  return `https://app.swiss-bitcoin-pay.ch/invoice/${invoiceId}`;
}

export class SwissBitcoinCreationError extends Error {
  constructor(readonly definitive: boolean) {
    super("Swiss Bitcoin Pay invoice creation unavailable");
  }
}

const providerRefusals = new Map([
  ["api_key_not_provided", "missing_api_key"],
  ["api_key_missing", "missing_api_key"],
  ["missing_api_key", "missing_api_key"],
  ["invalid_api_key", "invalid_api_key"],
  ["unauthorized", "unauthorized"],
  ["forbidden", "forbidden"],
  ["account_suspended", "account_suspended"],
  ["account_locked", "account_locked"],
  ["account_not_found", "account_not_found"],
  ["access_denied", "access_denied"],
  ["signature_not_provided", "missing_signature"],
  ["missing_signature", "missing_signature"],
  ["invalid_signature", "invalid_signature"],
  ["hmac_required", "missing_signature"],
  ["invalid_hmac", "invalid_signature"],
  ["invalid_request", "invalid_request"],
  ["invalid_webhook", "invalid_webhook"],
  ["invalid_amount", "invalid_amount"],
  ["rate_limit_exceeded", "rate_limited"],
  ["too_many_requests", "rate_limited"],
]);

async function readProviderRefusal(response: Response): Promise<string | undefined> {
  const reader = response.body?.getReader();
  if (!reader) return undefined;

  const bytes = new Uint8Array(1024);
  let size = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      if (size + chunk.value.byteLength > bytes.byteLength) {
        void reader.cancel().catch(() => {});
        return undefined;
      }
      bytes.set(chunk.value, size);
      size += chunk.value.byteLength;
    }
  } catch {
    return undefined;
  } finally {
    reader.releaseLock();
  }

  const text = new TextDecoder().decode(bytes.subarray(0, size));
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Some providers or gateways return an error as plain text.
  }
  const fields = object(parsed);
  for (const value of [fields.code, fields.error, fields.message, parsed]) {
    if (typeof value !== "string") continue;
    const key = value.trim().toLowerCase().replace(/[ -]+/g, "_").replace(/[.!]$/, "");
    const category = providerRefusals.get(key);
    if (category) return category;
  }
  return undefined;
}

export async function createSwissBitcoinInvoice(orderId: string, attemptId: string, eurMinor: number) {
  const config = creationConfig();
  if (!config || !Number.isSafeInteger(eurMinor) || eurMinor < 1) throw new SwissBitcoinCreationError(true);

  const response = await fetch(checkoutApi, {
    method: "POST",
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
    headers: { "content-type": "application/json", "api-key": config.apiKey },
    body: JSON.stringify({
      amount: eurMinor / 100,
      unit: "EUR",
      onChain: false,
      delay: invoiceDelayMinutes,
      redirect: false,
      redirectAfterPaid: `${config.origin}/checkout/bitcoin/${encodeURIComponent(orderId)}`,
      webhook: {
        url: `${config.origin}/api/checkout/bitcoin/webhook`,
        headers: { [swissBitcoinWebhookHeader]: config.webhookSecret },
      },
      extra: { reference: attemptId },
    }),
  });
  if (response.status !== 201) {
    const category = await readProviderRefusal(response);
    console.warn("[swiss-bitcoin-pay] invoice creation refused", {
      status: response.status,
      orderId: /^ORD-\d{8}-\d{4}$/.test(orderId) ? orderId : undefined,
      ...(category ? { category } : {}),
    });
    throw new SwissBitcoinCreationError(response.status === 403);
  }
  const data = object(await response.json());
  const invoiceId = swissBitcoinId(data.id);
  if (!invoiceId) throw new SwissBitcoinCreationError(false);
  return { invoiceId, checkoutUrl: swissBitcoinCheckoutUrl(data.checkoutUrl) };
}

export async function fetchSwissBitcoinInvoice(invoiceId: string): Promise<unknown> {
  if (!swissBitcoinId(invoiceId)) throw new Error("Invalid Swiss Bitcoin Pay invoice ID");
  const response = await fetch(`${checkoutApi}/${invoiceId}`, {
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error("Swiss Bitcoin Pay invoice lookup unavailable");
  const body: unknown = await response.json();
  return body;
}

export function swissBitcoinInvoiceReference(value: unknown): string | null {
  return swissBitcoinId(object(object(value).extra).reference);
}

export function swissBitcoinInvoiceId(value: unknown): string | null {
  return swissBitcoinId(object(value).id);
}

function eurMinorAmount(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  // Accept only a decimal EUR amount with at most two decimal places.
  if (!/^\d+(?:\.\d{1,2})?$/.test(String(value))) return null;
  const cents = Math.round(value * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}

function timestamp(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1_000_000_000) return null;
  // Merchant API timestamps are Unix timestamps. Accept seconds and milliseconds.
  const milliseconds = value < 10_000_000_000 ? value * 1000 : value;
  if (milliseconds > 253_402_300_799_999) return null;
  return new Date(milliseconds).toISOString();
}

const invoiceStates = new Map<string, SwissBitcoinAttemptState>([
  ["draft", "pending"],
  ["open", "pending"],
  ["pending", "pending"],
  ["unconfirmed", "confirming"],
  ["expired", "expired"],
  ["paid", "paid"],
]);

export function inspectSwissBitcoinInvoice(value: unknown, invoiceId: string, attemptId: string, expectedMinor: number) {
  const data = object(value);
  const input = object(data.input);
  const eurMinor = eurMinorAmount(input.amount);
  const currency = input.unit === "EUR" ? "EUR" : null;
  const providerStatus = typeof data.status === "string" && invoiceStates.has(data.status) ? data.status : null;
  const state = providerStatus ? invoiceStates.get(providerStatus)! : "review";
  const createdAt = timestamp(data.createdAt);
  const providerDeadline = timestamp(data.expiry);
  const expiresAt = createdAt && providerDeadline && providerDeadline > createdAt ? providerDeadline
    : createdAt && (data.delay === invoiceDelayMinutes || data.delay === invoiceDelayMinutes * 60)
      ? timestamp(Date.parse(createdAt) + invoiceDelayMinutes * 60_000)
      : null;
  const details = Array.isArray(data.paymentDetails) ? data.paymentDetails.map(object) : [];
  const payment = details.find((detail) => detail.network === "lightning" && timestamp(detail.paidAt));
  const paidAt = timestamp(payment?.paidAt) ?? timestamp(data.paidAt);
  const associationIssue = swissBitcoinId(data.id) !== invoiceId ? "invoice_id_mismatch"
    : swissBitcoinInvoiceReference(data) !== attemptId ? "invoice_reference_mismatch"
    : currency !== "EUR" || eurMinor !== expectedMinor ? "invoice_amount_mismatch"
    : null;
  const onChainPayment = typeof data.paymentMethod === "string" && data.paymentMethod.toLowerCase() === "onchain";
  const issue = associationIssue ?? (
    !providerStatus ? "invoice_status_unknown"
    : state === "paid" && onChainPayment ? "invoice_network_mismatch"
    : state === "paid" && (!paidAt || !expiresAt || (createdAt && paidAt < createdAt)) ? "invoice_timing_unverified"
    : null
  );
  const reference = payment?.hash;
  const settled = !associationIssue && state === "paid";
  return {
    associationVerified: !associationIssue,
    issue,
    eurMinor,
    currency,
    providerStatus,
    state: issue ? "review" as const : state,
    expiresAt,
    paidAt: settled ? paidAt : null,
    // The merchant API does not specify the unit of a settled Lightning detail.
    paidSats: null,
    paymentReference: settled && typeof reference === "string" && /^[0-9a-f]{64}$/i.test(reference)
      ? reference.toLowerCase() : null,
  };
}
