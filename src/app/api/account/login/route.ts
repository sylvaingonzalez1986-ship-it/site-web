import { NextResponse } from "next/server";
import {
  clearLegacyCustomerCookie,
  loginCustomerByBackend,
} from "@/lib/customer-backend";
import { getRequestIp, hitRateLimit } from "@/lib/security-rate-limit";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      email?: string;
      password?: string;
    };
    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    const ip = getRequestIp(request);
    const rateLimit = await hitRateLimit({
      key: `account_login:${ip}:${email || "unknown"}`,
      windowSeconds: 10 * 60,
      maxHits: 15,
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

    if (!payload.email || !payload.password) {
      return NextResponse.json({ error: "Informations manquantes." }, { status: 400 });
    }

    const result = await loginCustomerByBackend({
      email: payload.email,
      password: payload.password,
    });

    if (!result) {
      return NextResponse.json({ error: "Email ou mot de passe invalide." }, { status: 401 });
    }

    await clearLegacyCustomerCookie();

    return NextResponse.json({ user: result.customer });
  } catch (error) {
    if (error instanceof Error && error.message.includes("rpc_rate_limit_hit")) {
      return NextResponse.json(
        { error: "Protection anti-abus indisponible. Reessaie plus tard." },
        { status: 503 },
      );
    }

    return NextResponse.json({ error: "Erreur connexion." }, { status: 400 });
  }
}
