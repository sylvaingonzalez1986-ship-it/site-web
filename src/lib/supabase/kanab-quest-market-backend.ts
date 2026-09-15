import "server-only";
import { getKqMarketWindow, KQ_PRICE_POLICIES, type KqMarketContext, type KqPricePolicy } from "@/lib/kanab-quest-market-demand";
import { getKqEnergySummary } from "./kanab-quest-energy-backend";

import {
  buildKqEquipmentGoalReceipt,
  getKqEquipmentProgressionStatus,
  summarizeKqEquipmentLoadout,
  type KqEquipmentGoalReceipt,
} from "@/lib/kanab-quest-equipment";
import {
  calculateKqHarvestGrams,
  getKqJuryScoreFromRounds,
  getKqJuryScoreFromStats,
  getKqMarketQualityBand,
  getKqNextRouteMasteryGoal,
  isKqMarketRouteCode,
  quoteKqMarketRoutes,
  type KqMarketQuote,
  type KqMarketRouteCode,
} from "@/lib/kanab-quest-market";
import { encodeKqSave, parseKqGameSave } from "@/lib/kanab-quest-persistence";
import { getKqCultureSystemSummary } from "@/lib/kanab-quest-game";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import { getKqEquipmentShopSnapshot } from "@/lib/supabase/kanab-quest-equipment-backend";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertUuid(value: string, message: string) {
  if (!UUID_PATTERN.test(value)) throw new Error(message);
}

type MarketRound = { playerScore: number; opponentScore: number };

export type KqMarketRpcSaleReceipt = {
  receiptId: string;
  flowerId: string;
  route: KqMarketRouteCode;
  payoutCents: number;
  electricityPaidCents?: number;
  netPayoutCents?: number;
  reputationGain: number;
  cashAfterCents: number;
  reputationAfter: number;
  routeMastery?: {
    matchedPlan: boolean;
    firstMastery: boolean;
    routeSales: number;
    expertiseBonusReputation?: number;
    masteredAt: string;
    masteredRoutes: KqMarketRouteCode[];
  } | null;
  replayed: boolean;
};

export function mapKqMarketSaleReceipt(
  receipt: KqMarketRpcSaleReceipt,
  ownedCodes: string[],
) {
  const routeMastery = receipt.routeMastery ? {
    matchedPlan: receipt.routeMastery.matchedPlan === true,
    firstMastery: receipt.routeMastery.firstMastery === true,
    routeSales: Math.max(1, Number(receipt.routeMastery.routeSales ?? 1)),
    expertiseBonusReputation: Math.max(0, Math.trunc(Number(receipt.routeMastery.expertiseBonusReputation ?? 0))),
    masteredAt: String(receipt.routeMastery.masteredAt ?? ""),
    masteredRoutes: (receipt.routeMastery.masteredRoutes ?? []).filter(isKqMarketRouteCode),
  } : null;
  return {
    ...receipt,
    routeMastery,
    nextRouteGoal: routeMastery?.matchedPlan ? getKqNextRouteMasteryGoal({
      completedRoute: receipt.route,
      masteredRoutes: routeMastery.masteredRoutes,
      ownedCodes,
    }) : null,
    nextEquipmentGoal: buildKqEquipmentGoalReceipt({
      ownedCodes,
      cashCents: Number(receipt.cashAfterCents),
    }) satisfies KqEquipmentGoalReceipt | null,
    equipmentProgression: getKqEquipmentProgressionStatus(ownedCodes),
  };
}

export type KqMarketLot = {
  flowerId: string;
  varietyCode: string;
  varietyName: string;
  cultureSystemCode: string | null;
  cultureSystemName: string | null;
  cultureSystemTechnique: string | null;
  quality: number;
  harvestGrams: number;
  juryScore: number;
  qualityBand: "biomass" | "standard" | "selection" | "premium" | "signature";
  equipmentCodes: string[];
  options: KqMarketQuote[];
  status: "ready" | "sold";
  selectedRoute: KqMarketRouteCode | null;
  payoutCents: number | null;
  electricityPaidCents: number;
  netPayoutCents: number | null;
  reputationGain: number | null;
  burnedAt: string;
  settledAt: string | null;
};

function toRounds(value: unknown): MarketRound[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const row = entry as Record<string, unknown>;
    const playerScore = Number(row.playerScore);
    const opponentScore = Number(row.opponentScore);
    return Number.isFinite(playerScore) && Number.isFinite(opponentScore)
      ? [{ playerScore, opponentScore }]
      : [];
  });
}

export function getKqMarketRunSummary(runState: unknown, quality: number) {
  const state = parseKqGameSave(encodeKqSave(runState));
  const cultureSystem = state ? getKqCultureSystemSummary(state.deckCodes) : null;
  const harvestGrams = !state
    ? calculateKqHarvestGrams({ quality, successfulStages: 3, quantityPercent: 0 })
    : typeof state.harvestGrams === "number"
      ? state.harvestGrams
      : calculateKqHarvestGrams({
          quality,
          successfulStages: state.history.filter((entry) => entry.outcome === "success" || entry.outcome === "critical").length,
          quantityPercent: state.equipment?.quantityPercent ?? 0,
        });
  return {
    harvestGrams,
    cultureSystemCode: cultureSystem?.code ?? null,
    cultureSystemName: cultureSystem?.name ?? null,
    cultureSystemTechnique: cultureSystem?.technique ?? null,
  };
}

type StoredMarketLot = {
  flower_id: string; harvest_grams: number; jury_score: number; quality_band: string;
  equipment_codes: string[]; options?: KqMarketQuote[]; status: string;
  selected_route: string | null; payout_cents: number | null; reputation_gain: number | null; settled_at: string | null;
};

export async function getKqMarketSnapshot(userId: string, onlyFlowerIds?: string[], options: { previewOnly?: boolean } = {}) {
  assertUuid(userId, "Compte marché invalide.");
  const supabase = createSupabaseServiceClient();
  const equipmentShop = await getKqEquipmentShopSnapshot(userId);
  const pulse = await supabase.rpc("rpc_kq_market_pulse", { p_user_id: userId });
  if (pulse.error) throw new Error(`[supabase:rpc_kq_market_pulse] ${pulse.error.message}`);
  const marketContext: KqMarketContext = {
    reputation: equipmentShop.reputation,
    routeSales: Object.fromEntries(equipmentShop.routeMasteries.map((entry) => [entry.route, entry.saleCount])),
    recentSales: pulse.data?.recentSales ?? {},
    marketVolumes: pulse.data?.marketVolumes ?? {},
    window: getKqMarketWindow(),
  };
  const flowersQuery = supabase.from("kq_flowers")
    .select("id,run_id,variety_code,variety_name,quality,battle_stats,burned_at")
    .eq("owner_id", userId)
    .eq("status", "burned")
    .order("burned_at", { ascending: false });
  const flowersResult = await (onlyFlowerIds ? flowersQuery.in("id", onlyFlowerIds) : flowersQuery.limit(40));
  if (flowersResult.error) throw new Error(`[supabase:kq_flowers:market] ${flowersResult.error.message}`);
  const flowers = flowersResult.data ?? [];
  const flowerIds = flowers.map((flower) => String(flower.id));
  const runIds = flowers.map((flower) => String(flower.run_id));

  const emptyRows = { data: [], error: null };
  const [runsResult, humanOneResult, humanTwoResult, botResult] = flowerIds.length > 0 ? await Promise.all([
    supabase.from("kq_runs").select("id,state").in("id", runIds),
    supabase.from("kq_battles").select("flower_one_id,flower_two_id,rounds,verdict_at").eq("status", "verdict").in("flower_one_id", flowerIds),
    supabase.from("kq_battles").select("flower_one_id,flower_two_id,rounds,verdict_at").eq("status", "verdict").in("flower_two_id", flowerIds),
    supabase.from("kq_bot_battles").select("flower_id,rounds,verdict_at").in("flower_id", flowerIds),
  ]) : [emptyRows, emptyRows, emptyRows, emptyRows];
  for (const result of [runsResult, humanOneResult, humanTwoResult, botResult]) {
    if (result.error) throw new Error(`[supabase:kq_market_source] ${result.error.message}`);
  }

  const runStates = new Map((runsResult.data ?? []).map((run) => [String(run.id), run.state]));
  const humanOne = new Map((humanOneResult.data ?? []).map((battle) => [String(battle.flower_one_id), toRounds(battle.rounds)]));
  const humanTwo = new Map((humanTwoResult.data ?? []).map((battle) => [String(battle.flower_two_id), toRounds(battle.rounds)]));
  const bots = new Map((botResult.data ?? []).map((battle) => [String(battle.flower_id), toRounds(battle.rounds)]));
  const equippedCodes = equipmentShop.equippedCodes;
  const energySummary = await getKqEnergySummary(userId);
  const previews = new Map<string, { harvest_grams: number; jury_score: number; quality_band: string; options: KqMarketQuote[] }>();

  await Promise.all(flowers.map(async (flower) => {
    const flowerId = String(flower.id);
    const oneRounds = humanOne.get(flowerId);
    const twoRounds = humanTwo.get(flowerId);
    const botRounds = bots.get(flowerId);
    const juryScore = oneRounds?.length
      ? getKqJuryScoreFromRounds(oneRounds, "player")
      : twoRounds?.length
        ? getKqJuryScoreFromRounds(twoRounds, "opponent")
        : botRounds?.length
          ? getKqJuryScoreFromRounds(botRounds, "player")
          : getKqJuryScoreFromStats(flower.battle_stats && typeof flower.battle_stats === "object" ? flower.battle_stats as Record<string, number> : {});
    const { harvestGrams } = getKqMarketRunSummary(runStates.get(String(flower.run_id)), Number(flower.quality));
    const quotes = quoteKqMarketRoutes({ juryScore, harvestGrams, equipmentCodes: equipmentShop.operationalCodes ?? equippedCodes, equipmentLevels: equipmentShop.levels, marketContext });
    if (equippedCodes.some(code => equipmentShop.maintenance?.[code]?.due)) {
      const installedQuotes = quoteKqMarketRoutes({ juryScore, harvestGrams, equipmentCodes: equippedCodes, equipmentLevels: equipmentShop.levels, marketContext });
      for (const quote of quotes) if (!quote.available && installedQuotes.find(item => item.route === quote.route)?.available) {
        quote.blockedReason = "Une machine de cette filière doit être réparée. Ouvre ton entrepôt.";
      }
    }
    previews.set(flowerId, { harvest_grams: harvestGrams, jury_score: juryScore, quality_band: getKqMarketQualityBand(juryScore), options: quotes });
    // Browsing computes offers without rewriting and downloading each full SQL lot.
    // The prepare/sell commands still persist a fresh server quote before settlement.
    if (options.previewOnly) return;
    const prepared = await supabase.rpc("rpc_kq_prepare_market_lot", {
      p_user_id: userId,
      p_flower_id: flowerId,
      p_harvest_grams: harvestGrams,
      p_jury_score: juryScore,
      p_quality_band: getKqMarketQualityBand(juryScore),
      p_equipment_codes: equippedCodes,
      p_options: quotes,
    });
    if (prepared.error) throw new Error(`[supabase:rpc_kq_prepare_market_lot] ${prepared.error.message}`);
  }));

  const [lotsResult, betterRankedResult, receiptsResult] = await Promise.all([
    flowerIds.length > 0
      ? supabase.from("kq_market_lots")
        .select(options.previewOnly
          ? "flower_id,harvest_grams,jury_score,quality_band,equipment_codes,status,selected_route,payout_cents,reputation_gain,settled_at"
          : "flower_id,harvest_grams,jury_score,quality_band,equipment_codes,options,status,selected_route,payout_cents,reputation_gain,settled_at")
        .eq("owner_id", userId).in("flower_id", flowerIds).returns<StoredMarketLot[]>()
      : emptyRows,
    supabase.from("kq_equipment_wallets")
      .select("user_id", { count: "exact", head: true })
      .gt("reputation", equipmentShop.reputation),
    flowerIds.length > 0 ? supabase.from("kq_market_sale_receipts").select("flower_id,electricity_paid_cents").eq("owner_id", userId).in("flower_id", flowerIds) : emptyRows,
  ]);
  if (lotsResult.error) throw new Error(`[supabase:kq_market_lots] ${lotsResult.error.message}`);
  if (betterRankedResult.error) throw new Error(`[supabase:kq_equipment_wallets:rank] ${betterRankedResult.error.message}`);
  if (receiptsResult.error) throw new Error(`[supabase:kq_market_sale_receipts] ${receiptsResult.error.message}`);
  const paidEnergy = new Map<string, number>();
  for (const receipt of receiptsResult.data ?? []) paidEnergy.set(String(receipt.flower_id), (paidEnergy.get(String(receipt.flower_id)) ?? 0) + Number(receipt.electricity_paid_cents));
  const marketLots = new Map((lotsResult.data ?? []).map((lot) => [String(lot.flower_id), lot]));

  const lots: KqMarketLot[] = flowers.flatMap((flower) => {
    const lot = marketLots.get(String(flower.id)) ?? (options.previewOnly ? {
      ...previews.get(String(flower.id)), equipment_codes: equippedCodes,
      status: "ready", selected_route: null, payout_cents: null, reputation_gain: null, settled_at: null,
    } : null);
    if (!lot) return [];
    const route = lot.selected_route ? String(lot.selected_route) : null;
    const runSummary = getKqMarketRunSummary(runStates.get(String(flower.run_id)), Number(flower.quality));
    return [{
      flowerId: String(flower.id),
      varietyCode: String(flower.variety_code),
      varietyName: String(flower.variety_name),
      cultureSystemCode: runSummary.cultureSystemCode,
      cultureSystemName: runSummary.cultureSystemName,
      cultureSystemTechnique: runSummary.cultureSystemTechnique,
      quality: Number(flower.quality),
      harvestGrams: Number(lot.harvest_grams),
      juryScore: Number(lot.jury_score),
      qualityBand: String(lot.quality_band) as KqMarketLot["qualityBand"],
      equipmentCodes: options.previewOnly && lot.status === "ready"
        ? equippedCodes
        : Array.isArray(lot.equipment_codes) ? lot.equipment_codes.map(String) : [],
      options: options.previewOnly ? previews.get(String(flower.id))?.options ?? [] : Array.isArray(lot.options) ? lot.options as KqMarketQuote[] : [],
      status: String(lot.status) as KqMarketLot["status"],
      selectedRoute: route && isKqMarketRouteCode(route) ? route : null,
      payoutCents: lot.payout_cents === null ? null : Number(lot.payout_cents),
      electricityPaidCents: paidEnergy.get(String(flower.id)) ?? 0,
      netPayoutCents: lot.payout_cents === null ? null : Number(lot.payout_cents) - (paidEnergy.get(String(flower.id)) ?? 0),
      reputationGain: lot.reputation_gain === null ? null : Number(lot.reputation_gain),
      burnedAt: String(flower.burned_at),
      settledAt: lot.settled_at ? String(lot.settled_at) : null,
    }];
  }).sort((left, right) => Number(right.status === "ready") - Number(left.status === "ready") || right.burnedAt.localeCompare(left.burnedAt));

  return {
    cashCents: equipmentShop.cashCents,
    reputation: equipmentShop.reputation,
    reputationRank: Number(betterRankedResult.count ?? 0) + 1,
    ownedCodes: equipmentShop.ownedCodes,
    equippedCodes,
    routePlan: equipmentShop.routePlan,
    routeMasteries: equipmentShop.routeMasteries,
    equipmentSummary: summarizeKqEquipmentLoadout(equippedCodes, equipmentShop.levels),
    electricityOutstandingCents: energySummary.outstandingCents,
    lots,
  };
}

export async function sellKqMarketLot(input: {
  userId: string;
  flowerId: string;
  requestKey: string;
  route: string;
  pricePolicy: string;
  expectedPayoutCents: number;
  marketWindow: number;
}) {
  assertUuid(input.userId, "Compte marché invalide.");
  assertUuid(input.flowerId, "Lot invalide.");
  assertUuid(input.requestKey, "Demande de vente invalide.");
  if (!isKqMarketRouteCode(input.route)) throw new Error("Option de vente invalide.");
  if (!KQ_PRICE_POLICIES.includes(input.pricePolicy as KqPricePolicy)
    || !Number.isSafeInteger(input.expectedPayoutCents) || input.expectedPayoutCents < 0
    || !Number.isSafeInteger(input.marketWindow)) throw new Error("Offre de marché invalide. Actualise le comptoir.");
  // Refresh the server-authored quote immediately before settlement so a stale
  // browser cannot reuse equipment that is no longer installed.
  const marketSnapshot = await getKqMarketSnapshot(input.userId, [input.flowerId]);
  const result = await createSupabaseServiceClient().rpc("rpc_kq_sell_market_offer", {
    p_user_id: input.userId,
    p_flower_id: input.flowerId,
    p_request_key: input.requestKey,
    p_route: input.route,
    p_price_policy: input.pricePolicy,
    p_expected_payout: input.expectedPayoutCents,
    p_market_window: input.marketWindow,
  });
  if (result.error) {
    const message = result.error.message || "Vente impossible.";
    if (message.includes("market_offer_changed")) throw new Error("Les conditions ont changé. Actualise le comptoir pour examiner le nouveau prix.");
    if (message.includes("market_no_buyer")) throw new Error("Aucun acheteur à ce tarif. Choisis un prix inférieur ou conserve le lot.");
    if (message.includes("market_lot_unavailable")) throw new Error("Ce lot a déjà été vendu.");
    if (message.includes("market_reputation_quote_outdated")) throw new Error("Le barème de réputation a changé. Actualise le marché avant de vendre.");
    if (message.includes("market_route_unavailable")) throw new Error("Cette transformation n’est plus disponible.");
    throw new Error(`[supabase:rpc_kq_sell_market_lot] ${message}`);
  }
  return mapKqMarketSaleReceipt(
    result.data as KqMarketRpcSaleReceipt,
    marketSnapshot.ownedCodes,
  );
}
