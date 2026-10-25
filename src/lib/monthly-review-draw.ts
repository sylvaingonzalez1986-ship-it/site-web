import type { LotteryRewardClaimStatus } from "@/types/lottery";

export type MonthlyReviewDraw = {
  prizeGrams: 10;
  nextDrawDate: string;
  /** Monthly schedule marker; qualifying reviews can be older than this date. */
  periodStartsOn: string;
  eligible: boolean | null;
  approvedReviewCount: number | null;
  latestDraw: {
    drawDate: string;
    participantCount: number;
    viewerWon: boolean;
  } | null;
  rewards: Array<{
    claimId: string;
    drawDate: string;
    status: LotteryRewardClaimStatus;
  }>;
};
