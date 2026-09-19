import { NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { isKqPlayerRequestEnabled } from "@/lib/kanab-quest-player-request-access";
import { hitRateLimit } from "@/lib/security-rate-limit";
import { rejectOversizedBody } from "@/lib/body-size-guard";
import { parseSavingsCommand } from "@/lib/chanvrier-savings";
import { ChanvrierSavingsError, getChanvrierSavings } from "@/lib/supabase/chanvrier-savings-backend";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
async function handle(request?: Request) {
  try {
    const session = await getCurrentCustomerSessionByBackend("identity");
    if (!session) return NextResponse.json({ error: "Connecte-toi pour ouvrir ton livret." }, { status: 401, headers });
    if (!await isKqPlayerRequestEnabled()) return NextResponse.json({ error: "Arène indisponible." }, { status: 404, headers });
    const rate = await hitRateLimit({ key: `arena_savings:${session.customerId}`, windowSeconds: 60, maxHits: 30 });
    if (!rate.allowed) return NextResponse.json({ error: "Patiente un instant avant de réessayer." }, { status: 429, headers: { ...headers, "Retry-After": String(rate.retryAfterSeconds) } });
    if (!request) return NextResponse.json(await getChanvrierSavings(session.customerId), { headers });
    const oversized = rejectOversizedBody(request, 1024); if (oversized) return oversized;
    let value: unknown;
    try { value = await request.json(); } catch { return NextResponse.json({ error: "Opération invalide." }, { status: 400, headers }); }
    const command = parseSavingsCommand(value);
    if (!command) return NextResponse.json({ error: "Choisis un montant positif avec deux décimales maximum." }, { status: 400, headers });
    return NextResponse.json(await getChanvrierSavings(session.customerId, command), { headers });
  } catch (error) {
    if (error instanceof ChanvrierSavingsError) return NextResponse.json({ error: error.message }, { status: error.status, headers });
    return NextResponse.json({ error: "Ton livret est momentanément indisponible. Réessaie dans un instant." }, { status: 503, headers });
  }
}
export async function GET() { return handle(); }
export async function POST(request: Request) { return handle(request); }
