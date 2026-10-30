import { getKqRemoteActiveRun, readKqResponse, type KqApiBurnReceipt, type KqRemoteActiveRun } from "./kanab-quest-api";
import { encodeKqSave, parseKqGameSave } from "./kanab-quest-persistence";
import { KQ_CARDS, KQ_STAGES } from "./kanab-quest-game";

export type KqCardAttempt = {
  runId: string;
  cardCode: string;
  stageIndex: number;
  seed: number;
  receiptIds: string[];
  inventoryCodes: string[];
};

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const counts = (value: unknown): value is Record<string, number> => record(value)
  && Object.values(value).every(count => Number.isSafeInteger(count) && Number(count) >= 0);
const validReceipt = (value: unknown): value is KqApiBurnReceipt => record(value)
  && typeof value.id === "string" && !!value.id && typeof value.cardInstanceId === "string" && !!value.cardInstanceId
  && typeof value.cardCode === "string" && !!value.cardCode && Number.isSafeInteger(value.stageIndex) && Number(value.stageIndex) >= 0 && Number(value.stageIndex) < KQ_STAGES.length
  && ["substrate", "support", "pbi"].includes(String(value.useKind)) && typeof value.burnedAt === "string" && Number.isFinite(Date.parse(value.burnedAt));

export function verifyKqCardPlayResult(value: unknown, attempt: KqCardAttempt) {
  if (!record(value)) throw new Error("La confirmation de la carte est incomplète. Vérifie ta culture.");
  const state = parseKqGameSave(encodeKqSave(value.state)), receipt = value.burnReceipt;
  const useKind = KQ_CARDS.find(card => card.code === attempt.cardCode)?.category === "pbi" ? "pbi" : "support";
  if (!state || state.seed !== attempt.seed || state.stageIndex !== attempt.stageIndex || !state.usedCards.includes(attempt.cardCode)
    || !state.playedThisStage.includes(attempt.cardCode) || !validReceipt(receipt) || receipt.cardCode !== attempt.cardCode
    || receipt.stageIndex !== attempt.stageIndex || receipt.useKind !== useKind || attempt.receiptIds.includes(receipt.id)) {
    throw new Error("La confirmation de la carte est incomplète. Vérifie ta culture.");
  }
  return { state, burnReceipt: receipt };
}

function exactRun(payload: Awaited<ReturnType<typeof getKqRemoteActiveRun>>, attempt: KqCardAttempt): KqRemoteActiveRun {
  const raw = payload.activeRun;
  if (!raw || raw.runId !== attempt.runId) throw new Error("La culture demandée n’a pas été retrouvée. Réessaie la vérification.");
  const state = parseKqGameSave(encodeKqSave(raw.state));
  if (!state || state.seed !== attempt.seed || state.stageIndex < attempt.stageIndex
    || typeof raw.updatedAt !== "string" || !Number.isFinite(Date.parse(raw.updatedAt))
    || !Array.isArray(raw.burnReceipts) || !raw.burnReceipts.every(validReceipt)
    || new Set(raw.burnReceipts.map(receipt => receipt.id)).size !== raw.burnReceipts.length) {
    throw new Error("La sauvegarde reçue est incomplète. Réessaie la vérification.");
  }
  return { ...raw, state };
}

const signature = (run: KqRemoteActiveRun) => JSON.stringify({
  updatedAt: run.updatedAt,
  state: run.state,
  receipts: [...run.burnReceipts].sort((a, b) => a.id.localeCompare(b.id)),
});

/** Read only. An absent receipt is an observation, never proof that a pending POST failed. */
export async function readKqCardRecovery(attempt: KqCardAttempt, request: typeof fetch) {
  // Runs read state and receipts separately. Bracket the album read with two
  // matching snapshots so an intervening commit cannot leave stale balances.
  const first = exactRun(await getKqRemoteActiveRun(request, { runId: attempt.runId }), attempt);
  const payload = await readKqResponse<unknown>(await request("/api/admin/placard/collection", { cache: "no-store" }));
  // The player route wraps its collection; the admin route returns it directly.
  // A present but invalid envelope must not fall back to unrelated root fields.
  const collection = record(payload) && Object.hasOwn(payload, "collection") ? payload.collection : payload;
  if (!record(collection) || collection.ownerFound !== true || !counts(collection.inventory) || !counts(collection.availableInventory)) {
    throw new Error("Les copies de l’album n’ont pas pu être vérifiées. Réessaie.");
  }
  const inventory = collection.inventory, availableInventory = collection.availableInventory;
  const required = new Set([...attempt.inventoryCodes, attempt.cardCode, ...Object.keys(inventory), ...Object.keys(availableInventory)]);
  if ([...required].some(code => !Object.hasOwn(inventory, code) || !Object.hasOwn(availableInventory, code) || availableInventory[code] > inventory[code])) {
    throw new Error("Le décompte de l’album est incomplet. Réessaie la vérification.");
  }
  const run = exactRun(await getKqRemoteActiveRun(request, { runId: attempt.runId }), attempt);
  if (signature(first) !== signature(run)) throw new Error("La culture a évolué pendant la lecture. Vérifie-la à nouveau.");
  const receipt = run.burnReceipts.find(item => item.cardCode === attempt.cardCode && item.stageIndex === attempt.stageIndex && !attempt.receiptIds.includes(item.id)) ?? null;
  return { run, inventory, availableInventory, receipt };
}
