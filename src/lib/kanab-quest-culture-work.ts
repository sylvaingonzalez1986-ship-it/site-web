import type { KqStaffRole } from "./kanab-quest-staff-types";

export type KqCultureWorkChoice = "auto" | "player" | `employee:${string}`;
export function isKqCultureWorkChoice(value: unknown): value is KqCultureWorkChoice {
  return value === "auto" || value === "player" || typeof value === "string" && /^employee:[a-zA-Z0-9_-]{1,128}$/.test(value);
}
export type KqCultureWorkEmployee = {
  id: string; name: string; code: string; portraitCode?: string; level: number;
  role: KqStaffRole; taskId: string; allocatedHours: number; usedHours: number; remainingHours: number;
};
export type KqCultureWorkBonus = { vitality: number; terpenes: number; yieldPercent: number; cannabinoids: number };
export type KqCultureWorkOption = {
  choice: Exclude<KqCultureWorkChoice, "auto">;
  source: "player" | "employee";
  employee: KqCultureWorkEmployee | null;
  available: boolean;
  bonus: KqCultureWorkBonus;
  reason?: string | null;
};

/** Authoritative quote/receipt for one culture stage, never a client estimate. */
export type KqCultureWorkQuote = {
  version: 1; runId: string; stageIndex: number; day: number; phase: string;
  source: "employee" | "player" | "blocked"; paid: boolean; stepHours: 0.5;
  playerRemainingHours: number;
  employee: KqCultureWorkEmployee | null;
  bonus: KqCultureWorkBonus;
  workChoice?: KqCultureWorkChoice;
  choices?: KqCultureWorkOption[];
  reason?: string | null;
};

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const halfHours = (value: unknown, max: number) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= max && Number.isInteger(value * 2);
// Skilled gestures debit hundredths of a personal hour. Only the Culture stage
// price and employee reservations remain in half-hour steps.
const playerHours = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 12
  && Math.abs(value * 100 - Math.round(value * 100)) < 1e-9;
const validBonus = (value: unknown): value is KqCultureWorkBonus => record(value)
  && ["vitality", "terpenes", "yieldPercent", "cannabinoids"].every(key => Number.isInteger(value[key]) && Number(value[key]) >= 0 && Number(value[key]) <= 100);
function validEmployee(employee: unknown): employee is KqCultureWorkEmployee {
  return record(employee) && ["id", "name", "code", "taskId"].every(key => typeof employee[key] === "string" && !!employee[key])
    && (employee.portraitCode === undefined || typeof employee.portraitCode === "string")
    && Number.isInteger(employee.level) && Number(employee.level) >= 1 && Number(employee.level) <= 10
    && typeof employee.role === "string" && ["worker", "grower", "processor", "commercial", "administrator"].includes(employee.role)
    && halfHours(employee.allocatedHours, 10) && Number(employee.allocatedHours) >= .5
    && halfHours(employee.usedHours, Number(employee.allocatedHours))
    && halfHours(employee.remainingHours, Number(employee.allocatedHours))
    && Number(employee.usedHours) + Number(employee.remainingHours) === employee.allocatedHours;
}
function validOption(value: unknown): value is KqCultureWorkOption {
  return record(value) && isKqCultureWorkChoice(value.choice) && value.choice !== "auto"
    && typeof value.available === "boolean" && validBonus(value.bonus)
    && (value.reason === undefined || value.reason === null || typeof value.reason === "string")
    && (value.choice === "player" ? value.source === "player" && value.employee === null
      : value.source === "employee" && validEmployee(value.employee) && value.choice === `employee:${value.employee.id}`);
}
export function isKqCultureWorkQuote(value: unknown): value is KqCultureWorkQuote {
  if (!record(value) || value.version !== 1 || typeof value.runId !== "string"
    || !Number.isInteger(value.stageIndex) || Number(value.stageIndex) < 0 || Number(value.stageIndex) > 5
    || !Number.isSafeInteger(value.day) || Number(value.day) < 1
    || typeof value.phase !== "string" || !["prepare", "rolled", "resolved", "complete"].includes(value.phase)
    || typeof value.source !== "string" || !["employee", "player", "blocked"].includes(value.source)
    || typeof value.paid !== "boolean" || value.stepHours !== 0.5 || !playerHours(value.playerRemainingHours)
    || !validBonus(value.bonus)
    || (value.workChoice !== undefined && !isKqCultureWorkChoice(value.workChoice))
    || (value.choices !== undefined && (!isKqCultureWorkChoice(value.workChoice) || !Array.isArray(value.choices)
      || !value.choices.every(validOption) || new Set(value.choices.map(option => option.choice)).size !== value.choices.length))
    || (value.reason !== undefined && value.reason !== null && typeof value.reason !== "string")) return false;
  const employee = value.employee;
  if (employee === null) return value.source !== "employee";
  return validEmployee(employee);
}
