import { readRequestBody } from "@/lib/body-size-guard";
import { getRequestIp } from "@/lib/security-rate-limit";
import { extractVivaOrderCodeFromJson } from "@/lib/viva-payment";
import { supportFailure, supportJson, supportRateLimit } from "@/lib/support-http";
import { handleSupportWebhook } from "@/lib/support-viva";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const limited = await supportRateLimit(request, "webhook-key", 10);
  if (limited) return limited;
  const key = process.env.VIVA_WEBHOOK_VERIFICATION_KEY?.trim() || process.env.VIVA_WEBHOOK_TOKEN?.trim();
  return key ? supportJson({ Key: key }) : supportJson({ error: "Webhook Viva non configuré." }, 503);
}

export async function POST(request: Request) {
  try {
    const allowed = (process.env.VIVA_WEBHOOK_ALLOWED_IPS ?? "").split(",").map(value => value.trim()).filter(Boolean);
    if (allowed.length && !allowed.includes(getRequestIp(request))) return supportJson({ error: "Source refusée." }, 403);
    const limited = await supportRateLimit(request, "webhook", 120);
    if (limited) return limited;
    const bounded = await readRequestBody(request, 65_536);
    if (!bounded.ok) return bounded.response;
    const raw = await bounded.body.text();
    let payload;
    try { payload = JSON.parse(raw); } catch { return supportJson({ error: "Notification invalide." }, 400); }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return supportJson({ error: "Notification invalide." }, 400);
    const data = payload.EventData ?? payload.eventData ?? payload.data ?? payload.Data ?? {};
    const event = Number(payload.EventTypeId ?? payload.eventTypeId);
    if (![1796, 1797, 1798].includes(event)) return supportJson({ ok: true, ignored: true });
    const orderCode = extractVivaOrderCodeFromJson(raw);
    const transactionId = data.TransactionId ?? data.transactionId;
    const sourceCode = data.SourceCode ?? data.sourceCode ?? "";
    if (!orderCode || typeof transactionId !== "string" || typeof sourceCode !== "string") return supportJson({ error: "Référence incomplète." }, 400);
    // The ledger RPC locks and deduplicates the actual provider transaction atomically.
    // No transient webhook lease can acknowledge an event before its money entry exists.
    const parent = data.ParentId ?? data.parentId;
    await handleSupportWebhook(orderCode, transactionId, sourceCode, typeof parent === "string" ? parent : undefined);
    return supportJson({ ok: true });
  } catch (error) { return supportFailure(error); }
}
