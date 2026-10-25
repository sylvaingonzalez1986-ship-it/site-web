import { getContestNotebookAccessDeniedResponse } from "@/lib/contest-notebook-access";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { getMonthlyReviewDraw } from "@/lib/supabase/monthly-review-draw-backend";

export const runtime = "nodejs";

const headers = { "Cache-Control": "private, no-store, max-age=0" };

export async function GET() {
  const denied = await getContestNotebookAccessDeniedResponse();
  if (denied) return denied;

  try {
    const session = await getCurrentCustomerSessionByBackend("identity");
    const draw = await getMonthlyReviewDraw(session?.customerId ?? null);
    return Response.json({ draw }, { headers });
  } catch {
    return Response.json({ error: "Tirage mensuel momentanément indisponible." }, { status: 503, headers });
  }
}
