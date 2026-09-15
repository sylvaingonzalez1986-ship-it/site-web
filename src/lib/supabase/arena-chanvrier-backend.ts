import "server-only";
import { parseChanvrierProfile, type ChanvrierProfile } from "@/lib/arena-chanvrier";
import { createSupabaseServiceClient } from "./admin";

export async function getChanvrierProfile(userId: string): Promise<ChanvrierProfile | null> {
  const result = await createSupabaseServiceClient().from("arena_chanvrier_profiles")
    .select("nickname,gender,clothing,skin,strength").eq("user_id", userId).maybeSingle();
  if (result.error) throw new Error(`[supabase:chanvrier] ${result.error.message}`);
  return parseChanvrierProfile(result.data);
}
export async function saveChanvrierProfile(userId: string, value: unknown) {
  const profile = parseChanvrierProfile(value);
  if (!profile) throw new Error("Choisis ton apparence, ta spécialité et un surnom de 3 à 24 caractères (lettres, chiffres, point, tiret ou underscore).");
  const result = await createSupabaseServiceClient().rpc("rpc_arena_save_chanvrier", { p_user_id: userId, p_profile: profile });
  if (result.error) {
    if (result.error.message.includes("chanvrier_strength_locked")) throw new Error("Ta spécialité est définitive. Tu peux modifier ton apparence et ton surnom.");
    if (result.error.code === "23505") throw new Error("Ce surnom est déjà utilisé.");
    throw new Error(`[supabase:chanvrier] ${result.error.message}`);
  }
  return result.data as { profile: ChanvrierProfile; startingBonusCents: number; created: boolean };
}
