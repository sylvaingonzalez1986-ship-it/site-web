import { NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { isKqPlayerRequestEnabled } from "@/lib/kanab-quest-player-request-access";
import { ArenaFeedbackError, parseArenaFeedbackOffset, parseArenaFeedbackSubmission } from "@/lib/arena-feedback";
import { assertArenaFeedbackOrigin, readArenaFeedbackBody } from "@/lib/arena-feedback-request";
import { getPlayerArenaFeedback, submitArenaFeedback } from "@/lib/supabase/arena-feedback-backend";
import { hitRateLimit } from "@/lib/security-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
function failure(error: unknown) {
  return NextResponse.json({ error: error instanceof ArenaFeedbackError ? error.message : "La boîte aux lettres est momentanément indisponible." }, {
    status: error instanceof ArenaFeedbackError ? error.status : 503,
    headers: { ...headers, ...(error instanceof ArenaFeedbackError && error.retryAfterSeconds ? { "Retry-After": String(error.retryAfterSeconds) } : {}) },
  });
}
async function playerId() {
  if (!await isKqPlayerRequestEnabled()) throw new ArenaFeedbackError("Introuvable.", 404);
  const session = await getCurrentCustomerSessionByBackend("identity");
  if (!session) throw new ArenaFeedbackError("Connecte-toi pour consulter la boîte aux lettres.", 401);
  return session.customerId;
}
export async function GET(request: Request) {
  try {
    const userId = await playerId();
    const offset = parseArenaFeedbackOffset(new URL(request.url).searchParams.get("offset"));
    return NextResponse.json(await getPlayerArenaFeedback(userId, offset), { headers });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    const userId = await playerId();
    assertArenaFeedbackOrigin(request);
    const submission = parseArenaFeedbackSubmission(await readArenaFeedbackBody(request));
    const rate = await hitRateLimit({ key: `arena_feedback:${userId}`, windowSeconds: 60, maxHits: 10 });
    if (!rate.allowed) throw new ArenaFeedbackError("Patiente un instant avant de réessayer.", 429, rate.retryAfterSeconds);
    return NextResponse.json(await submitArenaFeedback(userId, submission), { headers });
  } catch (error) { return failure(error); }
}
