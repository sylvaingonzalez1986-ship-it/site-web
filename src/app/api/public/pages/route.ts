import { NextResponse } from "next/server";
import { isCmsPagesEnabledServer } from "@/lib/cms-pages-feature";
import { readPublishedCmsPagesByBackend } from "@/lib/cms-pages-backend";

const PUBLIC_API_CACHE_CONTROL = "public, s-maxage=60, stale-while-revalidate=300";

export async function GET() {
  if (!isCmsPagesEnabledServer()) {
    return NextResponse.json(
      { pages: [] },
      {
        headers: {
          "Cache-Control": PUBLIC_API_CACHE_CONTROL,
        },
      },
    );
  }

  const pages = await readPublishedCmsPagesByBackend();
  return NextResponse.json(
    { pages },
    {
      headers: {
        "Cache-Control": PUBLIC_API_CACHE_CONTROL,
      },
    },
  );
}
