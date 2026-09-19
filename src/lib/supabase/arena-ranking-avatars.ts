import "server-only";
import { parseChanvrierProfile, type ChanvrierAvatarProfile } from "@/lib/arena-chanvrier";
import { createSupabaseServiceClient } from "./admin";

/** Batch portraits by internal ID; only appearance fields enter public rankings. */
export async function getArenaRankingAvatars(userIds: string[]): Promise<Map<string, ChanvrierAvatarProfile>> {
  const avatars = new Map<string, ChanvrierAvatarProfile>();
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return avatars;
  try {
    const result = await createSupabaseServiceClient().from("arena_chanvrier_profiles")
      .select("user_id,nickname,gender,clothing,skin,strength,appearance").in("user_id", ids);
    if (result.error) return avatars;
    for (const row of result.data ?? []) {
      const profile = parseChanvrierProfile(row);
      if (!profile || !ids.includes(row.user_id)) continue;
      const { gender, clothing, skin, appearance } = profile;
      avatars.set(row.user_id, { gender, clothing, skin, ...(appearance ? { appearance } : {}) });
    }
  } catch {
    // A missing portrait must never prevent the scores from loading.
  }
  return avatars;
}
