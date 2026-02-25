import { NextResponse } from "next/server";
import { isCmsPagesEnabledServer } from "@/lib/cms-pages-feature";
import { readTutorialCmsPagesByBackend } from "@/lib/cms-pages-backend";

export async function GET() {
  if (!isCmsPagesEnabledServer()) {
    return NextResponse.json({ pages: [] });
  }

  const pages = await readTutorialCmsPagesByBackend();
  return NextResponse.json({ pages });
}

