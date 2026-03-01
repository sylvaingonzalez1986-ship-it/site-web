import "server-only";

import {
  archiveLotteryRewardDefinitionInSupabase,
  archiveLotteryCardDefinitionInSupabase,
  archiveLotteryAlbumCardInSupabase,
  archiveLotteryAlbumPageInSupabase,
  burnLotteryRewardLineInSupabase,
  consumeLotteryRewardClaimsForOrderInSupabase,
  createLotteryCardDefinitionInSupabase,
  createLotteryRewardDefinitionInSupabase,
  createLotteryAlbumCardInSupabase,
  createLotteryAlbumPageInSupabase,
  deactivateLotteryRewardRuleInSupabase,
  getLotteryConfigFromSupabase,
  getLotteryAlbumPageByIdFromSupabase,
  getLotteryInventoryForCustomerFromSupabase,
  getLotteryStatsFromSupabase,
  getLotteryTicketsForCustomerFromSupabase,
  getRedeemableLotteryRewardClaimBenefitFromSupabase,
  grantLotteryTicketsToCustomerInSupabase,
  listLotteryCardDefinitionsFromSupabase,
  listLotteryAlbumCardsFromSupabase,
  listLotteryAlbumPagesFromSupabase,
  listLotteryRewardDefinitionsFromSupabase,
  listLotteryRewardRulesFromSupabase,
  mintLotteryTicketsForOrderInSupabase,
  releaseLotteryRewardClaimsForOrderInSupabase,
  reserveLotteryRewardClaimForOrderInSupabase,
  scratchLotteryTicketInSupabase,
  updateLotteryCardDefinitionInSupabase,
  updateLotteryConfigInSupabase,
  updateLotteryAlbumCardInSupabase,
  updateLotteryAlbumPageInSupabase,
  updateLotteryRewardDefinitionInSupabase,
  upsertLotteryRewardRuleInSupabase,
  getCollectionAlbumForCustomerFromSupabase,
  claimCollectionPageRewardFromSupabase,
  burnDuplicateCardsFromSupabase,
} from "@/lib/supabase/lottery-backend";
import type {
  LotteryAlbumCard,
  LotteryAlbumPageWithSlots,
  LotteryBurnableRarity,
  LotteryCardDefinition,
  LotteryCardRarity,
  LotteryCollectionAlbum,
  LotteryConfig,
  LotteryInventory,
  LotteryRewardClaim,
  LotteryRewardClaimBenefit,
  LotteryRewardDefinition,
  LotteryRewardKind,
  LotteryRewardLevel,
  LotteryRewardRule,
  LotteryStats,
  LotteryStickerRarity,
  LotteryTicket,
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

export async function getLotteryInventoryForCustomerByBackend(userId: string): Promise<LotteryInventory> {
  return getLotteryInventoryForCustomerFromSupabase(userId);
}

export async function getRedeemableLotteryRewardClaimBenefitByBackend(input: {
  userId: string;
  claimId: string;
}): Promise<LotteryRewardClaimBenefit | null> {
  return getRedeemableLotteryRewardClaimBenefitFromSupabase(input);
}

export async function burnLotteryRewardLineByBackend(input: {
  userId: string;
  lineId: string;
}): Promise<LotteryRewardClaim> {
  return burnLotteryRewardLineInSupabase(input);
}

export async function reserveLotteryRewardClaimForOrderByBackend(input: {
  userId: string;
  claimId: string;
  orderId: string;
}): Promise<void> {
  return reserveLotteryRewardClaimForOrderInSupabase(input);
}

export async function consumeLotteryRewardClaimsForOrderByBackend(orderId: string): Promise<number> {
  return consumeLotteryRewardClaimsForOrderInSupabase(orderId);
}

export async function releaseLotteryRewardClaimsForOrderByBackend(orderId: string): Promise<number> {
  return releaseLotteryRewardClaimsForOrderInSupabase(orderId);
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
  eurosPerTicket: number;
  maxTicketsPerOrder: number;
  collectionTitle: string;
  albumSubtitle: string;
  albumBoosterTitle: string;
  albumBoosterDescription: string;
  commonWeight: number;
  silverWeight: number;
  goldWeight: number;
  epicWeight: number;
  legendaryWeight: number;
  isActive: boolean;
}): Promise<LotteryConfig> {
  return updateLotteryConfigInSupabase(input);
}

export async function listLotteryCardDefinitionsByBackend(): Promise<LotteryCardDefinition[]> {
  return listLotteryCardDefinitionsFromSupabase();
}

export async function createLotteryCardDefinitionByBackend(input: {
  code: string;
  cardNumber: number;
  name: string;
  rarity: LotteryCardRarity;
  visualPrompt?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  isActive: boolean;
}): Promise<LotteryCardDefinition> {
  return createLotteryCardDefinitionInSupabase(input);
}

export async function updateLotteryCardDefinitionByBackend(
  cardId: string,
  input: {
    code: string;
    cardNumber: number;
    name: string;
    rarity: LotteryCardRarity;
    visualPrompt?: string | null;
    description?: string | null;
    imageUrl?: string | null;
    isActive: boolean;
  },
): Promise<LotteryCardDefinition | null> {
  return updateLotteryCardDefinitionInSupabase(cardId, input);
}

export async function archiveLotteryCardDefinitionByBackend(cardId: string): Promise<boolean> {
  return archiveLotteryCardDefinitionInSupabase(cardId);
}

export async function listLotteryRewardDefinitionsByBackend(): Promise<LotteryRewardDefinition[]> {
  return listLotteryRewardDefinitionsFromSupabase();
}

export async function listLotteryAlbumCardsByBackend(): Promise<LotteryAlbumCard[]> {
  return listLotteryAlbumCardsFromSupabase();
}

export async function createLotteryAlbumCardByBackend(input: {
  code: string;
  title: string;
  subtitle?: string | null;
  imageUrl?: string | null;
  seriesLabel?: string | null;
  cardNumber: number;
  rarity: LotteryStickerRarity;
  isActive: boolean;
}): Promise<LotteryAlbumCard> {
  return createLotteryAlbumCardInSupabase(input);
}

export async function updateLotteryAlbumCardByBackend(
  cardId: string,
  input: {
    code: string;
    title: string;
    subtitle?: string | null;
    imageUrl?: string | null;
    seriesLabel?: string | null;
    cardNumber: number;
    rarity: LotteryStickerRarity;
    isActive: boolean;
  },
): Promise<LotteryAlbumCard | null> {
  return updateLotteryAlbumCardInSupabase(cardId, input);
}

export async function archiveLotteryAlbumCardByBackend(cardId: string): Promise<boolean> {
  return archiveLotteryAlbumCardInSupabase(cardId);
}

export async function listLotteryAlbumPagesByBackend(): Promise<LotteryAlbumPageWithSlots[]> {
  return listLotteryAlbumPagesFromSupabase();
}

export async function getLotteryAlbumPageByBackend(pageId: string): Promise<LotteryAlbumPageWithSlots> {
  return getLotteryAlbumPageByIdFromSupabase(pageId);
}

export async function createLotteryAlbumPageByBackend(input: {
  code: string;
  title: string;
  collectionTitle: string;
  rarity: LotteryStickerRarity;
  pageNumber: number;
  isActive: boolean;
  slots?: Array<{ slotIndex: number; cardId?: string | null; label?: string | null }>;
}): Promise<LotteryAlbumPageWithSlots> {
  return createLotteryAlbumPageInSupabase(input);
}

export async function updateLotteryAlbumPageByBackend(
  pageId: string,
  input: {
    code: string;
    title: string;
    collectionTitle: string;
    rarity: LotteryStickerRarity;
    pageNumber: number;
    isActive: boolean;
    slots: Array<{ slotIndex: number; cardId?: string | null; label?: string | null }>;
  },
): Promise<LotteryAlbumPageWithSlots | null> {
  return updateLotteryAlbumPageInSupabase(pageId, input);
}

export async function archiveLotteryAlbumPageByBackend(pageId: string): Promise<boolean> {
  return archiveLotteryAlbumPageInSupabase(pageId);
}

export async function createLotteryRewardDefinitionByBackend(input: {
  code: string;
  level: LotteryRewardLevel;
  kind: LotteryRewardKind;
  title: string;
  description: string;
  imageUrl?: string;
  discountPercent?: number | null;
  giftWeightGrams?: number | null;
  giftProductSku?: string | null;
  giftLabel?: string | null;
  customPayload?: Record<string, unknown>;
  isActive: boolean;
}): Promise<LotteryRewardDefinition> {
  return createLotteryRewardDefinitionInSupabase(input);
}

export async function updateLotteryRewardDefinitionByBackend(
  rewardId: string,
  input: {
    code: string;
    level: LotteryRewardLevel;
    kind: LotteryRewardKind;
    title: string;
    description: string;
    imageUrl?: string;
    discountPercent?: number | null;
    giftWeightGrams?: number | null;
    giftProductSku?: string | null;
    giftLabel?: string | null;
    customPayload?: Record<string, unknown>;
    isActive: boolean;
    replacementRewardDefinitionId?: string | null;
  },
): Promise<LotteryRewardDefinition | null> {
  return updateLotteryRewardDefinitionInSupabase(rewardId, input);
}

export async function archiveLotteryRewardDefinitionByBackend(input: {
  rewardId: string;
  replacementRewardDefinitionId?: string | null;
}): Promise<boolean> {
  return archiveLotteryRewardDefinitionInSupabase(input);
}

export async function listLotteryRewardRulesByBackend(): Promise<LotteryRewardRule[]> {
  return listLotteryRewardRulesFromSupabase();
}

export async function upsertLotteryRewardRuleByBackend(input: {
  ruleId?: string;
  stickerRarity: LotteryStickerRarity;
  stickersRequired: number;
  rewardDefinitionId: string;
  albumPageId?: string | null;
  isActive: boolean;
  priority: number;
}): Promise<LotteryRewardRule> {
  return upsertLotteryRewardRuleInSupabase(input);
}

export async function deactivateLotteryRewardRuleByBackend(ruleId: string): Promise<boolean> {
  return deactivateLotteryRewardRuleInSupabase(ruleId);
}

export async function getLotteryStatsByBackend(): Promise<LotteryStats> {
  return getLotteryStatsFromSupabase();
}

/* ─── TCG Collection Album ─── */

export async function getCollectionAlbumForCustomerByBackend(
  userId: string,
): Promise<LotteryCollectionAlbum> {
  return getCollectionAlbumForCustomerFromSupabase(userId);
}

export async function claimCollectionPageRewardByBackend(input: {
  userId: string;
  pageRarity: LotteryCardRarity;
  rewardDefinitionId: string;
}): Promise<LotteryRewardClaim> {
  return claimCollectionPageRewardFromSupabase(input);
}

export async function burnDuplicateCardsByBackend(input: {
  userId: string;
  rarity: LotteryBurnableRarity;
  instanceIds: string[];
  discountPercent: number;
}): Promise<LotteryRewardClaim> {
  return burnDuplicateCardsFromSupabase(input);
}
