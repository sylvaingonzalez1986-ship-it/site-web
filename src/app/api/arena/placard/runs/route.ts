import { NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { isKqPlayerApiEnabled } from "@/lib/kanab-quest-player-access";
import { getRequestIp, hitRateLimit, logRateLimitRejection } from "@/lib/security-rate-limit";
import { getKqPlayerActiveRun, startKqPlayerRun } from "@/lib/supabase/kanab-quest-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!isKqPlayerApiEnabled()) {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }
  const session = await getCurrentCustomerSessionByBackend("identity");
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  try {
    return NextResponse.json({ activeRun: await getKqPlayerActiveRun(session.customerId) }, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch {
    return NextResponse.json({ error: "Culture momentanément indisponible." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!isKqPlayerApiEnabled()) {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }
  const session = await getCurrentCustomerSessionByBackend("identity");
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const ip = getRequestIp(request);
  const key = `kq_start_run:${session.customerId}:${ip}`;
  const rateLimit = await hitRateLimit({ key, windowSeconds: 600, maxHits: 5 });
  if (!rateLimit.allowed) {
    logRateLimitRejection({
      endpoint: "POST /api/arena/placard/runs",
      key,
      ip,
      actorEmail: session.customer.email,
      retryAfterSeconds: rateLimit.retryAfterSeconds,
      maxHits: 5,
      windowSeconds: 600,
    });
    return NextResponse.json({ error: "Trop de tentatives." }, {
      status: 429,
      headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
    });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }
  const body = payload && typeof payload === "object" && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : {};
  const input = {
    buddieCode: typeof body.buddieCode === "string" ? body.buddieCode : "",
    deckCodes: Array.isArray(body.deckCodes) && body.deckCodes.every((code) => typeof code === "string")
      ? body.deckCodes as string[]
      : [],
    cultureTokens: typeof body.cultureTokens === "number" ? body.cultureTokens : 0,
    heritageCode: typeof body.heritageCode === "string" ? body.heritageCode : undefined,
  };
  try {
    const result = await startKqPlayerRun(session.customerId, input);
    return NextResponse.json(result, {
      status: 201,
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Culture impossible.";
    if (message.startsWith("[supabase:")) {
      return NextResponse.json({ error: "Culture momentanément indisponible." }, { status: 503 });
    }
    const conflict = message.includes("déjà active") || message.includes("disponible");
    return NextResponse.json({ error: message }, { status: conflict ? 409 : 400 });
  }
}
