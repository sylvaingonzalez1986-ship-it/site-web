import { NextResponse } from "next/server";
import { getValidatedAdminContext } from "@/lib/admin-guard";
import {
  getKqAdminCollectionSnapshot,
  getKqAdminHeritageSnapshot,
  getKqAdminLaunchReadinessFromSnapshots,
  getKqAdminNotebookRewardPreview,
  getKqAdminSeasonRewardPreview,
  getKqAdminSeasonRolloverPreview,
} from "@/lib/supabase/kanab-quest-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getValidatedAdminContext();
  if (!admin) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const sourceResults = await Promise.allSettled([
    getKqAdminSeasonRewardPreview(),
    getKqAdminHeritageSnapshot(admin.email),
    getKqAdminCollectionSnapshot(admin.email),
    getKqAdminNotebookRewardPreview(admin.email),
    getKqAdminSeasonRolloverPreview(),
  ] as const);
  const sourceLabels = ["Saison", "Héritages", "Collection", "Carnet", "Clôture de saison"] as const;
  const warnings = sourceResults.flatMap((result, index) => result.status === "rejected"
    ? [`${sourceLabels[index]} : ${result.reason instanceof Error ? result.reason.message : "indisponible"}`]
    : []);
  const readinessResult = sourceResults[1].status === "fulfilled" && sourceResults[2].status === "fulfilled"
    ? await Promise.allSettled([
        getKqAdminLaunchReadinessFromSnapshots(sourceResults[1].value, sourceResults[2].value),
      ]).then(([result]) => result)
    : { status: "rejected", reason: new Error("Catalogues requis indisponibles.") } as PromiseRejectedResult;
  if (readinessResult.status === "rejected") {
    warnings.unshift(`Préflight : ${readinessResult.reason instanceof Error ? readinessResult.reason.message : "indisponible"}`);
  }
  if (sourceResults.every((result) => result.status === "rejected")) {
    return NextResponse.json({
      error: "Initialisation Placard indisponible.",
      warnings,
    }, { status: 503 });
  }
  return NextResponse.json({
    readiness: readinessResult.status === "fulfilled" ? readinessResult.value : null,
    seasonRewards: sourceResults[0].status === "fulfilled" ? sourceResults[0].value : null,
    heritage: sourceResults[1].status === "fulfilled" ? sourceResults[1].value : null,
    collection: sourceResults[2].status === "fulfilled" ? sourceResults[2].value : null,
    notebookRewards: sourceResults[3].status === "fulfilled" ? sourceResults[3].value : null,
    seasonRollover: sourceResults[4].status === "fulfilled" ? sourceResults[4].value : null,
    warnings,
  }, {
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}
