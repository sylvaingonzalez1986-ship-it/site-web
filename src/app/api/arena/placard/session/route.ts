import { NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { isKqPlayerApiEnabled } from "@/lib/kanab-quest-player-access";
import { getKqPlayerCoreSnapshot } from "@/lib/supabase/kanab-quest-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = performance.now();
  if (!isKqPlayerApiEnabled()) {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }
  const session = await getCurrentCustomerSessionByBackend("identity");
  const authenticatedAt = performance.now();
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const results = await Promise.allSettled([
    getKqPlayerCoreSnapshot(session.customerId),
  ] as const);
  const labels = ["Session de jeu"] as const;
  const warnings = results.flatMap((result, index) => result.status === "rejected"
    ? [`${labels[index]} indisponible.`]
    : []);
  if (results.every((result) => result.status === "rejected")) {
    return NextResponse.json({ error: "Session Placard indisponible.", warnings }, { status: 503 });
  }
  return NextResponse.json({
    activeRun: results[0].status === "fulfilled" ? results[0].value.activeRun : null,
    flowers: results[0].status === "fulfilled" ? results[0].value.flowers : [],
    battles: results[0].status === "fulfilled" ? results[0].value.battles : [],
    progress: results[0].status === "fulfilled" ? results[0].value.progress : null,
    warnings,
  }, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Server-Timing": `auth;dur=${(authenticatedAt - startedAt).toFixed(1)}, data;dur=${(performance.now() - authenticatedAt).toFixed(1)}`,
    },
  });
}
