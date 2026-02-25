import "server-only";

import {
  getSupabaseReferralFirstOrderDiscountEligibility,
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

export async function isReferralFirstOrderDiscountEligibleByBackend(input: {
  userId: string;
  hasManualDiscount?: boolean;
}): Promise<boolean> {
  return getSupabaseReferralFirstOrderDiscountEligibility(input);
}

export async function getAdminReferralOverviewByBackend(): Promise<AdminReferralOverview> {
  return getSupabaseAdminReferralOverview();
}
