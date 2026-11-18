import type { KqStaffCommand, KqStaffState, KqTeamAssignment, KqTeamDayPlan, KqTeamPlanCommand } from "./kanab-quest-staff-types";

function requirePlan(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
const actions = ["assign", "train", "trim", "assign-production", "player-assign"];
export function getKqTeamAssignee(command: KqTeamAssignment) {
  return command.action === "player-assign" ? "player" : command.employeeId ?? "player";
}
export function getKqTeamReservedHours(plans: KqTeamDayPlan[] | undefined, assignee: string, day: number) {
  return (plans ?? []).reduce((total, entry) => total + (entry.day === day && entry.assigneeId === assignee ? entry.assignment.hours : 0), 0);
}
export function isKqTeamAssignmentCommand(command: KqStaffCommand): command is KqTeamAssignment {
  return actions.includes(command.action);
}
export function isKqTeamPlanCommand(command: KqStaffCommand): command is KqTeamPlanCommand {
  return command.action === "save-day-plan" || command.action === "remove-day-plan" || command.action === "start-day-plan" || command.action === "start-team-task";
}
export function parseKqTeamPlanCommand(body: Record<string, unknown>, parse: (value: unknown) => KqStaffCommand): KqTeamPlanCommand {
  const identifier = (value: unknown) => {
    requirePlan(typeof value === "string" && value.length > 0 && value.length <= 100, "Réservation inconnue.");
    return value;
  };
  const integer = (value: unknown, min: number) => {
    requirePlan(typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= 2_147_483_646, "Jour ou version du planning invalide.");
    return value;
  };
  const version = { expectedDay: integer(body.expectedDay, 1), expectedVersion: integer(body.expectedVersion, 0) };
  if (body.action === "start-day-plan" || body.action === "remove-day-plan") return { action: body.action, planId: identifier(body.planId), ...version };
  const nested = body.assignment;
  requirePlan(nested && typeof nested === "object" && "action" in nested && typeof nested.action === "string" && actions.includes(nested.action), "Choisis une activité du personnel.");
  const assignment = parse(nested);
  requirePlan(isKqTeamAssignmentCommand(assignment), "Activité incompatible.");
  if (body.action === "start-team-task") return { action: body.action, assignment, ...version };
  return { action: "save-day-plan", assignment, day: integer(body.day, 1), ...version,
    ...(body.planId === undefined ? {} : { planId: identifier(body.planId) }),
    ...(body.beforeId === undefined ? {} : { beforeId: body.beforeId === null ? null : identifier(body.beforeId) }) };
}

export function validateKqTeamDayState(state: KqStaffState) {
  return (state.dayPlanVersion === undefined || Number.isSafeInteger(state.dayPlanVersion) && state.dayPlanVersion >= 0)
    && (state.dayPlans === undefined || Array.isArray(state.dayPlans) && state.dayPlans.length <= 128
      && new Set(state.dayPlans.map(p => p?.id)).size === state.dayPlans.length
      && state.dayPlans.every(p => p && typeof p.id === "string" && Number.isSafeInteger(p.day) && p.day >= 1
        && p.assignment && isKqTeamAssignmentCommand(p.assignment) && getKqTeamAssignee(p.assignment) === p.assigneeId
        && Number.isFinite(p.assignment.hours) && p.assignment.hours >= 0.5 && p.assignment.hours <= 12));
}

/** Changes a server-owned draft list only. Execution uses the normal staff command. */
export function editKqTeamDayPlans(plans: KqTeamDayPlan[], command: Extract<KqTeamPlanCommand, { action: "save-day-plan" }>, id: string) {
  const original = command.planId ? plans.find(entry => entry.id === command.planId) : undefined;
  requirePlan(!command.planId || original, "Cette réservation a déjà été modifiée ou retirée.");
  const entry: KqTeamDayPlan = { id: original?.id ?? id, assigneeId: getKqTeamAssignee(command.assignment), day: command.day, assignment: command.assignment };
  if (original && command.beforeId === undefined && original.day === entry.day && original.assigneeId === entry.assigneeId) {
    return plans.map(row => row === original ? entry : row);
  }
  const next = plans.filter(row => row !== original);
  const position = command.beforeId ? next.findIndex(row => row.id === command.beforeId && row.day === entry.day && row.assigneeId === entry.assigneeId) : next.length;
  requirePlan(position >= 0, "L’ordre des tâches a changé. Relis la journée.");
  requirePlan(next.length < 128, "Le planning est complet.");
  next.splice(position, 0, entry);
  return next;
}
