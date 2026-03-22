import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, getAdminCookieOptions } from "@/lib/admin-auth";
import { logAuditEvent } from "@/lib/audit-log";
import { clearLegacyCustomerCookie, getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import {
  deleteCustomerAccount,
  normalizeDeletionConfirmationEmail,
} from "@/lib/customer-account-deletion";
import { rejectOversizedBody } from "@/lib/body-size-guard";
import { getRequestIp, hitRateLimit, logRateLimitRejection } from "@/lib/security-rate-limit";

export const runtime = "nodejs";

export async function DELETE(request: Request) {
  const session = await getCurrentCustomerSessionByBackend();
  if (!session) {
    return NextResponse.json({ error: "Non autorise." }, { status: 401 });
  }

  const rejected = rejectOversizedBody(request, 4 * 1024);
  if (rejected) {
    return rejected;
  }

  const ip = getRequestIp(request);
  const rateLimitKey = `account_delete:${session.customerId}:${ip}`;
  const rateLimit = await hitRateLimit({ key: rateLimitKey, windowSeconds: 60 * 60, maxHits: 3 });
  if (!rateLimit.allowed) {
    logRateLimitRejection({
      endpoint: "DELETE /api/account/delete",
      key: rateLimitKey,
      ip,
      actorEmail: session.customer.email,
      retryAfterSeconds: rateLimit.retryAfterSeconds,
      maxHits: 3,
      windowSeconds: 60 * 60,
    });

    return NextResponse.json(
      { error: "Trop de tentatives de suppression. Reessaie plus tard." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  const payload = (await request.json().catch(() => null)) as { confirmEmail?: string } | null;
  const confirmEmail = normalizeDeletionConfirmationEmail(payload?.confirmEmail);
  const sessionEmail = normalizeDeletionConfirmationEmail(session.customer.email);

  if (!confirmEmail || confirmEmail !== sessionEmail) {
    return NextResponse.json(
      { error: "Confirmation invalide. Saisis l'e-mail exact du compte." },
      { status: 400 },
    );
  }

  const summary = await deleteCustomerAccount({
    customerId: session.customerId,
    customerEmail: session.customer.email,
  });

  logAuditEvent({
    eventType: "customer_account_deleted",
    actorEmail: session.customer.email,
    ip,
    metadata: {
      customerId: session.customerId,
      anonymizedOrderCount: summary.anonymizedOrderCount,
      deletedNewsletterSubscription: summary.deletedNewsletterSubscription,
      deletedMissionProofCount: summary.deletedMissionProofCount,
    },
  });

  await clearLegacyCustomerCookie();

  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: "",
    ...getAdminCookieOptions(0),
  });

  const cookieStore = await cookies();
  for (const cookie of cookieStore.getAll()) {
    if (cookie.name.startsWith("sb-") && cookie.name.includes("-auth-token")) {
      response.cookies.set(cookie.name, "", {
        maxAge: 0,
        expires: new Date(0),
        path: "/",
      });
    }
  }

  return response;
}