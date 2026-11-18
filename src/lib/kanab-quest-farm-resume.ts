import { normalizeKqFlowerTrim } from "./kanab-quest-flower-trim";
import type { FarmEvidence } from "./kanab-quest-farm-progress";

const record = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
const id = (value: unknown): value is string => typeof value === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
const nonnegative = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const invalidSnapshot = () => new Error("La progression passée ne peut pas être vérifiée pour le moment. Tes objectifs restent conservés.");

/** Adapt authenticated server responses only. A local draft or a visit is not input. */
export function readFarmResumeEvidence(runsPayload: unknown, flowersPayload: unknown): FarmEvidence {
  const runs = record(runsPayload), flowers = record(flowersPayload);
  if (!runs || runs.error || !Array.isArray(runs.activeRuns) || !flowers || flowers.error || !Array.isArray(flowers.flowers)) throw invalidSnapshot();
  const evidence: FarmEvidence = {};
  for (const raw of runs.activeRuns) {
    const run = record(raw), state = record(run?.state);
    if (!run || !id(run.runId) || !state || !Array.isArray(state.history) || !["prepare", "rolled", "resolved", "complete"].includes(String(state.phase))) throw invalidSnapshot();
    evidence.cultureStarted = true;
    if (["rolled", "resolved"].includes(String(state.phase))) evidence.rolled = true;
    if (state.history.length > 0) { evidence.rolled = true; evidence.turnResolved = true; }
    // A launched culture in a saved zone also proves that its assignment existed.
    if (id(run.zoneId) && typeof run.buddieCode === "string" && run.buddieCode.length > 0) {
      evidence.savedZones = 1; evidence.assignedZones = 1;
    }
  }
  const harvests: string[] = [], lots: NonNullable<FarmEvidence["lots"]> = [], trims: NonNullable<FarmEvidence["trims"]> = [];
  for (const raw of flowers.flowers) {
    const flower = record(raw);
    if (!flower || !id(flower.id) || !id(flower.runId) || !["available", "queued", "locked", "burned"].includes(String(flower.status))) throw invalidSnapshot();
    harvests.push(flower.id);
    const storage = record(flower.storage);
    if (storage && ["curing", "ready"].includes(String(storage.stage))) {
      const capacity = record(storage.capacity);
      lots.push({ id: flower.id, ready: storage.stage === "ready",
        protected: !!capacity && nonnegative(capacity.totalUnits) && capacity.totalUnits > 0
          && nonnegative(capacity.protectedUnits) && capacity.protectedUnits >= capacity.totalUnits && capacity.overflowUnits === 0 });
    }
    const trim = normalizeKqFlowerTrim(flower.trim);
    if (trim.status !== "unknown") trims.push({ id: flower.id, state: trim.status === "ready" ? "complete" : trim.status === "in-progress" ? "running" : "required" });
    // A queued/locked/burned flower alone is not a recorded jury verdict or sale.
  }
  if (harvests.length) evidence.pastHarvestIds = [...new Set(harvests)];
  if (lots.length) evidence.lots = lots;
  if (trims.length) evidence.trims = trims;
  return evidence;
}

/** One read on start/resume; no polling, commands, purchases or synthetic success. */
export async function collectFarmResumeEvidence(request: typeof fetch = fetch, signal?: AbortSignal): Promise<FarmEvidence> {
  const snapshots = await Promise.all(["runs", "flowers"].map(async resource => {
    const response = await request(`/api/arena/placard/${resource}`, { method: "GET", cache: "no-store", ...(signal ? { signal } : {}) });
    if (!response.ok) throw invalidSnapshot();
    try { return await response.json() as unknown; } catch { throw invalidSnapshot(); }
  }));
  return readFarmResumeEvidence(snapshots[0], snapshots[1]);
}
