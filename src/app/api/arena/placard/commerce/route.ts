import { NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { isKqPlayerRequestEnabled } from "@/lib/kanab-quest-player-request-access";
import { getRequestIp, hitRateLimit, logRateLimitRejection } from "@/lib/security-rate-limit";
import { getKqCommerceSnapshot, handleKqCommerceAction } from "@/lib/supabase/kanab-quest-commerce-backend";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "Marché indisponible.";
  return NextResponse.json({ error: message.startsWith("[supabase:") ? "Le comptoir est momentanément indisponible. Réessaie dans un instant." : message }, { status: message.startsWith("[supabase:") ? 503 : 400 });
}
export async function GET(request: Request) {
  if (!await isKqPlayerRequestEnabled()) return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  const session = await getCurrentCustomerSessionByBackend("identity");
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  try { return NextResponse.json(await getKqCommerceSnapshot(session.customerId, new URL(request.url).searchParams.get("shop") === "1"), { headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  if (!await isKqPlayerRequestEnabled()) return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  const session = await getCurrentCustomerSessionByBackend("identity");
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const ip = getRequestIp(request);
  const key = `kq_commerce:${session.customerId}:${ip}`;
  const rate = await hitRateLimit({ key, windowSeconds: 60, maxHits: 90 });
  if (!rate.allowed) {
    logRateLimitRejection({ endpoint: "POST /api/arena/placard/commerce", key, ip, actorEmail: session.customer.email, retryAfterSeconds: rate.retryAfterSeconds, maxHits: 90, windowSeconds: 60 });
    return NextResponse.json({ error: "Patiente un instant avant de réessayer." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  }
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Demande invalide.");
    return NextResponse.json(await handleKqCommerceAction(session.customerId, body as Record<string, unknown>));
  } catch (error) { return failure(error); }
}
