import { NextResponse } from "next/server";
import { denyIfNotAdminApi } from "@/lib/admin-guard";
import { getAdminReferralOverviewByBackend } from "@/lib/referral-backend";

export const runtime = "nodejs";

export async function GET() {
  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }

  const overview = await getAdminReferralOverviewByBackend();
  return NextResponse.json({ overview });
}
