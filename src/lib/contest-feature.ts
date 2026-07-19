import "server-only";

import { NextResponse } from "next/server";
import { isAllowedAdminEmail } from "@/lib/admin-allowlist";
import { isCurrentRequestAdminAuthorized } from "@/lib/admin-guard";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import type { PublicCustomer } from "@/types/customer";

function isExplicitlyEnabled(raw: string | undefined): boolean {
  const normalized = raw?.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "on" || normalized === "yes";
}

function isExplicitlyDisabled(raw: string | undefined): boolean {
  const normalized = raw?.trim().toLowerCase();
  return normalized === "0" || normalized === "false" || normalized === "off" || normalized === "no";
}

export function isContestFeatureEnabledServer(): boolean {
  if (!isExplicitlyEnabled(process.env.CONTEST_FEATURE_ENABLED)) {
    return false;
  }

  if (process.env.NODE_ENV === "production") {
    return isExplicitlyEnabled(process.env.CONTEST_FEATURE_ALLOW_PRODUCTION);
  }

  return true;
}

export function isContestBetaAccessRestrictedServer(): boolean {
  return !isExplicitlyDisabled(process.env.CONTEST_BETA_ACCESS_ENABLED);
}

export function canCustomerAccessContestFeatureServer(
  customer: Pick<PublicCustomer, "email" | "contestBetaEnabled"> | null | undefined,
  options: { adminAuthorized?: boolean } = {},
): boolean {
  if (!isContestFeatureEnabledServer()) {
    return false;
  }

  if (!isContestBetaAccessRestrictedServer()) {
    return true;
  }

  if (options.adminAuthorized) {
    return true;
  }

  if (isAllowedAdminEmail(customer?.email)) {
    return true;
  }

  return customer?.contestBetaEnabled === true;
}

async function getOptionalContestSession(): Promise<{
  customerId: string;
  customer: PublicCustomer;
} | null> {
  try {
    return await getCurrentCustomerSessionByBackend();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("[supabase:auth.getUser]")) {
      return null;
    }
    throw error;
  }
}

export function getContestFeatureDisabledResponse() {
  return NextResponse.json({ error: "Module desactive." }, { status: 404 });
}

export async function getContestFeatureAccessDeniedResponse(): Promise<NextResponse | null> {
  if (!isContestFeatureEnabledServer()) {
    return getContestFeatureDisabledResponse();
  }

  if (!isContestBetaAccessRestrictedServer()) {
    return null;
  }

  const adminAuthorized = await isCurrentRequestAdminAuthorized();
  if (adminAuthorized) {
    return null;
  }

  const session = await getOptionalContestSession();
  if (!session) {
    return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  }

  if (canCustomerAccessContestFeatureServer(session.customer)) {
    return null;
  }

  return getContestFeatureDisabledResponse();
}
