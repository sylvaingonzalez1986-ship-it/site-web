export type LotteryStickerRarity = "common" | "rare" | "epic";

export type LotteryCardRarity = "common" | "silver" | "gold" | "epic" | "legendary";

export type LotteryRewardLevel = LotteryStickerRarity | "legendary";

export type LotteryRewardKind =
  | "discount_percent"
  | "gift_weight_grams"
  | "gift_product"
  | "physical_item"
  | "custom";

export type LotteryTicketStatus = "available" | "scratched";

export type LotteryRewardLineStatus = "earned" | "claimed" | "frozen";

export type LotteryRewardClaimStatus = "available" | "reserved" | "used" | "fulfilled" | "cancelled";

export type LotteryConfig = {
  eurosPerTicket: number;
  maxTicketsPerOrder: number;
  collectionTitle: string;
  seasonLabel: string;
  albumSubtitle: string;
  albumBoosterTitle: string;
  albumBoosterDescription: string;
  cardWeights: Record<LotteryCardRarity, number>;
  isActive: boolean;
  updatedAt: string;
};

export type LotteryRewardDefinition = {
  id: string;
  code: string;
  level: LotteryRewardLevel;
  kind: LotteryRewardKind;
  title: string;
  description: string;
  imageUrl: string;
  discountPercent?: number;
  giftWeightGrams?: number;
  giftProductSku?: string;
  giftLabel?: string;
  customPayload: Record<string, unknown>;
  isActive: boolean;
  deletedAt?: string;
  replacementRewardDefinitionId?: string;
  createdAt: string;
  updatedAt: string;
};

export type LotteryRewardSnapshot = {
  rewardDefinitionId?: string;
  title: string;
  description: string;
  level?: LotteryRewardLevel;
  kind?: LotteryRewardKind;
  imageUrl: string;
  discountPercent?: number;
  giftWeightGrams?: number;
  giftProductSku?: string;
  giftLabel?: string;
  customPayload: Record<string, unknown>;
  deleted: boolean;
};

export type LotteryRewardClaim = {
  id: string;
  userId: string;
  rewardLineId?: string;
  sourceTicketId?: string;
  rewardDefinitionId?: string;
  status: LotteryRewardClaimStatus;
  generatedCode?: string;
  discountPercent?: number;
  giftWeightGrams?: number;
  giftProductSku?: string;
  giftLabel?: string;
  reservedOrderId?: string;
  reservedAt?: string;
  reservedUntil?: string;
  usedOrderId?: string;
  usedAt?: string;
  fulfilledAt?: string;
  createdAt: string;
  reward: LotteryRewardSnapshot;
};

export type LotteryRewardLine = {
  id: string;
  userId: string;
  stickerRarity: LotteryStickerRarity;
  stickersRequired: number;
  rewardRuleId?: string;
  rewardDefinitionId?: string;
  status: LotteryRewardLineStatus;
  freezeReason?: string;
  claimId?: string;
  createdAt: string;
  claimedAt?: string;
  reward: LotteryRewardSnapshot;
};

export type LotteryRewardRule = {
  id: string;
  stickerRarity: LotteryStickerRarity;
  stickersRequired: number;
  rewardDefinitionId: string;
  albumPageId?: string;
  isActive: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
  reward?: LotteryRewardDefinition;
  albumPage?: LotteryAlbumPageWithSlots;
};

export type LotteryAlbumCard = {
  id: string;
  code: string;
  title: string;
  subtitle?: string;
  imageUrl: string;
  seriesLabel: string;
  cardNumber: number;
  rarity: LotteryStickerRarity;
  isActive: boolean;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type LotteryAlbumPageSlot = {
  id: string;
  pageId: string;
  slotIndex: number;
  cardId?: string;
  label?: string;
  createdAt: string;
  updatedAt: string;
  card?: LotteryAlbumCard;
};

export type LotteryAlbumPage = {
  id: string;
  code: string;
  title: string;
  collectionTitle: string;
  rarity: LotteryStickerRarity;
  pageNumber: number;
  isActive: boolean;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type LotteryAlbumPageWithSlots = LotteryAlbumPage & {
  slots: LotteryAlbumPageSlot[];
};

export type LotteryCardCollection = {
  id: string;
  code: string;
  title: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type LotteryCardDefinition = {
  id: string;
  collectionId: string;
  collectionCode: string;
  collectionTitle: string;
  code: string;
  cardNumber: number;
  name: string;
  rarity: LotteryCardRarity;
  visualPrompt: string;
  description: string;
  imageUrl: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type LotteryCollectedCard = LotteryCardDefinition & {
  ownedCount: number;
  firstOwnedAt?: string;
  lastOwnedAt?: string;
  isOwned: boolean;
  isDuplicate: boolean;
};

export type LotteryStickerInventory = Record<LotteryStickerRarity, number>;

export type LotteryCollectionRaritySummary = {
  rarity: LotteryCardRarity;
  totalCards: number;
  ownedUnique: number;
  ownedCopies: number;
};

export type LotteryTicket = {
  id: string;
  userId: string;
  orderId?: string;
  ticketNumber: string;
  orderAmount: number;
  status: LotteryTicketStatus;
  cardDefinitionId?: string;
  cardRarity?: LotteryCardRarity;
  scratchedAt?: string;
  createdAt: string;
  card?: LotteryCardDefinition;
  cards?: LotteryCollectedCard[];
};

export type LotteryInventory = {
  collection: LotteryCardCollection | null;
  cards: LotteryCollectedCard[];
  totalCards: number;
  uniqueOwned: number;
  totalOwnedCopies: number;
  duplicateCopies: number;
  completionPercent: number;
  byRarity: LotteryCollectionRaritySummary[];
  availableClaims: LotteryRewardClaim[];
  earnedLines: LotteryRewardLine[];
  recentLines: LotteryRewardLine[];
  frozenLines: LotteryRewardLine[];
};

export type LotteryRewardClaimBenefit =
  | {
      rewardType: "discount";
      claimId: string;
      title: string;
      description: string;
      generatedCode?: string;
      discountPercent: number;
      giftLabel?: undefined;
      giftWeightGrams?: undefined;
      giftProductSku?: undefined;
    }
  | {
      rewardType: "gift";
      claimId: string;
      title: string;
      description: string;
      generatedCode?: string;
      discountPercent?: undefined;
      giftLabel: string;
      giftWeightGrams?: number;
      giftProductSku?: string;
    };

export type LotteryDuplicateBurnChoice = "discount" | "gift";

export type ScratchResult = {
  ticketId: string;
  ticketNumber: string;
  scratchedAt: string;
  card: LotteryCollectedCard;
  cards: LotteryCollectedCard[];
  inventory: {
    totalCards: number;
    uniqueOwned: number;
    totalOwnedCopies: number;
    duplicateCopies: number;
    byRarity: Record<LotteryCardRarity, number>;
  };
};

export type LotteryStats = {
  totalTickets: number;
  availableTickets: number;
  scratchedTickets: number;
  totalCollectedCopies: number;
  uniqueCollectedCards: number;
  totalCardDefinitions: number;
  completionPercent: number;
  byCardRarity: Array<{
    rarity: LotteryCardRarity;
    defined: number;
    ownedUnique: number;
    ownedCopies: number;
  }>;
  recentScratches: Array<{
    ticketNumber: string;
    orderId?: string;
    scratchedAt: string;
    cardName?: string;
    cardNumber?: number;
    cardRarity?: LotteryCardRarity;
  }>;
};

/* ─────────────────────────────────────────────
   TCG Collection Album – domain types
   TCG-native (no legacy LotteryAlbumPageWithSlots)
   ───────────────────────────────────────────── */

export type LotteryCollectionPageRarity = LotteryCardRarity;
export type LotteryBurnableRarity = Exclude<LotteryCardRarity, "legendary">;

export type LotteryCollectionRewardStatus = "locked" | "claimable" | "claimed";
export type LotteryCollectionClaimSource = "page_completion" | "duplicate_burn";

export type LotteryCollectionPageRewardOption = {
  rewardDefinitionId: string;
  code: string;
  title: string;
  description: string;
  kind: LotteryRewardKind;
  imageUrl: string;
  discountPercent?: number;
  giftWeightGrams?: number;
  giftProductSku?: string;
  giftLabel?: string;
  customPayload: Record<string, unknown>;
  priority: number;
  isActive: boolean;
};

export type LotteryCollectionCardSlot = {
  slotIndex: number;
  cardDefinitionId: string;
  code: string;
  cardNumber: number;
  name: string;
  rarity: LotteryCollectionPageRarity;
  imageUrl: string;
  description: string;
  isOwned: boolean;
  ownedCount: number;
  burnableCount: number;
  burnableInstanceIds: string[];
  firstOwnedAt?: string;
  lastOwnedAt?: string;
};

export type LotteryDuplicateGroup = {
  cardDefinitionId: string;
  code: string;
  cardNumber: number;
  name: string;
  rarity: LotteryBurnableRarity;
  imageUrl: string;
  duplicateCount: number;
  burnableInstanceIds: string[];
};

export type LotteryCollectionPageState = {
  rarity: LotteryCollectionPageRarity;
  pageNumber: number;
  label: string;
  title: string;
  totalSlots: number;
  ownedUnique: number;
  missingCount: number;
  duplicateCopies: number;
  completionPercent: number;
  isComplete: boolean;
  rewardStatus: LotteryCollectionRewardStatus;
  completedAt?: string;
  claimedAt?: string;
  selectedRewardDefinitionId?: string;
  rewardClaimId?: string;
  rewardOptions: LotteryCollectionPageRewardOption[];
  burnOffer: { duplicatesRequired: number; discountPercent: number; giftWeightGrams: number } | null;
  slots: LotteryCollectionCardSlot[];
  duplicateGroups: LotteryDuplicateGroup[];
};

export type LotteryCollectionAvailableClaim = {
  source: LotteryCollectionClaimSource;
  sourceRarity: LotteryCollectionPageRarity;
  claim: LotteryRewardClaim;
};

export type LotteryCollectionAlbumSummary = {
  totalCards: number;
  ownedUnique: number;
  totalOwnedCopies: number;
  duplicateCopies: number;
  completionPercent: number;
  completedPages: number;
  claimablePages: number;
  availableClaims: number;
};

export type LotteryCollectionAlbum = {
  collectionId: string;
  collectionCode: string;
  collectionTitle: string;
  isActive: boolean;
  pageOrder: LotteryCollectionPageRarity[];
  summary: LotteryCollectionAlbumSummary;
  pages: LotteryCollectionPageState[];
  availableClaims: LotteryCollectionAvailableClaim[];
  generatedAt: string;
};
