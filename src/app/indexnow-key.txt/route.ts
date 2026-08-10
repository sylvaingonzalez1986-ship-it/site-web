import { NextResponse } from "next/server";
import { getIndexNowKey } from "@/lib/indexnow";

export const dynamic = "force-dynamic";

export function GET() {
  const key = getIndexNowKey();
  if (!key) {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(key, {
    headers: {
      "cache-control": "public, max-age=3600",
      "content-type": "text/plain; charset=utf-8",
    },
  });
}
