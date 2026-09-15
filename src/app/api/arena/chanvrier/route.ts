import { NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { isKqPlayerRequestEnabled } from "@/lib/kanab-quest-player-request-access";
import { hitRateLimit } from "@/lib/security-rate-limit";
import { rejectOversizedBody } from "@/lib/body-size-guard";
import { getChanvrierProfile, saveChanvrierProfile } from "@/lib/supabase/arena-chanvrier-backend";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
async function identity() {
  const session = await getCurrentCustomerSessionByBackend("identity");
  if (!session) return NextResponse.json({ error: "Connecte-toi pour créer ton chanvrier." }, { status: 401, headers });
  if (!await isKqPlayerRequestEnabled()) return NextResponse.json({ error: "Arène indisponible." }, { status: 404, headers });
  return session;
}
export async function GET() {
  try {
    const session = await identity(); if (session instanceof Response) return session;
    return NextResponse.json({ profile: await getChanvrierProfile(session.customerId) }, { headers });
  } catch { return NextResponse.json({ error: "Ton profil est momentanément indisponible." }, { status: 503, headers }); }
}
export async function POST(request: Request) {
  try {
    const session = await identity(); if (session instanceof Response) return session;
    const oversized = rejectOversizedBody(request, 2048); if (oversized) return oversized;
    const rate = await hitRateLimit({ key: `arena_chanvrier:${session.customerId}`, windowSeconds: 60, maxHits: 10 });
    if (!rate.allowed) return NextResponse.json({ error: "Un peu de patience avant de réessayer." }, { status: 429, headers: { ...headers, "Retry-After": String(rate.retryAfterSeconds) } });
    let value: unknown;
    try { value = await request.json(); } catch { return NextResponse.json({ error: "Profil invalide." }, { status: 400, headers }); }
    return NextResponse.json(await saveChanvrierProfile(session.customerId, value), { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Profil indisponible.";
    const unavailable = message.startsWith("[supabase:");
    return NextResponse.json({ error: unavailable ? "Impossible d’enregistrer ton profil pour le moment." : message }, { status: unavailable ? 503 : 400, headers });
  }
}
