import "server-only";

import {
  buildKqProducerRewardProgress,
  KQ_PRODUCER_NOTEBOOK_REWARDS_LIVE,
  type KqProducerNotebookRewardReceipt,
  type KqProducerRewardProgress,
} from "@/lib/kanab-quest-producer-rewards";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";

const EMPTY_RECEIPT: KqProducerNotebookRewardReceipt = {
  live: false,
  flowerBoosterGranted: false,
  flowerBoostersGranted: 0,
  flowerBoostersTotal: 0,
  boosterCardCount: 0,
  heritageGranted: 0,
  heritageCodes: [],
};

export async function syncKqProducerNotebookRewardsForReview(input: {
  customerId: string;
  reviewId: string;
}): Promise<KqProducerNotebookRewardReceipt> {
  if (!KQ_PRODUCER_NOTEBOOK_REWARDS_LIVE) return EMPTY_RECEIPT;
  const customerId = input.customerId.trim();
  const reviewId = input.reviewId.trim();
  if (!/^[0-9a-f-]{36}$/i.test(customerId) || !/^[0-9a-f-]{36}$/i.test(reviewId)) {
    throw new Error("Récompense Carnet invalide.");
  }
  const client = createSupabaseServiceClient();
  const result = await client.rpc("rpc_kq_grant_producer_notebook_rewards", {
    p_user_id: customerId,
    p_review_id: reviewId,
  });
  if (result.error) throw new Error(`[data:producer-notebook-reward] ${result.error.message}`);
  const receipt = result.data && typeof result.data === "object" && !Array.isArray(result.data)
    ? result.data as Record<string, unknown>
    : {};
  return {
    live: true,
    flowerBoosterGranted: receipt.flowerBoosterGranted === true,
    flowerBoostersGranted: Number(receipt.flowerBoostersGranted ?? 0),
    flowerBoostersTotal: Number(receipt.flowerBoostersTotal ?? 0),
    boosterCardCount: Number(receipt.boosterCardCount ?? 0),
    heritageGranted: Number(receipt.heritageGranted ?? 0),
    heritageCodes: Array.isArray(receipt.heritageCodes)
      ? receipt.heritageCodes.map(String).filter(Boolean)
      : [],
  };
}

export async function getKqProducerRewardProgressForCustomer(
  customerId: string,
): Promise<KqProducerRewardProgress[]> {
  const safeCustomerId = customerId.trim();
  if (!/^[0-9a-f-]{36}$/i.test(safeCustomerId)) return [];
  const client = createSupabaseServiceClient();
  const campaignsResult = await client.from("kq_producer_reward_campaigns")
    .select("id,producer_id,heritage_code,version").eq("status", "active")
    .order("created_at", { ascending: true });
  if (campaignsResult.error) throw new Error(`[data:producer-campaigns] ${campaignsResult.error.message}`);
  const campaigns = campaignsResult.data ?? [];
  if (campaigns.length === 0) return [];

  const campaignIds = campaigns.map((row) => String(row.id));
  const producerIds = [...new Set(campaigns.map((row) => String(row.producer_id)))];
  const heritageCodes = [...new Set(campaigns.map((row) => String(row.heritage_code)))];
  const [requirementsResult, producersResult, definitionsResult, heritageGrantsResult] = await Promise.all([
    client.from("kq_producer_reward_entries").select("campaign_id,entry_id,position")
      .in("campaign_id", campaignIds).order("position", { ascending: true }),
    client.from("producers").select("id,name,image").in("id", producerIds),
    client.from("kq_heritage_card_definitions")
      .select("code,name,description,image_url").in("code", heritageCodes),
    client.from("kq_producer_heritage_reward_grants").select("campaign_id")
      .eq("user_id", safeCustomerId).in("campaign_id", campaignIds),
  ]);
  if (requirementsResult.error) throw new Error(`[data:producer-requirements] ${requirementsResult.error.message}`);
  if (producersResult.error) throw new Error(`[data:reward-producers] ${producersResult.error.message}`);
  if (definitionsResult.error) throw new Error(`[data:reward-heritages] ${definitionsResult.error.message}`);
  if (heritageGrantsResult.error) throw new Error(`[data:producer-heritage-grants] ${heritageGrantsResult.error.message}`);

  const requirements = requirementsResult.data ?? [];
  const entryIds = [...new Set(requirements.map((row) => String(row.entry_id)))];
  const [entriesResult, reviewsResult, flowerGrantsResult] = await Promise.all([
    entryIds.length
      ? client.from("contest_entries").select("id,title,track,is_published").in("id", entryIds)
      : Promise.resolve({ data: [], error: null }),
    entryIds.length
      ? client.from("contest_reviews").select("entry_id").eq("customer_id", safeCustomerId)
          .eq("status", "approved").in("entry_id", entryIds)
      : Promise.resolve({ data: [], error: null }),
    entryIds.length
      ? client.from("kq_notebook_flower_reward_grants").select("id,entry_id,entitlement_id")
          .eq("user_id", safeCustomerId).in("entry_id", entryIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (entriesResult.error) throw new Error(`[data:producer-reward-entries] ${entriesResult.error.message}`);
  if (reviewsResult.error) throw new Error(`[data:producer-reward-reviews] ${reviewsResult.error.message}`);
  if (flowerGrantsResult.error) throw new Error(`[data:flower-reward-grants] ${flowerGrantsResult.error.message}`);

  const flowerGrants = flowerGrantsResult.data ?? [];
  const flowerGrantIds = flowerGrants.map((row) => String(row.id));
  const flowerPacksResult = flowerGrantIds.length
    ? await client.from("kq_notebook_flower_reward_packs")
        .select("flower_grant_id,pack_index,entitlement_id")
        .in("flower_grant_id", flowerGrantIds).order("pack_index", { ascending: true })
    : { data: [], error: null };
  if (flowerPacksResult.error) throw new Error(`[data:flower-reward-packs] ${flowerPacksResult.error.message}`);

  const packRows = [...(flowerPacksResult.data ?? [])];
  for (const grant of flowerGrants) {
    if (!packRows.some((row) => String(row.flower_grant_id) === String(grant.id))) {
      packRows.push({
        flower_grant_id: String(grant.id),
        pack_index: 1,
        entitlement_id: String(grant.entitlement_id),
      });
    }
  }
  const entitlementIds = [...new Set(packRows.map((row) => String(row.entitlement_id)))];
  const entitlementsResult = entitlementIds.length
    ? await client.from("kq_support_booster_entitlements").select("id,status")
        .in("id", entitlementIds)
    : { data: [], error: null };
  if (entitlementsResult.error) throw new Error(`[data:flower-reward-entitlements] ${entitlementsResult.error.message}`);

  const producerById = new Map((producersResult.data ?? []).map((row) => [String(row.id), row]));
  const definitionByCode = new Map((definitionsResult.data ?? []).map((row) => [String(row.code), row]));
  const entryById = new Map((entriesResult.data ?? []).map((row) => [String(row.id), row]));
  const approvedEntryIds = (reviewsResult.data ?? []).map((row) => String(row.entry_id));
  const rewardedEntryIds = flowerGrants.map((row) => String(row.entry_id));
  const entitlementStatusById = new Map(
    (entitlementsResult.data ?? []).map((row) => [String(row.id), String(row.status)]),
  );
  const packProgressByEntryId = new Map<string, {
    grantedPacks: number;
    availablePacks: number;
    openedPacks: number;
    availableEntitlementIds: string[];
  }>();
  for (const grant of flowerGrants) {
    const rows = packRows.filter((row) => String(row.flower_grant_id) === String(grant.id));
    const availableEntitlementIds = rows
      .filter((row) => entitlementStatusById.get(String(row.entitlement_id)) === "available")
      .map((row) => String(row.entitlement_id));
    packProgressByEntryId.set(String(grant.entry_id), {
      grantedPacks: rows.length,
      availablePacks: availableEntitlementIds.length,
      openedPacks: rows.filter((row) => entitlementStatusById.get(String(row.entitlement_id)) === "opened").length,
      availableEntitlementIds,
    });
  }
  const grantedCampaignIds = new Set((heritageGrantsResult.data ?? []).map((row) => String(row.campaign_id)));

  return campaigns.flatMap((campaign) => {
    const campaignId = String(campaign.id);
    const producerId = String(campaign.producer_id);
    const heritageCode = String(campaign.heritage_code);
    const producer = producerById.get(producerId);
    const definition = definitionByCode.get(heritageCode);
    if (!producer || !definition) return [];
    const entries = requirements.filter((row) => String(row.campaign_id) === campaignId).flatMap((row) => {
      const entry = entryById.get(String(row.entry_id));
      if (!entry) return [];
      return [{
        entryId: String(entry.id),
        title: String(entry.title),
        track: entry.track === "concours" ? "concours" as const : "regular" as const,
      }];
    });
    return [buildKqProducerRewardProgress({
      campaignId,
      producerId,
      producerName: String(producer.name),
      producerImage: String(producer.image ?? ""),
      heritageCode,
      heritageName: String(definition.name),
      heritageDescription: String(definition.description),
      heritageImage: String(definition.image_url ?? ""),
      entries,
      approvedEntryIds,
      rewardedEntryIds,
      packProgressByEntryId,
      heritageGranted: grantedCampaignIds.has(campaignId),
    })];
  });
}

export async function claimKqProducerHeritageForCustomer(input: {
  customerId: string;
  campaignId: string;
  entryId: string;
}) {
  const customerId = input.customerId.trim();
  const campaignId = input.campaignId.trim();
  const entryId = input.entryId.trim();
  if (!/^[0-9a-f-]{36}$/i.test(customerId) || !/^[0-9a-f-]{36}$/i.test(campaignId)
    || entryId.length === 0 || entryId.length > 200) {
    throw new Error("Demande de déblocage invalide.");
  }
  const client = createSupabaseServiceClient();
  const result = await client.rpc("rpc_kq_claim_producer_heritage", {
    p_user_id: customerId,
    p_campaign_id: campaignId,
    p_entry_id: entryId,
  });
  if (result.error) {
    const message = result.error.message || "";
    if (message.includes("kq_producer_heritage_incomplete")) {
      throw new Error("Tous les avis requis doivent être validés avant le déblocage.");
    }
    if (message.includes("kq_producer_heritage_unavailable")) {
      throw new Error("Cette carte Héritage n’est pas disponible.");
    }
    throw new Error("Déblocage de la carte Héritage impossible.");
  }
  const receipt = result.data && typeof result.data === "object" && !Array.isArray(result.data)
    ? result.data as Record<string, unknown>
    : {};
  return {
    cardCode: String(receipt.cardCode ?? ""),
    alreadyGranted: receipt.alreadyGranted === true,
  };
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
  alreadyComplete: number;
  nextCursor: number | null;
};

function producerRewardKey(userId: string, value: string) {
  return `${userId}:${value}`;
}

export async function previewKqProducerNotebookRewardBatch(offset = 0): Promise<KqProducerRetroPreview> {
  const cursor = Number.isSafeInteger(offset) && offset >= 0 ? offset : 0;
  const client = createSupabaseServiceClient();
  const reviewsResult = await client.from("contest_reviews")
    .select("id,customer_id,entry_id,created_at").eq("status", "approved")
    .order("created_at", { ascending: true }).order("id", { ascending: true })
    .range(cursor, cursor + KQ_PRODUCER_RETRO_BATCH_SIZE - 1);
  if (reviewsResult.error) throw new Error(`[data:producer-reward-retro-preview] ${reviewsResult.error.message}`);
  const reviews = (reviewsResult.data ?? []).map((review) => ({
    id: String(review.id),
    customerId: String(review.customer_id),
    entryId: String(review.entry_id),
  }));
  if (reviews.length === 0) {
    return {
      live: KQ_PRODUCER_NOTEBOOK_REWARDS_LIVE,
      processed: 0,
      eligibleReviews: 0,
      pendingFlowerBoosters: 0,
      pendingHeritages: 0,
      alreadyComplete: 0,
      nextCursor: null,
    };
  }
  const entryIds = [...new Set(reviews.map((review) => review.entryId))];
  const userIds = [...new Set(reviews.map((review) => review.customerId))];
  const [entriesResult, campaignsResult, campaignEntriesResult, definitionsResult, flowerGrantsResult] = await Promise.all([
    client.from("contest_entries").select("id,producer_id,track").in("id", entryIds),
    client.from("kq_producer_reward_campaigns")
      .select("id,producer_id,heritage_code").eq("status", "active"),
    client.from("kq_producer_reward_entries").select("campaign_id,entry_id").in("entry_id", entryIds),
    client.from("kq_heritage_card_definitions").select("code,is_active"),
    client.from("kq_notebook_flower_reward_grants")
      .select("id,user_id,entry_id").in("user_id", userIds).in("entry_id", entryIds),
  ]);
  if (entriesResult.error) throw new Error(`[data:producer-reward-retro-entries] ${entriesResult.error.message}`);
  if (campaignsResult.error) throw new Error(`[data:producer-reward-retro-campaigns] ${campaignsResult.error.message}`);
  if (campaignEntriesResult.error) throw new Error(`[data:producer-reward-retro-requirements] ${campaignEntriesResult.error.message}`);
  if (definitionsResult.error) throw new Error(`[data:producer-reward-retro-heritages] ${definitionsResult.error.message}`);
  if (flowerGrantsResult.error) throw new Error(`[data:producer-reward-retro-flower-grants] ${flowerGrantsResult.error.message}`);

  const activeHeritageCodes = new Set((definitionsResult.data ?? [])
    .filter((definition) => definition.is_active === true)
    .map((definition) => String(definition.code)));
  const campaignById = new Map((campaignsResult.data ?? [])
    .filter((campaign) => activeHeritageCodes.has(String(campaign.heritage_code)))
    .map((campaign) => [String(campaign.id), campaign]));
  const campaignsByEntry = new Map<string, Array<{ id: string; producerId: string }>>();
  for (const requirement of campaignEntriesResult.data ?? []) {
    const campaign = campaignById.get(String(requirement.campaign_id));
    if (!campaign) continue;
    const entryId = String(requirement.entry_id);
    const rows = campaignsByEntry.get(entryId) ?? [];
    rows.push({ id: String(campaign.id), producerId: String(campaign.producer_id) });
    campaignsByEntry.set(entryId, rows);
  }
  const entryById = new Map((entriesResult.data ?? []).map((entry) => [String(entry.id), {
    producerId: String(entry.producer_id ?? ""),
    track: entry.track === "concours" ? "concours" : "regular",
  }]));
  const flowerGrantByKey = new Map((flowerGrantsResult.data ?? []).map((grant) => [
    producerRewardKey(String(grant.user_id), String(grant.entry_id)),
    String(grant.id),
  ]));
  const flowerGrantIds = [...flowerGrantByKey.values()];
  const packRowsResult = flowerGrantIds.length > 0
    ? await client.from("kq_notebook_flower_reward_packs")
        .select("flower_grant_id,pack_index").in("flower_grant_id", flowerGrantIds)
    : { data: [], error: null };
  if (packRowsResult.error) throw new Error(`[data:producer-reward-retro-packs] ${packRowsResult.error.message}`);
  const packCountByGrantId = (packRowsResult.data ?? []).reduce<Map<string, number>>((counts, pack) => {
    const grantId = String(pack.flower_grant_id);
    counts.set(grantId, (counts.get(grantId) ?? 0) + 1);
    return counts;
  }, new Map());
  const campaignIds = [...campaignById.keys()];
  const heritageGrantsResult = campaignIds.length > 0
    ? await client.from("kq_producer_heritage_reward_grants")
        .select("user_id,campaign_id").in("user_id", userIds).in("campaign_id", campaignIds)
    : { data: [], error: null };
  if (heritageGrantsResult.error) throw new Error(`[data:producer-reward-retro-heritage-grants] ${heritageGrantsResult.error.message}`);
  const heritageGrantKeys = new Set((heritageGrantsResult.data ?? []).map((grant) => producerRewardKey(
    String(grant.user_id),
    String(grant.campaign_id),
  )));
  const simulatedPackCounts = new Map<string, number>();
  for (const [key, grantId] of flowerGrantByKey) simulatedPackCounts.set(key, packCountByGrantId.get(grantId) ?? 0);

  let eligibleReviews = 0;
  let pendingFlowerBoosters = 0;
  let pendingHeritages = 0;
  let alreadyComplete = 0;
  for (const review of reviews) {
    const entry = entryById.get(review.entryId);
    if (!entry?.producerId) continue;
    const campaign = (campaignsByEntry.get(review.entryId) ?? [])
      .find((candidate) => candidate.producerId === entry.producerId);
    const flowerEligible = entry.track === "concours";
    if (!flowerEligible && !campaign) continue;
    eligibleReviews += 1;
    let newlyPlanned = 0;
    if (flowerEligible) {
      const key = producerRewardKey(review.customerId, review.entryId);
      const currentPacks = simulatedPackCounts.get(key) ?? 0;
      const missingPacks = Math.max(0, 5 - currentPacks);
      pendingFlowerBoosters += missingPacks;
      newlyPlanned += missingPacks;
      simulatedPackCounts.set(key, 5);
    }
    if (campaign) {
      const key = producerRewardKey(review.customerId, campaign.id);
      if (!heritageGrantKeys.has(key)) {
        pendingHeritages += 1;
        newlyPlanned += 1;
        heritageGrantKeys.add(key);
      }
    }
    if (newlyPlanned === 0) alreadyComplete += 1;
  }
  return {
    live: KQ_PRODUCER_NOTEBOOK_REWARDS_LIVE,
    processed: reviews.length,
    eligibleReviews,
    pendingFlowerBoosters,
    pendingHeritages,
    alreadyComplete,
    nextCursor: reviews.length === KQ_PRODUCER_RETRO_BATCH_SIZE ? cursor + reviews.length : null,
  };
}

export async function syncKqProducerNotebookRewardBatch(offset = 0) {
  if (!KQ_PRODUCER_NOTEBOOK_REWARDS_LIVE) {
    return { live: false, processed: 0, flowerBoostersGranted: 0, heritagesGranted: 0, nextCursor: null as number | null };
  }
  const cursor = Number.isSafeInteger(offset) && offset >= 0 ? offset : 0;
  const client = createSupabaseServiceClient();
  const reviewsResult = await client.from("contest_reviews")
    .select("id,customer_id,created_at").eq("status", "approved")
    .order("created_at", { ascending: true }).order("id", { ascending: true })
    .range(cursor, cursor + KQ_PRODUCER_RETRO_BATCH_SIZE - 1);
  if (reviewsResult.error) throw new Error(`[data:producer-reward-retro] ${reviewsResult.error.message}`);
  let flowerBoostersGranted = 0;
  let heritagesGranted = 0;
  const reviews = reviewsResult.data ?? [];
  for (const review of reviews) {
    const receipt = await syncKqProducerNotebookRewardsForReview({
      customerId: String(review.customer_id),
      reviewId: String(review.id),
    });
    flowerBoostersGranted += receipt.flowerBoostersGranted;
    heritagesGranted += receipt.heritageGranted;
  }
  return {
    live: true,
    processed: reviews.length,
    flowerBoostersGranted,
    heritagesGranted,
    nextCursor: reviews.length === KQ_PRODUCER_RETRO_BATCH_SIZE ? cursor + reviews.length : null,
  };
}
