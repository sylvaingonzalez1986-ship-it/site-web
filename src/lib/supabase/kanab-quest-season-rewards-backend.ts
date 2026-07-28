import "server-only";

import { buildKqSeasonRewardPreview, KQ_SEASON_REWARDS_LIVE } from "@/lib/kanab-quest-season-rewards";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";

export async function distributeKqSeasonRewards(seasonCode: string) {
  if (!KQ_SEASON_REWARDS_LIVE) {
    return { live: false, eligiblePlayers: 0, granted: 0, alreadyGranted: 0 };
  }
  const supabase = createSupabaseServiceClient();
  const snapshotResult = await supabase.rpc("rpc_kq_refresh_daily_leaderboard", {
    p_season_code: seasonCode,
  });
  if (snapshotResult.error) throw new Error(`[supabase:kq-season-snapshot] ${snapshotResult.error.message}`);
  const snapshot = snapshotResult.data as Record<string, unknown> | null;
  const leaderboard = Array.isArray(snapshot?.leaderboard)
    ? snapshot.leaderboard as Array<Record<string, unknown>>
    : [];
  const preview = buildKqSeasonRewardPreview(seasonCode, leaderboard.map((entry, index) => ({
    playerId: String(entry.userId ?? ""),
    rank: Number(entry.rank ?? index + 1),
    seasonPoints: Number(entry.seasonPoints ?? 0),
    rating: Number(entry.rating ?? 1000),
    wins: Number(entry.wins ?? 0),
    losses: Number(entry.losses ?? 0),
  })));
  let granted = 0;
  let alreadyGranted = 0;
  for (const grant of preview.grants) {
    const result = await supabase.rpc("rpc_kq_grant_season_reward", {
      p_season_code: seasonCode,
      p_user_id: grant.playerId,
      p_tier_code: grant.tier.code,
      p_final_rank: grant.rank,
      p_final_rating: leaderboard.find((entry) => String(entry.userId) === grant.playerId)?.rating ?? 1000,
      p_final_season_points: leaderboard.find((entry) => String(entry.userId) === grant.playerId)?.seasonPoints ?? 0,
      p_battles: Number(leaderboard.find((entry) => String(entry.userId) === grant.playerId)?.wins ?? 0)
        + Number(leaderboard.find((entry) => String(entry.userId) === grant.playerId)?.losses ?? 0),
    });
    if (result.error) throw new Error(`[supabase:rpc_kq_grant_season_reward] ${result.error.message}`);
    if ((result.data as { alreadyGranted?: boolean } | null)?.alreadyGranted) alreadyGranted += 1;
    else granted += 1;
  }
  return { live: true, eligiblePlayers: preview.eligiblePlayers, granted, alreadyGranted };
}
