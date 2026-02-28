import { Buffer } from "node:buffer";
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  createAdminSessionToken,
  getAdminCookieOptions,
  getAdminPassword,
} from "@/lib/admin-auth";
import { isAllowedAdminEmail, normalizeEmail } from "@/lib/admin-allowlist";
import { logAuditEvent } from "@/lib/audit-log";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { getRequestIp, hitRateLimit } from "@/lib/security-rate-limit";

function safePasswordEquals(received: string, expected: string): boolean {
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);

  if (receivedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(receivedBuffer, expectedBuffer);
}

export async function POST(request: Request) {
  try {
    const ip = getRequestIp(request);
    const rateLimit = await hitRateLimit({
      key: `admin_login:${ip}`,
      windowSeconds: 10 * 60,
      maxHits: 10,
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

    const payload = (await request.json()) as { password?: string };
    const configuredPassword = getAdminPassword();
    const customerSession = await getCurrentCustomerSessionByBackend();
    const sessionEmail = normalizeEmail(customerSession?.customer.email);

    if (!customerSession || !isAllowedAdminEmail(sessionEmail)) {
      logAuditEvent({ eventType: "admin_login_failed", actorEmail: sessionEmail, ip, metadata: { reason: "email_not_allowed" } });
      return NextResponse.json(
        { error: "Accès admin réservé au compte autorisé." },
        { status: 403 },
      );
    }

    if (!payload.password || !safePasswordEquals(payload.password, configuredPassword)) {
      logAuditEvent({ eventType: "admin_login_failed", actorEmail: sessionEmail, ip, metadata: { reason: "wrong_password" } });
      return NextResponse.json({ error: "Mot de passe invalide." }, { status: 401 });
    }

    logAuditEvent({ eventType: "admin_login", actorEmail: sessionEmail, ip });

    const sessionToken = await createAdminSessionToken();
    const response = NextResponse.json({ success: true });
    response.cookies.set({
      name: ADMIN_COOKIE_NAME,
      value: sessionToken,
      ...getAdminCookieOptions(),
    });

    return response;
  } catch (error) {
    if (error instanceof Error && error.message.includes("rpc_rate_limit_hit")) {
      return NextResponse.json(
        { error: "Protection anti-abus indisponible. Reessaie plus tard." },
        { status: 503 },
      );
    }

    if (error instanceof Error && error.message.includes("ADMIN_")) {
      return NextResponse.json({ error: "Configuration admin invalide." }, { status: 503 });
    }

    return NextResponse.json({ error: "Payload invalide." }, { status: 400 });
  }
}
