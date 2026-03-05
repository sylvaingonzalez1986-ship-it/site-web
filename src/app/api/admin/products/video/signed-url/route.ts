import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { denyIfNotAdminApi } from "@/lib/admin-guard";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import {
  PRODUCT_VIDEO_UPLOAD_MAX_BYTES,
  isSupportedProductVideoMimeType,
} from "@/lib/product-video-policy";

export const runtime = "nodejs";

const PRODUCT_VIDEO_BUCKET = "product-videos";
const SIGNED_URL_EXPIRES_IN = 120;

export async function POST(request: Request) {
  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }

  let body: { contentType?: string; fileSize?: number } | null = null;
  try {
    body = (await request.json()) as { contentType?: string; fileSize?: number };
  } catch {
    return NextResponse.json({ error: "Corps de requete invalide." }, { status: 400 });
  }

  const contentType = body?.contentType;
  const fileSize = body?.fileSize;

  if (!contentType || typeof contentType !== "string") {
    return NextResponse.json({ error: "contentType requis." }, { status: 400 });
  }

  if (!isSupportedProductVideoMimeType(contentType)) {
    return NextResponse.json({ error: "Type de fichier non autorise." }, { status: 415 });
  }

  if (typeof fileSize === "number" && fileSize > PRODUCT_VIDEO_UPLOAD_MAX_BYTES) {
    return NextResponse.json({ error: "Fichier trop volumineux." }, { status: 413 });
  }

  const extension = contentType === "video/quicktime" ? "mov" : "mp4";
  const objectName = `${randomUUID()}.${extension}`;

  const supabase = createSupabaseServiceClient();

  const { data, error } = await supabase.storage
    .from(PRODUCT_VIDEO_BUCKET)
    .createSignedUploadUrl(objectName);

  if (error || !data) {
    const message = error?.message ?? "Impossible de generer l'URL d'upload.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const { data: publicUrlData } = supabase.storage
    .from(PRODUCT_VIDEO_BUCKET)
    .getPublicUrl(objectName);

  return NextResponse.json({
    signedUrl: data.signedUrl,
    token: data.token,
    objectName,
    publicUrl: publicUrlData?.publicUrl ?? null,
    contentType,
  });
}
