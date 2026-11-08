import type { KqStaffRole } from "./kanab-quest-staff-types";

/** Authoritative quote/receipt for one culture stage, never a client estimate. */
export type KqCultureWorkQuote = {
  version: 1; runId: string; stageIndex: number; day: number; phase: string;
  source: "employee" | "player" | "blocked"; paid: boolean; stepHours: 0.5;
  playerRemainingHours: number;
  employee: null | {
    id: string; name: string; code: string; portraitCode?: string; level: number;
    role: KqStaffRole; taskId: string; allocatedHours: number; usedHours: number; remainingHours: number;
  };
  bonus: { vitality: number; terpenes: number; yieldPercent: number; cannabinoids: number };
  reason?: string | null;
};

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const halfHours = (value: unknown, max: number) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= max && Number.isInteger(value * 2);
// Skilled gestures debit hundredths of a personal hour. Only the Culture stage
// price and employee reservations remain in half-hour steps.
const playerHours = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 12
  && Math.abs(value * 100 - Math.round(value * 100)) < 1e-9;
export function isKqCultureWorkQuote(value: unknown): value is KqCultureWorkQuote {
  if (!record(value) || value.version !== 1 || typeof value.runId !== "string"
    || !Number.isInteger(value.stageIndex) || Number(value.stageIndex) < 0 || Number(value.stageIndex) > 5
    || !Number.isSafeInteger(value.day) || Number(value.day) < 1
    || typeof value.phase !== "string" || !["prepare", "rolled", "resolved", "complete"].includes(value.phase)
    || typeof value.source !== "string" || !["employee", "player", "blocked"].includes(value.source)
    || typeof value.paid !== "boolean" || value.stepHours !== 0.5 || !playerHours(value.playerRemainingHours)
    || !record(value.bonus) || !["vitality", "terpenes", "yieldPercent", "cannabinoids"].every(key =>
      typeof value.bonus === "object" && value.bonus !== null && Number.isInteger((value.bonus as Record<string, unknown>)[key])
      && Number((value.bonus as Record<string, unknown>)[key]) >= 0 && Number((value.bonus as Record<string, unknown>)[key]) <= 100)
    || (value.reason !== undefined && value.reason !== null && typeof value.reason !== "string")) return false;
  const employee = value.employee;
  if (employee === null) return value.source !== "employee";
  return record(employee) && ["id", "name", "code", "taskId"].every(key => typeof employee[key] === "string" && !!employee[key])
    && (employee.portraitCode === undefined || typeof employee.portraitCode === "string")
    && Number.isInteger(employee.level) && Number(employee.level) >= 1 && Number(employee.level) <= 10
    && typeof employee.role === "string" && ["worker", "grower", "processor", "commercial", "administrator"].includes(employee.role)
    && halfHours(employee.allocatedHours, 10) && Number(employee.allocatedHours) >= .5
    && halfHours(employee.usedHours, Number(employee.allocatedHours))
    && halfHours(employee.remainingHours, Number(employee.allocatedHours))
    && Number(employee.usedHours) + Number(employee.remainingHours) === employee.allocatedHours;
}
