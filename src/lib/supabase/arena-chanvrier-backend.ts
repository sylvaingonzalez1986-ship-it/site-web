import "server-only";
import { CHANVRIER_APPEARANCE_OPTIONS, parseChanvrierProfile, type ChanvrierProfile } from "@/lib/arena-chanvrier";
import { createSupabaseServiceClient } from "./admin";

export async function getChanvrierProfile(userId: string): Promise<(ChanvrierProfile & { createdAt: string }) | null> {
  const result = await createSupabaseServiceClient().from("arena_chanvrier_profiles")
    .select("nickname,gender,clothing,skin,strength,appearance,created_at").eq("user_id", userId).maybeSingle();
  if (result.error) throw new Error(`[supabase:chanvrier] ${result.error.message}`);
  if (!result.data) return null;
  const profile = parseChanvrierProfile(result.data);
  if (!profile) throw new Error("[supabase:chanvrier] Apparence enregistrée illisible.");
  return { ...profile, createdAt: result.data.created_at };
}
export async function saveChanvrierProfile(userId: string, value: unknown) {
  const profile = parseChanvrierProfile(value);
  if (!profile) throw new Error("Choisis ton apparence, ta spécialité et un surnom de 3 à 24 caractères (lettres, chiffres, point, tiret ou underscore).");
  const input = (value as { appearance?: Record<string, unknown> }).appearance;
  // Older editors submit only the slots they understand. Send those validated
  // choices as a patch so the locked database row keeps its newer wardrobe.
  const payload = input && input.version !== 2 && profile.appearance
    ? { ...profile, appearance: Object.fromEntries(Object.entries(profile.appearance)
      .filter(([key]) => Object.hasOwn(input, key) && Object.hasOwn(CHANVRIER_APPEARANCE_OPTIONS, key))) }
    : profile;
  const result = await createSupabaseServiceClient().rpc("rpc_arena_save_chanvrier", { p_user_id: userId, p_profile: payload });
  if (result.error) {
    if (result.error.message.includes("chanvrier_strength_locked")) throw new Error("Ta spécialité est définitive. Tu peux modifier ton apparence et ton surnom.");
    if (result.error.code === "23505") throw new Error("Ce surnom est déjà utilisé.");
    throw new Error(`[supabase:chanvrier] ${result.error.message}`);
  }
  return result.data as { profile: ChanvrierProfile; startingBonusCents: number; created: boolean };
}
