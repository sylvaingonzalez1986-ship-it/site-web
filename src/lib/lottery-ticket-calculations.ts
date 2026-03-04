import { getBadgeExtraBoosterPacksPerOrder } from "@/lib/loyalty-tier-benefits";
import type { LoyaltyBadgeId } from "@/types/loyalty";
import type { LotteryConfig } from "@/types/lottery";

export type LotteryTicketBreakdown = {
  baseTickets: number;
  bonusTickets: number;
  totalTickets: number;
  thresholdEur: number;
  maxBaseTicketsPerOrder: number;
};

export function computeBaseLotteryTickets(orderAmount: number, config: LotteryConfig | null): number {
  if (!config?.isActive) {
    return 0;
  }

  const threshold = Number(config.eurosPerTicket ?? 0);
  if (!Number.isFinite(threshold) || threshold <= 0) {
    return 0;
  }

  const normalizedAmount = Math.max(Number.isFinite(orderAmount) ? orderAmount : 0, 0);
  const baseTickets = Math.floor(normalizedAmount / threshold);
  return Math.min(baseTickets, Math.max(0, Math.floor(config.maxTicketsPerOrder ?? 0)));
}

export function computeLotteryTicketBreakdown(input: {
  orderAmount: number;
  config: LotteryConfig | null;
  badgeId: LoyaltyBadgeId;
  badgeUnlocked: boolean;
}): LotteryTicketBreakdown {
  const thresholdEur =
    input.config && Number.isFinite(Number(input.config.eurosPerTicket)) && Number(input.config.eurosPerTicket) > 0
      ? Number(input.config.eurosPerTicket)
      : 5;
  const maxBaseTicketsPerOrder =
    input.config && Number.isFinite(Number(input.config.maxTicketsPerOrder))
      ? Math.max(0, Math.floor(Number(input.config.maxTicketsPerOrder)))
      : 4;

  if (!input.config?.isActive) {
    return {
      baseTickets: 0,
      bonusTickets: 0,
      totalTickets: 0,
      thresholdEur,
      maxBaseTicketsPerOrder,
    };
  }

  const baseTickets = computeBaseLotteryTickets(input.orderAmount, input.config);
  const bonusTickets = input.badgeUnlocked
    ? getBadgeExtraBoosterPacksPerOrder(input.badgeId)
    : 0;

  return {
    baseTickets,
    bonusTickets,
    totalTickets: baseTickets + bonusTickets,
    thresholdEur,
    maxBaseTicketsPerOrder,
  };
}
