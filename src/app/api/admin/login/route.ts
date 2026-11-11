import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  getAdminCookieOptions,
} from "@/lib/admin-auth";
import { createStoredAdminSession } from "@/lib/admin-session-store";
import { isAllowedAdminEmail, normalizeEmail } from "@/lib/admin-allowlist";
import { logAuditEvent } from "@/lib/audit-log";
import { rejectOversizedBody } from "@/lib/body-size-guard";
import { isAdminTotpEnabled, verifyAdminTotp } from "@/lib/admin-totp";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { verifyAdminPassword } from "@/lib/admin-password";
import { getRequestIp, hitRateLimit, logRateLimitRejection } from "@/lib/security-rate-limit";

export async function POST(request: Request) {
  try {
    const rejected = rejectOversizedBody(request);
    if (rejected) return rejected;

    const ip = getRequestIp(request);
    const rateLimit = await hitRateLimit({
      key: `admin_login:${ip}`,
      windowSeconds: 10 * 60,
      maxHits: 10,
    });
    if (!rateLimit.allowed) {
      logRateLimitRejection({
        endpoint: "POST /api/admin/login",
        key: `admin_login:${ip}`,
        ip,
        retryAfterSeconds: rateLimit.retryAfterSeconds,
        maxHits: 10,
        windowSeconds: 10 * 60,
      });

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

    const payload = (await request.json()) as { password?: string; totp?: string };
    const customerSession = await getCurrentCustomerSessionByBackend("identity");
    const sessionEmail = normalizeEmail(customerSession?.customer.email);

    if (!customerSession) {
      return NextResponse.json(
        { code: "account_session_required", error: "Connecte-toi à ton compte avant d’ouvrir l’administration." },
        { status: 401 },
      );
    }

    if (!isAllowedAdminEmail(sessionEmail)) {
      logAuditEvent({ eventType: "admin_login_failed", actorEmail: sessionEmail, ip, metadata: { reason: "email_not_allowed" } });
      return NextResponse.json(
        { code: "admin_account_required", error: "Accès admin réservé au compte autorisé." },
        { status: 403 },
      );
    }

    const passwordValid = await verifyAdminPassword(payload.password);
    if (!passwordValid) {
      logAuditEvent({ eventType: "admin_login_failed", actorEmail: sessionEmail, ip, metadata: { reason: "wrong_password" } });
      return NextResponse.json({ error: "Mot de passe invalide." }, { status: 401 });
    }

    if (isAdminTotpEnabled()) {
      if (!payload.totp) {
        return NextResponse.json({ requireTotp: true }, { status: 200 });
      }

      if (!verifyAdminTotp(payload.totp)) {
        logAuditEvent({ eventType: "admin_login_failed", actorEmail: sessionEmail, ip, metadata: { reason: "invalid_totp" } });
        return NextResponse.json({ error: "Code TOTP invalide." }, { status: 401 });
      }
    }

    const sessionToken = await createStoredAdminSession(customerSession.customerId);
    logAuditEvent({ eventType: "admin_login", actorEmail: sessionEmail, ip });
    const response = NextResponse.json({ success: true }, { headers: { "Cache-Control": "private, no-store" } });
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

    if (error instanceof Error && (error.message.startsWith("[supabase:") || error.message.includes("fetch failed"))) {
      return NextResponse.json({ error: "Connexion momentanément indisponible. Réessaie plus tard." }, { status: 503 });
    }

    return NextResponse.json({ error: "Payload invalide." }, { status: 400 });
  }
}
