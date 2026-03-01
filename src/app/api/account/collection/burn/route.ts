import { NextRequest, NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend, isAtLeast18 } from "@/lib/customer-backend";
import { burnDuplicateCardsByBackend } from "@/lib/lottery-backend";
import { isBurnableRarity, LOTTERY_DUPLICATE_BURN_RULES } from "@/lib/lottery-collection";
import { getRequestIp, hitRateLimit } from "@/lib/security-rate-limit";
import type { LotteryBurnableRarity } from "@/types/lottery";

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
    key: `collection_burn:${session.customerId}:${ip}`,
    windowSeconds: 10,
    maxHits: 5,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessaie dans un instant." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  let body: { rarity?: string; instanceIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const { rarity, instanceIds } = body;

  if (!rarity || !isBurnableRarity(rarity)) {
    return NextResponse.json({ error: "Rareté invalide ou non recyclable." }, { status: 400 });
  }
  if (!Array.isArray(instanceIds) || instanceIds.length === 0) {
    return NextResponse.json({ error: "Aucune instance fournie." }, { status: 400 });
  }

  const burnRules = LOTTERY_DUPLICATE_BURN_RULES[rarity as LotteryBurnableRarity];

  try {
    const claim = await burnDuplicateCardsByBackend({
      userId: session.customerId,
      rarity: rarity as LotteryBurnableRarity,
      instanceIds,
      discountPercent: burnRules.discountPercent,
    });

    return NextResponse.json({ claim });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Recyclage impossible.";
    if (message === "wrong_instance_count") {
      return NextResponse.json({ error: "Il faut exactement 5 doublons." }, { status: 400 });
    }
    if (message === "invalid_instances") {
      return NextResponse.json({ error: "Instances invalides." }, { status: 400 });
    }
    if (message === "burn_legendary_not_allowed") {
      return NextResponse.json({ error: "Les cartes légendaires ne peuvent pas être recyclées." }, { status: 400 });
    }
    if (message === "burn_would_remove_last_copy") {
      return NextResponse.json({ error: "Le recyclage supprimerait la dernière copie d'une carte." }, { status: 400 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
