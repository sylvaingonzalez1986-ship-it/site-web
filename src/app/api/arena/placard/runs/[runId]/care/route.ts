import { NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { isKqPlayerRequestEnabled } from "@/lib/kanab-quest-player-request-access";
import { getRequestIp, hitRateLimit, logRateLimitRejection } from "@/lib/security-rate-limit";
import { applyKqPlayerCare } from "@/lib/supabase/kanab-quest-care-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ runId: string }> }) {
  if (!await isKqPlayerRequestEnabled()) return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  const session = await getCurrentCustomerSessionByBackend("identity");
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const ip = getRequestIp(request);
  const key = `kq_care_apply:${session.customerId}:${ip}`;
  const rate = await hitRateLimit({ key, windowSeconds: 60, maxHits: 30 });
  if (!rate.allowed) {
    logRateLimitRejection({ endpoint: "POST /api/arena/placard/runs/[runId]/care", key, ip, actorEmail: session.customer.email, retryAfterSeconds: rate.retryAfterSeconds, maxHits: 30, windowSeconds: 60 });
    return NextResponse.json({ error: "Trop d’interventions rapprochées." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  }
  let raw: unknown;
  try { raw = await request.json(); } catch { return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 }); }
  const body = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  if (typeof body.requestKey !== "string" || (body.action !== "basic" && typeof body.productCode !== "string")
    || (body.action !== undefined && body.action !== "basic") || (body.action === "basic" && body.productCode !== undefined)
    || (body.expectedUpdatedAt !== undefined && typeof body.expectedUpdatedAt !== "string")) {
    return NextResponse.json({ error: "Intervention invalide." }, { status: 400 });
  }
  if (body.action === "basic" && (typeof body.basicPriceCents !== "number" || !Number.isSafeInteger(body.basicPriceCents) || body.basicPriceCents <= 0)) {
    return NextResponse.json({ error: "L’entretien est désormais payant. Actualise le suivi pour consulter son prix avant de l’activer." }, { status: 409 });
  }
  try {
    const { runId } = await context.params;
    return NextResponse.json(await applyKqPlayerCare({
      userId: session.customerId, runId, requestKey: body.requestKey,
      ...(body.action === "basic" ? { action: "basic" as const, basicPriceCents: body.basicPriceCents as number } : { productCode: body.productCode as string }),
      ...(typeof body.expectedUpdatedAt === "string" ? { expectedUpdatedAt: body.expectedUpdatedAt } : {}),
    }), { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Intervention impossible.";
    return NextResponse.json({ error: message.startsWith("[supabase:") ? "Service momentanément indisponible." : message }, { status: message.startsWith("[supabase:") ? 503 : 409 });
  }
}
