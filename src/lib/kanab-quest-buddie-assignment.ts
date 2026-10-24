import { getKqBuddieRotationRemaining, KQ_BUDDIE_ROTATION_REQUIRED, type KqBuddieRotation } from "./kanab-quest-buddie-rotation";
import { getKqWarehouseQuote, isKqWarehouseState, type KqWarehouseState } from "./kanab-quest-warehouse";

export type KqBuddieAssignmentSnapshot = {
  state: KqWarehouseState;
  revision: number;
  activeRun?: boolean;
  legacyActiveRun?: boolean;
  activeRuns?: Array<{ zoneId: string | null }>;
};

export type KqBuddieAssignmentRequest = {
  expectedRevision: number;
  state: KqWarehouseState;
  expectedCostCents: 0;
  requestKey: string;
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const buddieCode = (value: unknown): value is string => typeof value === "string" && /^HH2026-\d{3}$/.test(value)
  && Number(value.slice(-3)) >= 1 && Number(value.slice(-3)) <= 52;
const revision = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 1 && Number(value) < 2_147_483_647;

function knownRuns(snapshot: KqBuddieAssignmentSnapshot) {
  if (snapshot.activeRun !== undefined && typeof snapshot.activeRun !== "boolean"
    || snapshot.legacyActiveRun !== undefined && typeof snapshot.legacyActiveRun !== "boolean"
    || snapshot.activeRuns !== undefined && (!Array.isArray(snapshot.activeRuns)
      || snapshot.activeRuns.some(run => !record(run) || typeof run.zoneId !== "string" || !run.zoneId))) return false;
  return Array.isArray(snapshot.activeRuns) || snapshot.activeRun === false;
}

/** Only the chosen assignment changes. The existing warehouse PATCH remains
 * authoritative for concurrent edits, ownership, occupied zones and the price.
 * Keep the entire returned body and its key unchanged when retrying a request.
 */
export function getKqBuddieAssignmentRequest(
  snapshot: KqBuddieAssignmentSnapshot,
  choice: { zoneId: string; buddieCode: string | null },
  collection: { ownedCodes: readonly string[] | null; rotation: KqBuddieRotation | null },
  requestKey: string,
): KqBuddieAssignmentRequest {
  if (!snapshot || !isKqWarehouseState(snapshot.state) || !revision(snapshot.revision)) {
    throw new Error("Le plan de culture est incomplet. Actualise avant de choisir un Buddie.");
  }
  if (typeof requestKey !== "string" || !uuid.test(requestKey)) throw new Error("La demande d’affectation est invalide. Réessaie.");
  if (!knownRuns(snapshot)) throw new Error("Les cultures en cours ne sont pas encore vérifiées. Actualise le plan.");
  if (snapshot.legacyActiveRun || snapshot.activeRun && !snapshot.activeRuns?.length) {
    throw new Error("Termine la culture en cours avant de changer les Buddies.");
  }
  const zone = snapshot.state.zones.find(item => item.id === choice?.zoneId);
  if (!zone) throw new Error("Cette zone de culture n’existe plus. Actualise le plan.");
  if (!zone.active) throw new Error("Cette zone est inactive. Active-la dans le plan avant de choisir un Buddie.");
  if (snapshot.activeRuns?.some(run => run.zoneId === zone.id)) throw new Error("Cette zone accueille déjà une culture. Son Buddie reste en place.");
  if (!Array.isArray(collection?.ownedCodes) || !collection.ownedCodes.every(buddieCode)) {
    throw new Error("Ta collection de Buddies doit être vérifiée avant cette modification.");
  }
  const rotation = collection.rotation;
  if (!rotation || rotation.requiredDistinctBuddies !== KQ_BUDDIE_ROTATION_REQUIRED
    || !Array.isArray(rotation.recentBuddieCodes) || !rotation.recentBuddieCodes.every(buddieCode)) {
    throw new Error("La rotation de tes Buddies doit être vérifiée avant cette modification.");
  }
  if (choice.buddieCode !== null) {
    if (!buddieCode(choice.buddieCode) || !collection.ownedCodes.includes(choice.buddieCode)) {
      throw new Error("Choisis un Buddie présent dans ta collection.");
    }
    if (getKqBuddieRotationRemaining(choice.buddieCode, rotation.recentBuddieCodes)) {
      throw new Error("Ce Buddie est encore en rotation. Choisis une autre variété.");
    }
    if (snapshot.state.zones.some(item => item.id !== zone.id && item.buddieCode === choice.buddieCode)) {
      throw new Error("Ce Buddie est déjà affecté à une autre zone. Retire-le de cette zone avant de le choisir ici.");
    }
  }
  const state = structuredClone(snapshot.state);
  const target = state.zones.find(item => item.id === zone.id)!;
  if (choice.buddieCode === null) delete target.buddieCode;
  else target.buddieCode = choice.buddieCode;
  if (getKqWarehouseQuote(state, snapshot.state).totalCostCents !== 0) {
    throw new Error("Le plan demande un aménagement payant. Vérifie-le dans l’entrepôt avant de changer les Buddies.");
  }
  return { expectedRevision: snapshot.revision, state, expectedCostCents: 0, requestKey };
}

/** JSONB and the save endpoint may reorder object keys and owned inventories.
 * Compare their meaning while keeping every zone, assignment and plan field.
 */
function canonicalState(state: KqWarehouseState) {
  const ordered = {
    ...state,
    zones: state.zones.map(zone => ({ ...zone, ...(zone.optionCodes ? { optionCodes: [...zone.optionCodes].sort() } : {}) }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    equipment: [...state.equipment].sort((left, right) => left.code.localeCompare(right.code)),
    ...(state.serviceZones ? { serviceZones: [...state.serviceZones].sort((left, right) => left.id.localeCompare(right.id)) } : {}),
    ...(state.optionInventory ? { optionInventory: [...state.optionInventory].sort((left, right) => left.code.localeCompare(right.code)) } : {}),
  };
  const stable = (value: unknown): unknown => Array.isArray(value) ? value.map(stable)
    : record(value) ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
  return JSON.stringify(stable(ordered));
}

export type KqBuddieAssignmentReceipt = { status: "saved" | "changed"; snapshot: KqBuddieAssignmentSnapshot };

/** Replays include today's snapshot alongside the original receipt. A later
 * edit is a confirmed conflict to refresh, not another uncertain transaction.
 */
export function classifyKqBuddieAssignmentReceipt(value: unknown, request: KqBuddieAssignmentRequest): KqBuddieAssignmentReceipt | null {
  if (!record(value) || !isKqWarehouseState(value.state) || !revision(value.revision)
    || !record(value.receipt) || value.receipt.requestKey !== request.requestKey
    || value.receipt.revision !== request.expectedRevision + 1 || value.revision < Number(value.receipt.revision)
    || value.receipt.investmentCents !== 0 || value.receipt.creditUsedCents !== 0 || value.receipt.chargedCents !== 0
    || typeof value.receipt.replayed !== "boolean") return null;
  const snapshot = value as KqBuddieAssignmentSnapshot;
  if (!knownRuns(snapshot)) return null;
  let expected: KqWarehouseState;
  try {
    // The save endpoint normalizes inventory order and removes zero quantities.
    const quote = getKqWarehouseQuote(request.state, request.state);
    if (quote.totalCostCents !== 0) return null;
    expected = quote.nextState;
  } catch { return null; }
  if (canonicalState(snapshot.state) === canonicalState(expected)) return { status: "saved", snapshot };
  return snapshot.revision > Number(value.receipt.revision) ? { status: "changed", snapshot } : null;
}

/** A missing/changed receipt must never be presented as an installed selection. */
export function parseKqBuddieAssignmentReceipt(value: unknown, request: KqBuddieAssignmentRequest): KqBuddieAssignmentSnapshot | null {
  const receipt = classifyKqBuddieAssignmentReceipt(value, request);
  return receipt?.status === "saved" ? receipt.snapshot : null;
}
