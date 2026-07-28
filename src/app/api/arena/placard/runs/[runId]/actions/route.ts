import { NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { isKqPlayerApiEnabled } from "@/lib/kanab-quest-player-access";
import { getRequestIp, hitRateLimit, logRateLimitRejection } from "@/lib/security-rate-limit";
import { applyKqPlayerRunAction, type KqRunAction } from "@/lib/supabase/kanab-quest-backend";

const ACTIONS = new Set<KqRunAction>(["roll", "resolve", "advance", "redraw", "heritage", "heritage-swap"]);
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ runId: string }> }) {
  if (!isKqPlayerApiEnabled()) {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }
  const session = await getCurrentCustomerSessionByBackend();
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const ip = getRequestIp(request);
  const key = `kq_run_action:${session.customerId}:${ip}`;
  const rateLimit = await hitRateLimit({ key, windowSeconds: 60, maxHits: 40 });
  if (!rateLimit.allowed) {
    logRateLimitRejection({
      endpoint: "POST /api/arena/placard/runs/[runId]/actions",
      key,
      ip,
      actorEmail: session.customer.email,
      retryAfterSeconds: rateLimit.retryAfterSeconds,
      maxHits: 40,
      windowSeconds: 60,
    });
    return NextResponse.json({ error: "Trop d’actions rapprochées." }, {
      status: 429,
      headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
    });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }
  const body = payload && typeof payload === "object" && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : {};
  const action = typeof body.action === "string" ? body.action as KqRunAction : null;
  if (!action || !ACTIONS.has(action)) {
    return NextResponse.json({ error: "Action invalide." }, { status: 400 });
  }
  const options = action === "heritage-swap"
    ? { handIndex: Number(body.handIndex), reserveIndex: Number(body.reserveIndex) }
    : undefined;
  if (action === "heritage-swap"
    && (!Number.isInteger(options?.handIndex) || !Number.isInteger(options?.reserveIndex))) {
    return NextResponse.json({ error: "Emplacements de cartes invalides." }, { status: 400 });
  }
  const { runId } = await context.params;
  try {
    const result = await applyKqPlayerRunAction(session.customerId, runId, action, options);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Action impossible.";
    if (message.startsWith("[supabase:")) {
      return NextResponse.json({ error: "Action momentanément indisponible." }, { status: 503 });
    }
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
