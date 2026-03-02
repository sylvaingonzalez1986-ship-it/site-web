export type LoyaltyBadgeId =
  | "decouverte"
  | "explorateur"
  | "connaisseur"
  | "ambassadeur"
  | "legende";

export type LoyaltyBadge = {
  id: LoyaltyBadgeId;
  label: string;
  description: string;
  minPoints: number;
  unlocked: boolean;
};

export type LoyaltySummary = {
  points: number;
  basePoints: number;
  bonusPoints: number;
  spentPoints: number;
  spendablePoints: number;
  totalPoints: number;
  totalEligibleSpend: number;
  eligibleOrdersCount: number;
  currentBadge: LoyaltyBadge;
  nextBadge: LoyaltyBadge | null;
  pointsToNextBadge: number;
  progressToNextBadge: number;
  badges: LoyaltyBadge[];
};

