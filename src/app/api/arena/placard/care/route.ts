import { NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { isKqPlayerRequestEnabled } from "@/lib/kanab-quest-player-request-access";
import { getRequestIp, hitRateLimit, logRateLimitRejection } from "@/lib/security-rate-limit";
import { getKqCareShopSnapshot, purchaseKqCareProduct } from "@/lib/supabase/kanab-quest-care-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "Suivi indisponible.";
  return NextResponse.json({ error: message.startsWith("[supabase:") ? "Service momentanément indisponible." : message }, { status: message.startsWith("[supabase:") ? 503 : 400 });
}

export async function GET() {
  if (!await isKqPlayerRequestEnabled()) return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  const session = await getCurrentCustomerSessionByBackend("identity");
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  try { return NextResponse.json(await getKqCareShopSnapshot(session.customerId), { headers }); }
  catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  if (!await isKqPlayerRequestEnabled()) return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  const session = await getCurrentCustomerSessionByBackend("identity");
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const ip = getRequestIp(request);
  const key = `kq_care_purchase:${session.customerId}:${ip}`;
  const rate = await hitRateLimit({ key, windowSeconds: 60, maxHits: 20 });
  if (!rate.allowed) {
    logRateLimitRejection({ endpoint: "POST /api/arena/placard/care", key, ip, actorEmail: session.customer.email, retryAfterSeconds: rate.retryAfterSeconds, maxHits: 20, windowSeconds: 60 });
    return NextResponse.json({ error: "Trop de tentatives." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  }
  let raw: unknown;
  try { raw = await request.json(); } catch { return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 }); }
  const body = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  if (typeof body.productCode !== "string" || typeof body.requestKey !== "string" || typeof body.quantity !== "number") {
    return NextResponse.json({ error: "Achat invalide." }, { status: 400 });
  }
  try {
    return NextResponse.json(await purchaseKqCareProduct({ userId: session.customerId, productCode: body.productCode, quantity: body.quantity, requestKey: body.requestKey }), { headers });
  } catch (error) { return failure(error); }
}
