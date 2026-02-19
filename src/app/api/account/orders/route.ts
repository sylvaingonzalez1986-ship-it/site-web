import { NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { readStoreByBackend } from "@/lib/data-backend";
import { buildEmptyLoyaltySummary, buildLoyaltySummaryWithBonus } from "@/lib/loyalty";

export async function GET() {
  const session = await getCurrentCustomerSessionByBackend();
  if (!session) {
    return NextResponse.json(
      { orders: [], loyalty: buildEmptyLoyaltySummary() },
      { status: 401 },
    );
  }

  const store = await readStoreByBackend();
  const orders = store.orders.filter((order) => order.customerId === session.customerId);
  const loyalty = buildLoyaltySummaryWithBonus(orders, session.customer.loyaltyPoints ?? 0);

  return NextResponse.json({ orders, loyalty });
}
