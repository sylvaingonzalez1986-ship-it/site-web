import { NextResponse } from "next/server";
import { denyIfNotAdminApi } from "@/lib/admin-guard";
import { logAuditEvent } from "@/lib/audit-log";
import {
  ProductAnalysisUploadError,
  saveProductAnalysisUpload,
} from "@/lib/product-analysis-storage";
import { getRequestIp, hitRateLimit } from "@/lib/security-rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const denied = await denyIfNotAdminApi();
  if (denied) return denied;

  const ip = getRequestIp(request);
  const rl = await hitRateLimit({ key: `upload_product_analysis:${ip}`, windowSeconds: 60, maxHits: 10 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Trop de requêtes." }, { status: 429 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Fichier manquant." }, { status: 400 });
    }

    const analysisPath = await saveProductAnalysisUpload(file);
    logAuditEvent({ eventType: "upload_product_analysis", ip, metadata: { analysisPath } });
    return NextResponse.json({ analysisPath }, { status: 201 });
  } catch (error) {
    if (error instanceof ProductAnalysisUploadError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("upload_product_analysis_failed", error);

    return NextResponse.json(
      { error: "Impossible d'envoyer le PDF d'analyse." },
      { status: 500 },
    );
  }
}

