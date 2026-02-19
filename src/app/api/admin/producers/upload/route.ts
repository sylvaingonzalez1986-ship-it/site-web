import { NextResponse } from "next/server";
import { ProducerImageUploadError, saveProducerImageUpload } from "@/lib/producer-image-storage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Fichier manquant." }, { status: 400 });
    }

    const imagePath = await saveProducerImageUpload(file);
    return NextResponse.json({ imagePath }, { status: 201 });
  } catch (error) {
    if (error instanceof ProducerImageUploadError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Impossible d'envoyer l'image." }, { status: 500 });
  }
}

