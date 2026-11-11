import { getSupportSummary } from "@/lib/support-backend";
import { supportFailure, supportJson, supportRateLimit } from "@/lib/support-http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const limited = await supportRateLimit(request, "public", 90);
    if (limited) return limited;
    const offset = Number(new URL(request.url).searchParams.get("offset") ?? 0);
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1_000_000) return supportJson({ error: "Page invalide." }, 400);
    return supportJson(await getSupportSummary(offset));
  } catch (error) { return supportFailure(error); }
}
