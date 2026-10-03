import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { unsubscribeMailingEmail } from "@/lib/mailing-backend";
import { readMailingUnsubscribeToken } from "@/lib/mailing-unsubscribe";
import { hitRateLimit } from "@/lib/security-rate-limit";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };

// GET/HEAD deliberately have no handler: link scanners cannot unsubscribe a contact.
export async function POST(request: Request) {
  const url = new URL(request.url);
  const oneClick = url.searchParams.has("token");
  try {
    if (!request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded")) {
      return NextResponse.json({ error: "Formulaire invalide." }, { status: 415, headers });
    }
    const reader = request.body?.getReader();
    let body = "";
    let size = 0;
    const decoder = new TextDecoder();
    if (reader) {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 2048) {
          await reader.cancel();
          return NextResponse.json({ error: "Formulaire trop volumineux." }, { status: 413, headers });
        }
        body += decoder.decode(chunk.value, { stream: true });
      }
    }
    body += decoder.decode();
    const form = new URLSearchParams(body);
    if (oneClick && form.get("List-Unsubscribe") !== "One-Click") {
      return NextResponse.json({ error: "Requête invalide." }, { status: 400, headers });
    }
    const token = oneClick ? url.searchParams.get("token") : form.get("token");
    const email = readMailingUnsubscribeToken(token);
    if (!email) return NextResponse.json({ error: "Lien de désinscription invalide." }, { status: 400, headers });
    const rate = await hitRateLimit({ key: `mailing:unsubscribe:${createHash("sha256").update(email).digest("hex")}`, windowSeconds: 60, maxHits: 10 });
    if (!rate.allowed) return NextResponse.json({ error: "Réessaie dans une minute." }, { status: 429, headers: { ...headers, "Retry-After": String(rate.retryAfterSeconds) } });
    await unsubscribeMailingEmail(email);
    if (oneClick) return NextResponse.json({ ok: true }, { headers });
    return new NextResponse(null, { status: 303, headers: { ...headers, Location: "/newsletter/desinscription?done=1" } });
  } catch {
    if (oneClick) return NextResponse.json({ error: "Désinscription indisponible. Réessaie plus tard." }, { status: 503, headers });
    return new NextResponse(null, { status: 303, headers: { ...headers, Location: "/newsletter/desinscription?error=1" } });
  }
}
