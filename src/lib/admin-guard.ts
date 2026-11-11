import "server-only";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME } from "@/lib/admin-auth";
import { isAllowedAdminEmail } from "@/lib/admin-allowlist";
import { getStoredAdminSession } from "@/lib/admin-session-store";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";

export type AdminRequestContext = {
  customerId: string;
  email: string;
};

export async function getValidatedAdminContext(): Promise<AdminRequestContext | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  const adminSession = await getStoredAdminSession(token);
  if (!adminSession) {
    return null;
  }

  const session = await getCurrentCustomerSessionByBackend("identity");
  if (!session || session.customerId !== adminSession.customerId || !isAllowedAdminEmail(session.customer.email)) return null;

  return {
    customerId: session.customerId,
    email: session.customer.email,
  };
}

export async function denyIfNotAdminApi(): Promise<NextResponse | null> {
  const context = await getValidatedAdminContext();
  if (context) {
    return null;
  }

  return NextResponse.json({ error: "Non autorise." }, { status: 401 });
}

export async function isCurrentRequestAdminAuthorized(): Promise<boolean> {
  const context = await getValidatedAdminContext();
  return Boolean(context);
}
