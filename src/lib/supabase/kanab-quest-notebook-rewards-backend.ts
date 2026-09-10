import "server-only";

import { KQ_NOTEBOOK_REWARDS_LIVE } from "@/lib/kanab-quest-notebook-rewards";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";

export type KqNotebookRewardSyncResult = {
  live: boolean;
  eligibleBadges: number;
  granted: number;
  alreadyGranted: number;
};

export const KQ_NOTEBOOK_RETRO_BATCH_SIZE = 50;

export type KqNotebookRetroSyncResult = {
  live: boolean;
  processed: number;
  granted: number;
  alreadyGranted: number;
  nextCursor: number | null;
};

export type KqNotebookRetroPreviewResult = {
  live: boolean;
  processed: number;
  pending: number;
  alreadyGranted: number;
  nextCursor: number | null;
};

export async function syncKqNotebookRewardsForCustomer(
  customerId: string,
): Promise<KqNotebookRewardSyncResult> {
  if (!KQ_NOTEBOOK_REWARDS_LIVE) {
    return { live: false, eligibleBadges: 0, granted: 0, alreadyGranted: 0 };
  }

  const safeCustomerId = customerId.trim();
  if (!safeCustomerId) {
    return { live: true, eligibleBadges: 0, granted: 0, alreadyGranted: 0 };
  }

  const supabase = createSupabaseServiceClient();
  const rulesResult = await supabase
    .from("kq_notebook_reward_rules")
    .select("badge_code")
    .eq("is_active", true);
  if (rulesResult.error) {
    throw new Error(`[supabase:kq-notebook-rules] ${rulesResult.error.message}`);
  }
  const rewardCodes = (rulesResult.data ?? []).map((rule) => String(rule.badge_code));
  if (rewardCodes.length === 0) {
    return { live: true, eligibleBadges: 0, granted: 0, alreadyGranted: 0 };
  }
  const definitionsResult = await supabase
    .from("contest_badges")
    .select("id")
    .in("code", rewardCodes);
  if (definitionsResult.error) {
    throw new Error(`[supabase:kq-notebook-badges] ${definitionsResult.error.message}`);
  }
  const badgeDefinitionIds = (definitionsResult.data ?? []).map((badge) => String(badge.id));
  if (badgeDefinitionIds.length === 0) {
    return { live: true, eligibleBadges: 0, granted: 0, alreadyGranted: 0 };
  }
  const badgesResult = await supabase
    .from("contest_profile_badges")
    .select("id")
    .eq("customer_id", safeCustomerId)
    .in("badge_id", badgeDefinitionIds)
    .order("id", { ascending: true });
  if (badgesResult.error) {
    throw new Error(`[supabase:kq-notebook-profile-badges] ${badgesResult.error.message}`);
  }

  let granted = 0;
  let alreadyGranted = 0;
  const badges = badgesResult.data ?? [];
  for (const badge of badges) {
    const result = await supabase.rpc("rpc_kq_grant_notebook_badge_reward", {
      p_user_id: safeCustomerId,
      p_profile_badge_id: Number(badge.id),
    });
    if (result.error) {
      if (result.error.message.includes("kq_notebook_rewards_inactive")) {
        throw new Error("Les récompenses Carnet vers le Placard ne sont pas activées dans Supabase.");
      }
      throw new Error(`[supabase:rpc_kq_grant_notebook_badge_reward] ${result.error.message}`);
    }
    const receipt = result.data as { alreadyGranted?: boolean } | null;
    if (receipt?.alreadyGranted) alreadyGranted += 1;
    else granted += 1;
  }

  return { live: true, eligibleBadges: badges.length, granted, alreadyGranted };
}

async function loadKqNotebookRetroBatch(afterProfileBadgeId: number) {
  const cursor = Number.isSafeInteger(afterProfileBadgeId) && afterProfileBadgeId >= 0
    ? afterProfileBadgeId
    : 0;
  const supabase = createSupabaseServiceClient();
  const rulesResult = await supabase.from("kq_notebook_reward_rules")
    .select("badge_code").eq("is_active", true);
  if (rulesResult.error) throw new Error(`[supabase:kq-notebook-retro-rules] ${rulesResult.error.message}`);
  const rewardCodes = (rulesResult.data ?? []).map((rule) => String(rule.badge_code));
  if (rewardCodes.length === 0) {
    return { supabase, badges: [], grantedIds: new Set<number>(), nextCursor: null };
  }
  const definitionsResult = await supabase.from("contest_badges")
    .select("id").in("code", rewardCodes);
  if (definitionsResult.error) throw new Error(`[supabase:kq-notebook-retro-badges] ${definitionsResult.error.message}`);
  const definitionIds = (definitionsResult.data ?? []).map((badge) => String(badge.id));
  if (definitionIds.length === 0) {
    return { supabase, badges: [], grantedIds: new Set<number>(), nextCursor: null };
  }
  let query = supabase.from("contest_profile_badges")
    .select("id,customer_id")
    .in("badge_id", definitionIds)
    .order("id", { ascending: true })
    .limit(KQ_NOTEBOOK_RETRO_BATCH_SIZE);
  if (cursor > 0) query = query.gt("id", cursor);
  const profileBadgesResult = await query;
  if (profileBadgesResult.error) {
    throw new Error(`[supabase:kq-notebook-retro-profile-badges] ${profileBadgesResult.error.message}`);
  }
  const badges = (profileBadgesResult.data ?? []).map((badge) => ({
    id: Number(badge.id),
    customerId: String(badge.customer_id),
  }));
  const grantsResult = badges.length > 0
    ? await supabase.from("kq_notebook_reward_grants")
        .select("profile_badge_id")
        .in("profile_badge_id", badges.map((badge) => badge.id))
    : { data: [], error: null };
  if (grantsResult.error) {
    throw new Error(`[supabase:kq-notebook-retro-grants] ${grantsResult.error.message}`);
  }
  const lastId = badges.at(-1)?.id;
  return {
    supabase,
    badges,
    grantedIds: new Set((grantsResult.data ?? []).map((grant) => Number(grant.profile_badge_id))),
    nextCursor: badges.length === KQ_NOTEBOOK_RETRO_BATCH_SIZE && lastId != null ? lastId : null,
  };
}

export async function previewKqNotebookRewardBatch(
  afterProfileBadgeId = 0,
): Promise<KqNotebookRetroPreviewResult> {
  const batch = await loadKqNotebookRetroBatch(afterProfileBadgeId);
  const alreadyGranted = batch.badges.filter((badge) => batch.grantedIds.has(badge.id)).length;
  return {
    live: KQ_NOTEBOOK_REWARDS_LIVE,
    processed: batch.badges.length,
    pending: batch.badges.length - alreadyGranted,
    alreadyGranted,
    nextCursor: batch.nextCursor,
  };
}

export async function syncKqNotebookRewardBatch(
  afterProfileBadgeId = 0,
): Promise<KqNotebookRetroSyncResult> {
  if (!KQ_NOTEBOOK_REWARDS_LIVE) {
    return { live: false, processed: 0, granted: 0, alreadyGranted: 0, nextCursor: null };
  }
  const batch = await loadKqNotebookRetroBatch(afterProfileBadgeId);
  let granted = 0;
  let alreadyGranted = 0;
  for (const badge of batch.badges) {
    const result = await batch.supabase.rpc("rpc_kq_grant_notebook_badge_reward", {
      p_user_id: badge.customerId,
      p_profile_badge_id: badge.id,
    });
    if (result.error) throw new Error(`[supabase:rpc_kq_grant_notebook_badge_reward] ${result.error.message}`);
    if ((result.data as { alreadyGranted?: boolean } | null)?.alreadyGranted) alreadyGranted += 1;
    else granted += 1;
  }
  return {
    live: true,
    processed: batch.badges.length,
    granted,
    alreadyGranted,
    nextCursor: batch.nextCursor,
  };
}
