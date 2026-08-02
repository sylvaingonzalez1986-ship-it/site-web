import { NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { readStoreByBackend } from "@/lib/data-backend";
import { buildLoyaltySummary, buildLoyaltySummaryWithBonus } from "@/lib/loyalty";
import {
  getKqSupportBoosterShopSnapshot,
  claimKqWelcomeSupportBooster,
  openKqSupportBoosterEntitlement,
  purchaseKqSupportBoostersWithPoints,
} from "@/lib/supabase/kanab-quest-backend";
import { getRequestIp, hitRateLimit, logRateLimitRejection } from "@/lib/security-rate-limit";
import { isKqPlayerApiEnabled } from "@/lib/kanab-quest-player-access";

export const runtime = "nodejs";

function publicBoosterError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  return message.startsWith("[supabase:")
    ? { message: "Service momentanément indisponible.", status: 500 }
    : { message, status: 400 };
}

async function getContext() {
  const session = await getCurrentCustomerSessionByBackend();
  if (!session) return null;
  const store = await readStoreByBackend();
  const orders = store.orders.filter((order) => order.customerId === session.customerId);
  const baseLoyalty = buildLoyaltySummary(orders);
  const loyalty = buildLoyaltySummaryWithBonus(
    orders,
    session.customer.loyaltyPoints ?? 0,
    session.customer.loyaltyPointsSpent ?? 0,
  );
  return { session, baseLoyalty, loyalty };
}

export async function GET() {
  if (!isKqPlayerApiEnabled()) return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  const context = await getContext();
  if (!context) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  try {
    const shop = await getKqSupportBoosterShopSnapshot(context.session.customerId);
    return NextResponse.json({ ...shop, spendablePoints: context.loyalty.spendablePoints });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Boutique La Botte indisponible." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  if (!isKqPlayerApiEnabled()) return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  const context = await getContext();
  if (!context) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const rate = await hitRateLimit({
    key: `kq_support_purchase:${context.session.customerId}:${getRequestIp(request)}`,
    windowSeconds: 600,
    maxHits: 10,
  });
  if (!rate.allowed) {
    logRateLimitRejection({ endpoint: "POST /api/arena/placard/boosters", key: `kq_support_purchase:${context.session.customerId}:${getRequestIp(request)}`, ip: getRequestIp(request), actorEmail: context.session.customer.email, retryAfterSeconds: rate.retryAfterSeconds, maxHits: 10, windowSeconds: 600 });
    return NextResponse.json(
      { error: "Trop de tentatives.", retryAfterSeconds: rate.retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }
  try {
    const payload = await request.json() as { packCount?: number; requestKey?: string };
    const purchase = await purchaseKqSupportBoostersWithPoints({
      userId: context.session.customerId,
      requestKey: String(payload.requestKey ?? ""),
      packCount: Number(payload.packCount),
      basePoints: context.baseLoyalty.basePoints,
    });
    return NextResponse.json(purchase);
  } catch (error) {
    const failure = publicBoosterError(error, "Achat La Botte impossible.");
    return NextResponse.json({ error: failure.message }, { status: failure.status });
  }
}

export async function PUT(request: Request) {
  if (!isKqPlayerApiEnabled()) return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  const context = await getContext();
  if (!context) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const ip = getRequestIp(request);
  const key = `kq_support_welcome:${context.session.customerId}:${ip}`;
  const rate = await hitRateLimit({ key, windowSeconds: 600, maxHits: 5 });
  if (!rate.allowed) {
    logRateLimitRejection({ endpoint: "PUT /api/arena/placard/boosters", key, ip, actorEmail: context.session.customer.email, retryAfterSeconds: rate.retryAfterSeconds, maxHits: 5, windowSeconds: 600 });
    return NextResponse.json({ error: "Trop de tentatives." }, {
      status: 429,
      headers: { "Retry-After": String(rate.retryAfterSeconds) },
    });
  }
  try {
    return NextResponse.json(await claimKqWelcomeSupportBooster(context.session.customerId));
  } catch (error) {
    const failure = publicBoosterError(error, "Réclamation impossible.");
    return NextResponse.json({ error: failure.message }, { status: failure.status });
  }
}

export async function PATCH(request: Request) {
  if (!isKqPlayerApiEnabled()) return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  const context = await getContext();
  if (!context) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const rate = await hitRateLimit({
    key: `kq_support_open:${context.session.customerId}:${getRequestIp(request)}`,
    windowSeconds: 60,
    maxHits: 15,
  });
  if (!rate.allowed) {
    logRateLimitRejection({ endpoint: "PATCH /api/arena/placard/boosters", key: `kq_support_open:${context.session.customerId}:${getRequestIp(request)}`, ip: getRequestIp(request), actorEmail: context.session.customer.email, retryAfterSeconds: rate.retryAfterSeconds, maxHits: 15, windowSeconds: 60 });
    return NextResponse.json(
      { error: "Trop de tentatives.", retryAfterSeconds: rate.retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }
  try {
    const payload = await request.json() as { entitlementId?: string };
    const opening = await openKqSupportBoosterEntitlement(
      context.session.customerId,
      String(payload.entitlementId ?? ""),
    );
    return NextResponse.json(opening);
  } catch (error) {
    const failure = publicBoosterError(error, "Ouverture La Botte impossible.");
    return NextResponse.json({ error: failure.message }, { status: failure.status });
  }
}
