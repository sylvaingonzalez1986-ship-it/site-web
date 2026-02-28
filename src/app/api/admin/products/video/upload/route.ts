import { NextResponse } from "next/server";
import { denyIfNotAdminApi } from "@/lib/admin-guard";
import { ProductVideoUploadError, saveProductVideoUpload } from "@/lib/product-video-storage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Fichier manquant." }, { status: 400 });
  }

  try {
    const videoPath = await saveProductVideoUpload(file);
    return NextResponse.json({ path: videoPath });
  } catch (error) {
    if (error instanceof ProductVideoUploadError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Erreur upload video.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
