import { NextResponse } from "next/server";
import { logAuditEvent } from "@/lib/audit-log";
import { rejectOversizedBody } from "@/lib/body-size-guard";
import { requestCustomerPasswordResetByBackend } from "@/lib/customer-backend";
import { getRequestIp, hitRateLimit, logRateLimitRejection } from "@/lib/security-rate-limit";
import { sanitizeNextPath } from "@/lib/safe-next-path";
import { getSiteUrl } from "@/lib/site-url";

const GENERIC_SUCCESS_MESSAGE =
  "Si un compte existe pour cette adresse, un email de reinitialisation vient d'etre envoye.";

export async function POST(request: Request) {
  let email = "";
  let nextPath = "/profil";
  let ip = "";

  try {
    const rejected = rejectOversizedBody(request);
    if (rejected) return rejected;

    const payload = (await request.json()) as {
      email?: string;
      next?: string;
    };
    email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    nextPath = sanitizeNextPath(payload.next, "/profil");
    ip = getRequestIp(request);

    const ipRateLimit = await hitRateLimit({
      key: `account_password_reset_request_ip:${ip}`,
      windowSeconds: 15 * 60,
      maxHits: 20,
    });
    if (!ipRateLimit.allowed) {
      logRateLimitRejection({
        endpoint: "POST /api/account/password-reset/request",
        key: `account_password_reset_request_ip:${ip}`,
        ip,
        retryAfterSeconds: ipRateLimit.retryAfterSeconds,
        maxHits: 20,
        windowSeconds: 15 * 60,
      });

      return NextResponse.json(
        { error: "Trop de tentatives. Reessaie plus tard." },
        {
          status: 429,
          headers: {
            "Retry-After": String(ipRateLimit.retryAfterSeconds),
          },
        },
      );
    }

    const emailRateLimit = await hitRateLimit({
      key: `account_password_reset_request:${ip}:${email || "unknown"}`,
      windowSeconds: 15 * 60,
      maxHits: 5,
    });
    if (!emailRateLimit.allowed) {
      logRateLimitRejection({
        endpoint: "POST /api/account/password-reset/request",
        key: `account_password_reset_request:${ip}:${email || "unknown"}`,
        ip,
        actorEmail: email || undefined,
        retryAfterSeconds: emailRateLimit.retryAfterSeconds,
        maxHits: 5,
        windowSeconds: 15 * 60,
      });

      return NextResponse.json(
        { error: "Trop de tentatives. Reessaie plus tard." },
        {
          status: 429,
          headers: {
            "Retry-After": String(emailRateLimit.retryAfterSeconds),
          },
        },
      );
    }

    if (!email) {
      return NextResponse.json({ error: "Adresse email manquante." }, { status: 400 });
    }

    const redirectUrl = new URL("/compte/reinitialiser-mot-de-passe", getSiteUrl());
    if (nextPath !== "/profil") {
      redirectUrl.searchParams.set("next", nextPath);
    }

    await requestCustomerPasswordResetByBackend({
      email,
      redirectTo: redirectUrl.toString(),
    });

    logAuditEvent({
      eventType: "customer_password_reset_requested",
      actorEmail: email,
      ip,
      metadata: { nextPath },
    });

    return NextResponse.json({ message: GENERIC_SUCCESS_MESSAGE });
  } catch (error) {
    if (error instanceof Error && error.message === "password_reset_email_rate_limited") {
      logAuditEvent({
        eventType: "customer_password_reset_requested",
        actorEmail: email || undefined,
        ip,
        metadata: { nextPath, providerRateLimited: true },
      });

      return NextResponse.json({ message: GENERIC_SUCCESS_MESSAGE });
    }

    console.error("Password reset request failed.");
    return NextResponse.json(
      { error: "Demande impossible pour le moment. Reessaie plus tard." },
      { status: 503 },
    );
  }
}
