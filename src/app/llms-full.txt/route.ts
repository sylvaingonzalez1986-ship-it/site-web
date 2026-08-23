import { NextResponse } from "next/server";
import { buildLlmsFullText } from "@/lib/llm-context";
import { getSiteUrl } from "@/lib/site-url";

export const revalidate = 86400;

export function GET() {
  return new NextResponse(buildLlmsFullText(getSiteUrl()), {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
