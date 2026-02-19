import { NextResponse } from "next/server";
import { clearLegacyCustomerCookie, logoutCustomerByBackend } from "@/lib/customer-backend";

export async function POST() {
  await logoutCustomerByBackend();
  await clearLegacyCustomerCookie();
  return NextResponse.json({ success: true });
}
