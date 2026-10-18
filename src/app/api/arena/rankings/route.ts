import { NextResponse } from "next/server";
import { isKqPlayerRequestEnabled } from "@/lib/kanab-quest-player-request-access";
import { getKqPublicArenaCategoryLeaderboard, getKqPublicArenaLeaderboard } from "@/lib/supabase/kanab-quest-backend";
import { ARENA_FORMULA_VERSION } from "@/lib/arena-ranking";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!await isKqPlayerRequestEnabled()) return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  const params = new URL(request.url).searchParams;
  const category = params.get("category") ?? "general";
  if (category !== "general" && category !== "tasting" && category !== "duels" && category !== "business") {
    return NextResponse.json({ error: "Type de classement invalide." }, { status: 400 });
  }
  const scope = params.get("scope") ?? "season";
  const offset = Number(params.get("offset") ?? 0);
  const limit = Number(params.get("limit") ?? 50);
  if ((scope !== "season" && scope !== "global") || (scope === "global" && category !== "tasting")
    || !Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    return NextResponse.json({ error: "Pagination ou période invalide." }, { status: 400 });
  }
  try {
    const session = await getCurrentCustomerSessionByBackend("identity");
    const options = { offset, limit, viewerId: session?.customerId };
    const leaderboard = category === "general"
      ? await getKqPublicArenaLeaderboard(options)
      : await getKqPublicArenaCategoryLeaderboard(category, { ...options, scope });
    return NextResponse.json(leaderboard, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch {
    return NextResponse.json({ entries: [], unavailable: true, formulaVersion: ARENA_FORMULA_VERSION }, {
      status: 503,
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  }
}
