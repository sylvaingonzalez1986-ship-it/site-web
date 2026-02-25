import { NextResponse } from "next/server";
import { isCmsPagesEnabledServer } from "@/lib/cms-pages-feature";
import { readPublishedCmsPagesByBackend } from "@/lib/cms-pages-backend";

export async function GET() {
  if (!isCmsPagesEnabledServer()) {
    return NextResponse.json({ pages: [] });
  }

  const pages = await readPublishedCmsPagesByBackend();
  return NextResponse.json({ pages });
}
