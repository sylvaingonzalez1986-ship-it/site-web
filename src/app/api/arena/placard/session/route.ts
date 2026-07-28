import { NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { isKqPlayerApiEnabled } from "@/lib/kanab-quest-player-access";
import {
  getKqPlayerActiveRun,
  getKqPlayerBattles,
  getKqPlayerFlowers,
  getKqPlayerProgress,
} from "@/lib/supabase/kanab-quest-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!isKqPlayerApiEnabled()) {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }
  const session = await getCurrentCustomerSessionByBackend();
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const results = await Promise.allSettled([
    getKqPlayerActiveRun(session.customerId),
    getKqPlayerFlowers(session.customerId),
    getKqPlayerBattles(session.customerId, 12),
    getKqPlayerProgress(session.customerId),
  ] as const);
  const labels = ["Culture", "Fleurs", "Duels", "Progression"] as const;
  const warnings = results.flatMap((result, index) => result.status === "rejected"
    ? [`${labels[index]} indisponible.`]
    : []);
  if (results.every((result) => result.status === "rejected")) {
    return NextResponse.json({ error: "Session Placard indisponible.", warnings }, { status: 503 });
  }
  return NextResponse.json({
    activeRun: results[0].status === "fulfilled" ? results[0].value : null,
    flowers: results[1].status === "fulfilled" ? results[1].value : [],
    battles: results[2].status === "fulfilled" ? results[2].value : [],
    progress: results[3].status === "fulfilled" ? results[3].value : null,
    warnings,
  }, {
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}
