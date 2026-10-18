import "server-only";
import { createHash } from "node:crypto";
import { KQ_BUDDIE_ROTATION_REQUIRED, getKqBuddieRotationRemaining, getKqBuddieRotationMessage, recordKqBuddieUse, type KqBuddieRotation } from "@/lib/kanab-quest-buddie-rotation";
import { getArenaRankingAvatars } from "./arena-ranking-avatars";
import { getChanvrierStartingXp } from "@/lib/arena-chanvrier";
import { cacheArenaSharedRead } from "@/lib/arena-shared-cache";
import { arenaPublicPlayerKey } from "@/lib/arena-public-player-key";
import { isKqEnergyMode, type KqEnergyMode } from "@/lib/kanab-quest-energy";

import { normalizeEmail } from "@/lib/admin-allowlist";
import { activateKqHeritage, advanceKqStage, canPlayKqCard, getKqHarvestTier, isKqCultureDead, KQ_BUDDIES, KQ_CARDS, KQ_SITUATIONS, KQ_STAGES, playKqCard, redrawKqHand, resolveKqStage, rollKqDice, startKqGame, swapKqHeritageHandCard, type KqGameState } from "@/lib/kanab-quest-game";
import { getKqWarehouseRunSnapshot } from "./kanab-quest-warehouse-backend";
import { encodeKqSave, parseKqGameSave } from "@/lib/kanab-quest-persistence";
import { createKqFlower, createKqOpponent, invertKqBattlePerspective, lockKqBattle, resolveKqBattle, type KqBattle, type KqFlowerCard } from "@/lib/kanab-quest-battle";
import { KQ_BATTLE_HISTORY_LIMIT, selectKqBattleHistory } from "@/lib/kanab-quest-battle-history-policy";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import { getKqArenaExperienceAward, getKqLeague } from "@/lib/kanab-quest-ranking";
import { evaluateKqChallenges, getKqChallengeDayKey } from "@/lib/kanab-quest-challenges";
import { getKqNotebookReward, KQ_CULTURE_TOKEN_RUN_CAP, KQ_CULTURE_TOKEN_START_XP, KQ_NOTEBOOK_REWARDS_LIVE } from "@/lib/kanab-quest-notebook-rewards";
import { isKqHeritageEffect, isKqHeritageTiming, type KqHeritageCard } from "@/lib/kanab-quest-heritage";
import { KQ_HERITAGE_PURCHASE_DRAWS_LIVE } from "@/lib/kanab-quest-heritage-purchase";
import { buildKqSeasonRewardPreview, KQ_SEASON_REWARDS_LIVE } from "@/lib/kanab-quest-season-rewards";
import { isKqPublicPlayerApiEnabled } from "@/lib/kanab-quest-player-access";
import { LOTTERY_POINTS_PACK_MAX_PER_PURCHASE } from "@/lib/lottery-collection";
import { KQ_SUPPORT_BOOSTER_POINTS_COST } from "@/lib/kanab-quest-booster";
import { auditKqEquipmentCatalog, isKqProcessingEquipment, type KqEquipmentCatalogRow } from "@/lib/kanab-quest-equipment";
import { getKqEquipmentShopSnapshot } from "@/lib/supabase/kanab-quest-equipment-backend";
import { getKqEffectiveTentProfiles } from "@/lib/kanab-quest-production";
import type { KqBusinessState } from "@/lib/kanab-quest-business";
import { getKqLaunchApprovalChecks, getKqLaunchApprovals, getKqLaunchDossier, type KqLaunchApprovals, type KqLaunchDossier } from "@/lib/kanab-quest-launch-approvals";
import { buildKqRandomQueueHealth, type KqRandomQueueHealth } from "@/lib/kanab-quest-random-queue";
import { KQ_PRODUCER_NOTEBOOK_REWARDS_LIVE } from "@/lib/kanab-quest-producer-rewards";
import { calculateKqPlacardScore } from "@/lib/kanab-quest-reputation";
import { ARENA_FORMULA_VERSION, type ArenaRankingCategory } from "@/lib/arena-ranking";
import { KQ_REWARD_BALANCE } from "@/lib/kanab-quest-reward-balance";
import { KQ_ACTIVE_CARDS } from "@/lib/kanab-quest-game";
import { getKqCampaignParticipants, getKqCampaignTotals, getKqCampaignMemberState, type KqCampaignMember } from "@/lib/kanab-quest-campaign";

const BOTTE_COLLECTION_CODE = "BOTTE_DU_CHANVRIER_2026";
const KQ_INITIAL_SEASON_CODE = "KQ-2026-S1";
let kqActiveSeasonCache: { expiresAt: number; promise: Promise<string> } | null = null;
const kqReferenceCache = new Map<string, { expiresAt: number; promise: Promise<unknown> }>();

function loadCachedKqReference<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const cached = kqReferenceCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.promise as Promise<T>;
  const promise = loader();
  kqReferenceCache.set(key, { expiresAt: Date.now() + ttlMs, promise });
  void promise.catch(() => {
    if (kqReferenceCache.get(key)?.promise === promise) kqReferenceCache.delete(key);
  });
  return promise;
}

export type KqSupportBoosterShopSnapshot = {
  collectionActive: boolean;
  costPerPack: number;
  availableEntitlements: Array<{ id: string; source: string; cardCount: number; createdAt: string }>;
  welcomeClaimed: boolean;
};

export async function getKqSupportBoosterShopSnapshot(userId: string): Promise<KqSupportBoosterShopSnapshot> {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error("Compte Kanab Quest invalide.");
  const supabase = createSupabaseServiceClient();
  const [catalog, entitlements] = await Promise.all([
    getCachedKqBotteCatalog(),
    supabase.from("kq_support_booster_entitlements").select("id,source,status,card_count,created_at")
      .eq("user_id", userId).order("created_at", { ascending: true }),
  ]);
  if (entitlements.error) throw new Error(`[supabase:kq_support_booster_entitlements] ${entitlements.error.message}`);
  return {
    collectionActive: catalog.collection.is_active,
    costPerPack: KQ_SUPPORT_BOOSTER_POINTS_COST,
    availableEntitlements: (entitlements.data ?? []).filter((row) => row.status === "available").map((row) => ({
      id: String(row.id),
      source: String(row.source),
      cardCount: Number(row.card_count ?? 10),
      createdAt: String(row.created_at),
    })),
    welcomeClaimed: (entitlements.data ?? []).some((row) => row.source === "welcome_pack"),
  };
}

export async function claimKqWelcomeSupportBooster(userId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error("Compte Kanab Quest invalide.");
  const result = await createSupabaseServiceClient().rpc("rpc_kq_claim_welcome_support_booster", {
    p_user_id: userId,
  });
  if (result.error) {
    const message = result.error.message || "Booster de bienvenue indisponible.";
    if (message.includes("support_collection_unavailable")) throw new Error("La collection Botte du Chanvrier n’est pas encore active.");
    throw new Error(`[supabase:rpc_kq_claim_welcome_support_booster] ${message}`);
  }
  return result.data as { entitlementId: string; claimed: boolean; replayed: boolean; status: string };
}

export async function purchaseKqSupportBoostersWithPoints(input: {
  userId: string;
  requestKey: string;
  packCount: number;
  basePoints: number;
}) {
  if (!/^[0-9a-f-]{36}$/i.test(input.userId) || !/^[0-9a-f-]{36}$/i.test(input.requestKey)) {
    throw new Error("Demande d’achat invalide.");
  }
  const packCount = Math.floor(input.packCount);
  if (packCount < 1 || packCount > LOTTERY_POINTS_PACK_MAX_PER_PURCHASE) {
    throw new Error(`Nombre de packs invalide (1-${LOTTERY_POINTS_PACK_MAX_PER_PURCHASE}).`);
  }
  const result = await createSupabaseServiceClient().rpc("rpc_kq_purchase_support_boosters_with_points", {
    p_user_id: input.userId,
    p_request_key: input.requestKey,
    p_pack_count: packCount,
    p_cost_per_pack: KQ_SUPPORT_BOOSTER_POINTS_COST,
    p_base_points: Math.max(0, Math.floor(input.basePoints)),
  });
  if (result.error) {
    const message = result.error.message || "Achat Botte du Chanvrier impossible.";
    if (message.includes("insufficient_points")) throw new Error("Points insuffisants.");
    if (message.includes("support_collection_unavailable")) throw new Error("La boutique Botte du Chanvrier n’est pas encore active.");
    throw new Error(`[supabase:rpc_kq_purchase_support_boosters_with_points] ${message}`);
  }
  return result.data as {
    purchaseId: string;
    granted: number;
    costPoints: number;
    spendablePoints: number;
    entitlementIds: string[];
    replayed: boolean;
  };
}

export async function openKqSupportBoosterEntitlement(userId: string, entitlementId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(userId) || !/^[0-9a-f-]{36}$/i.test(entitlementId)) {
    throw new Error("Booster Botte du Chanvrier invalide.");
  }
  const result = await createSupabaseServiceClient().rpc("rpc_kq_open_support_booster", {
    p_entitlement_id: entitlementId,
    p_user_id: userId,
  });
  if (result.error) {
    const message = result.error.message || "Ouverture Botte du Chanvrier impossible.";
    if (message.includes("unavailable")) throw new Error("Ce booster n’est plus disponible.");
    throw new Error(`[supabase:rpc_kq_open_support_booster] ${message}`);
  }
  return result.data as {
    entitlementId: string;
    openedAt: string;
    cards: Array<{ code: string; name: string; rarity: string; packSlot: number; imageUrl?: string }>;
  };
}

export async function getKqActiveSeasonCode() {
  if (kqActiveSeasonCache && kqActiveSeasonCache.expiresAt > Date.now()) {
    return kqActiveSeasonCache.promise;
  }
  const promise = (async () => {
    const result = await createSupabaseServiceClient().from("kq_seasons")
      .select("season_code").eq("status", "active").maybeSingle();
    if (result.error) throw new Error(`[supabase:kq_seasons:active] ${result.error.message}`);
    return result.data?.season_code ? String(result.data.season_code) : KQ_INITIAL_SEASON_CODE;
  })();
  kqActiveSeasonCache = { expiresAt: Date.now() + 30_000, promise };
  try {
    return await promise;
  } catch (error) {
    kqActiveSeasonCache = null;
    throw error;
  }
}

export type KqSeasonRolloverPreview = {
  fromSeason: string;
  toSeason: string | null;
  players: number;
  eligiblePlayers: number;
  missingRewardGrants: number;
  lockedBattles: number;
  ready: boolean;
  blockers: string[];
};

export function mapKqSeasonRolloverPreview(
  fromSeason: string,
  toSeason: string | null,
  data?: unknown,
): KqSeasonRolloverPreview {
  const payload = data && typeof data === "object" && !Array.isArray(data)
    ? data as Record<string, unknown>
    : {};
  const missingRewardGrants = Math.max(0, Number(payload.missingRewardGrants ?? 0));
  const lockedBattles = Math.max(0, Number(payload.lockedBattles ?? 0));
  const blockers = [
    ...(!toSeason ? ["Aucune prochaine saison planifiée"] : []),
    ...(missingRewardGrants > 0 ? [`${missingRewardGrants} récompense(s) de saison restent à attribuer`] : []),
    ...(lockedBattles > 0 ? [`${lockedBattles} duel(s) sont encore verrouillés`] : []),
  ];
  return {
    fromSeason,
    toSeason,
    players: Math.max(0, Number(payload.players ?? 0)),
    eligiblePlayers: Math.max(0, Number(payload.eligiblePlayers ?? 0)),
    missingRewardGrants,
    lockedBattles,
    ready: Boolean(toSeason) && payload.ready === true && blockers.length === 0,
    blockers,
  };
}

export async function getKqAdminSeasonRolloverPreview(): Promise<KqSeasonRolloverPreview> {
  const supabase = createSupabaseServiceClient();
  const seasonsResult = await supabase.from("kq_seasons")
    .select("season_code,status,starts_at")
    .in("status", ["active", "planned"])
    .order("starts_at", { ascending: true, nullsFirst: false });
  if (seasonsResult.error) throw new Error(`[supabase:kq_seasons] ${seasonsResult.error.message}`);
  const active = (seasonsResult.data ?? []).find((season) => season.status === "active");
  if (!active) throw new Error("Aucune saison Kanab Quest active.");
  const planned = (seasonsResult.data ?? []).find((season) => season.status === "planned");
  if (!planned) return mapKqSeasonRolloverPreview(String(active.season_code), null);
  const result = await supabase.rpc("rpc_kq_rollover_season", {
    p_from_season: String(active.season_code),
    p_to_season: String(planned.season_code),
    p_execute: false,
  });
  if (result.error) throw new Error(`[supabase:rpc_kq_rollover_season] ${result.error.message}`);
  return mapKqSeasonRolloverPreview(String(active.season_code), String(planned.season_code), result.data);
}

type CardDefinitionRow = {
  id: string;
  code: string;
  name: string;
  rarity: string;
  description: string;
  image_url: string;
  is_active: boolean;
};

export type KqAdminCollectionSnapshot = {
  collectionActive: boolean;
  ownerFound: boolean;
  cultureTokenBalance: number;
  inventory: Record<string, number>;
  availableInventory?: Record<string, number>;
  cards: Array<{
    code: string;
    name: string;
    rarity: string;
    description: string;
    imageUrl: string;
    isActive: boolean;
    ownedCopies: number;
  }>;
};

export type KqNotebookRewardPreview = {
  rewardsLive: boolean;
  unlockedBadges: number;
  alreadyGranted: number;
  pendingBadges: number;
  pendingSupportBoosters: number;
  pendingCultureTokens: number;
  badges: Array<{
    profileBadgeId: number;
    code: string;
    label: string;
    supportBoosters: number;
    cultureTokens: number;
    granted: boolean;
  }>;
};

export function buildKqNotebookRewardPreview(
  profileBadges: Array<{ id: number; badge_id: string }>,
  badges: Array<{ id: string; code: string; label: string }>,
  grantedProfileBadgeIds: number[],
): KqNotebookRewardPreview {
  const badgeById = new Map(badges.map((badge) => [badge.id, badge]));
  const granted = new Set(grantedProfileBadgeIds);
  const rows = profileBadges.flatMap((profileBadge) => {
    const badge = badgeById.get(profileBadge.badge_id);
    if (!badge) return [];
    const reward = getKqNotebookReward(badge.code);
    if (reward.supportBoosters <= 0 && reward.cultureTokens <= 0) return [];
    return [{
      profileBadgeId: Number(profileBadge.id),
      code: badge.code,
      label: badge.label,
      supportBoosters: reward.supportBoosters,
      cultureTokens: reward.cultureTokens,
      granted: granted.has(Number(profileBadge.id)),
    }];
  });
  const pending = rows.filter((row) => !row.granted);
  return {
    rewardsLive: KQ_NOTEBOOK_REWARDS_LIVE,
    unlockedBadges: rows.length,
    alreadyGranted: rows.length - pending.length,
    pendingBadges: pending.length,
    pendingSupportBoosters: pending.reduce((sum, row) => sum + row.supportBoosters, 0),
    pendingCultureTokens: pending.reduce((sum, row) => sum + row.cultureTokens, 0),
    badges: rows,
  };
}

export async function getKqAdminNotebookRewardPreview(adminEmail: string) {
  const ownerId = await findKqUserIdByEmail(adminEmail);
  if (!ownerId) throw new Error("Compte collection admin introuvable.");
  const supabase = createSupabaseServiceClient();
  const [profileResult, badgesResult, grantsResult] = await Promise.all([
    supabase.from("contest_profile_badges").select("id,badge_id").eq("customer_id", ownerId),
    supabase.from("contest_badges").select("id,code,label"),
    supabase.from("kq_notebook_reward_grants").select("profile_badge_id").eq("user_id", ownerId),
  ]);
  if (profileResult.error) throw new Error(`[supabase:contest_profile_badges] ${profileResult.error.message}`);
  if (badgesResult.error) throw new Error(`[supabase:contest_badges] ${badgesResult.error.message}`);
  if (grantsResult.error) throw new Error(`[supabase:kq_notebook_reward_grants] ${grantsResult.error.message}`);
  return buildKqNotebookRewardPreview(
    (profileResult.data ?? []).map((row) => ({ id: Number(row.id), badge_id: String(row.badge_id) })),
    (badgesResult.data ?? []).map((row) => ({ id: String(row.id), code: String(row.code), label: String(row.label) })),
    (grantsResult.data ?? []).map((row) => Number(row.profile_badge_id)),
  );
}

type KqHeritageDefinitionRow = {
  code: string;
  name: string;
  timing: string;
  effect_code: string;
  description: string;
  image_url: string | null;
  is_active: boolean;
  producer_id: string | null;
  producer_name: string | null;
  producer_image: string | null;
};

async function getCachedKqHeritageDefinitions(): Promise<KqHeritageDefinitionRow[]> {
  return loadCachedKqReference("heritage-definitions", 60_000, async () => {
    const result = await createSupabaseServiceClient().from("kq_heritage_card_definitions")
      .select("code,name,timing,effect_code,description,image_url,is_active,producer_id,producer_name,producer_image")
      .order("code", { ascending: true });
    if (result.error) throw new Error(`[supabase:kq_heritage_card_definitions] ${result.error.message}`);
    return (result.data ?? []) as KqHeritageDefinitionRow[];
  });
}

type KqHeritageSummary = {
  totalPulls: number;
  eligiblePurchaseUnits: number;
  attributedPurchaseUnits: number;
  ownedCounts: Record<string, number>;
  producerNamesByCard: Record<string, string[]>;
  fragmentBalance: number;
  fragmentHistory: Array<{ id: string; amount: number; reason: string; created_at: string }>;
  draws: Array<{ id: string; order_item_id: number | null; unit_index: number | null; card_code: string; was_duplicate: boolean; source: string | null; drawn_at: string }>;
};

export async function getKqPlayerHeritageSnapshot(ownerId: string, options: { includeDraws?: boolean } = {}) {
  if (!/^[0-9a-f-]{36}$/i.test(ownerId)) throw new Error("Profil Héritage invalide.");
  const supabase = createSupabaseServiceClient();
  const [definitions, summaryResult] = await Promise.all([
    getCachedKqHeritageDefinitions(),
    supabase.rpc("rpc_kq_heritage_snapshot", { p_user_id: ownerId, p_include_draws: options.includeDraws ?? true }),
  ]);
  if (summaryResult.error) throw new Error(`[supabase:rpc_kq_heritage_snapshot] ${summaryResult.error.message}`);
  if (!summaryResult.data) throw new Error("[supabase:rpc_kq_heritage_snapshot] Snapshot missing.");
  const summary = summaryResult.data as KqHeritageSummary;
  const eligibleUnits = Number(summary.eligiblePurchaseUnits);
  const attributedUnits = Number(summary.attributedPurchaseUnits);
  return {
    collectionActive: definitions.some((card) => card.is_active === true),
    purchaseDrawsLive: KQ_HERITAGE_PURCHASE_DRAWS_LIVE,
    totalPulls: Number(summary.totalPulls),
    eligiblePurchaseUnits: eligibleUnits,
    attributedPurchaseUnits: attributedUnits,
    pendingPurchaseUnits: Math.max(0, eligibleUnits - attributedUnits),
    fragmentBalance: Number(summary.fragmentBalance),
    fragmentHistory: summary.fragmentHistory.map((entry) => ({
      id: String(entry.id),
      amount: Number(entry.amount),
      reason: String(entry.reason),
      createdAt: String(entry.created_at),
    })),
    cards: definitions.map((card) => ({
      code: String(card.code),
      name: String(card.name),
      timing: String(card.timing),
      effectCode: String(card.effect_code),
      description: String(card.description),
      imageUrl: String(card.image_url ?? ""),
      isActive: card.is_active === true,
      ownedCopies: Number(summary.ownedCounts[card.code] ?? 0),
      producerId: card.producer_id ? String(card.producer_id) : null,
      producerName: String(card.producer_name ?? ""),
      producerImage: String(card.producer_image ?? ""),
      producerNames: [...new Set([
        ...(card.producer_name ? [String(card.producer_name)] : []),
        ...(summary.producerNamesByCard[card.code] ?? []),
      ])],
    })),
    draws: summary.draws.map((draw) => ({
      id: String(draw.id),
      orderItemId: Number(draw.order_item_id),
      unitIndex: Number(draw.unit_index),
      cardCode: String(draw.card_code),
      duplicate: draw.was_duplicate === true,
      source: String(draw.source ?? "purchase"),
      drawnAt: String(draw.drawn_at),
    })),
  };
}

export async function getKqAdminHeritageSnapshot(adminEmail: string) {
  const ownerId = await findKqUserIdByEmail(adminEmail);
  if (!ownerId) throw new Error("Compte collection admin introuvable.");
  return getKqPlayerHeritageSnapshot(ownerId);
}

async function craftKqHeritageCardForOwner(ownerId: string, cardCode: string) {
  if (!/^[0-9a-f-]{36}$/i.test(ownerId)) throw new Error("Profil Héritage invalide.");
  if (!/^HERITAGE-[0-9]{3,6}$/.test(cardCode)) throw new Error("Héritage invalide.");
  const supabase = createSupabaseServiceClient();
  const result = await supabase.rpc("rpc_kq_craft_heritage_card", {
    p_user_id: ownerId,
    p_card_code: cardCode,
  });
  if (result.error) {
    const message = result.error.message || "Fabrication impossible.";
    if (message.includes("kq_heritage_collection_inactive")) throw new Error("La fabrication Héritage n’est pas encore active.");
    if (message.includes("kq_heritage_already_owned")) throw new Error("Cet Héritage est déjà dans la collection.");
    if (message.includes("kq_heritage_fragments_insufficient")) throw new Error("Solde de fragments insuffisant.");
    throw new Error(`[supabase:rpc_kq_craft_heritage_card] ${message}`);
  }
  const data = result.data as { draw?: Record<string, unknown>; fragmentBalance?: number } | null;
  const draw = data?.draw;
  return {
    fragmentBalance: Number(data?.fragmentBalance ?? 0),
    draw: draw ? {
      id: String(draw.id ?? ""),
      cardCode: String(draw.card_code ?? ""),
      source: String(draw.source ?? "craft"),
    } : null,
  };
}

export async function craftKqPlayerHeritageCard(ownerId: string, cardCode: string) {
  return craftKqHeritageCardForOwner(ownerId, cardCode);
}

export async function craftKqAdminHeritageCard(adminEmail: string, cardCode: string) {
  const ownerId = await findKqUserIdByEmail(adminEmail);
  if (!ownerId) throw new Error("Compte collection admin introuvable.");
  return craftKqHeritageCardForOwner(ownerId, cardCode);
}

type KqLaunchReadinessInput = {
  heritageCards: Array<{ image_url: string; is_active: boolean; producer_id?: string | null; effect_code: string }>;
  producerCount?: number;
  supportCards: Array<{ image_url: string; is_active: boolean }>;
  supportCollectionActive: boolean;
  notebookRules: Array<{ is_active: boolean }>;
  seasonRules: Array<{ tier_code: string; is_active: boolean }>;
  seasonGrantCount: number;
  equipmentCatalog: KqEquipmentCatalogRow[];
  launchApprovals: KqLaunchApprovals;
  launchDossier: KqLaunchDossier;
  featureFlags?: {
    heritagePurchaseDrawsLive: boolean;
    notebookRewardsLive: boolean;
    producerNotebookRewardsLive: boolean;
    seasonRewardsLive: boolean;
    publicPlayerApiLive: boolean;
  };
};

export function isKqFinalArtworkUrl(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized || !/^(\/|https?:\/\/)/.test(normalized)) return false;
  return !/(placeholder|brouillon|draft|temp(?:orary)?|todo|example|exemple)/.test(normalized);
}

export function buildKqLaunchReadiness(input: KqLaunchReadinessInput) {
  const expectedHeritageCount = input.producerCount ?? 12;
  const producerHeritageCards = input.heritageCards.filter((card) => card.producer_id !== null);
  const heritageEffects = producerHeritageCards.map((card) => card.effect_code);
  const heritageArtwork = producerHeritageCards.map((card) => card.image_url.trim().toLowerCase()).filter(isKqFinalArtworkUrl);
  const supportArtwork = input.supportCards.map((card) => card.image_url.trim().toLowerCase()).filter(isKqFinalArtworkUrl);
  const equipmentAudit = auditKqEquipmentCatalog(input.equipmentCatalog);
  const featureFlags = input.featureFlags ?? {
    heritagePurchaseDrawsLive: KQ_HERITAGE_PURCHASE_DRAWS_LIVE,
    notebookRewardsLive: KQ_NOTEBOOK_REWARDS_LIVE,
    producerNotebookRewardsLive: KQ_PRODUCER_NOTEBOOK_REWARDS_LIVE,
    seasonRewardsLive: KQ_SEASON_REWARDS_LIVE,
    publicPlayerApiLive: isKqPublicPlayerApiEnabled(),
  };
  const contentChecks = [
    ...getKqLaunchApprovalChecks(input.launchApprovals, input.launchDossier),
    { code: "equipment-price-sources", label: `${equipmentAudit.sourceCount} références matériel datées et vérifiables`, ready: equipmentAudit.sourcesReady },
    { code: "equipment-db-prices", label: `${equipmentAudit.purchasableCount} prix boutique Supabase alignés sur le catalogue`, ready: equipmentAudit.databaseReady },
    { code: "heritage-catalog", label: `Catalogue Héritage · ${expectedHeritageCount} producteur(s), une carte chacun`, ready: expectedHeritageCount > 0 && producerHeritageCards.length === expectedHeritageCount },
    { code: "heritage-effects", label: `${expectedHeritageCount} pouvoirs Héritage distincts et pris en charge`, ready: heritageEffects.length === expectedHeritageCount && heritageEffects.every(isKqHeritageEffect) && new Set(heritageEffects).size === expectedHeritageCount },
    { code: "heritage-art", label: `${expectedHeritageCount} illustrations Héritage producteur`, ready: heritageArtwork.length === expectedHeritageCount && new Set(heritageArtwork).size === expectedHeritageCount },
    { code: "support-catalog", label: `${KQ_ACTIVE_CARDS.length} cartes Botte du Chanvrier`, ready: input.supportCards.length === KQ_ACTIVE_CARDS.length },
    { code: "support-art", label: `${KQ_ACTIVE_CARDS.length} illustrations Botte du Chanvrier distinctes`, ready: supportArtwork.length === KQ_ACTIVE_CARDS.length && new Set(supportArtwork).size === KQ_ACTIVE_CARDS.length },
    { code: "notebook-rules", label: "2 missions carnet → Kanab Quest configurées", ready: input.notebookRules.length === 2 },
    { code: "season-rules", label: "4 paliers de récompenses de saison", ready: input.seasonRules.length === 4 && new Set(input.seasonRules.map((rule) => rule.tier_code)).size === 4 },
    { code: "season-no-early-grants", label: "Aucune récompense de saison prématurée", ready: input.seasonGrantCount === 0 },
  ];
  const dormantChecks = [
    { code: "support-dormant", label: "Collection Botte du Chanvrier encore inactive", ready: !input.supportCollectionActive && input.supportCards.every((card) => !card.is_active) },
    { code: "heritage-dormant", label: "Collection Héritage encore inactive", ready: input.heritageCards.every((card) => !card.is_active) },
    { code: "heritage-purchase-dormant", label: "Tirages Héritage après achat encore inactifs", ready: !featureFlags.heritagePurchaseDrawsLive },
    { code: "notebook-dormant", label: "Récompenses du carnet encore inactives", ready: input.notebookRules.every((rule) => !rule.is_active) && !featureFlags.notebookRewardsLive },
    { code: "producer-rewards-dormant", label: "Récompenses des avis producteurs encore inactives", ready: !featureFlags.producerNotebookRewardsLive },
    { code: "season-dormant", label: "Récompenses de saison encore inactives", ready: input.seasonRules.every((rule) => !rule.is_active) && !featureFlags.seasonRewardsLive && input.seasonGrantCount === 0 },
  ];
  dormantChecks.push({
    code: "player-access-dormant",
    label: "Accès joueur à Kanab Quest encore fermé",
    ready: !featureFlags.publicPlayerApiLive,
  });
  const safelyDormant = dormantChecks.every((check) => check.ready);
  const contentReady = contentChecks.every((check) => check.ready);
  const checks = [...contentChecks, ...dormantChecks];
  return {
    contentReady,
    readyForActivation: contentReady && safelyDormant,
    safelyDormant,
    launchDossier: input.launchDossier,
    checks,
    blockers: checks.filter((check) => !check.ready).map((check) => check.label),
    activationStillRequired: [
      "Valider les cinq décisions du dossier de lancement puis publier PLACARD-RULES-DRAFT",
      "Importer un rapport consolidé vert couvrant le socle graphique, chaque Héritage producteur actif et les 10 autres preuves de recette",
      "Ouvrir la fenêtre coordonnée et activer les collections Botte du Chanvrier et Héritage",
      "Contrôler les 2 missions Carnet et les 4 paliers de saison dans Supabase",
      "Basculer ensemble KQ_NOTEBOOK_REWARDS_LIVE, KQ_PRODUCER_NOTEBOOK_REWARDS_LIVE et KQ_SEASON_REWARDS_LIVE",
      "Exécuter les rétro-attributions des missions Carnet puis des avis producteurs depuis l’interface admin",
      "Contrôler les reçus, les soldes et un parcours complet avant d’ouvrir Kanab Quest aux clients",
      "Basculer KQ_PLAYER_API_LIVE en dernier, puis effectuer le test fumée avec un compte client de recette",
    ],
  };
}

export async function getKqAdminLaunchReadiness(adminEmail: string) {
  const ownerId = await findKqUserIdByEmail(adminEmail);
  if (!ownerId) throw new Error("Compte collection admin introuvable.");
  const supabase = createSupabaseServiceClient();
  const seasonCode = await getKqActiveSeasonCode();
  const collectionResult = await supabase.from("lottery_card_collections")
    .select("id,is_active").eq("code", BOTTE_COLLECTION_CODE).maybeSingle();
  if (collectionResult.error || !collectionResult.data) throw new Error("Collection Botte du Chanvrier introuvable.");
  const [heritageResult, producerResult, supportResult, rulesResult, seasonRulesResult, seasonGrantsResult, equipmentResult] = await Promise.all([
    supabase.from("kq_heritage_card_definitions").select("image_url,is_active,producer_id,effect_code").not("producer_id", "is", null),
    supabase.from("producers").select("id", { count: "exact", head: true }),
    supabase.from("lottery_card_definitions").select("image_url,is_active").eq("collection_id", collectionResult.data.id).in("code", KQ_ACTIVE_CARDS.map((card) => card.code)),
    supabase.from("kq_notebook_reward_rules").select("is_active"),
    supabase.from("kq_season_reward_rules").select("tier_code,is_active").eq("season_code", seasonCode),
    supabase.from("kq_season_reward_grants").select("id", { count: "exact", head: true }).eq("season_code", seasonCode),
    supabase.from("kq_equipment_catalog").select("code,price_cents,is_purchasable,is_active"),
  ]);
  if (heritageResult.error) throw new Error(`[supabase:kq_heritage_card_definitions] ${heritageResult.error.message}`);
  if (producerResult.error) throw new Error(`[supabase:producers] ${producerResult.error.message}`);
  if (supportResult.error) throw new Error(`[supabase:lottery_card_definitions] ${supportResult.error.message}`);
  if (rulesResult.error) throw new Error(`[supabase:kq_notebook_reward_rules] ${rulesResult.error.message}`);
  if (seasonRulesResult.error) throw new Error(`[supabase:kq_season_reward_rules] ${seasonRulesResult.error.message}`);
  if (seasonGrantsResult.error) throw new Error(`[supabase:kq_season_reward_grants] ${seasonGrantsResult.error.message}`);
  if (equipmentResult.error) throw new Error(`[supabase:kq_equipment_catalog] ${equipmentResult.error.message}`);
  return buildKqLaunchReadiness({
    heritageCards: (heritageResult.data ?? []).map((card) => ({ image_url: String(card.image_url ?? ""), is_active: card.is_active === true, producer_id: card.producer_id ? String(card.producer_id) : null, effect_code: String(card.effect_code ?? "") })),
    producerCount: producerResult.count ?? 0,
    supportCards: (supportResult.data ?? []).map((card) => ({ image_url: String(card.image_url ?? ""), is_active: card.is_active === true })),
    supportCollectionActive: collectionResult.data.is_active === true,
    notebookRules: (rulesResult.data ?? []).map((rule) => ({ is_active: rule.is_active === true })),
    seasonRules: (seasonRulesResult.data ?? []).map((rule) => ({ tier_code: String(rule.tier_code), is_active: rule.is_active === true })),
    seasonGrantCount: seasonGrantsResult.count ?? 0,
    equipmentCatalog: (equipmentResult.data ?? []).map((equipment) => ({
      code: String(equipment.code),
      price_cents: Number(equipment.price_cents),
      is_purchasable: equipment.is_purchasable === true,
      is_active: equipment.is_active === true,
    })),
    launchApprovals: getKqLaunchApprovals(),
    launchDossier: getKqLaunchDossier(),
  });
}

export function countKqInventoryCopies(
  definitions: Array<Pick<CardDefinitionRow, "id" | "code">>,
  instances: Array<{ card_definition_id: string }>,
): Record<string, number> {
  const codeById = new Map(definitions.map((definition) => [definition.id, definition.code]));
  const inventory = Object.fromEntries(definitions.map((definition) => [definition.code, 0]));
  for (const instance of instances) {
    const code = codeById.get(instance.card_definition_id);
    if (code) inventory[code] = (inventory[code] ?? 0) + 1;
  }
  return inventory;
}

const kqUserLookupCache = new Map<string, { expiresAt: number; promise: Promise<string | null> }>();

export async function findKqUserIdByEmail(email: string): Promise<string | null> {
  const target = normalizeEmail(email);
  const cached = kqUserLookupCache.get(target);
  if (cached && cached.expiresAt > Date.now()) return cached.promise;
  const promise = (async () => {
    const supabase = createSupabaseServiceClient();
    for (let page = 1; page <= 10; page += 1) {
      const result = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
      if (result.error) throw new Error(`[supabase:auth.admin.listUsers] ${result.error.message}`);
      const match = result.data.users.find((user) => normalizeEmail(user.email) === target);
      if (match) return match.id;
      if (result.data.users.length < 1000) return null;
    }
    return null;
  })();
  kqUserLookupCache.set(target, { expiresAt: Date.now() + 30_000, promise });
  try {
    return await promise;
  } catch (error) {
    kqUserLookupCache.delete(target);
    throw error;
  }
}

async function getCachedKqBotteCatalog(): Promise<{
  collection: { id: string; is_active: boolean };
  definitions: CardDefinitionRow[];
}> {
  return loadCachedKqReference("botte-catalog", 60_000, async () => {
    const supabase = createSupabaseServiceClient();
    const collectionResult = await supabase
      .from("lottery_card_collections")
      .select("id,is_active")
      .eq("code", BOTTE_COLLECTION_CODE)
      .maybeSingle();
    if (collectionResult.error) {
      throw new Error(`[supabase:lottery_card_collections] ${collectionResult.error.message}`);
    }
    if (!collectionResult.data) throw new Error("Collection Botte du Chanvrier introuvable.");

    const definitionsResult = await supabase
      .from("lottery_card_definitions")
      .select("id,code,name,rarity,description,image_url,is_active")
      .eq("collection_id", collectionResult.data.id)
      .order("card_number", { ascending: true });
    if (definitionsResult.error) {
      throw new Error(`[supabase:lottery_card_definitions] ${definitionsResult.error.message}`);
    }
    return {
      collection: {
        id: String(collectionResult.data.id),
        is_active: collectionResult.data.is_active === true,
      },
      definitions: ((definitionsResult.data ?? []) as CardDefinitionRow[]).filter((definition) => definition.is_active && KQ_ACTIVE_CARDS.some((card) => card.code === definition.code)),
    };
  });
}

export async function getKqPlayerCollectionSnapshot(ownerId: string): Promise<KqAdminCollectionSnapshot> {
  if (!/^[0-9a-f-]{36}$/i.test(ownerId)) throw new Error("Compte Kanab Quest invalide.");
  const supabase = createSupabaseServiceClient();
  const catalog = await getCachedKqBotteCatalog();
  const [counts, tokenWallet, reservations] = await Promise.all([
    getKqCardCopyCounts(ownerId, catalog.definitions.map((definition) => definition.id)),
    supabase.from("kq_culture_token_wallets")
      .select("balance").eq("user_id", ownerId).maybeSingle(),
    getKqReservedCardCodes(ownerId),
  ]);
  if (tokenWallet.error) throw new Error(`[supabase:kq_culture_token_wallets] ${tokenWallet.error.message}`);
  const snapshot = buildKqCollectionSnapshot(catalog, counts, Number(tokenWallet.data?.balance ?? 0));
  return withKqAvailableInventory(snapshot, reservations);
}

async function getKqReservedCardCodes(ownerId: string): Promise<string[]> {
  const result = await createSupabaseServiceClient().rpc("rpc_kq_reserved_cards", { p_user_id: ownerId });
  if (result.error) throw new Error(`[supabase:rpc_kq_reserved_cards] ${result.error.message}`);
  if (!Array.isArray(result.data) || result.data.some(row => !row || typeof row.cardCode !== "string")) throw new Error("[supabase:rpc_kq_reserved_cards] Invalid reservations.");
  return result.data.map(row => row.cardCode);
}

function withKqAvailableInventory(snapshot: KqAdminCollectionSnapshot, reservedCodes: string[]): KqAdminCollectionSnapshot {
  const availableInventory = { ...snapshot.inventory };
  for (const code of reservedCodes) {
    if (code in availableInventory) availableInventory[code] = Math.max(0, availableInventory[code] - 1);
  }
  return { ...snapshot, availableInventory };
}

async function getKqCardCopyCounts(ownerId: string, definitionIds: string[]): Promise<Record<string, number>> {
  if (definitionIds.length === 0) return {};
  const result = await createSupabaseServiceClient().rpc("rpc_kq_card_copy_counts", {
    p_user_id: ownerId, p_definition_ids: definitionIds,
  });
  if (result.error) throw new Error(`[supabase:rpc_kq_card_copy_counts] ${result.error.message}`);
  if (!result.data || typeof result.data !== "object" || Array.isArray(result.data)) {
    throw new Error("[supabase:rpc_kq_card_copy_counts] Invalid inventory.");
  }
  const counts = Object.fromEntries(Object.entries(result.data).map(([id, count]) => [id, Number(count)]));
  if (Object.values(counts).some((count) => !Number.isSafeInteger(count) || count < 0)) {
    throw new Error("[supabase:rpc_kq_card_copy_counts] Invalid copy count.");
  }
  return counts;
}

function buildKqCollectionSnapshot(
  { collection, definitions }: Awaited<ReturnType<typeof getCachedKqBotteCatalog>>,
  counts: Record<string, number>,
  cultureTokenBalance: number,
): KqAdminCollectionSnapshot {
  const inventory = Object.fromEntries(definitions.map((definition) => [definition.code, counts[definition.id] ?? 0]));
  return {
    collectionActive: collection.is_active,
    ownerFound: true,
    cultureTokenBalance,
    inventory,
    cards: definitions.map((definition) => ({
      code: definition.code,
      name: definition.name,
      rarity: definition.rarity,
      description: definition.description,
      imageUrl: definition.image_url,
      isActive: definition.is_active,
      ownedCopies: inventory[definition.code] ?? 0,
    })),
  };
}

export type KqOwnedBuddie = {
  code: string;
  name: string;
  rarity: string;
  cardNumber: number;
  imageUrl: string;
  ownedCopies: number;
};

type KqBuddieDefinitionRow = {
  id: string;
  code: string;
  name: string;
  rarity: string;
  card_number: number;
  image_url: string | null;
};

async function getCachedKqBuddieDefinitions(): Promise<KqBuddieDefinitionRow[]> {
  return loadCachedKqReference("buddie-definitions", 60_000, async () => {
    const result = await createSupabaseServiceClient().from("lottery_card_definitions")
      .select("id,code,name,rarity,card_number,image_url")
      .in("code", KQ_BUDDIES.map((buddie) => buddie.code));
    if (result.error) throw new Error(`[supabase:lottery_card_definitions] ${result.error.message}`);
    return (result.data ?? []) as KqBuddieDefinitionRow[];
  });
}

export async function getKqPlayerOwnedBuddies(ownerId: string): Promise<KqOwnedBuddie[]> {
  if (!/^[0-9a-f-]{36}$/i.test(ownerId)) throw new Error("Compte Kanab Quest invalide.");
  const definitionRows = await getCachedKqBuddieDefinitions();
  const copyCounts = await getKqCardCopyCounts(ownerId, definitionRows.map((definition) => definition.id));
  return buildKqOwnedBuddies(definitionRows, copyCounts);
}

function buildKqOwnedBuddies(definitionRows: KqBuddieDefinitionRow[], copyCounts: Record<string, number>): KqOwnedBuddie[] {
  return definitionRows
    .filter((definition) => (copyCounts[String(definition.id)] ?? 0) > 0)
    .map((definition) => ({
      code: String(definition.code),
      name: String(definition.name),
      rarity: String(definition.rarity),
      cardNumber: Number(definition.card_number),
      imageUrl: String(definition.image_url ?? ""),
      ownedCopies: copyCounts[String(definition.id)] ?? 0,
    }))
    .sort((left, right) => left.cardNumber - right.cardNumber);
}

// Bootstrap needs both collections. Count their copies in one request without
// caching a player's mutable inventory across purchases, rewards or card burns.
export async function getKqPlayerCollectionBundle(ownerId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(ownerId)) throw new Error("Compte Kanab Quest invalide.");
  const supabase = createSupabaseServiceClient();
  const [catalog, buddieDefinitions] = await Promise.all([getCachedKqBotteCatalog(), getCachedKqBuddieDefinitions()]);
  const [counts, tokenWallet, reservations] = await Promise.all([
    getKqCardCopyCounts(ownerId, [...catalog.definitions, ...buddieDefinitions].map((definition) => definition.id)),
    supabase.from("kq_culture_token_wallets").select("balance").eq("user_id", ownerId).maybeSingle(),
    getKqReservedCardCodes(ownerId),
  ]);
  if (tokenWallet.error) throw new Error(`[supabase:kq_culture_token_wallets] ${tokenWallet.error.message}`);
  return {
    collection: withKqAvailableInventory(buildKqCollectionSnapshot(catalog, counts, Number(tokenWallet.data?.balance ?? 0)), reservations),
    ownedBuddies: buildKqOwnedBuddies(buddieDefinitions, counts),
  };
}

export async function getKqPlayerBuddieRotation(ownerId: string): Promise<KqBuddieRotation> {
  if (!/^[0-9a-f-]{36}$/i.test(ownerId)) throw new Error("Compte Kanab Quest invalide.");
  const result = await createSupabaseServiceClient().from("kq_buddie_rotation")
    .select("recent_buddie_codes").eq("user_id", ownerId).maybeSingle();
  if (result.error) throw new Error("[supabase:kq_buddie_rotation] " + result.error.message);
  const recent = result.data?.recent_buddie_codes ?? [];
  if (!Array.isArray(recent) || recent.some((code: unknown) => typeof code !== "string" || !code)) {
    throw new Error("[supabase:kq_buddie_rotation] Historique invalide.");
  }
  return { requiredDistinctBuddies: KQ_BUDDIE_ROTATION_REQUIRED, recentBuddieCodes: [...new Set<string>(recent)].slice(0, KQ_BUDDIE_ROTATION_REQUIRED) };
}

export async function getKqPlayerOwnedBuddieCodes(ownerId: string): Promise<string[]> {
  return (await getKqPlayerOwnedBuddies(ownerId)).map((buddie) => buddie.code);
}

export async function getKqAdminCollectionSnapshot(adminEmail: string): Promise<KqAdminCollectionSnapshot> {
  const ownerId = await findKqUserIdByEmail(adminEmail);
  if (!ownerId) {
    return {
      collectionActive: false,
      ownerFound: false,
      cultureTokenBalance: 0,
      inventory: {},
      cards: [],
    };
  }
  return getKqPlayerCollectionSnapshot(ownerId);
}

export async function getKqAdminBuddieRotation(adminEmail: string): Promise<KqBuddieRotation> {
  const ownerId = await findKqUserIdByEmail(adminEmail);
  return ownerId ? getKqPlayerBuddieRotation(ownerId)
    : { requiredDistinctBuddies: KQ_BUDDIE_ROTATION_REQUIRED, recentBuddieCodes: [] };
}

export async function getKqAdminLaunchReadinessFromSnapshots(
  heritage: Awaited<ReturnType<typeof getKqAdminHeritageSnapshot>>,
  collection: KqAdminCollectionSnapshot,
) {
  const supabase = createSupabaseServiceClient();
  const seasonCode = await getKqActiveSeasonCode();
  const [producerResult, rulesResult, seasonRulesResult, seasonGrantsResult, equipmentResult] = await Promise.all([
    supabase.from("producers").select("id", { count: "exact", head: true }),
    supabase.from("kq_notebook_reward_rules").select("is_active"),
    supabase.from("kq_season_reward_rules").select("tier_code,is_active").eq("season_code", seasonCode),
    supabase.from("kq_season_reward_grants").select("id", { count: "exact", head: true }).eq("season_code", seasonCode),
    supabase.from("kq_equipment_catalog").select("code,price_cents,is_purchasable,is_active"),
  ]);
  if (producerResult.error) throw new Error(`[supabase:producers] ${producerResult.error.message}`);
  if (rulesResult.error) throw new Error(`[supabase:kq_notebook_reward_rules] ${rulesResult.error.message}`);
  if (seasonRulesResult.error) throw new Error(`[supabase:kq_season_reward_rules] ${seasonRulesResult.error.message}`);
  if (seasonGrantsResult.error) throw new Error(`[supabase:kq_season_reward_grants] ${seasonGrantsResult.error.message}`);
  if (equipmentResult.error) throw new Error(`[supabase:kq_equipment_catalog] ${equipmentResult.error.message}`);
  return buildKqLaunchReadiness({
    heritageCards: heritage.cards.map((card) => ({
      image_url: card.imageUrl,
      is_active: card.isActive,
      producer_id: card.producerId,
      effect_code: card.effectCode,
    })),
    producerCount: producerResult.count ?? 0,
    supportCards: collection.cards.map((card) => ({
      image_url: card.imageUrl,
      is_active: card.isActive,
    })),
    supportCollectionActive: collection.collectionActive,
    notebookRules: (rulesResult.data ?? []).map((rule) => ({ is_active: rule.is_active === true })),
    seasonRules: (seasonRulesResult.data ?? []).map((rule) => ({
      tier_code: String(rule.tier_code),
      is_active: rule.is_active === true,
    })),
    seasonGrantCount: seasonGrantsResult.count ?? 0,
    equipmentCatalog: (equipmentResult.data ?? []).map((equipment) => ({
      code: String(equipment.code),
      price_cents: Number(equipment.price_cents),
      is_purchasable: equipment.is_purchasable === true,
      is_active: equipment.is_active === true,
    })),
    launchApprovals: getKqLaunchApprovals(),
    launchDossier: getKqLaunchDossier(),
  });
}

export type KqStartRunInput = {
  campaign?: boolean;
  zoneId?: string;
  requestKey?: string;
  energyMode?: KqEnergyMode;
  expectedEnergyCents?: number;
  buddieCode: string;
  deckCodes: string[];
  cultureTokens?: number;
  heritageCode?: string;
};

export function mapKqStartRunResult(data: unknown) {
  const payload = data && typeof data === "object" && !Array.isArray(data)
    ? data as Record<string, unknown>
    : null;
  const run = payload?.run && typeof payload.run === "object"
    ? payload.run as Record<string, unknown>
    : null;
  const receipt = payload?.burnReceipt && typeof payload.burnReceipt === "object"
    ? payload.burnReceipt as Record<string, unknown>
    : null;
  if (!run?.id || (receipt && (!receipt.id || !receipt.card_instance_id || !receipt.card_code || !receipt.burned_at))) {
    throw new Error("Reçu de démarrage Supabase invalide.");
  }
  return {
    runId: String(run.id),
    ...(payload?.replayed !== undefined ? { replayed: payload.replayed === true } : {}),
    cultureTokenBalance: Number(payload?.cultureTokenBalance ?? 0),
    freeSubstrate: payload?.freeSubstrate === true,
    burnReceipt: receipt ? {
      id: String(receipt.id),
      cardInstanceId: String(receipt.card_instance_id),
      cardCode: String(receipt.card_code),
      stageIndex: Number(receipt.stage_index),
      useKind: String(receipt.use_kind),
      burnedAt: String(receipt.burned_at),
    } : null,
  };
}

// A bounded window covers a complete rotation of the current stage pools.
// Abandoned cultures contribute only stages that the player actually reached.
export async function getKqRecentSituationCodes(ownerId: string): Promise<string[]> {
  if (!/^[0-9a-f-]{36}$/i.test(ownerId)) throw new Error("Compte Kanab Quest invalide.");
  const result = await createSupabaseServiceClient().from("kq_runs")
    .select("scenario_codes,status,state")
    .eq("user_id", ownerId).in("status", ["completed", "abandoned"])
    .order("started_at", { ascending: false }).order("id", { ascending: false }).limit(12);
  if (result.error) throw new Error(`[supabase:kq_runs:scenario-history] ${result.error.message}`);
  const known = new Set(KQ_SITUATIONS.map(situation => situation.code));
  return (result.data ?? []).flatMap(row => {
    if (!Array.isArray(row.scenario_codes)) return [];
    const stageIndex = row.state && typeof row.state === "object" ? row.state.stageIndex : undefined;
    const seen = row.status === "completed" ? KQ_STAGES.length
      : typeof stageIndex === "number" && Number.isInteger(stageIndex) ? Math.max(0, Math.min(KQ_STAGES.length, stageIndex + 1)) : 0;
    return row.scenario_codes.slice(0, seen).filter((code): code is string => typeof code === "string" && known.has(code));
  });
}

export async function startKqPlayerRun(ownerId: string, input: KqStartRunInput) {
  if (input.campaign !== undefined && typeof input.campaign !== "boolean") throw new Error("Campagne invalide.");
  if (input.campaign && input.zoneId !== undefined) throw new Error("La campagne comprend toutes les zones affectées.");
  if (input.zoneId !== undefined && (typeof input.zoneId !== "string" || !input.zoneId.trim() || input.zoneId.length > 80)) throw new Error("Zone de culture invalide.");
  if ((input.campaign || input.zoneId !== undefined) && (typeof input.requestKey !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.requestKey))) throw new Error("Clé de lancement invalide.");
  if (input.energyMode !== undefined && !isKqEnergyMode(input.energyMode)) throw new Error("Mode énergétique invalide.");
  if (!/^[0-9a-f-]{36}$/i.test(ownerId)) throw new Error("Compte Kanab Quest invalide.");
  if (!KQ_BUDDIES.some((buddie) => buddie.code === input.buddieCode)) {
    throw new Error("Buddie invalide.");
  }
  if (!Array.isArray(input.deckCodes) || input.deckCodes.length > 250) {
    throw new Error("Deck invalide.");
  }
  const cultureTokens = Math.floor(input.cultureTokens ?? 0);
  if (cultureTokens < 0 || cultureTokens > KQ_CULTURE_TOKEN_RUN_CAP) {
    throw new Error("Nombre de jetons Coup de pouce invalide.");
  }
  const heritageCode = input.heritageCode?.trim() || undefined;
  const intention = !input.campaign && input.zoneId === undefined ? undefined : {
    ...(input.campaign ? { campaign: true } : { zoneId: input.zoneId }), buddieCode: input.buddieCode, deckCodes: input.deckCodes,
    cultureTokens, heritageCode: heritageCode ?? null, energyMode: "balanced",
    expectedEnergyCents: input.expectedEnergyCents ?? null,
  };
  // A retry must find its committed receipt before checking rotation, capacity
  // or drawing a new seed: each of those may legitimately have changed.
  if (intention) {
    const replay = await createSupabaseServiceClient().rpc(input.campaign ? "rpc_kq_campaign_receipt" : "rpc_kq_zone_run_receipt", {
      p_user_id: ownerId, p_request_key: input.requestKey, p_request: intention,
    });
    if (replay.error) {
      if (replay.error.message.includes("request_mismatch")) throw new Error("Cette demande a déjà servi à une autre culture.");
      throw new Error(`[supabase:zone-run-receipt] ${replay.error.message}`);
    }
    if (replay.data) {
      const state = parseKqGameSave(encodeKqSave(replay.data.run?.state));
      if (!state) throw new Error("[supabase:zone-run-receipt] État de culture invalide.");
      return { ...mapKqStartRunResult(replay.data), state, buddieRotation: await getKqPlayerBuddieRotation(ownerId) };
    }
  }
  if ((input.campaign || input.zoneId !== undefined) && input.deckCodes.some(code => !KQ_ACTIVE_CARDS.some(card => card.code === code && card.category !== "pbi"))) {
    throw new Error("Le deck contient une carte indisponible pour cette culture.");
  }
  let heritageCard: KqHeritageCard | undefined;
  if (heritageCode) {
    if (!/^HERITAGE-[0-9]{3,6}$/.test(heritageCode)) throw new Error("Héritage invalide.");
    const definition = (await getCachedKqHeritageDefinitions())
      .find((card) => card.code === heritageCode && card.is_active === true);
    if (!definition || !isKqHeritageEffect(definition.effect_code) || !isKqHeritageTiming(definition.timing)) {
      throw new Error("Cet Héritage n’est pas disponible.");
    }
    heritageCard = {
      code: definition.code,
      name: definition.name,
      timing: definition.timing,
      effect: definition.effect_code,
      description: definition.description,
      imageUrl: String(definition.image_url ?? ""),
      ...(definition.producer_id ? { producerId: definition.producer_id } : {}),
      ...(definition.producer_name ? { producerName: definition.producer_name } : {}),
    };
  }
  const cards = input.deckCodes.map((code) => KQ_CARDS.find((card) => card.code === code));
  if (cards.some((card) => !card || card.category === "pbi")) {
    throw new Error("Le deck contient une carte interdite.");
  }
  const supabase = createSupabaseServiceClient();
  const [collection, equipmentShop, businessResult, recentSituationCodes, buddieRotation, storedWarehouse] = await Promise.all([
    getKqPlayerCollectionSnapshot(ownerId),
    getKqEquipmentShopSnapshot(ownerId),
    supabase.rpc("rpc_kq_commerce_state", { p_user_id: ownerId }),
    getKqRecentSituationCodes(ownerId),
    getKqPlayerBuddieRotation(ownerId),
    input.zoneId === undefined ? getKqWarehouseRunSnapshot(ownerId) : getKqWarehouseRunSnapshot(ownerId, input.zoneId),
  ]);
  const participants = input.campaign && storedWarehouse
    ? getKqCampaignParticipants(storedWarehouse.sourceState, storedWarehouse.revision) : [];
  if (input.campaign && (!participants.length || participants[0].buddieCode !== input.buddieCode)) {
    throw new Error("Affecte tes Buddies aux zones, puis actualise la préparation de la campagne.");
  }
  if (input.campaign && new Set(participants.map(member => member.buddieCode)).size !== participants.length) {
    throw new Error("Chaque Buddie doit occuper une seule zone dans la campagne.");
  }
  const warehouse = input.campaign ? participants[0].warehouse : storedWarehouse;
  const remainingBuddies = getKqBuddieRotationRemaining(input.buddieCode, buddieRotation.recentBuddieCodes);
  // For zoned launches the transaction checks rotation after its receipt: a
  // concurrent retry must not be rejected because the first launch just used it.
  if (!intention && remainingBuddies > 0) throw new Error(getKqBuddieRotationMessage(remainingBuddies));
  if (input.zoneId !== undefined && (!warehouse || warehouse.version !== 2 || warehouse.zones[0]?.buddieCode !== input.buddieCode)) throw new Error("Le Buddie choisi ne correspond pas à cette zone. Actualise son affectation.");
  if (businessResult.error) throw new Error(`[supabase:commerce] ${businessResult.error.message}`);
  const business = businessResult.data?.business as KqBusinessState | undefined;
  if (business?.version !== 1) throw new Error("[supabase:commerce] business_calendar_migration_required");
  const domiciliation = business.domiciliation?.mode === "external" && business.domiciliation.active ? "external" : "home";
  const collectionCodes = Object.entries(collection.inventory)
    .filter(([, copies]) => copies > 0)
    .map(([code]) => code);
  const seed = crypto.getRandomValues(new Uint32Array(1))[0] % 100000;
  const state = startKqGame(seed, {
    ...(warehouse ? { warehouse } : {}),
    ...(input.campaign ? { cultivationProfile: participants[0].cultivationProfile } : {}),
    recentSituationCodes,
    domiciliation,
    varietyCode: input.buddieCode,
    deckCodes: input.deckCodes,
    collectionCodes,
    startingXp: 1 + cultureTokens * KQ_CULTURE_TOKEN_START_XP + getChanvrierStartingXp(equipmentShop.strength),
    heritageCode,
    heritageCard,
    equipmentCodes: equipmentShop.cultureOperationalCodes ?? equipmentShop.equippedCodes,
    equipmentLevels: equipmentShop.levels,
    equipmentScope: equipmentShop.equipmentScopeVersion === 3 ? "building" : "tent",
    equipmentTents: getKqEffectiveTentProfiles(equipmentShop),
    equipmentShared: equipmentShop.sharedEquipment ? { codes: equipmentShop.sharedEquipment.equippedCodes.filter(isKqProcessingEquipment), levels: equipmentShop.sharedEquipment.levels } : undefined,
    productionUnits: equipmentShop.productionUnits,
    energyMode: input.energyMode ?? "balanced",
  });
  let members: KqCampaignMember[] = [];
  if (input.campaign) {
    members = participants.map(member => ({ ...member, runId: crypto.randomUUID() }));
    state.campaign = { version: 1, id: crypto.randomUUID(), leaderRunId: members[0].runId, members };
    const sharedAdvantage = Math.max(...members.map(member => KQ_BUDDIES.find(buddie => buddie.code === member.buddieCode)!.advantageLevel));
    const leaderAdvantage = KQ_BUDDIES.find(buddie => buddie.code === input.buddieCode)!.advantageLevel;
    state.xp += sharedAdvantage - leaderAdvantage;
    state.effectNotices = [...(state.effectNotices ?? []).filter(notice => !notice.includes("XP au départ.")),
      `Campagne commune : ${members.length} Buddies · avantage partagé +${sharedAdvantage} XP.`];
  }
  if (equipmentShop.strength === "green-thumb") state.effectNotices = [...(state.effectNotices ?? []), "Main Verte : +2 XP pour cette culture."];
  if (input.expectedEnergyCents !== undefined && input.expectedEnergyCents !== (input.campaign ? getKqCampaignTotals(members).energyCostCents : state.energy?.totalCents)) throw new Error("L’installation a changé. Actualise le devis électrique avant de lancer.");
  const result = input.campaign ? await supabase.rpc("rpc_kq_start_campaign", {
    p_user_id: ownerId, p_request_key: input.requestKey, p_request: intention,
    p_members: members.map(member => ({ runId: member.runId, state: getKqCampaignMemberState(state, member) })),
    p_culture_tokens: cultureTokens, p_heritage_code: heritageCode ?? null,
  }) : await supabase.rpc(intention ? "rpc_kq_start_zone_run" : "rpc_kq_start_run_with_heritage", {
    p_user_id: ownerId,
    p_buddie_code: input.buddieCode,
    p_seed: state.seed,
    p_deck_codes: state.deckCodes,
    p_scenario_codes: state.situationCodes,
    p_initial_state: state,
    p_culture_tokens: cultureTokens,
    p_heritage_code: heritageCode ?? null,
    ...(intention ? { p_zone_id: input.zoneId, p_request_key: input.requestKey, p_request: intention } : {}),
  });
  if (result.error) {
    const message = result.error.message || "Création de partie impossible.";
    if (message.includes("campaign_active") || message.includes("campaign_legacy_active")) throw new Error("Termine la campagne ou les cultures en cours avant d’en lancer une nouvelle.");
    if (message.includes("campaign_members") || message.includes("campaign_manifest")) throw new Error("Les affectations ont changé. Actualise la préparation de la campagne.");
    if (message.includes("request_mismatch")) throw new Error("Cette demande a déjà servi à une autre culture.");
    if (message.includes("zone_busy") || message.includes("zone_active_run")) throw new Error("Cette zone possède déjà une culture en cours.");
    if (message.includes("buddie_assigned") || message.includes("zone_buddie") || message.includes("warehouse_buddie_mismatch")) throw new Error("Le Buddie affecté à cette zone a changé. Actualise avant de lancer.");
    if (message.includes("buddie_in_use") || message.includes("kq_buddie_busy")) throw new Error("Ce Buddie participe déjà à une autre culture.");
    if (message.includes("deck_reserved") || message.includes("kq_deck_copy_reserved")) throw new Error("Des cartes du deck sont déjà réservées par une autre culture.");
    if (message.includes("warehouse_legacy_run_active")) throw new Error("Termine la culture historique avant de lancer une culture par zone.");
    if (message.includes("warehouse_zone_invalid")) throw new Error("Cette zone n’est plus disponible. Actualise l’entrepôt.");
    if (message.includes("kq_active_run_exists")) throw new Error("Une culture Supabase est déjà active.");
    if (message.includes("warehouse_layout_changed")) throw new Error("L’aménagement a changé. Actualise le devis avant de lancer.");
    if (message.includes("warehouse_capacity")) throw new Error("Agrandis le séchage ou libère du stockage pour cette récolte avant de lancer.");
    if (message.includes("kq_domiciliation_changed")) throw new Error("Ta domiciliation a changé. Actualise avant de lancer la culture.");
    if (message.includes("kq_production_units_changed") || message.includes("kq_culture_equipment_changed") || message.includes("kq_shared_equipment_changed") || message.includes("kq_culture_equipment_broken")) throw new Error("L’état du matériel a changé. Actualise le devis avant de lancer la culture.");
    if (message.includes("kq_buddie_rotation_locked")) {
      let remaining = KQ_BUDDIE_ROTATION_REQUIRED;
      try {
        const detail = JSON.parse(result.error.details ?? "{}");
        if (Number.isInteger(detail.remainingDistinctBuddies) && detail.remainingDistinctBuddies >= 1 && detail.remainingDistinctBuddies <= KQ_BUDDIE_ROTATION_REQUIRED) {
          remaining = detail.remainingDistinctBuddies;
        }
      } catch { /* Keep the full rotation when the database returns no structured detail. */ }
      throw new Error(getKqBuddieRotationMessage(remaining));
    }
    if (message.includes("kq_buddie_not_owned")) throw new Error("Ce Buddie n’est pas présent dans la collection.");
    if (message.includes("kq_deck_copy_missing")) throw new Error("Une ou plusieurs copies du deck ne sont pas disponibles.");
    if (message.includes("kq_culture_tokens_insufficient")) throw new Error("Solde de jetons Coup de pouce insuffisant.");
    if (message.includes("kq_heritage_inactive")) throw new Error("Cet Héritage n’est pas encore actif.");
    if (message.includes("kq_heritage_not_owned")) throw new Error("Cet Héritage n’est pas présent dans ta collection.");
    if (message.includes("kq_heritage_state_mismatch")) throw new Error("État Héritage invalide.");
    throw new Error(`[supabase:rpc_kq_start_run] ${message}`);
  }
  // Start triggers own first-culture eligibility; return their persisted state,
  // including changes preserved by the heritage wrapper, instead of our input.
  const persistedState = parseKqGameSave(encodeKqSave(result.data?.run?.state));
  if (!persistedState) throw new Error("[supabase:rpc_kq_start_run] État de culture persisté invalide.");
  return {
    ...mapKqStartRunResult(result.data), state: persistedState,
    buddieRotation: intention ? await getKqPlayerBuddieRotation(ownerId)
      : { ...buddieRotation, recentBuddieCodes: recordKqBuddieUse(input.buddieCode, buddieRotation.recentBuddieCodes) },
  };
}

export async function startKqAdminRun(adminEmail: string, input: KqStartRunInput) {
  const ownerId = await findKqUserIdByEmail(adminEmail);
  if (!ownerId) throw new Error("Compte collection admin introuvable.");
  return startKqPlayerRun(ownerId, input);
}

export type KqRunSelection = { runId?: string; zoneId?: string };

export function readKqRunSelection(request?: Request): KqRunSelection {
  const query = request ? new URL(request.url).searchParams : new URLSearchParams();
  const selection = { ...(query.has("runId") ? { runId: query.get("runId")! } : {}), ...(query.has("zoneId") ? { zoneId: query.get("zoneId")! } : {}) };
  if (selection.runId !== undefined && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(selection.runId)) throw new Error("Identifiant de culture invalide.");
  if (selection.zoneId !== undefined && (!selection.zoneId.trim() || selection.zoneId.length > 80)) throw new Error("Zone de culture invalide.");
  return selection;
}

export function selectKqActiveRun<T extends { runId: string; zoneId?: string | null; state?: KqGameState }>(runs: T[], selection: KqRunSelection = {}): T | null {
  const selected = selection.runId !== undefined || selection.zoneId !== undefined ? runs.find(run =>
    (selection.runId === undefined || run.runId === selection.runId || run.state?.campaign?.members.some(member => member.runId === selection.runId))
    && (selection.zoneId === undefined || run.zoneId === selection.zoneId || run.state?.campaign?.members.some(member => member.zoneId === selection.zoneId))) ?? null
    : runs.length === 1 ? runs[0] : runs.length && runs.every(run => run.state?.campaign?.id === runs[0].state?.campaign?.id) && runs[0].state?.campaign ? runs[0] : null;
  return selected?.state?.campaign ? runs.find(run => run.runId === selected.state!.campaign!.leaderRunId) ?? selected : selected;
}

async function readKqPlayerRuns(ownerId: string, selection?: KqRunSelection) {
  if (!/^[0-9a-f-]{36}$/i.test(ownerId)) throw new Error("Compte Kanab Quest invalide.");
  const supabase = createSupabaseServiceClient();
  // A shared manifest already describes every member. Read only tiny routing
  // metadata first, so a 52-zone campaign does not transfer/validate 52 copies.
  let metadataQuery = supabase.from("kq_runs")
    .select("id,campaign_leader_id:state->campaign->>leaderRunId")
    .eq("user_id", ownerId);
  metadataQuery = selection?.runId ? metadataQuery.eq("id", selection.runId) : metadataQuery.eq("status", "active");
  const metadata = await metadataQuery;
  if (metadata.error) throw new Error(`[supabase:kq_runs] ${metadata.error.message}`);
  const runIds = [...new Set((metadata.data ?? []).map(run => String(run.campaign_leader_id ?? run.id)))];
  if (!runIds.length) return [];
  if (runIds.some(id => !/^[0-9a-f-]{36}$/i.test(id))) throw new Error("État de culture Supabase invalide.");
  let query = supabase.from("kq_runs").select("id,state,started_at,updated_at")
    .eq("user_id", ownerId).in("id", runIds);
  // The campaign may finish between both reads; active lists must stay active.
  if (!selection?.runId) query = query.eq("status", "active");
  const runResult = await query.order("started_at", { ascending: true }).order("id", { ascending: true });
  if (runResult.error) throw new Error(`[supabase:kq_runs] ${runResult.error.message}`);
  if (!runResult.data?.length) return [];
  const receiptsResult = await supabase.from("kq_card_burn_receipts")
    .select("id,run_id,card_instance_id,card_code,stage_index,use_kind,burned_at")
    .eq("user_id", ownerId).in("run_id", runResult.data.map(run => run.id)).order("burned_at", { ascending: false });
  if (receiptsResult.error) throw new Error(`[supabase:kq_card_burn_receipts] ${receiptsResult.error.message}`);
  return runResult.data.map(run => {
    const state = parseKqGameSave(encodeKqSave(run.state));
    if (!state) throw new Error("État de culture Supabase invalide.");
    return {
    runId: String(run.id),
    zoneId: state.warehouse?.version === 2 ? state.warehouse.zoneId : null,
    buddieCode: state.varietyCode,
    state,
    startedAt: String(run.started_at),
    updatedAt: String(run.updated_at),
    burnReceipts: (receiptsResult.data ?? []).filter(receipt => receipt.run_id === run.id).map((receipt) => ({
      id: String(receipt.id), cardInstanceId: String(receipt.card_instance_id),
      cardCode: String(receipt.card_code), stageIndex: Number(receipt.stage_index),
      useKind: String(receipt.use_kind), burnedAt: String(receipt.burned_at),
    })),
  }; });
}

export async function getKqPlayerActiveRuns(ownerId: string) {
  return readKqPlayerRuns(ownerId);
}

export async function getKqPlayerActiveRun(ownerId: string, selection: KqRunSelection = {}) {
  const selected = selectKqActiveRun(await readKqPlayerRuns(ownerId, selection), selection);
  if (selected?.state.campaign && selected.runId !== selected.state.campaign.leaderRunId) {
    return selectKqActiveRun(await readKqPlayerRuns(ownerId, { runId: selected.state.campaign.leaderRunId }));
  }
  return selected;
}

export async function getKqPlayerRunsSnapshot(ownerId: string, selection: KqRunSelection = {}) {
  const activeRuns = await getKqPlayerActiveRuns(ownerId);
  const activeRun = selectKqActiveRun(activeRuns, selection)
    ?? (selection.runId ? await getKqPlayerActiveRun(ownerId, selection) : null);
  return { activeRun, activeRuns };
}

export async function getKqAdminActiveRuns(adminEmail: string) {
  const ownerId = await findKqUserIdByEmail(adminEmail);
  return ownerId ? getKqPlayerActiveRuns(ownerId) : [];
}

export async function getKqAdminActiveRun(adminEmail: string, selection: KqRunSelection = {}) {
  const ownerId = await findKqUserIdByEmail(adminEmail);
  return ownerId ? getKqPlayerActiveRun(ownerId, selection) : null;
}

export async function getKqAdminRunsSnapshot(adminEmail: string, selection: KqRunSelection = {}) {
  const ownerId = await findKqUserIdByEmail(adminEmail);
  return ownerId ? getKqPlayerRunsSnapshot(ownerId, selection) : { activeRun: null, activeRuns: [] };
}

export async function getKqPlayerFlowers(ownerId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(ownerId)) throw new Error("Compte Kanab Quest invalide.");
  const supabase = createSupabaseServiceClient();
  const [result, queueResult] = await Promise.all([
    supabase.from("kq_flowers")
      .select("id,run_id,variety_code,variety_name,quality,traits,combos,battle_stats,rules_version,cannabinoid_report,cultivation_profile,terpene_report,status,created_at,locked_at,burned_at")
      .eq("owner_id", ownerId)
      .in("status", ["available", "locked"])
      .order("created_at", { ascending: false })
      .limit(40),
    supabase.from("kq_random_battle_queue")
      .select("flower_id,queued_at")
      .eq("owner_id", ownerId),
  ]);
  if (result.error) throw new Error(`[supabase:kq_flowers] ${result.error.message}`);
  if (queueResult.error) throw new Error(`[supabase:kq_random_battle_queue] ${queueResult.error.message}`);
  const queuedFlowers = new Map((queueResult.data ?? []).map((entry) => (
    [String(entry.flower_id), String(entry.queued_at)] as const
  )));
  return (result.data ?? []).map((flower) => ({
    id: String(flower.id),
    runId: String(flower.run_id),
    varietyCode: String(flower.variety_code),
    varietyName: String(flower.variety_name),
    quality: Number(flower.quality),
    traits: Array.isArray(flower.traits) ? flower.traits.map(String) : [],
    combos: Array.isArray(flower.combos) ? flower.combos.map(String) : [],
    stats: flower.battle_stats && typeof flower.battle_stats === "object" ? flower.battle_stats : {},
    rulesVersion: Number(flower.rules_version ?? 2),
    cannabinoidReport: flower.cannabinoid_report ?? undefined,
    cultivationProfile: (flower.cultivation_profile ?? undefined) as KqFlowerCard["cultivationProfile"],
    terpeneReport: (flower.terpene_report ?? undefined) as KqFlowerCard["terpeneReport"],
    status: queuedFlowers.has(String(flower.id)) ? "queued" : String(flower.status),
    createdAt: String(flower.created_at),
    queuedAt: queuedFlowers.get(String(flower.id)) ?? null,
    lockedAt: flower.locked_at ? String(flower.locked_at) : null,
    burnedAt: flower.burned_at ? String(flower.burned_at) : null,
  }));
}

function isMissingKqPlayerCoreSnapshotRpc(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  const message = String(error.message ?? "").toLowerCase();
  return error.code === "PGRST202"
    || (message.includes("rpc_kq_player_core_snapshot")
      && (message.includes("schema cache") || message.includes("does not exist") || message.includes("could not find")));
}

export function mapKqPlayerCoreSnapshot(
  data: unknown,
  queuedFlowers: Iterable<{ flowerId: string; queuedAt: string }> = [],
  claimedChallengeCodes: Iterable<string> = [],
  selection: KqRunSelection = {},
) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Session Kanab Quest Supabase invalide.");
  }
  const payload = data as Record<string, unknown>;
  const rawRuns = Array.isArray(payload.activeRuns) ? payload.activeRuns : payload.activeRun ? [payload.activeRun] : [];
  const activeRuns = rawRuns.map(raw => {
    const rawRun = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : null;
    const state = rawRun ? parseKqGameSave(encodeKqSave(rawRun.state)) : null;
    if (!rawRun?.runId || !state) throw new Error("État de culture Supabase invalide.");
    const rawReceipts = rawRun && Array.isArray(rawRun.burnReceipts) ? rawRun.burnReceipts : [];
    return {
      runId: String(rawRun.runId),
      zoneId: state.warehouse?.version === 2 ? state.warehouse.zoneId : null,
      buddieCode: state.varietyCode,
      state,
      startedAt: String(rawRun.startedAt),
      updatedAt: String(rawRun.updatedAt),
      burnReceipts: rawReceipts.map((entry) => {
        const receipt = entry && typeof entry === "object" && !Array.isArray(entry)
          ? entry as Record<string, unknown>
          : {};
        return {
          id: String(receipt.id),
          cardInstanceId: String(receipt.cardInstanceId),
          cardCode: String(receipt.cardCode),
          stageIndex: Number(receipt.stageIndex),
          useKind: String(receipt.useKind),
          burnedAt: String(receipt.burnedAt),
        };
      }),
    };
  });
  const activeRun = selectKqActiveRun(activeRuns, selection);
  const queuedAtByFlowerId = new Map(Array.from(queuedFlowers, (flower) => [flower.flowerId, flower.queuedAt] as const));
  const flowers = (Array.isArray(payload.flowers) ? payload.flowers : []).map((entry) => {
    const flower = entry && typeof entry === "object" && !Array.isArray(entry)
      ? entry as Record<string, unknown>
      : {};
    return {
      id: String(flower.id),
      runId: String(flower.runId),
      varietyCode: String(flower.varietyCode),
      varietyName: String(flower.varietyName),
      quality: Number(flower.quality),
      traits: Array.isArray(flower.traits) ? flower.traits.map(String) : [],
      combos: Array.isArray(flower.combos) ? flower.combos.map(String) : [],
      stats: flower.stats && typeof flower.stats === "object" ? flower.stats : {},
      rulesVersion: Number(flower.rulesVersion ?? 2),
      cannabinoidReport: (flower.cannabinoidReport ?? undefined) as KqFlowerCard["cannabinoidReport"],
      cultivationProfile: (flower.cultivationProfile ?? undefined) as KqFlowerCard["cultivationProfile"],
      terpeneReport: (flower.terpeneReport ?? undefined) as KqFlowerCard["terpeneReport"],
      status: queuedAtByFlowerId.has(String(flower.id)) ? "queued" : String(flower.status),
      createdAt: String(flower.createdAt),
      queuedAt: queuedAtByFlowerId.get(String(flower.id)) ?? null,
      lockedAt: flower.lockedAt ? String(flower.lockedAt) : null,
      burnedAt: flower.burnedAt ? String(flower.burnedAt) : null,
    };
  });
  const mapSnapshotFlower = (value: unknown, ownerName: string) => {
    const flower = value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
    if (!flower?.id) return null;
    return mapKqOfficialFlowerCard({
      id: String(flower.id),
      variety_name: String(flower.variety_name),
      rules_version: Number(flower.rules_version ?? 2),
      quality: Number(flower.quality),
      traits: Array.isArray(flower.traits) ? flower.traits.map(String) : [],
      battle_stats: flower.battle_stats && typeof flower.battle_stats === "object"
        ? flower.battle_stats as Record<string, number>
        : {},
      status: String(flower.status),
      created_at: String(flower.created_at),
    }, ownerName);
  };
  const humanBattles = (Array.isArray(payload.humanBattles) ? payload.humanBattles : []).flatMap((entry) => {
    const battle = entry && typeof entry === "object" && !Array.isArray(entry)
      ? entry as Record<string, unknown>
      : null;
    if (!battle?.id) return [];
    const playerFlower = mapSnapshotFlower(battle.playerFlower, "Toi");
    const opponentFlower = mapSnapshotFlower(battle.opponentFlower, "Adversaire");
    if (!playerFlower || !opponentFlower) return [];
    const rounds = mapKqStoredBattleRounds(battle.rounds, battle.invertRounds === true);
    return [{
      id: String(battle.id),
      status: String(battle.status),
      seed: Number(battle.seed),
      playerFlower,
      opponentFlower,
      rounds,
      winner: battle.winner ? String(battle.winner) as "player" | "opponent" : null,
      lockedAt: String(battle.lockedAt),
      verdictAt: battle.verdictAt ? String(battle.verdictAt) : null,
      opponentType: "human" as const,
      experienceAwarded: battle.status === "verdict" ? getKqArenaExperienceAward(rounds) : 0,
    }];
  });
  const botBattles = (Array.isArray(payload.botBattles) ? payload.botBattles : []).flatMap((entry) => {
    const battle = entry && typeof entry === "object" && !Array.isArray(entry)
      ? entry as Record<string, unknown>
      : null;
    if (!battle?.id || !battle.opponentFlower || typeof battle.opponentFlower !== "object") return [];
    const playerFlower = mapSnapshotFlower(battle.playerFlower, "Toi");
    if (!playerFlower) return [];
    return [{
      id: String(battle.id),
      status: "verdict",
      seed: Number(battle.seed),
      playerFlower,
      opponentFlower: mapKqHistoryFlowerCard(battle.opponentFlower as KqFlowerCard),
      rounds: mapKqStoredBattleRounds(battle.rounds, false),
      winner: String(battle.winner) as "player" | "opponent",
      lockedAt: String(battle.lockedAt),
      verdictAt: String(battle.verdictAt),
      opponentType: "bot" as const,
      experienceAwarded: Number(battle.experienceAwarded),
    }];
  });
  const battles = selectKqBattleHistory([...humanBattles, ...botBattles], 12);
  const rawProgress = payload.progress && typeof payload.progress === "object" && !Array.isArray(payload.progress)
    ? payload.progress as Record<string, unknown>
    : null;
  const rating = Number(rawProgress?.rating ?? 0);
  const league = rawProgress ? getKqLeague(rating) : null;
  const progress = rawProgress && league ? {
    seasonCode: String(rawProgress.seasonCode),
    rank: rawProgress.rank === null || rawProgress.rank === undefined ? null : Number(rawProgress.rank),
    rating,
    seasonPoints: Number(rawProgress.seasonPoints),
    reputation: Number(rawProgress.reputation ?? 0),
    businessScore: Number(rawProgress.businessScore ?? 0),
    placardScore: Number(rawProgress.placardScore ?? calculateKqPlacardScore({
      rating,
      seasonPoints: Number(rawProgress.seasonPoints),
      reputation: Number(rawProgress.reputation ?? 0),
      businessScore: Number(rawProgress.businessScore ?? 0),
    }).score),
    wins: Number(rawProgress.wins),
    losses: Number(rawProgress.losses),
    streak: Number(rawProgress.streak),
    arenaExperience: Number(rawProgress.arenaExperience ?? 0),
    burnedFlowers: Number(rawProgress.burnedFlowers),
    league: league.name,
    leagueProgress: league.progress,
    pointsToNextLeague: league.pointsToNext,
    leaderboardGeneratedAt: rawProgress.leaderboardGeneratedAt
      ? String(rawProgress.leaderboardGeneratedAt)
      : null,
    claimedChallengeCodes: [...new Set(Array.from(claimedChallengeCodes, String))],
    updatedAt: String(rawProgress.updatedAt),
  } : null;
  return { activeRun, activeRuns, flowers, battles, progress };
}

export function mapKqChallengeClaimKeys(rows: unknown) {
  if (!Array.isArray(rows)) return [];
  return [...new Set(rows.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const claim = entry as Record<string, unknown>;
    const day = String(claim.challenge_day ?? "");
    const code = String(claim.challenge_code ?? "");
    return /^\d{4}-\d{2}-\d{2}$/.test(day) && /^[a-z0-9-]+$/.test(code)
      ? [`${day}:${code}`]
      : [];
  }))];
}

export async function getKqPlayerCoreSnapshot(ownerId: string, selection: KqRunSelection = {}) {
  if (!/^[0-9a-f-]{36}$/i.test(ownerId)) throw new Error("Compte Kanab Quest invalide.");
  const supabase = createSupabaseServiceClient();
  const [result, queueResult, claimsResult, runs] = await Promise.all([
    supabase.rpc("rpc_kq_player_core_snapshot", { p_user_id: ownerId }),
    supabase.from("kq_random_battle_queue").select("flower_id,queued_at").eq("owner_id", ownerId),
    supabase.from("kq_daily_challenge_claims").select("challenge_day,challenge_code")
      .eq("user_id", ownerId).order("challenge_day", { ascending: false }).limit(64),
    getKqPlayerRunsSnapshot(ownerId, selection),
  ]);
  if (queueResult.error) throw new Error(`[supabase:kq_random_battle_queue] ${queueResult.error.message}`);
  if (claimsResult.error) throw new Error(`[supabase:kq_daily_challenge_claims] ${claimsResult.error.message}`);
  if (!result.error) return { ...mapKqPlayerCoreSnapshot(
    { ...result.data, activeRuns: runs.activeRuns },
    (queueResult.data ?? []).map((entry) => ({
      flowerId: String(entry.flower_id),
      queuedAt: String(entry.queued_at),
    })),
    mapKqChallengeClaimKeys(claimsResult.data),
    selection,
  ), ...runs };
  if (!isMissingKqPlayerCoreSnapshotRpc(result.error)) {
    throw new Error(`[supabase:rpc_kq_player_core_snapshot] ${result.error.message}`);
  }
  const [flowers, battles, progress] = await Promise.all([
    getKqPlayerFlowers(ownerId),
    getKqPlayerBattles(ownerId, 12),
    getKqPlayerProgress(ownerId),
  ]);
  return { ...runs, flowers, battles, progress };
}

export async function getKqAdminFlowers(adminEmail: string) {
  const ownerId = await findKqUserIdByEmail(adminEmail);
  return ownerId ? getKqPlayerFlowers(ownerId) : [];
}

export async function getKqRandomBattleQueueHealth(): Promise<KqRandomQueueHealth> {
  const supabase = createSupabaseServiceClient();
  const queueResult = await supabase.from("kq_random_battle_queue")
    .select("flower_id,queued_at")
    .order("queued_at", { ascending: true })
    .limit(1_001);
  if (queueResult.error) throw new Error(`[supabase:kq_random_battle_queue] ${queueResult.error.message}`);

  const rawQueueRows = queueResult.data ?? [];
  const truncated = rawQueueRows.length > 1_000;
  const queueRows = rawQueueRows.slice(0, 1_000).map((row) => ({
    flowerId: String(row.flower_id),
    queuedAt: String(row.queued_at),
  }));
  if (queueRows.length === 0) return buildKqRandomQueueHealth([], [], new Date(), truncated);

  const flowersResult = await supabase.from("kq_flowers")
    .select("id,quality")
    .in("id", queueRows.map((row) => row.flowerId));
  if (flowersResult.error) throw new Error(`[supabase:kq_flowers] ${flowersResult.error.message}`);
  return buildKqRandomQueueHealth(
    queueRows,
    (flowersResult.data ?? []).map((flower) => ({
      id: String(flower.id),
      quality: Number(flower.quality),
    })),
    new Date(),
    truncated,
  );
}

export async function getKqAdminBotBattleDashboard() {
  const supabase = createSupabaseServiceClient();
  const parisDay = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  const [todayResult, recentResult, profilesResult] = await Promise.all([
    supabase.from("kq_bot_battles")
      .select("user_id,experience_awarded,verdict_at")
      .gte("verdict_at", new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString()),
    supabase.from("kq_bot_battles")
      .select("id,user_id,bot_code,winner,experience_awarded,verdict_at")
      .order("verdict_at", { ascending: false }).limit(20),
    supabase.from("kq_rank_profiles").select("arena_experience").limit(10000),
  ]);
  if (todayResult.error) throw new Error(`[supabase:kq_bot_battles:admin-today] ${todayResult.error.message}`);
  if (recentResult.error) throw new Error(`[supabase:kq_bot_battles:admin-recent] ${recentResult.error.message}`);
  if (profilesResult.error) throw new Error(`[supabase:kq_rank_profiles:arena-experience] ${profilesResult.error.message}`);
  const todayBattles = (todayResult.data ?? []).filter((battle) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date(String(battle.verdict_at))) === parisDay);
  const counts = new Map<string, number>();
  for (const battle of todayBattles) {
    const userId = String(battle.user_id);
    counts.set(userId, (counts.get(userId) ?? 0) + 1);
  }
  const players = [...counts.entries()]
    .map(([userId, count]) => ({ userId, count, remaining: Math.max(0, 10 - count), atLimit: count >= 10 }))
    .sort((left, right) => right.count - left.count);
  return {
    dayKey: parisDay,
    dailyLimit: 10,
    battlesToday: todayBattles.length,
    activePlayersToday: counts.size,
    playersAtLimit: players.filter((player) => player.atLimit).length,
    experienceAwardedToday: todayBattles.reduce((sum, battle) => sum + Number(battle.experience_awarded ?? 0), 0),
    totalArenaExperience: (profilesResult.data ?? []).reduce((sum, profile) => sum + Number(profile.arena_experience ?? 0), 0),
    players,
    recent: (recentResult.data ?? []).map((battle) => ({
      id: String(battle.id),
      userId: String(battle.user_id),
      botCode: String(battle.bot_code),
      winner: String(battle.winner),
      experienceAwarded: Number(battle.experience_awarded),
      verdictAt: String(battle.verdict_at),
    })),
  };
}

const KQ_TRAINING_BOTS = [
  { code: "bot-sylvain", name: "Sylvain · Jardin d’essai", variety: "Harlequin", salt: 11 },
  { code: "bot-charles", name: "Charles · Serre du club", variety: "Cannatonic", salt: 37 },
  { code: "bot-maya", name: "Maya · Atelier botanique", variety: "Sour Tsunami", salt: 71 },
] as const;

export function getKqRandomTrainingBotCode(ownerId: string, flowerId: string, dayKey: string) {
  const hash = [...`${ownerId}:${flowerId}:${dayKey}`]
    .reduce((value, character) => ((value * 31) + character.charCodeAt(0)) | 0, 17);
  return KQ_TRAINING_BOTS[Math.abs(hash) % KQ_TRAINING_BOTS.length].code;
}

export async function getKqPlayerFlowerRivals(ownerId: string, flowerId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(ownerId)) throw new Error("Compte Kanab Quest invalide.");
  if (!/^[0-9a-f-]{36}$/i.test(flowerId)) throw new Error("Fleur invalide.");
  const supabase = createSupabaseServiceClient();
  const ownResult = await supabase.from("kq_flowers").select("id,quality,status,rules_version")
    .eq("id", flowerId).eq("owner_id", ownerId).maybeSingle();
  if (ownResult.error) throw new Error(`[supabase:kq_flowers] ${ownResult.error.message}`);
  if (!ownResult.data || ownResult.data.status !== "available") throw new Error("Cette Fleur n’est pas disponible.");
  const quality = Number(ownResult.data.quality);
  const rulesVersion = ownResult.data.rules_version === 3 ? 3 : 2;

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const botCountResult = await supabase.from("kq_bot_battles")
    .select("id", { count: "exact", head: true })
    .eq("user_id", ownerId)
    .gte("verdict_at", todayStart.toISOString());
  if (botCountResult.error) throw new Error(`[supabase:kq_bot_battles:daily] ${botCountResult.error.message}`);
  const remaining = Math.max(0, 10 - Number(botCountResult.count ?? 0));
  if (remaining === 0) return [];
  const botSeed = Math.abs([...`${flowerId}:${new Date().toISOString().slice(0, 10)}`]
    .reduce((hash, char) => ((hash * 31) + char.charCodeAt(0)) | 0, 17));
  return KQ_TRAINING_BOTS.map((definition, index) => {
    const bot = createKqOpponent(botSeed + index * 97, {
      ownerName: definition.name,
      variety: definition.variety,
      rating: 1000 + (quality - 12) * 12,
      rulesVersion,
    });
    return {
      flowerId: `bot:${definition.code}`,
      varietyName: bot.variety,
      quality: Math.max(quality - 3, Math.min(quality + 3, Math.round((Object.values(bot.stats).reduce((sum, value) => sum + value, 0) / Object.values(bot.stats).length - 52) / 2.4))),
      traits: bot.traits,
      stats: bot.stats,
      rulesVersion: bot.rulesVersion,
      cannabinoidReport: bot.cannabinoidReport,
      createdAt: new Date().toISOString(),
      opponentType: "bot" as const,
      opponentName: definition.name,
      experienceReward: KQ_REWARD_BALANCE.training.arenaExperience.min,
      remainingBotDuels: remaining,
    };
  });
}

export async function finalizeKqPlayerBotBattle(ownerId: string, flowerId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(ownerId) || !/^[0-9a-f-]{36}$/i.test(flowerId)) throw new Error("Duel d’entraînement invalide.");
  const dayKey = getKqChallengeDayKey();
  const botCode = getKqRandomTrainingBotCode(ownerId, flowerId, dayKey);
  const definition = KQ_TRAINING_BOTS.find((bot) => bot.code === botCode)!;
  const supabase = createSupabaseServiceClient();
  const flowerResult = await supabase.from("kq_flowers")
    .select("id,run_id,variety_name,quality,traits,battle_stats,rules_version,cannabinoid_report,cultivation_profile,terpene_report,status,created_at")
    .eq("id", flowerId).eq("owner_id", ownerId).maybeSingle();
  if (flowerResult.error) throw new Error(`[supabase:kq_flowers:bot] ${flowerResult.error.message}`);
  if (!flowerResult.data || flowerResult.data.status !== "available") throw new Error("Ta Fleur n’est plus disponible.");
  const row = flowerResult.data as KqFlowerBattleRow & { run_id: string };
  const runResult = await supabase.from("kq_runs").select("state,challenge_day")
    .eq("id", row.run_id).eq("user_id", ownerId).maybeSingle();
  if (runResult.error) throw new Error(`[supabase:kq_runs:bot] ${runResult.error.message}`);
  const game = runResult.data ? parseKqGameSave(encodeKqSave(runResult.data.state)) : null;
  if (!game || !runResult.data?.challenge_day) throw new Error("État de culture du duel introuvable.");
  const playerFlower = mapKqOfficialFlowerCard(row, "Toi");
  const seed = Math.abs((Date.now() & 0x7fffffff) + definition.salt);
  const opponentFlower = createKqOpponent(seed, {
    ownerName: definition.name,
    variety: definition.variety,
    rating: 1000 + (Number(row.quality) - 12) * 12,
    rulesVersion: row.rules_version === 3 ? 3 : 2,
  });
  const verdict = resolveKqBattle(lockKqBattle(playerFlower, opponentFlower, seed), seed, new Date());
  if (!verdict.winner || !verdict.burnedAt) throw new Error("Le bot n’a pas produit de verdict.");
  const challengeDay = String(runResult.data.challenge_day);
  const challengeResults = evaluateKqChallenges(game, verdict, new Date(`${challengeDay}T12:00:00Z`));
  const completedChallengeCodes = challengeResults
    .filter((challenge) => challenge.completed)
    .map((challenge) => challenge.code);
  const result = await supabase.rpc("rpc_kq_finalize_bot_battle_with_challenges", {
    p_user_id: ownerId,
    p_flower_id: flowerId,
    p_bot_code: botCode,
    p_bot_flower: opponentFlower,
    p_seed: seed,
    p_rounds: verdict.rounds,
    p_winner: verdict.winner,
    p_challenge_day: challengeDay,
    p_challenge_codes: completedChallengeCodes,
  });
  if (result.error) {
    const message = result.error.message || "Duel d’entraînement impossible.";
    if (message.includes("kq_bot_daily_limit")) throw new Error("Tes 10 duels contre des bots ont déjà été joués aujourd’hui.");
    if (message.includes("kq_flower_unavailable")) throw new Error("Ta Fleur n’est plus disponible.");
    throw new Error(`[supabase:rpc_kq_finalize_bot_battle_with_challenges] ${message}`);
  }
  const payload = result.data as Record<string, unknown>;
  const rewardPayload = payload.rewardCard && typeof payload.rewardCard === "object"
    ? payload.rewardCard as Record<string, unknown>
    : null;
  return {
    battleId: String(payload.battleId),
    status: "verdict" as const,
    rounds: verdict.rounds,
    winner: verdict.winner,
    burnedAt: String(payload.verdictAt),
    experienceAwarded: Number(payload.experienceAwarded ?? KQ_REWARD_BALANCE.training.arenaExperience.min),
    todayCount: Number(payload.todayCount),
    dailyLimit: Number(payload.dailyLimit ?? 10),
    playerFlower,
    opponentFlower,
    opponentType: "bot" as const,
    challengePoints: Number(payload.challengePoints ?? 0),
    claimedChallengeCodes: Array.isArray(payload.claimedChallengeCodes)
      ? payload.claimedChallengeCodes.map(String)
      : [],
    completedChallenges: challengeResults.filter((challenge) => challenge.completed).map((challenge) => ({
      code: challenge.code,
      title: challenge.title,
      points: challenge.points,
    })),
    rewardCard: rewardPayload ? {
      code: String(rewardPayload.code),
      name: String(rewardPayload.name),
      rarity: String(rewardPayload.rarity),
      description: String(rewardPayload.description ?? ""),
      imageUrl: String(rewardPayload.imageUrl ?? ""),
    } : null,
  };
}

export async function getKqAdminFlowerRivals(adminEmail: string, flowerId: string) {
  const ownerId = await findKqUserIdByEmail(adminEmail);
  if (!ownerId) throw new Error("Compte collection admin introuvable.");
  return getKqPlayerFlowerRivals(ownerId, flowerId);
}

export type KqRandomBattleQueueResult = {
  matchStatus: "queued";
  flowerId: string;
  queuedAt: string;
  replayed: boolean;
} | {
  matchStatus: "matched";
  flowerId: string;
  opponentFlowerId: string;
  battleId: string;
  matchedAt: string;
  verdictPending: boolean;
  verdict: KqAdminBattleVerdictReceipt | null;
};

export async function enqueueKqPlayerRandomBattle(
  ownerId: string,
  flowerId: string,
): Promise<KqRandomBattleQueueResult> {
  if (!/^[0-9a-f-]{36}$/i.test(ownerId)) throw new Error("Compte Kanab Quest invalide.");
  if (!/^[0-9a-f-]{36}$/i.test(flowerId)) throw new Error("Fleur invalide.");
  const result = await createSupabaseServiceClient().rpc("rpc_kq_enqueue_random_battle", {
    p_player_id: ownerId,
    p_flower_id: flowerId,
  });
  if (result.error) {
    const message = result.error.message || "File de duel indisponible.";
    if (message.includes("kq_random_queue_flower_not_owned")) throw new Error("Cette Fleur ne t’appartient pas.");
    if (message.includes("kq_random_queue_owner_already_waiting")) throw new Error("Tu as déjà une Fleur dans la file aléatoire.");
    if (message.includes("kq_random_queue_flower_unavailable")) throw new Error("Cette Fleur n’est plus disponible.");
    if (message.includes("kq_random_queue_candidate_taken")) throw new Error("Un autre duel vient de prendre cette place. Relance la recherche.");
    throw new Error(`[supabase:rpc_kq_enqueue_random_battle] ${message}`);
  }
  const payload = result.data && typeof result.data === "object" && !Array.isArray(result.data)
    ? result.data as Record<string, unknown>
    : {};
  if (payload.matchStatus === "queued" && payload.flowerId && payload.queuedAt) {
    return {
      matchStatus: "queued",
      flowerId: String(payload.flowerId),
      queuedAt: String(payload.queuedAt),
      replayed: payload.replayed === true,
    };
  }
  if (payload.matchStatus !== "matched" || !payload.battleId || !payload.opponentFlowerId) {
    throw new Error("Réponse de file aléatoire invalide.");
  }
  const battleId = String(payload.battleId);
  try {
    const verdict = await finalizeKqPlayerBattle(ownerId, battleId);
    return {
      matchStatus: "matched",
      flowerId: String(payload.flowerId),
      opponentFlowerId: String(payload.opponentFlowerId),
      battleId,
      matchedAt: String(payload.matchedAt),
      verdictPending: false,
      verdict,
    };
  } catch {
    return {
      matchStatus: "matched",
      flowerId: String(payload.flowerId),
      opponentFlowerId: String(payload.opponentFlowerId),
      battleId,
      matchedAt: String(payload.matchedAt),
      verdictPending: true,
      verdict: null,
    };
  }
}

export async function reconcileKqPlayerRandomBattleQueue(
  ownerId: string,
  flowerId: string,
): Promise<KqRandomBattleQueueResult | { matchStatus: "idle" }> {
  if (!/^[0-9a-f-]{36}$/i.test(ownerId)) throw new Error("Compte Kanab Quest invalide.");
  if (!/^[0-9a-f-]{36}$/i.test(flowerId)) throw new Error("Fleur invalide.");
  const result = await createSupabaseServiceClient().rpc("rpc_kq_poll_random_battle_queue", {
    p_player_id: ownerId,
    p_flower_id: flowerId,
  });
  if (result.error) throw new Error(`[supabase:rpc_kq_poll_random_battle_queue] ${result.error.message}`);
  const queue = result.data as { matchStatus?: string; queuedAt?: string; retryMatch?: boolean } | null;
  if (queue?.matchStatus === "idle") return { matchStatus: "idle" };
  if (queue?.matchStatus !== "queued" || !queue.queuedAt) throw new Error("Réponse de file aléatoire invalide.");
  if (queue.retryMatch === true) return enqueueKqPlayerRandomBattle(ownerId, flowerId);
  return { matchStatus: "queued", flowerId, queuedAt: queue.queuedAt, replayed: true };
}

export async function leaveKqPlayerRandomBattleQueue(ownerId: string, flowerId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(ownerId)) throw new Error("Compte Kanab Quest invalide.");
  if (!/^[0-9a-f-]{36}$/i.test(flowerId)) throw new Error("Fleur invalide.");
  const result = await createSupabaseServiceClient().rpc("rpc_kq_leave_random_battle_queue", {
    p_player_id: ownerId,
    p_flower_id: flowerId,
  });
  if (result.error) {
    const message = result.error.message || "Sortie de file impossible.";
    if (message.includes("kq_random_queue_already_matched")) {
      throw new Error("Le duel vient d’être formé : cette Fleur ne peut plus quitter la file.");
    }
    if (message.includes("kq_random_queue_flower_not_owned")) throw new Error("Cette Fleur ne t’appartient pas.");
    throw new Error(`[supabase:rpc_kq_leave_random_battle_queue] ${message}`);
  }
  const payload = result.data && typeof result.data === "object" && !Array.isArray(result.data)
    ? result.data as Record<string, unknown>
    : {};
  return {
    left: payload.left === true,
    flowerId: String(payload.flowerId ?? flowerId),
    replayed: payload.replayed === true,
  };
}

export async function enqueueKqAdminRandomBattle(adminEmail: string, flowerId: string) {
  const ownerId = await findKqUserIdByEmail(adminEmail);
  if (!ownerId) throw new Error("Compte collection admin introuvable.");
  return enqueueKqPlayerRandomBattle(ownerId, flowerId);
}

export async function reconcileKqAdminRandomBattleQueue(adminEmail: string, flowerId: string) {
  const ownerId = await findKqUserIdByEmail(adminEmail);
  if (!ownerId) throw new Error("Compte collection admin introuvable.");
  return reconcileKqPlayerRandomBattleQueue(ownerId, flowerId);
}

export async function leaveKqAdminRandomBattleQueue(adminEmail: string, flowerId: string) {
  const ownerId = await findKqUserIdByEmail(adminEmail);
  if (!ownerId) throw new Error("Compte collection admin introuvable.");
  return leaveKqPlayerRandomBattleQueue(ownerId, flowerId);
}

type KqFlowerBattleRow = {
  id: string; variety_name: string; quality: number; traits: string[];
  rules_version?: number;
  cannabinoid_report?: KqFlowerCard["cannabinoidReport"];
  cultivation_profile?: KqFlowerCard["cultivationProfile"];
  terpene_report?: KqFlowerCard["terpeneReport"];
  battle_stats: Record<string, number>; status: string; created_at: string;
};

function mapKqOfficialFlowerCard(row: KqFlowerBattleRow, ownerName: string): KqFlowerCard {
  return {
    id: row.id, ownerName, variety: row.variety_name,
    tier: getKqHarvestTier(row.quality),
    status: row.status as KqFlowerCard["status"],
    createdAt: row.created_at, integrityCode: `DB-${row.id.slice(0, 8).toUpperCase()}`,
    traits: Array.isArray(row.traits) ? row.traits : [],
    stats: row.battle_stats as KqFlowerCard["stats"],
    rulesVersion: row.rules_version === 3 ? 3 : 2,
    ...(row.cannabinoid_report ? { cannabinoidReport: row.cannabinoid_report } : {}),
    ...(row.cultivation_profile ? { cultivationProfile: row.cultivation_profile } : {}),
    ...(row.terpene_report ? { terpeneReport: row.terpene_report } : {}),
  };
}

/** History uses stored scores; detailed reports stay on the authoritative verdict read. */
function mapKqHistoryFlowerCard(flower: KqFlowerCard): KqFlowerCard {
  return {
    id: flower.id,
    ownerName: flower.ownerName,
    variety: flower.variety,
    tier: flower.tier,
    status: flower.status,
    createdAt: flower.createdAt,
    integrityCode: flower.integrityCode,
    traits: flower.traits,
    stats: flower.stats,
    rulesVersion: flower.rulesVersion,
  };
}

export function mapKqStoredBattleRounds(rawRounds: unknown, invert: boolean): KqBattle["rounds"] {
  if (!Array.isArray(rawRounds)) return [];
  const rounds = rawRounds as KqBattle["rounds"];
  if (!invert) return rounds;
  return rounds.map((round) => ({
    ...round,
    playerScore: round.opponentScore,
    opponentScore: round.playerScore,
    winner: round.winner === "player" ? "opponent" : "player",
  }));
}

export async function getKqPlayerBattles(ownerId: string, limit = KQ_BATTLE_HISTORY_LIMIT) {
  if (!/^[0-9a-f-]{36}$/i.test(ownerId)) throw new Error("Compte Kanab Quest invalide.");
  if (!Number.isInteger(limit) || limit < 1 || limit > KQ_BATTLE_HISTORY_LIMIT) throw new Error("Limite de duels invalide.");
  const supabase = createSupabaseServiceClient();
  const humanColumns = "id,player_one_id,player_two_id,flower_one_id,flower_two_id,status,seed,rounds,winner_id,locked_at,verdict_at";
  const [battlesResult, cancelledResult, pendingResult, botResult] = await Promise.all([
    supabase.from("kq_battles").select(humanColumns)
      .or(`player_one_id.eq.${ownerId},player_two_id.eq.${ownerId}`)
      .eq("status", "verdict")
      .order("verdict_at", { ascending: false }).order("id", { ascending: false }).limit(limit),
    supabase.from("kq_battles").select(humanColumns)
      .or(`player_one_id.eq.${ownerId},player_two_id.eq.${ownerId}`)
      .eq("status", "cancelled")
      .order("locked_at", { ascending: false }).order("id", { ascending: false }).limit(limit),
    // A recent-history cap must never hide an older duel still awaiting its verdict.
    supabase.from("kq_battles").select(humanColumns)
      .or(`player_one_id.eq.${ownerId},player_two_id.eq.${ownerId}`)
      .eq("status", "locked")
      .order("locked_at", { ascending: false }).order("id", { ascending: false }),
    supabase.from("kq_bot_battles")
      .select("id,flower_id,bot_flower,seed,rounds,winner,experience_awarded,verdict_at")
      .eq("user_id", ownerId)
      .order("verdict_at", { ascending: false }).order("id", { ascending: false }).limit(limit),
  ]);
  if (battlesResult.error) throw new Error(`[supabase:kq_battles] ${battlesResult.error.message}`);
  if (cancelledResult.error) throw new Error(`[supabase:kq_battles:cancelled] ${cancelledResult.error.message}`);
  if (pendingResult.error) throw new Error(`[supabase:kq_battles:pending] ${pendingResult.error.message}`);
  if (botResult.error) throw new Error(`[supabase:kq_bot_battles:history] ${botResult.error.message}`);
  // If a verdict commits between the two reads, prefer its completed receipt.
  const humanRows = [...new Map([...(pendingResult.data ?? []), ...(cancelledResult.data ?? []), ...(battlesResult.data ?? [])]
    .map((battle) => [battle.id, battle])).values()];
  const candidates = selectKqBattleHistory([
    ...humanRows.map((row) => ({
      id: String(row.id), status: String(row.status), lockedAt: String(row.locked_at),
      verdictAt: row.verdict_at ? String(row.verdict_at) : null,
      opponentType: "human" as const, row,
    })),
    ...(botResult.data ?? []).map((row) => ({
      id: String(row.id), status: "verdict", lockedAt: String(row.verdict_at),
      verdictAt: String(row.verdict_at),
      opponentType: "bot" as const, row,
    })),
  ], limit);
  const flowerIds = [...new Set(candidates.flatMap((battle) => battle.opponentType === "human"
    ? [battle.row.flower_one_id, battle.row.flower_two_id]
    : [battle.row.flower_id]))];
  const flowersResult = flowerIds.length > 0
    ? await supabase.from("kq_flowers")
      .select("id,variety_name,quality,traits,battle_stats,rules_version,status,created_at").in("id", flowerIds)
    : { data: [], error: null };
  if (flowersResult.error) throw new Error(`[supabase:kq_flowers:battles] ${flowersResult.error.message}`);
  const flowers = new Map((flowersResult.data ?? []).map((flower) => [flower.id, flower as KqFlowerBattleRow]));
  type HistoryBattle = NonNullable<Awaited<ReturnType<typeof getKqPlayerBattle>>> & {
    opponentType: "human" | "bot"; experienceAwarded: number;
  };
  return candidates.flatMap<HistoryBattle>((candidate) => {
    if (candidate.opponentType === "bot") {
      const battle = candidate.row;
      const playerFlower = flowers.get(battle.flower_id);
      const opponentFlower = battle.bot_flower && typeof battle.bot_flower === "object"
        ? mapKqHistoryFlowerCard(battle.bot_flower as KqFlowerCard)
        : null;
      if (!playerFlower || !opponentFlower) return [];
      return [{
        id: String(battle.id),
        status: "verdict",
        seed: Number(battle.seed),
        playerFlower: mapKqOfficialFlowerCard(playerFlower, "Toi"),
        opponentFlower,
        rounds: mapKqStoredBattleRounds(battle.rounds, false),
        winner: String(battle.winner) as "player" | "opponent",
        lockedAt: String(battle.verdict_at),
        verdictAt: String(battle.verdict_at),
        opponentType: "bot" as const,
        experienceAwarded: Number(battle.experience_awarded),
      }];
    }
    const battle = candidate.row;
    const playerIsOne = battle.player_one_id === ownerId;
    const playerFlower = flowers.get(playerIsOne ? battle.flower_one_id : battle.flower_two_id);
    const opponentFlower = flowers.get(playerIsOne ? battle.flower_two_id : battle.flower_one_id);
    if (!playerFlower || !opponentFlower) return [];
    const rounds = mapKqStoredBattleRounds(battle.rounds, !playerIsOne);
    return [{
      id: String(battle.id), status: String(battle.status), seed: Number(battle.seed),
      playerFlower: mapKqOfficialFlowerCard(playerFlower, "Toi"),
      opponentFlower: mapKqOfficialFlowerCard(opponentFlower, "Adversaire"),
      rounds,
      winner: battle.winner_id ? (battle.winner_id === ownerId ? "player" : "opponent") : null,
      lockedAt: String(battle.locked_at),
      verdictAt: battle.verdict_at ? String(battle.verdict_at) : null,
      opponentType: "human" as const,
      experienceAwarded: battle.status === "verdict" ? getKqArenaExperienceAward(rounds) : 0,
    }];
  });
}

export async function getKqPlayerBattle(ownerId: string, battleId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(ownerId)) throw new Error("Compte Kanab Quest invalide.");
  if (!/^[0-9a-f-]{36}$/i.test(battleId)) throw new Error("Duel invalide.");
  const supabase = createSupabaseServiceClient();
  const battleResult = await supabase.from("kq_battles")
    .select("id,player_one_id,player_two_id,flower_one_id,flower_two_id,status,seed,rounds,winner_id,locked_at,verdict_at")
    .eq("id", battleId)
    .or(`player_one_id.eq.${ownerId},player_two_id.eq.${ownerId}`)
    .maybeSingle();
  if (battleResult.error) throw new Error(`[supabase:kq_battles] ${battleResult.error.message}`);
  const battle = battleResult.data;
  if (!battle) return null;
  const flowerIds = [battle.flower_one_id, battle.flower_two_id];
  const flowersResult = await supabase.from("kq_flowers")
    .select("id,variety_name,quality,traits,battle_stats,rules_version,cannabinoid_report,cultivation_profile,terpene_report,status,created_at")
    .in("id", flowerIds);
  if (flowersResult.error) throw new Error(`[supabase:kq_flowers:battle] ${flowersResult.error.message}`);
  const flowers = new Map((flowersResult.data ?? []).map((flower) => [flower.id, flower as KqFlowerBattleRow]));
  const playerIsOne = battle.player_one_id === ownerId;
  const playerFlower = flowers.get(playerIsOne ? battle.flower_one_id : battle.flower_two_id);
  const opponentFlower = flowers.get(playerIsOne ? battle.flower_two_id : battle.flower_one_id);
  if (!playerFlower || !opponentFlower) return null;
  return {
    id: String(battle.id),
    status: String(battle.status),
    seed: Number(battle.seed),
    playerFlower: mapKqOfficialFlowerCard(playerFlower, "Toi"),
    opponentFlower: mapKqOfficialFlowerCard(opponentFlower, "Adversaire"),
    rounds: mapKqStoredBattleRounds(battle.rounds, !playerIsOne),
    winner: battle.winner_id ? (battle.winner_id === ownerId ? "player" as const : "opponent" as const) : null,
    lockedAt: String(battle.locked_at),
    verdictAt: battle.verdict_at ? String(battle.verdict_at) : null,
  };
}

export async function getKqAdminBattles(adminEmail: string) {
  const ownerId = await findKqUserIdByEmail(adminEmail);
  return ownerId ? getKqPlayerBattles(ownerId) : [];
}

type KqAdminBattleVerdictReceipt = {
  battleId: string;
  status: "verdict";
  rounds: KqBattle["rounds"];
  winner: "player" | "opponent";
  burnedAt: string;
  experienceAwarded: number;
  challengePoints: number;
  opponentChallengePoints: number;
  completedChallenges: Array<{ code: string; title: string; points: number }>;
  pvpBoosterGranted: boolean;
  pvpBoosterCardCount: number;
  rankProfile: null | {
    rating: number; seasonPoints: number; wins: number;
    losses: number; streak: number; burnedFlowers: number;
  };
  replayed: boolean;
};

export async function expireKqAbandonedBattles(hours = 48, limit = 100) {
  if (!Number.isInteger(hours) || hours < 24 || hours > 168) throw new Error("Délai d’expiration des duels invalide.");
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error("Taille du lot d’expiration invalide.");
  const supabase = createSupabaseServiceClient();
  const result = await supabase.rpc("rpc_kq_expire_battles", {
    p_expired_before: new Date(Date.now() - hours * 60 * 60 * 1000).toISOString(),
    p_limit: limit,
  });
  if (result.error) throw new Error(`[supabase:rpc_kq_expire_battles] ${result.error.message}`);
  const payload = result.data && typeof result.data === "object" && !Array.isArray(result.data)
    ? result.data as Record<string, unknown>
    : {};
  return {
    expiredCount: Number(payload.expiredCount ?? 0),
    battleIds: Array.isArray(payload.battleIds) ? payload.battleIds.map(String) : [],
    hasMore: payload.hasMore === true,
    skipped: payload.skipped === true,
  };
}

export async function finalizeKqPlayerBattle(
  ownerId: string,
  battleId: string,
): Promise<KqAdminBattleVerdictReceipt> {
  if (!/^[0-9a-f-]{36}$/i.test(ownerId)) throw new Error("Compte Kanab Quest invalide.");
  if (!/^[0-9a-f-]{36}$/i.test(battleId)) throw new Error("Duel invalide.");
  const stored = await getKqPlayerBattle(ownerId, battleId);
  if (!stored) throw new Error("Ce duel n’est plus disponible.");
  const supabase = createSupabaseServiceClient();
  if (stored.status === "verdict") {
    if (
      (stored.winner !== "player" && stored.winner !== "opponent")
      || !stored.verdictAt
      || stored.rounds.length !== 3
    ) {
      throw new Error("Le reçu de ce duel est incomplet.");
    }
    const profileResult = await supabase.from("kq_rank_profiles")
      .select("rating,season_points,wins,losses,streak,burned_flowers")
      .eq("user_id", ownerId).maybeSingle();
    if (profileResult.error) throw new Error(`[supabase:kq_rank_profiles] ${profileResult.error.message}`);
    const experienceResult = await supabase.rpc("rpc_kq_award_human_battle_experience", { p_battle_id: battleId });
    if (experienceResult.error) throw new Error(`[supabase:rpc_kq_award_human_battle_experience] ${experienceResult.error.message}`);
    return {
      battleId, status: "verdict" as const, rounds: stored.rounds,
      winner: stored.winner, burnedAt: stored.verdictAt,
      experienceAwarded: getKqArenaExperienceAward(stored.rounds),
      challengePoints: 0, opponentChallengePoints: 0, completedChallenges: [],
      pvpBoosterGranted: false, pvpBoosterCardCount: 0,
      rankProfile: profileResult.data ? {
        rating: Number(profileResult.data.rating), seasonPoints: Number(profileResult.data.season_points),
        wins: Number(profileResult.data.wins), losses: Number(profileResult.data.losses),
        streak: Number(profileResult.data.streak), burnedFlowers: Number(profileResult.data.burned_flowers),
      } : null,
      replayed: true,
    };
  }
  if (stored.status !== "locked") throw new Error("Ce duel n’est plus disponible.");
  const battle: KqBattle = {
    id: stored.id, status: "locked", playerFlower: stored.playerFlower,
    opponentFlower: stored.opponentFlower, opponentRating: 1000,
    rounds: [], winner: null, burnedAt: null,
  };
  const verdict = resolveKqBattle(battle, stored.seed, new Date());
  if (!verdict.winner || !verdict.burnedAt) throw new Error("Le moteur du jury n’a pas produit de verdict complet.");
  const flowerRunsResult = await supabase.from("kq_flowers").select("id,run_id")
    .in("id", [stored.playerFlower.id, stored.opponentFlower.id]);
  if (flowerRunsResult.error || (flowerRunsResult.data ?? []).length !== 2) throw new Error("Cultures du duel introuvables.");
  const runIdByFlower = new Map((flowerRunsResult.data ?? []).map((flower) => [String(flower.id), String(flower.run_id)]));
  const playerRunId = runIdByFlower.get(stored.playerFlower.id);
  const opponentRunId = runIdByFlower.get(stored.opponentFlower.id);
  if (!playerRunId || !opponentRunId) throw new Error("Cultures du duel incomplètes.");
  const runsResult = await supabase.from("kq_runs").select("id,state,challenge_day")
    .in("id", [playerRunId, opponentRunId]);
  if (runsResult.error || (runsResult.data ?? []).length !== 2) throw new Error("États de culture du duel introuvables.");
  const runsById = new Map((runsResult.data ?? []).map((run) => [String(run.id), run]));
  const playerRun = runsById.get(playerRunId);
  const opponentRun = runsById.get(opponentRunId);
  const game = playerRun ? parseKqGameSave(encodeKqSave(playerRun.state)) : null;
  const opponentGame = opponentRun ? parseKqGameSave(encodeKqSave(opponentRun.state)) : null;
  if (!game || !opponentGame || !playerRun || !opponentRun) throw new Error("États de culture du duel invalides.");
  const challengeResults = evaluateKqChallenges(game, verdict);
  const opponentChallengeResults = evaluateKqChallenges(opponentGame, invertKqBattlePerspective(verdict));
  const completedChallengeCodes = challengeResults.filter((challenge) => challenge.completed).map((challenge) => challenge.code);
  const opponentCompletedChallengeCodes = opponentChallengeResults
    .filter((challenge) => challenge.completed).map((challenge) => challenge.code);
  const winnerIdResult = await createSupabaseServiceClient().from("kq_battles")
    .select("player_one_id,player_two_id").eq("id", battleId).maybeSingle();
  if (winnerIdResult.error || !winnerIdResult.data) throw new Error("Participants du duel introuvables.");
  const playerIsOne = winnerIdResult.data.player_one_id === ownerId;
  const winnerId = verdict.winner === "player"
    ? ownerId
    : playerIsOne ? winnerIdResult.data.player_two_id : winnerIdResult.data.player_one_id;
  const result = await supabase.rpc("rpc_kq_finalize_battle_for_both_players", {
    p_battle_id: battleId, p_rounds: verdict.rounds, p_winner_id: winnerId,
    p_user_id: ownerId, p_challenge_day: playerRun.challenge_day,
    p_challenge_codes: completedChallengeCodes,
    p_opponent_challenge_day: opponentRun.challenge_day,
    p_opponent_challenge_codes: opponentCompletedChallengeCodes,
  });
  if (result.error) {
    // Another request may have committed the same irreversible verdict while this
    // request was waiting on the battle row. Return its durable receipt instead
    // of reporting a false failure to the player.
    const refreshedBattle = await getKqPlayerBattle(ownerId, battleId);
    if (refreshedBattle?.status === "verdict") {
      return finalizeKqPlayerBattle(ownerId, battleId);
    }
    throw new Error(`[supabase:rpc_kq_finalize_battle_for_both_players] ${result.error.message}`);
  }
  const experienceResult = await supabase.rpc("rpc_kq_award_human_battle_experience", { p_battle_id: battleId });
  if (experienceResult.error) throw new Error(`[supabase:rpc_kq_award_human_battle_experience] ${experienceResult.error.message}`);
  const profileResult = await supabase.from("kq_rank_profiles")
    .select("rating,season_points,wins,losses,streak,burned_flowers")
    .eq("user_id", ownerId).maybeSingle();
  if (profileResult.error) throw new Error(`[supabase:kq_rank_profiles] ${profileResult.error.message}`);
  const verdictPayload = result.data && typeof result.data === "object" && !Array.isArray(result.data)
    ? result.data as Record<string, unknown> : {};
  return {
    battleId, status: "verdict", rounds: verdict.rounds, winner: verdict.winner,
    burnedAt: verdict.burnedAt,
    experienceAwarded: getKqArenaExperienceAward(verdict.rounds),
    challengePoints: Number(verdictPayload.challengePoints ?? 0),
    opponentChallengePoints: Number(verdictPayload.opponentChallengePoints ?? 0),
    completedChallenges: challengeResults.filter((challenge) => challenge.completed).map((challenge) => ({
      code: challenge.code, title: challenge.title, points: challenge.points,
    })),
    pvpBoosterGranted: verdict.winner === "player"
      && typeof verdictPayload.pvpBoosterEntitlementId === "string",
    pvpBoosterCardCount: Number(verdictPayload.pvpBoosterCardCount ?? 0),
    rankProfile: profileResult.data ? {
      rating: Number(profileResult.data.rating), seasonPoints: Number(profileResult.data.season_points),
      wins: Number(profileResult.data.wins), losses: Number(profileResult.data.losses),
      streak: Number(profileResult.data.streak), burnedFlowers: Number(profileResult.data.burned_flowers),
    } : null,
    replayed: false,
  };
}

export async function finalizeKqAdminBattle(
  adminEmail: string,
  battleId: string,
): Promise<KqAdminBattleVerdictReceipt> {
  const ownerId = await findKqUserIdByEmail(adminEmail);
  if (!ownerId) throw new Error("Compte collection admin introuvable.");
  return finalizeKqPlayerBattle(ownerId, battleId);
}

const readCachedPublicLeaderboard = cacheArenaSharedRead("placard-leaderboard-v2-development", () => readKqPublicLeaderboard());

export async function getKqPublicLeaderboard() {
  return readCachedPublicLeaderboard();
}

async function readKqPublicLeaderboard() {
  const supabase = createSupabaseServiceClient();
  const seasonCode = await getKqActiveSeasonCode();
  const snapshotResult = await supabase.rpc("rpc_kq_get_daily_leaderboard", {
    p_season_code: seasonCode,
  });
  if (snapshotResult.error) throw new Error(`[supabase:rpc_kq_get_daily_leaderboard] ${snapshotResult.error.message}`);
  const snapshot = snapshotResult.data as Record<string, unknown> | null;
  const rawLeaderboard = Array.isArray(snapshot?.leaderboard)
    ? snapshot.leaderboard as Array<Record<string, unknown>>
    : [];
  const userIds = rawLeaderboard.map((entry) => String(entry.userId ?? "")).filter(Boolean);
  const profilesResult = userIds.length > 0
    ? await supabase.from("contest_profiles").select("customer_id,pseudo").in("customer_id", userIds)
    : { data: [], error: null };
  if (profilesResult.error) throw new Error(`[supabase:contest_profiles] ${profilesResult.error.message}`);
  const pseudoByUser = new Map((profilesResult.data ?? []).map((profile) => [profile.customer_id, profile.pseudo]));
  const avatars = await getArenaRankingAvatars(userIds);
  return {
    seasonCode,
    generatedAt: snapshot?.generated_at ? String(snapshot.generated_at) : new Date().toISOString(),
    entries: rawLeaderboard.map((entry, index) => {
      const rating = Number(entry.rating ?? 1000);
      const seasonPoints = Number(entry.seasonPoints ?? 0);
      const reputation = Number(entry.reputation ?? 0);
      const businessScore = Number(entry.businessScore ?? 0);
      return {
        rank: Number(entry.rank ?? index + 1),
        avatar: avatars.get(String(entry.userId)) ?? null,
        pseudo: pseudoByUser.get(String(entry.userId)) ?? `Cultivateur ${String(index + 1).padStart(2, "0")}`,
        placardScore: Number(entry.placardScore ?? calculateKqPlacardScore({ rating, seasonPoints, reputation, businessScore }).score),
        businessScore,
        rating,
        seasonPoints,
        reputation,
        wins: Number(entry.wins ?? 0),
        losses: Number(entry.losses ?? 0),
        streak: Number(entry.streak ?? 0),
      };
    }),
  };
}

export async function getKqArenaLeaderboardInternal(options: { forceRefresh?: boolean } = {}) {
  const supabase = createSupabaseServiceClient();
  const seasonCode = await getKqActiveSeasonCode();
  const snapshotResult = await supabase.rpc("rpc_kq_get_arena_leaderboard", {
    p_season_code: seasonCode,
    p_force_refresh: options.forceRefresh === true,
  });
  if (snapshotResult.error) throw new Error(`[supabase:rpc_kq_get_arena_leaderboard] ${snapshotResult.error.message}`);
  const snapshot = snapshotResult.data as Record<string, unknown> | null;
  const rawEntries = Array.isArray(snapshot?.leaderboard)
    ? snapshot.leaderboard as Array<Record<string, unknown>>
    : [];
  return {
    seasonCode,
    contestSeasonCode: snapshot?.contest_season_code ? String(snapshot.contest_season_code) : null,
    generatedAt: snapshot?.generated_at ? String(snapshot.generated_at) : new Date().toISOString(),
    formulaVersion: String(snapshot?.formula_version ?? ARENA_FORMULA_VERSION),
    entries: rawEntries.map((entry, index) => ({
      userId: String(entry.userId),
      rank: Number(entry.rank ?? index + 1),
      pseudo: String(entry.pseudo ?? "Cultivateur anonyme"),
      score: Number(entry.score ?? 0),
      notebookScore: Number(entry.notebookScore ?? 0),
      placardScore: Number(entry.placardScore ?? 0),
      businessScore: Number(entry.businessScore ?? 0),
      approvedReviewCount: Number(entry.approvedReviewCount ?? 0),
      tastedFlowerCount: Number(entry.tastedFlowerCount ?? 0),
      duelSeasonPoints: Number(entry.duelSeasonPoints ?? 0),
      rating: Number(entry.rating ?? 1000),
      wins: Number(entry.wins ?? 0),
      losses: Number(entry.losses ?? 0),
    })),
  };
}

type ArenaLeaderboardPageOptions = { offset?: number; limit?: number; viewerId?: string };
type ArenaInternalEntry = Awaited<ReturnType<typeof getKqArenaLeaderboardInternal>>["entries"][number];

async function projectArenaLeaderboardPage<T extends { entries: ArenaInternalEntry[] }>(
  leaderboard: T,
  options: ArenaLeaderboardPageOptions,
) {
  const { entries: internalEntries, ...metadata } = leaderboard;
  const offset = Math.max(0, Math.floor(options.offset ?? 0));
  const limit = Math.max(1, Math.min(100, Math.floor(options.limit ?? 50)));
  const page = internalEntries.slice(offset, offset + limit);
  const viewer = options.viewerId ? internalEntries.find(entry => entry.userId === options.viewerId) : null;
  const userIds = [...new Set([...page.map(entry => entry.userId), ...(viewer ? [viewer.userId] : [])])];
  const avatars = await getArenaRankingAvatars(userIds);
  const projectEntry = (entry: ArenaInternalEntry) => ({
    entryKey: arenaPublicPlayerKey(entry.userId),
    rank: entry.rank,
    avatar: avatars.get(entry.userId) ?? null,
    pseudo: entry.pseudo,
    score: entry.score,
    notebookScore: entry.notebookScore,
    placardScore: entry.placardScore,
    businessScore: entry.businessScore,
    approvedReviewCount: entry.approvedReviewCount,
    tastedFlowerCount: entry.tastedFlowerCount,
    duelSeasonPoints: entry.duelSeasonPoints,
    rating: entry.rating,
    wins: entry.wins,
    losses: entry.losses,
  });
  return {
    ...metadata,
    entries: page.map(projectEntry),
    totalPlayers: internalEntries.length,
    revision: createHash("sha256").update(JSON.stringify(internalEntries)).digest("hex"),
    nextOffset: offset + limit < internalEntries.length ? offset + limit : null,
    viewerEntry: viewer ? projectEntry(viewer) : null,
  };
}

const readCachedArenaLeaderboard = cacheArenaSharedRead("arena-leaderboard-v3-tasting-first", () => getKqArenaLeaderboardInternal());

export async function getKqPublicArenaLeaderboard(options: ArenaLeaderboardPageOptions = {}) {
  return projectArenaLeaderboardPage(await readCachedArenaLeaderboard(), options);
}

const readCachedArenaCategoryLeaderboards = {
  tasting: cacheArenaSharedRead("arena-tasting-leaderboard-v3", () => readKqArenaCategoryLeaderboard("tasting")),
  "tasting-global": cacheArenaSharedRead("arena-tasting-global-leaderboard-v3", () => readKqArenaCategoryLeaderboard("tasting-global")),
  duels: cacheArenaSharedRead("arena-duels-leaderboard-v3", () => readKqArenaCategoryLeaderboard("duels")),
  business: cacheArenaSharedRead("arena-business-leaderboard-v3", () => readKqArenaCategoryLeaderboard("business")),
};

export async function getKqPublicArenaCategoryLeaderboard(
  category: ArenaRankingCategory,
  options: ArenaLeaderboardPageOptions & { scope?: "season" | "global" } = {},
) {
  const key = category === "tasting" && options.scope === "global" ? "tasting-global" : category;
  const leaderboard = await readCachedArenaCategoryLeaderboards[key]();
  return projectArenaLeaderboardPage({ ...leaderboard, category, scope: options.scope ?? "season" }, options);
}

async function readKqArenaCategoryLeaderboard(category: ArenaRankingCategory | "tasting-global") {
  const seasonCode = await getKqActiveSeasonCode();
  const result = await createSupabaseServiceClient().rpc("rpc_kq_get_arena_category_leaderboard", {
    p_season_code: seasonCode,
    p_category: category,
  });
  if (result.error) throw new Error(`[supabase:rpc_kq_get_arena_category_leaderboard] ${result.error.message}`);
  const snapshot = result.data as Record<string, unknown> | null;
  const rawEntries = Array.isArray(snapshot?.leaderboard)
    ? snapshot.leaderboard as Array<Record<string, unknown>>
    : [];
  return {
    seasonCode,
    generatedAt: snapshot?.generatedAt ? String(snapshot.generatedAt) : new Date().toISOString(),
    formulaVersion: String(snapshot?.formulaVersion ?? ARENA_FORMULA_VERSION),
    category,
    entries: rawEntries.map((entry, index) => ({
      userId: String(entry.userId),
      rank: Number(entry.rank ?? index + 1),
      pseudo: String(entry.pseudo ?? "Cultivateur anonyme"),
      score: Number(entry.score ?? 0),
      notebookScore: Number(entry.notebookScore ?? 0),
      placardScore: Number(entry.placardScore ?? 0),
      businessScore: Number(entry.businessScore ?? 0),
      approvedReviewCount: Number(entry.approvedReviewCount ?? 0),
      tastedFlowerCount: Number(entry.tastedFlowerCount ?? 0),
      duelSeasonPoints: Number(entry.duelSeasonPoints ?? 0),
      rating: Number(entry.rating ?? 1000),
      wins: Number(entry.wins ?? 0),
      losses: Number(entry.losses ?? 0),
    })),
  };
}

export async function getKqAdminSeasonRewardPreview() {
  const supabase = createSupabaseServiceClient();
  const seasonCode = await getKqActiveSeasonCode();
  const snapshotResult = await supabase.rpc("rpc_kq_refresh_daily_leaderboard", {
    p_season_code: seasonCode,
  });
  if (snapshotResult.error) {
    throw new Error(`[supabase:rpc_kq_refresh_daily_leaderboard] ${snapshotResult.error.message}`);
  }
  const snapshot = snapshotResult.data as Record<string, unknown> | null;
  const leaderboard = Array.isArray(snapshot?.leaderboard)
    ? snapshot.leaderboard as Array<Record<string, unknown>>
    : [];
  const preview = buildKqSeasonRewardPreview(seasonCode, leaderboard.map((entry, index) => ({
    playerId: String(entry.userId ?? ""),
    rank: Number(entry.rank ?? index + 1),
    seasonPoints: Number(entry.seasonPoints ?? 0),
    rating: Number(entry.rating ?? 1000),
    wins: Number(entry.wins ?? 0),
    losses: Number(entry.losses ?? 0),
  })));
  const grantsResult = await supabase.from("kq_season_reward_grants")
    .select("grant_key").eq("season_code", seasonCode);
  if (grantsResult.error) {
    throw new Error(`[supabase:kq_season_reward_grants] ${grantsResult.error.message}`);
  }
  const grantedKeys = new Set((grantsResult.data ?? []).map((grant) => String(grant.grant_key)));
  const alreadyGranted = preview.grants.filter((grant) => grantedKeys.has(grant.grantKey)).length;
  return {
    ...preview,
    alreadyGranted,
    pendingGrants: preview.eligiblePlayers - alreadyGranted,
  };
}

export async function getKqPlayerProgress(userId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error("Profil Kanab Quest invalide.");
  const supabase = createSupabaseServiceClient();
  const profileResult = await supabase.from("kq_rank_profiles")
    .select("season_code,rating,season_points,wins,losses,streak,burned_flowers,arena_experience,updated_at")
    .eq("user_id", userId).maybeSingle();
  if (profileResult.error) throw new Error(`[supabase:kq_rank_profiles] ${profileResult.error.message}`);
  if (!profileResult.data) return null;
  const [snapshotResult, walletResult, claimsResult, businessResult] = await Promise.all([
    supabase.from("kq_leaderboard_snapshots").select("leaderboard,generated_at")
      .eq("season_code", profileResult.data.season_code)
      .order("snapshot_date", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("kq_equipment_wallets").select("reputation").eq("user_id", userId).maybeSingle(),
    supabase.from("kq_daily_challenge_claims").select("challenge_day,challenge_code")
      .eq("user_id", userId).order("challenge_day", { ascending: false }).limit(64),
    supabase.rpc("kq_business_development_score", { p_user_id: userId }),
  ]);
  if (snapshotResult.error) throw new Error(`[supabase:kq_leaderboard_snapshots] ${snapshotResult.error.message}`);
  if (walletResult.error) throw new Error(`[supabase:kq_equipment_wallets] ${walletResult.error.message}`);
  if (claimsResult.error) throw new Error(`[supabase:kq_daily_challenge_claims] ${claimsResult.error.message}`);
  if (businessResult.error) throw new Error(`[supabase:kq_business_development_score] ${businessResult.error.message}`);
  const snapshot = Array.isArray(snapshotResult.data?.leaderboard)
    ? snapshotResult.data.leaderboard as Array<Record<string, unknown>> : [];
  const rankEntry = snapshot.find((entry) => String(entry.userId) === userId);
  const rating = Number(profileResult.data.rating);
  const seasonPoints = Number(profileResult.data.season_points);
  const reputation = Number(walletResult.data?.reputation ?? 0);
  const businessScore = Number(businessResult.data?.score ?? 0);
  const placardScore = calculateKqPlacardScore({
    rating,
    seasonPoints,
    reputation,
    businessScore,
  }).score;
  const league = getKqLeague(rating);
  return {
    seasonCode: String(profileResult.data.season_code),
    rank: rankEntry ? Number(rankEntry.rank) : null,
    placardScore,
    businessScore,
    rating,
    seasonPoints,
    reputation,
    wins: Number(profileResult.data.wins),
    losses: Number(profileResult.data.losses),
    streak: Number(profileResult.data.streak),
    arenaExperience: Number(profileResult.data.arena_experience ?? 0),
    burnedFlowers: Number(profileResult.data.burned_flowers),
    league: league.name,
    leagueProgress: league.progress,
    pointsToNextLeague: league.pointsToNext,
    claimedChallengeCodes: mapKqChallengeClaimKeys(claimsResult.data),
    leaderboardGeneratedAt: snapshotResult.data?.generated_at
      ? String(snapshotResult.data.generated_at)
      : null,
    updatedAt: String(profileResult.data.updated_at),
  };
}

export function prepareKqCardPlay(state: KqGameState, cardCode: string) {
  const card = KQ_CARDS.find((candidate) => candidate.code === cardCode);
  if (!card || card.category === "substrate") throw new Error("Carte de soutien invalide.");
  const permission = canPlayKqCard(state, card);
  if (!permission.allowed) throw new Error(permission.reason);
  const nextState = playKqCard(state, cardCode);
  if (nextState === state || nextState.usedCards.length !== state.usedCards.length + 1) {
    throw new Error("La carte n’a produit aucun effet.");
  }
  return { nextState, useKind: card.category === "pbi" ? "pbi" as const : "support" as const };
}

export function mapKqCardBurnResult(data: unknown) {
  const payload = data && typeof data === "object" && !Array.isArray(data)
    ? data as Record<string, unknown>
    : null;
  const receipt = payload?.burnReceipt && typeof payload.burnReceipt === "object"
    ? payload.burnReceipt as Record<string, unknown>
    : null;
  if (!receipt?.id || !receipt.card_instance_id || !receipt.card_code || !receipt.burned_at || !payload?.state) {
    throw new Error("Reçu de carte Supabase invalide.");
  }
  return {
    state: payload.state as KqGameState,
    burnReceipt: {
      id: String(receipt.id),
      cardInstanceId: String(receipt.card_instance_id),
      cardCode: String(receipt.card_code),
      stageIndex: Number(receipt.stage_index),
      useKind: String(receipt.use_kind),
      burnedAt: String(receipt.burned_at),
    },
  };
}

export async function playKqPlayerCard(ownerId: string, runId: string, cardCode: string) {
  if (!/^[0-9a-f-]{36}$/i.test(ownerId)) throw new Error("Compte Kanab Quest invalide.");
  if (!/^[0-9a-f-]{36}$/i.test(runId)) throw new Error("Culture invalide.");

  const supabase = createSupabaseServiceClient();
  const runResult = await supabase
    .from("kq_runs")
    .select("id,user_id,status,state,updated_at")
    .eq("id", runId)
    .eq("user_id", ownerId)
    .maybeSingle();
  if (runResult.error) throw new Error(`[supabase:kq_runs] ${runResult.error.message}`);
  if (!runResult.data || runResult.data.status !== "active") throw new Error("Culture active introuvable.");

  const state = parseKqGameSave(encodeKqSave(runResult.data.state));
  if (!state) throw new Error("État de culture invalide.");
  if (state.campaign && state.campaign.leaderRunId !== runId) throw new Error("Ouvre la campagne commune pour jouer cette carte.");
  const { nextState, useKind } = prepareKqCardPlay(state, cardCode);
  const result = await supabase.rpc("rpc_kq_play_support_card", {
    p_user_id: ownerId,
    p_run_id: runId,
    p_card_code: cardCode,
    p_stage_index: state.stageIndex,
    p_use_kind: useKind,
    p_expected_updated_at: runResult.data.updated_at,
    p_next_state: nextState,
  });
  if (result.error) {
    const message = result.error.message || "Utilisation de carte impossible.";
    if (message.includes("kq_stale_run")) throw new Error("La culture a évolué. Recharge la partie.");
    if (message.includes("kq_card_copy_unavailable")) throw new Error("Aucune copie physique disponible.");
    if (message.includes("kq_card_already_played")) throw new Error("Cette carte a déjà été jouée à cette étape.");
    throw new Error(`[supabase:rpc_kq_play_support_card] ${message}`);
  }
  return mapKqCardBurnResult(result.data);
}

export async function playKqAdminCard(adminEmail: string, runId: string, cardCode: string) {
  const ownerId = await findKqUserIdByEmail(adminEmail);
  if (!ownerId) throw new Error("Compte collection admin introuvable.");
  return playKqPlayerCard(ownerId, runId, cardCode);
}

export type KqRunAction = "roll" | "resolve" | "advance" | "redraw" | "heritage" | "heritage-swap";

export function applyKqRunAction(
  state: KqGameState,
  action: KqRunAction,
  options?: { handIndex?: number; reserveIndex?: number },
) {
  const nextState = action === "roll" ? rollKqDice(state)
    : action === "resolve" ? resolveKqStage(state)
      : action === "advance" ? advanceKqStage(state)
        : action === "redraw" ? redrawKqHand(state)
          : action === "heritage" ? activateKqHeritage(state)
            : swapKqHeritageHandCard(state, Number(options?.handIndex), Number(options?.reserveIndex));
  if (nextState === state) throw new Error("Cette action n’est pas disponible maintenant.");
  return nextState;
}

export async function applyKqPlayerRunAction(
  ownerId: string,
  runId: string,
  action: KqRunAction,
  options?: { handIndex?: number; reserveIndex?: number },
) {
  if (!/^[0-9a-f-]{36}$/i.test(ownerId)) throw new Error("Compte Kanab Quest invalide.");
  if (!/^[0-9a-f-]{36}$/i.test(runId)) throw new Error("Culture invalide.");
  const supabase = createSupabaseServiceClient();
  const runResult = await supabase.from("kq_runs").select("state,status,updated_at")
    .eq("id", runId).eq("user_id", ownerId).maybeSingle();
  if (runResult.error) throw new Error(`[supabase:kq_runs] ${runResult.error.message}`);
  if (!runResult.data) throw new Error("Culture active introuvable.");
  const state = parseKqGameSave(encodeKqSave(runResult.data.state));
  if (!state) throw new Error("État de culture invalide.");
  if (state.campaign && state.campaign.leaderRunId !== runId) throw new Error("Ouvre la campagne commune pour poursuivre ces cultures.");
  // A lost final response must return the stored harvests, never create them again.
  if (state.campaign && state.phase === "complete" && runResult.data.status !== "active" && (action === "advance" || action === "resolve")) {
    const stored = await supabase.from("kq_flowers").select("id,run_id,status,created_at")
      .eq("owner_id", ownerId).in("run_id", state.campaign.members.map(member => member.runId));
    if (stored.error) throw new Error(`[supabase:campaign-flowers] ${stored.error.message}`);
    if (!isKqCultureDead(state) && stored.data?.length !== state.campaign.members.length) throw new Error("Le reçu de récolte de la campagne est incomplet.");
    const persistedFlowers = (stored.data ?? []).map(entry => ({ id: String(entry.id), runId: String(entry.run_id),
      zoneId: state.campaign!.members.find(member => member.runId === entry.run_id)?.zoneId ?? null,
      status: String(entry.status), createdAt: String(entry.created_at) }));
    const leaderFlower = persistedFlowers.find(entry => entry.runId === runId);
    return { state, persistedFlowers, persistedFlower: leaderFlower
      ? { id: leaderFlower.id, status: leaderFlower.status, createdAt: leaderFlower.createdAt } : null, replayed: true };
  }
  if (runResult.data.status !== "active") throw new Error("Culture active introuvable.");
  const nextState = applyKqRunAction(state, action, options);
  const flower = nextState.phase === "complete" && !isKqCultureDead(nextState) ? createKqFlower(nextState) : null;
  const flowerPayload = (memberState: KqGameState, memberFlower: KqFlowerCard | null) => memberFlower ? {
    varietyCode: memberState.varietyCode, varietyName: memberFlower.variety, quality: memberState.quality,
    traits: memberFlower.traits, combos: memberState.combos, battleStats: memberFlower.stats,
    cannabinoidReport: memberFlower.cannabinoidReport ?? null, integrityCode: memberFlower.integrityCode,
    cultivationProfile: memberFlower.cultivationProfile ?? null, terpeneReport: memberFlower.terpeneReport ?? null,
  } : null;
  const result = action === "heritage-swap"
    ? await supabase.rpc("rpc_kq_swap_heritage_hand", {
        p_user_id: ownerId,
        p_run_id: runId,
        p_expected_updated_at: runResult.data.updated_at,
        p_next_state: nextState,
      })
    : nextState.campaign ? await supabase.rpc("rpc_kq_update_campaign_state", {
        p_user_id: ownerId, p_run_id: runId, p_expected_updated_at: runResult.data.updated_at,
        p_action: action, p_next_state: nextState,
        p_members: nextState.campaign.members.map(member => {
          const memberState = getKqCampaignMemberState(nextState, member);
          const memberFlower = memberState.phase === "complete" && !isKqCultureDead(memberState) ? createKqFlower(memberState) : null;
          return { runId: member.runId, state: memberState, flower: flowerPayload(memberState, memberFlower) };
        }),
      }) : await supabase.rpc("rpc_kq_update_run_state", {
        p_user_id: ownerId, p_run_id: runId, p_expected_updated_at: runResult.data.updated_at,
        p_action: action, p_next_state: nextState,
        p_flower: flower ? {
          varietyCode: nextState.varietyCode,
          varietyName: flower.variety,
          quality: nextState.quality,
          traits: flower.traits,
          combos: nextState.combos,
          battleStats: flower.stats,
          cannabinoidReport: flower.cannabinoidReport ?? null,
          integrityCode: flower.integrityCode,
        } : null,
      });
  if (result.error) {
    const message = result.error.message || "Action impossible.";
    if (message.includes("kq_stale_run")) throw new Error("La culture a évolué. Recharge la partie.");
    throw new Error(`[supabase:rpc_kq_update_run_state] ${message}`);
  }
  const payload = result.data && typeof result.data === "object" && !Array.isArray(result.data)
    ? result.data as Record<string, unknown> : null;
  if (!payload?.state) throw new Error("Réponse de progression Supabase invalide.");
  const persistedFlower = payload.flower && typeof payload.flower === "object"
    ? payload.flower as Record<string, unknown> : null;
  return {
    state: payload.state as KqGameState,
    ...(Array.isArray(payload.flowers) ? { persistedFlowers: payload.flowers.map((entry: Record<string, unknown>) => ({
      id: String(entry.id), runId: String(entry.run_id),
      zoneId: nextState.campaign?.members.find(member => member.runId === entry.run_id)?.zoneId ?? null,
      status: String(entry.status), createdAt: String(entry.created_at),
    })) } : {}),
    persistedFlower: persistedFlower ? {
      id: String(persistedFlower.id),
      status: String(persistedFlower.status),
      createdAt: String(persistedFlower.created_at),
    } : null,
  };
}

export async function applyKqAdminRunAction(
  adminEmail: string,
  runId: string,
  action: KqRunAction,
  options?: { handIndex?: number; reserveIndex?: number },
) {
  const ownerId = await findKqUserIdByEmail(adminEmail);
  if (!ownerId) throw new Error("Compte collection admin introuvable.");
  return applyKqPlayerRunAction(ownerId, runId, action, options);
}
