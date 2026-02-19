import { NextResponse } from "next/server";
import { readPublicStoreByBackend } from "@/lib/data-backend";

export async function GET() {
  const store = await readPublicStoreByBackend();
  return NextResponse.json(store);
}
