import { NextResponse } from "next/server";
import { denyIfNotAdminApi } from "@/lib/admin-guard";
import { readStoreByBackend } from "@/lib/data-backend";
import { listSwissBitcoinPayments } from "@/lib/swiss-bitcoin-pay-service";

export async function GET() {
  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }

  const store = await readStoreByBackend();
  try {
    const bitcoinPayments = await listSwissBitcoinPayments(store.orders
      .filter((order) => order.paymentProvider === "swiss_bitcoin_pay" || order.swissBitcoinCardStartedAt)
      .map((order) => order.id));
    return NextResponse.json({ orders: store.orders, bitcoinPayments }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json({ orders: store.orders, bitcoinPayments: null }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  }
}
