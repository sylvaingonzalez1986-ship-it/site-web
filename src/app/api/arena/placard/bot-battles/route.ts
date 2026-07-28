import { NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { isKqPlayerApiEnabled } from "@/lib/kanab-quest-player-access";
import { getRequestIp, hitRateLimit, logRateLimitRejection } from "@/lib/security-rate-limit";
import { finalizeKqPlayerBotBattle } from "@/lib/supabase/kanab-quest-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isKqPlayerApiEnabled()) return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  const session = await getCurrentCustomerSessionByBackend();
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const rateLimit = await hitRateLimit({
    key: `kq_bot_battle:${session.customerId}:${getRequestIp(request)}`,
    windowSeconds: 3600,
    maxHits: 12,
  });
  if (!rateLimit.allowed) {
    logRateLimitRejection({
      endpoint: "POST /api/arena/placard/bot-battles",
      key: `kq_bot_battle:${session.customerId}:${getRequestIp(request)}`,
      ip: getRequestIp(request),
      actorEmail: session.customer.email,
      retryAfterSeconds: rateLimit.retryAfterSeconds,
      maxHits: 12,
      windowSeconds: 3600,
    });
    return NextResponse.json({ error: "Trop de tentatives rapprochées." }, {
      status: 429,
      headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
    });
  }
  const body = await request.json().catch(() => null) as null | Record<string, unknown>;
  const flowerId = typeof body?.flowerId === "string" ? body.flowerId : "";
  const botCode = typeof body?.botCode === "string" ? body.botCode : "";
  if (!flowerId || !botCode) return NextResponse.json({ error: "Fleur ou bot manquant." }, { status: 400 });
  try {
    return NextResponse.json(await finalizeKqPlayerBotBattle(session.customerId, flowerId, botCode), {
      status: 201,
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Duel d’entraînement impossible.";
    if (message.startsWith("[supabase:")) return NextResponse.json({ error: "Entraînement momentanément indisponible." }, { status: 503 });
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
