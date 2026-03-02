import { NextResponse } from "next/server";
import { logAuditEvent } from "@/lib/audit-log";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { readStoreByBackend } from "@/lib/data-backend";
import {
  buildEmptyLoyaltySummary,
  buildLoyaltySummary,
  buildLoyaltySummaryWithBonus,
} from "@/lib/loyalty";
import {
  LOTTERY_POINTS_PACK_COST,
  LOTTERY_POINTS_PACK_MAX_PER_PURCHASE,
} from "@/lib/lottery-collection";
import {
  getLotteryConfigByBackend,
  getLotteryInventoryForCustomerByBackend,
  listLotteryBonusInstancesForCustomerByBackend,
  getLotteryTicketsForCustomerByBackend,
  purchaseLotteryPacksWithPointsByBackend,
} from "@/lib/lottery-backend";
import { getRequestIp, hitRateLimit, logRateLimitRejection } from "@/lib/security-rate-limit";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getCurrentCustomerSessionByBackend();
  if (!session) {
    return NextResponse.json(
      {
        tickets: [],
        inventory: null,
        config: null,
        loyalty: buildEmptyLoyaltySummary(),
      },
      { status: 401 },
    );
  }

  const ip = getRequestIp(request);
  const rateLimitKey = `account_tickets:${session.customerId}:${ip}`;
  const rateLimit = await hitRateLimit({ key: rateLimitKey, windowSeconds: 60, maxHits: 30 });
  if (!rateLimit.allowed) {
    logRateLimitRejection({
      endpoint: "GET /api/account/tickets",
      key: rateLimitKey,
      ip,
      actorEmail: session.customer.email,
      retryAfterSeconds: rateLimit.retryAfterSeconds,
      maxHits: 30,
      windowSeconds: 60,
    });

    return NextResponse.json(
      { error: "Trop de requetes." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  try {
    const [inventory, tickets, config, bonuses, store] = await Promise.all([
      getLotteryInventoryForCustomerByBackend(session.customerId),
      getLotteryTicketsForCustomerByBackend(session.customerId),
      getLotteryConfigByBackend(),
      listLotteryBonusInstancesForCustomerByBackend(session.customerId),
      readStoreByBackend(),
    ]);

    const orders = store.orders.filter((order) => order.customerId === session.customerId);
    const loyalty = buildLoyaltySummaryWithBonus(
      orders,
      session.customer.loyaltyPoints ?? 0,
      session.customer.loyaltyPointsSpent ?? 0,
    );

    return NextResponse.json({ tickets, inventory, config, bonuses, loyalty });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lecture tickets impossible.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getCurrentCustomerSessionByBackend();
  if (!session) {
    return NextResponse.json({ error: "Non autorise." }, { status: 401 });
  }

  const ip = getRequestIp(request);
  const rateLimitKey = `purchase_packs_with_points:${session.customerId}:${ip}`;
  const rateLimit = await hitRateLimit({ key: rateLimitKey, windowSeconds: 600, maxHits: 10 });
  if (!rateLimit.allowed) {
    logRateLimitRejection({
      endpoint: "POST /api/account/tickets",
      key: rateLimitKey,
      ip,
      actorEmail: session.customer.email,
      retryAfterSeconds: rateLimit.retryAfterSeconds,
      maxHits: 10,
      windowSeconds: 600,
    });

    return NextResponse.json(
      { error: "Trop de requetes." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  try {
    const payload = (await request.json()) as { packCount?: number };
    const packCount = Number(payload.packCount);

    if (
      !Number.isInteger(packCount) ||
      packCount < 1 ||
      packCount > LOTTERY_POINTS_PACK_MAX_PER_PURCHASE
    ) {
      return NextResponse.json(
        {
          error: `Nombre de packs invalide (1-${LOTTERY_POINTS_PACK_MAX_PER_PURCHASE}).`,
        },
        { status: 400 },
      );
    }

    const store = await readStoreByBackend();
    const orders = store.orders.filter((order) => order.customerId === session.customerId);
    const baseLoyalty = buildLoyaltySummary(orders);
    const granted = await purchaseLotteryPacksWithPointsByBackend({
      userId: session.customerId,
      packCount,
      basePoints: baseLoyalty.basePoints,
    });

    const nextLoyalty = buildLoyaltySummaryWithBonus(
      orders,
      session.customer.loyaltyPoints ?? 0,
      (session.customer.loyaltyPointsSpent ?? 0) + granted * LOTTERY_POINTS_PACK_COST,
    );

    logAuditEvent({
      eventType: "customer_purchase_packs_with_points",
      actorEmail: session.customer.email,
      metadata: {
        customerId: session.customerId,
        requestedPackCount: packCount,
        granted,
        costPoints: granted * LOTTERY_POINTS_PACK_COST,
      },
    });

    return NextResponse.json({
      granted,
      costPoints: granted * LOTTERY_POINTS_PACK_COST,
      spendablePoints: nextLoyalty.spendablePoints,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Achat packs impossible.";
    const status = message.startsWith("[supabase:") ? 500 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
