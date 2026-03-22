import { NextResponse } from "next/server";
import { logAuditEvent } from "@/lib/audit-log";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { exportCustomerData } from "@/lib/customer-data-export";
import { getRequestIp, hitRateLimit, logRateLimitRejection } from "@/lib/security-rate-limit";

export const runtime = "nodejs";

function buildDownloadFilename(): string {
  const day = new Date().toISOString().slice(0, 10);
  return `mes-donnees-${day}.json`;
}

export async function GET(request: Request) {
  const session = await getCurrentCustomerSessionByBackend();
  if (!session) {
    return NextResponse.json({ error: "Non autorise." }, { status: 401 });
  }

  const ip = getRequestIp(request);
  const rateLimitKey = `account_export:${session.customerId}:${ip}`;
  const rateLimit = await hitRateLimit({ key: rateLimitKey, windowSeconds: 60 * 60, maxHits: 2 });
  if (!rateLimit.allowed) {
    logRateLimitRejection({
      endpoint: "GET /api/account/export",
      key: rateLimitKey,
      ip,
      actorEmail: session.customer.email,
      retryAfterSeconds: rateLimit.retryAfterSeconds,
      maxHits: 2,
      windowSeconds: 60 * 60,
    });

    return NextResponse.json(
      { error: "Trop de demandes d'export. Reessaie plus tard." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  const exportPayload = await exportCustomerData(session.customerId);
  if (!exportPayload) {
    return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });
  }

  logAuditEvent({
    eventType: "customer_data_export",
    actorEmail: session.customer.email,
    ip,
    metadata: {
      customerId: session.customerId,
      ordersCount: exportPayload.orders.length,
      lotteryTicketsCount: exportPayload.lotteryTickets.length,
    },
  });

  return new NextResponse(JSON.stringify(exportPayload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${buildDownloadFilename()}"`,
      "Cache-Control": "no-store",
    },
  });
}