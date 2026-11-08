import { NextResponse } from "next/server";
import { getValidatedAdminContext } from "@/lib/admin-guard";
import { ArenaFeedbackError, isArenaFeedbackKind, isArenaFeedbackStatus, parseArenaFeedbackOffset, parseArenaFeedbackReview } from "@/lib/arena-feedback";
import { assertArenaFeedbackOrigin, readArenaFeedbackBody } from "@/lib/arena-feedback-request";
import { getAdminArenaFeedback, reviewArenaFeedback } from "@/lib/supabase/arena-feedback-backend";
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
export async function GET(request: Request) {
  try {
    if (!await getValidatedAdminContext()) throw new ArenaFeedbackError("Non autorisé.", 401);
    const params = new URL(request.url).searchParams;
    const status = params.get("status");
    const kind = params.get("kind");
    if (status && status !== "all" && !isArenaFeedbackStatus(status)) throw new ArenaFeedbackError("Statut inconnu.");
    if (kind && kind !== "all" && !isArenaFeedbackKind(kind)) throw new ArenaFeedbackError("Type inconnu.");
    return NextResponse.json(await getAdminArenaFeedback({ offset: parseArenaFeedbackOffset(params.get("offset")),
      status: isArenaFeedbackStatus(status) ? status : undefined, kind: isArenaFeedbackKind(kind) ? kind : undefined }), { headers });
  } catch (error) { return failure(error); }
}
export async function PATCH(request: Request) {
  try {
    const admin = await getValidatedAdminContext();
    if (!admin) throw new ArenaFeedbackError("Non autorisé.", 401);
    assertArenaFeedbackOrigin(request);
    const review = parseArenaFeedbackReview(await readArenaFeedbackBody(request));
    const rate = await hitRateLimit({ key: `arena_feedback_review:${admin.email}`, windowSeconds: 60, maxHits: 60 });
    if (!rate.allowed) throw new ArenaFeedbackError("Patiente un instant avant de réessayer.", 429, rate.retryAfterSeconds);
    return NextResponse.json(await reviewArenaFeedback(admin.email, review), { headers });
  } catch (error) { return failure(error); }
}
