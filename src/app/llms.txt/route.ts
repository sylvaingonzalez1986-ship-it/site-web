import { NextResponse } from "next/server";
import { buildLlmsText } from "@/lib/llms-text";

export const revalidate = 86400;

export function GET() {
  return new NextResponse(buildLlmsText(), {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
