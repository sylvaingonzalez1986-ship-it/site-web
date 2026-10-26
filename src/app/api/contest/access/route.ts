import { isArenaPrelaunch, hasArenaBetaAccess, ARENA_OPENING_AT } from "@/lib/arena-opening";
import { NextResponse } from "next/server";
import { isCurrentRequestAdminAuthorized } from "@/lib/admin-guard";
import {
  canCustomerAccessContestFeatureServer,
  isContestBetaAccessRestrictedServer,
  isContestFeatureEnabledServer,
} from "@/lib/contest-feature";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { isContestNotebookEnabledServer } from "@/lib/contest-notebook-access";
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

  const notebookOpen = isContestNotebookEnabledServer();
  if (isArenaPrelaunch()) return NextResponse.json({ enabled: true, betaRestricted: false, canAccess: true, notebookOpen, activitiesOpen: isContestFeatureEnabledServer() && hasArenaBetaAccess(session?.customer, adminAuthorized), opensAt: ARENA_OPENING_AT }, { headers: { "Cache-Control": "private, no-store" } });

  return NextResponse.json({
    enabled: notebookOpen || isContestFeatureEnabledServer(),
    notebookOpen,
    betaRestricted: isContestBetaAccessRestrictedServer(),
    canAccess: notebookOpen || canCustomerAccessContestFeatureServer(session?.customer ?? null, {
      adminAuthorized,
    }),
  }, { headers: { "Cache-Control": "private, no-store" } });
}
