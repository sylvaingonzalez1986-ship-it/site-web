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
    storage_invalid_quantity: "Choisis entre 1 et 1 000 contenants par achat.",
    storage_prepared_overflow: "Ce stock transformé nécessite des contenants supplémentaires.",
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
export async function getKqStorageSnapshot(userId: string) { return snapshot(await getKqStorageRecords(userId)); }
export async function handleKqStorageAction(userId: string, body: Record<string, unknown>) {
  uuid(userId);
  const action = String(body.action);
  const needsLot = action === "assign" || action === "sell-overflow";
  if (!["buy", "select-default", "assign", "sell-overflow"].includes(action)
    || (!needsLot && body.flowerId !== undefined)) throw new Error("Demande de stockage invalide.");
  if (action === "buy") {
    if (typeof body.containerCode !== "string" || !getKqStorageContainer(body.containerCode)
      || typeof body.quantity !== "number" || !Number.isSafeInteger(body.quantity) || body.quantity < 1 || body.quantity > 1000
      || body.methodCode !== undefined) throw new Error("Quantité ou contenant invalide.");
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
