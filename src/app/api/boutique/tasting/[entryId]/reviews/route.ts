import { NextResponse } from "next/server";
import { getContestEntryReviewsPage } from "@/lib/contest-backend";
import { isContestFeatureEnabledServer } from "@/lib/contest-feature";
import { sanitizePublicContestReview } from "@/lib/contest-public-api";
import { parseContestReviewCursor } from "@/lib/contest-review-pagination";
import { readPublicStoreByBackend } from "@/lib/data-backend";
import { isProductTastingStorefrontEnabled } from "@/lib/product-tasting-feature";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: Request, context: { params: Promise<{ entryId: string }> }) {
  if (!isProductTastingStorefrontEnabled() || !isContestFeatureEnabledServer()) {
    return NextResponse.json({ error: "Module désactivé." }, { status: 404, headers });
  }
  const cursor = new URL(request.url).searchParams.get("cursor");
  try { parseContestReviewCursor(cursor); } catch {
    return NextResponse.json({ error: "Page d’avis invalide." }, { status: 400, headers });
  }
  try {
    const { entryId } = await context.params;
    const [page, store] = await Promise.all([
      getContestEntryReviewsPage(entryId, { cursor }),
      readPublicStoreByBackend(),
    ]);
    if (!page || !store.products.some((product) => product.id === page.productId)) {
      return NextResponse.json({ error: "Lot introuvable." }, { status: 404, headers });
    }
    return NextResponse.json({ reviews: page.reviews.map(sanitizePublicContestReview), nextReviewCursor: page.nextReviewCursor }, { headers });
  } catch (error) {
    console.error("Unable to load storefront review page", error);
    return NextResponse.json({ error: "Les avis sont momentanément indisponibles." }, { status: 503, headers });
  }
}
