import "server-only";

import { NextResponse } from "next/server";
import { denyIfNotAdminApi } from "@/lib/admin-guard";
import { isMailingUuid, MailingValidationError } from "@/lib/mailing-policy";
import { hitRateLimit } from "@/lib/security-rate-limit";

const NO_STORE = { "Cache-Control": "private, no-store" };

export function mailingJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

export async function guardMailingRequest(request?: Request, action = "read"): Promise<NextResponse | null> {
  const denied = await denyIfNotAdminApi();
  if (denied) return denied;
  if (!request || action === "read") return null;
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site") {
    return mailingJson({ error: "Origine de la requête invalide." }, 403);
  }
  const rate = await hitRateLimit({ key: `admin:mailing:${action}`, windowSeconds: action === "test" ? 900 : 60, maxHits: action === "test" ? 5 : action === "process" ? 120 : 30 });
  if (!rate.allowed) {
    return NextResponse.json({ error: "Trop de tentatives. Réessaie dans quelques instants." }, { status: 429, headers: { ...NO_STORE, "Retry-After": String(rate.retryAfterSeconds) } });
  }
  return null;
}

export async function readMailingJson(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new MailingValidationError("Le contenu doit être au format JSON.", 415);
  }
  const maxBytes = 3 * 1024 * 1024;
  if (Number(request.headers.get("content-length")) > maxBytes) throw new MailingValidationError("Requête trop volumineuse.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new MailingValidationError("Requête vide.");
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  for (;;) {
    const result = await reader.read();
    if (result.done) break;
    size += result.value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new MailingValidationError("Requête trop volumineuse.", 413);
    }
    text += decoder.decode(result.value, { stream: true });
  }
  text += decoder.decode();
  try {
    const body: unknown = JSON.parse(text);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body as Record<string, unknown>;
  } catch {
    throw new MailingValidationError("Requête JSON invalide.");
  }
}

export function requireMailingId(id: string): string {
  if (!isMailingUuid(id)) throw new MailingValidationError("Campagne introuvable.", 404);
  return id;
}

export function mailingApiError(error: unknown): NextResponse {
  if (error instanceof MailingValidationError) return mailingJson({ error: error.message }, error.status);
  // Neither database errors nor SMTP responses should reveal contact data or secrets.
  console.error("[admin:mailing] Opération indisponible", error instanceof Error ? error.name : "ServerError");
  return mailingJson({ error: "Centre de mailing indisponible. Vérifie la migration mailing et la configuration serveur, puis réessaie." }, 503);
}
