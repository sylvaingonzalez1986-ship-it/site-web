import { NextResponse } from "next/server";
import { denyIfNotAdminApi } from "@/lib/admin-guard";
import { getAdminAnalyticsOverview } from "@/lib/local-analytics-admin";

export const runtime = "nodejs";

export async function GET() {
  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }

  try {
    const overview = await getAdminAnalyticsOverview();
    return NextResponse.json({ overview });
  } catch (error) {
    console.error("Erreur GET /api/admin/analytics:", error);
    return NextResponse.json({ error: "Impossible de charger les analytics." }, { status: 500 });
  }
}
