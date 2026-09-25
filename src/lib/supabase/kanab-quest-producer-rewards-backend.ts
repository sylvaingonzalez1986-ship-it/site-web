import "server-only";

import {
  buildKqProducerRewardProgress,
  KQ_PRODUCER_COMPLETION_CASH_CENTS,
  KQ_PRODUCER_NOTEBOOK_REWARDS_LIVE,
  type KqProducerNotebookRewardReceipt,
  type KqProducerRewardCard,
  type KqProducerRewardProgress,
} from "@/lib/kanab-quest-producer-rewards";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";

type ServiceClient = ReturnType<typeof createSupabaseServiceClient>;
type ProducerState = {
  producerId: string;
  selectedSeasonId: string;
  qualifyingProductIds: string[];
  reviewedProductIds: string[];
  purchasedProductIds: string[];
  completionGranted: boolean;
  purchaseGranted: boolean;
  purchaseCard: KqProducerRewardCard | null;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function stringIds(value: unknown) {
  return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === "string" && id.length > 0))] : [];
}
function rewardCard(value: unknown): KqProducerRewardCard | null {
  const card = record(value);
  return typeof card.code === "string" && typeof card.name === "string"
    && (card.rarity === "silver" || card.rarity === "gold")
    ? { code: card.code, name: card.name, rarity: card.rarity, imageUrl: typeof card.imageUrl === "string" ? card.imageUrl : "" }
    : null;
}

async function loadProducerStates(client: ServiceClient, customerId: string): Promise<ProducerState[]> {
  const result = await client.rpc("rpc_kq_get_producer_notebook_progress", { p_user_id: customerId });
  if (result.error) throw new Error(`[data:producer-progress] ${result.error.message}`);
  if (!Array.isArray(result.data)) throw new Error("Progression producteur indisponible.");
  return result.data.map((value: unknown) => {
    const state = record(value);
    if (typeof state.producerId !== "string" || !Array.isArray(state.qualifyingProductIds)
      || !Array.isArray(state.reviewedProductIds) || !Array.isArray(state.purchasedProductIds)
      || typeof state.completionGranted !== "boolean" || typeof state.purchaseGranted !== "boolean") {
      throw new Error("Progression producteur indisponible.");
    }
    return {
      producerId: state.producerId,
      selectedSeasonId: typeof state.selectedSeasonId === "string" ? state.selectedSeasonId : "",
      qualifyingProductIds: stringIds(state.qualifyingProductIds),
      reviewedProductIds: stringIds(state.reviewedProductIds),
      purchasedProductIds: stringIds(state.purchasedProductIds),
      completionGranted: state.completionGranted,
      purchaseGranted: state.purchaseGranted,
      purchaseCard: rewardCard(state.purchaseCard),
    };
  });
}

const EMPTY_RECEIPT: KqProducerNotebookRewardReceipt = {
  live: false, flowerBoosterGranted: false, flowerBoostersGranted: 0, flowerBoostersTotal: 0,
  boosterCardCount: 0, heritageGranted: 0, heritageCodes: [], completionGranted: 0, cashCents: 0, producerId: "",
};

export async function syncKqProducerNotebookRewardsForReview(input: {
  customerId: string;
  reviewId: string;
}): Promise<KqProducerNotebookRewardReceipt> {
  if (!KQ_PRODUCER_NOTEBOOK_REWARDS_LIVE) return EMPTY_RECEIPT;
  const customerId = input.customerId.trim();
  const reviewId = input.reviewId.trim();
  if (!/^[0-9a-f-]{36}$/i.test(customerId) || !/^[0-9a-f-]{36}$/i.test(reviewId)) throw new Error("Récompense Carnet invalide.");
  const result = await createSupabaseServiceClient().rpc("rpc_kq_grant_producer_notebook_rewards", {
    p_user_id: customerId, p_review_id: reviewId,
  });
  if (result.error) throw new Error(`[data:producer-notebook-reward] ${result.error.message}`);
  const receipt = record(result.data);
  return {
    live: true,
    flowerBoosterGranted: receipt.flowerBoosterGranted === true,
    flowerBoostersGranted: Number(receipt.flowerBoostersGranted ?? 0),
    flowerBoostersTotal: Number(receipt.flowerBoostersTotal ?? 0),
    boosterCardCount: Number(receipt.boosterCardCount ?? 0),
    heritageGranted: Number(receipt.heritageGranted ?? 0),
    heritageCodes: stringIds(receipt.heritageCodes),
    completionGranted: Number(receipt.completionGranted ?? 0),
    cashCents: Number(receipt.cashCents ?? 0),
    producerId: typeof receipt.producerId === "string" ? receipt.producerId : "",
  };
}

export async function getKqProducerRewardProgressForCustomer(customerId: string): Promise<KqProducerRewardProgress[]> {
  const safeCustomerId = customerId.trim();
  if (!/^[0-9a-f-]{36}$/i.test(safeCustomerId)) return [];
  const client = createSupabaseServiceClient();
  const [states, producersResult, entriesResult, definitionsResult, campaignsResult, heritageGrantsResult] = await Promise.all([
    loadProducerStates(client, safeCustomerId),
    client.from("producers").select("id,name,image").order("name", { ascending: true }),
    client.from("contest_entries").select("id,title,product_id,producer_id,season_id,track,is_published")
      .eq("is_published", true).not("producer_id", "is", null).order("position", { ascending: true }),
    client.from("kq_heritage_card_definitions").select("code,name,description,image_url,producer_id,is_active").eq("is_active", true),
    client.from("kq_producer_reward_campaigns").select("id,producer_id,heritage_code").eq("status", "active"),
    client.from("kq_producer_heritage_reward_grants").select("producer_id").eq("user_id", safeCustomerId),
  ]);
  for (const [label, result] of [
    ["producers", producersResult], ["entries", entriesResult], ["heritages", definitionsResult],
    ["campaigns", campaignsResult], ["heritage-grants", heritageGrantsResult],
  ] as const) {
    if (result.error) throw new Error(`[data:producer-progress-${label}] ${result.error.message}`);
  }
  const stateByProducer = new Map(states.map((state) => [state.producerId, state]));
  const entries = (entriesResult.data ?? []).filter((entry) => {
    const state = stateByProducer.get(String(entry.producer_id));
    return state?.qualifyingProductIds.includes(String(entry.product_id))
      && (!state.selectedSeasonId || state.selectedSeasonId === String(entry.season_id));
  });
  const entryIds = entries.map((entry) => String(entry.id));
  const campaignIds = (campaignsResult.data ?? []).map((campaign) => String(campaign.id));
  const [flowerGrantsResult, requirementsResult, reviewsResult] = await Promise.all([
    entryIds.length
      ? client.from("kq_notebook_flower_reward_grants").select("id,entry_id,entitlement_id")
          .eq("user_id", safeCustomerId).in("entry_id", entryIds)
      : Promise.resolve({ data: [], error: null }),
    campaignIds.length
      ? client.from("kq_producer_reward_entries").select("campaign_id,entry_id").in("campaign_id", campaignIds)
      : Promise.resolve({ data: [], error: null }),
    client.from("contest_reviews").select("entry_id").eq("customer_id", safeCustomerId).eq("status", "approved"),
  ]);
  if (requirementsResult.error) throw new Error("[data:producer-requirements] " + requirementsResult.error.message);
  if (reviewsResult.error) throw new Error("[data:producer-reviews] " + reviewsResult.error.message);
  const approvedEntryIds = new Set((reviewsResult.data ?? []).map((review) => String(review.entry_id)));
  if (flowerGrantsResult.error) throw new Error(`[data:flower-reward-grants] ${flowerGrantsResult.error.message}`);
  const grants = flowerGrantsResult.data ?? [];
  const flowerPacksResult = grants.length
    ? await client.from("kq_notebook_flower_reward_packs").select("flower_grant_id,pack_index,entitlement_id")
        .in("flower_grant_id", grants.map((grant) => String(grant.id)))
    : { data: [], error: null };
  if (flowerPacksResult.error) throw new Error(`[data:flower-reward-packs] ${flowerPacksResult.error.message}`);
  const packs = [...(flowerPacksResult.data ?? [])];
  for (const grant of grants) {
    if (!packs.some((pack) => String(pack.flower_grant_id) === String(grant.id)) && grant.entitlement_id) {
      packs.push({ flower_grant_id: grant.id, pack_index: 1, entitlement_id: grant.entitlement_id });
    }
  }
  const entitlementIds = [...new Set(packs.map((pack) => String(pack.entitlement_id)))];
  const entitlementsResult = entitlementIds.length
    ? await client.from("kq_support_booster_entitlements").select("id,status").in("id", entitlementIds)
    : { data: [], error: null };
  if (entitlementsResult.error) throw new Error(`[data:flower-reward-entitlements] ${entitlementsResult.error.message}`);
  const statuses = new Map((entitlementsResult.data ?? []).map((row) => [String(row.id), String(row.status)]));
  const packProgressByEntryId = new Map(grants.map((grant) => {
    const rows = packs.filter((pack) => String(pack.flower_grant_id) === String(grant.id));
    const availableEntitlementIds = rows.filter((pack) => statuses.get(String(pack.entitlement_id)) === "available")
      .map((pack) => String(pack.entitlement_id));
    return [String(grant.entry_id), {
      grantedPacks: rows.length, availablePacks: availableEntitlementIds.length,
      openedPacks: rows.filter((pack) => statuses.get(String(pack.entitlement_id)) === "opened").length,
      availableEntitlementIds,
    }];
  }));
  const definitionByProducer = new Map((definitionsResult.data ?? []).map((row) => [String(row.producer_id), row]));
  const campaignByProducer = new Map((campaignsResult.data ?? []).map((row) => [String(row.producer_id), row]));
  const heritageProducerIds = new Set((heritageGrantsResult.data ?? []).map((row) => String(row.producer_id)));
  return (producersResult.data ?? []).flatMap((producer) => {
    const producerId = String(producer.id);
    const state = stateByProducer.get(producerId);
    if (!state || state.qualifyingProductIds.length === 0) return [];
    const producerEntries = entries.filter((entry) => String(entry.producer_id) === producerId);
    if (new Set(producerEntries.map((entry) => String(entry.product_id))).size !== state.qualifyingProductIds.length) {
      throw new Error("Le catalogue de dégustation a changé. Recharge le carnet.");
    }
    const definition = definitionByProducer.get(producerId);
    const campaign = campaignByProducer.get(producerId);
    return [buildKqProducerRewardProgress({
      campaignId: campaign ? String(campaign.id) : "", producerId,
      producerName: String(producer.name), producerImage: String(producer.image ?? ""),
      heritageCode: String(definition?.code ?? ""), heritageName: String(definition?.name ?? ""),
      heritageDescription: String(definition?.description ?? ""), heritageImage: String(definition?.image_url ?? ""),
      entries: producerEntries.map((entry) => ({
        entryId: String(entry.id), productId: String(entry.product_id), title: String(entry.title),
        track: entry.track === "concours" ? "concours" : "regular",
      })),
      approvedProductIds: state.reviewedProductIds, purchasedProductIds: state.purchasedProductIds,
      packProgressByEntryId, heritageGranted: heritageProducerIds.has(producerId),
      heritageEligible: Boolean(campaign && (requirementsResult.data ?? []).some((requirement) =>
        String(requirement.campaign_id) === String(campaign.id) && approvedEntryIds.has(String(requirement.entry_id)),
      )),
      completionGranted: state.completionGranted, purchaseGranted: state.purchaseGranted, purchaseCard: state.purchaseCard,
    })];
  });
}

function producerClaimInput(input: { customerId: string; producerId: string }) {
  const customerId = input.customerId.trim();
  const producerId = input.producerId.trim();
  if (!/^[0-9a-f-]{36}$/i.test(customerId) || !producerId || producerId.length > 200) throw new Error("Demande de récompense invalide.");
  return { p_user_id: customerId, p_producer_id: producerId };
}

export async function claimKqProducerCompletionForCustomer(input: { customerId: string; producerId: string }) {
  const parameters = producerClaimInput(input);
  const result = await createSupabaseServiceClient().rpc("rpc_kq_claim_producer_completion", parameters);
  if (result.error) {
    if (result.error.message.includes("kq_producer_completion_incomplete")) throw new Error("Fais valider un avis sur chaque fleur du producteur pour recevoir la récompense.");
    throw new Error("Récompense de dégustation momentanément indisponible.");
  }
  const receipt = record(result.data);
  if (receipt.producerId !== parameters.p_producer_id || receipt.cashCents !== KQ_PRODUCER_COMPLETION_CASH_CENTS
    || typeof receipt.alreadyGranted !== "boolean") throw new Error("Récompense de dégustation momentanément indisponible.");
  return { producerId: parameters.p_producer_id, cashCents: KQ_PRODUCER_COMPLETION_CASH_CENTS,
    alreadyGranted: receipt.alreadyGranted, qualifyingProductIds: stringIds(receipt.qualifyingProductIds) };
}

export async function claimKqProducerPurchaseBuddieForCustomer(input: { customerId: string; producerId: string }) {
  const parameters = producerClaimInput(input);
  const result = await createSupabaseServiceClient().rpc("rpc_kq_claim_producer_purchase_buddie", parameters);
  if (result.error) {
    if (result.error.message.includes("kq_producer_purchase_incomplete")) throw new Error("Achète chaque fleur du producteur pour recevoir ton Buddie Argent ou Or.");
    throw new Error("Buddie producteur momentanément indisponible.");
  }
  const receipt = record(result.data);
  const card = rewardCard({ code: receipt.cardCode, name: receipt.cardName, rarity: receipt.cardRarity, imageUrl: receipt.cardImageUrl });
  if (receipt.producerId !== parameters.p_producer_id || !card
    || (typeof receipt.cardInstanceId !== "string" && !(receipt.alreadyGranted === true && receipt.cardInstanceId === null))
    || typeof receipt.alreadyGranted !== "boolean") throw new Error("Buddie producteur momentanément indisponible.");
  return { producerId: parameters.p_producer_id, cardCode: card.code, cardName: card.name, cardRarity: card.rarity,
    cardImageUrl: card.imageUrl, cardInstanceId: receipt.cardInstanceId, alreadyGranted: receipt.alreadyGranted,
    qualifyingProductIds: stringIds(receipt.qualifyingProductIds) };
}

export async function claimKqProducerHeritageForCustomer(input: { customerId: string; campaignId: string; entryId: string }) {
  const customerId = input.customerId.trim();
  const campaignId = input.campaignId.trim();
  const entryId = input.entryId.trim();
  if (!/^[0-9a-f-]{36}$/i.test(customerId) || !/^[0-9a-f-]{36}$/i.test(campaignId) || !entryId || entryId.length > 200) {
    throw new Error("Demande de déblocage invalide.");
  }
  const result = await createSupabaseServiceClient().rpc("rpc_kq_claim_producer_heritage", {
    p_user_id: customerId, p_campaign_id: campaignId, p_entry_id: entryId,
  });
  if (result.error) {
    if (result.error.message.includes("kq_producer_heritage_incomplete")) throw new Error("Un avis éligible doit être validé avant le déblocage.");
    if (result.error.message.includes("kq_producer_heritage_unavailable")) throw new Error("Cette carte Héritage n’est pas disponible.");
    throw new Error("Déblocage de la carte Héritage impossible.");
  }
  const receipt = record(result.data);
  return { cardCode: String(receipt.cardCode ?? ""), alreadyGranted: receipt.alreadyGranted === true };
}

export type KqProducerRewardAdminSnapshot = {
  producers: Array<{ id: string; name: string; image: string }>;
  entries: Array<{ id: string; title: string; producerId: string; track: "regular" | "concours" }>;
  heritages: Array<{ code: string; name: string; description: string; effectCode: string; producerId: string | null; isActive: boolean }>;
  campaigns: Array<{ id: string; producerId: string; heritageCode: string; version: number; status: "draft" | "active" | "archived"; entryIds: string[] }>;
};

export async function getKqProducerRewardAdminSnapshot(): Promise<KqProducerRewardAdminSnapshot> {
  const client = createSupabaseServiceClient();
  const [producersResult, entriesResult, heritagesResult, campaignsResult] = await Promise.all([
    client.from("producers").select("id,name,image").order("name", { ascending: true }),
    client.from("contest_entries").select("id,title,producer_id,track,is_published")
      .eq("is_published", true).not("producer_id", "is", null).order("title", { ascending: true }),
    client.from("kq_heritage_card_definitions").select("code,name,description,effect_code,producer_id,is_active").order("code", { ascending: true }),
    client.from("kq_producer_reward_campaigns").select("id,producer_id,heritage_code,version,status")
      .order("created_at", { ascending: true }),
  ]);
  if (producersResult.error) throw new Error(`[data:reward-admin-producers] ${producersResult.error.message}`);
  if (entriesResult.error) throw new Error(`[data:reward-admin-entries] ${entriesResult.error.message}`);
  if (heritagesResult.error) throw new Error(`[data:reward-admin-heritages] ${heritagesResult.error.message}`);
  if (campaignsResult.error) throw new Error(`[data:reward-admin-campaigns] ${campaignsResult.error.message}`);
  const campaigns = campaignsResult.data ?? [];
  const campaignIds = campaigns.map((row) => String(row.id));
  const requirementsResult = campaignIds.length
    ? await client.from("kq_producer_reward_entries").select("campaign_id,entry_id,position")
        .in("campaign_id", campaignIds).order("position", { ascending: true })
    : { data: [], error: null };
  if (requirementsResult.error) throw new Error(`[data:reward-admin-requirements] ${requirementsResult.error.message}`);
  return {
    producers: (producersResult.data ?? []).map((row) => ({ id: String(row.id), name: String(row.name), image: String(row.image ?? "") })),
    entries: (entriesResult.data ?? []).map((row) => ({
      id: String(row.id), title: String(row.title), producerId: String(row.producer_id),
      track: row.track === "concours" ? "concours" : "regular",
    })),
    heritages: (heritagesResult.data ?? []).map((row) => ({
      code: String(row.code), name: String(row.name), description: String(row.description),
      effectCode: String(row.effect_code), producerId: row.producer_id ? String(row.producer_id) : null,
      isActive: row.is_active === true,
    })),
    campaigns: campaigns.map((row) => ({
      id: String(row.id), producerId: String(row.producer_id), heritageCode: String(row.heritage_code),
      version: Number(row.version), status: row.status === "active" ? "active" : row.status === "archived" ? "archived" : "draft",
      entryIds: (requirementsResult.data ?? []).filter((item) => String(item.campaign_id) === String(row.id)).map((item) => String(item.entry_id)),
    })),
  };
}

export async function configureKqProducerRewardCampaign(input: {
  producerId: string;
  heritageCode: string;
  entryIds: string[];
  activate: boolean;
}) {
  const producerId = input.producerId.trim();
  const heritageCode = input.heritageCode.trim();
  const entryIds = [...new Set(input.entryIds.map((entryId) => entryId.trim()).filter(Boolean))];
  if (!producerId || !/^HERITAGE-[0-9]{3,6}$/.test(heritageCode) || entryIds.length === 0 || entryIds.length > 20) {
    throw new Error("Configuration du parcours invalide.");
  }
  const client = createSupabaseServiceClient();
  const result = await client.rpc("rpc_kq_configure_producer_reward_campaign", {
    p_producer_id: producerId,
    p_heritage_code: heritageCode,
    p_entry_ids: entryIds,
    p_activate: input.activate,
  });
  if (result.error) throw new Error(`[data:configure-producer-campaign] ${result.error.message}`);
  return result.data;
}

export const KQ_PRODUCER_RETRO_BATCH_SIZE = 50;

export type KqProducerRetroPreview = {
  live: boolean;
  processed: number;
  eligibleReviews: number;
  pendingFlowerBoosters: number;
  pendingHeritages: number;
  pendingCompletions: number;
  pendingCashCents: number;
  alreadyComplete: number;
  nextCursor: number | null;
};

export async function previewKqProducerNotebookRewardBatch(offset = 0): Promise<KqProducerRetroPreview> {
  const cursor = Number.isSafeInteger(offset) && offset >= 0 ? offset : 0;
  const client = createSupabaseServiceClient();
  const reviewsResult = await client.from("contest_reviews").select("id,customer_id,entry_id,created_at")
    .eq("status", "approved").order("created_at", { ascending: true }).order("id", { ascending: true })
    .range(cursor, cursor + KQ_PRODUCER_RETRO_BATCH_SIZE - 1);
  if (reviewsResult.error) throw new Error(`[data:producer-reward-retro-preview] ${reviewsResult.error.message}`);
  const reviews = reviewsResult.data ?? [];
  const preview: KqProducerRetroPreview = {
    live: KQ_PRODUCER_NOTEBOOK_REWARDS_LIVE, processed: reviews.length, eligibleReviews: 0,
    pendingFlowerBoosters: 0, pendingHeritages: 0, pendingCompletions: 0, pendingCashCents: 0, alreadyComplete: 0,
    nextCursor: reviews.length === KQ_PRODUCER_RETRO_BATCH_SIZE ? cursor + reviews.length : null,
  };
  if (!reviews.length) return preview;
  const entryIds = [...new Set(reviews.map((row) => String(row.entry_id)))];
  const userIds = [...new Set(reviews.map((row) => String(row.customer_id)))];
  const [entriesResult, campaignsResult, requirementsResult, definitionsResult, grantsResult, states] = await Promise.all([
    client.from("contest_entries").select("id,producer_id,product_id").in("id", entryIds),
    client.from("kq_producer_reward_campaigns").select("id,producer_id,heritage_code").eq("status", "active"),
    client.from("kq_producer_reward_entries").select("campaign_id,entry_id").in("entry_id", entryIds),
    client.from("kq_heritage_card_definitions").select("code,is_active"),
    client.from("kq_producer_heritage_reward_grants").select("user_id,campaign_id").in("user_id", userIds),
    Promise.all(userIds.map(async (userId) => [userId, await loadProducerStates(client, userId)] as const)),
  ]);
  for (const result of [entriesResult, campaignsResult, requirementsResult, definitionsResult, grantsResult]) {
    if (result.error) throw new Error(`[data:producer-retro] ${result.error.message}`);
  }
  const statesByUser = new Map(states);
  const entries = new Map((entriesResult.data ?? []).map((row) => [String(row.id), row]));
  const activeCodes = new Set((definitionsResult.data ?? []).filter((row) => row.is_active).map((row) => String(row.code)));
  const campaigns = new Map((campaignsResult.data ?? []).filter((row) => activeCodes.has(String(row.heritage_code)))
    .map((row) => [String(row.id), row]));
  const heritageKeys = new Set((grantsResult.data ?? []).map((row) => `${row.user_id}:${row.campaign_id}`));
  const completionKeys = new Set<string>();
  for (const review of reviews) {
    const entry = entries.get(String(review.entry_id));
    if (!entry?.producer_id) continue;
    const userId = String(review.customer_id);
    const producerId = String(entry.producer_id);
    const key = `${userId}:${producerId}`;
    const state = statesByUser.get(userId)?.find((item) => item.producerId === producerId);
    const requirement = (requirementsResult.data ?? []).find((item) => String(item.entry_id) === String(review.entry_id)
      && String(campaigns.get(String(item.campaign_id))?.producer_id ?? "") === producerId);
    const heritageKey = requirement ? userId + ":" + requirement.campaign_id : null;
    const complete = Boolean(state?.qualifyingProductIds.length
      && state.qualifyingProductIds.every((id) => state.reviewedProductIds.includes(id)));
    const completionEligible = complete;
    if (!heritageKey && !completionEligible) continue;
    preview.eligibleReviews += 1;
    let pending = false;
    if (heritageKey && !heritageKeys.has(heritageKey)) {
      heritageKeys.add(heritageKey);
      preview.pendingHeritages += 1;
      pending = true;
    }
    if (completionEligible && !state?.completionGranted && !completionKeys.has(key)) {
      completionKeys.add(key);
      preview.pendingCompletions += 1;
      preview.pendingCashCents += KQ_PRODUCER_COMPLETION_CASH_CENTS;
      pending = true;
    }
    if (!pending) preview.alreadyComplete += 1;
  }
  return preview;
}

export async function syncKqProducerNotebookRewardBatch(offset = 0) {
  if (!KQ_PRODUCER_NOTEBOOK_REWARDS_LIVE) {
    return { live: false, processed: 0, flowerBoostersGranted: 0, heritagesGranted: 0,
      completionsGranted: 0, cashCents: 0, nextCursor: null as number | null };
  }
  const cursor = Number.isSafeInteger(offset) && offset >= 0 ? offset : 0;
  const result = await createSupabaseServiceClient().from("contest_reviews").select("id,customer_id,created_at")
    .eq("status", "approved").order("created_at", { ascending: true }).order("id", { ascending: true })
    .range(cursor, cursor + KQ_PRODUCER_RETRO_BATCH_SIZE - 1);
  if (result.error) throw new Error(`[data:producer-reward-retro] ${result.error.message}`);
  let heritagesGranted = 0;
  let completionsGranted = 0;
  let cashCents = 0;
  const reviews = result.data ?? [];
  for (const review of reviews) {
    const receipt = await syncKqProducerNotebookRewardsForReview({ customerId: String(review.customer_id), reviewId: String(review.id) });
    heritagesGranted += receipt.heritageGranted;
    completionsGranted += receipt.completionGranted;
    cashCents += receipt.cashCents;
  }
  return { live: true, processed: reviews.length, flowerBoostersGranted: 0, heritagesGranted, completionsGranted, cashCents,
    nextCursor: reviews.length === KQ_PRODUCER_RETRO_BATCH_SIZE ? cursor + reviews.length : null };
}
