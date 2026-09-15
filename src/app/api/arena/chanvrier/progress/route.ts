import { NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { isKqPlayerRequestEnabled } from "@/lib/kanab-quest-player-request-access";
import { hitRateLimit } from "@/lib/security-rate-limit";
import { rejectOversizedBody } from "@/lib/body-size-guard";
import { parseChanvrierShowcase } from "@/lib/chanvrier-progress";
import { getChanvrierProgress, saveChanvrierShowcase } from "@/lib/supabase/chanvrier-progress-backend";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
async function identity() {
  const session = await getCurrentCustomerSessionByBackend("identity");
  if (!session) return NextResponse.json({ error: "Connecte-toi pour retrouver ton parcours." }, { status: 401, headers });
  if (!await isKqPlayerRequestEnabled()) return NextResponse.json({ error: "Arène indisponible." }, { status: 404, headers });
  return session;
}
export async function GET() {
  try {
    const session = await identity(); if (session instanceof Response) return session;
    return NextResponse.json(await getChanvrierProgress(session.customerId), { headers });
  } catch { return NextResponse.json({ error: "Ton palmarès est momentanément indisponible. Ton personnage reste accessible." }, { status: 503, headers }); }
}
export async function PATCH(request: Request) {
  try {
    const session = await identity(); if (session instanceof Response) return session;
    const oversized = rejectOversizedBody(request, 2048); if (oversized) return oversized;
    const rate = await hitRateLimit({ key: `chanvrier_showcase:${session.customerId}`, windowSeconds: 60, maxHits: 30 });
    if (!rate.allowed) return NextResponse.json({ error: "Un peu de patience avant de réessayer." }, { status: 429, headers: { ...headers, "Retry-After": String(rate.retryAfterSeconds) } });
    let value: unknown;
    try { value = await request.json(); } catch { return NextResponse.json({ error: "Choix invalide." }, { status: 400, headers }); }
    const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
    const showcase = input.showcase === undefined ? null : parseChanvrierShowcase(input.showcase);
    const seen = input.seenBadgeCount;
    if ((input.showcase !== undefined && !showcase) || (seen !== undefined && (!Number.isSafeInteger(seen) || Number(seen) < 0)) || (!showcase && seen === undefined)) {
      return NextResponse.json({ error: "Choisis au maximum trois badges et un titre obtenu." }, { status: 400, headers });
    }
    await saveChanvrierShowcase(session.customerId, showcase, seen === undefined ? null : Number(seen));
    return NextResponse.json({ saved: true }, { headers });
  } catch (error) {
    const forbidden = error instanceof Error && error.message === "showcase_not_owned";
    return NextResponse.json({ error: forbidden ? "Tu dois obtenir cette distinction avant de l’afficher." : "Impossible d’enregistrer ta vitrine pour le moment." }, { status: forbidden ? 403 : 503, headers });
  }
}
