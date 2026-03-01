import { NextRequest, NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend, isAtLeast18 } from "@/lib/customer-backend";
import { claimCollectionPageRewardByBackend } from "@/lib/lottery-backend";
import { isValidCollectionPageRarity } from "@/lib/lottery-collection";
import { getRequestIp, hitRateLimit } from "@/lib/security-rate-limit";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = await getCurrentCustomerSessionByBackend();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  if (!session.customer.dateOfBirth || !isAtLeast18(session.customer.dateOfBirth)) {
    return NextResponse.json(
      { error: "Action réservée aux personnes majeures (18+)." },
      { status: 403 },
    );
  }

  const ip = getRequestIp(request);
  const rateLimit = await hitRateLimit({
    key: `collection_claim:${session.customerId}:${ip}`,
    windowSeconds: 10,
    maxHits: 5,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessaie dans un instant." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  let body: { pageRarity?: string; rewardDefinitionId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const { pageRarity, rewardDefinitionId } = body;

  if (!pageRarity || !isValidCollectionPageRarity(pageRarity)) {
    return NextResponse.json({ error: "Rareté invalide." }, { status: 400 });
  }
  if (!rewardDefinitionId || typeof rewardDefinitionId !== "string") {
    return NextResponse.json({ error: "Récompense non spécifiée." }, { status: 400 });
  }

  try {
    const claim = await claimCollectionPageRewardByBackend({
      userId: session.customerId,
      pageRarity,
      rewardDefinitionId,
    });

    return NextResponse.json({ claim });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Réclamation impossible.";
    if (message === "page_not_complete") {
      return NextResponse.json({ error: "Page non complétée." }, { status: 400 });
    }
    if (message === "page_already_claimed") {
      return NextResponse.json({ error: "Récompense déjà réclamée." }, { status: 409 });
    }
    if (message === "invalid_reward_choice") {
      return NextResponse.json({ error: "Choix de récompense invalide." }, { status: 400 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
