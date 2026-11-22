import "server-only";
import { isArenaPrelaunch, hasArenaBetaAccess, ARENA_OPENING_MESSAGE, ARENA_OPENING_AT } from "@/lib/arena-opening";

import { NextResponse } from "next/server";
import { isAllowedAdminEmail } from "@/lib/admin-allowlist";
import { isCurrentRequestAdminAuthorized } from "@/lib/admin-guard";
import { isContestBetaAccessRestrictedServer, isContestFeatureEnabledServer } from "@/lib/contest-feature-config";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import type { PublicCustomer } from "@/types/customer";

export { isContestBetaAccessRestrictedServer, isContestFeatureEnabledServer };

export function canCustomerAccessContestFeatureServer(
  customer: Pick<PublicCustomer, "email" | "contestBetaEnabled"> | null | undefined,
  options: { adminAuthorized?: boolean } = {},
): boolean {
  if (!isContestFeatureEnabledServer()) {
    return false;
  }

  if (!isArenaPrelaunch() && !isContestBetaAccessRestrictedServer()) {
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

  if (!isArenaPrelaunch() && !isContestBetaAccessRestrictedServer()) {
    return null;
  }

  const adminAuthorized = await isCurrentRequestAdminAuthorized();
  if (adminAuthorized) {
    return null;
  }

  const session = await getOptionalContestSession();
  if (isArenaPrelaunch() && !hasArenaBetaAccess(session?.customer)) return NextResponse.json({ error: ARENA_OPENING_MESSAGE, opensAt: ARENA_OPENING_AT }, { status: 423, headers: { "Cache-Control": "private, no-store" } });
  if (!session) {
    return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  }

  if (canCustomerAccessContestFeatureServer(session.customer)) {
    return null;
  }

  return getContestFeatureDisabledResponse();
}
