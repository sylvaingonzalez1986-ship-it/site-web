import { NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend, isAtLeast18 } from "@/lib/customer-backend";
import { burnLotteryRewardLineByBackend } from "@/lib/lottery-backend";
import { getRequestIp, hitRateLimit, logRateLimitRejection } from "@/lib/security-rate-limit";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ lineId: string }> },
) {
  const session = await getCurrentCustomerSessionByBackend();
  if (!session) {
    return NextResponse.json({ error: "Non autorise." }, { status: 401 });
  }

  if (!session.customer.dateOfBirth || !isAtLeast18(session.customer.dateOfBirth)) {
    return NextResponse.json(
      { error: "Action reservee aux personnes majeures (18+)." },
      { status: 403 },
    );
  }

  const { lineId } = await params;
  const ip = getRequestIp(request);
  const rateLimitKey = `lottery_burn:${session.customerId}:${lineId}:${ip}`;
  const rateLimit = await hitRateLimit({ key: rateLimitKey, windowSeconds: 10, maxHits: 5 });

  if (!rateLimit.allowed) {
    logRateLimitRejection({
      endpoint: "POST /api/account/lottery/lines/[lineId]/burn",
      key: rateLimitKey,
      ip,
      actorEmail: session.customer.email,
      retryAfterSeconds: rateLimit.retryAfterSeconds,
      maxHits: 5,
      windowSeconds: 10,
    });

    return NextResponse.json(
      { error: "Trop de tentatives. Reessaie dans un instant." },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds),
        },
      },
    );
  }

  try {
    const rewardClaim = await burnLotteryRewardLineByBackend({
      userId: session.customerId,
      lineId,
    });

    return NextResponse.json({ rewardClaim });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Burn loterie impossible.";

    if (message.includes("lottery_reward_line_not_found")) {
      return NextResponse.json({ error: "Ligne introuvable." }, { status: 404 });
    }

    if (message.includes("lottery_reward_line_unavailable")) {
      return NextResponse.json(
        { error: "Cette ligne a deja ete convertie ou n'est plus disponible." },
        { status: 409 },
      );
    }

    if (message.includes("lottery_reward_line_frozen")) {
      return NextResponse.json(
        { error: "Cette ligne est gelee et ne peut pas etre convertie pour le moment." },
        { status: 409 },
      );
    }

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
