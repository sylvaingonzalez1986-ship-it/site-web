import { NextResponse } from "next/server";
import { denyIfNotAdminApi } from "@/lib/admin-guard";
import { getAdminProductSalesDashboard } from "@/lib/admin-sales-dashboard";

export const runtime = "nodejs";

export async function GET() {
  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }

  try {
    const dashboard = await getAdminProductSalesDashboard();
    return NextResponse.json({ dashboard });
  } catch (error) {
    console.error("Erreur GET /api/admin/sales-dashboard:", error);
    return NextResponse.json(
      { error: "Impossible de charger le dashboard ventes." },
      { status: 500 },
    );
  }
}
