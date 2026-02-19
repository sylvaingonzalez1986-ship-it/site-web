import { NextResponse } from "next/server";
import { addPromoCodeByBackend } from "@/lib/customer-backend";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ customerId: string }> },
) {
  const { customerId } = await params;

  try {
    const payload = (await request.json()) as {
      code?: string;
      discountPercent?: number;
    };

    if (!payload.code || !Number.isFinite(payload.discountPercent)) {
      return NextResponse.json({ error: "Code promo invalide." }, { status: 400 });
    }

    const updated = await addPromoCodeByBackend(customerId, {
      code: payload.code,
      discountPercent: Number(payload.discountPercent),
    });

    if (!updated) {
      return NextResponse.json({ error: "Client introuvable." }, { status: 404 });
    }

    return NextResponse.json({ customer: updated, promoCodes: updated.promoCodes });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Payload invalide." },
      { status: 400 },
    );
  }
}
