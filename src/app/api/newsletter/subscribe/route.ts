import { NextResponse } from "next/server";
import {
  markNewsletterSubscriberContactedByBackend,
  subscribeNewsletterByBackend,
} from "@/lib/newsletter-backend";
import { sendNewsletterConfirmationEmail } from "@/lib/newsletter-email";
import { getRequestIp, hitRateLimit } from "@/lib/security-rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => null)) as
      | { email: string; source: string }
      | null;

    if (!payload) {
      return NextResponse.json({ error: "Requete invalide." }, { status: 400 });
    }

    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    const source = typeof payload.source === "string" ? payload.source : "application";

    const ip = getRequestIp(request);
    const rateLimit = await hitRateLimit({
      key: `newsletter_subscribe:${ip}:${email || "unknown"}`,
      windowSeconds: 15 * 60,
      maxHits: 8,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Trop de tentatives. Reessaie plus tard." },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds),
          },
        },
      );
    }

    if (!email) {
      return NextResponse.json({ error: "Adresse e-mail requise." }, { status: 400 });
    }

    const result = await subscribeNewsletterByBackend({ email, source });
    try {
      await sendNewsletterConfirmationEmail({
        email: result.subscriber.email,
        alreadySubscribed: result.alreadySubscribed,
      });
      await markNewsletterSubscriberContactedByBackend({ email: result.subscriber.email });
    } catch {
      return NextResponse.json(
        {
          ok: false,
          email: result.subscriber.email,
          alreadySubscribed: result.alreadySubscribed,
          error: "Inscription enregistrée, mais email de confirmation indisponible.",
        },
        { status: 503 },
      );
    }

    return NextResponse.json({
      ok: true,
      alreadySubscribed: result.alreadySubscribed,
      email: result.subscriber.email,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("rpc_rate_limit_hit")) {
      return NextResponse.json(
        { error: "Protection anti-abus indisponible. Réessaie plus tard." },
        { status: 503 },
      );
    }

    const message = error instanceof Error ? error.message : "Inscription impossible.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
