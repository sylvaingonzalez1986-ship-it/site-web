import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { logAuditEvent } from "@/lib/audit-log";
import { rejectOversizedBody } from "@/lib/body-size-guard";
import { clearLegacyCustomerCookie, resetCustomerPasswordByBackend } from "@/lib/customer-backend";
import { getRequestIp } from "@/lib/security-rate-limit";
import { clearSupabaseAuthCookies } from "@/lib/supabase-auth-cookies";

export async function POST(request: Request) {
  try {
    const rejected = rejectOversizedBody(request);
    if (rejected) return rejected;

    const payload = (await request.json()) as {
      password?: string;
    };

    if (typeof payload.password !== "string" || payload.password.length < 8) {
      return NextResponse.json(
        { error: "Le mot de passe doit contenir au moins 8 caracteres." },
        { status: 400 },
      );
    }

    const result = await resetCustomerPasswordByBackend({
      password: payload.password,
    });
    await clearLegacyCustomerCookie();
    const response = NextResponse.json({ success: true });
    const cookieStore = await cookies();
    clearSupabaseAuthCookies(response, cookieStore);

    logAuditEvent({
      eventType: "customer_password_reset_completed",
      actorEmail: result.email || undefined,
      ip: getRequestIp(request),
    });

    return response;
  } catch (error) {
    if (error instanceof Error && error.message === "password_reset_session_invalid") {
      return NextResponse.json(
        { error: "Lien invalide ou expire. Redemande un nouvel email." },
        { status: 401 },
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Reinitialisation impossible." },
      { status: 400 },
    );
  }
}
