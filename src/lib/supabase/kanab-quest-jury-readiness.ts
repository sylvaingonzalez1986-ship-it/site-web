import "server-only";
import { createSupabaseServiceClient } from "./admin";

/** Uses the database clock and does not settle stock, bills or rewards. */
export async function getKqJuryReadiness(userId: string): Promise<{ availableFlowerCount: number; curingFlowerCount: number }> {
  const result = await createSupabaseServiceClient().rpc("rpc_kq_jury_readiness", { p_user_id: userId });
  const value = result.data;
  if (result.error || !value || !Number.isSafeInteger(value.availableFlowerCount) || value.availableFlowerCount < 0
    || !Number.isSafeInteger(value.curingFlowerCount) || value.curingFlowerCount < 0) {
    throw new Error("Le suivi de l’affinage et du jury est momentanément indisponible.");
  }
  return { availableFlowerCount: value.availableFlowerCount, curingFlowerCount: value.curingFlowerCount };
}
