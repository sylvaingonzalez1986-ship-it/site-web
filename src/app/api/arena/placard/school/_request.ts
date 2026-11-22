import { NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { isKqGameRequestEnabled } from "@/lib/kanab-quest-player-request-access";
import { isKqSameOriginRequest } from "@/lib/kanab-quest-request-origin";
import { getRequestIp, hitRateLimit, logRateLimitRejection } from "@/lib/security-rate-limit";
import { KqSchoolError } from "@/lib/kanab-quest-school-server";

const headers = { "Cache-Control": "private, no-store, max-age=0" };
export async function schoolRequest(request: Request, operation: (userId: string) => Promise<unknown> | unknown) {
  try {
    if (!await isKqGameRequestEnabled()) return NextResponse.json({ error: "Introuvable." }, { status: 404, headers });
    const session = await getCurrentCustomerSessionByBackend("identity");
    if (!session) return NextResponse.json({ error: "Connecte-toi pour retrouver ta progression à l’école." }, { status: 401, headers });
    if (request.method !== "GET" && !isKqSameOriginRequest(request)) return NextResponse.json({ error: "Origine non autorisée." }, { status: 403, headers });
    const expectedOwner = request.headers.get("x-kq-school-owner");
    if (request.method !== "GET" && expectedOwner !== null && expectedOwner.toLowerCase() !== session.customerId.toLowerCase()) {
      return NextResponse.json({ error: "Le compte connecté a changé. Retrouve la progression du compte actuel avant de continuer.", code: "school_owner_changed" }, { status: 409, headers });
    }
    const submitting = request.method === "POST" && new URL(request.url).pathname.endsWith("/quiz");
    const challenge = new URL(request.url).pathname.endsWith("/challenge");
    const tournament = new URL(request.url).pathname.endsWith("/tournament");
    const key = `kq_school${tournament ? "_tournament" : challenge ? "_challenge" : submitting ? "_submit" : ""}:${session.customerId}`;
    const maxHits = tournament || challenge ? 120 : submitting ? 12 : 40;
    const rate = await hitRateLimit({ key, windowSeconds: 60, maxHits });
    if (!rate.allowed) {
      logRateLimitRejection({ endpoint: `${request.method} ${new URL(request.url).pathname}`, key,
        ip: getRequestIp(request), actorEmail: session.customer.email, retryAfterSeconds: rate.retryAfterSeconds, maxHits, windowSeconds: 60 });
      return NextResponse.json({ error: "Patiente un instant avant de réessayer. Tes réponses restent disponibles." },
        { status: 429, headers: { ...headers, "Retry-After": String(rate.retryAfterSeconds) } });
    }
    return NextResponse.json(await operation(session.customerId), { headers });
  } catch (error) {
    if (error instanceof KqSchoolError) return NextResponse.json({ error: error.message, ...(error.code ? { code: error.code } : {}) }, { status: error.status, headers });
    return NextResponse.json({ error: "L’école est momentanément indisponible. Conserve tes réponses et réessaie dans un instant." }, { status: 503, headers });
  }
}

export async function readSchoolBody(request: Request): Promise<unknown> {
  const maximum = 8192;
  if (Number(request.headers.get("content-length")) > maximum) throw new KqSchoolError("Tentative trop volumineuse.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new KqSchoolError("Tentative invalide.", 400);
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const part = await reader.read(); if (part.done) break;
    size += part.value.byteLength;
    if (size > maximum) { await reader.cancel(); throw new KqSchoolError("Tentative trop volumineuse.", 413); }
    chunks.push(part.value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown; }
  catch { throw new KqSchoolError("Tentative invalide.", 400); }
}
