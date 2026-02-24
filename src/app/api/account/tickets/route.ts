﻿import { NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import {
  getLotteryConfigByBackend,
  getLotteryTicketsForCustomerByBackend,
} from "@/lib/lottery-backend";

export const runtime = "nodejs";

export async function GET() {
  const session = await getCurrentCustomerSessionByBackend();
  if (!session) {
    return NextResponse.json({ tickets: [], config: null }, { status: 401 });
  }

  try {
    const [tickets, config] = await Promise.all([
      getLotteryTicketsForCustomerByBackend(session.customerId),
      getLotteryConfigByBackend(),
    ]);

    return NextResponse.json({ tickets, config });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lecture tickets impossible.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


