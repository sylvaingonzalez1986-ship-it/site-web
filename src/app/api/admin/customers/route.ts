import { NextResponse } from "next/server";
import { getAllCustomersByBackend } from "@/lib/customer-backend";
import { readStoreByBackend } from "@/lib/data-backend";
import { buildLoyaltySummaryWithBonus } from "@/lib/loyalty";

export const runtime = "nodejs";

export async function GET() {
  const [customers, store] = await Promise.all([getAllCustomersByBackend(), readStoreByBackend()]);

  const list = customers.map((customer) => {
    const orders = store.orders.filter((order) => order.customerId === customer.id);
    const loyalty = buildLoyaltySummaryWithBonus(orders, customer.loyaltyPoints);

    return {
      id: customer.id,
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
      city: customer.city,
      country: customer.country,
      createdAt: customer.createdAt,
      ordersCount: orders.length,
      totalSpent: Number(orders.reduce((sum, order) => sum + order.totalAmount, 0).toFixed(2)),
      loyaltyPoints: loyalty.points,
      currentBadge: loyalty.currentBadge,
    };
  });

  return NextResponse.json({ customers: list });
}
