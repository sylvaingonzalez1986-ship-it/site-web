import "server-only";
import type { ChanvrierProgress, ChanvrierShowcase } from "@/lib/chanvrier-progress";
import { createSupabaseServiceClient } from "./admin";
import { getChanvrierCareer } from "./chanvrier-career-backend";
export async function getChanvrierProgress(userId: string): Promise<ChanvrierProgress> {
  const [{ data, error }, career] = await Promise.all([
    createSupabaseServiceClient().rpc("rpc_chanvrier_progress", { p_user_id: userId }),
    getChanvrierCareer(userId),
  ]);
  if (error || !data) throw new Error("[supabase:chanvrier-progress] unavailable");
  return { ...data, career } as ChanvrierProgress;
}
export async function saveChanvrierShowcase(userId: string, showcase: ChanvrierShowcase | null, seen: number | null) {
  const { error } = await createSupabaseServiceClient().rpc("rpc_chanvrier_showcase", { p_user_id: userId, p_showcase: showcase, p_seen: seen });
  if (error) throw new Error(error.message.includes("showcase_not_owned") ? "showcase_not_owned" : "[supabase:chanvrier-progress] unavailable");
}
