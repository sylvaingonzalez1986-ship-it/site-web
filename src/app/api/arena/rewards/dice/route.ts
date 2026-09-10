import { NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { isKqPlayerRequestEnabled } from "@/lib/kanab-quest-player-request-access";
import { getRequestIp, hitRateLimit, logRateLimitRejection } from "@/lib/security-rate-limit";
import {
  getArenaCustomerRewardDiceState,
  rollArenaCustomerRewardDice,
} from "@/lib/supabase/arena-customer-rewards-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getPlayer() {
  if (!await isKqPlayerRequestEnabled()) return {
    ok: false as const,
    response: NextResponse.json({ error: "Introuvable." }, { status: 404 }),
  };
  const session = await getCurrentCustomerSessionByBackend("identity");
  if (!session) return {
    ok: false as const,
    response: NextResponse.json({ error: "Non autorisé." }, { status: 401 }),
  };
  return { ok: true as const, session };
}

export async function GET() {
  const player = await getPlayer();
  if (!player.ok) return player.response;
  try {
    return NextResponse.json(await getArenaCustomerRewardDiceState(player.session.customerId), {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch {
    return NextResponse.json({ error: "Lancer collectif momentanément indisponible." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const player = await getPlayer();
  if (!player.ok) return player.response;
  const ip = getRequestIp(request);
  const key = `arena_reward_dice:${player.session.customerId}:${ip}`;
  const rateLimit = await hitRateLimit({ key, windowSeconds: 300, maxHits: 5 });
  if (!rateLimit.allowed) {
    logRateLimitRejection({
      endpoint: "POST /api/arena/rewards/dice",
      key,
      ip,
      actorEmail: player.session.customer.email,
      retryAfterSeconds: rateLimit.retryAfterSeconds,
      maxHits: 5,
      windowSeconds: 300,
    });
    return NextResponse.json({ error: "Trop de tentatives rapprochées." }, {
      status: 429,
      headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
    });
  }
  try {
    return NextResponse.json(await rollArenaCustomerRewardDice(player.session.customerId), {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lancer impossible.";
    if (message.startsWith("[supabase:")) {
      return NextResponse.json({ error: "Lancer collectif momentanément indisponible." }, { status: 503 });
    }
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
