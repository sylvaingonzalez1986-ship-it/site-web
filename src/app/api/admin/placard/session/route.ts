import { NextResponse } from "next/server";
import { getValidatedAdminContext } from "@/lib/admin-guard";
import {
  expireKqAbandonedBattles,
  getKqAdminActiveRun,
  getKqAdminBattles,
  getKqAdminFlowers,
} from "@/lib/supabase/kanab-quest-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getValidatedAdminContext();
  if (!admin) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  let expiryWarning = "";
  try {
    await expireKqAbandonedBattles();
  } catch (error) {
    expiryWarning = `Expiration des duels : ${error instanceof Error ? error.message : "indisponible"}`;
  }
  const results = await Promise.allSettled([
    getKqAdminActiveRun(admin.email),
    getKqAdminFlowers(admin.email),
    getKqAdminBattles(admin.email),
  ] as const);
  const labels = ["Culture active", "Fleurs", "Duels"] as const;
  const readFailureCount = results.filter((result) => result.status === "rejected").length;
  const warnings = results.flatMap((result, index) => result.status === "rejected"
    ? [`${labels[index]} : ${result.reason instanceof Error ? result.reason.message : "indisponible"}`]
    : []);
  if (expiryWarning) warnings.push(expiryWarning);
  if (readFailureCount === results.length) {
    return NextResponse.json({ error: "Session Placard indisponible.", warnings }, { status: 503 });
  }
  return NextResponse.json({
    activeRun: results[0].status === "fulfilled" ? results[0].value : null,
    flowers: results[1].status === "fulfilled" ? results[1].value : [],
    battles: results[2].status === "fulfilled" ? results[2].value : [],
    warnings,
  }, {
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}
