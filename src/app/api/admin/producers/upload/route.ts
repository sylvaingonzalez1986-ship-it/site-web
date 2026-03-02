import { NextResponse } from "next/server";
import { denyIfNotAdminApi } from "@/lib/admin-guard";
import { logAuditEvent } from "@/lib/audit-log";
import { ProducerImageUploadError, saveProducerImageUpload } from "@/lib/producer-image-storage";
import { getRequestIp, hitRateLimit, logRateLimitRejection } from "@/lib/security-rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const denied = await denyIfNotAdminApi();
  if (denied) return denied;

  const ip = getRequestIp(request);
  const rateLimitKey = `upload_producer_image:${ip}`;
  const rl = await hitRateLimit({ key: rateLimitKey, windowSeconds: 60, maxHits: 10 });
  if (!rl.allowed) {
    logRateLimitRejection({
      endpoint: "POST /api/admin/producers/upload",
      key: rateLimitKey,
      ip,
      retryAfterSeconds: rl.retryAfterSeconds,
      maxHits: 10,
      windowSeconds: 60,
    });

    return NextResponse.json({ error: "Trop de requetes." }, { status: 429 });
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
