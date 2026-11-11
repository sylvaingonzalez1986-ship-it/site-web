import { NextResponse } from "next/server";
import { confirmNewsletterSubscription } from "@/lib/newsletter-confirmation";
import { getRequestIp, hitRateLimit } from "@/lib/security-rate-limit";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };

// Reading an emailed link never changes a subscription; confirmation needs a POST.
export async function POST(request: Request) {
  try {
    if (!request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded")) {
      return NextResponse.json({ error: "Formulaire invalide." }, { status: 415, headers });
    }
    const rate = await hitRateLimit({ key: `newsletter_confirm:${getRequestIp(request)}`, windowSeconds: 900, maxHits: 20 });
    if (!rate.allowed) return NextResponse.json({ error: "Réessaie plus tard." }, { status: 429, headers: { ...headers, "Retry-After": String(rate.retryAfterSeconds) } });
    const reader = request.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (reader) for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 2048) {
        await reader.cancel();
        return NextResponse.json({ error: "Formulaire trop volumineux." }, { status: 413, headers });
      }
      chunks.push(chunk.value);
    }
    const form = new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
    const confirmed = await confirmNewsletterSubscription(form.get("token") ?? "");
    return new NextResponse(null, { status: 303, headers: { ...headers, Location: `/newsletter/confirmation?${confirmed ? "done" : "error"}=1` } });
  } catch {
    return new NextResponse(null, { status: 303, headers: { ...headers, Location: "/newsletter/confirmation?error=1" } });
  }
}
