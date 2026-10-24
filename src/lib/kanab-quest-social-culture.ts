import { getKqCareProblem } from "./kanab-quest-care";
import { KQ_STAGES } from "./kanab-quest-game";

export type KqSocialCultivation = "indoor" | "outdoor" | "unknown";
export type KqSocialCultureRun = {
  id: string; zoneId: string | null; zoneName: string | null;
  varietyCode: string; varietyName: string; cultivation: KqSocialCultivation;
  stageIndex: number; phase: "prepare" | "rolled" | "resolved" | "complete";
  updatedAt: string; cultureDead: boolean;
  lastResolved?: { stageIndex: number; situation: string; outcome: "critical" | "success" | "fragile" | "failure"; trait: string };
  problem?: { symptom: string; diagnosis: string | null; status: "suspected" | "confirmed" };
};
export type KqSocialCultureLot = {
  id: string; runId: string | null; varietyCode: string; varietyName: string;
  cultivation: KqSocialCultivation; stage: "curing" | "ready" | "unknown";
  harvestGrams: number | null; remainingGrams: number | null; harvestedAt: string | null;
};
export type KqSocialCultureContext = {
  version: 1; source: "own" | "loan" | "unknown"; observedAt: string;
  runs: KqSocialCultureRun[]; lots: KqSocialCultureLot[];
};

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, max = 160): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= max && !/[\p{Cc}<>]/u.test(value);
const date = (value: unknown): value is string => typeof value === "string" && value.length <= 40 && Number.isFinite(Date.parse(value));
const nullableText = (value: unknown) => value === null || text(value);
const stage = (value: unknown): value is number => Number.isInteger(value) && Number(value) >= 0 && Number(value) < KQ_STAGES.length;
const cultivation = (value: unknown): KqSocialCultivation => value === "indoor" || value === "outdoor" ? value : "unknown";
const phase = (value: unknown): value is KqSocialCultureRun["phase"] => typeof value === "string" && ["prepare", "rolled", "resolved", "complete"].includes(value);
const outcome = (value: unknown): value is NonNullable<KqSocialCultureRun["lastResolved"]>["outcome"] => typeof value === "string" && ["critical", "success", "fragile", "failure"].includes(value);

export function createKqSocialCultureContext(now: number, source: KqSocialCultureContext["source"] = "unknown"): KqSocialCultureContext {
  return { version: 1, source, observedAt: new Date(now).toISOString(), runs: [], lots: [] };
}

/** Accepts only the observed subset. Future situations, seed, cards, finances
 * and hidden diagnoses never leave this projection. */
export function projectKqSocialCultureRun(value: unknown): KqSocialCultureRun | null {
  if (!record(value) || !text(value.id) || !date(value.updatedAt) || !record(value.state)) return null;
  const state = value.state;
  if (!text(state.varietyCode) || !text(state.varietyName) || !stage(state.stageIndex) || !phase(state.phase)
    || state.cultureDead !== undefined && typeof state.cultureDead !== "boolean") return null;
  const warehouse = record(state.warehouse) ? state.warehouse : null;
  const zoneId = warehouse && text(warehouse.zoneId) ? warehouse.zoneId : null;
  const zone = warehouse && Array.isArray(warehouse.zones) ? warehouse.zones.find(item => record(item) && item.id === zoneId) : null;
  const result: KqSocialCultureRun = {
    id: value.id, zoneId, zoneName: record(zone) && text(zone.name) ? zone.name : null,
    varietyCode: state.varietyCode, varietyName: state.varietyName,
    cultivation: warehouse && [1, 2].includes(Number(warehouse.version)) ? "indoor" : cultivation(value.cultivation),
    stageIndex: state.stageIndex, phase: state.phase, updatedAt: value.updatedAt, cultureDead: state.cultureDead === true,
  };
  const last = Array.isArray(state.history) ? state.history.at(-1) : null;
  if (record(last)) {
    const index = KQ_STAGES.indexOf(last.stage as typeof KQ_STAGES[number]);
    if (index >= 0 && index <= state.stageIndex && text(last.situation) && outcome(last.outcome) && text(last.trait)) {
      result.lastResolved = { stageIndex: index, situation: last.situation, outcome: last.outcome, trait: last.trait };
    }
  }
  const care = record(state.care) ? state.care : null;
  if (!result.cultureDead && care && Array.isArray(care.problems)) {
    const visible = care.problems.find(problem => record(problem) && (problem.status === "suspected" || problem.status === "confirmed")
      && Number.isInteger(problem.appearedAt) && Number(problem.appearedAt) >= 0 && Number(problem.appearedAt) <= result.stageIndex
      && [0, 1].includes(Number(problem.variant)) && typeof problem.code === "string" && getKqCareProblem(problem.code));
    if (record(visible)) {
      const definition = getKqCareProblem(String(visible.code))!;
      result.problem = { symptom: definition.symptoms[Number(visible.variant)],
        diagnosis: visible.status === "confirmed" ? definition.name : null, status: visible.status as "suspected" | "confirmed" };
    }
  }
  return result;
}

/** A harvested lot is not automatically ready for sale. Unknown storage dates
 * stay unknown, and unknown quantities never become zero or the original yield. */
export function projectKqSocialCultureLot(value: unknown, now: number): KqSocialCultureLot | null {
  if (!record(value) || !text(value.id) || !text(value.varietyCode) || !text(value.varietyName)
    || value.runId !== null && value.runId !== undefined && !text(value.runId)) return null;
  const storage = record(value.storage) ? value.storage : null;
  const harvestedAt = date(value.harvestedAt) ? value.harvestedAt : storage && date(storage.harvestedAt) ? storage.harvestedAt : null;
  const readyAt = storage && date(storage.readyAt) ? storage.readyAt : null;
  const remainingGrams = typeof value.remainingGrams === "number" && Number.isFinite(value.remainingGrams)
    && value.remainingGrams >= 0 && value.remainingGrams <= 1_000_000_000 ? value.remainingGrams : null;
  const harvestGrams = typeof value.harvestGrams === "number" && Number.isFinite(value.harvestGrams)
    && value.harvestGrams >= 0 && value.harvestGrams <= 1_000_000_000 ? value.harvestGrams : null;
  return { id: value.id, runId: text(value.runId) ? value.runId : null,
    varietyCode: value.varietyCode, varietyName: value.varietyName, cultivation: cultivation(value.cultivation),
    stage: readyAt && harvestedAt && Date.parse(readyAt) >= Date.parse(harvestedAt) && Date.parse(harvestedAt) <= now
      ? Date.parse(readyAt) <= now ? "ready" : "curing" : "unknown",
    harvestGrams, remainingGrams, harvestedAt };
}

export function projectKqSocialCultureContext(value: unknown, now: number, source: "own" | "loan"): KqSocialCultureContext {
  if (!record(value) || !Array.isArray(value.runs) || !Array.isArray(value.lots) || value.runs.length > 128 || value.lots.length > 128) {
    throw new Error("Le contexte de culture est incomplet.");
  }
  const runs = value.runs.map(projectKqSocialCultureRun), lots = value.lots.map(lot => projectKqSocialCultureLot(lot, now));
  if (runs.some(run => !run) || lots.some(lot => !lot)) throw new Error("Le contexte de culture est incomplet.");
  const result = { ...createKqSocialCultureContext(now, source), runs: runs as KqSocialCultureRun[], lots: lots as KqSocialCultureLot[] };
  if (!isKqSocialCultureContext(result)) throw new Error("Le contexte de culture est incohérent.");
  return result;
}

export function isKqSocialCultureContext(value: unknown): value is KqSocialCultureContext {
  if (!record(value) || value.version !== 1 || typeof value.source !== "string" || !["own", "loan", "unknown"].includes(value.source) || !date(value.observedAt)
    || !Array.isArray(value.runs) || !Array.isArray(value.lots) || value.runs.length > 128 || value.lots.length > 128) return false;
  if (value.source === "unknown" && (value.runs.length || value.lots.length)) return false;
  if (!value.runs.every(run => record(run) && text(run.id) && nullableText(run.zoneId) && nullableText(run.zoneName)
    && text(run.varietyCode) && text(run.varietyName) && typeof run.cultivation === "string" && ["indoor", "outdoor", "unknown"].includes(run.cultivation)
    && stage(run.stageIndex) && phase(run.phase) && date(run.updatedAt) && typeof run.cultureDead === "boolean"
    && (run.lastResolved === undefined || record(run.lastResolved) && stage(run.lastResolved.stageIndex) && run.lastResolved.stageIndex <= run.stageIndex
      && text(run.lastResolved.situation) && outcome(run.lastResolved.outcome) && text(run.lastResolved.trait))
    && (run.problem === undefined || record(run.problem) && text(run.problem.symptom, 300) && typeof run.problem.status === "string" && ["suspected", "confirmed"].includes(run.problem.status)
      && (run.problem.status === "suspected" ? run.problem.diagnosis === null : text(run.problem.diagnosis))))) return false;
  if (!value.lots.every(lot => record(lot) && text(lot.id) && nullableText(lot.runId) && text(lot.varietyCode) && text(lot.varietyName)
    && typeof lot.cultivation === "string" && ["indoor", "outdoor", "unknown"].includes(lot.cultivation) && typeof lot.stage === "string" && ["curing", "ready", "unknown"].includes(lot.stage)
    && (lot.harvestGrams === null || typeof lot.harvestGrams === "number" && Number.isFinite(lot.harvestGrams) && lot.harvestGrams >= 0 && lot.harvestGrams <= 1_000_000_000)
    && (lot.remainingGrams === null || typeof lot.remainingGrams === "number" && Number.isFinite(lot.remainingGrams) && lot.remainingGrams >= 0 && lot.remainingGrams <= 1_000_000_000)
    && (lot.harvestedAt === null || date(lot.harvestedAt)))) return false;
  return new Set(value.runs.map(run => run.id)).size === value.runs.length && new Set(value.lots.map(lot => lot.id)).size === value.lots.length;
}
