import { NextResponse } from "next/server";
import { denyIfNotAdminApi, getValidatedAdminContext } from "@/lib/admin-guard";
import {
  getPrintfulAdminSnapshotByBackend,
  syncPrintfulCatalogByBackend,
} from "@/lib/printful-backend";
import { hitRateLimit } from "@/lib/security-rate-limit";

export const runtime = "nodejs";

export async function GET() {
  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }

  try {
    const snapshot = await getPrintfulAdminSnapshotByBackend();
    return NextResponse.json(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lecture Printful impossible.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST() {
  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }

  const adminContext = await getValidatedAdminContext();
  if (!adminContext) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const rateLimit = await hitRateLimit({
    key: `admin:printful:sync:${adminContext.customerId}`,
    windowSeconds: 600,
    maxHits: 6,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: "Trop de synchronisations. Réessaie dans quelques minutes.",
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      },
      { status: 429 },
    );
  }

  try {
    const summary = await syncPrintfulCatalogByBackend({
      triggeredBy: adminContext.email,
    });
    const snapshot = await getPrintfulAdminSnapshotByBackend();
    return NextResponse.json({ summary, snapshot });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Synchronisation Printful impossible.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}


