import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  createAdminSessionToken,
  getAdminCookieOptions,
} from "@/lib/admin-auth";
import { isAllowedAdminEmail } from "@/lib/admin-allowlist";
import { applyCustomerProfilePatch } from "@/lib/account-profile";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { getRequestIp, hitRateLimit, logRateLimitRejection } from "@/lib/security-rate-limit";
import { clearSupabaseAuthCookies } from "@/lib/supabase-auth-cookies";

export async function GET() {
  const session = await getCurrentCustomerSessionByBackend();
  if (!session) {
    const response = NextResponse.json({ user: null }, { status: 401 });
    const cookieStore = await cookies();
    clearSupabaseAuthCookies(response, cookieStore);
    return response;
  }

  const response = NextResponse.json({ user: session.customer });

  if (isAllowedAdminEmail(session.customer.email)) {
    try {
      const adminSessionToken = await createAdminSessionToken();
      response.cookies.set({
        name: ADMIN_COOKIE_NAME,
        value: adminSessionToken,
        ...getAdminCookieOptions(),
      });
    } catch (error) {
      console.error("Admin session bootstrap failed on account/me:", error);
    }
  }

  return response;
}

export async function PATCH(request: Request) {
  const session = await getCurrentCustomerSessionByBackend();
  if (!session) {
    return NextResponse.json({ error: "Non autorise." }, { status: 401 });
  }

  const ip = getRequestIp(request);
  const rateLimitKey = `account_me_patch:${session.customerId}:${ip}`;
  const rl = await hitRateLimit({ key: rateLimitKey, windowSeconds: 300, maxHits: 10 });
  if (!rl.allowed) {
    logRateLimitRejection({
      endpoint: "PATCH /api/account/me",
      key: rateLimitKey,
      ip,
      actorEmail: session.customer.email,
      retryAfterSeconds: rl.retryAfterSeconds,
      maxHits: 10,
      windowSeconds: 300,
    });

    return NextResponse.json({ error: "Trop de requetes." }, { status: 429 });
  }

  try {
    const payload = (await request.json()) as unknown;
    const updated = await applyCustomerProfilePatch(session.customerId, payload);

    if (!updated) {
      return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });
    }

    return NextResponse.json({ user: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Payload invalide." },
      { status: 400 },
    );
  }
}
