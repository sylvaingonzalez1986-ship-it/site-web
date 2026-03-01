﻿import { NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import {
  getLotteryConfigByBackend,
  getLotteryInventoryForCustomerByBackend,
  getLotteryTicketsForCustomerByBackend,
} from "@/lib/lottery-backend";

export const runtime = "nodejs";

export async function GET() {
  const session = await getCurrentCustomerSessionByBackend();
  if (!session) {
    return NextResponse.json({ tickets: [], inventory: null, config: null }, { status: 401 });
  }

  try {
    const [inventory, tickets, config] = await Promise.all([
      getLotteryInventoryForCustomerByBackend(session.customerId),
      getLotteryTicketsForCustomerByBackend(session.customerId),
      getLotteryConfigByBackend(),
    ]);

    return NextResponse.json({ tickets, inventory, config });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lecture tickets impossible.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


