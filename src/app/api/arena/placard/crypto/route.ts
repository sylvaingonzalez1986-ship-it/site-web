import { KqCryptoRequestError } from "@/lib/kanab-quest-crypto";
import { NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { isKqPlayerRequestEnabled } from "@/lib/kanab-quest-player-request-access";
import { getRequestIp, hitRateLimit, logRateLimitRejection } from "@/lib/security-rate-limit";
import { getKqCryptoSnapshot, handleKqCryptoAction } from "@/lib/supabase/kanab-quest-crypto-backend";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store, max-age=0" };
function failure(error: unknown) {
 const message = error instanceof Error ? error.message : "[supabase:crypto] unavailable";
 const unavailable = !(error instanceof KqCryptoRequestError);
 return NextResponse.json({ error: unavailable ? "Le comptoir crypto est momentanément indisponible. Réessaie dans un instant." : message }, { status: unavailable ? 503 : 400, headers });
}
async function access(request: Request) {
 if (!await isKqPlayerRequestEnabled()) return NextResponse.json({ error: "Introuvable." }, { status: 404, headers });
 const session = await getCurrentCustomerSessionByBackend("identity");
 if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401, headers });
 const ip = getRequestIp(request), key = `kq_crypto:${session.customerId}`;
 const rate = await hitRateLimit({ key, windowSeconds: 60, maxHits: 30 });
 if (!rate.allowed) {
  logRateLimitRejection({ endpoint: `${request.method} /api/arena/placard/crypto`, key, ip, actorEmail: session.customer.email, retryAfterSeconds: rate.retryAfterSeconds, maxHits: 30, windowSeconds: 60 });
  return NextResponse.json({ error: "Patiente un instant avant de réessayer." }, { status: 429, headers: { ...headers, "Retry-After": String(rate.retryAfterSeconds) } });
 }
 return session;
}
export async function GET(request: Request) {
 try { const session = await access(request); if (session instanceof Response) return session;
  return NextResponse.json(await getKqCryptoSnapshot(session.customerId), { headers });
 } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
 try { const session = await access(request); if (session instanceof Response) return session;
  const origin = request.headers.get("origin");
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site") return NextResponse.json({ error: "Origine non autorisée." }, { status: 403, headers });
  if (Number(request.headers.get("content-length") ?? "0") > 2048) return NextResponse.json({ error: "Ordre crypto invalide." }, { status: 413, headers });
  const reader = request.body?.getReader();
  if (!reader) return NextResponse.json({ error: "Ordre crypto invalide." }, { status: 400, headers });
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
   const part = await reader.read(); if (part.done) break;
   size += part.value.byteLength;
   if (size > 2048) { await reader.cancel(); return NextResponse.json({ error: "Ordre crypto invalide." }, { status: 413, headers }); }
   chunks.push(part.value);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  let body: unknown; try { body = JSON.parse(text); } catch { throw new KqCryptoRequestError("Ordre crypto invalide."); }
  return NextResponse.json(await handleKqCryptoAction(session.customerId, body), { headers });
 } catch (error) { return failure(error); }
}
