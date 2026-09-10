import { NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { isKqPlayerApiEnabled } from "@/lib/kanab-quest-player-access";
import { getRequestIp, hitRateLimit, logRateLimitRejection } from "@/lib/security-rate-limit";
import {
  enqueueKqPlayerRandomBattle,
  getKqPlayerBattles,
  leaveKqPlayerRandomBattleQueue,
  reconcileKqPlayerRandomBattleQueue,
} from "@/lib/supabase/kanab-quest-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!isKqPlayerApiEnabled()) {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }
  const session = await getCurrentCustomerSessionByBackend("identity");
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  try {
    return NextResponse.json({ battles: await getKqPlayerBattles(session.customerId, 12) }, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch {
    return NextResponse.json({ error: "Duels momentanément indisponibles." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!isKqPlayerApiEnabled()) {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }
  const session = await getCurrentCustomerSessionByBackend("identity");
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }
  const body = payload && typeof payload === "object" && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : {};
  const flowerId = typeof body.flowerId === "string" ? body.flowerId : "";
  const action = body.action === "leave" ? "leave" : body.action === "poll" ? "poll" : "join";
  if (!flowerId) return NextResponse.json({ error: "Une Fleur est requise." }, { status: 400 });
  const ip = getRequestIp(request);
  const maxHits = action === "poll" ? 70 : 10;
  const key = `kq_${action}_battle:${session.customerId}:${ip}`;
  const rateLimit = await hitRateLimit({ key, windowSeconds: 600, maxHits });
  if (!rateLimit.allowed) {
    logRateLimitRejection({
      endpoint: "POST /api/arena/placard/battles",
      key,
      ip,
      actorEmail: session.customer.email,
      retryAfterSeconds: rateLimit.retryAfterSeconds,
      maxHits,
      windowSeconds: 600,
    });
    return NextResponse.json({ error: "Trop de tentatives de duel." }, {
      status: 429,
      headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
    });
  }
  try {
    const result = action === "leave"
      ? await leaveKqPlayerRandomBattleQueue(session.customerId, flowerId)
      : action === "poll"
        ? await reconcileKqPlayerRandomBattleQueue(session.customerId, flowerId)
        : await enqueueKqPlayerRandomBattle(session.customerId, flowerId);
    return NextResponse.json(result, {
      status: action === "join" ? 201 : 200,
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "File de duel impossible.";
    if (message.startsWith("[supabase:")) {
      return NextResponse.json({ error: "Duel momentanément indisponible." }, { status: 503 });
    }
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
