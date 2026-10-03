import { NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { getRequestIp, hitRateLimit } from "@/lib/security-rate-limit";
import { getContestBundleRewards, syncContestBundleRewards } from "@/lib/supabase/contest-bundle-rewards-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const HEADERS = { "Cache-Control": "private, no-store, max-age=0" };

export async function GET() {
  try {
    const session = await getCurrentCustomerSessionByBackend();
    const rewards = await getContestBundleRewards(session?.customerId ?? null);
    return NextResponse.json({ rewards }, { headers: HEADERS });
  } catch {
    return NextResponse.json({ error: "Bonus fleurs concours indisponible." }, { status: 503, headers: HEADERS });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getCurrentCustomerSessionByBackend();
    if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401, headers: HEADERS });
    if (request.headers.get("origin") !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site") {
      return NextResponse.json({ error: "Origine invalide." }, { status: 403, headers: HEADERS });
    }
    const rate = await hitRateLimit({ key: `contest_bundle:${session.customerId}:${getRequestIp(request)}`, windowSeconds: 60, maxHits: 20 });
    if (!rate.allowed) return NextResponse.json({ error: "Trop de requêtes." }, { status: 429, headers: { ...HEADERS, "Retry-After": String(rate.retryAfterSeconds) } });
    // The browser never chooses a beneficiary, eligible products or reward amount.
    const rewards = await syncContestBundleRewards(session.customerId);
    return NextResponse.json({ rewards }, { headers: HEADERS });
  } catch {
    return NextResponse.json({ error: "Bonus fleurs concours indisponible." }, { status: 503, headers: HEADERS });
  }
}
