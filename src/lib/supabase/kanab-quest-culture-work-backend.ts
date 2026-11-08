import "server-only";
import { isKqCultureWorkQuote, type KqCultureWorkQuote } from "@/lib/kanab-quest-culture-work";
import { createSupabaseServiceClient } from "./admin";
import { settleKqStaffIfAvailable } from "./kanab-quest-staff-backend";

export async function getKqCultureWorkQuote(ownerId: string, runId: string): Promise<KqCultureWorkQuote> {
  if (!/^[0-9a-f-]{36}$/i.test(ownerId) || !/^[0-9a-f-]{36}$/i.test(runId)) throw new Error("Culture invalide.");
  // A recurring shift must exist before quoting its available hours.
  await settleKqStaffIfAvailable(ownerId);
  const result = await createSupabaseServiceClient().rpc("rpc_kq_culture_work_quote", { p_user_id: ownerId, p_run_id: runId });
  if (result.error) {
    if (/kq_run_not_found|culture_work_run/.test(result.error.message)) throw new Error("Culture introuvable.");
    throw new Error(`[supabase:culture-work] ${result.error.message}`);
  }
  if (!isKqCultureWorkQuote(result.data)) throw new Error("[supabase:culture-work] invalid_quote");
  return result.data;
}
