import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, getAdminCookieOptions } from "@/lib/admin-auth";
import { clearLegacyCustomerCookie, logoutCustomerByBackend } from "@/lib/customer-backend";
import { clearSupabaseAuthCookies } from "@/lib/supabase-auth-cookies";

export async function POST() {
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
