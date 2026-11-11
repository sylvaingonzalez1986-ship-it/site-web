import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME, getAdminCookieOptions } from "@/lib/admin-auth";
import { revokeAdminSession } from "@/lib/admin-session-store";
import { logAuditEvent } from "@/lib/audit-log";

export async function POST() {
  try {
    await revokeAdminSession((await cookies()).get(ADMIN_COOKIE_NAME)?.value);
  } catch {
    return NextResponse.json({ error: "Déconnexion indisponible. Réessaie." }, { status: 503 });
  }
  logAuditEvent({ eventType: "admin_logout" });

  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: "",
    ...getAdminCookieOptions(0),
  });
  return response;
}
