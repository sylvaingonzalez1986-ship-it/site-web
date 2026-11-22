import { NextResponse } from "next/server";
import { VILLAGE_PHASE_START } from "@/components/placard/world/village-calendar";
import { readRequestBody } from "@/lib/body-size-guard";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { KQ_GAME_DAY_MS } from "@/lib/kanab-quest-business";
import type { KorriganState } from "@/lib/kanab-quest-korrigan";
import { isKqGameRequestEnabled } from "@/lib/kanab-quest-player-request-access";
import { getRequestIp, hitRateLimit } from "@/lib/security-rate-limit";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import { quoteKqKorriganShopValue } from "@/lib/supabase/kanab-quest-commerce-backend";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const positive = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n > 0;
type Command = { action: "state" }
  | { action: "quote"; lotId: string; grams: number }
  | { action: "offer"; lotId: string; grams: number; requestId: string; expectedValueCents: number }
  | { action: "draw"; sessionId: string; draw: number };

function parseCommand(body: Partial<Record<string, unknown>> | null): Command | null {
  if (!body || typeof body !== "object") return null;
  if (body.action === "draw" && uuid(body.sessionId) && positive(body.draw) && body.draw <= 3) {
    return { action: "draw", sessionId: body.sessionId, draw: body.draw };
  }
  if (uuid(body.lotId) && positive(body.grams) && body.grams <= 214748364) {
    if (body.action === "quote") return { action: "quote", lotId: body.lotId, grams: body.grams };
    if (body.action === "offer" && uuid(body.requestId) && positive(body.expectedValueCents)) {
      return { action: "offer", lotId: body.lotId, grams: body.grams, requestId: body.requestId, expectedValueCents: body.expectedValueCents };
    }
  }
  return null;
}

const refusals: Record<string, string> = {
  korrigan_invalid: "Demande invalide.",
  korrigan_closed: "Le jour se lève. Retrouve les korrigans à la prochaine nuit.",
  korrigan_lot_unavailable: "Cette quantité de récolte a été vendue, réservée ou ne peut plus être reprise au shop.",
  korrigan_offer_changed: "La valeur de reprise a changé. Demande un nouveau devis.",
  korrigan_minimum: "La valeur de reprise de l’offrande est trop faible.",
  korrigan_session_active: "Une offrande est déjà engagée. Reprends tes tirages.",
  korrigan_cooldown: "Le délai de sept jours réels court encore.",
  korrigan_session_not_found: "Cette session est introuvable.",
  korrigan_draw_order: "Relis les résultats pour reprendre au prochain tirage.",
  korrigan_reward_pending: "Une récompense attend sa remise. Reprends le tirage enregistré.",
  korrigan_request_conflict: "Cette confirmation correspond déjà à une autre offrande.",
};
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers });

async function market(request: Request) {
  if (!await isKqGameRequestEnabled()) return fail("Introuvable.", 404);
  const account = await getCurrentCustomerSessionByBackend("identity");
  if (!account) return fail("Connecte-toi pour retrouver ta partie.", 401);
  try {
    const rate = await hitRateLimit({ key: `kq_korrigans:${account.customerId}:${getRequestIp(request)}`, windowSeconds: 60, maxHits: 90 });
    if (!rate.allowed) return NextResponse.json({ error: "Patiente un instant avant de réessayer." }, {
      status: 429, headers: { ...headers, "Retry-After": String(rate.retryAfterSeconds) },
    });
    let cmd: Command | null = { action: "state" };
    if (request.method === "POST") {
      const bounded = await readRequestBody(request, 2048);
      if (!bounded.ok) return bounded.response;
      cmd = parseCommand(await bounded.body.json().catch(() => null));
      if (!cmd) return fail("La demande de marché est invalide.", 400);
    }
    // A replay of an accepted offer must reach the ledger even after the lot is gone.
    const retail = cmd.action === "quote" ? await quoteKqKorriganShopValue(account.customerId, cmd.lotId, cmd.grams) : null;
    const { data, error } = await createSupabaseServiceClient().rpc("kq_korrigan_market", {
      p_user_id: account.customerId, p_action: cmd.action,
      p_clock: { dayMs: KQ_GAME_DAY_MS, dawn: VILLAGE_PHASE_START.dawn, night: VILLAGE_PHASE_START.night },
      ...("lotId" in cmd && { p_lot_id: cmd.lotId, p_grams: cmd.grams }),
      ...(cmd.action === "offer" && { p_request_id: cmd.requestId, p_expected_value_cents: cmd.expectedValueCents }),
      ...(cmd.action === "draw" && { p_session_id: cmd.sessionId, p_draw: cmd.draw }),
    });
    if (error) {
      const message = refusals[error.message];
      if (message) return fail(message, 409);
      throw new Error("korrigan_service");
    }
    const state = data as KorriganState;
    if (cmd.action === "quote" && (retail === null || retail !== state.quote?.valueCents)) return fail(refusals.korrigan_offer_changed, 409);
    return NextResponse.json(state, { headers });
  } catch {
    return fail("Le marché est momentanément indisponible. Tu peux retrouver ta session en le rouvrant.", 503);
  }
}
export const GET = market;
export const POST = market;
