import "server-only";

import {
  chooseReferralRewardInSupabase,
  createReferralPendingRewardInSupabase,
  getAdminMissionsOverviewFromSupabase,
  getAdminReferralPendingRewardsFromSupabase,
  getCustomerMissionsFromSupabase,
  getReferralPendingRewardsFromSupabase,
  reviewMissionSubmissionInSupabase,
  submitMissionProofInSupabase,
} from "@/lib/supabase/missions-backend";
import type {
  AdminMissionsOverview,
  MissionSubmission,
  MissionWithUserStatus,
  ReferralPendingReward,
} from "@/types/missions";

// ── Customer ──

export async function getCustomerMissionsByBackend(
  userId: string,
): Promise<MissionWithUserStatus[]> {
  return getCustomerMissionsFromSupabase(userId);
}

export async function submitMissionProofByBackend(input: {
  userId: string;
  missionId: string;
  proofUrl?: string;
  proofText?: string;
}): Promise<MissionSubmission> {
  return submitMissionProofInSupabase(input);
}

export async function getReferralPendingRewardsByBackend(
  referrerId: string,
): Promise<ReferralPendingReward[]> {
  return getReferralPendingRewardsFromSupabase(referrerId);
}

export async function chooseReferralRewardByBackend(input: {
  pendingRewardId: string;
  referrerId: string;
  choice: "points" | "packs";
}): Promise<void> {
  return chooseReferralRewardInSupabase(input);
}

export async function createReferralPendingRewardByBackend(input: {
  referrerId: string;
  refereeId: string;
  orderId: string;
}): Promise<void> {
  return createReferralPendingRewardInSupabase(input);
}

// ── Admin ──

export async function getAdminMissionsOverviewByBackend(): Promise<AdminMissionsOverview> {
  return getAdminMissionsOverviewFromSupabase();
}

export async function reviewMissionSubmissionByBackend(input: {
  submissionId: string;
  action: "approve" | "reject";
  adminEmail: string;
  adminNote?: string;
}): Promise<void> {
  return reviewMissionSubmissionInSupabase(input);
}

export async function getAdminReferralPendingRewardsByBackend(): Promise<
  ReferralPendingReward[]
> {
  return getAdminReferralPendingRewardsFromSupabase();
}
