import "server-only";

import {
  getKqEquipmentDefinition,
  getKqEquipmentRequirementState,
  KQ_EQUIPMENT_CATALOG,
} from "@/lib/kanab-quest-equipment";
import {
  isKqMarketRouteCode,
  KQ_MARKET_ROUTES,
  type KqMarketRouteCode,
} from "@/lib/kanab-quest-market";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertUuid(value: string, message: string) {
  if (!UUID_PATTERN.test(value)) throw new Error(message);
}

export type KqEquipmentShopSnapshot = {
  cashCents: number;
  reputation: number;
  ownedCodes: string[];
  purchasedCodes: string[];
  equippedCodes: string[];
  activeRun: boolean;
  readyLotCount: number;
  availableFlowerCount: number;
  routePlan: KqEquipmentRoutePlan | null;
  routeMasteries: KqRouteMasterySummary[];
  catalog: typeof KQ_EQUIPMENT_CATALOG;
};

export type KqEquipmentRoutePlan = {
  route: KqMarketRouteCode;
  equipmentCode: string;
};

export type KqRouteMasterySummary = {
  route: KqMarketRouteCode;
  saleCount: number;
  bestJuryScore: number;
  totalPayoutCents: number;
  totalReputation: number;
  masteredAt: string;
};

function parseKqEquipmentRoutePlan(wallet: {
  planned_route_code?: unknown;
  planned_equipment_code?: unknown;
} | null): KqEquipmentRoutePlan | null {
  const plannedRoute = String(wallet?.planned_route_code ?? "");
  const plannedEquipmentCode = String(wallet?.planned_equipment_code ?? "");
  const plannedEquipment = getKqEquipmentDefinition(plannedEquipmentCode);
  const plannedRouteDefinition = KQ_MARKET_ROUTES.find((route) => route.code === plannedRoute);
  return isKqMarketRouteCode(plannedRoute)
    && plannedEquipment
    && plannedRouteDefinition?.requiredUnlocks.some((unlock) => plannedEquipment.unlocks.includes(unlock))
    ? { route: plannedRoute, equipmentCode: plannedEquipmentCode }
    : null;
}

export async function getKqEquipmentRoutePlan(userId: string): Promise<KqEquipmentRoutePlan | null> {
  assertUuid(userId, "Compte équipement invalide.");
  const result = await createSupabaseServiceClient()
    .from("kq_equipment_wallets")
    .select("planned_route_code,planned_equipment_code")
    .eq("user_id", userId)
    .maybeSingle();
  if (result.error) throw new Error(`[supabase:kq_equipment_wallets:route-plan] ${result.error.message}`);
  return parseKqEquipmentRoutePlan(result.data);
}

export async function getKqEquipmentShopSnapshot(userId: string): Promise<KqEquipmentShopSnapshot> {
  assertUuid(userId, "Compte équipement invalide.");
  const supabase = createSupabaseServiceClient();
  const ensured = await supabase.rpc("rpc_kq_ensure_equipment_profile", { p_user_id: userId });
  if (ensured.error) throw new Error(`[supabase:rpc_kq_ensure_equipment_profile] ${ensured.error.message}`);

  const [wallet, owned, loadout, activeRuns, readyLots, availableFlowers, routeMasteries] = await Promise.all([
    supabase.from("kq_equipment_wallets").select("cash_cents,reputation,planned_route_code,planned_equipment_code").eq("user_id", userId).single(),
    supabase.from("kq_player_equipment").select("equipment_code,purchase_price_cents").eq("user_id", userId).order("acquired_at"),
    supabase.from("kq_equipment_loadouts").select("equipment_code").eq("user_id", userId).order("slot"),
    supabase.from("kq_runs").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "active"),
    supabase.from("kq_market_lots").select("flower_id", { count: "exact", head: true }).eq("owner_id", userId).eq("status", "ready"),
    supabase.from("kq_flowers").select("id", { count: "exact", head: true }).eq("owner_id", userId).eq("status", "available"),
    supabase.from("kq_player_route_masteries")
      .select("route,sale_count,best_jury_score,total_payout_cents,total_reputation,mastered_at")
      .eq("user_id", userId)
      .order("mastered_at", { ascending: false }),
  ]);
  if (wallet.error) throw new Error(`[supabase:kq_equipment_wallets] ${wallet.error.message}`);
  if (owned.error) throw new Error(`[supabase:kq_player_equipment] ${owned.error.message}`);
  if (loadout.error) throw new Error(`[supabase:kq_equipment_loadouts] ${loadout.error.message}`);
  if (activeRuns.error) throw new Error(`[supabase:kq_runs] ${activeRuns.error.message}`);
  if (readyLots.error) throw new Error(`[supabase:kq_market_lots] ${readyLots.error.message}`);
  if (availableFlowers.error) throw new Error(`[supabase:kq_flowers] ${availableFlowers.error.message}`);
  if (routeMasteries.error) throw new Error(`[supabase:kq_player_route_masteries] ${routeMasteries.error.message}`);
  const routePlan = parseKqEquipmentRoutePlan(wallet.data);

  return {
    cashCents: Number(wallet.data.cash_cents ?? 0),
    reputation: Number(wallet.data.reputation ?? 0),
    ownedCodes: (owned.data ?? []).map((row) => String(row.equipment_code)),
    purchasedCodes: (owned.data ?? [])
      .filter((row) => Number(row.purchase_price_cents ?? 0) > 0)
      .map((row) => String(row.equipment_code)),
    equippedCodes: (loadout.data ?? []).map((row) => String(row.equipment_code)),
    activeRun: Number(activeRuns.count ?? 0) > 0,
    readyLotCount: Number(readyLots.count ?? 0),
    availableFlowerCount: Number(availableFlowers.count ?? 0),
    routePlan,
    routeMasteries: (routeMasteries.data ?? []).flatMap((row) => {
      const route = String(row.route ?? "");
      if (!isKqMarketRouteCode(route)) return [];
      return [{
        route,
        saleCount: Math.max(0, Math.trunc(Number(row.sale_count ?? 0))),
        bestJuryScore: Math.max(0, Math.min(10, Number(row.best_jury_score ?? 0))),
        totalPayoutCents: Math.max(0, Math.trunc(Number(row.total_payout_cents ?? 0))),
        totalReputation: Math.trunc(Number(row.total_reputation ?? 0)),
        masteredAt: String(row.mastered_at ?? ""),
      }];
    }),
    catalog: KQ_EQUIPMENT_CATALOG,
  };
}

export async function setKqEquipmentRoutePlan(input: {
  userId: string;
  routePlan: KqEquipmentRoutePlan | null;
}) {
  assertUuid(input.userId, "Compte équipement invalide.");
  if (input.routePlan) {
    const route = KQ_MARKET_ROUTES.find((item) => item.code === input.routePlan?.route);
    const equipment = getKqEquipmentDefinition(input.routePlan.equipmentCode);
    if (!route || !equipment?.purchasable) throw new Error("Objectif de filière invalide.");
    if (!route.requiredUnlocks.some((unlock) => equipment.unlocks.includes(unlock))) {
      throw new Error("Cette machine ne contribue pas à la filière choisie.");
    }
  }
  const result = await createSupabaseServiceClient().rpc("rpc_kq_set_equipment_route_plan", {
    p_user_id: input.userId,
    p_route_code: input.routePlan?.route ?? null,
    p_equipment_code: input.routePlan?.equipmentCode ?? null,
  });
  if (result.error) throw new Error(`[supabase:rpc_kq_set_equipment_route_plan] ${result.error.message}`);
  return result.data as { route: KqMarketRouteCode | null; equipmentCode: string | null };
}

export async function purchaseKqDurableEquipment(input: {
  userId: string;
  requestKey: string;
  equipmentCodes: string[];
}) {
  assertUuid(input.userId, "Compte équipement invalide.");
  assertUuid(input.requestKey, "Demande d’achat invalide.");
  const equipmentCodes = [...new Set(input.equipmentCodes.map((code) => String(code).trim()))];
  if (equipmentCodes.length !== input.equipmentCodes.length || equipmentCodes.length < 1 || equipmentCodes.length > 8) {
    throw new Error("Panier d’équipement invalide.");
  }
  if (equipmentCodes.some((code) => !getKqEquipmentDefinition(code)?.purchasable)) {
    throw new Error("Un équipement du panier n’est pas disponible.");
  }

  const result = await createSupabaseServiceClient().rpc("rpc_kq_purchase_equipment", {
    p_user_id: input.userId,
    p_request_key: input.requestKey,
    p_equipment_codes: equipmentCodes,
  });
  if (result.error) {
    const message = result.error.message || "Achat d’équipement impossible.";
    if (message.includes("insufficient_equipment_cash")) throw new Error("Solde insuffisant.");
    if (message.includes("equipment_already_owned")) throw new Error("Tu possèdes déjà un équipement du panier.");
    if (message.includes("equipment_unavailable")) throw new Error("Un équipement du panier n’est plus disponible.");
    throw new Error(`[supabase:rpc_kq_purchase_equipment] ${message}`);
  }
  return result.data as {
    purchaseId: string;
    equipmentCodes: string[];
    totalPriceCents: number;
    cashAfterCents: number;
    replayed: boolean;
  };
}

export async function equipKqDurableEquipment(input: { userId: string; equipmentCode: string }) {
  assertUuid(input.userId, "Compte équipement invalide.");
  const equipment = getKqEquipmentDefinition(input.equipmentCode);
  if (!equipment) throw new Error("Équipement inconnu.");
  const supabase = createSupabaseServiceClient();
  const owned = await supabase.from("kq_player_equipment").select("equipment_code,purchase_price_cents").eq("user_id", input.userId);
  if (owned.error) throw new Error(`[supabase:kq_player_equipment] ${owned.error.message}`);
  const ownedCodes = (owned.data ?? []).map((row) => String(row.equipment_code));
  const ownership = (owned.data ?? []).find((row) => String(row.equipment_code) === equipment.code);
  if (!ownership) throw new Error("Cet équipement ne t’appartient pas.");
  if (equipment.purchasable && Number(ownership.purchase_price_cents ?? 0) <= 0) {
    throw new Error("Cet équipement doit être acheté avant de pouvoir être installé.");
  }
  if ((equipment.requirements ?? []).length > 0) {
    const requirementState = getKqEquipmentRequirementState({
      equipment,
      ownedCodes,
    });
    if (!requirementState.compatible) {
      throw new Error(`Installation bloquée · prérequis : ${requirementState.missing.map((requirement) => requirement.label).join(" ou ")}.`);
    }
  }
  const result = await supabase.rpc("rpc_kq_equip_durable", {
    p_user_id: input.userId,
    p_equipment_code: input.equipmentCode,
  });
  if (result.error) {
    const message = result.error.message || "Installation impossible.";
    if (message.includes("equipment_not_owned")) throw new Error("Cet équipement ne t’appartient pas.");
    if (message.includes("equipment_not_purchased")) throw new Error("Cet équipement doit être acheté avant de pouvoir être installé.");
    throw new Error(`[supabase:rpc_kq_equip_durable] ${message}`);
  }
  return result.data as { equipmentCode: string; slot: string; equipped: boolean };
}
