import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import type { PioneerPackState, PioneerPackClaim } from "@/lib/pioneer-pack";

export class PioneerPackError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}
function failure(message: string): never {
  if (message.includes("pioneer_not_open")) throw new PioneerPackError("Rendez-vous le 15 octobre", 423);
  if (message.includes("pioneer_not_eligible")) {
    throw new PioneerPackError("Aucune commande éligible n’a été retrouvée sur ton compte.", 409);
  }
  throw new PioneerPackError("Le Pack des Pionniers est momentanément indisponible. Réessaie dans un instant.", 503);
}
async function request(functionName: string, userId: string): Promise<PioneerPackState> {
  const { data, error } = await createSupabaseServiceClient().rpc(functionName, { p_user_id: userId });
  if (error) failure(error.message);
  if (!data || typeof data.eligible !== "boolean" || typeof data.claimed !== "boolean" || typeof data.available !== "boolean") failure("invalid_state");
  return data;
}
export async function getPioneerPack(userId: string): Promise<PioneerPackState> {
  return request("rpc_kq_pioneer_pack_state", userId);
}
export async function claimPioneerPack(userId: string): Promise<PioneerPackClaim> {
  return await request("rpc_kq_claim_pioneer_pack", userId) as PioneerPackClaim;
}
