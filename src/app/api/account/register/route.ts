import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  createAdminSessionToken,
  getAdminCookieOptions,
} from "@/lib/admin-auth";
import { isAllowedAdminEmail } from "@/lib/admin-allowlist";
import {
  clearLegacyCustomerCookie,
  isAtLeast18,
  normalizeDateOfBirth,
  registerCustomerByBackend,
} from "@/lib/customer-backend";
import { logAuditEvent } from "@/lib/audit-log";
import { getRequestIp, hitRateLimit, logRateLimitRejection } from "@/lib/security-rate-limit";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      email?: string;
      firstName?: string;
      lastName?: string;
      dateOfBirth?: string;
      password?: string;
      referralCode?: string;
      phone?: string;
      address?: string;
      city?: string;
      postalCode?: string;
      country?: string;
    };
    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    const ip = getRequestIp(request);
    const rateLimit = await hitRateLimit({
      key: `account_register:${ip}:${email || "unknown"}`,
      windowSeconds: 15 * 60,
      maxHits: 10,
    });
    if (!rateLimit.allowed) {
      logRateLimitRejection({
        endpoint: "POST /api/account/register",
        key: `account_register:${ip}:${email || "unknown"}`,
        ip,
        actorEmail: email || undefined,
        retryAfterSeconds: rateLimit.retryAfterSeconds,
        maxHits: 10,
        windowSeconds: 15 * 60,
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

    if (!payload.email || !payload.firstName || !payload.lastName || !payload.password) {
      return NextResponse.json({ error: "Informations manquantes." }, { status: 400 });
    }

    const dateOfBirth = normalizeDateOfBirth(payload.dateOfBirth);
    if (!dateOfBirth) {
      return NextResponse.json({ error: "Date de naissance invalide." }, { status: 400 });
    }
    if (!isAtLeast18(dateOfBirth)) {
      return NextResponse.json(
        { error: "Inscription reservee aux personnes majeures (18+)." },
        { status: 400 },
      );
    }

    const result = await registerCustomerByBackend({
      email: payload.email,
      firstName: payload.firstName,
      lastName: payload.lastName,
      dateOfBirth,
      password: payload.password,
      referralCode: payload.referralCode,
      phone: payload.phone,
      address: payload.address,
      city: payload.city,
      postalCode: payload.postalCode,
      country: payload.country,
    });

    await clearLegacyCustomerCookie();

    logAuditEvent({
      eventType: "customer_register",
      actorEmail: result.customer.email,
      ip,
      metadata: {
        customerId: result.customer.id,
        usedReferralCode: Boolean(payload.referralCode?.trim()),
      },
    });

    const response = NextResponse.json({ user: result.customer });

    if (isAllowedAdminEmail(result.customer.email)) {
      try {
        const adminSessionToken = await createAdminSessionToken();
        response.cookies.set({
          name: ADMIN_COOKIE_NAME,
          value: adminSessionToken,
          ...getAdminCookieOptions(),
        });
      } catch (error) {
        console.error("Admin session bootstrap failed on account register:", error);
      }
    }

    return response;
  } catch (error) {
    if (error instanceof Error && error.message.includes("rpc_rate_limit_hit")) {
      return NextResponse.json(
        { error: "Protection anti-abus indisponible. Reessaie plus tard." },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur inscription." },
      { status: 400 },
    );
  }
}
