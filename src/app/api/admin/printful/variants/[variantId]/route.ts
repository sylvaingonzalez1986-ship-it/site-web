import { NextResponse } from "next/server";
import { denyIfNotAdminApi, getValidatedAdminContext } from "@/lib/admin-guard";
import {
  publishPrintfulVariantToStoreByBackend,
  unpublishPrintfulVariantFromStoreByBackend,
} from "@/lib/printful-backend";
import { hitRateLimit } from "@/lib/security-rate-limit";

export const runtime = "nodejs";

function parseVariantId(raw: string): number | null {
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
  _request: Request,
  { params }: { params: Promise<{ variantId: string }> },
) {
  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }

  const adminContext = await getValidatedAdminContext();
  if (!adminContext) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const { variantId } = await params;
  const safeVariantId = parseVariantId(variantId);
  if (!safeVariantId) {
    return NextResponse.json({ error: "Variante Printful invalide." }, { status: 400 });
  }

  const rateLimit = await hitRateLimit({
    key: `admin:printful:publish:${adminContext.customerId}`,
    windowSeconds: 60,
    maxHits: 100,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Trop d'actions. Ralentis." }, { status: 429 });
  }

  try {
    const published = await publishPrintfulVariantToStoreByBackend({
      syncVariantId: safeVariantId,
    });
    return NextResponse.json({ success: true, productId: published.productId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Publication Printful impossible.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ variantId: string }> },
) {
  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }

  const adminContext = await getValidatedAdminContext();
  if (!adminContext) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const { variantId } = await params;
  const safeVariantId = parseVariantId(variantId);
  if (!safeVariantId) {
    return NextResponse.json({ error: "Variante Printful invalide." }, { status: 400 });
  }

  const rateLimit = await hitRateLimit({
    key: `admin:printful:unpublish:${adminContext.customerId}`,
    windowSeconds: 60,
    maxHits: 100,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Trop d'actions. Ralentis." }, { status: 429 });
  }

  try {
    await unpublishPrintfulVariantFromStoreByBackend({
      syncVariantId: safeVariantId,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Dépublication Printful impossible.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}


