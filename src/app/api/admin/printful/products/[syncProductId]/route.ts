import { NextResponse } from "next/server";
import { denyIfNotAdminApi, getValidatedAdminContext } from "@/lib/admin-guard";
import {
  publishPrintfulProductToStoreByBackend,
  unpublishPrintfulProductFromStoreByBackend,
} from "@/lib/printful-backend";
import { getRequestIp, hitRateLimit, logRateLimitRejection } from "@/lib/security-rate-limit";

export const runtime = "nodejs";

function parseSyncProductId(raw: string): number | null {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  const integer = Math.floor(parsed);
  if (integer <= 0) {
    return null;
  }

  return integer;
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ syncProductId: string }> },
) {
  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }

  const adminContext = await getValidatedAdminContext();
  if (!adminContext) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const { syncProductId } = await params;
  const safeSyncProductId = parseSyncProductId(syncProductId);
  if (!safeSyncProductId) {
    return NextResponse.json({ error: "Produit Printful invalide." }, { status: 400 });
  }

  const ip = getRequestIp(request);
  const publishRateLimitKey = `admin:printful:publish-product:${adminContext.customerId}`;
  const rateLimit = await hitRateLimit({
    key: publishRateLimitKey,
    windowSeconds: 60,
    maxHits: 100,
  });
  if (!rateLimit.allowed) {
    logRateLimitRejection({
      endpoint: "PUT /api/admin/printful/products/[syncProductId]",
      key: publishRateLimitKey,
      ip,
      actorEmail: adminContext.email,
      retryAfterSeconds: rateLimit.retryAfterSeconds,
      maxHits: 100,
      windowSeconds: 60,
    });

    return NextResponse.json({ error: "Trop d'actions. Ralentis." }, { status: 429 });
  }

  try {
    const published = await publishPrintfulProductToStoreByBackend({
      syncProductId: safeSyncProductId,
    });
    return NextResponse.json({ success: true, productId: published.productId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Publication Printful impossible.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ syncProductId: string }> },
) {
  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }

  const adminContext = await getValidatedAdminContext();
  if (!adminContext) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const { syncProductId } = await params;
  const safeSyncProductId = parseSyncProductId(syncProductId);
  if (!safeSyncProductId) {
    return NextResponse.json({ error: "Produit Printful invalide." }, { status: 400 });
  }

  const ip = getRequestIp(request);
  const unpublishRateLimitKey = `admin:printful:unpublish-product:${adminContext.customerId}`;
  const rateLimit = await hitRateLimit({
    key: unpublishRateLimitKey,
    windowSeconds: 60,
    maxHits: 100,
  });
  if (!rateLimit.allowed) {
    logRateLimitRejection({
      endpoint: "DELETE /api/admin/printful/products/[syncProductId]",
      key: unpublishRateLimitKey,
      ip,
      actorEmail: adminContext.email,
      retryAfterSeconds: rateLimit.retryAfterSeconds,
      maxHits: 100,
      windowSeconds: 60,
    });

    return NextResponse.json({ error: "Trop d'actions. Ralentis." }, { status: 429 });
  }

  try {
    await unpublishPrintfulProductFromStoreByBackend({
      syncProductId: safeSyncProductId,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Dépublication Printful impossible.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}


