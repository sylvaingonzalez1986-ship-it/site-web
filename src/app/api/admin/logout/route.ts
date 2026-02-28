import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, getAdminCookieOptions } from "@/lib/admin-auth";
import { logAuditEvent } from "@/lib/audit-log";

export async function POST() {
  logAuditEvent({ eventType: "admin_logout" });

  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: "",
    ...getAdminCookieOptions(0),
  });
  return response;
}
