import { timingSafeEqual } from "node:crypto";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

const headers = { "Cache-Control": "no-store" };
const BATCH_SIZE = 100;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret ?? ""}`);
  if (!secret || received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers });
  }

  try {
    // The SQL worker owns chronological settlement, account locks and replay safety.
    // A bounded batch leaves later accounts for the next invocation or their next visit.
    const { data, error } = await createSupabaseServiceClient().rpc("rpc_kq_online_settle_due", { p_limit: BATCH_SIZE });
    if (error || !data || typeof data !== "object" || Array.isArray(data)) throw new Error("settlement_failed");
    const { processedUsers, failedUsers, deferredUsers } = data as Record<string, unknown>;
    const counts = [processedUsers, failedUsers, deferredUsers];
    if (!counts.every(value => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= BATCH_SIZE)
      || (processedUsers as number) + (failedUsers as number) + (deferredUsers as number) > BATCH_SIZE) throw new Error("settlement_invalid_response");
    const failed = (failedUsers as number) > 0;
    return Response.json({ status: failed ? "partial-failure" : "settled", processedUsers, failedUsers, deferredUsers }, { status: failed ? 503 : 200, headers });
  } catch {
    console.warn("[online:cron] settlement unavailable");
    return Response.json({ status: "failed" }, { status: 503, headers });
  }
}
