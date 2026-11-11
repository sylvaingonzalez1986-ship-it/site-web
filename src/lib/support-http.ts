import "server-only";
import { NextResponse } from "next/server";
import { readRequestBody } from "@/lib/body-size-guard";
import { getRequestIp, hitRateLimit } from "@/lib/security-rate-limit";
import { SupportError } from "@/lib/support-campaign";

export function supportJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
}
export function supportFailure(error: unknown) {
  if (error instanceof SupportError) return supportJson({ error: error.message }, error.status);
  console.error("[support] Operation unavailable", error instanceof Error ? error.name : "UnknownError");
  return supportJson({ error: "La cagnotte est momentanément indisponible. Réessaie dans quelques instants." }, 503);
}
export async function supportRateLimit(request: Request, action: string, maxHits = 30, windowSeconds = 60) {
  const result = await hitRateLimit({ key: `support:${action}:${getRequestIp(request)}`, windowSeconds, maxHits });
  if (!result.allowed) return NextResponse.json({ error: "Trop de tentatives. Patiente un instant avant de réessayer." },
    { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds), "Cache-Control": "no-store" } });
  return null;
}
export function requireSupportOrigin(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new SupportError("Origine de la requête invalide.", 403);
  }
}
export async function readSupportBody(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new SupportError("Le contenu doit être au format JSON.", 415);
  const bounded = await readRequestBody(request, 4096);
  if (!bounded.ok) throw new SupportError("Requête vide ou trop volumineuse.", bounded.response.status);
  let body: unknown;
  try { body = await bounded.body.json(); } catch { throw new SupportError("Requête JSON invalide."); }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new SupportError("Requête JSON invalide.");
  return body as Record<string, unknown>;
}
