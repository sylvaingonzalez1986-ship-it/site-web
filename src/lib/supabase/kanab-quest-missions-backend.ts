import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import { isKqMissionCode, type KqMissionSnapshot, type KqMissionClaim } from "@/lib/kanab-quest-missions";

export class KqMissionError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}
function failure(message: string): never {
  if (message.includes("mission_not_ready")) throw new KqMissionError("L’objectif n’est pas encore atteint. Actualise ta progression.", 409);
  if (message.includes("mission_unknown")) throw new KqMissionError("Mission inconnue.", 400);
  if (message.includes("mission_collection_inactive")) throw new KqMissionError("Les packs La Botte sont momentanément indisponibles. Ta progression est conservée.", 503);
  throw new KqMissionError("Le centre de missions est momentanément indisponible. Réessaie dans un instant.", 503);
}
export async function getKqMissions(userId: string): Promise<KqMissionSnapshot> {
  const result = await createSupabaseServiceClient().rpc("rpc_kq_mission_state", { p_user_id: userId });
  if (result.error) failure(result.error.message);
  if (!result.data || !Array.isArray(result.data.missions)) failure("invalid_snapshot");
  return result.data as KqMissionSnapshot;
}
export async function claimKqMission(userId: string, code: unknown): Promise<KqMissionClaim> {
  if (!isKqMissionCode(code)) throw new KqMissionError("Mission inconnue.", 400);
  const result = await createSupabaseServiceClient().rpc("rpc_kq_claim_mission", { p_user_id: userId, p_code: code });
  if (result.error) failure(result.error.message);
  return result.data as KqMissionClaim;
}
