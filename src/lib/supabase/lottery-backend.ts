﻿import "server-only";

import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import type {
  LotteryConfig,
  LotteryPrize,
  LotteryPrizeRarity,
  LotteryStats,
  LotteryTicketBenefit,
  LotteryTicket,
  ScratchResult,
} from "@/types/lottery";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_RARITIES: readonly LotteryPrizeRarity[] = ["common", "rare", "epic", "legendary"];

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

function toProbability(value: unknown, fallback = 0): number {
  return Number(toNumber(value, fallback).toFixed(6));
}

function toText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function toNullableText(value: unknown): string | undefined {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text : undefined;
}

function parsePercentFromText(...values: Array<string | undefined>): number | null {
  const merged = values
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(" ")
    .replace(",", ".");
  const match = merged.match(/(\d{1,3}(?:\.\d{1,2})?)\s*%/i);
  if (!match) {
    return null;
  }

  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 100) {
    return null;
  }

  return Number(parsed.toFixed(2));
}

function resolveLotteryTicketBenefit(input: {
  prizeName: string;
  prizeDescription: string;
}): LotteryTicketBenefit {
  const prizeName = toText(input.prizeName).trim();
  const prizeDescription = toText(input.prizeDescription).trim();
  const percent = parsePercentFromText(prizeName, prizeDescription);

  if (percent !== null) {
    return {
      rewardType: "discount",
      discountPercent: percent,
    };
  }

  const giftLabel = prizeName || prizeDescription || "Lot physique offert";
  return {
    rewardType: "gift",
    giftLabel,
  };
}

function parseRarity(value: unknown): LotteryPrizeRarity {
  const rarity = toText(value) as LotteryPrizeRarity;
  if (ALLOWED_RARITIES.includes(rarity)) {
    return rarity;
  }

  return "common";
}

function sanitizeName(value: unknown): string {
  const name = toText(value).trim().slice(0, 120);
  if (!name) {
    throw new Error("Nom du lot obligatoire.");
  }
  return name;
}

function sanitizeDescription(value: unknown): string {
  return toText(value).trim().slice(0, 1000);
}

function sanitizeImageUrl(value: unknown): string {
  return toText(value).trim().slice(0, 1024);
}

function sanitizeRarity(value: unknown): LotteryPrizeRarity {
  const rarity = toText(value).trim() as LotteryPrizeRarity;
  if (!ALLOWED_RARITIES.includes(rarity)) {
    throw new Error("Raret de lot invalide.");
  }
  return rarity;
}

function sanitizeProbability(value: unknown): number {
  const probability = Number(value);
  if (!Number.isFinite(probability)) {
    throw new Error("Probabilite invalide.");
  }

  const rounded = Number(probability.toFixed(6));
  if (rounded < 0 || rounded > 1) {
    throw new Error("La probabilite doit être comprise entre 0 et 1.");
  }

  return rounded;
}

function sanitizeValueEuros(value: unknown): number {
  const money = Number(value);
  if (!Number.isFinite(money) || money < 0) {
    throw new Error("Valeur du lot invalide.");
  }

  return Number(money.toFixed(2));
}

function sanitizeStock(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const stock = Number(value);
  if (!Number.isFinite(stock)) {
    throw new Error("Stock invalide.");
  }

  const rounded = Math.floor(stock);
  if (rounded < 0) {
    throw new Error("Le stock ne peut pas être negatif.");
  }

  return rounded;
}

function mapConfigRow(row: Record<string, unknown> | null): LotteryConfig {
  return {
    ticketThresholdEuros: toMoney(row?.ticket_threshold_euros, 20),
    isActive: row?.is_active === true,
    updatedAt: toText(row?.updated_at, new Date().toISOString()),
  };
}

function mapPrizeRow(row: Record<string, unknown>): LotteryPrize {
  return {
    id: toText(row.id),
    name: toText(row.name),
    description: toText(row.description),
    rarity: parseRarity(row.rarity),
    probability: toProbability(row.probability),
    imageUrl: toText(row.image_url),
    valueEuros: toMoney(row.value_euros),
    stock: row.stock === null || row.stock === undefined ? null : Math.max(0, Math.floor(toNumber(row.stock))),
    isActive: row.is_active === true,
    createdAt: toText(row.created_at, new Date().toISOString()),
    updatedAt: toText(row.updated_at, new Date().toISOString()),
  };
}

function mapTicketRow(row: Record<string, unknown>): LotteryTicket {
  const prizeRaw = row.lottery_prizes as Record<string, unknown> | null | undefined;

  return {
    id: toText(row.id),
    userId: toText(row.user_id),
    orderId: toNullableText(row.order_id),
    ticketNumber: toText(row.ticket_number),
    orderAmount: toMoney(row.order_amount),
    status: toText(row.status, "available") as LotteryTicket["status"],
    prizeId: toNullableText(row.prize_id),
    isWin: typeof row.is_win === "boolean" ? row.is_win : undefined,
    scratchedAt: toNullableText(row.scratched_at),
    redeemedAt: toNullableText(row.redeemed_at),
    redeemedOrderId: toNullableText(row.redeemed_order_id),
    createdAt: toText(row.created_at, new Date().toISOString()),
    prize: prizeRaw
      ? {
          id: toText(prizeRaw.id),
          name: toText(prizeRaw.name),
          description: toText(prizeRaw.description),
          rarity: parseRarity(prizeRaw.rarity),
          imageUrl: toText(prizeRaw.image_url),
          valueEuros: toMoney(prizeRaw.value_euros),
        }
      : undefined,
  };
}

async function ensureProbabilityBudget(input: {
  probability: number;
  isActive: boolean;
  excludePrizeId?: string;
}): Promise<void> {
  if (!input.isActive) {
    return;
  }

  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("lottery_prizes")
    .select("id,probability,is_active");

  failIfError(result.error, "list lottery_prizes for budget");

  const sumWithoutCurrent = (result.data ?? []).reduce((sum, rawRow) => {
    const row = rawRow as Record<string, unknown>;
    const id = toText(row.id);
    const isActive = row.is_active === true;

    if (!isActive) {
      return sum;
    }

    if (input.excludePrizeId && id === input.excludePrizeId) {
      return sum;
    }

    return sum + toProbability(row.probability);
  }, 0);

  const total = Number((sumWithoutCurrent + input.probability).toFixed(6));
  if (total > 1) {
    throw new Error("La somme des probabilites actives depasse 100%.");
  }
}

export async function getLotteryConfigFromSupabase(): Promise<LotteryConfig> {
  const supabase = createSupabaseServiceClient();

  const result = await supabase
    .from("lottery_config")
    .select("ticket_threshold_euros,is_active,updated_at")
    .eq("id", 1)
    .maybeSingle();

  failIfError(result.error, "read lottery_config");

  if (result.data) {
    return mapConfigRow(result.data as Record<string, unknown>);
  }

  const upsert = await supabase
    .from("lottery_config")
    .upsert({ id: 1, ticket_threshold_euros: 20, is_active: true }, { onConflict: "id" })
    .select("ticket_threshold_euros,is_active,updated_at")
    .single();

  failIfError(upsert.error, "upsert lottery_config default");
  return mapConfigRow(upsert.data as Record<string, unknown>);
}

export async function updateLotteryConfigInSupabase(input: {
  ticketThresholdEuros: number;
  isActive: boolean;
}): Promise<LotteryConfig> {
  const threshold = Number(input.ticketThresholdEuros);
  if (!Number.isFinite(threshold) || threshold <= 0) {
    throw new Error("Seuil ticket invalide.");
  }

  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("lottery_config")
    .upsert(
      {
        id: 1,
        ticket_threshold_euros: Number(threshold.toFixed(2)),
        is_active: input.isActive === true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    )
    .select("ticket_threshold_euros,is_active,updated_at")
    .single();

  failIfError(result.error, "upsert lottery_config");
  return mapConfigRow(result.data as Record<string, unknown>);
}

export async function listLotteryPrizesFromSupabase(): Promise<LotteryPrize[]> {
  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("lottery_prizes")
    .select("id,name,description,rarity,probability,image_url,value_euros,stock,is_active,created_at,updated_at")
    .order("created_at", { ascending: true });

  failIfError(result.error, "list lottery_prizes");

  return (result.data ?? []).map((rawRow) => mapPrizeRow(rawRow as Record<string, unknown>));
}

export async function createLotteryPrizeInSupabase(input: {
  name: string;
  description: string;
  rarity: LotteryPrizeRarity;
  probability: number;
  imageUrl: string;
  valueEuros: number;
  stock: number | null;
  isActive: boolean;
}): Promise<LotteryPrize> {
  const name = sanitizeName(input.name);
  const description = sanitizeDescription(input.description);
  const rarity = sanitizeRarity(input.rarity);
  const probability = sanitizeProbability(input.probability);
  const imageUrl = sanitizeImageUrl(input.imageUrl);
  const valueEuros = sanitizeValueEuros(input.valueEuros);
  const stock = sanitizeStock(input.stock);
  const isActive = input.isActive !== false;

  await ensureProbabilityBudget({
    probability,
    isActive,
  });

  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("lottery_prizes")
    .insert({
      name,
      description,
      rarity,
      probability,
      image_url: imageUrl,
      value_euros: valueEuros,
      stock,
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .select("id,name,description,rarity,probability,image_url,value_euros,stock,is_active,created_at,updated_at")
    .single();

  failIfError(result.error, "insert lottery_prize");
  return mapPrizeRow(result.data as Record<string, unknown>);
}

export async function updateLotteryPrizeInSupabase(
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
  const safePrizeId = prizeId.trim();
  if (!safePrizeId || !isValidUuid(safePrizeId)) {
    throw new Error("Lot invalide.");
  }

  const supabase = createSupabaseServiceClient();
  const existing = await supabase
    .from("lottery_prizes")
    .select("id,name,description,rarity,probability,image_url,value_euros,stock,is_active,created_at,updated_at")
    .eq("id", safePrizeId)
    .maybeSingle();

  failIfError(existing.error, "read lottery_prize before update");
  if (!existing.data) {
    return null;
  }

  const current = mapPrizeRow(existing.data as Record<string, unknown>);

  const next = {
    name: input.name === undefined ? current.name : sanitizeName(input.name),
    description:
      input.description === undefined
        ? current.description
        : sanitizeDescription(input.description),
    rarity: input.rarity === undefined ? current.rarity : sanitizeRarity(input.rarity),
    probability:
      input.probability === undefined
        ? current.probability
        : sanitizeProbability(input.probability),
    imageUrl: input.imageUrl === undefined ? current.imageUrl : sanitizeImageUrl(input.imageUrl),
    valueEuros:
      input.valueEuros === undefined ? current.valueEuros : sanitizeValueEuros(input.valueEuros),
    stock: input.stock === undefined ? current.stock : sanitizeStock(input.stock),
    isActive: input.isActive === undefined ? current.isActive : input.isActive === true,
  };

  await ensureProbabilityBudget({
    probability: next.probability,
    isActive: next.isActive,
    excludePrizeId: safePrizeId,
  });

  const result = await supabase
    .from("lottery_prizes")
    .update({
      name: next.name,
      description: next.description,
      rarity: next.rarity,
      probability: next.probability,
      image_url: next.imageUrl,
      value_euros: next.valueEuros,
      stock: next.stock,
      is_active: next.isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", safePrizeId)
    .select("id,name,description,rarity,probability,image_url,value_euros,stock,is_active,created_at,updated_at")
    .single();

  failIfError(result.error, "update lottery_prize");
  return mapPrizeRow(result.data as Record<string, unknown>);
}

export async function deleteLotteryPrizeInSupabase(prizeId: string): Promise<boolean> {
  const safePrizeId = prizeId.trim();
  if (!safePrizeId || !isValidUuid(safePrizeId)) {
    return false;
  }

  const supabase = createSupabaseServiceClient();

  const usage = await supabase
    .from("lottery_tickets")
    .select("id", { count: "exact", head: true })
    .eq("prize_id", safePrizeId);

  failIfError(usage.error, "count lottery_prize usage");

  if ((usage.count ?? 0) > 0) {
    throw new Error("Ce lot a déjà été attribué. Désactive-le au lieu de le supprimer.");
  }

  const result = await supabase
    .from("lottery_prizes")
    .delete()
    .eq("id", safePrizeId);

  failIfError(result.error, "delete lottery_prize");
  return true;
}

export async function mintLotteryTicketsForOrderInSupabase(input: {
  userId: string;
  orderId: string;
  orderAmount: number;
}): Promise<number> {
  const userId = input.userId.trim();
  const orderId = input.orderId.trim();
  const orderAmount = toMoney(input.orderAmount, 0);

  if (!isValidUuid(userId) || !orderId || orderAmount <= 0) {
    return 0;
  }

  const supabase = createSupabaseServiceClient();
  const result = await supabase.rpc("rpc_mint_lottery_tickets", {
    p_user_id: userId,
    p_order_id: orderId,
    p_order_amount: orderAmount,
  });

  failIfError(result.error, "rpc_mint_lottery_tickets");
  return Math.max(0, Math.floor(toNumber(result.data, 0)));
}

export async function grantLotteryTicketsToCustomerInSupabase(input: {
  userId: string;
  ticketCount: number;
  reason: string;
  adminEmail: string;
}): Promise<number> {
  const userId = input.userId.trim();
  const ticketCount = Math.floor(Number(input.ticketCount));
  const reason = toText(input.reason).trim().slice(0, 300);
  const adminEmail = toText(input.adminEmail).trim().slice(0, 200);

  if (!isValidUuid(userId)) {
    throw new Error("Client invalide.");
  }

  if (!Number.isFinite(ticketCount) || ticketCount < 1 || ticketCount > 200) {
    throw new Error("Nombre de tickets invalide (1-200).");
  }

  const supabase = createSupabaseServiceClient();
  const result = await supabase.rpc("rpc_admin_grant_lottery_tickets", {
    p_user_id: userId,
    p_ticket_count: ticketCount,
    p_reason: reason || null,
    p_admin_email: adminEmail || null,
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

  return Math.max(0, Math.floor(toNumber(result.data, 0)));
}

export async function getLotteryTicketsForCustomerFromSupabase(userId: string): Promise<LotteryTicket[]> {
  const safeUserId = userId.trim();
  if (!isValidUuid(safeUserId)) {
    return [];
  }

  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("lottery_tickets")
    .select(
      "id,user_id,order_id,ticket_number,order_amount,status,prize_id,is_win,scratched_at,redeemed_at,redeemed_order_id,created_at,lottery_prizes(id,name,description,rarity,image_url,value_euros)",
    )
    .eq("user_id", safeUserId)
    .order("created_at", { ascending: false });

  failIfError(result.error, "list lottery_tickets by user");

  return (result.data ?? []).map((rawRow) => mapTicketRow(rawRow as Record<string, unknown>));
}

export async function getRedeemableLotteryTicketBenefitFromSupabase(input: {
  userId: string;
  ticketId: string;
}): Promise<{
  ticketId: string;
  ticketNumber: string;
  prizeName: string;
  prizeDescription: string;
  benefit: LotteryTicketBenefit;
} | null> {
  const userId = input.userId.trim();
  const ticketId = input.ticketId.trim();
  if (!isValidUuid(userId) || !isValidUuid(ticketId)) {
    return null;
  }

  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("lottery_tickets")
    .select(
      "id,user_id,ticket_number,status,is_win,scratched_at,redeemed_at,lottery_prizes(name,description)",
    )
    .eq("id", ticketId)
    .eq("user_id", userId)
    .maybeSingle();

  failIfError(result.error, "read redeemable lottery_ticket");
  if (!result.data) {
    return null;
  }

  const row = result.data as Record<string, unknown>;
  const isWinning = row.is_win === true;
  const isScratched = toText(row.status) === "scratched";
  const redeemedAt = toNullableText(row.redeemed_at);
  const prizeRaw = row.lottery_prizes as Record<string, unknown> | null;
  const prizeName = toText(prizeRaw?.name).trim();
  const prizeDescription = toText(prizeRaw?.description).trim();

  if (!isWinning || !isScratched || redeemedAt || !prizeName) {
    return null;
  }

  return {
    ticketId: toText(row.id),
    ticketNumber: toText(row.ticket_number),
    prizeName,
    prizeDescription,
    benefit: resolveLotteryTicketBenefit({
      prizeName,
      prizeDescription,
    }),
  };
}

export async function redeemLotteryTicketForOrderInSupabase(input: {
  userId: string;
  ticketId: string;
  orderId: string;
  rewardLabel: string;
}): Promise<void> {
  const userId = input.userId.trim();
  const ticketId = input.ticketId.trim();
  const orderId = input.orderId.trim();
  const rewardLabel = toText(input.rewardLabel).trim().slice(0, 240);

  if (!isValidUuid(userId) || !isValidUuid(ticketId) || !orderId) {
    throw new Error("Payload ticket invalide.");
  }

  const supabase = createSupabaseServiceClient();
  const result = await supabase.rpc("rpc_redeem_lottery_ticket", {
    p_ticket_id: ticketId,
    p_user_id: userId,
    p_order_id: orderId,
    p_reward_label: rewardLabel || null,
  });

  if (result.error) {
    const message = result.error.message || "Consommation ticket impossible.";
    if (message.includes("ticket_already_redeemed")) {
      throw new Error("ticket_already_redeemed");
    }
    if (message.includes("ticket_not_winning_or_not_scratched")) {
      throw new Error("ticket_not_redeemable");
    }
    if (message.includes("ticket_not_found")) {
      throw new Error("ticket_not_found");
    }
    throw new Error(`[supabase:rpc_redeem_lottery_ticket] ${message}`);
  }
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

  const row = Array.isArray(result.data) ? result.data[0] : null;
  if (!row || typeof row !== "object") {
    throw new Error("Résultat de grattage introuvable.");
  }

  const ticketRow = row as Record<string, unknown>;
  const isWin = ticketRow.is_win === true;

  return {
    ticketId: toText(ticketRow.ticket_id),
    ticketNumber: toText(ticketRow.ticket_number),
    isWin,
    scratchedAt: toText(ticketRow.scratched_at, new Date().toISOString()),
    prize: isWin
      ? {
          id: toText(ticketRow.prize_id),
          name: toText(ticketRow.prize_name),
          description: toText(ticketRow.prize_description),
          rarity: parseRarity(ticketRow.prize_rarity),
          imageUrl: toText(ticketRow.prize_image_url),
          valueEuros: toMoney(ticketRow.prize_value_euros),
        }
      : undefined,
  };
}

export async function getLotteryStatsFromSupabase(): Promise<LotteryStats> {
  const supabase = createSupabaseServiceClient();

  const [
    totalResult,
    availableResult,
    scratchedResult,
    winsResult,
    winnersByPrizeResult,
    recentResult,
  ] = await Promise.all([
    supabase.from("lottery_tickets").select("id", { count: "exact", head: true }),
    supabase
      .from("lottery_tickets")
      .select("id", { count: "exact", head: true })
      .eq("status", "available"),
    supabase
      .from("lottery_tickets")
      .select("id", { count: "exact", head: true })
      .eq("status", "scratched"),
    supabase
      .from("lottery_tickets")
      .select("id", { count: "exact", head: true })
      .eq("is_win", true),
    supabase
      .from("lottery_tickets")
      .select("prize_id,lottery_prizes(name,rarity)")
      .eq("is_win", true)
      .not("prize_id", "is", null),
    supabase
      .from("lottery_tickets")
      .select("ticket_number,order_id,scratched_at,is_win,lottery_prizes(name,rarity)")
      .eq("status", "scratched")
      .order("scratched_at", { ascending: false })
      .limit(20),
  ]);

  failIfError(totalResult.error, "count lottery_tickets total");
  failIfError(availableResult.error, "count lottery_tickets available");
  failIfError(scratchedResult.error, "count lottery_tickets scratched");
  failIfError(winsResult.error, "count lottery_tickets wins");
  failIfError(winnersByPrizeResult.error, "list lottery winners by prize");
  failIfError(recentResult.error, "list lottery recent scratches");

  const totalTickets = totalResult.count ?? 0;
  const availableTickets = availableResult.count ?? 0;
  const scratchedTickets = scratchedResult.count ?? 0;
  const winningTickets = winsResult.count ?? 0;

  const byPrizeMap = new Map<string, { prizeId: string; prizeName: string; rarity: LotteryPrizeRarity; wins: number }>();
  const byRarityMap = new Map<LotteryPrizeRarity, number>();

  for (const rawRow of winnersByPrizeResult.data ?? []) {
    const row = rawRow as Record<string, unknown>;
    const prizeId = toText(row.prize_id);
    const prizeRaw = row.lottery_prizes as Record<string, unknown> | null;
    const prizeName = toText(prizeRaw?.name, "Lot");
    const rarity = parseRarity(prizeRaw?.rarity);

    if (!prizeId) {
      continue;
    }

    const existing = byPrizeMap.get(prizeId);
    if (existing) {
      existing.wins += 1;
    } else {
      byPrizeMap.set(prizeId, {
        prizeId,
        prizeName,
        rarity,
        wins: 1,
      });
    }

    byRarityMap.set(rarity, (byRarityMap.get(rarity) ?? 0) + 1);
  }

  const recentScratches = (recentResult.data ?? []).map((rawRow) => {
    const row = rawRow as Record<string, unknown>;
    const prizeRaw = row.lottery_prizes as Record<string, unknown> | null;

    return {
      ticketNumber: toText(row.ticket_number),
      orderId: toNullableText(row.order_id),
      scratchedAt: toText(row.scratched_at, new Date().toISOString()),
      isWin: row.is_win === true,
      prizeName: toNullableText(prizeRaw?.name),
      rarity: prizeRaw?.rarity ? parseRarity(prizeRaw.rarity) : undefined,
    };
  });

  return {
    totalTickets,
    availableTickets,
    scratchedTickets,
    winningTickets,
    winRate: scratchedTickets > 0 ? Number((winningTickets / scratchedTickets).toFixed(4)) : 0,
    byRarity: ALLOWED_RARITIES.map((rarity) => ({ rarity, wins: byRarityMap.get(rarity) ?? 0 })),
    byPrize: [...byPrizeMap.values()].sort((a, b) => b.wins - a.wins),
    recentScratches,
  };
}







