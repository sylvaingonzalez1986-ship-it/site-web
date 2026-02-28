import { NextResponse } from "next/server";
import { denyIfNotAdminApi } from "@/lib/admin-guard";
import { logAuditEvent } from "@/lib/audit-log";
import { ProducerImageUploadError, saveProducerImageUpload } from "@/lib/producer-image-storage";
import { getRequestIp, hitRateLimit } from "@/lib/security-rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const denied = await denyIfNotAdminApi();
  if (denied) return denied;

  const ip = getRequestIp(request);
  const rl = await hitRateLimit({ key: `upload_producer_image:${ip}`, windowSeconds: 60, maxHits: 10 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Trop de requêtes." }, { status: 429 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Fichier manquant." }, { status: 400 });
    }

    const imagePath = await saveProducerImageUpload(file);
    logAuditEvent({ eventType: "upload_producer_image", ip, metadata: { imagePath } });
    return NextResponse.json({ imagePath }, { status: 201 });
  } catch (error) {
    if (error instanceof ProducerImageUploadError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Impossible d'envoyer l'image." }, { status: 500 });
  }
}

