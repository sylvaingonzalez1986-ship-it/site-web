import "server-only";

import {
  applySupabaseReferralRewardOnPaidOrder,
  bindSupabaseReferralCode,
  getSupabaseAdminReferralOverview,
  getSupabaseReferralSummary,
} from "@/lib/supabase/referral-backend";
import type { AdminReferralOverview, ReferralSummary } from "@/types/referral";

export async function getReferralSummaryByBackend(userId: string): Promise<ReferralSummary> {
  return getSupabaseReferralSummary(userId);
}

export async function bindReferralCodeByBackend(input: {
  refereeId: string;
  referralCode: string;
}): Promise<void> {
  return bindSupabaseReferralCode(input);
}

export async function applyReferralRewardForPaidOrderByBackend(input: {
  orderId: string;
}): Promise<boolean> {
  return applySupabaseReferralRewardOnPaidOrder(input);
}

export async function getAdminReferralOverviewByBackend(): Promise<AdminReferralOverview> {
  return getSupabaseAdminReferralOverview();
}
