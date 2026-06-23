import { NextResponse } from "next/server";
import {
  CONTEST_SCHEMA_MISSING_MESSAGE,
  getContestEntryDetailBySlug,
  isContestSchemaMissingError,
} from "@/lib/contest-backend";
import { getContestFeatureAccessDeniedResponse } from "@/lib/contest-feature";
import { sanitizePublicContestEntryDetail } from "@/lib/contest-public-api";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

export async function GET(_: Request, context: RouteContext) {
  const denied = await getContestFeatureAccessDeniedResponse();
  if (denied) {
    return denied;
  }

  try {
    const { slug } = await context.params;
    const session = await getCurrentCustomerSessionByBackend();
    const detail = await getContestEntryDetailBySlug(slug, session?.customerId, session?.customer.email);

    if (!detail) {
      return NextResponse.json({ error: "Lot premium introuvable." }, { status: 404 });
    }

    return NextResponse.json(sanitizePublicContestEntryDetail(detail));
  } catch (error) {
    if (isContestSchemaMissingError(error)) {
      return NextResponse.json({ error: CONTEST_SCHEMA_MISSING_MESSAGE }, { status: 503 });
    }
    throw error;
  }
}
