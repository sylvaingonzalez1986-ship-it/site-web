﻿import { NextResponse } from "next/server";
import {
  getCurrentCustomerSessionByBackend,
  isAtLeast18,
} from "@/lib/customer-backend";
import { scratchLotteryTicketByBackend } from "@/lib/lottery-backend";
import { getRequestIp, hitRateLimit } from "@/lib/security-rate-limit";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ ticketId: string }> },
) {
  const session = await getCurrentCustomerSessionByBackend();
  if (!session) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  if (!session.customer.dateOfBirth || !isAtLeast18(session.customer.dateOfBirth)) {
    return NextResponse.json(
      { error: "Ouverture de pack reservee aux personnes majeures (18+)." },
      { status: 403 },
    );
  }

  const { ticketId } = await params;

  const ip = getRequestIp(request);
  const rateLimit = await hitRateLimit({
    key: `lottery_scratch:${session.customerId}:${ticketId}:${ip}`,
    windowSeconds: 1,
    maxHits: 1,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Trop de tentatives d'ouverture. Reessaie dans un instant." },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds),
        },
      },
    );
  }

  try {
    const result = await scratchLotteryTicketByBackend({
      userId: session.customerId,
      ticketId,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur ouverture pack.";

    if (message.includes("ticket_not_found_or_already_scratched")) {
      return NextResponse.json(
        { error: "Pack introuvable ou deja ouvert." },
        { status: 409 },
      );
    }

    return NextResponse.json({ error: message }, { status: 400 });
  }
}


