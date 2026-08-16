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

const ACCOUNT_UNAVAILABLE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "Retry-After": "5",
};

function isAccountServiceUnavailableError(error: unknown): boolean {
  return error instanceof Error && (
    error.message.startsWith("[supabase:")
    || error.message.includes("fetch failed")
  );
}

function accountUnavailableResponse() {
  return NextResponse.json(
    { error: "Service de compte momentanément indisponible. Réessaie dans quelques secondes." },
    { status: 503, headers: ACCOUNT_UNAVAILABLE_HEADERS },
  );
}

export async function GET() {
  let session;
  try {
    session = await getCurrentCustomerSessionByBackend();
  } catch (error) {
    if (isAccountServiceUnavailableError(error)) return accountUnavailableResponse();
    throw error;
  }
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
  let session;
  try {
    session = await getCurrentCustomerSessionByBackend();
  } catch (error) {
    if (isAccountServiceUnavailableError(error)) return accountUnavailableResponse();
    throw error;
  }
  if (!session) {
    return NextResponse.json({ error: "Non autorise." }, { status: 401 });
  }

  const ip = getRequestIp(request);
  const rateLimitKey = `account_me_patch:${session.customerId}:${ip}`;
  let rl;
  try {
    rl = await hitRateLimit({ key: rateLimitKey, windowSeconds: 300, maxHits: 10 });
  } catch (error) {
    if (isAccountServiceUnavailableError(error)) return accountUnavailableResponse();
    throw error;
  }
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
    if (isAccountServiceUnavailableError(error)) return accountUnavailableResponse();
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Payload invalide." },
      { status: 400 },
    );
  }
}
