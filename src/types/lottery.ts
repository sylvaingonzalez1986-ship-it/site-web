﻿export type LotteryPrizeRarity = "common" | "rare" | "epic" | "legendary";

export type LotteryTicketStatus = "available" | "scratched";

export type LotteryConfig = {
  ticketThresholdEuros: number;
  isActive: boolean;
  updatedAt: string;
};

export type LotteryPrize = {
  id: string;
  name: string;
  description: string;
  rarity: LotteryPrizeRarity;
  probability: number;
  imageUrl: string;
  valueEuros: number;
  stock: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type LotteryTicket = {
  id: string;
  userId: string;
  orderId?: string;
  ticketNumber: string;
  orderAmount: number;
  status: LotteryTicketStatus;
  prizeId?: string;
  isWin?: boolean;
  scratchedAt?: string;
  redeemedAt?: string;
  redeemedOrderId?: string;
  createdAt: string;
  prize?: Pick<LotteryPrize, "id" | "name" | "description" | "rarity" | "imageUrl" | "valueEuros">;
};

export type LotteryTicketBenefit =
  | {
      rewardType: "discount";
      discountPercent: number;
      giftLabel?: undefined;
    }
  | {
      rewardType: "gift";
      discountPercent?: undefined;
      giftLabel: string;
    };

export type ScratchResult = {
  ticketId: string;
  ticketNumber: string;
  isWin: boolean;
  scratchedAt: string;
  prize?: Pick<LotteryPrize, "id" | "name" | "description" | "rarity" | "imageUrl" | "valueEuros">;
};

export type LotteryStats = {
  totalTickets: number;
  availableTickets: number;
  scratchedTickets: number;
  winningTickets: number;
  winRate: number;
  byRarity: Array<{
    rarity: LotteryPrizeRarity;
    wins: number;
  }>;
  byPrize: Array<{
    prizeId: string;
    prizeName: string;
    rarity: LotteryPrizeRarity;
    wins: number;
  }>;
  recentScratches: Array<{
    ticketNumber: string;
    orderId?: string;
    scratchedAt: string;
    isWin: boolean;
    prizeName?: string;
    rarity?: LotteryPrizeRarity;
  }>;
};


