import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, getAdminCookieOptions } from "@/lib/admin-auth";
import { clearLegacyCustomerCookie, logoutCustomerByBackend } from "@/lib/customer-backend";

export async function POST() {
  await logoutCustomerByBackend();
  await clearLegacyCustomerCookie();
  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: "",
    ...getAdminCookieOptions(0),
  });
  return response;
}
