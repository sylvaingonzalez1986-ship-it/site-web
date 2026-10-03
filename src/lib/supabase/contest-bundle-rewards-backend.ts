import "server-only";

import {
  CONTEST_BUNDLE_BOTTE_PACKS,
  CONTEST_BUNDLE_BUDDIES_PACKS,
  CONTEST_BUNDLE_MIN_GRAMS,
  type ContestBundleFlower,
  type ContestBundleProgress,
  type ContestBundleReceipt,
  type ContestBundleRewards,
} from "@/lib/contest-bundle-rewards";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const unavailable = () => new Error("Bonus fleurs concours indisponible.");
const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const nonempty = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const validDate = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));

function emptyRewards(): ContestBundleRewards {
  return { available: false, startsAt: null, minGrams: CONTEST_BUNDLE_MIN_GRAMS, buddiesPacks: CONTEST_BUNDLE_BUDDIES_PACKS, bottePacks: CONTEST_BUNDLE_BOTTE_PACKS, flowers: [], progress: null, receipts: [] };
}

function parseRewards(value: unknown, customerId: string | null): ContestBundleRewards {
  if (!record(value) || typeof value.available !== "boolean"
    || value.minGrams !== CONTEST_BUNDLE_MIN_GRAMS || value.buddiesPacks !== CONTEST_BUNDLE_BUDDIES_PACKS || value.bottePacks !== CONTEST_BUNDLE_BOTTE_PACKS
    || (value.startsAt !== null && !validDate(value.startsAt)) || (value.available && !validDate(value.startsAt))
    || !Array.isArray(value.flowers) || !Array.isArray(value.receipts)) throw unavailable();
  const productIds = new Set<string>();
  const flowers: ContestBundleFlower[] = value.flowers.map((flower: unknown) => {
    if (!record(flower) || !nonempty(flower.productId) || productIds.has(flower.productId) || !nonempty(flower.title)
      || typeof flower.unitWeightGrams !== "number" || !Number.isFinite(flower.unitWeightGrams) || flower.unitWeightGrams <= 0) throw unavailable();
    productIds.add(flower.productId);
    return { productId: flower.productId, title: flower.title, unitWeightGrams: flower.unitWeightGrams };
  });
  if (value.available && flowers.length === 0) throw unavailable();
  const orderIds = new Set<string>();
  const receipts: ContestBundleReceipt[] = value.receipts.map((receipt: unknown) => {
    if (!record(receipt) || !nonempty(receipt.orderId) || orderIds.has(receipt.orderId) || !validDate(receipt.grantedAt)
      || receipt.buddiesPacks !== CONTEST_BUNDLE_BUDDIES_PACKS || receipt.bottePacks !== CONTEST_BUNDLE_BOTTE_PACKS
      || !Array.isArray(receipt.requiredProductIds) || receipt.requiredProductIds.length === 0
      || receipt.requiredProductIds.some((id: unknown) => !nonempty(id))
      || new Set(receipt.requiredProductIds).size !== receipt.requiredProductIds.length
      || !record(receipt.card) || !nonempty(receipt.card.id) || !UUID.test(receipt.card.id)
      || !nonempty(receipt.card.code) || !nonempty(receipt.card.name) || typeof receipt.card.imageUrl !== "string" || receipt.card.rarity !== "epic") throw unavailable();
    orderIds.add(receipt.orderId);
    return {
      orderId: receipt.orderId, grantedAt: receipt.grantedAt,
      buddiesPacks: receipt.buddiesPacks, bottePacks: receipt.bottePacks,
      requiredProductIds: receipt.requiredProductIds as string[],
      card: { id: receipt.card.id, code: receipt.card.code, name: receipt.card.name, imageUrl: receipt.card.imageUrl, rarity: "epic" },
    };
  });
  let progress: ContestBundleProgress | null = null;
  if (customerId) {
    const raw = value.progress;
    if (!record(raw) || !Array.isArray(raw.flowers) || raw.flowers.length !== flowers.length
      || typeof raw.eligible !== "boolean" || typeof raw.rewarded !== "boolean"
      || raw.requiredCount !== flowers.length
      || (raw.rewarded ? !validDate(raw.grantedAt) : raw.grantedAt !== null)
      || raw.rewarded !== (receipts.length > 0)) throw unavailable();
    const seen = new Set<string>();
    const progressFlowers = raw.flowers.map((flower: unknown) => {
      if (!record(flower) || !nonempty(flower.productId) || !productIds.has(flower.productId) || seen.has(flower.productId)
        || typeof flower.purchasedGrams !== "number" || !Number.isFinite(flower.purchasedGrams) || flower.purchasedGrams < 0
        || flower.complete !== (flower.purchasedGrams >= CONTEST_BUNDLE_MIN_GRAMS)) throw unavailable();
      seen.add(flower.productId);
      return { productId: flower.productId, purchasedGrams: flower.purchasedGrams, complete: flower.complete as boolean };
    });
    const completedCount = progressFlowers.filter((flower) => flower.complete).length;
    if (raw.completedCount !== completedCount || raw.eligible !== (flowers.length > 0 && completedCount === flowers.length)) throw unavailable();
    progress = { flowers: progressFlowers, completedCount, requiredCount: flowers.length,
      eligible: raw.eligible, rewarded: raw.rewarded, grantedAt: raw.grantedAt as string | null };
  } else if (receipts.length > 0 || value.progress !== null) throw unavailable();
  return {
    available: value.available, startsAt: value.startsAt as string | null,
    minGrams: value.minGrams, buddiesPacks: value.buddiesPacks, bottePacks: value.bottePacks,
    flowers, progress, receipts,
  };
}

async function loadRewards(customerId: string | null, sync: boolean): Promise<ContestBundleRewards> {
  if ((customerId !== null && !UUID.test(customerId)) || (sync && !customerId)) throw unavailable();
  const result = await createSupabaseServiceClient().rpc(sync ? "rpc_kq_sync_contest_bundle_rewards" : "rpc_kq_get_contest_bundle_rewards", { p_user_id: customerId });
  if (result.error) {
    if (["PGRST202", "42883"].includes(result.error.code ?? "")) return emptyRewards();
    throw unavailable();
  }
  return parseRewards(result.data, customerId);
}

export const getContestBundleRewards = (customerId: string | null = null) => loadRewards(customerId, false);
export const syncContestBundleRewards = (customerId: string) => loadRewards(customerId, true);
