import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import { supportJson, supportRateLimit } from "@/lib/support-http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const limited = await supportRateLimit(request, "profile", 20);
  if (limited) return limited;
  try {
    const session = await getCurrentCustomerSessionByBackend("identity");
    if (!session) return supportJson({ pseudonym: "" });
    const result = await createSupabaseServiceClient().from("arena_chanvrier_profiles").select("nickname").eq("user_id", session.customerId).maybeSingle();
    return supportJson({ pseudonym: typeof result.data?.nickname === "string" ? result.data.nickname : "" });
  } catch { return supportJson({ pseudonym: "" }); }
}
