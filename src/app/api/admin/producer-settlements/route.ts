import { NextResponse } from "next/server";
import { denyIfNotAdminApi } from "@/lib/admin-guard";
import {
  buildProducerSettlementsDashboard,
  parseProducerPayment,
  parseProducerRate,
  parseVoidProducerPayment,
  ProducerSettlementError,
} from "@/lib/producer-settlements";
import {
  getProducerSettlementSources,
  recordProducerPayment,
  saveProducerRate,
  voidProducerPayment,
} from "@/lib/producer-settlements-backend";

export const runtime = "nodejs";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

function failure(error: unknown) {
  if (error instanceof ProducerSettlementError) return json({ error: error.message }, error.status);
  console.error("[admin:producer-settlements] Opération indisponible", error instanceof Error ? error.name : "ServerError");
  return json({ error: "Suivi des producteurs indisponible. Vérifie que la migration des règlements producteurs est appliquée, puis réessaie." }, 503);
}

export async function GET() {
  try {
    const denied = await denyIfNotAdminApi();
    if (denied) return denied;
    return json({ dashboard: buildProducerSettlementsDashboard(await getProducerSettlementSources()) });
  } catch (error) { return failure(error); }
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new ProducerSettlementError("Le contenu doit être au format JSON.", 415);
  }
  const reader = request.body?.getReader();
  if (!reader) throw new ProducerSettlementError("Requête vide.");
  const decoder = new TextDecoder();
  let size = 0;
  let content = "";
  for (;;) {
    const result = await reader.read();
    if (result.done) break;
    size += result.value.byteLength;
    if (size > 16384) {
      await reader.cancel();
      throw new ProducerSettlementError("Requête trop volumineuse.", 413);
    }
    content += decoder.decode(result.value, { stream: true });
  }
  content += decoder.decode();
  let body: unknown;
  try { body = JSON.parse(content); } catch { throw new ProducerSettlementError("Requête JSON invalide."); }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ProducerSettlementError("Requête JSON invalide.");
  return body as Record<string, unknown>;
}

export async function POST(request: Request) {
  try {
    const denied = await denyIfNotAdminApi();
    if (denied) return denied;
    if (request.headers.get("origin") !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site") {
      return json({ error: "Origine de la requête invalide." }, 403);
    }
    const body = await readBody(request);
    if (body.action === "rate") {
      await saveProducerRate(parseProducerRate(body));
    } else if (body.action === "payment") {
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
      await recordProducerPayment(parseProducerPayment(body, today));
    } else if (body.action === "void") {
      const { id, reason } = parseVoidProducerPayment(body);
      await voidProducerPayment(id, reason);
    } else {
      throw new ProducerSettlementError("Action inconnue.");
    }
    return json({ ok: true });
  } catch (error) { return failure(error); }
}
