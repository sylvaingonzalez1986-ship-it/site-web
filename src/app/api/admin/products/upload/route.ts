import { NextResponse } from "next/server";
import { ProductImageUploadError, saveProductImageUpload } from "@/lib/product-image-storage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Fichier manquant." }, { status: 400 });
    }

    const imagePath = await saveProductImageUpload(file);
    return NextResponse.json({ imagePath }, { status: 201 });
  } catch (error) {
    if (error instanceof ProductImageUploadError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Impossible d'envoyer l'image." }, { status: 500 });
  }
}
