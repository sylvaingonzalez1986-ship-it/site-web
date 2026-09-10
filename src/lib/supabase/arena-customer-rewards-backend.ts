import "server-only";

import { createHash } from "node:crypto";
import {
  ARENA_CUSTOMER_REWARD_SLOTS,
  buildArenaCustomerRewardPreview,
  type ArenaCustomerRewardStanding,
} from "@/lib/arena-customer-rewards";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import { getKqArenaLeaderboardInternal } from "@/lib/supabase/kanab-quest-backend";

type RewardPoolRpcPayload = {
  seasonCode?: unknown;
  status?: unknown;
  formulaVersion?: unknown;
  contributionRateBps?: unknown;
  surpriseShareBps?: unknown;
  minHumanBattles?: unknown;
  startsAt?: unknown;
  endsAt?: unknown;
  poolGrams?: unknown;
  currentWeekGrams?: unknown;
  weeklyDice?: unknown;
  updatedAt?: unknown;
  lastFinalWeek?: unknown;
  viewerRoll?: unknown;
  alreadyRolled?: unknown;
};

const toNumber = (value: unknown, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

function getPoolMilestone(poolGrams: number) {
  const milestones = [25, 50, 100, 200, 500, 1_000];
  const next = milestones.find((milestone) => poolGrams < milestone)
    ?? Math.ceil(Math.max(1, poolGrams) / 1_000) * 1_000 + 1_000;
  const previous = [...milestones].reverse().find((milestone) => milestone <= poolGrams) ?? 0;
  const span = Math.max(1, next - previous);
  return {
    previousGrams: previous,
    nextGrams: next,
    progressPercent: Math.max(0, Math.min(100, Math.round(((poolGrams - previous) / span) * 100))),
  };
}

function toRewardStandings(entries: Awaited<ReturnType<typeof getKqArenaLeaderboardInternal>>["entries"]): ArenaCustomerRewardStanding[] {
  return entries.map((entry) => ({
    playerId: entry.userId,
    leaderboardRank: entry.rank,
    pseudo: entry.pseudo,
    score: entry.score,
    rating: entry.rating,
    wins: entry.wins,
    losses: entry.losses,
  }));
}

async function getActiveRewardSeasonCode() {
  const supabase = createSupabaseServiceClient();
  const result = await supabase.from("arena_customer_reward_seasons")
    .select("season_code")
    .in("status", ["active", "frozen", "settled"])
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (result.error) throw new Error(`[supabase:arena_customer_reward_seasons] ${result.error.message}`);
  if (!result.data?.season_code) throw new Error("Aucune saison de récompenses client active.");
  return String(result.data.season_code);
}

export async function getArenaCustomerRewardPool(input: { finalizePreviousWeeks?: boolean } = {}) {
  const supabase = createSupabaseServiceClient();
  const seasonCode = await getActiveRewardSeasonCode();
  const [poolResult, leaderboard] = await Promise.all([
    supabase.rpc("rpc_arena_refresh_customer_reward_pool", {
      p_season_code: seasonCode,
      p_finalize_previous_weeks: input.finalizePreviousWeeks === true,
    }),
    getKqArenaLeaderboardInternal(),
  ]);
  if (poolResult.error) throw new Error(`[supabase:rpc_arena_refresh_customer_reward_pool] ${poolResult.error.message}`);
  const raw = poolResult.data && typeof poolResult.data === "object" && !Array.isArray(poolResult.data)
    ? poolResult.data as RewardPoolRpcPayload
    : {};
  const poolGrams = Math.max(0, toNumber(raw.poolGrams));
  const minHumanBattles = Math.max(0, Math.floor(toNumber(raw.minHumanBattles, 3)));
  const preview = buildArenaCustomerRewardPreview(poolGrams, toRewardStandings(leaderboard.entries), minHumanBattles);
  const lastFinalWeek = raw.lastFinalWeek && typeof raw.lastFinalWeek === "object" && !Array.isArray(raw.lastFinalWeek)
    ? raw.lastFinalWeek as Record<string, unknown>
    : null;
  const weeklyDice = raw.weeklyDice && typeof raw.weeklyDice === "object" && !Array.isArray(raw.weeklyDice)
    ? raw.weeklyDice as Record<string, unknown>
    : {};

  return {
    seasonCode: String(raw.seasonCode ?? seasonCode),
    status: String(raw.status ?? "active"),
    formulaVersion: String(raw.formulaVersion ?? "arena-customer-v1"),
    contributionRateBps: Math.floor(toNumber(raw.contributionRateBps, 100)),
    poolGrams,
    wholePoolGrams: preview.wholePoolGrams,
    carriedGrams: preview.carriedGrams,
    currentWeekGrams: Math.max(0, toNumber(raw.currentWeekGrams)),
    startsAt: raw.startsAt ? String(raw.startsAt) : null,
    endsAt: raw.endsAt ? String(raw.endsAt) : null,
    updatedAt: raw.updatedAt ? String(raw.updatedAt) : new Date().toISOString(),
    lastFinalWeek: lastFinalWeek ? {
      startsOn: String(lastFinalWeek.startsOn ?? ""),
      endsOn: String(lastFinalWeek.endsOn ?? ""),
      contributionGrams: Math.max(0, toNumber(lastFinalWeek.contributionGrams)),
    } : null,
    weeklyDice: {
      startsOn: weeklyDice.startsOn ? String(weeklyDice.startsOn) : null,
      endsOn: weeklyDice.endsOn ? String(weeklyDice.endsOn) : null,
      rollCount: Math.max(0, Math.floor(toNumber(weeklyDice.rollCount))),
      average: weeklyDice.average === null || weeklyDice.average === undefined
        ? null
        : Math.max(1, Math.min(6, toNumber(weeklyDice.average))),
      rateBps: Math.floor(toNumber(weeklyDice.rateBps, raw.contributionRateBps === undefined ? 100 : toNumber(raw.contributionRateBps))),
      eligibleFlowerGrams: Math.max(0, toNumber(weeklyDice.eligibleFlowerGrams)),
      contributionGrams: Math.max(0, toNumber(weeklyDice.contributionGrams, raw.currentWeekGrams === undefined ? 0 : toNumber(raw.currentWeekGrams))),
    },
    milestone: getPoolMilestone(poolGrams),
    minimumHumanBattles: minHumanBattles,
    eligiblePlayers: preview.eligiblePlayers,
    topRewards: preview.rankingWinners.map((winner) => ({
      leaderboardRank: winner.leaderboardRank,
      rewardRank: winner.rewardRank,
      pseudo: winner.pseudo,
      shareBps: winner.shareBps,
      estimatedGrams: winner.grams,
    })),
    distribution: preview.slots.map((slot) => ({
      code: slot.code,
      kind: slot.kind,
      rewardRank: slot.rewardRank,
      label: slot.label,
      shareBps: slot.shareBps,
      estimatedGrams: slot.grams,
    })),
    surpriseReward: {
      shareBps: Math.floor(toNumber(raw.surpriseShareBps, 1_000)),
      estimatedGrams: preview.surprisePoolGrams,
      eligiblePlayers: preview.surpriseCandidates.length,
      oneChancePerCustomer: true,
    },
  };
}

export async function getArenaCustomerRewardDiceState(userId: string) {
  const supabase = createSupabaseServiceClient();
  const seasonCode = await getActiveRewardSeasonCode();
  const poolResult = await supabase.rpc("rpc_arena_refresh_customer_reward_pool", {
    p_season_code: seasonCode,
    p_finalize_previous_weeks: false,
  });
  if (poolResult.error) throw new Error(`[supabase:rpc_arena_refresh_customer_reward_pool] ${poolResult.error.message}`);
  const raw = poolResult.data && typeof poolResult.data === "object" && !Array.isArray(poolResult.data)
    ? poolResult.data as RewardPoolRpcPayload
    : {};
  const weeklyDice = raw.weeklyDice && typeof raw.weeklyDice === "object" && !Array.isArray(raw.weeklyDice)
    ? raw.weeklyDice as Record<string, unknown>
    : {};
  const startsOn = weeklyDice.startsOn ? String(weeklyDice.startsOn) : null;
  const [profileResult, rollResult] = await Promise.all([
    supabase.from("kq_rank_profiles")
      .select("user_id")
      .eq("season_code", seasonCode)
      .eq("user_id", userId)
      .maybeSingle(),
    startsOn
      ? supabase.from("arena_customer_reward_week_rolls")
          .select("dice_value, rolled_at")
          .eq("season_code", seasonCode)
          .eq("week_start", startsOn)
          .eq("user_id", userId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (profileResult.error) throw new Error(`[supabase:kq_rank_profiles] ${profileResult.error.message}`);
  if (rollResult.error) throw new Error(`[supabase:arena_customer_reward_week_rolls] ${rollResult.error.message}`);
  return {
    seasonCode,
    startsOn,
    endsOn: weeklyDice.endsOn ? String(weeklyDice.endsOn) : null,
    eligible: Boolean(profileResult.data),
    viewerRoll: rollResult.data ? Math.floor(toNumber(rollResult.data.dice_value)) : null,
    rolledAt: rollResult.data?.rolled_at ? String(rollResult.data.rolled_at) : null,
  };
}

export async function rollArenaCustomerRewardDice(userId: string) {
  const supabase = createSupabaseServiceClient();
  const seasonCode = await getActiveRewardSeasonCode();
  const result = await supabase.rpc("rpc_arena_roll_customer_reward_dice", {
    p_season_code: seasonCode,
    p_user_id: userId,
  });
  if (result.error) {
    const message = result.error.message;
    if (message.includes("arena_customer_reward_dice_player_required")) {
      throw new Error("Crée ton profil de joueur dans l’Arène avant de lancer le dé.");
    }
    if (message.includes("arena_customer_reward_dice_closed")) {
      throw new Error("Les lancers de cette semaine sont terminés.");
    }
    throw new Error(`[supabase:rpc_arena_roll_customer_reward_dice] ${message}`);
  }
  const raw = result.data && typeof result.data === "object" && !Array.isArray(result.data)
    ? result.data as RewardPoolRpcPayload
    : {};
  const pool = await getArenaCustomerRewardPool();
  return {
    viewerRoll: Math.max(1, Math.min(6, Math.floor(toNumber(raw.viewerRoll, 1)))),
    alreadyRolled: raw.alreadyRolled === true,
    pool,
  };
}

export async function freezeArenaCustomerRewardSeason(execute: boolean) {
  const supabase = createSupabaseServiceClient();
  const seasonCode = await getActiveRewardSeasonCode();
  const result = await supabase.rpc("rpc_arena_freeze_customer_reward_season", {
    p_season_code: seasonCode,
    p_execute: execute,
  });
  if (result.error) throw new Error(`[supabase:rpc_arena_freeze_customer_reward_season] ${result.error.message}`);
  return {
    ...(result.data && typeof result.data === "object" ? result.data as Record<string, unknown> : {}),
    seasonCode,
  };
}

export async function settleArenaCustomerRewards(execute: boolean) {
  const supabase = createSupabaseServiceClient();
  const seasonCode = await getActiveRewardSeasonCode();
  const [pool, leaderboard] = await Promise.all([
    getArenaCustomerRewardPool({ finalizePreviousWeeks: true }),
    getKqArenaLeaderboardInternal(),
  ]);
  const preview = buildArenaCustomerRewardPreview(
    pool.poolGrams,
    toRewardStandings(leaderboard.entries),
    pool.minimumHumanBattles,
  );
  const topRewards = preview.rankingWinners.filter((winner) => winner.grams > 0).map((winner) => ({
    userId: winner.playerId,
    leaderboardRank: winner.leaderboardRank,
    rewardRank: winner.rewardRank,
    shareBps: winner.shareBps,
    grams: winner.grams,
    score: winner.score,
    rating: winner.rating,
    wins: winner.wins,
    losses: winner.losses,
  }));
  const surpriseCandidates = preview.surpriseCandidates.map((candidate) => ({
    userId: candidate.playerId,
    leaderboardRank: candidate.leaderboardRank,
    score: candidate.score,
    rating: candidate.rating,
    wins: candidate.wins,
    losses: candidate.losses,
  }));
  const candidateHash = createHash("sha256")
    .update(surpriseCandidates.map((candidate) => `${candidate.leaderboardRank}:${candidate.userId}`).join("\n"))
    .digest("hex");
  const result = await supabase.rpc("rpc_arena_settle_customer_rewards", {
    p_season_code: seasonCode,
    p_top_rewards: topRewards,
    p_surprise_candidates: surpriseCandidates,
    p_candidate_hash: candidateHash,
    p_surprise_grams: preview.surprisePoolGrams,
    p_execute: execute,
  });
  if (result.error) throw new Error(`[supabase:rpc_arena_settle_customer_rewards] ${result.error.message}`);
  return {
    ...(result.data && typeof result.data === "object" ? result.data as Record<string, unknown> : {}),
    seasonCode,
    poolGrams: pool.poolGrams,
    candidateHash,
    shares: ARENA_CUSTOMER_REWARD_SLOTS.map((slot) => ({ code: slot.code, shareBps: slot.shareBps })),
  };
}
