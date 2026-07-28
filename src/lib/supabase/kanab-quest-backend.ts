import "server-only";

import { normalizeEmail } from "@/lib/admin-allowlist";
import { activateKqHeritage, advanceKqStage, canPlayKqCard, getKqHarvestTier, KQ_BUDDIES, KQ_CARDS, playKqCard, redrawKqHand, resolveKqStage, rollKqDice, startKqGame, swapKqHeritageHandCard, type KqGameState } from "@/lib/kanab-quest-game";
import { encodeKqSave, parseKqGameSave } from "@/lib/kanab-quest-persistence";
import { createKqFlower, createKqOpponent, invertKqBattlePerspective, lockKqBattle, resolveKqBattle, type KqBattle, type KqFlowerCard } from "@/lib/kanab-quest-battle";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import { getKqLeague } from "@/lib/kanab-quest-ranking";
import { evaluateKqChallenges } from "@/lib/kanab-quest-challenges";
import { getKqNotebookReward, KQ_CULTURE_TOKEN_RUN_CAP, KQ_CULTURE_TOKEN_START_XP, KQ_NOTEBOOK_REWARDS_LIVE } from "@/lib/kanab-quest-notebook-rewards";
import { KQ_HERITAGE_CARDS } from "@/lib/kanab-quest-heritage";
import { KQ_HERITAGE_PURCHASE_DRAWS_LIVE } from "@/lib/kanab-quest-heritage-purchase";
import { buildKqSeasonRewardPreview, KQ_SEASON_REWARDS_LIVE } from "@/lib/kanab-quest-season-rewards";
import { isKqPlayerApiEnabled } from "@/lib/kanab-quest-player-access";
import { LOTTERY_POINTS_PACK_MAX_PER_PURCHASE } from "@/lib/lottery-collection";
import { KQ_SUPPORT_BOOSTER_POINTS_COST } from "@/lib/kanab-quest-booster";

const BOTTE_COLLECTION_CODE = "BOTTE_DU_CHANVRIER_2026";
const KQ_INITIAL_SEASON_CODE = "KQ-2026-S1";
let kqActiveSeasonCache: { expiresAt: number; promise: Promise<string> } | null = null;

export type KqSupportBoosterShopSnapshot = {
  collectionActive: boolean;
  costPerPack: number;
  availableEntitlements: Array<{ id: string; source: string; cardCount: number; createdAt: string }>;
  welcomeClaimed: boolean;
};

export async function getKqSupportBoosterShopSnapshot(userId: string): Promise<KqSupportBoosterShopSnapshot> {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error("Compte Placard invalide.");
  const supabase = createSupabaseServiceClient();
  const [collection, entitlements] = await Promise.all([
    supabase.from("lottery_card_collections").select("is_active")
      .eq("code", BOTTE_COLLECTION_CODE).maybeSingle(),
    supabase.from("kq_support_booster_entitlements").select("id,source,status,card_count,created_at")
      .eq("user_id", userId).order("created_at", { ascending: true }),
  ]);
  if (collection.error) throw new Error(`[supabase:lottery_card_collections] ${collection.error.message}`);
  if (entitlements.error) throw new Error(`[supabase:kq_support_booster_entitlements] ${entitlements.error.message}`);
  return {
    collectionActive: collection.data?.is_active === true,
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
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error("Compte Placard invalide.");
  const result = await createSupabaseServiceClient().rpc("rpc_kq_claim_welcome_support_booster", {
    p_user_id: userId,
  });
  if (result.error) {
    const message = result.error.message || "Booster de bienvenue indisponible.";
    if (message.includes("support_collection_unavailable")) throw new Error("La collection La Botte n’est pas encore active.");
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
    const message = result.error.message || "Achat La Botte impossible.";
    if (message.includes("insufficient_points")) throw new Error("Points insuffisants.");
    if (message.includes("support_collection_unavailable")) throw new Error("La boutique La Botte n’est pas encore active.");
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
    throw new Error("Booster La Botte invalide.");
  }
  const result = await createSupabaseServiceClient().rpc("rpc_kq_open_support_booster", {
    p_entitlement_id: entitlementId,
    p_user_id: userId,
  });
  if (result.error) {
    const message = result.error.message || "Ouverture La Botte impossible.";
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
  if (!active) throw new Error("Aucune saison Placard active.");
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

export async function getKqPlayerHeritageSnapshot(ownerId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(ownerId)) throw new Error("Profil Héritage invalide.");
  const supabase = createSupabaseServiceClient();
  const [definitionsResult, drawsResult, stateResult, ordersResult, entriesResult, fragmentWalletResult, fragmentLedgerResult] = await Promise.all([
    supabase.from("kq_heritage_card_definitions")
      .select("code,name,rarity,timing,effect_code,description,image_url,is_active")
      .order("code", { ascending: true }),
    supabase.from("kq_heritage_draws")
      .select("id,order_item_id,unit_index,card_code,rarity,was_duplicate,source,drawn_at")
      .eq("user_id", ownerId)
      .order("drawn_at", { ascending: false }),
    supabase.from("kq_heritage_player_state")
      .select("pulls_without_rare,total_pulls")
      .eq("user_id", ownerId)
      .maybeSingle(),
    supabase.from("orders").select("id")
      .eq("customer_id", ownerId).eq("payment_state", "paid").neq("status", "cancelled"),
    supabase.from("contest_entries").select("product_id"),
    supabase.from("kq_heritage_fragment_wallets").select("balance").eq("user_id", ownerId).maybeSingle(),
    supabase.from("kq_heritage_fragment_ledger")
      .select("id,amount,reason,created_at")
      .eq("user_id", ownerId).order("created_at", { ascending: false }).limit(20),
  ]);
  if (definitionsResult.error) throw new Error(`[supabase:kq_heritage_card_definitions] ${definitionsResult.error.message}`);
  if (drawsResult.error) throw new Error(`[supabase:kq_heritage_draws] ${drawsResult.error.message}`);
  if (stateResult.error) throw new Error(`[supabase:kq_heritage_player_state] ${stateResult.error.message}`);
  if (ordersResult.error) throw new Error(`[supabase:orders] ${ordersResult.error.message}`);
  if (entriesResult.error) throw new Error(`[supabase:contest_entries] ${entriesResult.error.message}`);
  if (fragmentWalletResult.error) throw new Error(`[supabase:kq_heritage_fragment_wallets] ${fragmentWalletResult.error.message}`);
  if (fragmentLedgerResult.error) throw new Error(`[supabase:kq_heritage_fragment_ledger] ${fragmentLedgerResult.error.message}`);
  const orderIds = (ordersResult.data ?? []).map((order) => String(order.id));
  const itemsResult = orderIds.length > 0
    ? await supabase.from("order_items").select("id,product_id,quantity").in("order_id", orderIds)
    : { data: [], error: null };
  if (itemsResult.error) throw new Error(`[supabase:order_items] ${itemsResult.error.message}`);
  const contestProductIds = new Set((entriesResult.data ?? []).map((entry) => String(entry.product_id)));
  const eligibleItems = (itemsResult.data ?? []).filter((item) => contestProductIds.has(String(item.product_id).trim().split("::", 1)[0]?.trim() ?? ""));
  const eligibleUnits = eligibleItems.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0);
  const eligibleItemIds = new Set(eligibleItems.map((item) => Number(item.id)));
  const attributedUnits = (drawsResult.data ?? []).filter((draw) => eligibleItemIds.has(Number(draw.order_item_id))).length;
  const ownedCounts = (drawsResult.data ?? []).reduce<Record<string, number>>((counts, draw) => {
    counts[draw.card_code] = (counts[draw.card_code] ?? 0) + 1;
    return counts;
  }, {});
  return {
    collectionActive: (definitionsResult.data ?? []).some((card) => card.is_active === true),
    purchaseDrawsLive: KQ_HERITAGE_PURCHASE_DRAWS_LIVE,
    totalPulls: Number(stateResult.data?.total_pulls ?? drawsResult.data?.length ?? 0),
    pullsWithoutRare: Number(stateResult.data?.pulls_without_rare ?? 0),
    eligiblePurchaseUnits: eligibleUnits,
    attributedPurchaseUnits: attributedUnits,
    pendingPurchaseUnits: Math.max(0, eligibleUnits - attributedUnits),
    fragmentBalance: Number(fragmentWalletResult.data?.balance ?? 0),
    fragmentHistory: (fragmentLedgerResult.data ?? []).map((entry) => ({
      id: String(entry.id),
      amount: Number(entry.amount),
      reason: String(entry.reason),
      createdAt: String(entry.created_at),
    })),
    cards: (definitionsResult.data ?? []).map((card) => ({
      code: String(card.code),
      name: String(card.name),
      rarity: String(card.rarity),
      timing: String(card.timing),
      effectCode: String(card.effect_code),
      description: String(card.description),
      imageUrl: String(card.image_url ?? ""),
      isActive: card.is_active === true,
      ownedCopies: ownedCounts[card.code] ?? 0,
    })),
    draws: (drawsResult.data ?? []).map((draw) => ({
      id: String(draw.id),
      orderItemId: Number(draw.order_item_id),
      unitIndex: Number(draw.unit_index),
      cardCode: String(draw.card_code),
      rarity: String(draw.rarity),
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

export async function craftKqAdminHeritageCard(adminEmail: string, cardCode: string) {
  const ownerId = await findKqUserIdByEmail(adminEmail);
  if (!ownerId) throw new Error("Compte collection admin introuvable.");
  if (!KQ_HERITAGE_CARDS.some((card) => card.code === cardCode)) throw new Error("Héritage invalide.");
  const supabase = createSupabaseServiceClient();
  const result = await supabase.rpc("rpc_kq_craft_heritage_card", {
    p_user_id: ownerId,
    p_card_code: cardCode,
  });
  if (result.error) {
    const message = result.error.message || "Fabrication impossible.";
    if (message.includes("kq_heritage_collection_inactive")) throw new Error("La fabrication Héritage n’est pas encore active.");
    if (message.includes("kq_heritage_epic_not_craftable")) throw new Error("Les Héritages épiques ne peuvent pas être fabriqués.");
    if (message.includes("kq_heritage_already_owned")) throw new Error("Cet Héritage est déjà dans la collection.");
    if (message.includes("kq_heritage_fragments_insufficient")) throw new Error("Solde de fragments insuffisant.");
    throw new Error(`[supabase:rpc_kq_craft_heritage_card] ${message}`);
  }
  return result.data;
}

type KqLaunchReadinessInput = {
  heritageCards: Array<{ rarity: string; image_url: string; is_active: boolean }>;
  supportCards: Array<{ image_url: string; is_active: boolean }>;
  supportCollectionActive: boolean;
  notebookRules: Array<{ is_active: boolean }>;
  seasonRules: Array<{ tier_code: string; is_active: boolean }>;
  seasonGrantCount: number;
  publicRulesApproved: boolean;
};

export function isKqFinalArtworkUrl(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized || !/^(\/|https?:\/\/)/.test(normalized)) return false;
  return !/(placeholder|brouillon|draft|temp(?:orary)?|todo|example|exemple)/.test(normalized);
}

export function buildKqLaunchReadiness(input: KqLaunchReadinessInput) {
  const heritageRarityCounts = input.heritageCards.reduce<Record<string, number>>((counts, card) => {
    counts[card.rarity] = (counts[card.rarity] ?? 0) + 1;
    return counts;
  }, {});
  const heritageArtwork = input.heritageCards.map((card) => card.image_url.trim().toLowerCase()).filter(isKqFinalArtworkUrl);
  const supportArtwork = input.supportCards.map((card) => card.image_url.trim().toLowerCase()).filter(isKqFinalArtworkUrl);
  const contentChecks = [
    { code: "public-rules-approved", label: "Règlement public, lots et probabilités validés", ready: input.publicRulesApproved },
    { code: "heritage-catalog", label: "Catalogue Héritage 6 / 4 / 2", ready: input.heritageCards.length === 12 && heritageRarityCounts.common === 6 && heritageRarityCounts.rare === 4 && heritageRarityCounts.epic === 2 },
    { code: "heritage-art", label: "12 illustrations Héritage distinctes", ready: heritageArtwork.length === 12 && new Set(heritageArtwork).size === 12 },
    { code: "support-catalog", label: "36 cartes La Botte", ready: input.supportCards.length === 36 },
    { code: "support-art", label: "36 illustrations La Botte distinctes", ready: supportArtwork.length === 36 && new Set(supportArtwork).size === 36 },
    { code: "notebook-rules", label: "15 règles carnet → Placard", ready: input.notebookRules.length === 15 },
    { code: "season-rules", label: "4 paliers de récompenses de saison", ready: input.seasonRules.length === 4 && new Set(input.seasonRules.map((rule) => rule.tier_code)).size === 4 },
    { code: "season-no-early-grants", label: "Aucune récompense de saison prématurée", ready: input.seasonGrantCount === 0 },
  ];
  const dormantChecks = [
    { code: "support-dormant", label: "Collection La Botte encore inactive", ready: !input.supportCollectionActive && input.supportCards.every((card) => !card.is_active) },
    { code: "heritage-dormant", label: "Collection Héritage encore inactive", ready: input.heritageCards.every((card) => !card.is_active) },
    { code: "heritage-purchase-dormant", label: "Tirages Héritage après achat encore inactifs", ready: !KQ_HERITAGE_PURCHASE_DRAWS_LIVE },
    { code: "notebook-dormant", label: "Récompenses du carnet encore inactives", ready: input.notebookRules.every((rule) => !rule.is_active) && !KQ_NOTEBOOK_REWARDS_LIVE },
    { code: "season-dormant", label: "Récompenses de saison encore inactives", ready: input.seasonRules.every((rule) => !rule.is_active) && !KQ_SEASON_REWARDS_LIVE && input.seasonGrantCount === 0 },
  ];
  dormantChecks.push({
    code: "player-access-dormant",
    label: "Accès joueur au Placard encore fermé",
    ready: !isKqPlayerApiEnabled(),
  });
  const safelyDormant = dormantChecks.every((check) => check.ready);
  const contentReady = contentChecks.every((check) => check.ready);
  const checks = [...contentChecks, ...dormantChecks];
  return {
    contentReady,
    readyForActivation: contentReady && safelyDormant,
    safelyDormant,
    checks,
    blockers: checks.filter((check) => !check.ready).map((check) => check.label),
    activationStillRequired: [
      "Faire valider puis publier PLACARD-RULES-DRAFT avec les lots, dates et probabilités Héritage",
      "Vérifier les 48 illustrations et tous les écrans client sur la version de lancement",
      "Ouvrir la fenêtre coordonnée et activer les collections La Botte et Héritage",
      "Activer les 15 règles Carnet et les 4 paliers de saison dans Supabase",
      "Basculer ensemble KQ_NOTEBOOK_REWARDS_LIVE, KQ_SEASON_REWARDS_LIVE et KQ_HERITAGE_PURCHASE_DRAWS_LIVE",
      "Exécuter les rétro-attributions Carnet puis Héritage par lots depuis l’interface admin",
      "Contrôler les reçus, les soldes et un parcours complet avant d’ouvrir le Placard aux clients",
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
  if (collectionResult.error || !collectionResult.data) throw new Error("Collection La Botte introuvable.");
  const [heritageResult, supportResult, rulesResult, seasonRulesResult, seasonGrantsResult] = await Promise.all([
    supabase.from("kq_heritage_card_definitions").select("rarity,image_url,is_active"),
    supabase.from("lottery_card_definitions").select("image_url,is_active").eq("collection_id", collectionResult.data.id),
    supabase.from("kq_notebook_reward_rules").select("is_active"),
    supabase.from("kq_season_reward_rules").select("tier_code,is_active").eq("season_code", seasonCode),
    supabase.from("kq_season_reward_grants").select("id", { count: "exact", head: true }).eq("season_code", seasonCode),
  ]);
  if (heritageResult.error) throw new Error(`[supabase:kq_heritage_card_definitions] ${heritageResult.error.message}`);
  if (supportResult.error) throw new Error(`[supabase:lottery_card_definitions] ${supportResult.error.message}`);
  if (rulesResult.error) throw new Error(`[supabase:kq_notebook_reward_rules] ${rulesResult.error.message}`);
  if (seasonRulesResult.error) throw new Error(`[supabase:kq_season_reward_rules] ${seasonRulesResult.error.message}`);
  if (seasonGrantsResult.error) throw new Error(`[supabase:kq_season_reward_grants] ${seasonGrantsResult.error.message}`);
  return buildKqLaunchReadiness({
    heritageCards: (heritageResult.data ?? []).map((card) => ({ rarity: String(card.rarity), image_url: String(card.image_url ?? ""), is_active: card.is_active === true })),
    supportCards: (supportResult.data ?? []).map((card) => ({ image_url: String(card.image_url ?? ""), is_active: card.is_active === true })),
    supportCollectionActive: collectionResult.data.is_active === true,
    notebookRules: (rulesResult.data ?? []).map((rule) => ({ is_active: rule.is_active === true })),
    seasonRules: (seasonRulesResult.data ?? []).map((rule) => ({ tier_code: String(rule.tier_code), is_active: rule.is_active === true })),
    seasonGrantCount: seasonGrantsResult.count ?? 0,
    publicRulesApproved: process.env.KQ_PUBLIC_RULES_APPROVED?.trim().toLowerCase() === "true",
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

export async function getKqPlayerCollectionSnapshot(ownerId: string): Promise<KqAdminCollectionSnapshot> {
  if (!/^[0-9a-f-]{36}$/i.test(ownerId)) throw new Error("Compte Placard invalide.");
  const supabase = createSupabaseServiceClient();
  const collectionResult = await supabase
    .from("lottery_card_collections")
    .select("id,is_active")
    .eq("code", BOTTE_COLLECTION_CODE)
    .maybeSingle();
  if (collectionResult.error) {
    throw new Error(`[supabase:lottery_card_collections] ${collectionResult.error.message}`);
  }
  if (!collectionResult.data) throw new Error("Collection La Botte introuvable.");

  const definitionsResult = await supabase
    .from("lottery_card_definitions")
    .select("id,code,name,rarity,description,image_url,is_active")
    .eq("collection_id", collectionResult.data.id)
    .order("card_number", { ascending: true });
  if (definitionsResult.error) {
    throw new Error(`[supabase:lottery_card_definitions] ${definitionsResult.error.message}`);
  }
  const definitions = (definitionsResult.data ?? []) as CardDefinitionRow[];
  const instances = await supabase
    .from("lottery_card_instances")
    .select("card_definition_id")
    .eq("user_id", ownerId)
    .in("card_definition_id", definitions.map((definition) => definition.id));
  if (instances.error) {
    throw new Error(`[supabase:lottery_card_instances] ${instances.error.message}`);
  }

  const inventory = countKqInventoryCopies(definitions, instances.data ?? []);
  const tokenWallet = await supabase.from("kq_culture_token_wallets")
    .select("balance").eq("user_id", ownerId).maybeSingle();
  if (tokenWallet.error) {
    throw new Error(`[supabase:kq_culture_token_wallets] ${tokenWallet.error.message}`);
  }
  return {
    collectionActive: collectionResult.data.is_active === true,
    ownerFound: true,
    cultureTokenBalance: Number(tokenWallet.data?.balance ?? 0),
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

export async function getKqPlayerOwnedBuddies(ownerId: string): Promise<KqOwnedBuddie[]> {
  if (!/^[0-9a-f-]{36}$/i.test(ownerId)) throw new Error("Compte Placard invalide.");
  const supabase = createSupabaseServiceClient();
  const definitions = await supabase.from("lottery_card_definitions")
    .select("id,code,name,rarity,card_number,image_url")
    .in("code", KQ_BUDDIES.map((buddie) => buddie.code));
  if (definitions.error) {
    throw new Error(`[supabase:lottery_card_definitions] ${definitions.error.message}`);
  }
  const definitionRows = definitions.data ?? [];
  if (definitionRows.length === 0) return [];
  const instances = await supabase.from("lottery_card_instances")
    .select("card_definition_id")
    .eq("user_id", ownerId)
    .in("card_definition_id", definitionRows.map((definition) => definition.id));
  if (instances.error) {
    throw new Error(`[supabase:lottery_card_instances] ${instances.error.message}`);
  }
  const copyCounts = (instances.data ?? []).reduce<Map<string, number>>((counts, instance) => {
    const definitionId = String(instance.card_definition_id);
    counts.set(definitionId, (counts.get(definitionId) ?? 0) + 1);
    return counts;
  }, new Map());
  return definitionRows
    .filter((definition) => (copyCounts.get(String(definition.id)) ?? 0) > 0)
    .map((definition) => ({
      code: String(definition.code),
      name: String(definition.name),
      rarity: String(definition.rarity),
      cardNumber: Number(definition.card_number),
      imageUrl: String(definition.image_url ?? ""),
      ownedCopies: copyCounts.get(String(definition.id)) ?? 0,
    }))
    .sort((left, right) => left.cardNumber - right.cardNumber);
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

export async function getKqAdminLaunchReadinessFromSnapshots(
  heritage: Awaited<ReturnType<typeof getKqAdminHeritageSnapshot>>,
  collection: KqAdminCollectionSnapshot,
) {
  const supabase = createSupabaseServiceClient();
  const seasonCode = await getKqActiveSeasonCode();
  const [rulesResult, seasonRulesResult, seasonGrantsResult] = await Promise.all([
    supabase.from("kq_notebook_reward_rules").select("is_active"),
    supabase.from("kq_season_reward_rules").select("tier_code,is_active").eq("season_code", seasonCode),
    supabase.from("kq_season_reward_grants").select("id", { count: "exact", head: true }).eq("season_code", seasonCode),
  ]);
  if (rulesResult.error) throw new Error(`[supabase:kq_notebook_reward_rules] ${rulesResult.error.message}`);
  if (seasonRulesResult.error) throw new Error(`[supabase:kq_season_reward_rules] ${seasonRulesResult.error.message}`);
  if (seasonGrantsResult.error) throw new Error(`[supabase:kq_season_reward_grants] ${seasonGrantsResult.error.message}`);
  return buildKqLaunchReadiness({
    heritageCards: heritage.cards.map((card) => ({
      rarity: card.rarity,
      image_url: card.imageUrl,
      is_active: card.isActive,
    })),
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
    publicRulesApproved: process.env.KQ_PUBLIC_RULES_APPROVED?.trim().toLowerCase() === "true",
  });
}

export type KqStartRunInput = {
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
  if (!run?.id || !receipt?.id || !receipt.card_instance_id || !receipt.card_code || !receipt.burned_at) {
    throw new Error("Reçu de démarrage Supabase invalide.");
  }
  return {
    runId: String(run.id),
    cultureTokenBalance: Number(payload?.cultureTokenBalance ?? 0),
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

export async function startKqPlayerRun(ownerId: string, input: KqStartRunInput) {
  if (!/^[0-9a-f-]{36}$/i.test(ownerId)) throw new Error("Compte Placard invalide.");
  if (!KQ_BUDDIES.some((buddie) => buddie.code === input.buddieCode)) {
    throw new Error("Buddie invalide.");
  }
  if (!Array.isArray(input.deckCodes) || input.deckCodes.length < 2 || input.deckCodes.length > 250) {
    throw new Error("Deck invalide.");
  }
  const cultureTokens = Math.floor(input.cultureTokens ?? 0);
  if (cultureTokens < 0 || cultureTokens > KQ_CULTURE_TOKEN_RUN_CAP) {
    throw new Error("Nombre de jetons Coup de pouce invalide.");
  }
  const heritageCode = input.heritageCode?.trim() || undefined;
  if (heritageCode && !KQ_HERITAGE_CARDS.some((card) => card.code === heritageCode)) {
    throw new Error("Héritage invalide.");
  }
  const cards = input.deckCodes.map((code) => KQ_CARDS.find((card) => card.code === code));
  if (cards.some((card) => !card || card.category === "pbi")) {
    throw new Error("Le deck contient une carte interdite.");
  }
  if (cards.filter((card) => card?.category === "substrate").length !== 1) {
    throw new Error("Le deck doit contenir exactement un Substrat.");
  }

  const collection = await getKqPlayerCollectionSnapshot(ownerId);
  const collectionCodes = Object.entries(collection.inventory)
    .filter(([, copies]) => copies > 0)
    .map(([code]) => code);
  const seed = crypto.getRandomValues(new Uint32Array(1))[0] % 100000;
  const state = startKqGame(seed, {
    varietyCode: input.buddieCode,
    deckCodes: input.deckCodes,
    collectionCodes,
    startingXp: 1 + cultureTokens * KQ_CULTURE_TOKEN_START_XP,
    heritageCode,
  });
  const supabase = createSupabaseServiceClient();
  const result = await supabase.rpc("rpc_kq_start_run_with_heritage", {
    p_user_id: ownerId,
    p_buddie_code: input.buddieCode,
    p_seed: state.seed,
    p_deck_codes: state.deckCodes,
    p_scenario_codes: state.situationCodes,
    p_initial_state: state,
    p_culture_tokens: cultureTokens,
    p_heritage_code: heritageCode ?? null,
  });
  if (result.error) {
    const message = result.error.message || "Création de partie impossible.";
    if (message.includes("kq_active_run_exists")) throw new Error("Une culture Supabase est déjà active.");
    if (message.includes("kq_buddie_not_owned")) throw new Error("Ce Buddie n’est pas présent dans la collection.");
    if (message.includes("kq_deck_copy_missing")) throw new Error("Une ou plusieurs copies du deck ne sont pas disponibles.");
    if (message.includes("kq_culture_tokens_insufficient")) throw new Error("Solde de jetons Coup de pouce insuffisant.");
    if (message.includes("kq_heritage_inactive")) throw new Error("Cet Héritage n’est pas encore actif.");
    if (message.includes("kq_heritage_not_owned")) throw new Error("Cet Héritage n’est pas présent dans ta collection.");
    if (message.includes("kq_heritage_state_mismatch")) throw new Error("État Héritage invalide.");
    throw new Error(`[supabase:rpc_kq_start_run] ${message}`);
  }
  return { ...mapKqStartRunResult(result.data), state };
}

export async function startKqAdminRun(adminEmail: string, input: KqStartRunInput) {
  const ownerId = await findKqUserIdByEmail(adminEmail);
  if (!ownerId) throw new Error("Compte collection admin introuvable.");
  return startKqPlayerRun(ownerId, input);
}

export async function getKqPlayerActiveRun(ownerId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(ownerId)) throw new Error("Compte Placard invalide.");
  const supabase = createSupabaseServiceClient();
  const runResult = await supabase.from("kq_runs")
    .select("id,state,started_at,updated_at")
    .eq("user_id", ownerId).eq("status", "active")
    .order("started_at", { ascending: false }).limit(1).maybeSingle();
  if (runResult.error) throw new Error(`[supabase:kq_runs] ${runResult.error.message}`);
  if (!runResult.data) return null;
  const state = parseKqGameSave(encodeKqSave(runResult.data.state));
  if (!state) throw new Error("État de culture Supabase invalide.");
  const receiptsResult = await supabase.from("kq_card_burn_receipts")
    .select("id,card_instance_id,card_code,stage_index,use_kind,burned_at")
    .eq("run_id", runResult.data.id).order("burned_at", { ascending: false });
  if (receiptsResult.error) throw new Error(`[supabase:kq_card_burn_receipts] ${receiptsResult.error.message}`);
  return {
    runId: String(runResult.data.id),
    state,
    startedAt: String(runResult.data.started_at),
    updatedAt: String(runResult.data.updated_at),
    burnReceipts: (receiptsResult.data ?? []).map((receipt) => ({
      id: String(receipt.id), cardInstanceId: String(receipt.card_instance_id),
      cardCode: String(receipt.card_code), stageIndex: Number(receipt.stage_index),
      useKind: String(receipt.use_kind), burnedAt: String(receipt.burned_at),
    })),
  };
}

export async function getKqAdminActiveRun(adminEmail: string) {
  const ownerId = await findKqUserIdByEmail(adminEmail);
  return ownerId ? getKqPlayerActiveRun(ownerId) : null;
}

export async function getKqPlayerFlowers(ownerId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(ownerId)) throw new Error("Compte Placard invalide.");
  const supabase = createSupabaseServiceClient();
  const result = await supabase.from("kq_flowers")
    .select("id,run_id,variety_code,variety_name,quality,traits,combos,battle_stats,status,created_at,locked_at,burned_at")
    .eq("owner_id", ownerId)
    .in("status", ["available", "locked"])
    .order("created_at", { ascending: false })
    .limit(40);
  if (result.error) throw new Error(`[supabase:kq_flowers] ${result.error.message}`);
  return (result.data ?? []).map((flower) => ({
    id: String(flower.id),
    runId: String(flower.run_id),
    varietyCode: String(flower.variety_code),
    varietyName: String(flower.variety_name),
    quality: Number(flower.quality),
    traits: Array.isArray(flower.traits) ? flower.traits.map(String) : [],
    combos: Array.isArray(flower.combos) ? flower.combos.map(String) : [],
    stats: flower.battle_stats && typeof flower.battle_stats === "object" ? flower.battle_stats : {},
    status: String(flower.status),
    createdAt: String(flower.created_at),
    lockedAt: flower.locked_at ? String(flower.locked_at) : null,
    burnedAt: flower.burned_at ? String(flower.burned_at) : null,
  }));
}

export async function getKqAdminFlowers(adminEmail: string) {
  const ownerId = await findKqUserIdByEmail(adminEmail);
  return ownerId ? getKqPlayerFlowers(ownerId) : [];
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

export async function getKqPlayerFlowerRivals(ownerId: string, flowerId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(ownerId)) throw new Error("Compte Placard invalide.");
  if (!/^[0-9a-f-]{36}$/i.test(flowerId)) throw new Error("Fleur invalide.");
  const supabase = createSupabaseServiceClient();
  const ownResult = await supabase.from("kq_flowers").select("id,quality,status")
    .eq("id", flowerId).eq("owner_id", ownerId).maybeSingle();
  if (ownResult.error) throw new Error(`[supabase:kq_flowers] ${ownResult.error.message}`);
  if (!ownResult.data || ownResult.data.status !== "available") throw new Error("Cette Fleur n’est pas disponible.");
  const quality = Number(ownResult.data.quality);
  const recentResult = await supabase.from("kq_battles")
    .select("player_one_id,player_two_id")
    .eq("status", "verdict")
    .or(`player_one_id.eq.${ownerId},player_two_id.eq.${ownerId}`)
    .gte("locked_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  if (recentResult.error) throw new Error(`[supabase:kq_battles:recent-rivals] ${recentResult.error.message}`);
  const recentOpponentIds = new Set((recentResult.data ?? []).map((battle) =>
    battle.player_one_id === ownerId ? String(battle.player_two_id) : String(battle.player_one_id)));
  const result = await supabase.from("kq_flowers")
    .select("id,owner_id,variety_name,quality,traits,battle_stats,created_at")
    .eq("status", "available").neq("owner_id", ownerId)
    .gte("quality", quality - 8).lte("quality", quality + 8)
    .order("quality", { ascending: false }).order("created_at", { ascending: true }).limit(36);
  if (result.error) throw new Error(`[supabase:kq_flowers:rivals] ${result.error.message}`);
  const humanRivals = (result.data ?? []).filter((flower) => !recentOpponentIds.has(String(flower.owner_id))).slice(0, 12).map((flower) => ({
    flowerId: String(flower.id),
    varietyName: String(flower.variety_name),
    quality: Number(flower.quality),
    traits: Array.isArray(flower.traits) ? flower.traits.map(String) : [],
    stats: flower.battle_stats && typeof flower.battle_stats === "object" ? flower.battle_stats : {},
    createdAt: String(flower.created_at),
    opponentType: "human" as const,
  }));
  if (humanRivals.length > 0) return humanRivals;

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
  const bots = [
    { code: "bot-sylvain", name: "Sylvain · Jardin d’essai", variety: "Harlequin" },
    { code: "bot-charles", name: "Charles · Serre du club", variety: "Cannatonic" },
    { code: "bot-maya", name: "Maya · Atelier botanique", variety: "Sour Tsunami" },
  ];
  return bots.map((definition, index) => {
    const bot = createKqOpponent(botSeed + index * 97, {
      ownerName: definition.name,
      variety: definition.variety,
      rating: 1000 + (quality - 12) * 12,
    });
    return {
      flowerId: `bot:${definition.code}`,
      varietyName: bot.variety,
      quality: Math.max(quality - 3, Math.min(quality + 3, Math.round((Object.values(bot.stats).reduce((sum, value) => sum + value, 0) / 5 - 52) / 2.4))),
      traits: bot.traits,
      stats: bot.stats,
      createdAt: new Date().toISOString(),
      opponentType: "bot" as const,
      opponentName: definition.name,
      experienceReward: 0.1,
      remainingBotDuels: remaining,
    };
  });
}

export async function finalizeKqPlayerBotBattle(ownerId: string, flowerId: string, botCode: string) {
  if (!/^[0-9a-f-]{36}$/i.test(ownerId) || !/^[0-9a-f-]{36}$/i.test(flowerId)) throw new Error("Duel d’entraînement invalide.");
  const botDefinitions = {
    "bot-sylvain": { name: "Sylvain · Jardin d’essai", variety: "Harlequin", salt: 11 },
    "bot-charles": { name: "Charles · Serre du club", variety: "Cannatonic", salt: 37 },
    "bot-maya": { name: "Maya · Atelier botanique", variety: "Sour Tsunami", salt: 71 },
  } as const;
  const definition = botDefinitions[botCode as keyof typeof botDefinitions];
  if (!definition) throw new Error("Bot inconnu.");
  const supabase = createSupabaseServiceClient();
  const flowerResult = await supabase.from("kq_flowers")
    .select("id,variety_name,quality,traits,battle_stats,status,created_at")
    .eq("id", flowerId).eq("owner_id", ownerId).maybeSingle();
  if (flowerResult.error) throw new Error(`[supabase:kq_flowers:bot] ${flowerResult.error.message}`);
  if (!flowerResult.data || flowerResult.data.status !== "available") throw new Error("Ta Fleur n’est plus disponible.");
  const row = flowerResult.data as KqFlowerBattleRow;
  const playerFlower = mapKqOfficialFlowerCard(row, "Toi");
  const seed = Math.abs((Date.now() & 0x7fffffff) + definition.salt);
  const opponentFlower = createKqOpponent(seed, {
    ownerName: definition.name,
    variety: definition.variety,
    rating: 1000 + (Number(row.quality) - 12) * 12,
  });
  const verdict = resolveKqBattle(lockKqBattle(playerFlower, opponentFlower, seed), seed, new Date());
  if (!verdict.winner || !verdict.burnedAt) throw new Error("Le bot n’a pas produit de verdict.");
  const result = await supabase.rpc("rpc_kq_finalize_bot_battle", {
    p_user_id: ownerId,
    p_flower_id: flowerId,
    p_bot_code: botCode,
    p_bot_flower: opponentFlower,
    p_seed: seed,
    p_rounds: verdict.rounds,
    p_winner: verdict.winner,
  });
  if (result.error) {
    const message = result.error.message || "Duel d’entraînement impossible.";
    if (message.includes("kq_bot_daily_limit")) throw new Error("Tes 10 duels contre des bots ont déjà été joués aujourd’hui.");
    if (message.includes("kq_flower_unavailable")) throw new Error("Ta Fleur n’est plus disponible.");
    throw new Error(`[supabase:rpc_kq_finalize_bot_battle] ${message}`);
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
    experienceAwarded: Number(payload.experienceAwarded ?? 0.1),
    todayCount: Number(payload.todayCount),
    dailyLimit: Number(payload.dailyLimit ?? 10),
    playerFlower,
    opponentFlower,
    opponentType: "bot" as const,
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

export async function lockKqPlayerBattle(ownerId: string, flowerId: string, rivalFlowerId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(ownerId)) throw new Error("Compte Placard invalide.");
  if (![flowerId, rivalFlowerId].every((id) => /^[0-9a-f-]{36}$/i.test(id)) || flowerId === rivalFlowerId) {
    throw new Error("Duel invalide.");
  }
  const supabase = createSupabaseServiceClient();
  const ownResult = await supabase.from("kq_flowers").select("id,status,quality")
    .eq("id", flowerId).eq("owner_id", ownerId).maybeSingle();
  if (ownResult.error) throw new Error(`[supabase:kq_flowers] ${ownResult.error.message}`);
  if (!ownResult.data || ownResult.data.status !== "available") throw new Error("Ta Fleur n’est plus disponible.");
  const rivalResult = await supabase.from("kq_flowers").select("id,owner_id,status,quality")
    .eq("id", rivalFlowerId).maybeSingle();
  if (rivalResult.error) throw new Error(`[supabase:kq_flowers:rival] ${rivalResult.error.message}`);
  if (!rivalResult.data || rivalResult.data.status !== "available" || rivalResult.data.owner_id === ownerId) {
    throw new Error("La Fleur adverse n’est plus disponible.");
  }
  if (Math.abs(Number(rivalResult.data.quality) - Number(ownResult.data.quality)) > 8) {
    throw new Error("Cette Fleur est hors de la plage de matchmaking.");
  }
  const result = await supabase.rpc("rpc_kq_lock_ranked_battle", {
    p_challenger_id: ownerId,
    p_flower_one_id: flowerId,
    p_flower_two_id: rivalFlowerId,
  });
  if (result.error) {
    const message = result.error.message || "Verrouillage du duel impossible.";
    if (message.includes("Flower already used") || message.includes("Could not lock")) {
      throw new Error("Une des Fleurs vient d’être engagée dans un autre duel.");
    }
    if (message.includes("Players must be distinct")) throw new Error("Les deux Fleurs doivent appartenir à des joueurs différents.");
    if (message.includes("outside matchmaking range")) throw new Error("Cette Fleur est hors de la plage de matchmaking.");
    if (message.includes("Ranked opponent cooldown")) throw new Error("Cet adversaire a déjà été affronté durant les dernières 24 heures.");
    throw new Error(`[supabase:rpc_kq_lock_ranked_battle] ${message}`);
  }
  const battle = result.data as Record<string, unknown> | null;
  if (!battle?.id) throw new Error("Réponse de duel Supabase invalide.");
  return { battleId: String(battle.id), seed: Number(battle.seed), status: String(battle.status) };
}

export async function lockKqAdminBattle(adminEmail: string, flowerId: string, rivalFlowerId: string) {
  const ownerId = await findKqUserIdByEmail(adminEmail);
  if (!ownerId) throw new Error("Compte collection admin introuvable.");
  return lockKqPlayerBattle(ownerId, flowerId, rivalFlowerId);
}

type KqFlowerBattleRow = {
  id: string; variety_name: string; quality: number; traits: string[];
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

export async function getKqPlayerBattles(ownerId: string, limit = 30) {
  if (!/^[0-9a-f-]{36}$/i.test(ownerId)) throw new Error("Compte Placard invalide.");
  if (!Number.isInteger(limit) || limit < 1 || limit > 30) throw new Error("Limite de duels invalide.");
  const supabase = createSupabaseServiceClient();
  const battlesResult = await supabase.from("kq_battles")
    .select("id,player_one_id,player_two_id,flower_one_id,flower_two_id,status,seed,rounds,winner_id,locked_at,verdict_at")
    .or(`player_one_id.eq.${ownerId},player_two_id.eq.${ownerId}`)
    .order("locked_at", { ascending: false }).limit(limit);
  if (battlesResult.error) throw new Error(`[supabase:kq_battles] ${battlesResult.error.message}`);
  const battles = battlesResult.data ?? [];
  const flowerIds = [...new Set(battles.flatMap((battle) => [battle.flower_one_id, battle.flower_two_id]))];
  const flowersResult = flowerIds.length > 0
    ? await supabase.from("kq_flowers").select("id,variety_name,quality,traits,battle_stats,status,created_at").in("id", flowerIds)
    : { data: [], error: null };
  if (flowersResult.error) throw new Error(`[supabase:kq_flowers:battles] ${flowersResult.error.message}`);
  const flowers = new Map((flowersResult.data ?? []).map((flower) => [flower.id, flower as KqFlowerBattleRow]));
  const humanBattles = battles.flatMap((battle) => {
    const adminIsOne = battle.player_one_id === ownerId;
    const playerFlower = flowers.get(adminIsOne ? battle.flower_one_id : battle.flower_two_id);
    const opponentFlower = flowers.get(adminIsOne ? battle.flower_two_id : battle.flower_one_id);
    if (!playerFlower || !opponentFlower) return [];
    return [{
      id: String(battle.id), status: String(battle.status), seed: Number(battle.seed),
      playerFlower: mapKqOfficialFlowerCard(playerFlower, "Toi"),
      opponentFlower: mapKqOfficialFlowerCard(opponentFlower, "Adversaire"),
      rounds: mapKqStoredBattleRounds(battle.rounds, !adminIsOne),
      winner: battle.winner_id ? (battle.winner_id === ownerId ? "player" : "opponent") : null,
      lockedAt: String(battle.locked_at),
      verdictAt: battle.verdict_at ? String(battle.verdict_at) : null,
      opponentType: "human" as const,
      experienceAwarded: battle.status === "verdict" ? 1 : 0,
    }];
  });
  const botResult = await supabase.from("kq_bot_battles")
    .select("id,flower_id,bot_code,bot_flower,seed,rounds,winner,experience_awarded,verdict_at")
    .eq("user_id", ownerId).order("verdict_at", { ascending: false }).limit(limit);
  if (botResult.error) throw new Error(`[supabase:kq_bot_battles:history] ${botResult.error.message}`);
  const botFlowerIds = (botResult.data ?? []).map((battle) => battle.flower_id);
  const botFlowersResult = botFlowerIds.length > 0
    ? await supabase.from("kq_flowers").select("id,variety_name,quality,traits,battle_stats,status,created_at").in("id", botFlowerIds)
    : { data: [], error: null };
  if (botFlowersResult.error) throw new Error(`[supabase:kq_flowers:bot-history] ${botFlowersResult.error.message}`);
  const botFlowers = new Map((botFlowersResult.data ?? []).map((flower) => [flower.id, flower as KqFlowerBattleRow]));
  const botBattles = (botResult.data ?? []).flatMap((battle) => {
    const playerFlower = botFlowers.get(battle.flower_id);
    const opponentFlower = battle.bot_flower && typeof battle.bot_flower === "object"
      ? battle.bot_flower as KqFlowerCard
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
  });
  return [...humanBattles, ...botBattles]
    .sort((left, right) => new Date(right.lockedAt).getTime() - new Date(left.lockedAt).getTime())
    .slice(0, limit);
}

export async function getKqPlayerBattle(ownerId: string, battleId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(ownerId)) throw new Error("Compte Placard invalide.");
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
    .select("id,variety_name,quality,traits,battle_stats,status,created_at")
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
  if (!/^[0-9a-f-]{36}$/i.test(ownerId)) throw new Error("Compte Placard invalide.");
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
    const refreshedBattles = await getKqPlayerBattles(ownerId);
    if (refreshedBattles.some((candidate) => candidate.id === battleId && candidate.status === "verdict")) {
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

export async function getKqPublicLeaderboard() {
  const supabase = createSupabaseServiceClient();
  const seasonCode = await getKqActiveSeasonCode();
  const snapshotResult = await supabase.rpc("rpc_kq_refresh_daily_leaderboard", {
    p_season_code: seasonCode,
  });
  if (snapshotResult.error) throw new Error(`[supabase:rpc_kq_refresh_daily_leaderboard] ${snapshotResult.error.message}`);
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
  return {
    seasonCode,
    generatedAt: snapshot?.generated_at ? String(snapshot.generated_at) : new Date().toISOString(),
    entries: rawLeaderboard.map((entry, index) => ({
      rank: Number(entry.rank ?? index + 1),
      pseudo: pseudoByUser.get(String(entry.userId)) ?? `Cultivateur ${String(index + 1).padStart(2, "0")}`,
      rating: Number(entry.rating ?? 1000),
      seasonPoints: Number(entry.seasonPoints ?? 0),
      wins: Number(entry.wins ?? 0),
      losses: Number(entry.losses ?? 0),
      streak: Number(entry.streak ?? 0),
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
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error("Profil Placard invalide.");
  const supabase = createSupabaseServiceClient();
  const profileResult = await supabase.from("kq_rank_profiles")
    .select("season_code,rating,season_points,wins,losses,streak,burned_flowers,arena_experience,updated_at")
    .eq("user_id", userId).maybeSingle();
  if (profileResult.error) throw new Error(`[supabase:kq_rank_profiles] ${profileResult.error.message}`);
  if (!profileResult.data) return null;
  const snapshotResult = await supabase.from("kq_leaderboard_snapshots")
    .select("leaderboard,snapshot_date").eq("season_code", profileResult.data.season_code)
    .order("snapshot_date", { ascending: false }).limit(1).maybeSingle();
  if (snapshotResult.error) throw new Error(`[supabase:kq_leaderboard_snapshots] ${snapshotResult.error.message}`);
  const snapshot = Array.isArray(snapshotResult.data?.leaderboard)
    ? snapshotResult.data.leaderboard as Array<Record<string, unknown>> : [];
  const rankEntry = snapshot.find((entry) => String(entry.userId) === userId);
  const league = getKqLeague(Number(profileResult.data.rating));
  return {
    seasonCode: String(profileResult.data.season_code),
    rank: rankEntry ? Number(rankEntry.rank) : null,
    rating: Number(profileResult.data.rating),
    seasonPoints: Number(profileResult.data.season_points),
    wins: Number(profileResult.data.wins),
    losses: Number(profileResult.data.losses),
    streak: Number(profileResult.data.streak),
    arenaExperience: Number(profileResult.data.arena_experience ?? 0),
    burnedFlowers: Number(profileResult.data.burned_flowers),
    league: league.name,
    leagueProgress: league.progress,
    pointsToNextLeague: league.pointsToNext,
    leaderboardGeneratedAt: snapshotResult.data?.snapshot_date
      ? String(snapshotResult.data.snapshot_date)
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
  if (!/^[0-9a-f-]{36}$/i.test(ownerId)) throw new Error("Compte Placard invalide.");
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
  if (!/^[0-9a-f-]{36}$/i.test(ownerId)) throw new Error("Compte Placard invalide.");
  if (!/^[0-9a-f-]{36}$/i.test(runId)) throw new Error("Culture invalide.");
  const supabase = createSupabaseServiceClient();
  const runResult = await supabase.from("kq_runs").select("state,status,updated_at")
    .eq("id", runId).eq("user_id", ownerId).maybeSingle();
  if (runResult.error) throw new Error(`[supabase:kq_runs] ${runResult.error.message}`);
  if (!runResult.data || runResult.data.status !== "active") throw new Error("Culture active introuvable.");
  const state = parseKqGameSave(encodeKqSave(runResult.data.state));
  if (!state) throw new Error("État de culture invalide.");
  const nextState = applyKqRunAction(state, action, options);
  const flower = nextState.phase === "complete" ? createKqFlower(nextState) : null;
  const result = action === "heritage-swap"
    ? await supabase.rpc("rpc_kq_swap_heritage_hand", {
        p_user_id: ownerId,
        p_run_id: runId,
        p_expected_updated_at: runResult.data.updated_at,
        p_next_state: nextState,
      })
    : await supabase.rpc("rpc_kq_update_run_state", {
        p_user_id: ownerId, p_run_id: runId, p_expected_updated_at: runResult.data.updated_at,
        p_action: action, p_next_state: nextState,
        p_flower: flower ? {
          varietyCode: nextState.varietyCode,
          varietyName: flower.variety,
          quality: nextState.quality,
          traits: flower.traits,
          combos: nextState.combos,
          battleStats: flower.stats,
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
