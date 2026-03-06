import "server-only";

import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import type {
  LotteryAlbumCard,
  LotteryAlbumPageSlot,
  LotteryAlbumPageWithSlots,
  LotteryBonusDefinition,
  LotteryBonusInstance,
  LotteryBonusOption,
  LotteryBonusPrize,
  LotteryBurnableRarity,
  LotteryDuplicateBurnChoice,
  LotteryCardCollection,
  LotteryCardDefinition,
  LotteryCardRarity,
  LotteryCollectedCard,
  LotteryCollectionAlbum,
  LotteryCollectionAlbumSummary,
  LotteryCollectionAvailableClaim,
  LotteryCollectionCardSlot,
  LotteryCollectionPageRewardOption,
  LotteryCollectionPageState,
  LotteryCollectionRewardStatus,
  LotteryConfig,
  LotteryDuplicateGroup,
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
import {
  LOTTERY_COLLECTION_PAGE_ORDER,
  LOTTERY_COLLECTION_PAGE_META,
  LOTTERY_DUPLICATE_BURN_RULES,
  LOTTERY_POINTS_PACK_COST,
  LOTTERY_POINTS_PACK_MAX_PER_PURCHASE,
  isBurnableRarity,
} from "@/lib/lottery-collection";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const STICKER_RARITIES: readonly LotteryStickerRarity[] = ["common", "rare", "epic"];
const CARD_RARITIES: readonly LotteryCardRarity[] = ["common", "silver", "gold", "epic", "legendary"];
const REWARD_LEVELS: readonly LotteryRewardLevel[] = ["common", "rare", "epic", "legendary"];
const REWARD_KINDS: readonly LotteryRewardKind[] = [
  "discount_percent",
  "gift_weight_grams",
  "gift_product",
  "physical_item",
  "custom",
];

function failIfError(error: { message: string } | null, context: string): void {
  if (error) {
    throw new Error(`[supabase:${context}] ${error.message}`);
  }
}

function isValidUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toMoney(value: unknown, fallback = 0): number {
  return Number(toNumber(value, fallback).toFixed(2));
}

function toInteger(value: unknown, fallback = 0): number {
  const parsed = Math.floor(toNumber(value, fallback));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function toNullableText(value: unknown): string | undefined {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text : undefined;
}

function parseStickerRarity(value: unknown): LotteryStickerRarity {
  const rarity = toText(value) as LotteryStickerRarity;
  return STICKER_RARITIES.includes(rarity) ? rarity : "common";
}

function parseCardRarity(value: unknown): LotteryCardRarity {
  const rarity = toText(value) as LotteryCardRarity;
  return CARD_RARITIES.includes(rarity) ? rarity : "common";
}

function parseRewardLevel(value: unknown): LotteryRewardLevel {
  const level = toText(value) as LotteryRewardLevel;
  return REWARD_LEVELS.includes(level) ? level : "common";
}

function parseRewardKind(value: unknown): LotteryRewardKind {
  const kind = toText(value) as LotteryRewardKind;
  return REWARD_KINDS.includes(kind) ? kind : "custom";
}

function buildEmptyCardCountByRarity(): Record<LotteryCardRarity, number> {
  return {
    common: 0,
    silver: 0,
    gold: 0,
    epic: 0,
    legendary: 0,
  };
}

function sanitizeRewardCode(value: unknown): string | undefined {
  const code = toText(value).trim().toUpperCase();
  return code ? code : undefined;
}

function mapRewardSnapshotRow(value: unknown) {
  const row = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};

  return {
    rewardDefinitionId: toNullableText(row.rewardDefinitionId ?? row.reward_definition_id),
    title: toText(row.title, "Lot"),
    description: toText(row.description),
    level: row.level ? parseRewardLevel(row.level) : undefined,
    kind: row.kind ? parseRewardKind(row.kind) : undefined,
    imageUrl: toText(row.imageUrl ?? row.image_url),
    discountPercent:
      Number.isFinite(Number(row.discountPercent ?? row.discount_percent))
        ? Math.max(0, Math.floor(Number(row.discountPercent ?? row.discount_percent)))
        : undefined,
    giftWeightGrams:
      Number.isFinite(Number(row.giftWeightGrams ?? row.gift_weight_grams))
        ? Math.max(0, Math.floor(Number(row.giftWeightGrams ?? row.gift_weight_grams)))
        : undefined,
    giftProductSku: toNullableText(row.giftProductSku ?? row.gift_product_sku),
    giftLabel: toNullableText(row.giftLabel ?? row.gift_label),
    customPayload:
      typeof row.customPayload === "object" && row.customPayload !== null
        ? (row.customPayload as Record<string, unknown>)
        : typeof row.custom_payload === "object" && row.custom_payload !== null
          ? (row.custom_payload as Record<string, unknown>)
          : {},
    deleted: row.deleted === true,
  };
}

function mapRewardDefinitionRow(row: Record<string, unknown>): LotteryRewardDefinition {
  return {
    id: toText(row.id),
    code: toText(row.code),
    level: parseRewardLevel(row.level),
    kind: parseRewardKind(row.kind),
    title: toText(row.title),
    description: toText(row.description),
    imageUrl: toText(row.image_url),
    discountPercent:
      Number.isFinite(Number(row.discount_percent)) ? Math.max(0, Math.floor(Number(row.discount_percent))) : undefined,
    giftWeightGrams:
      Number.isFinite(Number(row.gift_weight_grams)) ? Math.max(0, Math.floor(Number(row.gift_weight_grams))) : undefined,
    giftProductSku: toNullableText(row.gift_product_sku),
    giftLabel: toNullableText(row.gift_label),
    customPayload:
      typeof row.custom_payload === "object" && row.custom_payload !== null
        ? (row.custom_payload as Record<string, unknown>)
        : {},
    isActive: row.is_active === true,
    deletedAt: toNullableText(row.deleted_at),
    replacementRewardDefinitionId: toNullableText(row.replacement_reward_definition_id),
    createdAt: toText(row.created_at, new Date().toISOString()),
    updatedAt: toText(row.updated_at, new Date().toISOString()),
  };
}

function mapCardCollectionRow(row: Record<string, unknown>): LotteryCardCollection {
  return {
    id: toText(row.id),
    code: toText(row.code),
    title: toText(row.title, "Kanab Quest Collection"),
    isActive: row.is_active === true,
    createdAt: toText(row.created_at, new Date().toISOString()),
    updatedAt: toText(row.updated_at, new Date().toISOString()),
  };
}

function mapCardDefinitionRow(row: Record<string, unknown>): LotteryCardDefinition {
  const collectionRow =
    row.lottery_card_collections && typeof row.lottery_card_collections === "object"
      ? (row.lottery_card_collections as Record<string, unknown>)
      : null;

  return {
    id: toText(row.id),
    collectionId: toText(row.collection_id),
    collectionCode: toText(collectionRow?.code ?? row.collection_code, "HEMP_HEROES_2026"),
    collectionTitle: toText(collectionRow?.title ?? row.collection_title, "Kanab Quest Collection"),
    code: toText(row.code),
    cardNumber: Math.max(1, toInteger(row.card_number, 1)),
    name: toText(row.name),
    rarity: parseCardRarity(row.rarity),
    visualPrompt: toText(row.visual_prompt),
    description: toText(row.description),
    imageUrl: toText(row.image_url),
    isActive: row.is_active === true,
    createdAt: toText(row.created_at, new Date().toISOString()),
    updatedAt: toText(row.updated_at, new Date().toISOString()),
  };
}

function mapBonusOptionRow(row: Record<string, unknown>): LotteryBonusOption {
  const rawKind = toText(row.kind);
  const kind: LotteryBonusOption["kind"] =
    rawKind === "gift_weight_grams" || rawKind === "gift_product" ? rawKind : "custom";

  return {
    id: toText(row.id),
    bonusDefinitionId: toText(row.bonus_definition_id),
    label: toText(row.label),
    kind,
    giftWeightGrams:
      Number.isFinite(Number(row.gift_weight_grams)) && Number(row.gift_weight_grams) > 0
        ? Math.floor(Number(row.gift_weight_grams))
        : undefined,
    giftProductSku: toNullableText(row.gift_product_sku),
    giftLabel: toNullableText(row.gift_label),
    customPayload:
      typeof row.custom_payload === "object" && row.custom_payload !== null
        ? (row.custom_payload as Record<string, unknown>)
        : {},
    sortOrder: Math.max(0, toInteger(row.sort_order, 100)),
    createdAt: toText(row.created_at, new Date().toISOString()),
    updatedAt: toText(row.updated_at, new Date().toISOString()),
  };
}

function mapBonusDefinitionRow(row: Record<string, unknown>): LotteryBonusDefinition {
  const optionsRaw = Array.isArray(row.lottery_bonus_options)
    ? (row.lottery_bonus_options as Record<string, unknown>[])
    : [];

  return {
    id: toText(row.id),
    code: toText(row.code),
    title: toText(row.title),
    description: toText(row.description),
    imageUrl: toText(row.image_url),
    quotaPerCycle: Math.max(0, toInteger(row.quota_per_cycle, 0)),
    isActive: row.is_active === true,
    createdAt: toText(row.created_at, new Date().toISOString()),
    updatedAt: toText(row.updated_at, new Date().toISOString()),
    options: optionsRaw
      .map((item) => mapBonusOptionRow(item))
      .sort((left, right) => left.sortOrder - right.sortOrder || left.label.localeCompare(right.label)),
  };
}

function buildCollectedCard(
  definition: LotteryCardDefinition,
  stats?: { ownedCount?: number; firstOwnedAt?: string; lastOwnedAt?: string },
): LotteryCollectedCard {
  const ownedCount = Math.max(0, toInteger(stats?.ownedCount, 0));
  return {
    ...definition,
    ownedCount,
    firstOwnedAt: stats?.firstOwnedAt,
    lastOwnedAt: stats?.lastOwnedAt,
    isOwned: ownedCount > 0,
    isDuplicate: ownedCount > 1,
  };
}

function mapAlbumCardRow(row: Record<string, unknown>): LotteryAlbumCard {
  return {
    id: toText(row.id),
    code: toText(row.code),
    title: toText(row.title),
    subtitle: toNullableText(row.subtitle),
    imageUrl: toText(row.image_url),
    seriesLabel: toText(row.series_label, "Serie 2026"),
    cardNumber: Math.max(1, toInteger(row.card_number, 1)),
    rarity: parseStickerRarity(row.rarity),
    isActive: row.is_active === true,
    archivedAt: toNullableText(row.archived_at),
    createdAt: toText(row.created_at, new Date().toISOString()),
    updatedAt: toText(row.updated_at, new Date().toISOString()),
  };
}

function mapAlbumPageSlotRow(row: Record<string, unknown>): LotteryAlbumPageSlot {
  const cardRaw = row.lottery_album_cards as Record<string, unknown> | null;

  return {
    id: toText(row.id),
    pageId: toText(row.page_id),
    slotIndex: Math.max(1, toInteger(row.slot_index, 1)),
    cardId: toNullableText(row.card_id),
    label: toNullableText(row.label),
    createdAt: toText(row.created_at, new Date().toISOString()),
    updatedAt: toText(row.updated_at, new Date().toISOString()),
    card: cardRaw ? mapAlbumCardRow(cardRaw) : undefined,
  };
}

function mapAlbumPageRow(row: Record<string, unknown>): LotteryAlbumPageWithSlots {
  const slotsRaw = Array.isArray(row.lottery_album_page_slots)
    ? (row.lottery_album_page_slots as Record<string, unknown>[])
    : [];

  return {
    id: toText(row.id),
    code: toText(row.code),
    title: toText(row.title),
    collectionTitle: toText(row.collection_title, "Collection"),
    rarity: parseStickerRarity(row.rarity),
    pageNumber: Math.max(1, toInteger(row.page_number, 1)),
    isActive: row.is_active === true,
    archivedAt: toNullableText(row.archived_at),
    createdAt: toText(row.created_at, new Date().toISOString()),
    updatedAt: toText(row.updated_at, new Date().toISOString()),
    slots: slotsRaw
      .map((slot) => mapAlbumPageSlotRow(slot))
      .sort((left, right) => left.slotIndex - right.slotIndex),
  };
}

function mapRewardRuleRow(row: Record<string, unknown>): LotteryRewardRule {
  const rewardRaw = row.lottery_reward_definitions as Record<string, unknown> | null;
  const albumPageRaw = row.lottery_album_pages as Record<string, unknown> | null;

  return {
    id: toText(row.id),
    stickerRarity: parseStickerRarity(row.sticker_rarity),
    stickersRequired: Math.max(1, toInteger(row.stickers_required, 10)),
    rewardDefinitionId: toText(row.reward_definition_id),
    albumPageId: toNullableText(row.album_page_id),
    isActive: row.is_active === true,
    priority: toInteger(row.priority, 100),
    createdAt: toText(row.created_at, new Date().toISOString()),
    updatedAt: toText(row.updated_at, new Date().toISOString()),
    reward: rewardRaw ? mapRewardDefinitionRow(rewardRaw) : undefined,
    albumPage: albumPageRaw ? mapAlbumPageRow(albumPageRaw) : undefined,
  };
}

function mapRewardClaimRow(row: Record<string, unknown>): LotteryRewardClaim {
  return {
    id: toText(row.id),
    userId: toText(row.user_id),
    rewardLineId: toNullableText(row.reward_line_id),
    sourceTicketId: toNullableText(row.source_ticket_id),
    rewardDefinitionId: toNullableText(row.reward_definition_id),
    status: toText(row.status, "available") as LotteryRewardClaim["status"],
    generatedCode: sanitizeRewardCode(row.generated_code),
    discountPercent:
      Number.isFinite(Number(row.discount_percent)) ? Math.max(0, Math.floor(Number(row.discount_percent))) : undefined,
    giftWeightGrams:
      Number.isFinite(Number(row.gift_weight_grams)) ? Math.max(0, Math.floor(Number(row.gift_weight_grams))) : undefined,
    giftProductSku: toNullableText(row.gift_product_sku),
    giftLabel: toNullableText(row.gift_label),
    reservedOrderId: toNullableText(row.reserved_order_id),
    reservedAt: toNullableText(row.reserved_at),
    reservedUntil: toNullableText(row.reserved_until),
    usedOrderId: toNullableText(row.used_order_id),
    usedAt: toNullableText(row.used_at),
    fulfilledAt: toNullableText(row.fulfilled_at),
    createdAt: toText(row.created_at, new Date().toISOString()),
    reward: mapRewardSnapshotRow(row.reward_snapshot),
  };
}

function mapTicketRow(row: Record<string, unknown>, card?: LotteryCardDefinition): LotteryTicket {
  return {
    id: toText(row.id),
    userId: toText(row.user_id),
    orderId: toNullableText(row.order_id),
    ticketNumber: toText(row.ticket_number),
    orderAmount: toMoney(row.order_amount),
    status: toText(row.status, "available") as LotteryTicket["status"],
    cardDefinitionId: toNullableText(row.card_definition_id),
    cardRarity: row.card_rarity ? parseCardRarity(row.card_rarity) : undefined,
    scratchedAt: toNullableText(row.scratched_at),
    createdAt: toText(row.created_at, new Date().toISOString()),
    card,
  };
}

function mapScratchCardRow(
  raw: Record<string, unknown>,
  scratchedAt: string,
  fallbackOwnedCount = 1,
): LotteryCollectedCard {
  if (raw.isBonus === true) {
    const pseudoCard = buildCollectedCard(
      {
        id: toText(raw.definitionId ?? raw.id),
        collectionId: toText(raw.collectionId),
        collectionCode: toText(raw.collectionCode, "BONUS"),
        collectionTitle: toText(raw.collectionTitle, "Cartes Bonus"),
        code: toText(raw.code, "BONUS"),
        cardNumber: Math.max(0, toInteger(raw.cardNumber, 0)),
        name: toText(raw.name, "Carte Bonus"),
        rarity: parseCardRarity(raw.rarity ?? "legendary"),
        visualPrompt: toText(raw.visualPrompt),
        description: toText(raw.description),
        imageUrl: toText(raw.imageUrl),
        isActive: true,
        createdAt: scratchedAt,
        updatedAt: scratchedAt,
      },
      {
        ownedCount: 1,
        firstOwnedAt: scratchedAt,
        lastOwnedAt: scratchedAt,
      },
    );

    const optionsRaw = Array.isArray(raw.bonusOptions)
      ? (raw.bonusOptions as Record<string, unknown>[])
      : [];

    return {
      ...pseudoCard,
      isBonus: true,
      bonusInstanceId: toNullableText(raw.bonusInstanceId),
      bonusOptions: optionsRaw.map((item) =>
        mapBonusOptionRow({
          id: item.id,
          bonus_definition_id: item.bonusDefinitionId ?? item.bonus_definition_id ?? raw.id,
          label: item.label,
          kind: item.kind,
          gift_weight_grams: item.giftWeightGrams ?? item.gift_weight_grams,
          gift_product_sku: item.giftProductSku ?? item.gift_product_sku,
          gift_label: item.giftLabel ?? item.gift_label,
          custom_payload: item.customPayload ?? item.custom_payload,
          sort_order: item.sortOrder ?? item.sort_order,
          created_at: item.createdAt ?? item.created_at ?? scratchedAt,
          updated_at: item.updatedAt ?? item.updated_at ?? scratchedAt,
        }),
      ),
    };
  }

  const cardDefinition = mapCardDefinitionRow({
    id: raw.definitionId ?? raw.id,
    collection_id: raw.collectionId,
    collection_code: raw.collectionCode,
    collection_title: raw.collectionTitle,
    code: raw.code,
    card_number: raw.cardNumber,
    name: raw.name,
    rarity: raw.rarity,
    visual_prompt: raw.visualPrompt,
    description: raw.description,
    image_url: raw.imageUrl,
    is_active: true,
    created_at: scratchedAt,
    updated_at: scratchedAt,
  });

  return buildCollectedCard(cardDefinition, {
    ownedCount: Math.max(1, toInteger(raw.ownedCount, fallbackOwnedCount)),
    firstOwnedAt: toNullableText(raw.firstOwnedAt),
    lastOwnedAt: toNullableText(raw.lastOwnedAt),
  });
}

function mapConfigRow(row: Record<string, unknown> | null): LotteryConfig {
  return {
    eurosPerTicket: toMoney(row?.euros_per_ticket, 5),
    maxTicketsPerOrder: Math.max(1, toInteger(row?.max_tickets_per_order, 4)),
    collectionTitle: toText(row?.collection_title, "Kanab Quest Collection"),
    seasonLabel: toText(row?.season_label, "Saison 1"),
    albumSubtitle: toText(
      row?.album_subtitle,
      "Ta collection de cartes. Complete chaque page pour debloquer ses recompenses.",
    ),
    albumBoosterTitle: toText(row?.album_booster_title, "packs a ouvrir"),
    albumBoosterDescription: toText(
      row?.album_booster_description,
      "Ouvre un booster depuis l'album pour reveler les 3 cartes sans quitter cette page.",
    ),
    cycleSize: Math.max(1, toInteger(row?.cycle_size, 50000)),
    cardQuotas: {
      common: Math.max(0, toInteger(row?.common_quota, 40000)),
      silver: Math.max(0, toInteger(row?.silver_quota, 7000)),
      gold: Math.max(0, toInteger(row?.gold_quota, 2000)),
      epic: Math.max(0, toInteger(row?.epic_quota, 800)),
      legendary: Math.max(0, toInteger(row?.legendary_quota, 200)),
    },
    isActive: row?.is_active === true,
    updatedAt: toText(row?.updated_at, new Date().toISOString()),
  };
}

const ALBUM_PAGE_SELECT =
  "*,lottery_album_page_slots(*,lottery_album_cards(*))";

const SELECT_CARD_COLLECTION_COLUMNS =
  "id,code,title,is_active,created_at,updated_at";

const SELECT_REWARD_DEFINITION_COLUMNS =
  "id,code,level,kind,title,description,image_url,discount_percent,gift_weight_grams,gift_product_sku,gift_label,custom_payload,is_active,deleted_at,replacement_reward_definition_id,created_at,updated_at";

const SELECT_BONUS_DEFINITION_COLUMNS =
  "id,code,title,description,image_url,quota_per_cycle,is_active,created_at,updated_at,lottery_bonus_options(id,bonus_definition_id,label,kind,gift_weight_grams,gift_product_sku,gift_label,custom_payload,sort_order,created_at,updated_at)";

const SELECT_BONUS_OPTION_COLUMNS =
  "id,bonus_definition_id,label,kind,gift_weight_grams,gift_product_sku,gift_label,custom_payload,sort_order,created_at,updated_at";

const SELECT_BONUS_INSTANCE_COLUMNS =
  "id,user_id,ticket_id,cycle_id,bonus_definition_id,selected_option_id,status,generated_code,reserved_order_id,used_order_id,created_at,selected_at,redeemed_at,lottery_bonus_definitions(" +
  SELECT_BONUS_DEFINITION_COLUMNS +
  ")";

const SELECT_ALBUM_CARD_COLUMNS =
  "id,code,title,subtitle,image_url,series_label,card_number,rarity,is_active,archived_at,created_at,updated_at";

const SELECT_TICKET_COLUMNS =
  "id,user_id,order_id,ticket_number,order_amount,status,card_definition_id,card_rarity,scratched_at,created_at";

const SELECT_REWARD_CLAIM_COLUMNS =
  "id,user_id,reward_line_id,source_ticket_id,reward_definition_id,status,generated_code,discount_percent,gift_weight_grams,gift_product_sku,gift_label,reserved_order_id,reserved_at,reserved_until,used_order_id,used_at,fulfilled_at,created_at,reward_snapshot";

const SELECT_PAGE_COMPLETION_COLUMNS =
  "page_rarity,completed_at,claimed_at,reward_claim_id,selected_reward_definition_id";

const SELECT_BURN_LOG_COLUMNS =
  "rarity,reward_claim_id,created_at";

function buildClaimBenefit(claim: LotteryRewardClaim): LotteryRewardClaimBenefit | null {
  const title = claim.reward.title;
  const description = claim.reward.description;
  const generatedCode = claim.generatedCode;
  const customPayload = claim.reward.customPayload ?? {};
  const checkoutRedeemable = customPayload.checkoutRedeemable;

  if (checkoutRedeemable === false) {
    return null;
  }

  if (claim.reward.kind === "discount_percent" && claim.discountPercent && claim.discountPercent > 0) {
    return {
      rewardType: "discount",
      claimId: claim.id,
      title,
      description,
      generatedCode,
      discountPercent: claim.discountPercent,
    };
  }

  const giftLabel = claim.giftLabel ?? claim.reward.giftLabel ?? title;
  if (!giftLabel) {
    return null;
  }

  return {
    rewardType: "gift",
    claimId: claim.id,
    title,
    description,
    generatedCode,
    giftLabel,
    giftWeightGrams: claim.giftWeightGrams ?? claim.reward.giftWeightGrams,
    giftProductSku: claim.giftProductSku ?? claim.reward.giftProductSku,
  };
}

export async function getLotteryConfigFromSupabase(): Promise<LotteryConfig> {
  const supabase = createSupabaseServiceClient();

  const result = await supabase
    .from("lottery_game_config")
    .select(
      "euros_per_ticket,max_tickets_per_order,collection_title,season_label,album_subtitle,album_booster_title,album_booster_description,cycle_size,common_quota,silver_quota,gold_quota,epic_quota,legendary_quota,is_active,updated_at",
    )
    .eq("id", 1)
    .maybeSingle();

  failIfError(result.error, "read lottery_game_config");
  return mapConfigRow((result.data ?? null) as Record<string, unknown> | null);
}

export async function updateLotteryConfigInSupabase(input: {
  eurosPerTicket: number;
  maxTicketsPerOrder: number;
  collectionTitle: string;
  seasonLabel: string;
  albumSubtitle: string;
  albumBoosterTitle: string;
  albumBoosterDescription: string;
  cycleSize: number;
  commonQuota: number;
  silverQuota: number;
  goldQuota: number;
  epicQuota: number;
  legendaryQuota: number;
  isActive: boolean;
}): Promise<LotteryConfig> {
  const supabase = createSupabaseServiceClient();
  const safeCycleSize = Math.max(1000, Math.min(5000000, Math.floor(input.cycleSize)));
  const quotas = {
    common: Math.max(0, Math.floor(input.commonQuota)),
    silver: Math.max(0, Math.floor(input.silverQuota)),
    gold: Math.max(0, Math.floor(input.goldQuota)),
    epic: Math.max(0, Math.floor(input.epicQuota)),
    legendary: Math.max(0, Math.floor(input.legendaryQuota)),
  };

  const quotaBudget = quotas.common + quotas.silver + quotas.gold + quotas.epic + quotas.legendary;
  if (quotaBudget !== safeCycleSize) {
    throw new Error(`Le total des quotas doit etre exactement ${safeCycleSize}.`);
  }

  const result = await supabase
    .from("lottery_game_config")
    .upsert(
      {
        id: 1,
        euros_per_ticket: toMoney(input.eurosPerTicket, 5),
        max_tickets_per_order: Math.max(1, Math.min(20, Math.floor(input.maxTicketsPerOrder))),
        collection_title: toText(input.collectionTitle).trim() || "Kanab Quest Collection",
        season_label: toText(input.seasonLabel).trim(),
        album_subtitle:
          toText(input.albumSubtitle).trim() ||
          "Ta collection de cartes. Complete chaque page pour debloquer ses recompenses.",
        album_booster_title: toText(input.albumBoosterTitle).trim() || "packs a ouvrir",
        album_booster_description:
          toText(input.albumBoosterDescription).trim() ||
          "Ouvre un booster depuis l'album pour reveler les 3 cartes sans quitter cette page.",
        cycle_size: safeCycleSize,
        common_quota: quotas.common,
        silver_quota: quotas.silver,
        gold_quota: quotas.gold,
        epic_quota: quotas.epic,
        legendary_quota: quotas.legendary,
        is_active: input.isActive === true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    )
    .select(
      "euros_per_ticket,max_tickets_per_order,collection_title,season_label,album_subtitle,album_booster_title,album_booster_description,cycle_size,common_quota,silver_quota,gold_quota,epic_quota,legendary_quota,is_active,updated_at",
    )
    .single();

  failIfError(result.error, "upsert lottery_game_config");
  return mapConfigRow(result.data as Record<string, unknown>);
}

async function getDefaultLotteryCardCollectionFromSupabase(): Promise<LotteryCardCollection> {
  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("lottery_card_collections")
    .select(SELECT_CARD_COLLECTION_COLUMNS)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  failIfError(result.error, "read lottery_card_collections default");
  if (!result.data) {
    throw new Error("Aucune collection TCG active.");
  }

  return mapCardCollectionRow(result.data as Record<string, unknown>);
}

export async function listLotteryCardDefinitionsFromSupabase(): Promise<LotteryCardDefinition[]> {
  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("lottery_card_definitions")
    .select("*,lottery_card_collections(*)")
    .order("card_number", { ascending: true })
    .order("created_at", { ascending: true });

  failIfError(result.error, "list lottery_card_definitions");
  return (result.data ?? []).map((row) => mapCardDefinitionRow(row as Record<string, unknown>));
}

export async function createLotteryCardDefinitionInSupabase(input: {
  code: string;
  cardNumber: number;
  name: string;
  rarity: LotteryCardRarity;
  visualPrompt?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  isActive: boolean;
}): Promise<LotteryCardDefinition> {
  const collection = await getDefaultLotteryCardCollectionFromSupabase();
  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("lottery_card_definitions")
    .insert({
      collection_id: collection.id,
      code: toText(input.code).trim().toUpperCase(),
      card_number: Math.max(1, Math.min(9999, Math.floor(input.cardNumber))),
      name: toText(input.name).trim(),
      rarity: input.rarity,
      visual_prompt: toText(input.visualPrompt).trim(),
      description: toText(input.description).trim(),
      image_url: toText(input.imageUrl).trim(),
      is_active: input.isActive === true,
    })
    .select("*,lottery_card_collections(*)")
    .single();

  failIfError(result.error, "insert lottery_card_definitions");
  return mapCardDefinitionRow(result.data as Record<string, unknown>);
}

export async function updateLotteryCardDefinitionInSupabase(
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
  const safeCardId = cardId.trim();
  if (!isValidUuid(safeCardId)) {
    throw new Error("Carte TCG invalide.");
  }

  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("lottery_card_definitions")
    .update({
      code: toText(input.code).trim().toUpperCase(),
      card_number: Math.max(1, Math.min(9999, Math.floor(input.cardNumber))),
      name: toText(input.name).trim(),
      rarity: input.rarity,
      visual_prompt: toText(input.visualPrompt).trim(),
      description: toText(input.description).trim(),
      image_url: toText(input.imageUrl).trim(),
      is_active: input.isActive === true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", safeCardId)
    .select("*,lottery_card_collections(*)")
    .maybeSingle();

  failIfError(result.error, "update lottery_card_definitions");
  return result.data ? mapCardDefinitionRow(result.data as Record<string, unknown>) : null;
}

export async function archiveLotteryCardDefinitionInSupabase(cardId: string): Promise<boolean> {
  const safeCardId = cardId.trim();
  if (!isValidUuid(safeCardId)) {
    return false;
  }

  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("lottery_card_definitions")
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", safeCardId)
    .select("id")
    .maybeSingle();

  failIfError(result.error, "archive lottery_card_definitions");
  return Boolean(result.data);
}

export async function listLotteryRewardDefinitionsFromSupabase(): Promise<LotteryRewardDefinition[]> {
  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("lottery_reward_definitions")
    .select(SELECT_REWARD_DEFINITION_COLUMNS)
    .order("created_at", { ascending: true });

  failIfError(result.error, "list lottery_reward_definitions");
  return (result.data ?? []).map((row) => mapRewardDefinitionRow(row as Record<string, unknown>));
}

export async function listLotteryBonusDefinitionsFromSupabase(): Promise<LotteryBonusDefinition[]> {
  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("lottery_bonus_definitions")
    .select(SELECT_BONUS_DEFINITION_COLUMNS)
    .order("created_at", { ascending: true });

  failIfError(result.error, "list lottery_bonus_definitions");
  return (result.data ?? []).map((row) => mapBonusDefinitionRow(row as Record<string, unknown>));
}

export async function createLotteryBonusDefinitionInSupabase(input: {
  code: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  quotaPerCycle: number;
  isActive: boolean;
}): Promise<LotteryBonusDefinition> {
  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("lottery_bonus_definitions")
    .insert({
      code: toText(input.code).trim().toUpperCase(),
      title: toText(input.title).trim(),
      description: toText(input.description).trim(),
      image_url: toText(input.imageUrl).trim(),
      quota_per_cycle: Math.max(0, Math.floor(input.quotaPerCycle)),
      is_active: input.isActive === true,
    })
    .select(SELECT_BONUS_DEFINITION_COLUMNS)
    .single();

  failIfError(result.error, "insert lottery_bonus_definition");
  return mapBonusDefinitionRow(result.data as Record<string, unknown>);
}

export async function updateLotteryBonusDefinitionInSupabase(
  bonusId: string,
  input: {
    code: string;
    title: string;
    description?: string | null;
    imageUrl?: string | null;
    quotaPerCycle: number;
    isActive: boolean;
  },
): Promise<LotteryBonusDefinition | null> {
  const safeBonusId = bonusId.trim();
  if (!isValidUuid(safeBonusId)) {
    throw new Error("Carte bonus invalide.");
  }

  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("lottery_bonus_definitions")
    .update({
      code: toText(input.code).trim().toUpperCase(),
      title: toText(input.title).trim(),
      description: toText(input.description).trim(),
      image_url: toText(input.imageUrl).trim(),
      quota_per_cycle: Math.max(0, Math.floor(input.quotaPerCycle)),
      is_active: input.isActive === true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", safeBonusId)
    .select(SELECT_BONUS_DEFINITION_COLUMNS)
    .maybeSingle();

  failIfError(result.error, "update lottery_bonus_definition");
  return result.data ? mapBonusDefinitionRow(result.data as Record<string, unknown>) : null;
}

export async function archiveLotteryBonusDefinitionInSupabase(bonusId: string): Promise<boolean> {
  const safeBonusId = bonusId.trim();
  if (!isValidUuid(safeBonusId)) {
    return false;
  }

  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("lottery_bonus_definitions")
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", safeBonusId)
    .select("id")
    .maybeSingle();

  failIfError(result.error, "archive lottery_bonus_definition");
  return Boolean(result.data);
}

export async function createLotteryBonusOptionInSupabase(input: {
  bonusDefinitionId: string;
  label: string;
  kind: LotteryBonusOption["kind"];
  giftWeightGrams?: number | null;
  giftProductSku?: string | null;
  giftLabel?: string | null;
  customPayload?: Record<string, unknown>;
  sortOrder?: number;
}): Promise<LotteryBonusOption> {
  const safeBonusDefinitionId = input.bonusDefinitionId.trim();
  if (!isValidUuid(safeBonusDefinitionId)) {
    throw new Error("Carte bonus invalide.");
  }

  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("lottery_bonus_options")
    .insert({
      bonus_definition_id: safeBonusDefinitionId,
      label: toText(input.label).trim(),
      kind: input.kind,
      gift_weight_grams:
        Number.isFinite(Number(input.giftWeightGrams)) && Number(input.giftWeightGrams) > 0
          ? Math.floor(Number(input.giftWeightGrams))
          : null,
      gift_product_sku: toNullableText(input.giftProductSku),
      gift_label: toNullableText(input.giftLabel),
      custom_payload: input.customPayload ?? {},
      sort_order: Math.max(0, Math.floor(input.sortOrder ?? 100)),
    })
    .select(SELECT_BONUS_OPTION_COLUMNS)
    .single();

  failIfError(result.error, "insert lottery_bonus_option");
  return mapBonusOptionRow(result.data as Record<string, unknown>);
}

export async function updateLotteryBonusOptionInSupabase(
  optionId: string,
  input: {
    label: string;
    kind: LotteryBonusOption["kind"];
    giftWeightGrams?: number | null;
    giftProductSku?: string | null;
    giftLabel?: string | null;
    customPayload?: Record<string, unknown>;
    sortOrder?: number;
  },
): Promise<LotteryBonusOption | null> {
  const safeOptionId = optionId.trim();
  if (!isValidUuid(safeOptionId)) {
    throw new Error("Option bonus invalide.");
  }

  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("lottery_bonus_options")
    .update({
      label: toText(input.label).trim(),
      kind: input.kind,
      gift_weight_grams:
        Number.isFinite(Number(input.giftWeightGrams)) && Number(input.giftWeightGrams) > 0
          ? Math.floor(Number(input.giftWeightGrams))
          : null,
      gift_product_sku: toNullableText(input.giftProductSku),
      gift_label: toNullableText(input.giftLabel),
      custom_payload: input.customPayload ?? {},
      sort_order: Math.max(0, Math.floor(input.sortOrder ?? 100)),
      updated_at: new Date().toISOString(),
    })
    .eq("id", safeOptionId)
    .select(SELECT_BONUS_OPTION_COLUMNS)
    .maybeSingle();

  failIfError(result.error, "update lottery_bonus_option");
  return result.data ? mapBonusOptionRow(result.data as Record<string, unknown>) : null;
}

export async function archiveLotteryBonusOptionInSupabase(optionId: string): Promise<boolean> {
  const safeOptionId = optionId.trim();
  if (!isValidUuid(safeOptionId)) {
    return false;
  }

  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("lottery_bonus_options")
    .delete()
    .eq("id", safeOptionId)
    .select("id")
    .maybeSingle();

  failIfError(result.error, "delete lottery_bonus_option");
  return Boolean(result.data);
}

function mapBonusInstanceRow(row: Record<string, unknown>): LotteryBonusInstance {
  const definitionRaw =
    row.lottery_bonus_definitions && typeof row.lottery_bonus_definitions === "object"
      ? (row.lottery_bonus_definitions as Record<string, unknown>)
      : null;

  return {
    id: toText(row.id),
    userId: toText(row.user_id),
    ticketId: toText(row.ticket_id),
    cycleId: Math.max(1, toInteger(row.cycle_id, 1)),
    bonusDefinitionId: toText(row.bonus_definition_id),
    selectedOptionId: toNullableText(row.selected_option_id),
    status: toText(row.status, "available") as LotteryBonusInstance["status"],
    generatedCode: sanitizeRewardCode(row.generated_code),
    reservedOrderId: toNullableText(row.reserved_order_id),
    usedOrderId: toNullableText(row.used_order_id),
    createdAt: toText(row.created_at, new Date().toISOString()),
    selectedAt: toNullableText(row.selected_at),
    redeemedAt: toNullableText(row.redeemed_at),
    bonus: definitionRaw
      ? mapBonusDefinitionRow(definitionRaw)
      : {
          id: toText(row.bonus_definition_id),
          code: "BONUS",
          title: "Carte Bonus",
          description: "",
          imageUrl: "",
          quotaPerCycle: 0,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          options: [],
        },
  };
}

export async function listLotteryBonusInstancesForCustomerFromSupabase(
  userId: string,
): Promise<LotteryBonusInstance[]> {
  const safeUserId = userId.trim();
  if (!isValidUuid(safeUserId)) {
    return [];
  }

  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("lottery_bonus_instances")
    .select(SELECT_BONUS_INSTANCE_COLUMNS)
    .eq("user_id", safeUserId)
    .order("created_at", { ascending: false });

  failIfError(result.error, "list lottery_bonus_instances");
  const rows = Array.isArray(result.data) ? ((result.data as unknown) as Record<string, unknown>[]) : [];
  return rows.map((row) => mapBonusInstanceRow(row));
}

export async function selectLotteryBonusOptionForCustomerInSupabase(input: {
  userId: string;
  bonusInstanceId: string;
  optionId: string;
}): Promise<LotteryBonusInstance> {
  const safeUserId = input.userId.trim();
  const safeBonusInstanceId = input.bonusInstanceId.trim();
  const safeOptionId = input.optionId.trim();
  if (!isValidUuid(safeUserId) || !isValidUuid(safeBonusInstanceId) || !isValidUuid(safeOptionId)) {
    throw new Error("Selection bonus invalide.");
  }

  const supabase = createSupabaseServiceClient();
  const optionResult = await supabase
    .from("lottery_bonus_options")
    .select("id,bonus_definition_id")
    .eq("id", safeOptionId)
    .single();

  failIfError(optionResult.error, "read lottery_bonus_option");

  const updateResult = await supabase
    .from("lottery_bonus_instances")
    .update({
      selected_option_id: safeOptionId,
      selected_at: new Date().toISOString(),
      status: "reserved",
      generated_code: sanitizeRewardCode(`BNS-${safeBonusInstanceId.slice(0, 8)}`),
    })
    .eq("id", safeBonusInstanceId)
    .eq("user_id", safeUserId)
    .eq("bonus_definition_id", toText((optionResult.data as Record<string, unknown>).bonus_definition_id))
    .select(SELECT_BONUS_INSTANCE_COLUMNS)
    .single();

  failIfError(updateResult.error, "update lottery_bonus_instance select option");
  const updatedRow = (updateResult as { data?: unknown }).data;
  if (!updatedRow || typeof updatedRow !== "object") {
    throw new Error("Instance bonus introuvable.");
  }
  return mapBonusInstanceRow(updatedRow as Record<string, unknown>);
}

export async function listLotteryAlbumCardsFromSupabase(): Promise<LotteryAlbumCard[]> {
  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("lottery_album_cards")
    .select(SELECT_ALBUM_CARD_COLUMNS)
    .order("rarity", { ascending: true })
    .order("card_number", { ascending: true })
    .order("created_at", { ascending: true });

  failIfError(result.error, "list lottery_album_cards");
  return (result.data ?? []).map((row) => mapAlbumCardRow(row as Record<string, unknown>));
}

export async function createLotteryAlbumCardInSupabase(input: {
  code: string;
  title: string;
  subtitle?: string | null;
  imageUrl?: string | null;
  seriesLabel?: string | null;
  cardNumber: number;
  rarity: LotteryStickerRarity;
  isActive: boolean;
}): Promise<LotteryAlbumCard> {
  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("lottery_album_cards")
    .insert({
      code: toText(input.code).trim().toUpperCase(),
      title: toText(input.title).trim(),
      subtitle: toNullableText(input.subtitle),
      image_url: toText(input.imageUrl).trim(),
      series_label: toText(input.seriesLabel).trim() || "Serie 2026",
      card_number: Math.max(1, Math.min(9999, Math.floor(input.cardNumber))),
      rarity: input.rarity,
      is_active: input.isActive === true,
    })
    .select(SELECT_ALBUM_CARD_COLUMNS)
    .single();

  failIfError(result.error, "insert lottery_album_card");
  return mapAlbumCardRow(result.data as Record<string, unknown>);
}

export async function updateLotteryAlbumCardInSupabase(
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
  const safeCardId = cardId.trim();
  if (!isValidUuid(safeCardId)) {
    throw new Error("Carte album invalide.");
  }

  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("lottery_album_cards")
    .update({
      code: toText(input.code).trim().toUpperCase(),
      title: toText(input.title).trim(),
      subtitle: toNullableText(input.subtitle),
      image_url: toText(input.imageUrl).trim(),
      series_label: toText(input.seriesLabel).trim() || "Serie 2026",
      card_number: Math.max(1, Math.min(9999, Math.floor(input.cardNumber))),
      rarity: input.rarity,
      is_active: input.isActive === true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", safeCardId)
    .select(SELECT_ALBUM_CARD_COLUMNS)
    .maybeSingle();

  failIfError(result.error, "update lottery_album_card");
  return result.data ? mapAlbumCardRow(result.data as Record<string, unknown>) : null;
}

export async function archiveLotteryAlbumCardInSupabase(cardId: string): Promise<boolean> {
  const safeCardId = cardId.trim();
  if (!isValidUuid(safeCardId)) {
    return false;
  }

  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("lottery_album_cards")
    .update({
      is_active: false,
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", safeCardId)
    .select("id")
    .maybeSingle();

  failIfError(result.error, "archive lottery_album_card");
  return Boolean(result.data);
}

export async function listLotteryAlbumPagesFromSupabase(): Promise<LotteryAlbumPageWithSlots[]> {
  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("lottery_album_pages")
    .select(ALBUM_PAGE_SELECT)
    .order("rarity", { ascending: true })
    .order("page_number", { ascending: true })
    .order("created_at", { ascending: true });

  failIfError(result.error, "list lottery_album_pages");
  return (result.data ?? []).map((row) => mapAlbumPageRow(row as Record<string, unknown>));
}

async function replaceLotteryAlbumPageSlots(
  pageId: string,
  slots: Array<{ slotIndex: number; cardId?: string | null; label?: string | null }>,
): Promise<void> {
  const supabase = createSupabaseServiceClient();

  const deleteResult = await supabase.from("lottery_album_page_slots").delete().eq("page_id", pageId);
  failIfError(deleteResult.error, "delete lottery_album_page_slots");

  const normalizedSlots = slots
    .map((slot) => ({
      page_id: pageId,
      slot_index: Math.max(1, Math.min(100, Math.floor(slot.slotIndex))),
      card_id: slot.cardId?.trim() || null,
      label: toNullableText(slot.label),
    }))
    .sort((left, right) => left.slot_index - right.slot_index);

  if (normalizedSlots.length < 1) {
    return;
  }

  const insertResult = await supabase.from("lottery_album_page_slots").insert(normalizedSlots);
  failIfError(insertResult.error, "insert lottery_album_page_slots");
}

export async function createLotteryAlbumPageInSupabase(input: {
  code: string;
  title: string;
  collectionTitle: string;
  rarity: LotteryStickerRarity;
  pageNumber: number;
  isActive: boolean;
  slots?: Array<{ slotIndex: number; cardId?: string | null; label?: string | null }>;
}): Promise<LotteryAlbumPageWithSlots> {
  const supabase = createSupabaseServiceClient();
  const pageResult = await supabase
    .from("lottery_album_pages")
    .insert({
      code: toText(input.code).trim().toUpperCase(),
      title: toText(input.title).trim(),
      collection_title: toText(input.collectionTitle).trim() || "Collection",
      rarity: input.rarity,
      page_number: Math.max(1, Math.min(999, Math.floor(input.pageNumber))),
      is_active: input.isActive === true,
    })
    .select(ALBUM_PAGE_SELECT)
    .single();

  failIfError(pageResult.error, "insert lottery_album_page");

  const page = mapAlbumPageRow(pageResult.data as Record<string, unknown>);
  if (input.slots && input.slots.length > 0) {
    await replaceLotteryAlbumPageSlots(page.id, input.slots);
    return getLotteryAlbumPageByIdFromSupabase(page.id);
  }

  return page;
}

export async function getLotteryAlbumPageByIdFromSupabase(pageId: string): Promise<LotteryAlbumPageWithSlots> {
  const safePageId = pageId.trim();
  if (!isValidUuid(safePageId)) {
    throw new Error("Page album invalide.");
  }

  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("lottery_album_pages")
    .select(ALBUM_PAGE_SELECT)
    .eq("id", safePageId)
    .single();

  failIfError(result.error, "read lottery_album_page");
  return mapAlbumPageRow(result.data as Record<string, unknown>);
}

export async function updateLotteryAlbumPageInSupabase(
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
  const safePageId = pageId.trim();
  if (!isValidUuid(safePageId)) {
    throw new Error("Page album invalide.");
  }

  const supabase = createSupabaseServiceClient();
  const pageResult = await supabase
    .from("lottery_album_pages")
    .update({
      code: toText(input.code).trim().toUpperCase(),
      title: toText(input.title).trim(),
      collection_title: toText(input.collectionTitle).trim() || "Collection",
      rarity: input.rarity,
      page_number: Math.max(1, Math.min(999, Math.floor(input.pageNumber))),
      is_active: input.isActive === true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", safePageId)
    .select("id")
    .maybeSingle();

  failIfError(pageResult.error, "update lottery_album_page");
  if (!pageResult.data) {
    return null;
  }

  await replaceLotteryAlbumPageSlots(safePageId, input.slots);
  return getLotteryAlbumPageByIdFromSupabase(safePageId);
}

export async function archiveLotteryAlbumPageInSupabase(pageId: string): Promise<boolean> {
  const safePageId = pageId.trim();
  if (!isValidUuid(safePageId)) {
    return false;
  }

  const supabase = createSupabaseServiceClient();
  const pageResult = await supabase
    .from("lottery_album_pages")
    .update({
      is_active: false,
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", safePageId)
    .select("id")
    .maybeSingle();

  failIfError(pageResult.error, "archive lottery_album_page");
  if (!pageResult.data) {
    return false;
  }

  const rulesResult = await supabase
    .from("lottery_reward_rules")
    .update({
      album_page_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("album_page_id", safePageId);

  failIfError(rulesResult.error, "clear lottery_reward_rules album_page_id");
  return true;
}

export async function createLotteryRewardDefinitionInSupabase(input: {
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
  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("lottery_reward_definitions")
    .insert({
      code: toText(input.code).trim().toUpperCase(),
      level: input.level,
      kind: input.kind,
      title: toText(input.title).trim(),
      description: toText(input.description).trim(),
      image_url: toText(input.imageUrl).trim(),
      discount_percent:
        Number.isFinite(Number(input.discountPercent)) && Number(input.discountPercent) > 0
          ? Math.floor(Number(input.discountPercent))
          : null,
      gift_weight_grams:
        Number.isFinite(Number(input.giftWeightGrams)) && Number(input.giftWeightGrams) > 0
          ? Math.floor(Number(input.giftWeightGrams))
          : null,
      gift_product_sku: toNullableText(input.giftProductSku),
      gift_label: toNullableText(input.giftLabel),
      custom_payload: input.customPayload ?? {},
      is_active: input.isActive === true,
    })
    .select(SELECT_REWARD_DEFINITION_COLUMNS)
    .single();

  failIfError(result.error, "insert lottery_reward_definition");
  return mapRewardDefinitionRow(result.data as Record<string, unknown>);
}

export async function updateLotteryRewardDefinitionInSupabase(
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
  const safeRewardId = rewardId.trim();
  if (!isValidUuid(safeRewardId)) {
    throw new Error("Lot invalide.");
  }

  const supabase = createSupabaseServiceClient();
  const replacementRewardDefinitionId = input.replacementRewardDefinitionId?.trim() || null;

  const result = await supabase
    .from("lottery_reward_definitions")
    .update({
      code: toText(input.code).trim().toUpperCase(),
      level: input.level,
      kind: input.kind,
      title: toText(input.title).trim(),
      description: toText(input.description).trim(),
      image_url: toText(input.imageUrl).trim(),
      discount_percent:
        Number.isFinite(Number(input.discountPercent)) && Number(input.discountPercent) > 0
          ? Math.floor(Number(input.discountPercent))
          : null,
      gift_weight_grams:
        Number.isFinite(Number(input.giftWeightGrams)) && Number(input.giftWeightGrams) > 0
          ? Math.floor(Number(input.giftWeightGrams))
          : null,
      gift_product_sku: toNullableText(input.giftProductSku),
      gift_label: toNullableText(input.giftLabel),
      custom_payload: input.customPayload ?? {},
      is_active: input.isActive === true,
      replacement_reward_definition_id:
        replacementRewardDefinitionId && isValidUuid(replacementRewardDefinitionId)
          ? replacementRewardDefinitionId
          : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", safeRewardId)
    .select(SELECT_REWARD_DEFINITION_COLUMNS)
    .maybeSingle();

  failIfError(result.error, "update lottery_reward_definition");
  return result.data ? mapRewardDefinitionRow(result.data as Record<string, unknown>) : null;
}

export async function archiveLotteryRewardDefinitionInSupabase(input: {
  rewardId: string;
  replacementRewardDefinitionId?: string | null;
}): Promise<boolean> {
  const rewardId = input.rewardId.trim();
  if (!isValidUuid(rewardId)) {
    return false;
  }

  const supabase = createSupabaseServiceClient();
  const replacementRewardDefinitionId = input.replacementRewardDefinitionId?.trim() || null;

  const updateDefinition = await supabase
    .from("lottery_reward_definitions")
    .update({
      is_active: false,
      deleted_at: new Date().toISOString(),
      replacement_reward_definition_id:
        replacementRewardDefinitionId && isValidUuid(replacementRewardDefinitionId)
          ? replacementRewardDefinitionId
          : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", rewardId)
    .select("id")
    .maybeSingle();

  failIfError(updateDefinition.error, "archive lottery_reward_definition");
  if (!updateDefinition.data) {
    return false;
  }

  if (replacementRewardDefinitionId && isValidUuid(replacementRewardDefinitionId)) {
    const rulesUpdate = await supabase
      .from("lottery_reward_rules")
      .update({
        reward_definition_id: replacementRewardDefinitionId,
        updated_at: new Date().toISOString(),
      })
      .eq("reward_definition_id", rewardId)
      .eq("is_active", true);

    failIfError(rulesUpdate.error, "reassign lottery_reward_rules");
  } else {
    const deactivateRules = await supabase
      .from("lottery_reward_rules")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("reward_definition_id", rewardId)
      .eq("is_active", true);

    failIfError(deactivateRules.error, "deactivate lottery_reward_rules");
  }

  return true;
}

export async function listLotteryRewardRulesFromSupabase(): Promise<LotteryRewardRule[]> {
  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("lottery_reward_rules")
    .select("*,lottery_reward_definitions(*),lottery_album_pages(" + ALBUM_PAGE_SELECT + ")")
    .order("sticker_rarity", { ascending: true })
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true });

  failIfError(result.error, "list lottery_reward_rules");
  const rows = Array.isArray(result.data) ? ((result.data as unknown) as Record<string, unknown>[]) : [];
  return rows.map((row) => mapRewardRuleRow(row));
}

export async function upsertLotteryRewardRuleInSupabase(input: {
  ruleId?: string;
  stickerRarity: LotteryStickerRarity;
  stickersRequired: number;
  rewardDefinitionId: string;
  albumPageId?: string | null;
  isActive: boolean;
  priority: number;
}): Promise<LotteryRewardRule> {
  const supabase = createSupabaseServiceClient();
  const ruleId = input.ruleId?.trim();
  const payload = {
    sticker_rarity: input.stickerRarity,
    stickers_required: Math.max(1, Math.min(100, Math.floor(input.stickersRequired))),
    reward_definition_id: input.rewardDefinitionId.trim(),
    album_page_id: input.albumPageId?.trim() || null,
    is_active: input.isActive === true,
    priority: Math.max(1, Math.floor(input.priority)),
    updated_at: new Date().toISOString(),
  };

  const result =
    ruleId && isValidUuid(ruleId)
      ? await supabase
          .from("lottery_reward_rules")
          .update(payload)
          .eq("id", ruleId)
          .select("*,lottery_reward_definitions(*),lottery_album_pages(" + ALBUM_PAGE_SELECT + ")")
          .single()
      : await supabase
          .from("lottery_reward_rules")
          .insert(payload)
          .select("*,lottery_reward_definitions(*),lottery_album_pages(" + ALBUM_PAGE_SELECT + ")")
          .single();

  const ruleRow = result.data as unknown;
  failIfError(result.error, "upsert lottery_reward_rule");
  if (!ruleRow || typeof ruleRow !== "object" || Array.isArray(ruleRow)) {
    throw new Error("Regle loterie introuvable apres sauvegarde.");
  }

  return mapRewardRuleRow(ruleRow as Record<string, unknown>);
}

export async function deactivateLotteryRewardRuleInSupabase(ruleId: string): Promise<boolean> {
  const safeRuleId = ruleId.trim();
  if (!isValidUuid(safeRuleId)) {
    return false;
  }

  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("lottery_reward_rules")
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", safeRuleId)
    .select("id")
    .maybeSingle();

  failIfError(result.error, "deactivate lottery_reward_rule");
  return Boolean(result.data);
}

export async function mintLotteryTicketsForOrderInSupabase(input: {
  userId: string;
  orderId: string;
  orderAmount: number;
  bonusTicketCount?: number;
}): Promise<number> {
  const userId = input.userId.trim();
  const orderId = input.orderId.trim();
  if (!isValidUuid(userId) || !orderId) {
    return 0;
  }

  const supabase = createSupabaseServiceClient();
  const result = await supabase.rpc("rpc_mint_lottery_tickets", {
    p_user_id: userId,
    p_order_id: orderId,
    p_order_amount: toMoney(input.orderAmount),
    p_bonus_ticket_count: Math.max(0, Math.floor(input.bonusTicketCount ?? 0)),
  });

  failIfError(result.error, "rpc_mint_lottery_tickets");
  return Math.max(0, toInteger(result.data, 0));
}

export async function grantLotteryTicketsToCustomerInSupabase(input: {
  userId: string;
  ticketCount: number;
  reason: string;
  adminEmail: string;
}): Promise<number> {
  const userId = input.userId.trim();
  if (!isValidUuid(userId)) {
    throw new Error("Client invalide.");
  }

  const supabase = createSupabaseServiceClient();
  const result = await supabase.rpc("rpc_admin_grant_lottery_tickets", {
    p_user_id: userId,
    p_ticket_count: Math.floor(input.ticketCount),
    p_reason: toText(input.reason).trim() || null,
    p_admin_email: toText(input.adminEmail).trim() || null,
  });

  if (result.error) {
    const message = result.error.message || "Attribution tickets impossible.";
    if (message.includes("customer_not_found")) {
      throw new Error("Client introuvable.");
    }
    if (message.includes("invalid_ticket_count")) {
      throw new Error("Nombre de tickets invalide (1-200).");
    }
    throw new Error(`[supabase:rpc_admin_grant_lottery_tickets] ${message}`);
  }

  return Math.max(0, toInteger(result.data, 0));
}

/* â”€â”€â”€ Welcome Pack (one-shot free pack) â”€â”€â”€ */

export async function getWelcomePackStatusFromSupabase(userId: string): Promise<{ eligible: boolean }> {
  if (!isValidUuid(userId)) {
    return { eligible: false };
  }

  const supabase = createSupabaseServiceClient();
  const { data } = await supabase
    .from("lottery_welcome_pack_claims")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  return { eligible: !data };
}

export async function claimWelcomePackInSupabase(userId: string): Promise<{ granted: boolean }> {
  if (!isValidUuid(userId)) {
    throw new Error("Client invalide.");
  }

  const supabase = createSupabaseServiceClient();
  const result = await supabase.rpc("rpc_claim_welcome_pack", {
    p_user_id: userId,
  });

  if (result.error) {
    const message = result.error.message || "RÃ©clamation du pack impossible.";
    if (message.includes("customer_not_found")) {
      throw new Error("Client introuvable.");
    }
    throw new Error(`[supabase:rpc_claim_welcome_pack] ${message}`);
  }

  return { granted: result.data === true };
}

export async function purchaseLotteryPacksWithPointsInSupabase(input: {
  userId: string;
  packCount: number;
  basePoints: number;
}): Promise<number> {
  const userId = input.userId.trim();
  if (!isValidUuid(userId)) {
    throw new Error("Client invalide.");
  }

  const supabase = createSupabaseServiceClient();
  const result = await supabase.rpc("rpc_purchase_lottery_packs_with_points", {
    p_user_id: userId,
    p_pack_count: Math.floor(input.packCount),
    p_cost_per_pack: LOTTERY_POINTS_PACK_COST,
    p_base_points: Math.max(0, Math.floor(input.basePoints)),
  });

  if (result.error) {
    const message = result.error.message || "Achat packs impossible.";
    if (message.includes("customer_not_found")) {
      throw new Error("Client introuvable.");
    }
    if (message.includes("invalid_pack_count")) {
      throw new Error(
        `Nombre de packs invalide (1-${LOTTERY_POINTS_PACK_MAX_PER_PURCHASE}).`,
      );
    }
    if (message.includes("insufficient_points")) {
      throw new Error("Points insuffisants.");
    }
    if (message.includes("invalid_cost_per_pack")) {
      throw new Error("Configuration achat packs invalide.");
    }
    throw new Error(`[supabase:rpc_purchase_lottery_packs_with_points] ${message}`);
  }

  return Math.max(0, toInteger(result.data, 0));
}

export async function getLotteryTicketsForCustomerFromSupabase(userId: string): Promise<LotteryTicket[]> {
  const safeUserId = userId.trim();
  if (!isValidUuid(safeUserId)) {
    return [];
  }

  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("lottery_tickets")
    .select(SELECT_TICKET_COLUMNS)
    .eq("user_id", safeUserId)
    .order("created_at", { ascending: false });

  failIfError(result.error, "list lottery_tickets by user");
  const rows = (result.data ?? []) as Record<string, unknown>[];
  const scratchedTicketIds = rows
    .map((row) => toText(row.id))
    .filter((value) => Boolean(value));
  const cardIds = new Set<string>();
  for (const row of rows) {
    const cardId = toNullableText(row.card_definition_id);
    if (cardId) {
      cardIds.add(cardId);
    }
  }

  const ticketCardMap = new Map<string, Array<{ definitionId: string; packSlot: number }>>();
  if (scratchedTicketIds.length > 0) {
    const instanceResult = await supabase
      .from("lottery_card_instances")
      .select("ticket_id,pack_slot,card_definition_id")
      .eq("user_id", safeUserId)
      .in("ticket_id", scratchedTicketIds);

    failIfError(instanceResult.error, "list lottery_card_instances for tickets");
    for (const raw of instanceResult.data ?? []) {
      const row = raw as Record<string, unknown>;
      const ticketId = toText(row.ticket_id);
      const definitionId = toText(row.card_definition_id);
      if (!ticketId || !definitionId) {
        continue;
      }
      cardIds.add(definitionId);
      const current = ticketCardMap.get(ticketId) ?? [];
      current.push({
        definitionId,
        packSlot: Math.max(1, toInteger(row.pack_slot, current.length + 1)),
      });
      ticketCardMap.set(ticketId, current);
    }
  }

  const cardMap = new Map<string, LotteryCardDefinition>();
  if (cardIds.size > 0) {
    const cardResult = await supabase
      .from("lottery_card_definitions")
      .select("*,lottery_card_collections(*)")
      .in("id", [...cardIds]);

    failIfError(cardResult.error, "list lottery_card_definitions for tickets");
    for (const raw of cardResult.data ?? []) {
      const definition = mapCardDefinitionRow(raw as Record<string, unknown>);
      cardMap.set(definition.id, definition);
    }
  }

  const ownedCountByDefinition = new Map<string, number>();
  for (const entries of ticketCardMap.values()) {
    for (const entry of entries) {
      ownedCountByDefinition.set(entry.definitionId, (ownedCountByDefinition.get(entry.definitionId) ?? 0) + 1);
    }
  }

  return rows.map((row) => {
    const ticket = mapTicketRow(row, cardMap.get(toText(row.card_definition_id)));
    const cards = (ticketCardMap.get(ticket.id) ?? [])
      .sort((left, right) => left.packSlot - right.packSlot)
      .map((entry) => {
        const definition = cardMap.get(entry.definitionId);
        if (!definition) {
          return null;
        }

        return buildCollectedCard(definition, {
          ownedCount: Math.max(1, ownedCountByDefinition.get(entry.definitionId) ?? 1),
        });
      })
      .filter((value): value is LotteryCollectedCard => value !== null);

    return cards.length > 0 ? { ...ticket, cards } : ticket;
  });
}

export async function getLotteryInventoryForCustomerFromSupabase(userId: string): Promise<LotteryInventory> {
  const safeUserId = userId.trim();
  if (!isValidUuid(safeUserId)) {
    return {
      collection: null,
      cards: [],
      totalCards: 0,
      uniqueOwned: 0,
      totalOwnedCopies: 0,
      duplicateCopies: 0,
      completionPercent: 0,
      byRarity: CARD_RARITIES.map((rarity) => ({
        rarity,
        totalCards: 0,
        ownedUnique: 0,
        ownedCopies: 0,
      })),
      availableClaims: [],
      earnedLines: [],
      recentLines: [],
      frozenLines: [],
    };
  }

  const supabase = createSupabaseServiceClient();
  const [collectionResult, definitionsResult, instancesResult, burnLogsResult, completionsResult] = await Promise.all([
    supabase
      .from("lottery_card_collections")
      .select(SELECT_CARD_COLLECTION_COLUMNS)
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("lottery_card_definitions")
      .select("*,lottery_card_collections(*)")
      .order("card_number", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("lottery_card_instances")
      .select("card_definition_id,created_at")
      .eq("user_id", safeUserId),
    supabase
      .from("lottery_collection_burn_log")
      .select("reward_claim_id")
      .eq("user_id", safeUserId),
    supabase
      .from("lottery_collection_page_completions")
      .select("reward_claim_id")
      .eq("user_id", safeUserId),
  ]);

  failIfError(collectionResult.error, "read lottery_card_collections inventory");
  failIfError(definitionsResult.error, "list lottery_card_definitions inventory");
  failIfError(instancesResult.error, "list lottery_card_instances inventory");

  const collection = collectionResult.data
    ? mapCardCollectionRow(collectionResult.data as Record<string, unknown>)
    : null;
  const definitions = (definitionsResult.data ?? []).map((row) => mapCardDefinitionRow(row as Record<string, unknown>));
  const ownedStats = new Map<string, { ownedCount: number; firstOwnedAt?: string; lastOwnedAt?: string }>();
  for (const raw of instancesResult.data ?? []) {
    const row = raw as Record<string, unknown>;
    const definitionId = toText(row.card_definition_id);
    const createdAt = toText(row.created_at, new Date().toISOString());
    const current = ownedStats.get(definitionId) ?? { ownedCount: 0 };
    current.ownedCount += 1;
    current.firstOwnedAt =
      !current.firstOwnedAt || createdAt < current.firstOwnedAt ? createdAt : current.firstOwnedAt;
    current.lastOwnedAt =
      !current.lastOwnedAt || createdAt > current.lastOwnedAt ? createdAt : current.lastOwnedAt;
    ownedStats.set(definitionId, current);
  }

  const cards = definitions.map((definition) => buildCollectedCard(definition, ownedStats.get(definition.id)));
  const totalOwnedCopies = cards.reduce((sum, card) => sum + card.ownedCount, 0);
  const uniqueOwned = cards.filter((card) => card.isOwned).length;
  const totalCards = cards.length;
  const duplicateCopies = Math.max(0, totalOwnedCopies - uniqueOwned);
  const completionPercent = totalCards > 0 ? Math.round((uniqueOwned / totalCards) * 100) : 0;

  // Collect all claim IDs from burn logs and page completions
  const allClaimIds = new Set<string>();
  for (const raw of (burnLogsResult.data ?? []) as Record<string, unknown>[]) {
    const claimId = toNullableText(raw.reward_claim_id);
    if (claimId) allClaimIds.add(claimId);
  }
  for (const raw of (completionsResult.data ?? []) as Record<string, unknown>[]) {
    const claimId = toNullableText(raw.reward_claim_id);
    if (claimId) allClaimIds.add(claimId);
  }

  // Fetch available claims
  const availableClaims: LotteryRewardClaim[] = [];
  if (allClaimIds.size > 0) {
    const claimsResult = await supabase
      .from("lottery_reward_claims")
      .select(SELECT_REWARD_CLAIM_COLUMNS)
      .in("id", Array.from(allClaimIds))
      .eq("status", "available");
    if (claimsResult.data) {
      for (const raw of claimsResult.data as Record<string, unknown>[]) {
        availableClaims.push(mapRewardClaimRow(raw));
      }
    }
  }

  return {
    collection,
    cards,
    totalCards,
    uniqueOwned,
    totalOwnedCopies,
    duplicateCopies,
    completionPercent,
    byRarity: CARD_RARITIES.map((rarity) => {
      const rarityCards = cards.filter((card) => card.rarity === rarity);
      return {
        rarity,
        totalCards: rarityCards.length,
        ownedUnique: rarityCards.filter((card) => card.isOwned).length,
        ownedCopies: rarityCards.reduce((sum, card) => sum + card.ownedCount, 0),
      };
    }),
    availableClaims,
    earnedLines: [],
    recentLines: [],
    frozenLines: [],
  };
}

export async function burnLotteryRewardLineInSupabase(input: {
  userId: string;
  lineId: string;
}): Promise<LotteryRewardClaim> {
  const userId = input.userId.trim();
  const lineId = input.lineId.trim();
  if (!isValidUuid(userId) || !isValidUuid(lineId)) {
    throw new Error("Ligne loterie invalide.");
  }

  const supabase = createSupabaseServiceClient();
  const result = await supabase.rpc("rpc_burn_lottery_reward_line", {
    p_line_id: lineId,
    p_user_id: userId,
  });

  if (result.error) {
    const message = result.error.message || "Burn loterie impossible.";
    if (message.includes("reward_line_not_found")) {
      throw new Error("lottery_reward_line_not_found");
    }
    if (message.includes("reward_line_unavailable")) {
      throw new Error("lottery_reward_line_unavailable");
    }
    if (message.includes("reward_line_frozen")) {
      throw new Error("lottery_reward_line_frozen");
    }
    throw new Error(`[supabase:rpc_burn_lottery_reward_line] ${message}`);
  }

  const claimRow =
    typeof result.data === "object" && result.data !== null
      ? (result.data as Record<string, unknown>)
      : null;
  if (!claimRow) {
    throw new Error("Bon loterie introuvable.");
  }

  return mapRewardClaimRow(claimRow);
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   TCG Collection Album â€” Supabase adapter
   â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export async function getCollectionAlbumForCustomerFromSupabase(
  userId: string,
): Promise<LotteryCollectionAlbum> {
  const safeUserId = userId.trim();
  const supabase = createSupabaseServiceClient();

  // 1. Fetch collection, definitions, instances, page completions, reward options, burn logs â€” in parallel
  const [
    collectionResult,
    definitionsResult,
    instancesResult,
    completionsResult,
    rewardOptionsResult,
    configResult,
    burnLogsResult,
  ] = await Promise.all([
    supabase
      .from("lottery_card_collections")
      .select(SELECT_CARD_COLLECTION_COLUMNS)
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("lottery_card_definitions")
      .select("*,lottery_card_collections(*)")
      .eq("is_active", true)
      .order("card_number", { ascending: true }),
    isValidUuid(safeUserId)
      ? supabase
          .from("lottery_card_instances")
          .select("id,card_definition_id,created_at")
          .eq("user_id", safeUserId)
      : Promise.resolve({ data: [] as Record<string, unknown>[], error: null }),
    isValidUuid(safeUserId)
      ? supabase
          .from("lottery_collection_page_completions")
          .select(SELECT_PAGE_COMPLETION_COLUMNS)
          .eq("user_id", safeUserId)
      : Promise.resolve({ data: [] as Record<string, unknown>[], error: null }),
    supabase
      .from("lottery_collection_page_reward_options")
      .select("*,lottery_reward_definitions(*)")
      .eq("is_active", true)
      .order("priority", { ascending: true }),
    supabase
      .from("lottery_game_config")
      .select("collection_title")
      .eq("id", 1)
      .maybeSingle(),
    isValidUuid(safeUserId)
      ? supabase
          .from("lottery_collection_burn_log")
          .select(SELECT_BURN_LOG_COLUMNS)
          .eq("user_id", safeUserId)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as Record<string, unknown>[], error: null }),
  ]);

  failIfError(collectionResult.error, "read lottery_card_collections album");
  failIfError(definitionsResult.error, "list lottery_card_definitions album");
  failIfError(configResult.error, "read lottery_game_config album title");
  if ("error" in instancesResult && instancesResult.error) {
    failIfError(instancesResult.error, "list lottery_card_instances album");
  }

  const collection = collectionResult.data
    ? mapCardCollectionRow(collectionResult.data as Record<string, unknown>)
    : null;
  const configuredCollectionTitle = toText(
    (configResult.data as Record<string, unknown> | null)?.collection_title,
    "",
  ).trim();
  const definitions = (definitionsResult.data ?? []).map((row) =>
    mapCardDefinitionRow(row as Record<string, unknown>),
  );

  // 2. Build ownership stats per definition + per-definition instance list (for burn)
  const ownedStats = new Map<string, { ownedCount: number; firstOwnedAt?: string; lastOwnedAt?: string }>();
  const instancesByDefinition = new Map<string, Array<{ instanceId: string; createdAt: string }>>();
  for (const raw of (instancesResult.data ?? []) as Record<string, unknown>[]) {
    const definitionId = toText(raw.card_definition_id);
    const instanceId = toText(raw.id);
    const createdAt = toText(raw.created_at, new Date().toISOString());
    const current = ownedStats.get(definitionId) ?? { ownedCount: 0 };
    current.ownedCount += 1;
    current.firstOwnedAt =
      !current.firstOwnedAt || createdAt < current.firstOwnedAt ? createdAt : current.firstOwnedAt;
    current.lastOwnedAt =
      !current.lastOwnedAt || createdAt > current.lastOwnedAt ? createdAt : current.lastOwnedAt;
    ownedStats.set(definitionId, current);
    const instances = instancesByDefinition.get(definitionId) ?? [];
    instances.push({ instanceId, createdAt });
    instancesByDefinition.set(definitionId, instances);
  }

  // 3. Build collected cards
  const cards = definitions.map((def) => buildCollectedCard(def, ownedStats.get(def.id)));

  // 4. Parse completions
  const completions = new Map<
    LotteryCardRarity,
    { completedAt: string; claimedAt?: string; rewardClaimId?: string; selectedRewardDefinitionId?: string }
  >();
  for (const raw of (completionsResult.data ?? []) as Record<string, unknown>[]) {
    const rarity = parseCardRarity(raw.page_rarity);
    completions.set(rarity, {
      completedAt: toText(raw.completed_at, new Date().toISOString()),
      claimedAt: toNullableText(raw.claimed_at),
      rewardClaimId: toNullableText(raw.reward_claim_id),
      selectedRewardDefinitionId: toNullableText(raw.selected_reward_definition_id),
    });
  }

  // 5. Parse reward options by page rarity
  const rewardOptionsByRarity = new Map<LotteryCardRarity, LotteryCollectionPageRewardOption[]>();
  for (const raw of (rewardOptionsResult.data ?? []) as Record<string, unknown>[]) {
    const rarity = parseCardRarity(raw.page_rarity);
    const rewardRow =
      raw.lottery_reward_definitions && typeof raw.lottery_reward_definitions === "object"
        ? (raw.lottery_reward_definitions as Record<string, unknown>)
        : null;
    if (!rewardRow) continue;
    const list = rewardOptionsByRarity.get(rarity) ?? [];
    list.push({
      rewardDefinitionId: toText(rewardRow.id),
      code: toText(rewardRow.code),
      title: toText(rewardRow.title),
      description: toText(rewardRow.description),
      kind: parseRewardKind(rewardRow.kind),
      imageUrl: toText(rewardRow.image_url),
      discountPercent: rewardRow.discount_percent != null ? toNumber(rewardRow.discount_percent) : undefined,
      giftWeightGrams: rewardRow.gift_weight_grams != null ? toNumber(rewardRow.gift_weight_grams) : undefined,
      giftProductSku: toNullableText(rewardRow.gift_product_sku),
      giftLabel: toNullableText(rewardRow.gift_label),
      customPayload: (rewardRow.custom_payload && typeof rewardRow.custom_payload === "object"
        ? rewardRow.custom_payload
        : {}) as Record<string, unknown>,
      priority: toInteger(raw.priority, 100),
      isActive: raw.is_active === true,
    });
    rewardOptionsByRarity.set(rarity, list);
  }

  // 6. Parse burn logs â†’ collect claim IDs by rarity
  const burnClaimsByRarity = new Map<LotteryCardRarity, string[]>();
  for (const raw of (burnLogsResult.data ?? []) as Record<string, unknown>[]) {
    const rarity = parseCardRarity(raw.rarity);
    const claimId = toNullableText(raw.reward_claim_id);
    if (claimId) {
      const list = burnClaimsByRarity.get(rarity) ?? [];
      list.push(claimId);
      burnClaimsByRarity.set(rarity, list);
    }
  }

  // 7. Collect all claim IDs and fetch available claims
  const allClaimIds = new Set<string>();
  for (const comp of completions.values()) {
    if (comp.rewardClaimId) allClaimIds.add(comp.rewardClaimId);
  }
  for (const ids of burnClaimsByRarity.values()) {
    for (const id of ids) allClaimIds.add(id);
  }

  const claimMap = new Map<string, LotteryRewardClaim>();
  if (allClaimIds.size > 0) {
    const claimsResult = await supabase
      .from("lottery_reward_claims")
      .select(SELECT_REWARD_CLAIM_COLUMNS)
      .in("id", Array.from(allClaimIds))
      .eq("status", "available");
    if (claimsResult.data) {
      for (const raw of claimsResult.data as Record<string, unknown>[]) {
        const claim = mapRewardClaimRow(raw);
        claimMap.set(claim.id, claim);
      }
    }
  }

  // 8. Build pages
  const pages: LotteryCollectionPageState[] = LOTTERY_COLLECTION_PAGE_ORDER.map((rarity) => {
    const meta = LOTTERY_COLLECTION_PAGE_META[rarity];
    const pageCards = cards.filter((c) => c.rarity === rarity);
    const totalSlots = pageCards.length;
    const ownedUnique = pageCards.filter((c) => c.isOwned).length;
    const ownedCopies = pageCards.reduce((sum, c) => sum + c.ownedCount, 0);
    const duplicateCopies = Math.max(0, ownedCopies - ownedUnique);
    const missingCount = totalSlots - ownedUnique;
    const completionPercent = totalSlots > 0 ? Math.round((ownedUnique / totalSlots) * 100) : 0;
    const isComplete = totalSlots > 0 && ownedUnique >= totalSlots;

    const comp = completions.get(rarity);

    // Reward status
    let rewardStatus: LotteryCollectionRewardStatus = "locked";
    if (comp?.claimedAt) {
      rewardStatus = "claimed";
    } else if (isComplete) {
      rewardStatus = "claimable";
    }

    // Burn offer (only for burnable rarities)
    const burnOffer = isBurnableRarity(rarity) ? LOTTERY_DUPLICATE_BURN_RULES[rarity] : null;

    // Slots
    const slots: LotteryCollectionCardSlot[] = pageCards.map((card, idx) => {
      const instances = instancesByDefinition.get(card.id) ?? [];
      // Sort oldest first; first copy is "kept", rest are burnable
      const sorted = [...instances].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const burnableInstances = sorted.slice(1);
      return {
        slotIndex: idx + 1,
        cardDefinitionId: card.id,
        code: card.code,
        cardNumber: card.cardNumber,
        name: card.name,
        rarity: card.rarity,
        imageUrl: card.imageUrl,
        description: card.description,
        isOwned: card.isOwned,
        ownedCount: card.ownedCount,
        burnableCount: burnableInstances.length,
        burnableInstanceIds: burnableInstances.map((i) => i.instanceId),
        firstOwnedAt: card.firstOwnedAt,
        lastOwnedAt: card.lastOwnedAt,
      };
    });

    // Duplicate groups (cards with burnableCount > 0, burnable rarities only)
    const duplicateGroups: LotteryDuplicateGroup[] = isBurnableRarity(rarity)
      ? slots
          .filter((s) => s.burnableCount > 0)
          .map((s) => ({
            cardDefinitionId: s.cardDefinitionId,
            code: s.code,
            cardNumber: s.cardNumber,
            name: s.name,
            rarity: rarity as LotteryBurnableRarity,
            imageUrl: s.imageUrl,
            duplicateCount: s.burnableCount,
            burnableInstanceIds: s.burnableInstanceIds,
          }))
      : [];

    return {
      rarity,
      pageNumber: meta.pageNumber,
      label: meta.label,
      title: meta.title,
      totalSlots,
      ownedUnique,
      missingCount,
      duplicateCopies,
      completionPercent,
      isComplete,
      rewardStatus,
      completedAt: comp?.completedAt,
      claimedAt: comp?.claimedAt,
      selectedRewardDefinitionId: comp?.selectedRewardDefinitionId,
      rewardClaimId: comp?.rewardClaimId,
      rewardOptions: rewardOptionsByRarity.get(rarity) ?? [],
      burnOffer,
      slots,
      duplicateGroups,
    };
  });

  // 9. Build available claims
  const availableClaims: LotteryCollectionAvailableClaim[] = [];
  for (const [rarity, comp] of completions.entries()) {
    if (comp.rewardClaimId) {
      const claim = claimMap.get(comp.rewardClaimId);
      if (claim) {
        availableClaims.push({ source: "page_completion", sourceRarity: rarity, claim });
      }
    }
  }
  for (const [rarity, claimIds] of burnClaimsByRarity.entries()) {
    for (const claimId of claimIds) {
      const claim = claimMap.get(claimId);
      if (claim) {
        availableClaims.push({ source: "duplicate_burn", sourceRarity: rarity, claim });
      }
    }
  }

  // 10. Summary
  const totalCards = cards.length;
  const uniqueOwned = cards.filter((c) => c.isOwned).length;
  const totalOwnedCopies = cards.reduce((sum, c) => sum + c.ownedCount, 0);
  const summary: LotteryCollectionAlbumSummary = {
    totalCards,
    ownedUnique: uniqueOwned,
    totalOwnedCopies,
    duplicateCopies: Math.max(0, totalOwnedCopies - uniqueOwned),
    completionPercent: totalCards > 0 ? Math.round((uniqueOwned / totalCards) * 100) : 0,
    completedPages: pages.filter((p) => p.isComplete).length,
    claimablePages: pages.filter((p) => p.rewardStatus === "claimable").length,
    availableClaims: availableClaims.length,
  };

  return {
    collectionId: collection?.id ?? "",
    collectionCode: collection?.code ?? "HEMP_HEROES_2026",
    collectionTitle:
      configuredCollectionTitle.length > 0
        ? configuredCollectionTitle
        : (collection?.title ?? "Kanab Quest Collection"),
    isActive: collection?.isActive ?? false,
    pageOrder: LOTTERY_COLLECTION_PAGE_ORDER,
    summary,
    pages,
    availableClaims,
    generatedAt: new Date().toISOString(),
  };
}

export async function claimCollectionPageRewardFromSupabase(input: {
  userId: string;
  pageRarity: LotteryCardRarity;
  rewardDefinitionId: string;
}): Promise<LotteryRewardClaim> {
  const userId = input.userId.trim();
  if (!isValidUuid(userId)) throw new Error("Identifiant utilisateur invalide.");
  if (!isValidUuid(input.rewardDefinitionId)) throw new Error("Identifiant de rÃ©compense invalide.");

  const supabase = createSupabaseServiceClient();
  const result = await supabase.rpc("rpc_claim_collection_page_reward", {
    p_user_id: userId,
    p_page_rarity: input.pageRarity,
    p_reward_definition_id: input.rewardDefinitionId,
  });

  if (result.error) {
    const msg = result.error.message || "";
    if (msg.includes("not_complete")) throw new Error("page_not_complete");
    if (msg.includes("already_claimed")) throw new Error("page_already_claimed");
    if (msg.includes("option_not_found") || msg.includes("definition_invalid"))
      throw new Error("invalid_reward_choice");
    throw new Error(`[supabase:rpc_claim_collection_page_reward] ${msg}`);
  }

  const claimRow =
    result.data && typeof result.data === "object" && !Array.isArray(result.data)
      ? (result.data as Record<string, unknown>)
      : null;
  if (!claimRow) {
    throw new Error("RÃ©ponse invalide du serveur (claim).");
  }

  return mapRewardClaimRow(claimRow);
}

export async function burnDuplicateCardsFromSupabase(input: {
  userId: string;
  rarity: LotteryBurnableRarity;
  instanceIds: string[];
  rewardChoice: LotteryDuplicateBurnChoice;
  discountPercent: number;
  giftWeightGrams: number;
}): Promise<LotteryRewardClaim> {
  const userId = input.userId.trim();
  if (!isValidUuid(userId)) throw new Error("Identifiant utilisateur invalide.");
  for (const id of input.instanceIds) {
    if (!isValidUuid(id)) throw new Error("Identifiant d'instance invalide.");
  }

  const supabase = createSupabaseServiceClient();
  const result = await supabase.rpc("rpc_burn_duplicate_cards", {
    p_user_id: userId,
    p_rarity: input.rarity,
    p_instance_ids: input.instanceIds,
    p_reward_kind: input.rewardChoice === "gift" ? "gift_weight_grams" : "discount_percent",
    p_discount_percent: input.discountPercent,
    p_gift_weight_grams: input.giftWeightGrams,
    p_gift_label: `${input.giftWeightGrams}g offerts`,
  });

  if (result.error) {
    const msg = result.error.message || "";
    if (msg.includes("reward_kind_invalid")) throw new Error("burn_reward_kind_invalid");
    if (msg.includes("discount_invalid")) throw new Error("burn_discount_invalid");
    if (msg.includes("gift_invalid")) throw new Error("burn_gift_invalid");
    if (msg.includes("legendary")) throw new Error("burn_legendary_not_allowed");
    if (msg.includes("exactly")) throw new Error("wrong_instance_count");
    if (msg.includes("last_copy")) throw new Error("burn_would_remove_last_copy");
    if (msg.includes("invalid")) throw new Error("invalid_instances");
    throw new Error(`[supabase:rpc_burn_duplicate_cards] ${msg}`);
  }

  const claimRow =
    result.data && typeof result.data === "object" && !Array.isArray(result.data)
      ? (result.data as Record<string, unknown>)
      : null;
  if (!claimRow) {
    throw new Error("RÃ©ponse invalide du serveur (burn claim).");
  }

  return mapRewardClaimRow(claimRow);
}

export async function getRedeemableLotteryRewardClaimBenefitFromSupabase(input: {
  userId: string;
  claimId: string;
}): Promise<LotteryRewardClaimBenefit | null> {
  const userId = input.userId.trim();
  const claimId = input.claimId.trim();
  if (!isValidUuid(userId) || !isValidUuid(claimId)) {
    return null;
  }

  const supabase = createSupabaseServiceClient();
  await supabase.rpc("lottery_release_expired_claim_reservations", {
    p_user_id: userId,
  });

  const result = await supabase
    .from("lottery_reward_claims")
    .select(SELECT_REWARD_CLAIM_COLUMNS)
    .eq("id", claimId)
    .eq("user_id", userId)
    .maybeSingle();

  failIfError(result.error, "read lottery_reward_claim");
  if (!result.data) {
    return null;
  }

  const claim = mapRewardClaimRow(result.data as Record<string, unknown>);
  if (claim.status !== "available") {
    return null;
  }

  return buildClaimBenefit(claim);
}

export async function reserveLotteryRewardClaimForOrderInSupabase(input: {
  userId: string;
  claimId: string;
  orderId: string;
}): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const result = await supabase.rpc("rpc_reserve_lottery_reward_claim", {
    p_claim_id: input.claimId.trim(),
    p_user_id: input.userId.trim(),
    p_order_id: input.orderId.trim(),
    p_reservation_minutes: 120,
  });

  if (result.error) {
    const message = result.error.message || "Reservation lot impossible.";
    if (message.includes("reward_claim_not_found")) {
      throw new Error("lottery_reward_claim_not_found");
    }
    if (message.includes("reward_claim_unavailable") || message.includes("reward_claim_already_reserved")) {
      throw new Error("lottery_reward_claim_unavailable");
    }
    throw new Error(`[supabase:rpc_reserve_lottery_reward_claim] ${message}`);
  }
}

export async function consumeLotteryRewardClaimsForOrderInSupabase(orderId: string): Promise<number> {
  const safeOrderId = orderId.trim();
  if (!safeOrderId) {
    return 0;
  }

  const supabase = createSupabaseServiceClient();
  const result = await supabase.rpc("rpc_consume_lottery_reward_claims_for_order", {
    p_order_id: safeOrderId,
  });

  failIfError(result.error, "rpc_consume_lottery_reward_claims_for_order");
  return Math.max(0, toInteger(result.data, 0));
}

export async function releaseLotteryRewardClaimsForOrderInSupabase(orderId: string): Promise<number> {
  const safeOrderId = orderId.trim();
  if (!safeOrderId) {
    return 0;
  }

  const supabase = createSupabaseServiceClient();
  const result = await supabase.rpc("rpc_release_lottery_reward_claims_for_order", {
    p_order_id: safeOrderId,
  });

  failIfError(result.error, "rpc_release_lottery_reward_claims_for_order");
  return Math.max(0, toInteger(result.data, 0));
}

export async function scratchLotteryTicketInSupabase(input: {
  userId: string;
  ticketId: string;
}): Promise<ScratchResult> {
  const userId = input.userId.trim();
  const ticketId = input.ticketId.trim();
  if (!isValidUuid(userId) || !isValidUuid(ticketId)) {
    throw new Error("Ticket invalide.");
  }

  const supabase = createSupabaseServiceClient();
  const result = await supabase.rpc("rpc_scratch_ticket", {
    p_ticket_id: ticketId,
    p_user_id: userId,
  });

  if (result.error) {
    const message = result.error.message || "Erreur grattage.";
    if (message.includes("ticket_not_found_or_already_scratched")) {
      throw new Error("ticket_not_found_or_already_scratched");
    }
    throw new Error(`[supabase:rpc_scratch_ticket] ${message}`);
  }

  const payload = (result.data ?? null) as Record<string, unknown> | null;
  if (!payload) {
    throw new Error("Resultat de grattage introuvable.");
  }

  const cardRaw =
    typeof payload.card === "object" && payload.card !== null
      ? (payload.card as Record<string, unknown>)
      : {};
  const cardsRaw = Array.isArray(payload.cards)
    ? (payload.cards as Record<string, unknown>[])
    : cardRaw && Object.keys(cardRaw).length > 0
      ? [cardRaw]
      : [];
  const inventoryRaw =
    typeof payload.inventory === "object" && payload.inventory !== null
      ? (payload.inventory as Record<string, unknown>)
      : {};
  const cycleRaw =
    typeof payload.cycle === "object" && payload.cycle !== null
      ? (payload.cycle as Record<string, unknown>)
      : null;
  const cycleRemainingRaw =
    cycleRaw && typeof cycleRaw.remaining === "object" && cycleRaw.remaining !== null
      ? (cycleRaw.remaining as Record<string, unknown>)
      : null;
  const bonusRaw =
    typeof payload.bonusPrize === "object" && payload.bonusPrize !== null
      ? (payload.bonusPrize as Record<string, unknown>)
      : null;
  const bonusOptionsRaw = Array.isArray(bonusRaw?.options)
    ? (bonusRaw?.options as Record<string, unknown>[])
    : [];
  const scratchedAt = toText(payload.scratchedAt, new Date().toISOString());
  const cards = cardsRaw.map((raw) => mapScratchCardRow(raw, scratchedAt));
  const primaryCard = cards[0]
    ? cardRaw && Object.keys(cardRaw).length > 0
      ? mapScratchCardRow(cardRaw, scratchedAt, cards[0].ownedCount)
      : cards[0]
    : mapScratchCardRow(cardRaw, scratchedAt);

  return {
    ticketId: toText(payload.ticketId),
    ticketNumber: toText(payload.ticketNumber),
    scratchedAt,
    card: primaryCard,
    cards: cards.length > 0 ? cards : [primaryCard],
    inventory: {
      totalCards: Math.max(0, toInteger(inventoryRaw.totalCards, 0)),
      uniqueOwned: Math.max(0, toInteger(inventoryRaw.uniqueOwned, 0)),
      totalOwnedCopies: Math.max(0, toInteger(inventoryRaw.totalOwnedCopies, 0)),
      duplicateCopies: Math.max(0, toInteger(inventoryRaw.duplicateCopies, 0)),
      byRarity: {
        common: Math.max(0, toInteger(inventoryRaw.common, 0)),
        silver: Math.max(0, toInteger(inventoryRaw.silver, 0)),
        gold: Math.max(0, toInteger(inventoryRaw.gold, 0)),
        epic: Math.max(0, toInteger(inventoryRaw.epic, 0)),
        legendary: Math.max(0, toInteger(inventoryRaw.legendary, 0)),
      },
    },
    cycle: cycleRaw
      ? {
          cycleNumber: Math.max(1, toInteger(cycleRaw.cycleNumber, 1)),
          totalPacks: Math.max(1, toInteger(cycleRaw.totalPacks, 50000)),
          packsOpened: Math.max(0, toInteger(cycleRaw.packsOpened, 0)),
          remaining: {
            common: Math.max(0, toInteger(cycleRemainingRaw?.common, 0)),
            silver: Math.max(0, toInteger(cycleRemainingRaw?.silver, 0)),
            gold: Math.max(0, toInteger(cycleRemainingRaw?.gold, 0)),
            epic: Math.max(0, toInteger(cycleRemainingRaw?.epic, 0)),
            legendary: Math.max(0, toInteger(cycleRemainingRaw?.legendary, 0)),
          },
        }
      : undefined,
    bonusPrize: bonusRaw
      ? ({
          id: toText(bonusRaw.id),
          code: toText(bonusRaw.code),
          title: toText(bonusRaw.title),
          description: toText(bonusRaw.description),
          imageUrl: toText(bonusRaw.imageUrl),
          bonusInstanceId: toText(bonusRaw.bonusInstanceId),
          packSlot: Math.max(1, Math.min(3, toInteger(bonusRaw.packSlot, 1))),
          options: bonusOptionsRaw.map((item) =>
            mapBonusOptionRow({
              id: item.id,
              bonus_definition_id: item.bonusDefinitionId ?? item.bonus_definition_id ?? bonusRaw.id,
              label: item.label,
              kind: item.kind,
              gift_weight_grams: item.giftWeightGrams ?? item.gift_weight_grams,
              gift_product_sku: item.giftProductSku ?? item.gift_product_sku,
              gift_label: item.giftLabel ?? item.gift_label,
              custom_payload: item.customPayload ?? item.custom_payload,
              sort_order: item.sortOrder ?? item.sort_order,
              created_at: item.createdAt ?? item.created_at ?? scratchedAt,
              updated_at: item.updatedAt ?? item.updated_at ?? scratchedAt,
            }),
          ),
        } as LotteryBonusPrize)
      : undefined,
  };
}

export async function getLotteryStatsFromSupabase(): Promise<LotteryStats> {
  const supabase = createSupabaseServiceClient();
  const [
    totalTicketsResult,
    availableTicketsResult,
    scratchedTicketsResult,
    cardDefinitionsResult,
    cardInstancesResult,
    recentScratchesResult,
  ] = await Promise.all([
    supabase.from("lottery_tickets").select("id", { count: "exact", head: true }),
    supabase.from("lottery_tickets").select("id", { count: "exact", head: true }).eq("status", "available"),
    supabase.from("lottery_tickets").select("id", { count: "exact", head: true }).eq("status", "scratched"),
    supabase.from("lottery_card_definitions").select("id,rarity"),
    supabase.from("lottery_card_instances").select("card_definition_id"),
    supabase
      .from("lottery_tickets")
      .select("ticket_number,order_id,scratched_at,card_definition_id,card_rarity")
      .eq("status", "scratched")
      .order("scratched_at", { ascending: false })
      .limit(20),
  ]);

  failIfError(totalTicketsResult.error, "count lottery tickets total");
  failIfError(availableTicketsResult.error, "count lottery tickets available");
  failIfError(scratchedTicketsResult.error, "count lottery tickets scratched");
  failIfError(cardDefinitionsResult.error, "list lottery card definitions stats");
  failIfError(cardInstancesResult.error, "list lottery card instances stats");
  failIfError(recentScratchesResult.error, "list lottery recent scratches");

  const definedByRarity = buildEmptyCardCountByRarity();
  for (const raw of cardDefinitionsResult.data ?? []) {
    const row = raw as Record<string, unknown>;
    definedByRarity[parseCardRarity(row.rarity)] += 1;
  }

  const ownedCopiesByRarity = buildEmptyCardCountByRarity();
  const ownedUniqueByDefinition = new Set<string>();
  for (const raw of cardInstancesResult.data ?? []) {
    const row = raw as Record<string, unknown>;
    const definitionId = toText(row.card_definition_id);
    if (definitionId) {
      ownedUniqueByDefinition.add(definitionId);
    }
  }

  const cardDefinitionMap = new Map<string, LotteryCardRarity>();
  for (const raw of cardDefinitionsResult.data ?? []) {
    const row = raw as Record<string, unknown>;
    cardDefinitionMap.set(toText(row.id), parseCardRarity(row.rarity));
  }

  const ownedUniqueCountByRarity = buildEmptyCardCountByRarity();
  for (const definitionId of ownedUniqueByDefinition) {
    const rarity = cardDefinitionMap.get(definitionId);
    if (rarity) {
      ownedUniqueCountByRarity[rarity] += 1;
    }
  }

  for (const raw of cardInstancesResult.data ?? []) {
    const row = raw as Record<string, unknown>;
    const rarity = cardDefinitionMap.get(toText(row.card_definition_id));
    if (rarity) {
      ownedCopiesByRarity[rarity] += 1;
    }
  }

  const totalCardDefinitions = (cardDefinitionsResult.data ?? []).length;
  const uniqueCollectedCards = ownedUniqueByDefinition.size;
  const totalCollectedCopies = (cardInstancesResult.data ?? []).length;
  const completionPercent =
    totalCardDefinitions > 0 ? Math.round((uniqueCollectedCards / totalCardDefinitions) * 100) : 0;

  const recentRows = (recentScratchesResult.data ?? []) as Record<string, unknown>[];
  const recentCardIds = [
    ...new Set(
      recentRows
        .map((row) => toNullableText(row.card_definition_id))
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  const recentCardMap = new Map<string, LotteryCardDefinition>();
  if (recentCardIds.length > 0) {
    const recentCardResult = await supabase
      .from("lottery_card_definitions")
      .select("*,lottery_card_collections(*)")
      .in("id", recentCardIds);
    failIfError(recentCardResult.error, "list lottery card definitions recent");
    for (const raw of recentCardResult.data ?? []) {
      const definition = mapCardDefinitionRow(raw as Record<string, unknown>);
      recentCardMap.set(definition.id, definition);
    }
  }

  return {
    totalTickets: totalTicketsResult.count ?? 0,
    availableTickets: availableTicketsResult.count ?? 0,
    scratchedTickets: scratchedTicketsResult.count ?? 0,
    totalCollectedCopies,
    uniqueCollectedCards,
    totalCardDefinitions,
    completionPercent,
    byCardRarity: CARD_RARITIES.map((rarity) => ({
      rarity,
      defined: definedByRarity[rarity],
      ownedUnique: ownedUniqueCountByRarity[rarity],
      ownedCopies: ownedCopiesByRarity[rarity],
    })),
    recentScratches: recentRows.map((raw) => {
      const row = raw as Record<string, unknown>;
      const card = recentCardMap.get(toText(row.card_definition_id));
      return {
        ticketNumber: toText(row.ticket_number),
        orderId: toNullableText(row.order_id),
        scratchedAt: toText(row.scratched_at, new Date().toISOString()),
        cardName: card?.name,
        cardNumber: card?.cardNumber,
        cardRarity: row.card_rarity ? parseCardRarity(row.card_rarity) : card?.rarity,
      };
    }),
  };
}
