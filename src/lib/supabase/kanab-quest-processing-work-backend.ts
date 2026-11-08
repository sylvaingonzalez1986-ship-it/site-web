import "server-only";
import { isKqProcessingActorId, isKqProcessingJob, isKqProcessingWorkQuote, type KqProcessingJob, type KqProcessingPlan } from "@/lib/kanab-quest-processing-work";
import { createSupabaseServiceClient } from "./admin";

export async function getKqProcessingJobs(userId: string): Promise<{ version: 1; jobs: KqProcessingJob[] } | null> {
  const result = await createSupabaseServiceClient().rpc("rpc_kq_processing_work_jobs", { p_user_id: userId });
  if (result.error) {
    if (result.error.code === "PGRST202" || /function .*rpc_kq_processing_work_jobs.*does not exist/i.test(result.error.message)) return null;
    throw new Error(`[supabase:processing-work] ${result.error.message}`);
  }
  // The optional feature also supports snapshots from the prior application.
  if (result.data === null || result.data === undefined) return null;
  if (result.data.version !== 1 || !Array.isArray(result.data.jobs) || !result.data.jobs.every(isKqProcessingJob)) throw new Error("[supabase:processing-work] invalid jobs snapshot");
  return result.data;
}

export async function getKqProcessingWorkQuote(userId: string, flowerId: string, plan: KqProcessingPlan | null = null, actorId?: string) {
  if (actorId !== undefined && !isKqProcessingActorId(actorId)) throw new Error("Choix de personne invalide. Actualise l’Atelier.");
  const result = await createSupabaseServiceClient().rpc("rpc_kq_processing_work_quote", {
    p_user_id: userId, p_flower_id: flowerId,
    p_work: plan ? { ...plan, quote: undefined } : null,
    ...(actorId === undefined ? {} : { p_actor_id: actorId }),
  });
  if (result.error) throw new Error(`[supabase:processing-work] ${result.error.message}`);
  if (!isKqProcessingWorkQuote(result.data) || result.data.flowerId.toLowerCase() !== flowerId.toLowerCase()
    || actorId !== undefined && (result.data.actorChoiceVersion !== 1 || result.data.actorId !== actorId)) throw new Error("[supabase:processing-work] invalid work quote");
  return result.data;
}
