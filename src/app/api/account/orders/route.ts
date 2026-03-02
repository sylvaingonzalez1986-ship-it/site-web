import { NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { readStoreByBackend } from "@/lib/data-backend";
import { buildEmptyLoyaltySummary, buildLoyaltySummaryWithBonus } from "@/lib/loyalty";
import { getRequestIp, hitRateLimit, logRateLimitRejection } from "@/lib/security-rate-limit";

export async function GET(request: Request) {
  const session = await getCurrentCustomerSessionByBackend();
  if (!session) {
    return NextResponse.json(
      { orders: [], loyalty: buildEmptyLoyaltySummary() },
      { status: 401 },
    );
  }

  const ip = getRequestIp(request);
  const rateLimitKey = `account_orders:${session.customerId}:${ip}`;
  const rateLimit = await hitRateLimit({ key: rateLimitKey, windowSeconds: 60, maxHits: 30 });
  if (!rateLimit.allowed) {
    logRateLimitRejection({
      endpoint: "GET /api/account/orders",
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

  const store = await readStoreByBackend();
  const orders = store.orders.filter((order) => order.customerId === session.customerId);
  const loyalty = buildLoyaltySummaryWithBonus(
    orders,
    session.customer.loyaltyPoints ?? 0,
    session.customer.loyaltyPointsSpent ?? 0,
  );

  return NextResponse.json({ orders, loyalty });
}
