import { NextResponse } from "next/server";
import {
  ProductAnalysisUploadError,
  saveProductAnalysisUpload,
} from "@/lib/product-analysis-storage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Fichier manquant." }, { status: 400 });
    }

    const analysisPath = await saveProductAnalysisUpload(file);
    return NextResponse.json({ analysisPath }, { status: 201 });
  } catch (error) {
    if (error instanceof ProductAnalysisUploadError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: "Impossible d'envoyer le PDF d'analyse." },
      { status: 500 },
    );
  }
}

