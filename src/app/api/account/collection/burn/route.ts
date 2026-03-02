import { NextRequest, NextResponse } from "next/server";
import { logAuditEvent } from "@/lib/audit-log";
import { getCurrentCustomerSessionByBackend, isAtLeast18 } from "@/lib/customer-backend";
import { burnDuplicateCardsByBackend } from "@/lib/lottery-backend";
import { isBurnableRarity, LOTTERY_DUPLICATE_BURN_RULES } from "@/lib/lottery-collection";
import { getRequestIp, hitRateLimit } from "@/lib/security-rate-limit";
import type { LotteryBurnableRarity, LotteryDuplicateBurnChoice } from "@/types/lottery";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = await getCurrentCustomerSessionByBackend();
  if (!session) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  if (!session.customer.dateOfBirth || !isAtLeast18(session.customer.dateOfBirth)) {
    return NextResponse.json({ error: "Action reservee aux personnes majeures (18+)." }, { status: 403 });
  }

  const ip = getRequestIp(request);
  const rateLimit = await hitRateLimit({
    key: `collection_burn:${session.customerId}:${ip}`,
    windowSeconds: 10,
    maxHits: 5,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Trop de tentatives. Reessaie dans un instant." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  let body: { rarity?: string; instanceIds?: string[]; rewardChoice?: LotteryDuplicateBurnChoice };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps de requete invalide." }, { status: 400 });
  }

  const { rarity, instanceIds, rewardChoice } = body;

  if (!rarity || !isBurnableRarity(rarity)) {
    return NextResponse.json({ error: "Rarete invalide ou non recyclable." }, { status: 400 });
  }
  if (!Array.isArray(instanceIds) || instanceIds.length === 0) {
    return NextResponse.json({ error: "Aucune instance fournie." }, { status: 400 });
  }
  if (rewardChoice !== "discount" && rewardChoice !== "gift") {
    return NextResponse.json({ error: "Choix de recompense invalide." }, { status: 400 });
  }

  const burnRules = LOTTERY_DUPLICATE_BURN_RULES[rarity as LotteryBurnableRarity];

  try {
    const claim = await burnDuplicateCardsByBackend({
      userId: session.customerId,
      rarity: rarity as LotteryBurnableRarity,
      instanceIds,
      rewardChoice,
      discountPercent: burnRules.discountPercent,
      giftWeightGrams: burnRules.giftWeightGrams,
    });

    logAuditEvent({
      eventType: "customer_burn_duplicates",
      actorEmail: session.customer.email,
      ip,
      metadata: {
        customerId: session.customerId,
        rarity,
        rewardChoice,
        instanceCount: instanceIds.length,
        claimId: claim.id,
      },
    });

    return NextResponse.json({ claim });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Recyclage impossible.";
    if (message === "wrong_instance_count") {
      return NextResponse.json({ error: `Il faut exactement ${burnRules.duplicatesRequired} doublons.` }, { status: 400 });
    }
    if (message === "invalid_instances") {
      return NextResponse.json({ error: "Instances invalides." }, { status: 400 });
    }
    if (message === "burn_legendary_not_allowed") {
      return NextResponse.json({ error: "Les cartes legendaires ne peuvent pas etre recyclees." }, { status: 400 });
    }
    if (message === "burn_would_remove_last_copy") {
      return NextResponse.json({ error: "Le recyclage supprimerait la derniere copie d'une carte." }, { status: 400 });
    }
    if (message === "burn_reward_kind_invalid" || message === "burn_discount_invalid" || message === "burn_gift_invalid") {
      return NextResponse.json({ error: "Recompense de recyclage invalide." }, { status: 400 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
