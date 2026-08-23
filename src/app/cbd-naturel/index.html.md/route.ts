import { NextResponse } from "next/server";
import { buildCbdNaturelMarkdown } from "@/lib/llm-context";
import { getSiteUrl } from "@/lib/site-url";

export const revalidate = 86400;

export function GET() {
  const baseUrl = getSiteUrl();

  return new NextResponse(buildCbdNaturelMarkdown(baseUrl), {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      Link: `<${baseUrl}/cbd-naturel>; rel="canonical"`,
    },
  });
}
