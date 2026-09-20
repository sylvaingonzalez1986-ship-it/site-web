import "server-only";
import type { ChanvrierStrength } from "@/lib/arena-chanvrier";
import { getKqMachineCondition, type KqMachineCondition } from "@/lib/kanab-quest-maintenance";
import { getKqCultureEquipmentCondition, getKqCultureOperationalCodes, type KqCultureEquipmentCondition } from "@/lib/kanab-quest-culture-wear";

import {
  getKqEquipmentDefinition,
  getKqEquipmentAtLevel,
  getKqEquipmentUpgradeCost,
  getKqEquipmentRequirementState,
  KQ_EQUIPMENT_CATALOG,
  KQ_RETIRED_EQUIPMENT_CODES,
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
  strength?: ChanvrierStrength | null;
  maintenance?: Record<string, KqMachineCondition>;
  cultureWear?: Record<string, KqCultureEquipmentCondition>;
  cultureOperationalCodes?: string[];
  operationalCodes?: string[];
  cashCents: number;
  reputation: number;
  ownedCodes: string[];
  purchasedCodes: string[];
  equippedCodes: string[];
  levels: Record<string, number>;
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
    supabase.from("kq_equipment_wallets").select("cash_cents,reputation,planned_route_code,planned_equipment_code,chanvrier:arena_chanvrier_profiles(strength)").eq("user_id", userId).single(),
    supabase.from("kq_player_equipment").select("equipment_code,purchase_price_cents,level,wear_cycles,maintenance_version,culture_wear_percent,culture_wear_version").eq("user_id", userId).order("acquired_at"),
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
  const availableOwned = (owned.data ?? []).filter((row) => !KQ_RETIRED_EQUIPMENT_CODES.includes(String(row.equipment_code)));
  const levels = Object.fromEntries(availableOwned.map((row) => [String(row.equipment_code), Number(row.level ?? 1)]));
  const profile = wallet.data.chanvrier as unknown as { strength: ChanvrierStrength } | null;
  const strength = profile?.strength ?? null;
  const maintenance = Object.fromEntries(availableOwned.flatMap(row => {
    const condition = getKqMachineCondition(String(row.equipment_code), Number(row.level ?? 1), Number(row.wear_cycles ?? 0), Number(row.maintenance_version ?? 0), strength);
    return condition ? [[String(row.equipment_code), condition]] : [];
  })) as Record<string, KqMachineCondition>;
  const equippedCodes = (loadout.data ?? []).map(row => String(row.equipment_code)).filter(code => !KQ_RETIRED_EQUIPMENT_CODES.includes(code));
  const cultureWear = Object.fromEntries(availableOwned.flatMap(row => {
    const condition = getKqCultureEquipmentCondition(String(row.equipment_code), Number(row.level ?? 1), Number(row.culture_wear_percent ?? 0), Number(row.culture_wear_version ?? 0));
    return condition ? [[String(row.equipment_code), condition]] : [];
  })) as Record<string, KqCultureEquipmentCondition>;
  const cultureOperationalCodes = getKqCultureOperationalCodes(equippedCodes, cultureWear);

  return {
    strength, maintenance, cultureWear, cultureOperationalCodes,
    operationalCodes: cultureOperationalCodes.filter(code => !maintenance[code]?.due),
    cashCents: Number(wallet.data.cash_cents ?? 0),
    levels,
    reputation: Number(wallet.data.reputation ?? 0),
    ownedCodes: availableOwned.map((row) => String(row.equipment_code)),
    purchasedCodes: availableOwned
      .filter((row) => Number(row.purchase_price_cents ?? 0) > 0)
      .map((row) => String(row.equipment_code)),
    equippedCodes,
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
    catalog: KQ_EQUIPMENT_CATALOG.filter((item) => item.purchasable).map((item) => getKqEquipmentAtLevel(item.code, levels[item.code])!),
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
  if (equipmentCodes.some((code) => !KQ_EQUIPMENT_CATALOG.some((item) => item.code === code && item.purchasable))) {
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

export async function upgradeKqDurableEquipment(input: {
  userId: string; requestKey: string; equipmentCode: string; expectedLevel: number;
}) {
  assertUuid(input.userId, "Compte équipement invalide.");
  assertUuid(input.requestKey, "Demande d’amélioration invalide.");
  if (getKqEquipmentUpgradeCost(input.equipmentCode, input.expectedLevel) === null) {
    throw new Error("Niveau maximal atteint ou équipement non améliorable.");
  }
  const result = await createSupabaseServiceClient().rpc("rpc_kq_upgrade_equipment", {
    p_user_id: input.userId, p_request_key: input.requestKey,
    p_equipment_code: input.equipmentCode, p_expected_level: input.expectedLevel,
  });
  if (result.error) {
    const message = result.error.message;
    if (message.includes("insufficient_equipment_cash")) throw new Error("Solde insuffisant pour cette amélioration.");
    if (message.includes("equipment_level_changed")) throw new Error("Le niveau a changé. Actualise le matériel avant de réessayer.");
    if (message.includes("equipment_not_purchased")) throw new Error("Achète d’abord cet équipement.");
    if (message.includes("equipment_max_level")) throw new Error("Niveau 10 déjà atteint.");
    if (message.includes("equipment_upgrade_request_mismatch")) throw new Error("Demande d’amélioration déjà utilisée.");
    throw new Error(`[supabase:rpc_kq_upgrade_equipment] ${message}`);
  }
  return result.data as { equipmentCode: string; level: number; priceCents: number; cashAfterCents: number; replayed: boolean };
}

export async function repairKqMachine(input: { userId: string; equipmentCode: string; requestKey: string; expectedVersion: number; expectedCostCents: number }) {
  assertUuid(input.userId, "Compte équipement invalide.");
  assertUuid(input.requestKey, "Demande de réparation invalide.");
  if (!getKqMachineCondition(input.equipmentCode, 1, 0) || !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0
    || !Number.isSafeInteger(input.expectedCostCents) || input.expectedCostCents < 0) throw new Error("Réparation invalide.");
  const result = await createSupabaseServiceClient().rpc("rpc_kq_repair_machine", {
    p_user_id: input.userId, p_equipment_code: input.equipmentCode, p_request_key: input.requestKey,
    p_expected_version: input.expectedVersion, p_expected_cost_cents: input.expectedCostCents,
  });
  if (result.error) {
    const messages: Record<string, string> = {
      machine_not_owned: "Cette machine ne t’appartient pas.", machine_unavailable: "Cette machine ne peut pas être réparée.",
      machine_not_due: "Cette machine fonctionne encore : aucune réparation nécessaire.", machine_condition_changed: "L’état ou le coût a changé. Actualise ton entrepôt.",
      machine_insufficient_cash: "Trésorerie insuffisante pour réparer. Tu peux continuer à vendre tes fleurs brutes.",
      machine_request_mismatch: "Cette demande a déjà servi à une autre réparation.",
    };
    for (const [code, message] of Object.entries(messages)) if (result.error.message.includes(code)) throw new Error(message);
    throw new Error(`[supabase:machine-repair] ${result.error.message}`);
  }
  return result.data;
}

export async function equipKqDurableEquipment(input: { userId: string; equipmentCode: string }) {
  assertUuid(input.userId, "Compte équipement invalide.");
  if (KQ_RETIRED_EQUIPMENT_CODES.includes(input.equipmentCode)) throw new Error("Cet équipement n’est plus disponible.");
  const equipment = getKqEquipmentDefinition(input.equipmentCode);
  if (!equipment) throw new Error("Équipement inconnu.");
  const supabase = createSupabaseServiceClient();
  const owned = await supabase.from("kq_player_equipment").select("equipment_code,purchase_price_cents,culture_wear_percent").eq("user_id", input.userId);
  if (owned.error) throw new Error(`[supabase:kq_player_equipment] ${owned.error.message}`);
  const ownedCodes = (owned.data ?? []).map((row) => String(row.equipment_code));
  const ownership = (owned.data ?? []).find((row) => String(row.equipment_code) === equipment.code);
  if (!ownership) throw new Error("Cet équipement ne t’appartient pas.");
  if (Number(ownership.culture_wear_percent ?? 0) >= 100 && getKqCultureEquipmentCondition(equipment.code)) {
    throw new Error("Cet équipement est en fin de vie. Remplace-le dans ton entrepôt.");
  }
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
    if (message.includes("culture_equipment_broken")) throw new Error("Cet équipement est en fin de vie. Remplace-le dans ton entrepôt.");
    throw new Error(`[supabase:rpc_kq_equip_durable] ${message}`);
  }
  return result.data as { equipmentCode: string; slot: string; equipped: boolean };
}

export async function replaceKqCultureEquipment(input: { userId: string; equipmentCode: string; requestKey: string; expectedVersion: number; expectedCostCents: number }) {
  assertUuid(input.userId, "Compte équipement invalide.");
  assertUuid(input.requestKey, "Demande de remplacement invalide.");
  if (!getKqCultureEquipmentCondition(input.equipmentCode) || !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0
    || !Number.isSafeInteger(input.expectedCostCents) || input.expectedCostCents <= 0 || input.expectedCostCents > 2147483647) {
    throw new Error("Remplacement invalide.");
  }
  const result = await createSupabaseServiceClient().rpc("rpc_kq_replace_culture_equipment", {
    p_user_id: input.userId, p_equipment_code: input.equipmentCode, p_request_key: input.requestKey,
    p_expected_version: input.expectedVersion, p_expected_cost_cents: input.expectedCostCents,
  });
  if (result.error) {
    const messages: Record<string, string> = {
      culture_equipment_not_owned: "Cet équipement ne t’appartient pas.",
      culture_equipment_unavailable: "Cet équipement ne peut pas être remplacé.",
      culture_equipment_not_due: "Cet équipement fonctionne encore : aucun remplacement nécessaire.",
      culture_equipment_condition_changed: "L’état ou le prix a changé. Actualise ton entrepôt.",
      culture_equipment_active_run: "Termine la culture en cours avant de remplacer le matériel.",
      culture_equipment_insufficient_cash: "Trésorerie insuffisante pour remplacer cet équipement. Le matériel de départ permet de continuer à cultiver.",
      culture_equipment_request_mismatch: "Cette demande a déjà servi à un autre remplacement. Actualise ton entrepôt.",
    };
    for (const [code, message] of Object.entries(messages)) if (result.error.message.includes(code)) throw new Error(message);
    throw new Error(`[supabase:culture-equipment-replacement] ${result.error.message}`);
  }
  return result.data as { equipmentCode: string; paidCents: number; cashAfterCents: number; level: number; version: number; replayed: boolean };
}
