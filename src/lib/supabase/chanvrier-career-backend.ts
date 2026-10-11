import "server-only";
import { createChanvrierCareerSnapshot, type ChanvrierCareerSnapshot } from "@/lib/chanvrier-career";
import { createSupabaseServiceClient } from "./admin";

/** Career is authoritative server progress, never the spendable XP of a run. */
export async function getChanvrierCareer(userId: string): Promise<ChanvrierCareerSnapshot> {
  const { data, error } = await createSupabaseServiceClient().rpc("rpc_kq_chanvrier_career", { p_user_id: userId });
  if (error || !data || !Number.isSafeInteger(data.xp) || data.xp < 0) {
    throw new Error("[supabase:chanvrier-career] unavailable");
  }
  return createChanvrierCareerSnapshot(data);
}

export function getChanvrierCareerError(message: string): string | null {
  const level = message.match(/career_level_required[:_ ]+(\d+)/);
  if (level) return `Niveau ${level[1]} du chanvrier requis. Termine des cultures pour gagner de l’expérience métier.`;
  if (message.includes("career_level_required")) return "Ton niveau de chanvrier ne permet pas encore cet investissement. Consulte la progression dans l’entrepôt.";
  if (message.includes("career_practice_required")) return "Il te manque encore de la pratique dans cette famille de transformation. Consulte les lots requis dans le catalogue.";
  if (message.includes("career_unavailable")) return "Cet équipement ne peut pas encore être acquis ou amélioré.";
  return null;
}
