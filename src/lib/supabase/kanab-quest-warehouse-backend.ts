import "server-only";

import { KQ_WAREHOUSE_CATALOG } from "@/lib/kanab-quest-warehouse-catalog";
import {
  compactKqWarehouseToStarterFloor,
  createKqWarehouseStarter,
  getKqWarehouseQuote,
  getKqWarehouseRunSnapshot as deriveWarehouseRunSnapshot,
  isKqWarehouseState,
  type KqWarehouseRunSnapshot,
  type KqWarehouseState,
} from "@/lib/kanab-quest-warehouse";
import { createSupabaseServiceClient } from "./admin";
import { getKqWarehouseSalesForecast, type KqWarehouseSalesForecast } from "./kanab-quest-warehouse-flow-backend";
import { getKqEquipmentShopSnapshot, type KqEquipmentShopSnapshot } from "./kanab-quest-equipment-backend";
import { getKqWorkshopMachineSpecification } from "../kanab-quest-workshop-machines";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_INTEGER = 2_147_483_647;

export class KqWarehouseError extends Error {
  constructor(message: string, public readonly status: number = 400) { super(message); }
}

export type KqWarehouseReceipt = {
  requestKey: string;
  revision: number;
  investmentCents: number;
  creditUsedCents: number;
  chargedCents: number;
  replayed: boolean;
};

export type KqWarehouseActiveRun = {
  runId: string; zoneId: string | null; buddieCode: string; stageIndex: number; phase: string; startedAt: string;
  campaignId?: string; leaderRunId?: string;
};
export type KqWarehouseCompletedRun = {
  runId: string; zoneId: string; buddieCode: string; flowerId: string | null; completedAt: string;
  campaignId?: string; leaderRunId?: string;
  status?: string; stageIndex?: number; phase?: string; startedAt?: string;
};

export type KqWarehouseSnapshot = {
  state: KqWarehouseState;
  revision: number;
  cashCents: number;
  activeRun: boolean;
  activeRuns?: KqWarehouseActiveRun[];
  completedRuns?: KqWarehouseCompletedRun[];
  legacyActiveRun: boolean;
  migrationCreditCents: number;
  stockGrams: number;
  /** Potential harvests already reserved by all active cultures. */
  reservedHarvestGrams?: number;
  /** Occupied whole containers and unsold packets, at least the actual mass. */
  storageReservedGrams?: number;
  /** Installed floor capacity, or purchased legacy capacity before adoption. */
  storageCapacityGrams: number;
  salesGramsPerDay: number | null;
  salesForecast?: KqWarehouseSalesForecast;
  context: { available: boolean; salesAvailable: boolean };
  conversion?: { convertedAt: string; originalCreditCents: number; previousTentCount: number; note: string } | null;
  receipt?: KqWarehouseReceipt;
};

type StoredSnapshot = Omit<KqWarehouseSnapshot, "state"> & { state: KqWarehouseState | null };
type RpcResult = { data: unknown; error: { message: string } | null };

function assertUuid(value: unknown): asserts value is string {
  if (typeof value !== "string" || !UUID.test(value)) throw new KqWarehouseError("Identifiant d’entrepôt invalide.");
}

function databaseError(message: string): never {
  const failures: [string, string, number][] = [
    ["warehouse_zone_busy", "Cette zone accueille une culture. Termine-la avant de modifier son aménagement.", 409],
    ["kq_buddie_not_owned", "Choisis un Buddie présent dans ta collection.", 400],
    ["warehouse_zone_in_use", "Cette zone accueille une culture. Termine-la avant de modifier son aménagement.", 409],
    ["warehouse_buddie_not_owned", "Choisis un Buddie présent dans ta collection.", 400],
    ["warehouse_revision_changed", "Le plan a changé dans une autre fenêtre. Actualise l’entrepôt avant de confirmer.", 409],
    ["warehouse_floor_changed", "Les dimensions de l’entrepôt ont changé. Actualise le plan avant de confirmer.", 409],
    ["warehouse_floor_invalid", "Les zones doivent rester dans les limites de l’entrepôt, sans se chevaucher.", 400],
    ["warehouse_request_mismatch", "Cette demande a déjà servi à un autre aménagement.", 409],
    ["warehouse_active_run", "Termine la culture en cours avant de modifier l’entrepôt.", 409],
    ["warehouse_price_changed", "Le devis a changé. Vérifie le nouveau montant avant de confirmer.", 409],
    ["warehouse_insufficient_cash", "Trésorerie insuffisante pour cet aménagement.", 400],
    ["warehouse_inventory_loss", "Les appareils possédés doivent rester disponibles dans la réserve.", 400],
    ["warehouse_options_invalid", "Les modules de simulation ou leur réserve sont invalides.", 400],
    ["warehouse_options_missing", "Le devis doit financer les modules de chaque zone avant de lancer la culture.", 409],
    ["warehouse_invalid_request", "Demande d’aménagement invalide.", 400],
    ["warehouse_workshop_purchase", "Achète et améliore les machines dans l’atelier de transformation.", 400],
    ["warehouse_service_plan_required", "Place les zones de séchage et stockage sur le plan pour acheter leurs équipements. Une fois adoptées, ces zones doivent rester sur le plan.", 400],
    ["warehouse_service_layout_invalid", "Les zones doivent tenir dans l’entrepôt sans se chevaucher et utiliser un équipement adapté.", 400],
    ["warehouse_service_equipment_missing", "Le devis ne couvre pas le matériel nécessaire à ces zones. Actualise le plan.", 409],
    ["warehouse_service_capacity_in_use", "Cette modification retirerait une capacité déjà occupée ou réservée. Libère du stock ou agrandis une autre zone avant de confirmer.", 409],
    ["warehouse_legacy_equipment_archived", "L’ancien matériel est archivé. Utilise les trois pièces du nouvel entrepôt.", 409],
  ];
  const failure = failures.find(([code]) => message.includes(code));
  if (failure) throw new KqWarehouseError(failure[1], failure[2]);
  throw new Error(`[supabase:warehouse] ${message}`);
}

function storedSnapshot(result: RpcResult): StoredSnapshot {
  if (result.error) databaseError(result.error.message);
  const data = result.data as StoredSnapshot | null;
  if (!data || !Number.isSafeInteger(data.revision) || data.revision < 0
    || !Number.isSafeInteger(data.cashCents) || data.cashCents < 0
    || !Number.isSafeInteger(data.migrationCreditCents) || data.migrationCreditCents < 0
    || typeof data.activeRun !== "boolean" || typeof data.legacyActiveRun !== "boolean"
    || !Number.isFinite(data.stockGrams) || data.stockGrams < 0
    || (data.reservedHarvestGrams !== undefined && (!Number.isFinite(data.reservedHarvestGrams) || data.reservedHarvestGrams < 0))
    || (data.storageReservedGrams !== undefined && (!Number.isFinite(data.storageReservedGrams) || data.storageReservedGrams < data.stockGrams))
    || !Number.isFinite(data.storageCapacityGrams) || data.storageCapacityGrams < 0
    || (data.state !== null && !isKqWarehouseState(data.state))) {
    throw new Error("[supabase:warehouse] invalid_snapshot");
  }
  return data;
}

/** Rebuild known fields; client-supplied derived values and hidden extras never persist. */
function cleanState(value: unknown): KqWarehouseState {
  if (!isKqWarehouseState(value)) throw new KqWarehouseError("Le plan contient des zones ou des appareils invalides.");
  return {
    version: 1,
    ...(value.floor ? { floor: { ...value.floor } } : {}),
    zones: value.zones.map(zone => ({
      id: zone.id, name: zone.name, x: zone.x, y: zone.y, width: zone.width, height: zone.height,
      active: zone.active, lightingCode: zone.lightingCode, airCode: zone.airCode,
      ...(zone.buddieCode !== undefined ? { buddieCode: zone.buddieCode } : {}),
      ...(zone.optionCodes !== undefined ? { optionCodes: [...zone.optionCodes].sort() } : {}),
    })),
    ...(value.serviceZones !== undefined ? { serviceZones: value.serviceZones.map(zone => ({
      id: zone.id, name: zone.name, x: zone.x, y: zone.y, width: zone.width, height: zone.height,
      kind: zone.kind, deviceCode: zone.deviceCode,
    })) } : {}),
    equipment: value.equipment.map(item => ({ code: item.code, quantity: item.quantity })),
    ...(value.optionInventory !== undefined ? { optionInventory: value.optionInventory.map(item => ({ code: item.code, quantity: item.quantity })) } : {}),
    preparedAreaM2: value.preparedAreaM2,
  };
}

function publicSnapshot(data: StoredSnapshot): KqWarehouseSnapshot {
  return { ...data, state: data.state ?? createKqWarehouseStarter() };
}

async function salesForecast(userId: string): Promise<KqWarehouseSalesForecast | null> {
  try { return await getKqWarehouseSalesForecast(userId); }
  catch { return null; }
}

function withSales(snapshot: KqWarehouseSnapshot, forecast: KqWarehouseSalesForecast | null): KqWarehouseSnapshot {
  return { ...snapshot, salesGramsPerDay: forecast?.salesGramsPerDay ?? null,
    context: { ...snapshot.context, salesAvailable: forecast?.salesGramsPerDay != null },
    ...(forecast ? { salesForecast: forecast } : {}),
  };
}

async function readStoredSnapshot(userId: string): Promise<StoredSnapshot> {
  assertUuid(userId);
  return storedSnapshot(await createSupabaseServiceClient().rpc("rpc_kq_warehouse_snapshot", { p_user_id: userId }));
}

async function compactIdleWarehouse(userId: string, current: StoredSnapshot): Promise<StoredSnapshot> {
  if (!current.state || current.activeRun || current.legacyActiveRun || current.activeRuns?.length) return current;
  const next = compactKqWarehouseToStarterFloor(current.state);
  if (!next) return current;
  // The RPC repeats the active-run check under the same lock as save/start. A
  // concurrent edit or start simply returns the winning current state.
  const result = await createSupabaseServiceClient().rpc("rpc_kq_warehouse_compact", {
    p_user_id: userId, p_expected_revision: current.revision,
    p_previous_state: current.state, p_next_state: next,
  });
  // Rolling deployment: keep the valid legacy floor visible until the named
  // migration/RPC reaches the database. Other database failures must surface.
  if (result.error?.message.includes("rpc_kq_warehouse_compact")
    && /schema cache|does not exist|could not find/i.test(result.error.message)) return current;
  return storedSnapshot(result);
}

/** Conversion is free, archived and postponed while a historical culture is active. */
export async function getKqWarehouseSnapshot(userId: string): Promise<KqWarehouseSnapshot> {
  assertUuid(userId);
  let initial = await readStoredSnapshot(userId);
  if (!initial.state && !initial.activeRun) {
    // Install the physical storage rules before commerce can settle anything:
    // opening this screen must not trigger a historical automatic overflow sale.
    initial = storedSnapshot(await createSupabaseServiceClient().rpc("rpc_kq_warehouse_initialize", {
      p_user_id: userId, p_starter_state: createKqWarehouseStarter(),
    }));
  }
  await compactIdleWarehouse(userId, initial);
  const forecast = await salesForecast(userId);
  // Commerce may settle pending proceeds, even before an optional forecast fails.
  // Always return the wallet after that settlement and any conversion.
  return withSales(publicSnapshot(await readStoredSnapshot(userId)), forecast);
}

export async function saveKqWarehouseLayout(input: {
  userId: string;
  requestKey: string;
  expectedRevision: number;
  state: unknown;
  expectedCostCents: number;
}): Promise<KqWarehouseSnapshot> {
  assertUuid(input.userId);
  assertUuid(input.requestKey);
  if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 1 || input.expectedRevision >= MAX_INTEGER
    || !Number.isSafeInteger(input.expectedCostCents) || input.expectedCostCents < 0 || input.expectedCostCents > MAX_INTEGER) {
    throw new KqWarehouseError("Révision ou montant d’aménagement invalide.");
  }
  const candidate = cleanState(input.state);
  const forecast = await salesForecast(input.userId);
  const request = { state: candidate, expectedRevision: input.expectedRevision, expectedCostCents: input.expectedCostCents };
  const supabase = createSupabaseServiceClient();
  const replay = async (): Promise<KqWarehouseSnapshot | null> => {
    const result = await supabase.rpc("rpc_kq_warehouse_receipt", {
      p_user_id: input.userId, p_request_key: input.requestKey, p_request: request,
    });
    if (result.error) databaseError(result.error.message);
    return result.data ? withSales(publicSnapshot(storedSnapshot(result)), forecast) : null;
  };
  const receipt = await replay();
  if (receipt) return receipt;
  if (candidate.equipment.some(item => KQ_WAREHOUSE_CATALOG.find(device => device.code === item.code)?.kind === "processing")) {
    databaseError("warehouse_workshop_purchase");
  }
  const current = await readStoredSnapshot(input.userId);
  if (!current.state || current.revision !== input.expectedRevision) {
    const concurrentReceipt = await replay();
    if (concurrentReceipt) return concurrentReceipt;
    databaseError("warehouse_revision_changed");
  }
  if (!!current.state.floor !== !!candidate.floor) databaseError("warehouse_floor_changed");
  if (current.legacyActiveRun || (current.activeRun && !current.activeRuns?.length)) databaseError("warehouse_active_run");
  for (const run of current.activeRuns ?? []) {
    const before = current.state.zones.find(zone => zone.id === run.zoneId);
    const after = candidate.zones.find(zone => zone.id === run.zoneId);
    if (!run.zoneId || !before || !after || JSON.stringify(cleanState({ ...current.state, zones: [before] }).zones[0]) !== JSON.stringify(cleanState({ ...candidate, zones: [after] }).zones[0])) databaseError("warehouse_zone_in_use");
  }
  if (current.state.serviceZones !== undefined && candidate.serviceZones === undefined) databaseError("warehouse_service_plan_required");
  if (candidate.serviceZones === undefined && candidate.equipment.some(item => {
    const device = KQ_WAREHOUSE_CATALOG.find(entry => entry.code === item.code);
    return (device?.kind === "drying" || device?.kind === "storage")
      && item.quantity > (current.state!.equipment.find(owned => owned.code === item.code)?.quantity ?? 0);
  })) databaseError("warehouse_service_plan_required");
  // All prices, missing devices, reserve preservation and preparation costs are
  // recalculated here. Neither candidate.preparedAreaM2 nor confirmed cost grants assets.
  const quote = getKqWarehouseQuote(candidate, current.state);
  if (!Number.isSafeInteger(quote.totalCostCents) || quote.totalCostCents > MAX_INTEGER) {
    throw new KqWarehouseError("Cet aménagement dépasse la limite d’investissement.");
  }
  if (quote.totalCostCents !== input.expectedCostCents) databaseError("warehouse_price_changed");
  return withSales(publicSnapshot(storedSnapshot(await supabase.rpc("rpc_kq_warehouse_save", {
    p_user_id: input.userId, p_request_key: input.requestKey, p_request: request,
    p_expected_revision: input.expectedRevision, p_previous_state: current.state,
    p_next_state: quote.nextState, p_cost_cents: quote.totalCostCents,
  }))), forecast);
}

/** New games always use the warehouse; an active historical game can finish unchanged. */
export async function getKqWarehouseRunSnapshot(userId: string, zoneId?: string): Promise<KqWarehouseRunSnapshot | null> {
  if (zoneId !== undefined && (typeof zoneId !== "string" || !zoneId.trim() || zoneId.length > 80)) throw new KqWarehouseError("Zone de culture invalide.");
  let current = await readStoredSnapshot(userId);
  if (!current.state && !current.activeRun) {
    current = storedSnapshot(await createSupabaseServiceClient().rpc("rpc_kq_warehouse_initialize", {
      p_user_id: userId, p_starter_state: createKqWarehouseStarter(),
    }));
  }
  current = await compactIdleWarehouse(userId, current);
  return current.state ? deriveWarehouseRunSnapshot(current.state, current.revision, zoneId) : null;
}

export async function getKqWarehouseProcessingEquipment(userId: string, existingShop?: {
  sharedEquipment: Pick<KqEquipmentShopSnapshot["sharedEquipment"], "equippedCodes" | "operationalCodes" | "levels">;
}): Promise<{
  equippedCodes: string[];
  operationalCodes: string[];
  levels: Record<string, number>;
  processingBatchGrams: Record<string, number>;
  processingDurationSeconds: Record<string, number>;
  revision: number;
  sourceState: KqWarehouseState;
  workshopSnapshot: { equippedCodes: string[]; levels: Record<string, number> };
} | null> {
  const current = await readStoredSnapshot(userId);
  if (!current.state) return null;
  const shop = existingShop ?? await getKqEquipmentShopSnapshot(userId);
  const workshop = shop.sharedEquipment;
  const machines = workshop.equippedCodes.flatMap(code => {
    const specification = getKqWorkshopMachineSpecification(code, workshop.levels[code]);
    return specification ? [{ code, specification }] : [];
  });
  // This compatibility identifier unlocks the existing raw-sale route; it never
  // enters the culture snapshot or produces an equipment-level bonus.
  const equippedCodes = ["TENT-080-STARTER", ...machines.map(item => item.code)].sort();
  const levels = Object.fromEntries(equippedCodes.map(code => [code, workshop.levels[code] ?? 1]));
  return {
    equippedCodes,
    operationalCodes: equippedCodes.filter(code => code === "TENT-080-STARTER" || workshop.operationalCodes.includes(code)),
    levels,
    processingBatchGrams: Object.fromEntries(machines.map(({ code, specification }) => [code, specification.capacityGrams])),
    processingDurationSeconds: Object.fromEntries(machines.map(({ code, specification }) => [code, specification.durationSeconds])),
    revision: current.revision, sourceState: cleanState(current.state),
    workshopSnapshot: { equippedCodes, levels },
  };
}
