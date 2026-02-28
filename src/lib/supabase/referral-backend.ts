import "server-only";

import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import { isReferralFirstOrderDiscountEligible } from "@/lib/referral-first-order-discount";
import type {
  AdminReferralOverview,
  ReferralRewardConfig,
  ReferralSummary,
} from "@/types/referral";

const REFERRAL_CODE_PATTERN = /^[A-Z0-9]{6,16}$/;
const DEFAULT_REFERRER_REWARD_POINTS = 120;
const DEFAULT_REFEREE_REWARD_POINTS = 80;

type ReferralProfileRow = {
  id: string;
  referral_code: string;
  referred_by_code: string | null;
  referral_bound_at: string | null;
  referral_rewarded_at: string | null;
};

type ReferralRewardRow = {
  id?: number;
  created_at?: string;
  order_id?: string;
  referrer_id?: string;
  referee_id?: string;
  referrer_points: number;
  referee_points: number;
};

type ReferralProfileNameRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

function failIfError(error: { message: string } | null, context: string): void {
  if (error) {
    throw new Error(`[supabase:${context}] ${error.message}`);
  }
}

function toFiniteInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(0, Math.min(100000, Math.round(parsed)));
}

function toOptionalDate(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return new Date(parsed).toISOString();
}

function normalizeReferralCode(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function getReferralRewardConfig(): ReferralRewardConfig {
  return {
    referrerPoints: toFiniteInt(
      process.env.REFERRAL_REWARD_REFERRER_POINTS,
      DEFAULT_REFERRER_REWARD_POINTS,
    ),
    refereePoints: toFiniteInt(
      process.env.REFERRAL_REWARD_REFEREE_POINTS,
      DEFAULT_REFEREE_REWARD_POINTS,
    ),
  };
}

async function getReferralProfile(userId: string): Promise<ReferralProfileRow | null> {
  const safeId = userId.trim();
  if (!safeId) {
    return null;
  }

  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("profiles")
    .select("id,referral_code,referred_by_code,referral_bound_at,referral_rewarded_at")
    .eq("id", safeId)
    .maybeSingle();
  failIfError(result.error, "get referral profile");

  if (!result.data) {
    return null;
  }

  return result.data as unknown as ReferralProfileRow;
}

export async function bindSupabaseReferralCode(input: {
  refereeId: string;
  referralCode: string;
}): Promise<void> {
  const refereeId = input.refereeId.trim();
  const referralCode = normalizeReferralCode(input.referralCode);
  if (!refereeId || !REFERRAL_CODE_PATTERN.test(referralCode)) {
    throw new Error("Code parrain invalide.");
  }

  const supabase = createSupabaseServiceClient();
  const result = await supabase.rpc("rpc_bind_referral_code", {
    p_referee_id: refereeId,
    p_referral_code: referralCode,
  });

  if (result.error) {
    const message = result.error.message || "";
    if (message.includes("referral_code_not_found")) {
      throw new Error("Code parrain introuvable.");
    }
    if (message.includes("referral_already_bound")) {
      throw new Error("Un code parrain est déjà associé à ton compte.");
    }
    if (message.includes("self_referral_forbidden")) {
      throw new Error("Tu ne peux pas utiliser ton propre code parrain.");
    }
    if (message.includes("referral_too_late")) {
      throw new Error("Le code parrain doit être appliqué avant la première commande payée.");
    }
    if (message.includes("referee_not_found")) {
      throw new Error("Compte introuvable pour le parrainage.");
    }
    if (message.includes("referral_code_invalid")) {
      throw new Error("Code parrain invalide.");
    }

    throw new Error(`[supabase:rpc_bind_referral_code] ${message}`);
  }
}

export async function applySupabaseReferralRewardOnPaidOrder(input: {
  orderId: string;
}): Promise<boolean> {
  const orderId = input.orderId.trim();
  if (!orderId) {
    return false;
  }

  const config = getReferralRewardConfig();
  const supabase = createSupabaseServiceClient();
  const result = await supabase.rpc("rpc_apply_referral_reward_on_paid_order", {
    p_order_id: orderId,
    p_referrer_points: config.referrerPoints,
    p_referee_points: config.refereePoints,
  });
  failIfError(result.error, "rpc_apply_referral_reward_on_paid_order");

  return result.data === true;
}

export async function getSupabaseReferralFirstOrderDiscountEligibility(input: {
  userId: string;
  hasManualDiscount?: boolean;
}): Promise<boolean> {
  const safeUserId = input.userId.trim();
  if (!safeUserId) {
    return false;
  }

  const supabase = createSupabaseServiceClient();
  const [profileResult, paidOrdersResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("referred_by_code,referral_rewarded_at")
      .eq("id", safeUserId)
      .maybeSingle(),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", safeUserId)
      .in("payment_state", ["paid", "not_configured"]),
  ]);

  failIfError(profileResult.error, "referral first-order profile");
  failIfError(paidOrdersResult.error, "referral first-order paid orders");

  const profile = profileResult.data as
    | { referred_by_code?: string | null; referral_rewarded_at?: string | null }
    | null;
  const paidOrdersCount = Number(paidOrdersResult.count ?? 0);

  return isReferralFirstOrderDiscountEligible({
    referredByCode:
      typeof profile?.referred_by_code === "string" ? profile.referred_by_code : undefined,
    referralRewardedAt:
      typeof profile?.referral_rewarded_at === "string"
        ? profile.referral_rewarded_at
        : undefined,
    hasPaidOrder: paidOrdersCount > 0,
    hasManualDiscount: input.hasManualDiscount === true,
  });
}

export async function getSupabaseReferralSummary(userId: string): Promise<ReferralSummary> {
  const safeUserId = userId.trim();
  if (!safeUserId) {
    throw new Error("Utilisateur invalide.");
  }

  const [profile, totalReferralsResult, referrerRewardsResult, refereeRewardResult] =
    await Promise.all([
      getReferralProfile(safeUserId),
      (async () => {
        const supabase = createSupabaseServiceClient();
        const result = await supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("referred_by", safeUserId);
        failIfError(result.error, "count referrals");
        return result;
      })(),
      (async () => {
        const supabase = createSupabaseServiceClient();
        const result = await supabase
          .from("referral_rewards")
          .select("referrer_points")
          .eq("referrer_id", safeUserId);
        failIfError(result.error, "read referrer rewards");
        return result;
      })(),
      (async () => {
        const supabase = createSupabaseServiceClient();
        const result = await supabase
          .from("referral_rewards")
          .select("referee_points")
          .eq("referee_id", safeUserId)
          .maybeSingle();
        failIfError(result.error, "read referee reward");
        return result;
      })(),
    ]);

  if (!profile) {
    throw new Error("Profil introuvable.");
  }

  const totalReferrals = Number(totalReferralsResult.count ?? 0);
  const referrerRewards = (referrerRewardsResult.data ?? []) as ReferralRewardRow[];
  const rewardedReferrals = referrerRewards.length;
  const pointsEarnedAsReferrer = referrerRewards.reduce(
    (sum, row) => sum + toFiniteInt(row.referrer_points, 0),
    0,
  );
  const pointsEarnedAsReferee = refereeRewardResult.data
    ? toFiniteInt((refereeRewardResult.data as ReferralRewardRow).referee_points, 0)
    : 0;

  return {
    referralCode: profile.referral_code,
    referredByCode: profile.referred_by_code ?? undefined,
    referralBoundAt: toOptionalDate(profile.referral_bound_at),
    referralRewardedAt: toOptionalDate(profile.referral_rewarded_at),
    totalReferrals,
    rewardedReferrals,
    pendingReferrals: Math.max(totalReferrals - rewardedReferrals, 0),
    pointsEarnedAsReferrer,
    pointsEarnedAsReferee,
    config: getReferralRewardConfig(),
  };
}

function toDisplayName(firstName?: string | null, lastName?: string | null): string {
  const first = typeof firstName === "string" ? firstName.trim() : "";
  const last = typeof lastName === "string" ? lastName.trim() : "";
  const full = `${first} ${last}`.trim();
  return full || "Client";
}

export async function getSupabaseAdminReferralOverview(): Promise<AdminReferralOverview> {
  const supabase = createSupabaseServiceClient();

  const [codesCountResult, boundCountResult, rewardsResult, usersResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .not("referral_code", "is", null),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .not("referred_by", "is", null),
    supabase
      .from("referral_rewards")
      .select(
        "id,created_at,order_id,referrer_id,referee_id,referrer_points,referee_points",
      )
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.auth.admin.listUsers(),
  ]);

  failIfError(codesCountResult.error, "count profiles referral_code");
  failIfError(boundCountResult.error, "count profiles referred_by");
  failIfError(rewardsResult.error, "list referral rewards");
  failIfError(usersResult.error, "auth.admin.listUsers for referrals");

  const rewards = (rewardsResult.data ?? []) as ReferralRewardRow[];
  const totalRewardedReferrals = rewards.length;
  const totalBoundReferrals = Number(boundCountResult.count ?? 0);
  const totalUsersWithCode = Number(codesCountResult.count ?? 0);
  const totalPointsAwardedReferrer = rewards.reduce(
    (sum, row) => sum + toFiniteInt(row.referrer_points, 0),
    0,
  );
  const totalPointsAwardedReferee = rewards.reduce(
    (sum, row) => sum + toFiniteInt(row.referee_points, 0),
    0,
  );

  const uniqueUserIds = new Set<string>();
  for (const reward of rewards) {
    if (typeof reward.referrer_id === "string" && reward.referrer_id.trim()) {
      uniqueUserIds.add(reward.referrer_id);
    }
    if (typeof reward.referee_id === "string" && reward.referee_id.trim()) {
      uniqueUserIds.add(reward.referee_id);
    }
  }

  const profileNameById = new Map<string, ReferralProfileNameRow>();
  const userIds = Array.from(uniqueUserIds);
  if (userIds.length > 0) {
    const profilesResult = await supabase
      .from("profiles")
      .select("id,first_name,last_name")
      .in("id", userIds);
    failIfError(profilesResult.error, "list profiles for referral overview");
    for (const row of (profilesResult.data ?? []) as unknown as ReferralProfileNameRow[]) {
      if (typeof row.id === "string" && row.id.trim()) {
        profileNameById.set(row.id, row);
      }
    }
  }

  const emailById = new Map<string, string>();
  for (const user of usersResult.data.users ?? []) {
    if (!user.id) {
      continue;
    }
    emailById.set(user.id, user.email ?? "");
  }

  const topReferrerMap = new Map<
    string,
    {
      userId: string;
      rewardedReferrals: number;
      pointsEarnedAsReferrer: number;
    }
  >();
  for (const reward of rewards) {
    const referrerId = typeof reward.referrer_id === "string" ? reward.referrer_id : "";
    if (!referrerId) {
      continue;
    }
    const prev = topReferrerMap.get(referrerId) ?? {
      userId: referrerId,
      rewardedReferrals: 0,
      pointsEarnedAsReferrer: 0,
    };
    prev.rewardedReferrals += 1;
    prev.pointsEarnedAsReferrer += toFiniteInt(reward.referrer_points, 0);
    topReferrerMap.set(referrerId, prev);
  }

  const topReferrers = Array.from(topReferrerMap.values())
    .sort((a, b) => {
      if (b.rewardedReferrals !== a.rewardedReferrals) {
        return b.rewardedReferrals - a.rewardedReferrals;
      }
      return b.pointsEarnedAsReferrer - a.pointsEarnedAsReferrer;
    })
    .slice(0, 20)
    .map((row) => {
      const profile = profileNameById.get(row.userId);
      return {
        userId: row.userId,
        email: emailById.get(row.userId) ?? "",
        firstName: profile?.first_name?.trim() || "",
        lastName: profile?.last_name?.trim() || "",
        rewardedReferrals: row.rewardedReferrals,
        pointsEarnedAsReferrer: row.pointsEarnedAsReferrer,
      };
    });

  const recentRewards = rewards.slice(0, 40).map((reward) => {
    const referrerId = typeof reward.referrer_id === "string" ? reward.referrer_id : "";
    const refereeId = typeof reward.referee_id === "string" ? reward.referee_id : "";
    const referrerProfile = profileNameById.get(referrerId);
    const refereeProfile = profileNameById.get(refereeId);

    return {
      id: toFiniteInt(reward.id, 0),
      createdAt:
        typeof reward.created_at === "string" && Number.isFinite(Date.parse(reward.created_at))
          ? reward.created_at
          : new Date().toISOString(),
      orderId: typeof reward.order_id === "string" ? reward.order_id : "",
      referrerId,
      referrerEmail: emailById.get(referrerId) ?? "",
      referrerName: toDisplayName(referrerProfile?.first_name, referrerProfile?.last_name),
      refereeId,
      refereeEmail: emailById.get(refereeId) ?? "",
      refereeName: toDisplayName(refereeProfile?.first_name, refereeProfile?.last_name),
      referrerPoints: toFiniteInt(reward.referrer_points, 0),
      refereePoints: toFiniteInt(reward.referee_points, 0),
    };
  });

  return {
    totalUsersWithCode,
    totalBoundReferrals,
    totalRewardedReferrals,
    pendingBoundReferrals: Math.max(totalBoundReferrals - totalRewardedReferrals, 0),
    totalPointsAwardedReferrer,
    totalPointsAwardedReferee,
    totalPointsAwarded: totalPointsAwardedReferrer + totalPointsAwardedReferee,
    config: getReferralRewardConfig(),
    topReferrers,
    recentRewards,
  };
}
