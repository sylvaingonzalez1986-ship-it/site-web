import { NextResponse } from "next/server";
import { denyIfNotAdminApi, getValidatedAdminContext } from "@/lib/admin-guard";
import { grantLotteryTicketsToCustomerByBackend } from "@/lib/lottery-backend";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ customerId: string }> },
) {
  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }

  const adminContext = await getValidatedAdminContext();
  if (!adminContext) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const { customerId } = await params;

  try {
    const payload = (await request.json()) as {
      ticketCount: number;
      reason: string;
    };

    const ticketCount = Number(payload.ticketCount);
    if (!Number.isInteger(ticketCount) || ticketCount < 1 || ticketCount > 200) {
      return NextResponse.json({ error: "Nombre de tickets invalide (1-200)." }, { status: 400 });
    }

    const granted = await grantLotteryTicketsToCustomerByBackend({
      userId: customerId,
      ticketCount,
      reason: payload.reason,
      adminEmail: adminContext.email,
    });

    return NextResponse.json({ granted });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Attribution tickets impossible.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}


