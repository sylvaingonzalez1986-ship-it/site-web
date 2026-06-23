import { NextResponse } from "next/server";
import { isCurrentRequestAdminAuthorized } from "@/lib/admin-guard";
import {
  canCustomerAccessContestFeatureServer,
  isContestBetaAccessRestrictedServer,
  isContestFeatureEnabledServer,
} from "@/lib/contest-feature";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import type { PublicCustomer } from "@/types/customer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getOptionalCustomerSession(): Promise<{
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

export async function GET() {
  const [adminAuthorized, session] = await Promise.all([
    isCurrentRequestAdminAuthorized(),
    getOptionalCustomerSession(),
  ]);

  return NextResponse.json({
    enabled: isContestFeatureEnabledServer(),
    betaRestricted: isContestBetaAccessRestrictedServer(),
    canAccess: canCustomerAccessContestFeatureServer(session?.customer ?? null, {
      adminAuthorized,
    }),
  });
}
