import { NextResponse } from "next/server";
import { getContestEntryReviewsPage } from "@/lib/contest-backend";
import { getContestFeatureAccessDeniedResponse } from "@/lib/contest-feature";
import { sanitizePublicContestReview } from "@/lib/contest-public-api";
import { parseContestReviewCursor } from "@/lib/contest-review-pagination";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: Request, context: { params: Promise<{ entryId: string }> }) {
  const denied = await getContestFeatureAccessDeniedResponse();
  if (denied) return denied;
  const cursor = new URL(request.url).searchParams.get("cursor");
  try { parseContestReviewCursor(cursor); } catch {
    return NextResponse.json({ error: "Page d’avis invalide." }, { status: 400, headers });
  }
  try {
    const { entryId } = await context.params;
    const session = await getCurrentCustomerSessionByBackend();
    const page = await getContestEntryReviewsPage(entryId, { cursor, viewerCustomerId: session?.customerId });
    if (!page) return NextResponse.json({ error: "Lot introuvable." }, { status: 404, headers });
    return NextResponse.json({ reviews: page.reviews.map(sanitizePublicContestReview), nextReviewCursor: page.nextReviewCursor }, { headers });
  } catch (error) {
    console.error("Unable to load notebook review page", error);
    return NextResponse.json({ error: "Les avis sont momentanément indisponibles." }, { status: 503, headers });
  }
}
