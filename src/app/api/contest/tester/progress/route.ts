import { NextResponse } from "next/server";
import {
  CONTEST_SCHEMA_MISSING_MESSAGE,
  getContestTesterProgress,
  isContestSchemaMissingError,
} from "@/lib/contest-backend";
import { getContestFeatureAccessDeniedResponse } from "@/lib/contest-feature";
import { sanitizePublicContestProgress } from "@/lib/contest-public-api";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const denied = await getContestFeatureAccessDeniedResponse();
  if (denied) {
    return denied;
  }

  const session = await getCurrentCustomerSessionByBackend();
  if (!session) {
    return NextResponse.json({ progress: null, error: "Connexion requise." }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const season = url.searchParams.get("season") ?? undefined;
    const progress = await getContestTesterProgress({
      customerId: session.customerId,
      seasonCode: season,
    });

    return NextResponse.json({ progress: progress ? sanitizePublicContestProgress(progress) : null });
  } catch (error) {
    if (isContestSchemaMissingError(error)) {
      return NextResponse.json({ error: CONTEST_SCHEMA_MISSING_MESSAGE }, { status: 503 });
    }
    throw error;
  }
}
