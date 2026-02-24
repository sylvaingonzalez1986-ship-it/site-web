﻿import "server-only";

import {
  createLotteryPrizeInSupabase,
  deleteLotteryPrizeInSupabase,
  grantLotteryTicketsToCustomerInSupabase,
  getLotteryConfigFromSupabase,
  getRedeemableLotteryTicketBenefitFromSupabase,
  getLotteryStatsFromSupabase,
  getLotteryTicketsForCustomerFromSupabase,
  listLotteryPrizesFromSupabase,
  mintLotteryTicketsForOrderInSupabase,
  redeemLotteryTicketForOrderInSupabase,
  scratchLotteryTicketInSupabase,
  updateLotteryConfigInSupabase,
  updateLotteryPrizeInSupabase,
} from "@/lib/supabase/lottery-backend";
import type {
  LotteryConfig,
  LotteryPrize,
  LotteryPrizeRarity,
  LotteryStats,
  LotteryTicket,
  LotteryTicketBenefit,
  ScratchResult,
} from "@/types/lottery";

export async function mintLotteryTicketsForOrderByBackend(input: {
  userId: string;
  orderId: string;
  orderAmount: number;
}): Promise<number> {
  return mintLotteryTicketsForOrderInSupabase(input);
}

export async function grantLotteryTicketsToCustomerByBackend(input: {
  userId: string;
  ticketCount: number;
  reason: string;
  adminEmail: string;
}): Promise<number> {
  return grantLotteryTicketsToCustomerInSupabase(input);
}

export async function getLotteryTicketsForCustomerByBackend(userId: string): Promise<LotteryTicket[]> {
  return getLotteryTicketsForCustomerFromSupabase(userId);
}

export async function getRedeemableLotteryTicketBenefitByBackend(input: {
  userId: string;
  ticketId: string;
}): Promise<{
  ticketId: string;
  ticketNumber: string;
  prizeName: string;
  prizeDescription: string;
  benefit: LotteryTicketBenefit;
} | null> {
  return getRedeemableLotteryTicketBenefitFromSupabase(input);
}

export async function redeemLotteryTicketForOrderByBackend(input: {
  userId: string;
  ticketId: string;
  orderId: string;
  rewardLabel: string;
}): Promise<void> {
  return redeemLotteryTicketForOrderInSupabase(input);
}

export async function scratchLotteryTicketByBackend(input: {
  userId: string;
  ticketId: string;
}): Promise<ScratchResult> {
  return scratchLotteryTicketInSupabase(input);
}

export async function getLotteryConfigByBackend(): Promise<LotteryConfig> {
  return getLotteryConfigFromSupabase();
}

export async function updateLotteryConfigByBackend(input: {
  ticketThresholdEuros: number;
  isActive: boolean;
}): Promise<LotteryConfig> {
  return updateLotteryConfigInSupabase(input);
}

export async function listLotteryPrizesByBackend(): Promise<LotteryPrize[]> {
  return listLotteryPrizesFromSupabase();
}

export async function createLotteryPrizeByBackend(input: {
  name: string;
  description: string;
  rarity: LotteryPrizeRarity;
  probability: number;
  imageUrl: string;
  valueEuros: number;
  stock: number | null;
  isActive: boolean;
}): Promise<LotteryPrize> {
  return createLotteryPrizeInSupabase(input);
}

export async function updateLotteryPrizeByBackend(
  prizeId: string,
  input: {
    name: string;
    description: string;
    rarity: LotteryPrizeRarity;
    probability: number;
    imageUrl: string;
    valueEuros: number;
    stock: number | null;
    isActive: boolean;
  },
): Promise<LotteryPrize | null> {
  return updateLotteryPrizeInSupabase(prizeId, input);
}

export async function deleteLotteryPrizeByBackend(prizeId: string): Promise<boolean> {
  return deleteLotteryPrizeInSupabase(prizeId);
}

export async function getLotteryStatsByBackend(): Promise<LotteryStats> {
  return getLotteryStatsFromSupabase();
}


