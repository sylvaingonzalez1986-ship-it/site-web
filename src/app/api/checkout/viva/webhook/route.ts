import { Buffer } from "node:buffer";
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { issueInvoiceForOrder } from "@/lib/invoice-store";
import { mintLotteryTicketsForOrderByBackend } from "@/lib/lottery-backend";
import { updateOrderPaymentByVivaOrderCodeByBackend } from "@/lib/order-backend";
import { getRequestIp, hitRateLimit } from "@/lib/security-rate-limit";

export const runtime = "nodejs";

type WebhookState = "paid" | "failed";

type ParsedWebhookEvent = {
  eventTypeId: number | null;
  orderCode: number | null;
  transactionId: string;
  sourceCode: string;
  statusId: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toTrimmedString(value: unknown, maxLength: number): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function readEventData(payload: Record<string, unknown>): Record<string, unknown> {
  const candidates = [payload.EventData, payload.eventData, payload.data, payload.Data];

  for (const candidate of candidates) {
    if (isRecord(candidate)) {
      return candidate;
    }
  }

  return {};
}

function parseWebhookPayload(rawPayload: unknown): ParsedWebhookEvent {
  const payload = isRecord(rawPayload) ? rawPayload : {};
  const eventData = readEventData(payload);

  const eventTypeId =
    toFiniteNumber(payload.EventTypeId) ??
    toFiniteNumber(payload.eventTypeId) ??
    toFiniteNumber(eventData.EventTypeId) ??
    toFiniteNumber(eventData.eventTypeId);

  const orderCode =
    toFiniteNumber(eventData.OrderCode) ??
    toFiniteNumber(eventData.orderCode) ??
    toFiniteNumber(payload.OrderCode) ??
    toFiniteNumber(payload.orderCode);

  const transactionId =
    toTrimmedString(eventData.TransactionId, 128) ||
    toTrimmedString(eventData.transactionId, 128) ||
    toTrimmedString(payload.TransactionId, 128) ||
    toTrimmedString(payload.transactionId, 128);

  const sourceCode =
    toTrimmedString(eventData.SourceCode, 64) ||
    toTrimmedString(eventData.sourceCode, 64) ||
    toTrimmedString(payload.SourceCode, 64) ||
    toTrimmedString(payload.sourceCode, 64);

  const statusId =
    toTrimmedString(eventData.StatusId, 32) ||
    toTrimmedString(eventData.statusId, 32) ||
    toTrimmedString(payload.StatusId, 32) ||
    toTrimmedString(payload.statusId, 32);

  return {
    eventTypeId: eventTypeId ? Math.floor(eventTypeId) : null,
    orderCode: orderCode ? Math.floor(orderCode) : null,
    transactionId,
    sourceCode,
    statusId: statusId.toUpperCase(),
  };
}

function determinePaymentState(input: ParsedWebhookEvent): WebhookState | null {
  // Viva webhooks:
  // 1796 = Transaction Payment Created
  // 1798 = Transaction Failed
  if (input.eventTypeId === 1796) {
    return "paid";
  }
  if (input.eventTypeId === 1798) {
    return "failed";
  }

  // Fallback from transaction status codes.
  if (input.statusId === "F" || input.statusId === "C") {
    return "paid";
  }
  if (input.statusId === "E" || input.statusId === "X") {
    return "failed";
  }

  return null;
}

function safeTokenEquals(expected: string, received: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, receivedBuffer);
}

function readWebhookToken(request: Request): string {
  const headerToken = request.headers.get("x-viva-webhook-token");
  return headerToken?.trim() || "";
}

export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  const ip = getRequestIp(request);
  let rateLimit;
  try {
    rateLimit = await hitRateLimit({
      key: `viva_webhook:${ip}`,
      windowSeconds: 60,
      maxHits: 120,
    });
  } catch {
    return NextResponse.json({ error: "Protection webhook indisponible." }, { status: 503 });
  }

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Trop de requetes webhook." },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds),
        },
      },
    );
  }

  const requiredToken = process.env.VIVA_WEBHOOK_TOKEN?.trim() || "";
  if (!requiredToken) {
    return NextResponse.json({ error: "Webhook Viva non configure." }, { status: 503 });
  }

  const receivedToken = readWebhookToken(request);
  if (!receivedToken || !safeTokenEquals(requiredToken, receivedToken)) {
    return NextResponse.json({ error: "Webhook token invalide." }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Payload webhook invalide." }, { status: 400 });
  }

  const parsed = parseWebhookPayload(payload);
  if (!parsed.orderCode) {
    return NextResponse.json(
      { ok: true, ignored: true, reason: "order_code_missing" },
      { status: 200 },
    );
  }

  const configuredSourceCode = process.env.VIVA_SOURCE_CODE?.trim() || "";
  if (configuredSourceCode && parsed.sourceCode !== configuredSourceCode) {
    return NextResponse.json({ error: "SourceCode webhook invalide." }, { status: 403 });
  }

  const paymentState = determinePaymentState(parsed);
  if (!paymentState) {
    return NextResponse.json(
      { ok: true, ignored: true, reason: "event_not_supported" },
      { status: 200 },
    );
  }

  const updated = await updateOrderPaymentByVivaOrderCodeByBackend({
    orderCode: parsed.orderCode,
    paymentState,
    transactionId: parsed.transactionId || undefined,
  });

  if (!updated) {
    return NextResponse.json(
      { ok: true, ignored: true, reason: "order_not_found" },
      { status: 200 },
    );
  }

  if (updated.paymentState === "paid") {
    await issueInvoiceForOrder(updated.id);

    if (updated.customerId) {
      await mintLotteryTicketsForOrderByBackend({
        userId: updated.customerId,
        orderId: updated.id,
        orderAmount: updated.totalAmount,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    orderId: updated.id,
    paymentState: updated.paymentState,
    status: updated.status,
  });
}
