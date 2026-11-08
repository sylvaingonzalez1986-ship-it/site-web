import type { KqCultureWorkQuote } from "./kanab-quest-culture-work";

export type KqProcessingMachine = {
  code: string; name: string; model: string; sourceUrl: string; specification: string;
  material: string; basis: "input" | "output" | "passive";
  quantityGrams: number; gramsPerHour: number | null; hours: number;
  estimated: boolean; note: string;
};
export type KqProcessingPlan = {
  version: 1; profileVersion: 1; inputGrams: number; nominalHours: number; passiveHours: number;
  machines: KqProcessingMachine[]; sources: Array<{ label: string; url: string }>;
  estimated: boolean; quote?: KqProcessingWorkQuote;
};
export type KqProcessingActor = KqCultureWorkQuote["employee"];
export type KqProcessingActorOption = {
  id: string; name: string; employee: KqProcessingActor; remainingHours: number; available: boolean; reason: string | null;
};
export type KqProcessingWorkQuote = {
  version: 1; flowerId: string; token: string; inputGrams: number;
  source: "employee" | "player" | "blocked"; employee: KqProcessingActor;
  efficiency: number; playerRemainingHours: number; bookedHours: number; activeHours: number;
  nominalHours: number; remainingNominalHours: number; fundedGrams: number; passiveHours: number;
  startedAt: string | null; readyAt: string | null; blockedReason: string | null;
  actorChoiceVersion?: 1; actorId?: string; actors?: KqProcessingActorOption[];
};
export type KqProcessingJob = {
  version: 1; flowerId: string; route: string; inputGrams: number; completedGrams: number;
  fundedGrams: number; remainingGrams: number; nominalHours: number; remainingNominalHours: number;
  status: "running" | "blocked" | "passive" | "completed";
  startedAt: string | null; readyAt: string | null; finalReadyAt: string | null;
  delegated: boolean; actor: KqProcessingActor; bookedHours: number; activeHours: number;
  remainingHours: number; plan: KqProcessingPlan;
};

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const finite = (value: unknown, max = 1_000_000) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= max;
const dateOrNull = (value: unknown) => value === null || typeof value === "string" && Number.isFinite(Date.parse(value));
const identifier = (value: unknown) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export const isKqProcessingActorId = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
function actor(value: unknown): boolean {
  return value === null || object(value) && ["id", "name", "code", "taskId"].every(key => typeof value[key] === "string" && !!value[key])
    && (value.portraitCode === undefined || typeof value.portraitCode === "string")
    && typeof value.role === "string" && ["worker", "grower", "processor", "commercial", "administrator"].includes(value.role)
    && Number.isInteger(value.level) && Number(value.level) >= 1 && Number(value.level) <= 10
    && ["allocatedHours", "usedHours", "remainingHours"].every(key => finite(value[key], 10) && Number.isInteger(Number(value[key]) * 2))
    && Number(value.usedHours) + Number(value.remainingHours) === value.allocatedHours;
}
export function isKqProcessingPlan(value: unknown): value is KqProcessingPlan {
  return object(value) && value.version === 1 && value.profileVersion === 1
    && finite(value.inputGrams) && Number(value.inputGrams) > 0
    && finite(value.nominalHours) && Number(value.nominalHours) > 0 && finite(value.passiveHours, 10_000)
    && typeof value.estimated === "boolean" && Array.isArray(value.machines) && value.machines.length > 0 && value.machines.length <= 12
    && value.machines.every(machine => object(machine)
      && ["code", "name", "model", "specification", "material", "note"].every(key => typeof machine[key] === "string")
      && typeof machine.sourceUrl === "string" && machine.sourceUrl.startsWith("https://")
      && typeof machine.basis === "string" && ["input", "output", "passive"].includes(machine.basis)
      && finite(machine.quantityGrams, 4_000_000) && finite(machine.hours)
      && (machine.gramsPerHour === null ? machine.basis === "passive" : finite(machine.gramsPerHour) && Number(machine.gramsPerHour) > 0)
      && typeof machine.estimated === "boolean")
    && Array.isArray(value.sources) && value.sources.every(source => object(source) && typeof source.label === "string"
      && typeof source.url === "string" && source.url.startsWith("https://"));
}
export function isKqProcessingJob(value: unknown): value is KqProcessingJob {
  return object(value) && value.version === 1 && identifier(value.flowerId) && typeof value.route === "string"
    && typeof value.status === "string" && ["running", "blocked", "passive", "completed"].includes(value.status)
    && ["inputGrams", "completedGrams", "fundedGrams", "remainingGrams", "nominalHours", "remainingNominalHours", "remainingHours"].every(key => finite(value[key]))
    && Number(value.inputGrams) > 0 && Number(value.nominalHours) > 0
    && Number(value.completedGrams) <= Number(value.fundedGrams) + 0.00001
    && Number(value.fundedGrams) <= Number(value.inputGrams) + 0.00001
    && Number(value.remainingNominalHours) <= Number(value.nominalHours)
    && finite(value.bookedHours, 12) && Number.isInteger(Number(value.bookedHours) * 2)
    && finite(value.activeHours, Number(value.bookedHours) + .00001)
    && ["startedAt", "readyAt", "finalReadyAt"].every(key => dateOrNull(value[key]))
    && typeof value.delegated === "boolean" && actor(value.actor) && isKqProcessingPlan(value.plan);
}
export function isKqProcessingWorkQuote(value: unknown): value is KqProcessingWorkQuote {
  if (!object(value) || value.version !== 1 || !identifier(value.flowerId)
    || typeof value.token !== "string" || !/^[0-9a-f]{32}$/.test(value.token)
    || typeof value.source !== "string" || !["employee", "player", "blocked"].includes(value.source)
    || !finite(value.inputGrams) || Number(value.inputGrams) <= 0
    || !finite(value.efficiency, 1) || Number(value.efficiency) <= 0
    || !finite(value.playerRemainingHours, 12) || !finite(value.bookedHours, 12) || !Number.isInteger(Number(value.bookedHours) * 2)
    || !["activeHours", "nominalHours", "remainingNominalHours", "fundedGrams", "passiveHours"].every(key => finite(value[key]))
    || Number(value.activeHours) > Number(value.bookedHours) + .00001
    || Number(value.nominalHours) > Number(value.remainingNominalHours) + .00001
    || Number(value.fundedGrams) > Number(value.inputGrams) + 0.000001
    || !dateOrNull(value.startedAt) || !dateOrNull(value.readyAt)
    || value.blockedReason !== null && typeof value.blockedReason !== "string") return false;
  if (!actor(value.employee) || (value.employee === null && value.source === "employee") || (value.employee !== null && value.source === "player")) return false;
  if (value.actorChoiceVersion === undefined && value.actorId === undefined && value.actors === undefined) return true;
  return value.actorChoiceVersion === 1 && isKqProcessingActorId(value.actorId) && Array.isArray(value.actors)
    && value.actors.length > 0 && new Set(value.actors.map(item => object(item) ? item.id : null)).size === value.actors.length
    && value.actors.some(item => object(item) && item.id === "player")
    && value.actors.every(item => object(item) && isKqProcessingActorId(item.id) && item.id !== "auto"
      && typeof item.name === "string" && !!item.name && actor(item.employee)
      && (item.id === "player" ? item.employee === null : object(item.employee) && item.employee.id === item.id)
      && finite(item.remainingHours, item.id === "player" ? 12 : 10)
      && typeof item.available === "boolean" && (item.reason === null || typeof item.reason === "string"))
    && (value.actorId === "auto" || value.source === "blocked" || (value.actorId === "player" ? value.source === "player" : object(value.employee) && value.employee.id === value.actorId));
}
