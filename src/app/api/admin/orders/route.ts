import { NextResponse } from "next/server";
import { readStoreByBackend } from "@/lib/data-backend";

export async function GET() {
  const store = await readStoreByBackend();
  return NextResponse.json({ orders: store.orders });
}
