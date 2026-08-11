import { NextResponse } from "next/server";
import { issueInvoiceForOrder } from "@/lib/invoice-store";
import {
  consumeLotteryRewardClaimsForOrderByBackend,
  mintLotteryTicketsForOrderByBackend,
  releaseLotteryRewardClaimsForOrderByBackend,
} from "@/lib/lottery-backend";
import {
  applyOrderLoyaltyBonusByBackend,
  finalizeVivaPaymentByBackend,
  getOrderByVivaOrderCodeByBackend,
  updateOrderPaymentByVivaOrderCodeByBackend,
} from "@/lib/order-backend";
import { applyReferralRewardForPaidOrderByBackend } from "@/lib/referral-backend";
import { logAuditEvent } from "@/lib/audit-log";
import { getRequestIp, hitRateLimit, logRateLimitRejection } from "@/lib/security-rate-limit";
import {
  beginWebhookEvent,
  completeWebhookEvent,
  failWebhookEvent,
} from "@/lib/webhook-idempotency";
import {
  extractVivaOrderCodeFromJson,
  getVivaConfig,
  retrieveVivaTransaction,
} from "@/lib/viva-payment";

export const runtime = "nodejs";

type WebhookState = "paid" | "failed";

type ParsedWebhookEvent = {
  eventTypeId: number | null;
  orderCode: string;
  transactionId: string;
  sourceCode: string;
  statusId: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toFiniteNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toTrimmedString(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function readEventData(payload: Record<string, unknown>): Record<string, unknown> {
  const candidates = [payload.EventData, payload.eventData, payload.data, payload.Data];
  return candidates.find(isRecord) ?? {};
}

function parseWebhookPayload(rawPayload: unknown, rawBody: string): ParsedWebhookEvent {
  const payload = isRecord(rawPayload) ? rawPayload : {};
  const eventData = readEventData(payload);
  const eventTypeId =
    toFiniteNumber(payload.EventTypeId) ??
    toFiniteNumber(payload.eventTypeId) ??
    toFiniteNumber(eventData.EventTypeId) ??
    toFiniteNumber(eventData.eventTypeId);

  return {
    eventTypeId: eventTypeId === null ? null : Math.floor(eventTypeId),
    orderCode: extractVivaOrderCodeFromJson(rawBody),
    transactionId:
      toTrimmedString(eventData.TransactionId, 64) ||
      toTrimmedString(eventData.transactionId, 64) ||
      toTrimmedString(payload.TransactionId, 64) ||
      toTrimmedString(payload.transactionId, 64),
    sourceCode:
      toTrimmedString(eventData.SourceCode, 64) ||
      toTrimmedString(eventData.sourceCode, 64) ||
      toTrimmedString(payload.SourceCode, 64) ||
      toTrimmedString(payload.sourceCode, 64),
    statusId: (
      toTrimmedString(eventData.StatusId, 16) ||
      toTrimmedString(eventData.statusId, 16) ||
      toTrimmedString(payload.StatusId, 16) ||
      toTrimmedString(payload.statusId, 16)
    ).toUpperCase(),
  };
}

function determinePaymentState(input: ParsedWebhookEvent): WebhookState | null {
  if (input.eventTypeId === 1796) return "paid";
  if (input.eventTypeId === 1798) return "failed";
  if (input.statusId === "F" || input.statusId === "C") return "paid";
  if (input.statusId === "E" || input.statusId === "X") return "failed";
  return null;
}

function isAllowedProviderIp(ip: string): boolean {
  const configured = (process.env.VIVA_WEBHOOK_ALLOWED_IPS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return configured.length === 0 || configured.includes(ip);
}

export async function GET(request: Request) {
  const ip = getRequestIp(request);
  const rateLimit = await hitRateLimit({
    key: `viva_webhook_get:${ip}`,
    windowSeconds: 60,
    maxHits: 10,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  const verificationKey =
    process.env.VIVA_WEBHOOK_VERIFICATION_KEY?.trim() ||
    process.env.VIVA_WEBHOOK_TOKEN?.trim() ||
    "";
  if (!verificationKey) {
    return NextResponse.json({ error: "Webhook Viva non configure." }, { status: 503 });
  }
  logAuditEvent({ eventType: "viva_webhook_verification", ip });
  return NextResponse.json({ Key: verificationKey });
}

export async function POST(request: Request) {
  const ip = getRequestIp(request);
  if (!isAllowedProviderIp(ip)) {
    return NextResponse.json({ error: "Source webhook refusee." }, { status: 403 });
  }

  const rateLimit = await hitRateLimit({
    key: `viva_webhook:${ip}`,
    windowSeconds: 60,
    maxHits: 120,
  });
  if (!rateLimit.allowed) {
    logRateLimitRejection({
      endpoint: "POST /api/checkout/viva/webhook",
      key: `viva_webhook:${ip}`,
      ip,
      retryAfterSeconds: rateLimit.retryAfterSeconds,
      maxHits: 120,
      windowSeconds: 60,
    });
    return NextResponse.json(
      { error: "Trop de requetes webhook." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 65_536) {
    return NextResponse.json({ error: "Payload webhook trop volumineux." }, { status: 413 });
  }

  let rawBody = "";
  let payload: unknown;
  try {
    rawBody = await request.text();
    if (rawBody.length > 65_536) {
      return NextResponse.json({ error: "Payload webhook trop volumineux." }, { status: 413 });
    }
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Payload webhook invalide." }, { status: 400 });
  }

  const parsed = parseWebhookPayload(payload, rawBody);
  const paymentState = determinePaymentState(parsed);
  if (!paymentState) {
    return NextResponse.json(
      { ok: true, ignored: true, reason: "event_not_supported" },
      { status: 200 },
    );
  }
  if (!parsed.orderCode || !parsed.transactionId) {
    return NextResponse.json({ error: "Reference Viva incomplete." }, { status: 400 });
  }

  const config = getVivaConfig();
  if (!config.isConfigured) {
    console.error("Viva webhook configuration error:", config.configurationError);
    return NextResponse.json({ error: "Webhook Viva indisponible." }, { status: 503 });
  }
  if (parsed.sourceCode && parsed.sourceCode !== config.sourceCode) {
    return NextResponse.json({ error: "SourceCode webhook invalide." }, { status: 403 });
  }

  const order = await getOrderByVivaOrderCodeByBackend(parsed.orderCode);
  if (!order) {
    // Returning a retryable status avoids permanently losing an early provider callback.
    return NextResponse.json({ error: "Commande pas encore disponible." }, { status: 503 });
  }

  let verified;
  try {
    verified = await retrieveVivaTransaction({
      config,
      transactionId: parsed.transactionId,
    });
  } catch (error) {
    console.error("Unable to verify Viva transaction:", error);
    return NextResponse.json({ error: "Transaction Viva non verifiable." }, { status: 503 });
  }

  const expectedAmount = Math.round(order.totalAmount * 100);
  const expectedStatuses = paymentState === "paid" ? new Set(["F", "C"]) : new Set(["E", "X"]);
  if (
    verified.orderCode !== parsed.orderCode ||
    verified.transactionId.toLowerCase() !== parsed.transactionId.toLowerCase() ||
    verified.sourceCode !== config.sourceCode ||
    verified.currencyCode !== "978" ||
    verified.amountInMinorUnits !== expectedAmount ||
    !expectedStatuses.has(verified.statusId)
  ) {
    logAuditEvent({
      eventType: "viva_webhook_verification_failed",
      ip,
      metadata: { orderId: order.id },
    });
    return NextResponse.json({ error: "Transaction Viva incoherente." }, { status: 403 });
  }

  const eventKey = {
    provider: "viva",
    eventType: String(parsed.eventTypeId ?? paymentState),
    externalId: verified.transactionId,
  };
  let claimState;
  try {
    claimState = await beginWebhookEvent(eventKey);
  } catch (error) {
    console.error("Unable to claim Viva webhook:", error);
    return NextResponse.json({ error: "Idempotence webhook indisponible." }, { status: 503 });
  }
  if (claimState === "duplicate" || claimState === "busy") {
    return NextResponse.json(
      { ok: true, ignored: true, reason: claimState === "busy" ? "event_processing" : "duplicate_event" },
      { status: 200 },
    );
  }

  try {
    let updated = order;
    let reviewRequired = false;
    if (paymentState === "paid") {
      const result = await finalizeVivaPaymentByBackend({
        orderCode: verified.orderCode,
        transactionId: verified.transactionId,
        amountInMinorUnits: verified.amountInMinorUnits,
        currencyCode: verified.currencyCode,
      });
      if (!result.order) {
        throw new Error("Commande introuvable pendant la finalisation Viva.");
      }
      updated = result.order;
      reviewRequired = result.reviewRequired;

      await consumeLotteryRewardClaimsForOrderByBackend(updated.id);
      await issueInvoiceForOrder(updated.id);
      if (!reviewRequired) {
        await applyOrderLoyaltyBonusByBackend(updated.id);
        if (updated.customerId) {
          await mintLotteryTicketsForOrderByBackend({
            userId: updated.customerId,
            orderId: updated.id,
            orderAmount: updated.totalAmount,
            bonusTicketCount: updated.extraLotteryTickets ?? 0,
          });
          await applyReferralRewardForPaidOrderByBackend({ orderId: updated.id });
        }
      } else {
        console.error(`[viva-webhook] Paid order ${updated.id} requires inventory review.`);
      }
    } else {
      const failedOrder = await updateOrderPaymentByVivaOrderCodeByBackend({
        orderCode: verified.orderCode,
        paymentState: "failed",
        transactionId: verified.transactionId,
      });
      if (!failedOrder) {
        throw new Error("Commande introuvable pendant le refus Viva.");
      }
      updated = failedOrder;
      await releaseLotteryRewardClaimsForOrderByBackend(updated.id);
    }

    await completeWebhookEvent(eventKey);
    return NextResponse.json({
      ok: true,
      orderId: updated.id,
      paymentState: updated.paymentState,
      status: updated.status,
      reviewRequired,
    });
  } catch (error) {
    await failWebhookEvent(eventKey, error);
    console.error("Viva webhook processing failed:", error);
    return NextResponse.json({ error: "Traitement webhook a reessayer." }, { status: 503 });
  }
}
