import "server-only";

import {
  createSocialMissionInSupabase,
  chooseReferralRewardInSupabase,
  createReferralPendingRewardInSupabase,
  getAdminMissionsOverviewFromSupabase,
  getAdminSocialMissionsFromSupabase,
  getAdminReferralPendingRewardsFromSupabase,
  getCustomerMissionsFromSupabase,
  getReferralRewardSettingsFromSupabase,
  getReferralPendingRewardsFromSupabase,
  reorderSocialMissionsInSupabase,
  reviewMissionSubmissionInSupabase,
  submitMissionProofInSupabase,
  updateReferralRewardSettingsInSupabase,
  updateSocialMissionInSupabase,
} from "@/lib/supabase/missions-backend";
import type {
  AdminMissionsOverview,
  MissionSubmission,
  MissionWithUserStatus,
  ReferralRewardSettings,
  ReferralPendingReward,
  SocialMission,
  SocialMissionEditorInput,
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
  proofStoragePath?: string;
  proofContentType?: string;
  proofFileSize?: number;
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

export async function getAdminSocialMissionsByBackend(): Promise<SocialMission[]> {
  return getAdminSocialMissionsFromSupabase();
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

export async function createSocialMissionByBackend(
  input: SocialMissionEditorInput,
): Promise<SocialMission> {
  return createSocialMissionInSupabase(input);
}

export async function updateSocialMissionByBackend(input: {
  missionId: string;
  mission: SocialMissionEditorInput;
}): Promise<SocialMission> {
  return updateSocialMissionInSupabase(input);
}

export async function reorderSocialMissionsByBackend(
  missionIds: string[],
): Promise<SocialMission[]> {
  return reorderSocialMissionsInSupabase(missionIds);
}

export async function getReferralRewardSettingsByBackend(): Promise<ReferralRewardSettings> {
  return getReferralRewardSettingsFromSupabase();
}

export async function updateReferralRewardSettingsByBackend(input: {
  pointsAmount: number;
  packsAmount: number;
}): Promise<ReferralRewardSettings> {
  return updateReferralRewardSettingsInSupabase(input);
}
