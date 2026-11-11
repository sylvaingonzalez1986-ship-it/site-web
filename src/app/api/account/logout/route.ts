import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, getAdminCookieOptions } from "@/lib/admin-auth";
import { revokeAdminSession, revokeAdminSessionsForCustomer } from "@/lib/admin-session-store";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { clearLegacyCustomerCookie, logoutCustomerByBackend } from "@/lib/customer-backend";
import { clearSupabaseAuthCookies } from "@/lib/supabase-auth-cookies";

export async function POST() {
  try {
    const session = await getCurrentCustomerSessionByBackend("identity");
    if (session) await revokeAdminSessionsForCustomer(session.customerId);
    await revokeAdminSession((await cookies()).get(ADMIN_COOKIE_NAME)?.value);
  } catch {
    return NextResponse.json({ error: "Déconnexion indisponible. Réessaie." }, { status: 503 });
  }
  await logoutCustomerByBackend();
  await clearLegacyCustomerCookie();
  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: "",
    ...getAdminCookieOptions(0),
  });

  const cookieStore = await cookies();
  clearSupabaseAuthCookies(response, cookieStore);
  return response;
}
