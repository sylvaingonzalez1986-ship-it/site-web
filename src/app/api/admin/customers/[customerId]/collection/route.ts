import { NextResponse } from "next/server";
import { denyIfNotAdminApi } from "@/lib/admin-guard";
import { getCollectionAlbumForCustomerByBackend } from "@/lib/lottery-backend";
import type { AdminCustomerCollectionSummary, AdminCustomerCollectionPageSummary } from "@/types/lottery";

export const runtime = "nodejs";

function mapCollectionSummary(
  collection: Awaited<ReturnType<typeof getCollectionAlbumForCustomerByBackend>>,
): AdminCustomerCollectionSummary {
  const pages: AdminCustomerCollectionPageSummary[] = collection.pages.map((page) => ({
    rarity: page.rarity,
    label: page.label,
    title: page.title,
    totalSlots: page.totalSlots,
    ownedUnique: page.ownedUnique,
    missingCount: page.missingCount,
    duplicateCopies: page.duplicateCopies,
    completionPercent: page.completionPercent,
    isComplete: page.isComplete,
    rewardStatus: page.rewardStatus,
  }));

  return {
    collectionTitle: collection.collectionTitle,
    summary: collection.summary,
    pages,
  };
}

export async function GET(
  _: Request,
  { params }: { params: Promise<{ customerId: string }> },
) {
  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }

  const { customerId } = await params;

  try {
    const collection = await getCollectionAlbumForCustomerByBackend(customerId);
    return NextResponse.json(mapCollectionSummary(collection));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Impossible de charger la collection.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
