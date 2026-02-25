import { NextResponse } from "next/server";
import { denyIfNotAdminApi } from "@/lib/admin-guard";
import { readStoreByBackend } from "@/lib/data-backend";

export async function GET() {
  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }

  const store = await readStoreByBackend();
  return NextResponse.json({ orders: store.orders });
}
