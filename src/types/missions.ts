// ── Social Missions Types ──

export type MissionIcon = "instagram" | "facebook" | "tiktok" | "camera" | "star";
export type MissionRewardType = "packs" | "points" | "support_pack" | "buddies" | "game_cash";
export type MissionSubmissionStatus = "pending" | "approved" | "rejected" | "changes_requested";
export type ReferralChoiceStatus = "pending" | "chosen_points" | "chosen_packs";

export type SocialMission = {
  id: string;
  slug: string;
  title: string;
  description: string;
  icon: MissionIcon;
  rewardType: MissionRewardType;
  rewardAmount: number;
  maxCompletionsPerUser: number;
  requiresProof: boolean;
  proofInstructions: string | null;
  isActive: boolean;
  sortOrder: number;
  rewardCardName?: string | null;
  rewardCardId: string | null;
};

export type SocialMissionEditorInput = {
  rewardCardId: string | null;
  slug: string;
  title: string;
  description: string;
  icon: MissionIcon;
  rewardType: MissionRewardType;
  rewardAmount: number;
  maxCompletionsPerUser: number;
  requiresProof: boolean;
  proofInstructions: string | null;
  isActive: boolean;
};

export type MissionSubmission = {
  id: string;
  userId: string;
  missionId: string;
  proofUrl: string | null;
  proofStoragePath: string | null;
  proofContentType: string | null;
  proofFileSize: number | null;
  proofUploadedAt: string | null;
  proofText: string | null;
  status: MissionSubmissionStatus;
  adminNote: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rewardGranted: boolean;
  revision: number;
  rewardType: MissionRewardType;
  rewardAmount: number;
  rewardCardId: string | null;
  rewardCardName: string | null;
  rewardLabel: string | null;
  missionTitle: string;
  createdAt: string;
};

export type MissionWithUserStatus = SocialMission & {
  userSubmissions: MissionSubmission[];
  completedCount: number;
  canSubmit: boolean;
};

export type ReferralPendingReward = {
  id: string;
  referrerId: string;
  refereeId: string;
  orderId: string;
  status: ReferralChoiceStatus;
  pointsAmount: number;
  packsAmount: number;
  chosenAt: string | null;
  createdAt: string;
};

export type ReferralRewardSettings = {
  pointsAmount: number;
  packsAmount: number;
  updatedAt: string | null;
};

// ── Admin Types ──

export type AdminMissionSubmissionView = MissionSubmission & {
  userEmail: string;
  userName: string;
  missionTitle: string;
  missionSlug: string;
  proofSignedUrl: string | null;
  legacyReview: boolean;
};

export type AdminMissionsOverview = {
  totalMissions: number;
  totalSubmissions: number;
  pendingSubmissions: number;
  approvedSubmissions: number;
  rejectedSubmissions: number;
  changesRequestedSubmissions: number;
  submissions: AdminMissionSubmissionView[];
};

export type AdminMissionsDashboard = {
  overview: AdminMissionsOverview;
  missions: SocialMission[];
  pendingReferrals: ReferralPendingReward[];
  referralSettings: ReferralRewardSettings;
  buddyOptions: MissionBuddyOption[];
};

export type MissionBuddyOption = { id: string; name: string; rarity: string; imageUrl: string };

export type MissionProofSubmissionInput = {
  userId: string;
  missionId: string;
  requestKey: string;
  submissionId?: string;
  expectedRevision?: number;
  proofUrl?: string;
  proofStoragePath?: string;
  proofContentType?: string;
  proofFileSize?: number;
  proofText?: string;
};

export type MissionReviewInput = {
  submissionId: string;
  expectedRevision: number;
  requestKey: string;
  action: "approve" | "reject" | "request_changes";
  adminEmail: string;
  adminNote?: string;
};
