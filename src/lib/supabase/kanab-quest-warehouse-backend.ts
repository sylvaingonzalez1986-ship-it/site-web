import "server-only";

import { KQ_WAREHOUSE_CATALOG } from "@/lib/kanab-quest-warehouse-catalog";
import {
  compactKqWarehouseToStarterFloor,
  createKqWarehouseStarter,
  getKqWarehouseQuote,
  getKqWarehouseRunSnapshot as deriveWarehouseRunSnapshot,
  isKqWarehouseState,
  validateKqWarehouseState,
  type KqWarehouseRunSnapshot,
  type KqWarehouseState,
} from "@/lib/kanab-quest-warehouse";
import { createSupabaseServiceClient } from "./admin";
import { getKqPlayerWorkErrorMessage } from "../kanab-quest-player-work-errors";
import { getKqWarehouseSalesForecast, type KqWarehouseSalesForecast } from "./kanab-quest-warehouse-flow-backend";
import { getKqEquipmentShopSnapshot, type KqEquipmentShopSnapshot } from "./kanab-quest-equipment-backend";
import { getKqWorkshopMachineSpecification } from "../kanab-quest-workshop-machines";
import { isKqProductionReservation, withoutKqProductionEquipment, type KqProductionReservation } from "../kanab-quest-production-reservation";
import { getKqStaffSnapshot } from "./kanab-quest-staff-backend";
import { getKqProductionFacilities } from "../kanab-quest-staff-production";
import { isKqCareState } from "../kanab-quest-care";
import { getKqRoomCare } from "../kanab-quest-care-presentation";
import { initializeKqWarehouseCondition, isKqWarehouseCondition, reconcileKqWarehouseCondition, getKqWarehouseRemovalQuote, removeKqWarehouseZone,
  type KqWarehouseCondition, type KqWarehouseRemovalQuote } from "../kanab-quest-warehouse-condition";

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
  roomCare?: ReturnType<typeof getKqRoomCare>;
  powerOutage?: boolean;
};
export type KqWarehouseCompletedRun = {
  runId: string; zoneId: string; buddieCode: string; flowerId: string | null; completedAt: string;
  campaignId?: string; leaderRunId?: string;
  status?: string; stageIndex?: number; phase?: string; startedAt?: string;
};

export type KqWarehouseSnapshot = {
  /** Missing on an older server; null explicitly confirms no commercial reservation. */
  productionReservation?: KqProductionReservation | null;
  cultureEquipment?: KqWarehouseCondition | null;
  removalReceipt?: { resaleCents: number; soldCount: number; keptCount: number; requestKey?: string; replayed?: boolean };
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
  const workError = getKqPlayerWorkErrorMessage(message);
  if (workError) throw new KqWarehouseError(workError, 409);
  const failures: [string, string, number][] = [
    ["staff_production_capacity", "Le séchage ou le stockage disponible ne couvre pas ce nouveau rendement. Aucun équipement n’a été acheté.", 409],
    ["staff_production_budget", "Le plafond quotidien de production ne couvre pas le coût du nouveau cycle. Ajuste-le dans Personnel avant l’achat.", 409],
    ["staff_production_equipment_busy", "Termine et vends les lots de production autonome avant d’installer ce matériel.", 409],
    ["staff_production_changed", "La production autonome a changé. Actualise la disponibilité avant de confirmer.", 409],
    ["warehouse_condition_required", "Actualise l’entrepôt pour retrouver l’état de ton matériel.", 409],
    ["warehouse_condition_changed", "L’usure ou l’affectation du matériel a changé. Actualise le devis.", 409],
    ["warehouse_condition_invalid", "L’état du matériel doit être actualisé avant cette opération.", 409],
    ["warehouse_condition_inventory", "L’inventaire du matériel a changé. Actualise l’entrepôt.", 409],
    ["warehouse_asset_basis_changed", "La valeur comptable du matériel a changé. Actualise le devis de reprise.", 409],
    ["warehouse_purchase_basis_unknown", "Le prix d’achat de ce matériel est inconnu. Garde-le en réserve.", 409],
    ["warehouse_resale_changed", "Le montant de reprise a changé. Consulte le nouveau devis avant de confirmer.", 409],
    ["warehouse_removal_invalid", "Cette suppression ne correspond plus au matériel de la zone. Actualise le devis.", 409],
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
    ["warehouse_storage_climate_invalid", "Choisis un climatiseur adapté à une zone de stockage présente sur le plan.", 400],
    ["warehouse_equipment_missing", "Le matériel du plan doit être installé et payé avant de lancer la culture.", 409],
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
    || (data.state !== null && !isKqWarehouseState(data.state))
    || (data.cultureEquipment != null && !isKqWarehouseCondition(data.cultureEquipment))
    || (data.productionReservation !== undefined && (!isKqProductionReservation(data.productionReservation)
      || data.productionReservation !== null && !data.state?.zones.some(zone => zone.id === data.productionReservation?.zoneId)))) {
    throw new Error("[supabase:warehouse] invalid_snapshot");
  }
  return data;
}

/** Rebuild known fields; client-supplied derived values and hidden extras never persist. */
function cleanState(value: unknown): KqWarehouseState {
  if (!isKqWarehouseState(value)) throw new KqWarehouseError("Le plan contient des zones ou des appareils invalides.");
  return {
    version: 1,
    ...(value.spatial ? { spatial: { version: 1 } as const } : {}),
    ...(value.partitions !== undefined ? { partitions: value.partitions.map(partition => ({
      id: partition.id, x: partition.x, y: partition.y, axis: partition.axis, length: partition.length,
    })) } : {}),
    ...(value.floor ? { floor: { ...value.floor } } : {}),
    zones: value.zones.map(zone => ({
      id: zone.id, name: zone.name, x: zone.x, y: zone.y, width: zone.width, height: zone.height,
      active: zone.active, lightingCode: zone.lightingCode, airCode: zone.airCode,
      ...(zone.rotation !== undefined ? { rotation: zone.rotation } : {}),
      ...(zone.buddieCode !== undefined ? { buddieCode: zone.buddieCode } : {}),
      ...(zone.optionCodes !== undefined ? { optionCodes: [...zone.optionCodes].sort() } : {}),
    })),
    ...(value.serviceZones !== undefined ? { serviceZones: value.serviceZones.map(zone => ({
      id: zone.id, name: zone.name, x: zone.x, y: zone.y, width: zone.width, height: zone.height,
      kind: zone.kind, deviceCode: zone.deviceCode,
      ...(zone.rotation !== undefined ? { rotation: zone.rotation } : {}),
    })) } : {}),
    ...(value.storageClimateCode !== undefined ? { storageClimateCode: value.storageClimateCode } : {}),
    equipment: value.equipment.map(item => ({ code: item.code, quantity: item.quantity })),
    ...(value.optionInventory !== undefined ? { optionInventory: value.optionInventory.map(item => ({ code: item.code, quantity: item.quantity })) } : {}),
    preparedAreaM2: value.preparedAreaM2,
  };
}

function publicSnapshot(data: StoredSnapshot): KqWarehouseSnapshot {
  const receipt = data.receipt as (KqWarehouseReceipt & { resaleCents?: number; soldCount?: number; keptCount?: number }) | undefined;
  return { ...data, state: data.state ?? createKqWarehouseStarter(),
    ...(receipt && [receipt.resaleCents, receipt.soldCount, receipt.keptCount].every(value => Number.isSafeInteger(value) && value! >= 0)
      ? { removalReceipt: { resaleCents: receipt.resaleCents!, soldCount: receipt.soldCount!, keptCount: receipt.keptCount!, requestKey: receipt.requestKey, replayed: receipt.replayed } } : {}),
  };
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

async function ensureCondition(userId: string, current: StoredSnapshot, freeStarter = false): Promise<StoredSnapshot> {
  // An absent field supports a rolling deployment. Null explicitly requests initialization.
  if (!current.state || current.cultureEquipment !== null) return current;
  const condition = initializeKqWarehouseCondition(current.state, freeStarter);
  const result = await createSupabaseServiceClient().rpc("rpc_kq_warehouse_condition_initialize", {
    p_user_id: userId, p_expected_revision: current.revision, p_assets: condition.assets,
  });
  return storedSnapshot(result);
}

async function compactIdleWarehouse(userId: string, current: StoredSnapshot): Promise<StoredSnapshot> {
  if (!current.state || current.activeRun || current.legacyActiveRun || current.activeRuns?.length || current.productionReservation) return current;
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
  // A commercial reservation may win after our initial read. Its layout guard
  // keeps the paid plan intact; return that new occupancy instead of the draft.
  if (result.error?.message === "staff_production_occupied") return readStoredSnapshot(userId);
  return storedSnapshot(result);
}

/** One narrow read per overview, including one row per shared campaign. If a
 * stage changes between reads, retain only its original navigational summary. */
async function withRoomObservations<T extends { activeRuns?: KqWarehouseActiveRun[] }>(userId: string, snapshot: T): Promise<T> {
  if (!snapshot.activeRuns?.length) return snapshot;
  const ids = [...new Set(snapshot.activeRuns.map(run => run.leaderRunId ?? run.runId))];
  try {
    const { data, error } = await createSupabaseServiceClient().from("kq_runs")
      .select("id,stage:state->stageIndex,phase:state->>phase,care:state->care,outage:state->powerOutage")
      .eq("user_id", userId).eq("status", "active").in("id", ids);
    if (error || !data) return snapshot;
    const rows = new Map(data.map(row => [row.id, row]));
    return { ...snapshot, activeRuns: snapshot.activeRuns.map(run => {
      const row = rows.get(run.leaderRunId ?? run.runId);
      if (!row || row.stage !== run.stageIndex || row.phase !== run.phase) return run;
      return { ...run, ...(isKqCareState(row.care) ? { roomCare: getKqRoomCare(run.stageIndex, row.care, run.zoneId) } : {}),
        ...(typeof row.outage === "boolean" ? { powerOutage: row.outage } : {}) };
    }) };
  } catch { return snapshot; }
}

export async function observeKqWarehouseRoom(userId: string) {
  assertUuid(userId);
  const response = await createSupabaseServiceClient().rpc("rpc_kq_observe_warehouse_room", { p_user_id: userId });
  if (response.error) databaseError(response.error.message);
  const view = response.data;
  if (!view) return { state: null };
  if (!isKqWarehouseState(view.state) || !Number.isSafeInteger(view.revision) || !Array.isArray(view.activeRuns)) throw new KqWarehouseError("Plan de culture indisponible.", 503);
  return withRoomObservations(userId, { state: view.state, revision: view.revision, activeRuns: view.activeRuns as KqWarehouseActiveRun[],
    stockGrams: typeof view.stockGrams === "number" && view.stockGrams >= 0 ? view.stockGrams : null,
    productionReservation: isKqProductionReservation(view.productionReservation) ? view.productionReservation : null });
}

/** Conversion is free, archived and postponed while a historical culture is active. */
export async function getKqWarehouseSnapshot(userId: string, options?: { preserveLayout?: boolean; cultureDetails?: boolean }): Promise<KqWarehouseSnapshot> {
  assertUuid(userId);
  let initial = await readStoredSnapshot(userId);
  if (!initial.state && !initial.activeRun) {
    // Install the physical storage rules before commerce can settle anything:
    // opening this screen must not trigger a historical automatic overflow sale.
    initial = storedSnapshot(await createSupabaseServiceClient().rpc("rpc_kq_warehouse_initialize", {
      p_user_id: userId, p_starter_state: createKqWarehouseStarter(),
    }));
    initial = await ensureCondition(userId, initial, true);
  }
  if (!options?.preserveLayout) await compactIdleWarehouse(userId, initial);
  const forecast = await salesForecast(userId);
  // Commerce may settle pending proceeds, even before an optional forecast fails.
  // Always return the wallet after that settlement and any conversion.
  const result = withSales(publicSnapshot(await ensureCondition(userId, await readStoredSnapshot(userId))), forecast);
  return options?.cultureDetails ? withRoomObservations(userId, result) : result;
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
  let current = await ensureCondition(input.userId, await readStoredSnapshot(input.userId));
  let productionStaff: Awaited<ReturnType<typeof getKqStaffSnapshot>> | undefined;
  if (!current.state || current.revision !== input.expectedRevision) {
    const concurrentReceipt = await replay();
    if (concurrentReceipt) return concurrentReceipt;
    databaseError("warehouse_revision_changed");
  }
  if (!!current.state.floor !== !!candidate.floor) databaseError("warehouse_floor_changed");
  // Older plans may omit saved walls; validate their effective 2D geometry too.
  const geometryErrors = validateKqWarehouseState(candidate.partitions === undefined && current.state.partitions !== undefined
    ? { ...candidate, partitions: current.state.partitions } : candidate);
  if (geometryErrors.length) throw new KqWarehouseError(geometryErrors.join(" "));
  if (current.legacyActiveRun || (current.activeRun && !current.activeRuns?.length)) databaseError("warehouse_active_run");
  if (current.productionReservation) {
    const zoneId = current.productionReservation.zoneId;
    const previous = cleanState(current.state);
    const before = previous.zones.find(zone => zone.id === zoneId);
    const after = candidate.zones.find(zone => zone.id === zoneId);
    if (!before || !after || JSON.stringify(withoutKqProductionEquipment(before)) !== JSON.stringify(withoutKqProductionEquipment(after))
      || JSON.stringify(previous.serviceZones) !== JSON.stringify(candidate.serviceZones)) databaseError("staff_production_occupied");
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      if (current.productionReservation.equipmentEditable === undefined) databaseError("staff_production_equipment_busy");
      productionStaff = await getKqStaffSnapshot(input.userId);
      current = await readStoredSnapshot(input.userId);
      if (!current.state || current.revision !== input.expectedRevision) databaseError("warehouse_revision_changed");
      if (!current.productionReservation?.equipmentEditable || current.productionReservation.zoneId !== zoneId
        || !productionStaff.state?.production?.facility || productionStaff.state.production.lots.length || productionStaff.state.production.jobs.length) databaseError("staff_production_equipment_busy");
    }
  }
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
  const condition = current.cultureEquipment ? reconcileKqWarehouseCondition(current.state, quote.nextState, current.cultureEquipment, {
    requestKey: input.requestKey, fundedFraction: quote.totalCostCents ? Math.max(0, quote.totalCostCents - current.migrationCreditCents) / quote.totalCostCents : 0,
    fundedCents: Math.max(0, quote.totalCostCents - current.migrationCreditCents), investmentCents: quote.totalCostCents,
  }) : undefined;
  if (productionStaff) {
    if (!condition || !productionStaff.context.productionFacility) databaseError("warehouse_condition_required");
    const next = getKqProductionFacilities({ ...productionStaff.context, productionFacility: {
      ...productionStaff.context.productionFacility, warehouseState: quote.nextState, warehouseRevision: current.revision + 1, cultureEquipment: condition,
    } }).find(facility => facility.zoneId === current.productionReservation!.zoneId);
    if (!next?.available) databaseError("staff_production_capacity");
    if (next.cycleCostCents > productionStaff.state!.production!.settings.maxDailyCostCents) databaseError("staff_production_budget");
  }
  return withSales(publicSnapshot(storedSnapshot(await supabase.rpc(productionStaff ? "rpc_kq_warehouse_save_production_equipment" : condition ? "rpc_kq_warehouse_save_condition" : "rpc_kq_warehouse_save", {
    p_user_id: input.userId, p_request_key: input.requestKey, p_request: request,
    p_expected_revision: input.expectedRevision, p_previous_state: current.state,
    p_next_state: quote.nextState, p_cost_cents: quote.totalCostCents,
    ...(condition ? { p_previous_assets: current.cultureEquipment!.assets, p_next_assets: condition.assets } : {}),
    ...(productionStaff ? { p_expected_staff_revision: productionStaff.revision,
      p_settled_at: productionStaff.state!.production!.advancedAt } : {}),
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
    current = await ensureCondition(userId, current, true);
  }
  current = await compactIdleWarehouse(userId, current);
  current = await ensureCondition(userId, current);
  if (zoneId !== undefined && current.productionReservation?.zoneId === zoneId) databaseError("staff_production_occupied");
  return current.state ? { ...deriveWarehouseRunSnapshot(current.state, current.revision, zoneId, 2, 2, 2, current.cultureEquipment ?? undefined),
    ...(current.productionReservation !== undefined ? { productionReservedZoneId: current.productionReservation?.zoneId ?? null } : {}),
  } : null;
}

function assertRemovalInput(input: { userId: string; zoneId: string; expectedRevision: number }) {
  assertUuid(input.userId);
  if (typeof input.zoneId !== "string" || !input.zoneId.trim() || input.zoneId.length > 80
    || !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 1 || input.expectedRevision >= MAX_INTEGER) throw new KqWarehouseError("Zone ou révision invalide.");
}

async function removalSnapshot(input: { userId: string; zoneId: string; expectedRevision: number }) {
  const current = await ensureCondition(input.userId, await readStoredSnapshot(input.userId));
  if (!current.state || current.revision !== input.expectedRevision) databaseError("warehouse_revision_changed");
  if (!current.cultureEquipment) throw new KqWarehouseError("La mise à jour du suivi du matériel est nécessaire pour supprimer une zone.", 503);
  if (current.legacyActiveRun || (current.activeRun && !current.activeRuns?.length) || current.activeRuns?.some(run => !run.zoneId || run.zoneId === input.zoneId)) databaseError("warehouse_zone_busy");
  if (current.productionReservation?.zoneId === input.zoneId) databaseError("staff_production_occupied");
  if (!current.state.zones.some(zone => zone.id === input.zoneId)) throw new KqWarehouseError("Cette zone de culture n’existe plus.", 409);
  return { ...current, state: current.state, cultureEquipment: current.cultureEquipment };
}

export async function quoteKqWarehouseZoneRemoval(input: { userId: string; zoneId: string; expectedRevision: number }): Promise<KqWarehouseRemovalQuote> {
  assertRemovalInput(input);
  const current = await removalSnapshot(input);
  return getKqWarehouseRemovalQuote(current.state, current.cultureEquipment, input.zoneId, current.revision);
}

export async function removeKqWarehouseCultureZone(input: { userId: string; zoneId: string; expectedRevision: number; resellEquipment: boolean; expectedResaleCents: number; requestKey: string }): Promise<KqWarehouseSnapshot> {
  assertRemovalInput(input); assertUuid(input.requestKey);
  if (typeof input.resellEquipment !== "boolean" || !Number.isSafeInteger(input.expectedResaleCents) || input.expectedResaleCents < 0 || input.expectedResaleCents > MAX_INTEGER) throw new KqWarehouseError("Choix de reprise invalide.");
  const request = { action: "remove-zone", zoneId: input.zoneId, expectedRevision: input.expectedRevision, resellEquipment: input.resellEquipment, expectedResaleCents: input.expectedResaleCents };
  const supabase = createSupabaseServiceClient();
  const replay = async () => {
    const result = await supabase.rpc("rpc_kq_warehouse_receipt", { p_user_id: input.userId, p_request_key: input.requestKey, p_request: request });
    if (result.error) databaseError(result.error.message);
    return result.data ? publicSnapshot(storedSnapshot(result)) : null;
  };
  const receipt = await replay();
  if (receipt) return receipt;
  let current: Awaited<ReturnType<typeof removalSnapshot>>;
  try { current = await removalSnapshot(input); }
  catch (error) {
    // The first attempt may commit between receipt lookup and reading the plan.
    if (error instanceof KqWarehouseError && error.status === 409) {
      const concurrentReceipt = await replay();
      if (concurrentReceipt) return concurrentReceipt;
    }
    throw error;
  }
  const quote = getKqWarehouseRemovalQuote(current.state, current.cultureEquipment, input.zoneId, current.revision);
  const resaleCents = input.resellEquipment ? quote.resaleCents : 0;
  if (resaleCents !== input.expectedResaleCents) databaseError("warehouse_resale_changed");
  const next = removeKqWarehouseZone(current.state, current.cultureEquipment, input.zoneId, input.resellEquipment);
  return publicSnapshot(storedSnapshot(await supabase.rpc("rpc_kq_warehouse_remove_zone", {
    p_user_id: input.userId, p_request_key: input.requestKey, p_request: request, p_expected_revision: input.expectedRevision,
    p_previous_state: current.state, p_previous_assets: current.cultureEquipment.assets,
    p_next_state: next.state, p_next_assets: next.condition.assets, p_resale_cents: resaleCents,
  })));
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
