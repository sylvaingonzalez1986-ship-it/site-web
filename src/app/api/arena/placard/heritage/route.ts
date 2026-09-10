import { NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { isKqPlayerRequestEnabled } from "@/lib/kanab-quest-player-request-access";
import { getRequestIp, hitRateLimit, logRateLimitRejection } from "@/lib/security-rate-limit";
import { craftKqPlayerHeritageCard, getKqPlayerHeritageSnapshot } from "@/lib/supabase/kanab-quest-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!await isKqPlayerRequestEnabled()) {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }
  const session = await getCurrentCustomerSessionByBackend("identity");
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  try {
    const snapshot = await getKqPlayerHeritageSnapshot(session.customerId);
    return NextResponse.json({
      collectionActive: snapshot.collectionActive,
      fragmentBalance: snapshot.fragmentBalance,
      cards: snapshot.cards.map((card) => ({
        code: card.code,
        name: card.name,
        description: card.description,
        imageUrl: card.imageUrl,
        isActive: card.isActive,
        ownedCopies: card.ownedCopies,
        producerId: card.producerId,
        producerName: card.producerName,
        producerNames: card.producerNames,
      })),
    }, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch {
    return NextResponse.json({ error: "Collection Héritage indisponible." }, { status: 503 });
  }
}

const PUBLIC_CRAFT_ERRORS = new Set([
  "La fabrication Héritage n’est pas encore active.",
  "Cet Héritage est déjà dans la collection.",
  "Solde de fragments insuffisant.",
]);

export async function POST(request: Request) {
  if (!await isKqPlayerRequestEnabled()) {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }
  const session = await getCurrentCustomerSessionByBackend("identity");
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const ip = getRequestIp(request);
  const rateLimitKey = `kq_heritage_craft:${session.customerId}:${ip}`;
  const rate = await hitRateLimit({ key: rateLimitKey, windowSeconds: 600, maxHits: 12 });
  if (!rate.allowed) {
    logRateLimitRejection({
      endpoint: "POST /api/arena/placard/heritage",
      key: rateLimitKey,
      ip,
      actorEmail: session.customer.email,
      retryAfterSeconds: rate.retryAfterSeconds,
      maxHits: 12,
      windowSeconds: 600,
    });
    return NextResponse.json({ error: "Trop de tentatives.", retryAfterSeconds: rate.retryAfterSeconds }, {
      status: 429,
      headers: { "Retry-After": String(rate.retryAfterSeconds) },
    });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }
  const body = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const cardCode = typeof body.cardCode === "string" ? body.cardCode.trim() : "";
  if (!/^HERITAGE-[0-9]{3,6}$/.test(cardCode)) {
    return NextResponse.json({ error: "Héritage invalide." }, { status: 400 });
  }

  try {
    return NextResponse.json(await craftKqPlayerHeritageCard(session.customerId, cardCode), {
      status: 201,
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    const message = error instanceof Error && PUBLIC_CRAFT_ERRORS.has(error.message)
      ? error.message
      : "Fabrication impossible.";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
