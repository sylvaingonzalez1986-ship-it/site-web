import "server-only";
import { isKqCultureWorkChoice, isKqCultureWorkQuote, type KqCultureWorkChoice, type KqCultureWorkQuote } from "@/lib/kanab-quest-culture-work";
import { createSupabaseServiceClient } from "./admin";
import { settleKqStaffIfAvailable } from "./kanab-quest-staff-backend";

export async function getKqCultureWorkQuote(ownerId: string, runId: string, workChoice?: KqCultureWorkChoice): Promise<KqCultureWorkQuote> {
  if (!/^[0-9a-f-]{36}$/i.test(ownerId) || !/^[0-9a-f-]{36}$/i.test(runId)) throw new Error("Culture invalide.");
  if (workChoice !== undefined && !isKqCultureWorkChoice(workChoice)) throw new Error("culture_work_changed");
  // A recurring shift must exist before quoting its available hours.
  await settleKqStaffIfAvailable(ownerId);
  const result = await createSupabaseServiceClient().rpc("rpc_kq_culture_work_quote", {
    p_user_id: ownerId, p_run_id: runId, ...(workChoice !== undefined ? { p_work_choice: workChoice } : {}),
  });
  if (result.error) {
    if (/kq_run_not_found|kq_run_unavailable|kq_campaign_unavailable|culture_work_run/.test(result.error.message)) throw new Error("Culture introuvable.");
    throw new Error(`[supabase:culture-work] ${result.error.message}`);
  }
  if (!isKqCultureWorkQuote(result.data)) throw new Error("[supabase:culture-work] invalid_quote");
  return result.data;
}
