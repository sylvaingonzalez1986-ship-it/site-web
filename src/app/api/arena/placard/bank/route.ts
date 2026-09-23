import { NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { isKqPlayerRequestEnabled } from "@/lib/kanab-quest-player-request-access";
import { hitRateLimit } from "@/lib/security-rate-limit";
import { parseKqBankCommand } from "@/lib/kanab-quest-bank";
import { getKqBank, KqBankError } from "@/lib/supabase/kanab-quest-bank-backend";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };
async function handle(request?: Request) {
  try {
    if (!await isKqPlayerRequestEnabled()) return NextResponse.json({ error: "Introuvable." }, { status: 404, headers });
    const session = await getCurrentCustomerSessionByBackend("identity");
    if (!session) return NextResponse.json({ error: "Connecte-toi pour ouvrir ton dossier bancaire." }, { status: 401, headers });
    if (request) {
      const origin = request.headers.get("origin");
      if ((origin && origin !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site") return NextResponse.json({ error: "Origine non autorisée." }, { status: 403, headers });
    }
    const rate = await hitRateLimit({ key: `kq_bank:${session.customerId}`, windowSeconds: 60, maxHits: 30 });
    if (!rate.allowed) return NextResponse.json({ error: "Patiente un instant avant de réessayer." }, { status: 429, headers: { ...headers, "Retry-After": String(rate.retryAfterSeconds) } });
    if (!request) return NextResponse.json(await getKqBank(session.customerId), { headers });
    if (Number(request.headers.get("content-length")) > 2048) return NextResponse.json({ error: "Opération trop volumineuse." }, { status: 413, headers });
    // Bound the actual stream too: content-length may be absent or inaccurate.
    const reader = request.body?.getReader();
    if (!reader) return NextResponse.json({ error: "Opération invalide." }, { status: 400, headers });
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const part = await reader.read(); if (part.done) break;
      size += part.value.byteLength;
      if (size > 2048) { await reader.cancel(); return NextResponse.json({ error: "Opération trop volumineuse." }, { status: 413, headers }); }
      chunks.push(part.value);
    }
    let value: unknown;
    try { value = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { return NextResponse.json({ error: "Opération invalide." }, { status: 400, headers }); }
    const command = parseKqBankCommand(value);
    if (!command) return NextResponse.json({ error: "Montant ou opération invalide." }, { status: 400, headers });
    return NextResponse.json(await getKqBank(session.customerId, command), { headers });
  } catch (error) {
    if (error instanceof KqBankError) return NextResponse.json({ error: error.message }, { status: error.status, headers });
    return NextResponse.json({ error: "Le guichet bancaire est momentanément indisponible. Réessaie dans un instant." }, { status: 503, headers });
  }
}
export async function GET() { return handle(); }
export async function POST(request: Request) { return handle(request); }
