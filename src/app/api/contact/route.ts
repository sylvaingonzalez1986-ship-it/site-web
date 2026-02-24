import { NextResponse } from "next/server";
import { sendContactRequestEmail } from "@/lib/newsletter-email";
import { getRequestIp, hitRateLimit } from "@/lib/security-rate-limit";

export const runtime = "nodejs";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sanitizeText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().slice(0, maxLength);
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => null)) as
      | { name: string; email: string; phone: string; message: string }
      | null;

    if (!payload) {
      return NextResponse.json({ error: "Requete invalide." }, { status: 400 });
    }

    const name = sanitizeText(payload.name, 120);
    const email = sanitizeText(payload.email, 160).toLowerCase();
    const phone = sanitizeText(payload.phone, 40);
    const message = sanitizeText(payload.message, 3000);

    if (name.length < 2) {
      return NextResponse.json({ error: "Nom invalide." }, { status: 400 });
    }
    if (!EMAIL_PATTERN.test(email)) {
      return NextResponse.json({ error: "Email invalide." }, { status: 400 });
    }
    if (message.length < 10) {
      return NextResponse.json(
        { error: "Le message doit contenir au moins 10 caracteres." },
        { status: 400 },
      );
    }

    const ip = getRequestIp(request);
    const rateLimit = await hitRateLimit({
      key: `contact_form:${ip}:${email}`,
      windowSeconds: 15 * 60,
      maxHits: 5,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Trop de messages envoyes. Reessaie plus tard." },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds),
          },
        },
      );
    }

    await sendContactRequestEmail({
      name,
      email,
      phone,
      message,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error) {
      console.error("[contact] email send failed:", error.message);
    }

    if (error instanceof Error && error.message.includes("rpc_rate_limit_hit")) {
      return NextResponse.json(
        { error: "Protection anti-abus indisponible. Reessaie plus tard." },
        { status: 503 },
      );
    }

    if (error instanceof Error && error.message.includes("Configuration e-mail manquante")) {
      return NextResponse.json(
        { error: "Configuration e-mail incomplete. Contacte l'administrateur du site." },
        { status: 503 },
      );
    }

    if (
      error instanceof Error &&
      (error.message.toLowerCase().includes("invalid login") ||
        error.message.toLowerCase().includes("username and password not accepted") ||
        error.message.toLowerCase().includes("authentication"))
    ) {
      return NextResponse.json(
        { error: "Configuration SMTP invalide (identifiants). Contacte l'administrateur du site." },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: "Envoi du message impossible pour le moment." },
      { status: 503 },
    );
  }
}
