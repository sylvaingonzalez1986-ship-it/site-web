import { NextResponse } from "next/server";
import { rejectOversizedBody } from "@/lib/body-size-guard";
import { requestNewsletterConfirmation, newsletterTokenHash } from "@/lib/newsletter-confirmation";
import { sendNewsletterConfirmationEmail } from "@/lib/newsletter-email";
import { isValidMailingEmail } from "@/lib/mailing-policy";
import { getRequestIp, hitRateLimit } from "@/lib/security-rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const rejected = rejectOversizedBody(request);
    if (rejected) return rejected;
    const payload = await request.json().catch(() => null);
    const email = typeof payload?.email === "string" ? payload.email.trim().toLowerCase() : "";
    if (!isValidMailingEmail(email)) return NextResponse.json({ error: "Adresse e-mail invalide." }, { status: 400 });
    const budgets = [
      { key: `newsletter_ip:${getRequestIp(request)}`, windowSeconds: 900, maxHits: 8 },
      { key: `newsletter_email:${newsletterTokenHash(email)}`, windowSeconds: 3600, maxHits: 3 },
      { key: "newsletter_global", windowSeconds: 3600, maxHits: 100 },
    ];
    for (const budget of budgets) {
      const rate = await hitRateLimit(budget);
      if (!rate.allowed) return NextResponse.json({ error: "Trop de tentatives. Réessaie plus tard." }, {
        status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) },
      });
    }
    const token = await requestNewsletterConfirmation(email, typeof payload.source === "string" ? payload.source : "application");
    await sendNewsletterConfirmationEmail({ email, token });
    return NextResponse.json({ ok: true, message: "Consulte ta boîte mail pour confirmer ton inscription." }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Inscription momentanément indisponible. Réessaie plus tard." }, { status: 503 });
  }
}
