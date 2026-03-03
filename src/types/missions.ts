// ── Social Missions Types ──

export type MissionIcon = "instagram" | "facebook" | "tiktok" | "camera" | "star";
export type MissionRewardType = "packs" | "points";
export type MissionSubmissionStatus = "pending" | "approved" | "rejected";
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
};

export type SocialMissionEditorInput = {
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
};

export type AdminMissionsOverview = {
  totalMissions: number;
  totalSubmissions: number;
  pendingSubmissions: number;
  approvedSubmissions: number;
  rejectedSubmissions: number;
  submissions: AdminMissionSubmissionView[];
};

export type AdminMissionsDashboard = {
  overview: AdminMissionsOverview;
  missions: SocialMission[];
  pendingReferrals: ReferralPendingReward[];
  referralSettings: ReferralRewardSettings;
};
