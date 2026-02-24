import "server-only";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, verifyAdminSessionToken } from "@/lib/admin-auth";
import { ADMIN_ALLOWED_EMAIL } from "@/lib/admin-allowlist";

export type AdminRequestContext = {
  customerId: string;
  email: string;
};

export async function getValidatedAdminContext(): Promise<AdminRequestContext | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  const isTokenValid = await verifyAdminSessionToken(token);
  if (!isTokenValid) {
    return null;
  }

  return {
    customerId: "admin",
    email: ADMIN_ALLOWED_EMAIL,
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
