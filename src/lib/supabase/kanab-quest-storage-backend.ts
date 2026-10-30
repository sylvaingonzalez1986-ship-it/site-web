import "server-only";

import { getKqStorageContainer, getKqStorageMethod, isKqStorageLot, KQ_STORAGE_CONTAINERS, KQ_STORAGE_METHODS, projectKqStorageLot, type KqStorageLot } from "@/lib/kanab-quest-storage";
import type { KqStorageSnapshot } from "@/lib/kanab-quest-api";
import { createSupabaseServiceClient } from "./admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function uuid(value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) throw new Error("Identifiant de stockage invalide.");
  return value;
}
function databaseError(message: string): never {
  const messages: Record<string, string> = {
    storage_invalid_request: "Demande de stockage invalide.", storage_invalid_method: "Installation inconnue.",
    storage_request_mismatch: "Cette demande a déjà servi pour une autre opération.",
    storage_already_owned: "Tu possèdes déjà cette installation.", storage_not_owned: "Achète cette installation avant de l’utiliser.",
    storage_insufficient_cash: "Trésorerie insuffisante pour cette installation.",
    storage_lot_unavailable: "Ce lot n’est plus disponible dans ton entrepôt.",
    storage_jury_required: "Termine le curing puis présente cette fleur au jury avant de vendre le surplus.",
    storage_invalid_quantity: "Choisis entre 1 et 1 000 contenants par achat.",
    storage_container_not_installed: "Ce modèle de contenant n’est pas installé dans ton entrepôt.",
    storage_container_capacity: "Pas assez de contenants libres de ce modèle pour accueillir tout le lot.",
    warehouse_service_capacity_in_use: "Cette place est réservée aux stocks et aux cultures en cours. Choisis un autre contenant ou agrandis le stockage.",
    warehouse_storage_purchase: "Ajoute ou agrandis une zone de stockage sur le plan de l’entrepôt pour acheter les contenants correspondants.",
    warehouse_storage_method_not_installed: "Cette méthode de conservation n’est pas installée dans une zone du plan.",
    storage_prepared_overflow: "Ce stock transformé nécessite des contenants supplémentaires.",
    warehouse_wholesale_exhausted: "La capacité d’achat des grossistes est épuisée. Elle revient 24 h après chaque vente.",
  };
  for (const [code, explanation] of Object.entries(messages)) if (message.includes(code)) throw new Error(explanation);
  throw new Error(`[supabase:storage] ${message}`);
}
export type KqStoredStorageLot = {
  flowerId: string; varietyName: string; harvestGrams: number; flowerStatus: string;
  state: KqStorageLot; revision: number; juryScore: number | null; marketStatus?: string | null;
  overflowOffer?: { units: number; payoutCents: number; netPayoutCents: number };
};
type StoredSnapshot = Omit<KqStorageSnapshot, "catalog" | "containers" | "lots"> & { lots: KqStoredStorageLot[] };

export function projectKqStoredStorageLot(lot: KqStoredStorageLot, nowMs: number) {
  if (!isKqStorageLot(lot.state)) throw new Error("[supabase:storage] invalid_storage_state");
  return projectKqStorageLot(lot.state, nowMs, lot.juryScore ?? undefined);
}
export async function getKqStorageRecords(userId: string): Promise<StoredSnapshot> {
  const result = await createSupabaseServiceClient().rpc("rpc_kq_storage_state", { p_user_id: uuid(userId) });
  if (result.error) databaseError(result.error.message);
  return result.data as StoredSnapshot;
}
function snapshot(current: StoredSnapshot): KqStorageSnapshot {
  const nowMs = Date.parse(current.serverNow);
  return { ...current, catalog: KQ_STORAGE_METHODS, containers: KQ_STORAGE_CONTAINERS, lots: current.lots.filter(lot => lot.marketStatus !== "sold").map(lot => ({
    flowerId: lot.flowerId, varietyName: lot.varietyName, harvestGrams: Number(lot.harvestGrams), flowerStatus: lot.flowerStatus,
    projection: projectKqStoredStorageLot(lot, nowMs),
    ...(lot.overflowOffer ? { overflowOffer: lot.overflowOffer } : {}),
  })) };
}
export async function getKqStorageSnapshot(userId: string) {
  const result = await createSupabaseServiceClient().rpc("rpc_kq_warehouse_storage_state", { p_user_id: uuid(userId) });
  if (result.error) databaseError(result.error.message);
  return snapshot(result.data as StoredSnapshot);
}
export async function handleKqStorageAction(userId: string, body: Record<string, unknown>) {
  uuid(userId);
  const action = String(body.action);
  const needsLot = action === "assign" || action === "place" || action === "sell-overflow";
  if (!["buy", "select-default", "assign", "place", "sell-overflow"].includes(action)
    || (!needsLot && body.flowerId !== undefined)) throw new Error("Demande de stockage invalide.");
  if (action === "buy") {
    if (typeof body.containerCode !== "string" || !getKqStorageContainer(body.containerCode)
      || typeof body.quantity !== "number" || !Number.isSafeInteger(body.quantity) || body.quantity < 1 || body.quantity > 1000
      || body.methodCode !== undefined) throw new Error("Quantité ou contenant invalide.");
  } else if (action === "place") {
    if (typeof body.containerCode !== "string" || !getKqStorageContainer(body.containerCode)
      || body.methodCode !== undefined || body.quantity !== undefined) throw new Error("Demande de placement invalide.");
  } else if (action === "select-default" || action === "assign") {
    if (typeof body.methodCode !== "string" || !getKqStorageMethod(body.methodCode)
      || body.containerCode !== undefined || body.quantity !== undefined) throw new Error("Demande de stockage invalide.");
  } else if (body.methodCode !== undefined || body.containerCode !== undefined || body.quantity !== undefined) throw new Error("Demande de stockage invalide.");
  const result = await createSupabaseServiceClient().rpc("rpc_kq_storage_capacity_command", {
    p_user_id: userId, p_action: action, p_method_code: body.methodCode ?? null,
    p_container_code: body.containerCode ?? null, p_quantity: body.quantity ?? null,
    p_flower_id: needsLot ? uuid(body.flowerId) : null, p_request_key: uuid(body.requestKey),
  });
  if (result.error) databaseError(result.error.message);
  return snapshot(result.data as StoredSnapshot);
}
