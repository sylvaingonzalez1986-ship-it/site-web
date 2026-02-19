import { NextResponse } from "next/server";
import { adminUpdateCustomerByBackend, getCustomerByIdFullByBackend } from "@/lib/customer-backend";
import { readStoreByBackend } from "@/lib/data-backend";
import { buildLoyaltySummary, buildLoyaltySummaryWithBonus } from "@/lib/loyalty";

export const runtime = "nodejs";

type CustomerPatchPayload = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  notes?: string;
  loyaltyPoints?: number;
};

async function buildCustomerDetail(customerId: string) {
  const [customer, store] = await Promise.all([getCustomerByIdFullByBackend(customerId), readStoreByBackend()]);
  if (!customer) {
    return null;
  }

  const orders = store.orders
    .filter((order) => order.customerId === customer.id)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const baseLoyalty = buildLoyaltySummary(orders);
  const loyalty = buildLoyaltySummaryWithBonus(orders, customer.loyaltyPoints);

  return {
    customer,
    orders,
    loyalty: {
      ...loyalty,
      basePoints: baseLoyalty.points,
      bonusPoints: customer.loyaltyPoints,
      totalPoints: loyalty.points,
    },
  };
}

export async function GET(
  _: Request,
  { params }: { params: Promise<{ customerId: string }> },
) {
  const { customerId } = await params;
  const detail = await buildCustomerDetail(customerId);

  if (!detail) {
    return NextResponse.json({ error: "Client introuvable." }, { status: 404 });
  }

  return NextResponse.json(detail);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ customerId: string }> },
) {
  const { customerId } = await params;

  try {
    const payload = (await request.json()) as CustomerPatchPayload;
    const updated = await adminUpdateCustomerByBackend(customerId, payload);
    if (!updated) {
      return NextResponse.json({ error: "Client introuvable." }, { status: 404 });
    }

    const detail = await buildCustomerDetail(updated.id);
    if (!detail) {
      return NextResponse.json({ error: "Client introuvable." }, { status: 404 });
    }

    return NextResponse.json(detail);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Payload invalide." },
      { status: 400 },
    );
  }
}
