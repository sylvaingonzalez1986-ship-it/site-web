import { NextResponse } from "next/server";
import { readPublicStoreByBackend } from "@/lib/data-backend";

const PUBLIC_API_CACHE_CONTROL = "public, s-maxage=60, stale-while-revalidate=300";

export async function GET() {
  const store = await readPublicStoreByBackend();
  return NextResponse.json(store, {
    headers: {
      "Cache-Control": PUBLIC_API_CACHE_CONTROL,
    },
  });
}
