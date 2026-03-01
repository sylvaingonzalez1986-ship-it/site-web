import { NextResponse } from "next/server";
import { denyIfNotAdminApi } from "@/lib/admin-guard";
import { logAuditEvent } from "@/lib/audit-log";
import { LotteryCardImageUploadError, saveLotteryCardImageUpload } from "@/lib/lottery-card-image-storage";
import { getRequestIp, hitRateLimit } from "@/lib/security-rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }

  const ip = getRequestIp(request);

  try {
    const rl = await hitRateLimit({ key: `upload_lottery_card_image:${ip}`, windowSeconds: 60, maxHits: 10 });
    if (!rl.allowed) {
      return NextResponse.json({ error: "Trop de requetes." }, { status: 429 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Fichier manquant." }, { status: 400 });
    }

    const imagePath = await saveLotteryCardImageUpload(file);
    logAuditEvent({ eventType: "upload_lottery_card_image", ip, metadata: { imagePath } });
    return NextResponse.json({ imagePath }, { status: 201 });
  } catch (error) {
    if (error instanceof LotteryCardImageUploadError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[POST /api/admin/lottery/cards/upload] Unexpected error:", error);
    return NextResponse.json({ error: "Impossible d'envoyer l'image." }, { status: 500 });
  }
}
