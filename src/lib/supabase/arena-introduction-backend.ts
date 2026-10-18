import "server-only";

import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import type { ArenaIntroductionState } from "@/lib/arena-introduction";

export type { ArenaIntroductionState } from "@/lib/arena-introduction";

/**
 * Read the introduction preference before mounting any live game screen.
 * This also runs during route prefetching, so it must never initialize a
 * wallet, warehouse or game, nor mark the introduction as already shown.
 */
export async function getArenaIntroductionState(userId: string): Promise<ArenaIntroductionState> {
  try {
    const supabase = createSupabaseServiceClient();
    const signal = AbortSignal.timeout(5_000);
    const journey = await supabase.from("arena_journey_progress")
      .select("version,status").eq("user_id", userId).in("version", [1, 2]).limit(2).abortSignal(signal);

    // Honor both historical editions, including an explicitly skipped tour.
    if (!journey.error && journey.data?.some(row => ["active", "completed", "skipped"].includes(row.status))) return "seen";

    const [runs, equipment] = await Promise.all([
      supabase.from("kq_runs").select("id").eq("user_id", userId).limit(1).abortSignal(signal),
      supabase.from("kq_player_equipment").select("equipment_code").eq("user_id", userId)
        .gt("purchase_price_cents", 0).limit(1).abortSignal(signal),
    ]);

    // Rewards can create wallets and free equipment before a first game visit.
    // Only an actual culture or purchased equipment establishes prior play.
    // Warehouse tables are RPC-only; reading their snapshot would initialize
    // player state, so they deliberately do not participate in this check.
    if ((!runs.error && runs.data?.length) || (!equipment.error && equipment.data?.length)) return "seen";
    if (journey.error || runs.error || equipment.error) return "unavailable";
    return "new";
  } catch {
    return "unavailable";
  }
}
