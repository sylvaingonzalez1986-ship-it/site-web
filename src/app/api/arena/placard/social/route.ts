import { NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { isKqPlayerRequestEnabled } from "@/lib/kanab-quest-player-request-access";
import { isKqSameOriginRequest } from "@/lib/kanab-quest-request-origin";
import { getRequestIp, hitRateLimit, logRateLimitRejection } from "@/lib/security-rate-limit";
import { parseKqSocialCommand } from "@/lib/kanab-quest-social";
import { getKqSocial, KqSocialError } from "@/lib/supabase/kanab-quest-social-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };

async function handle(request: Request, mutation = false) {
  try {
    if (!await isKqPlayerRequestEnabled()) return NextResponse.json({ error: "Introuvable." }, { status: 404, headers });
    const session = await getCurrentCustomerSessionByBackend("identity");
    if (!session) return NextResponse.json({ error: "Connecte-toi pour retrouver tes réseaux." }, { status: 401, headers });
    if (mutation && !isKqSameOriginRequest(request)) {
      return NextResponse.json({ error: "Origine non autorisée." }, { status: 403, headers });
    }
    const key = `kq_social:${session.customerId}`;
    const rate = await hitRateLimit({ key, windowSeconds: 60, maxHits: 30 });
    if (!rate.allowed) {
      logRateLimitRejection({ endpoint: `${request.method} /api/arena/placard/social`, key, ip: getRequestIp(request),
        actorEmail: session.customer.email, retryAfterSeconds: rate.retryAfterSeconds, maxHits: 30, windowSeconds: 60 });
      return NextResponse.json({ error: "Patiente un instant avant de réessayer." }, {
        status: 429, headers: { ...headers, "Retry-After": String(rate.retryAfterSeconds) },
      });
    }
    if (!mutation) return NextResponse.json(await getKqSocial(session.customerId), { headers });
    if (Number(request.headers.get("content-length")) > 2048) {
      return NextResponse.json({ error: "Choix trop volumineux." }, { status: 413, headers });
    }
    // Bound actual streamed bytes; the Content-Length header is not authoritative.
    const reader = request.body?.getReader();
    if (!reader) return NextResponse.json({ error: "Choix invalide." }, { status: 400, headers });
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 2048) {
        await reader.cancel();
        return NextResponse.json({ error: "Choix trop volumineux." }, { status: 413, headers });
      }
      chunks.push(part.value);
    }
    let value: unknown;
    try { value = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
    catch { return NextResponse.json({ error: "Choix invalide." }, { status: 400, headers }); }
    const command = parseKqSocialCommand(value);
    if (!command) return NextResponse.json({ error: "Choix invalide." }, { status: 400, headers });
    return NextResponse.json(await getKqSocial(session.customerId, command), { headers });
  } catch (error) {
    if (error instanceof KqSocialError) return NextResponse.json({ error: error.message }, { status: error.status, headers });
    return NextResponse.json({ error: "Les réseaux sont momentanément indisponibles. Réessaie dans un instant." }, { status: 503, headers });
  }
}

export async function GET(request: Request) { return handle(request); }
export async function POST(request: Request) { return handle(request, true); }
