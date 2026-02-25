export type ReferralRewardConfig = {
  referrerPoints: number;
  refereePoints: number;
};

export type ReferralSummary = {
  referralCode: string;
  referredByCode?: string;
  referralBoundAt?: string;
  referralRewardedAt?: string;
  totalReferrals: number;
  rewardedReferrals: number;
  pendingReferrals: number;
  pointsEarnedAsReferrer: number;
  pointsEarnedAsReferee: number;
  config: ReferralRewardConfig;
};

export type AdminReferralTopReferrer = {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  rewardedReferrals: number;
  pointsEarnedAsReferrer: number;
};

export type AdminReferralRewardEvent = {
  id: number;
  createdAt: string;
  orderId: string;
  referrerId: string;
  referrerEmail: string;
  referrerName: string;
  refereeId: string;
  refereeEmail: string;
  refereeName: string;
  referrerPoints: number;
  refereePoints: number;
};

export type AdminReferralOverview = {
  totalUsersWithCode: number;
  totalBoundReferrals: number;
  totalRewardedReferrals: number;
  pendingBoundReferrals: number;
  totalPointsAwardedReferrer: number;
  totalPointsAwardedReferee: number;
  totalPointsAwarded: number;
  config: ReferralRewardConfig;
  topReferrers: AdminReferralTopReferrer[];
  recentRewards: AdminReferralRewardEvent[];
};
