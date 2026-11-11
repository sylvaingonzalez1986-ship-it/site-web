import { KQ_GAME_DAY_MS, KQ_GAME_MONTH_MS } from "./kanab-quest-business";
import { getKqStaffSharedTrimQuote, getKqStaffTrimQuote, KQ_STAFF_TRIMMER_COST_CENTS } from "./kanab-quest-staff-trim";
import { advanceKqSharedTrim, getKqSharedTrimLots } from "./kanab-quest-staff-trim-queue";
import { advanceKqStaffProduction, configureKqStaffProduction, getKqProductionCashDelta, isKqStaffProductionState } from "./kanab-quest-staff-production";
import type { KqProductionStep } from "./kanab-quest-staff-production-types";
import type { KqStaffCandidate, KqStaffCommand, KqStaffContractKind, KqStaffEffect, KqStaffEmployee, KqStaffPlanDayResult, KqStaffPlannedTask, KqStaffRawSnapshot, KqStaffRole, KqStaffSkill, KqStaffSnapshot, KqStaffState, KqStaffTask, KqStaffTaskResult, KqStaffTrait } from "./kanab-quest-staff-types";
import { getKqStaffPlannedTaskCost, getKqStaffWeeklyCost, isKqStaffWeeklyPlan, KQ_STAFF_TRAINING_HOURLY_CENTS, parseKqStaffWeeklyDays, validateKqStaffWeeklyDays } from "./kanab-quest-staff-weekly";
export type * from "./kanab-quest-staff-types";
import { getKqStaffRecruitment } from "./kanab-quest-staff-recruitment";
export { getKqStaffRecruitment, KQ_STAFF_CANDIDATES, KQ_STAFF_RECRUITMENT_DAYS } from "./kanab-quest-staff-recruitment";
import { KQ_PROSPECTING_DEPARTMENTS, KQ_STAFF_CITIES } from "./kanab-quest-prospecting";
import { getKqPlayerSkills, KQ_PLAYER_COUNTRYSIDE_COST_CENTS, KQ_PLAYER_DAILY_HOURS } from "./kanab-quest-player-work";
import { getKqStaffContractOptions, getKqStaffPersonId, getKqStaffRehireBlock, getKqStaffRoleContractBlock, isKqStaffContractHistory } from "./kanab-quest-staff-contracts";
export { KQ_STAFF_CITIES } from "./kanab-quest-prospecting";

/** French agricultural references verified 2026-11-07. Employer costs and bonuses are game estimates. */
export const KQ_STAFF_MINIMUM_HOURLY_CENTS = 1231;
export const KQ_STAFF_EMPLOYER_RATE = 0.35;
export const KQ_STAFF_ROLES: Record<KqStaffRole, string> = { worker: "Ouvrier agricole", grower: "Chef de culture", processor: "Transformateur", commercial: "Commercial & communication", administrator: "Gestionnaire administratif" };
export const KQ_STAFF_SKILLS: Record<KqStaffSkill, string> = { culture: "Culture", processing: "Transformation", communication: "Communication", sales: "Prospection", administration: "Administration" };
export const KQ_STAFF_CONTRACTS: Record<KqStaffContractKind, string> = { cdi: "CDI", cdd: "CDD — besoin temporaire", seasonal: "CDD saisonnier — récolte" };
export const KQ_STAFF_TRAITS: Record<KqStaffTrait, { label: string; description: string }> = {
  meticulous: { label: "Minutieux", description: "Culture : +20 % sur le calcul des terpènes, avec arrondi et plafond. Missions 10 % plus lentes ; chaque étape Culture garde son coût de 0,5 h. Le trim suit sa cadence propre." },
  quick: { label: "Vif", description: "Missions 15 % plus rapides ; efficacité de Transformation améliorée dans sa limite. Chaque étape Culture coûte toujours 0,5 h. Le trim suit sa cadence propre et les heures réservées restent mobilisées." },
  learner: { label: "Curieux", description: "Gagne 25 % d’expérience en plus." },
  outgoing: { label: "Sociable", description: "Prospection : +8 points de réussite ; communication : +20 % d’abonnés." },
  versatile: { label: "Touche-à-tout", description: "Un niveau d’efficacité supplémentaire dans ses cinq compétences." },
  organized: { label: "Organisé", description: "Négociation fournisseurs : +2 points de remise, dans la limite de 10 %." },
};
const WEEKDAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const SKILLS = Object.keys(KQ_STAFF_SKILLS) as KqStaffSkill[];
const HOUR_MS = KQ_GAME_DAY_MS / 24;
const round = (value: number) => Math.round(value * 100) / 100;
const at = (value: string) => Date.parse(value);
// PostgreSQL retains microseconds. Never schedule a new slot before its exact
// database timestamp when converting it to JavaScript's millisecond precision.
function slotStartAt(value: string): number {
  const fraction = value.match(/\.(\d+)(?:Z|[+-]\d{2}(?::?\d{2})?)$/i)?.[1] ?? "";
  return at(value) + (/[1-9]/.test(fraction.slice(3)) ? 1 : 0);
}
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
function number(value: unknown, min: number, max: number, step = 1): asserts value is number {
  assert(typeof value === "number" && Number.isFinite(value) && value >= min && value <= max && Number.isInteger(value / step), "Quantité ou durée invalide.");
}
export function getKqStaffLevel(experience: number) { return Math.min(10, 1 + Math.floor(Math.sqrt(Math.max(0, experience) / 100))); }
function effectiveLevel(employee: KqStaffEmployee, skill: KqStaffSkill) { return Math.min(10, getKqStaffLevel(employee.skills[skill]) + (employee.trait === "versatile" ? 1 : 0)); }
export function getKqStaffMonthlyCost(candidate: Pick<KqStaffCandidate, "hourlyCents">, hours: number) {
  const grossCents = Math.round(candidate.hourlyCents * hours * 52 / 12);
  const employerCents = Math.round(grossCents * KQ_STAFF_EMPLOYER_RATE);
  return { grossCents, employerCents, totalCents: grossCents + employerCents };
}
export function getKqStaffCalendar(startedAt: string, now: string): KqStaffSnapshot["calendar"] {
  const elapsed = Math.max(0, at(now) - at(startedAt));
  const day = Math.floor(elapsed / KQ_GAME_DAY_MS) + 1, weekday = (day - 1) % 7;
  return { day, weekday, week: Math.floor((day - 1) / 7), label: `${WEEKDAYS[weekday]} · jour ${day}`, weekend: weekday >= 5, nextDayAt: new Date(at(startedAt) + day * KQ_GAME_DAY_MS).toISOString() };
}
export function getKqStaffCapacity(employee: KqStaffEmployee, calendar: KqStaffSnapshot["calendar"]) {
  const absence = employee.leave.some(item => calendar.day >= item.startDay && calendar.day <= item.endDay);
  const baseHours = employee.status === "active" && !absence && calendar.weekday < employee.weeklyHours / 7 && !calendar.weekend ? 7 : 0;
  const record = employee.workDays[String(calendar.day)];
  const extraHours = baseHours ? record?.extraHours ?? 0 : 0, usedHours = record?.usedHours ?? 0;
  return { baseHours, extraHours, usedHours, remainingHours: Math.max(0, baseHours + extraHours - usedHours) };
}
export function getKqStaffLeave(employee: KqStaffEmployee, serverNow: string) {
  const until = Math.min(at(serverNow), employee.endsAt ? at(employee.endsAt) : Infinity);
  const earnedDays = Math.max(0, (until - at(employee.hiredAt)) / KQ_GAME_MONTH_MS * 25 / 12);
  const bookedDays = employee.leave.reduce((sum, leave) => sum + leave.days, 0);
  return { earnedDays: round(earnedDays), bookedDays, availableDays: Math.max(0, Math.floor((earnedDays - bookedDays) * 100) / 100) };
}
function leaveDays(startDay: number, endDay: number) {
  let days = 0;
  for (let day = startDay; day <= endDay; day++) if ((day - 1) % 7 < 5) days++;
  return days;
}
export function getKqStaffLeavePeriod(employee: KqStaffEmployee, startDay: number, endDay: number) {
  assert(Number.isInteger(startDay) && Number.isInteger(endDay) && startDay > 0 && endDay >= startDay && endDay - startDay <= 60, "Dates de congé invalides.");
  assert((startDay - 1) % 7 < employee.weeklyHours / 7 && (startDay - 1) % 7 < 5, "Le congé commence au premier jour qui aurait été travaillé.");
  let resumeDay = endDay + 1;
  while ((resumeDay - 1) % 7 >= employee.weeklyHours / 7 || (resumeDay - 1) % 7 >= 5) resumeDay++;
  return { startDay, endDay: resumeDay - 1, resumeDay, days: leaveDays(startDay, resumeDay - 1) };
}
export function getKqStaffLeaveDays(employee: KqStaffEmployee, startDay: number, endDay: number) { return getKqStaffLeavePeriod(employee, startDay, endDay).days; }
function weekExtras(employee: KqStaffEmployee, week: number) {
  return Object.entries(employee.workDays).reduce((sum, [day, row]) => sum + (Math.floor((Number(day) - 1) / 7) === week ? row.extraHours : 0), 0);
}
export function getKqStaffExtraQuote(employee: KqStaffEmployee, calendar: KqStaffSnapshot["calendar"], hours: number) {
  number(hours, 0.5, 3, 0.5);
  const capacity = getKqStaffCapacity(employee, calendar);
  assert(capacity.baseHours > 0, "Les heures en plus se planifient un jour travaillé, hors congé et week-end.");
  assert(capacity.baseHours + capacity.extraHours + hours <= 10, "Maximum 10 heures par jour dans ce planning.");
  const extra = weekExtras(employee, calendar.week);
  let gross: number;
  if (employee.weeklyHours < 35) {
    assert(extra + hours <= employee.weeklyHours / 3 && employee.weeklyHours + extra + hours < 35, "Les heures complémentaires restent dans le tiers du contrat et sous 35 h par semaine.");
    const first = Math.max(0, Math.min(hours, employee.weeklyHours / 10 - extra));
    gross = employee.hourlyCents * (first * 1.10 + (hours - first) * 1.25);
  } else {
    assert(35 + extra + hours <= 48, "Maximum 48 heures sur une semaine.");
    const twelveWeeks = Array.from({ length: 12 }, (_, index) => weekExtras(employee, calendar.week - index)).reduce((sum, value) => sum + value, 0);
    assert(35 + (twelveWeeks + hours) / 12 <= 44, "Le planning dépasserait 44 h en moyenne sur 12 semaines.");
    const first = Math.max(0, Math.min(hours, 8 - extra));
    gross = employee.hourlyCents * (first * 1.25 + (hours - first) * 1.50);
  }
  return Math.round(gross);
}
export function getKqStaffTrainingCost(hours: number) { number(hours, 2, 7, 0.5); return Math.round(hours * KQ_STAFF_TRAINING_HOURLY_CENTS); }
export function getKqStaffProspectChance(level: number, reputation: number, followers: number, outgoing = false) {
  return Math.round(Math.min(90, 12 + level * 4.5 + Math.min(20, Math.max(0, reputation) / 100) + Math.min(18, Math.log10(1 + Math.max(0, followers)) * 4) + (outgoing ? 8 : 0)));
}
export function canKqStaffAssignWithOutstandingPayroll(state: KqStaffState, employeeId: string, kind: KqStaffTask["kind"]) {
  const rules = state.administrationRules;
  return kind === "administration" && rules?.enabled === true && rules.payPayroll && rules.employeeId === employeeId;
}
export function createKqStaffState(now: string): KqStaffState {
  return { version: 1, employees: [], tasks: [], payroll: [], lastSettledAt: now, supplierDiscountPercent: 0, supplierDiscountUntil: null, prospecting: {}, trimmerOwned: false, playerWorkDays: {}, playerProcessingXp: 0 };
}
function validAdministrationRules(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const rules = value as NonNullable<KqStaffState["administrationRules"]>;
  return typeof rules.enabled === "boolean" && typeof rules.paySuppliers === "boolean" && typeof rules.payPayroll === "boolean"
    && (rules.employeeId === null || typeof rules.employeeId === "string" && rules.employeeId.length > 0 && rules.employeeId.length <= 100)
    && [rules.maxDailyCents, rules.cashReserveCents].every(amount => Number.isSafeInteger(amount) && amount >= 0 && amount <= 100_000_000)
    && Number.isInteger(rules.supplierDueDays) && rules.supplierDueDays >= 0 && rules.supplierDueDays <= 7
    && typeof rules.updatedAt === "string" && Number.isFinite(at(rules.updatedAt))
    && (!rules.enabled || rules.employeeId !== null && rules.maxDailyCents > 0 && (rules.paySuppliers || rules.payPayroll));
}
export function isKqStaffState(value: unknown): value is KqStaffState {
  if (!value || typeof value !== "object") return false;
  const state = value as KqStaffState;
  return state.version === 1 && Array.isArray(state.employees) && Array.isArray(state.tasks) && Array.isArray(state.payroll)
    && typeof state.lastSettledAt === "string" && Number.isFinite(at(state.lastSettledAt))
    && typeof state.supplierDiscountPercent === "number"
    && (state.production === undefined || isKqStaffProductionState(state.production))
    && (state.administrationRules === undefined || validAdministrationRules(state.administrationRules))
    && state.tasks.every(task => task && typeof task === "object"
      && (task.salesAttempts === undefined || task.kind === "sales" && Number.isInteger(task.salesAttempts)
        && task.salesAttempts >= 1 && task.salesAttempts <= (task.employeeId === "player" ? 6 : 3)
        && task.salesAttempts === Math.min(task.employeeId === "player" ? 6 : 3, Math.max(1, Math.floor(task.hours / 2))))
      && (task.cultureShift === undefined || task.cultureShift === true && task.kind === "culture" && task.skill === "culture" && task.employeeId !== "player")
      && (task.cultureUsedHours === undefined || task.cultureShift === true && Number.isFinite(task.cultureUsedHours)
        && task.cultureUsedHours >= 0 && task.cultureUsedHours <= task.hours && Number.isInteger(task.cultureUsedHours * 2))
      && (task.processingShift === undefined ? task.processingUsedHours === undefined
        : task.processingShift === true && task.kind === "processing" && task.skill === "processing" && task.employeeId !== "player"
          && typeof task.hours === "number" && Number.isFinite(task.hours) && task.hours >= 0.5 && task.hours <= 10 && Number.isInteger(task.hours * 2)
          && typeof task.processingUsedHours === "number" && Number.isFinite(task.processingUsedHours)
          && task.processingUsedHours >= 0 && task.processingUsedHours <= task.hours && Number.isInteger(task.processingUsedHours * 2)))
    && state.employees.every(employee => employee && typeof employee.id === "string" && SKILLS.every(skill => Number.isFinite(employee.skills?.[skill])) && Array.isArray(employee.leave) && employee.workDays && typeof employee.workDays === "object" && isKqStaffContractHistory(employee) && (employee.weeklyPlan === undefined || isKqStaffWeeklyPlan(employee.weeklyPlan, employee)));
}
export function projectKqStaffSnapshot(raw: KqStaffRawSnapshot): KqStaffSnapshot {
  const state = raw.state ?? createKqStaffState(raw.serverNow);
  assert(isKqStaffState(state), "État du personnel incompatible. Actualise le bureau.");
  const active = state.employees.filter(employee => employee.status === "active");
  const { candidates, recruitment } = getKqStaffRecruitment(raw.context.businessStartedAt, raw.serverNow);
  return { ...raw, state, calendar: getKqStaffCalendar(raw.context.businessStartedAt, raw.serverNow),
    recruitment, candidates: candidates.filter(candidate => !state.employees.some(employee => employee.code === candidate.code)),
    monthlyGrossCents: active.reduce((sum, employee) => sum + getKqStaffMonthlyCost(employee, employee.weeklyHours).grossCents, 0),
    monthlyEmployerCostCents: active.reduce((sum, employee) => sum + getKqStaffMonthlyCost(employee, employee.weeklyHours).totalCents, 0),
    outstandingCents: state.payroll.reduce((sum, row) => sum + row.totalCents - row.paidCents, 0),
  };
}

/** Payload whitelist: no client-authored state, skill, effect, salary, clock or user id reaches SQL. */
export function parseKqStaffCommand(raw: unknown): KqStaffCommand {
  assert(raw && typeof raw === "object" && !Array.isArray(raw), "Demande de personnel invalide.");
  const body = raw as Record<string, unknown>;
  function str(key: string, optional = false) { const value = body[key]; if (optional && value === undefined) return undefined; assert(typeof value === "string" && value.length > 0 && value.length <= 100, "Champ de personnel invalide."); return value; }
  function num(key: string) { const value = body[key]; number(value, 0, 2_147_483_647, 0.5); return value; }
  function skill(key: string) { const value = str(key)!; assert(Object.hasOwn(KQ_STAFF_SKILLS, value), "Compétence inconnue."); return value as KqStaffSkill; }
  const employeeId = () => str("employeeId")!;
  function contractTerms() {
    const contract = str("contract")!; assert(Object.hasOwn(KQ_STAFF_CONTRACTS, contract), "Contrat inconnu.");
    const reason = str("reason")!; assert(["permanent", "replacement", "temporary-increase", "harvest"].includes(reason), "Motif du contrat invalide.");
    return { contract: contract as KqStaffContractKind, reason: reason as KqStaffEmployee["reason"], weeklyHours: num("weeklyHours"), durationMonths: num("durationMonths"), expectedMonthlyCostCents: num("expectedMonthlyCostCents") };
  }
  function expectedEnd() {
    const value = str("expectedEndsAt")!;
    assert(Number.isFinite(at(value)), "Date de fin du contrat invalide.");
    return value;
  }
  switch (body.action) {
    case "set-production-rules": {
      assert(typeof body.enabled === "boolean" && (body.zoneId === null || typeof body.zoneId === "string" && body.zoneId.length > 0 && body.zoneId.length <= 100), "Choisis une zone de production.");
      assert(body.route === "flower" || body.route === "dry-sift", "Choisis la vente de fleurs ou le hash tamisé.");
      for (const field of ["maxDailyCostCents", "cashReserveCents", "expectedRevision"]) number(body[field], 0, 100_000_000);
      return { action: "set-production-rules", enabled: body.enabled, zoneId: body.zoneId as string | null, route: body.route,
        maxDailyCostCents: num("maxDailyCostCents"), cashReserveCents: num("cashReserveCents"), expectedRevision: num("expectedRevision") };
    }
    case "assign-production": {
      assert(typeof body.productionStep === "string" && ["auto", "culture", "trim", "processing", "sell"].includes(body.productionStep), "Choisis une étape de production autonome.");
      return { action: "assign-production", employeeId: employeeId(), hours: num("hours"), productionStep: body.productionStep as KqProductionStep };
    }
    case "set-administration-rules": {
      const rules = { enabled: body.enabled, employeeId: body.employeeId, paySuppliers: body.paySuppliers, payPayroll: body.payPayroll,
        maxDailyCents: body.maxDailyCents, cashReserveCents: body.cashReserveCents, supplierDueDays: body.supplierDueDays, updatedAt: "2000-01-01T00:00:00.000Z" };
      assert(validAdministrationRules(rules), "Règles administratives invalides : salarié, paiements, plafond, réserve et échéance de 0 à 7 jours requis.");
      return { action: "set-administration-rules", enabled: rules.enabled as boolean, employeeId: rules.employeeId as string | null,
        paySuppliers: rules.paySuppliers as boolean, payPayroll: rules.payPayroll as boolean, maxDailyCents: rules.maxDailyCents as number,
        cashReserveCents: rules.cashReserveCents as number, supplierDueDays: rules.supplierDueDays as number };
    }
    case "set-weekly-plan": {
      assert(typeof body.enabled === "boolean", "Choisis la gestion à la journée ou la semaine type.");
      return { action: "set-weekly-plan", employeeId: employeeId(), enabled: body.enabled, days: parseKqStaffWeeklyDays(body.days), expectedWeeklyCostCents: num("expectedWeeklyCostCents") };
    }
    case "hire": return { action: "hire", candidateCode: str("candidateCode")!, ...contractTerms() };
    case "rehire": return { action: "rehire", sourceContractId: str("sourceContractId")!, ...contractTerms() };
    case "renew-contract": {
      const months = body.months; number(months, 1, 18);
      return { action: "renew-contract", employeeId: employeeId(), months, expectedEndsAt: expectedEnd(), expectedMonthlyCostCents: num("expectedMonthlyCostCents") };
    }
    case "convert-cdi": return { action: "convert-cdi", employeeId: employeeId(), expectedEndsAt: expectedEnd(), expectedMonthlyCostCents: num("expectedMonthlyCostCents") };
    case "assign": return { action: "assign", employeeId: employeeId(), kind: skill("kind"), hours: num("hours"), ...(body.targetId !== undefined ? { targetId: str("targetId") } : {}), ...(body.cityId !== undefined ? { cityId: str("cityId") } : {}), ...(body.expectedCostCents !== undefined ? { expectedCostCents: num("expectedCostCents") } : {}) };
    case "player-assign": return { action: "player-assign", kind: body.kind === "countryside" ? "countryside" : skill("kind"), hours: num("hours"), expectedCostCents: num("expectedCostCents"),
      ...(body.targetId !== undefined ? { targetId: str("targetId") } : {}), ...(body.cityId !== undefined ? { cityId: str("cityId") } : {}), ...(body.department !== undefined ? { department: str("department") } : {}) };
    case "train": return { action: "train", employeeId: employeeId(), skill: skill("skill"), hours: num("hours"), expectedCostCents: num("expectedCostCents") };
    case "extra-hours": return { action: "extra-hours", employeeId: employeeId(), hours: num("hours"), expectedGrossCents: num("expectedGrossCents") };
    case "payroll": return { action: "payroll", expectedCents: num("expectedCents") };
    case "pay-invoice": return { action: "pay-invoice", employeeId: employeeId(), invoiceId: str("invoiceId")!, expectedCents: num("expectedCents") };
    case "leave": return { action: "leave", employeeId: employeeId(), startDay: num("startDay"), endDay: num("endDay") };
    case "cancel-leave": return { action: "cancel-leave", employeeId: employeeId(), leaveId: str("leaveId")! };
    case "buy-trimmer": return { action: "buy-trimmer", expectedCostCents: num("expectedCostCents") };
    case "trim": {
      const mode = str("mode")!; assert(mode === "manual" || mode === "machine", "Choix de trim invalide.");
      return { action: "trim", employeeId: body.employeeId === null ? null : employeeId(), ...(body.flowerId !== undefined ? { flowerId: str("flowerId")! } : {}), mode, hours: num("hours"), expectedCostCents: num("expectedCostCents") };
    }
    default: throw new Error("Action du personnel inconnue.");
  }
}

function randomFraction(id: string) {
  let hash = 2166136261;
  for (const char of id) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0) / 4294967296;
}
function isLegacyProcessingTarget(raw: KqStaffRawSnapshot, flowerId: string) {
  return raw.context.processingWorkVersion !== 1 || !raw.context.processingJobs?.some(job => job.flowerId === flowerId);
}
function hasProcessingReservationTarget(raw: KqStaffRawSnapshot, targetId: string) {
  const now = at(raw.serverNow);
  return raw.context.processingJobs?.some(job => job.flowerId === targetId && job.status !== "completed" && at(job.createdAt) <= now)
    || raw.context.processingBatches.some(batch => batch.flowerId === targetId && isLegacyProcessingTarget(raw, batch.flowerId) && at(batch.startedAt) <= now && at(batch.readyAt) > now);
}
function completeTask(state: KqStaffState, task: KqStaffTask, raw: KqStaffRawSnapshot, effects: KqStaffEffect[]) {
  if (task.kind === "production") {
    task.status = "completed";
    task.outcome = `Production autonome : ${(task.productionWorkedHours ?? 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} h effectuées sur ${task.hours} h réservées.${task.productionReason ? ` ${task.productionReason}` : ""}`;
    return;
  }
  function recordResult(result: Omit<KqStaffTaskResult, "version">) {
    // Older SQL guards allow only status/outcome to change at completion.
    if (raw.context.staffBenefitsVersion === 1) task.result = { ...task.result, ...result, version: 1 };
  }
  if (task.kind === "processing" && task.processingShift) {
    const usedHours = task.processingUsedHours ?? 0;
    const employee = state.employees.find(item => item.id === task.employeeId);
    if (usedHours > 0 && employee) employee.completedTasks++;
    task.status = "completed";
    recordResult({ processingUsedHours: usedHours });
    task.outcome = `Transformation : ${usedHours.toLocaleString("fr-FR")} h utilisées sur ${task.hours.toLocaleString("fr-FR")} h réservées. Réservation terminée pour cette journée.`;
    return;
  }
  if (task.kind === "culture" && task.cultureShift) {
    const usedHours = task.cultureUsedHours ?? 0;
    const employee = state.employees.find(item => item.id === task.employeeId);
    if (usedHours > 0 && employee) employee.completedTasks++;
    task.status = "completed";
    recordResult({ cultureUsedHours: usedHours });
    task.outcome = `Culture : ${usedHours.toLocaleString("fr-FR")} h utilisées sur ${task.hours.toLocaleString("fr-FR")} h réservées, soit ${usedHours * 2} étape${usedHours === 0.5 ? "" : "s"} accompagnée${usedHours === 0.5 ? "" : "s"}. Réservation terminée pour cette journée.`;
    return;
  }
  if (task.kind === "trim" && task.trimQueue) {
    const grams = task.trimGrams ?? 0;
    const worker = state.employees.find(row => row.id === task.employeeId);
    const productiveHours = Math.min(task.hours, grams / task.trimRateGramsPerHour!);
    const gain = Math.round(productiveHours * 12 * (worker?.trait === "learner" ? 1.25 : 1));
    const actualGain = Math.min(gain, Math.max(0, 8100 - (worker?.skills.processing ?? getKqPlayerSkills(state).processing)));
    if (grams > 0 && worker) { worker.skills.processing = Math.min(8100, worker.skills.processing + gain); worker.completedTasks++; }
    else if (grams > 0 && task.employeeId === "player") {
      state.playerSkills = getKqPlayerSkills(state);
      state.playerProcessingXp = Math.min(8100, state.playerSkills.processing + gain);
      state.playerSkills.processing = state.playerProcessingXp;
    }
    task.status = "completed";
    recordResult({ trimGrams: grams, xpGained: actualGain });
    task.outcome = `${task.trimMode === "manual" ? "Trim manuel" : "Trim mécanique"} : ${grams.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} g préparés dans l’atelier commun. +${actualGain} XP en transformation.${grams === 0 ? " Aucune récolte compatible disponible pendant ce créneau." : ""}`;
    return;
  }
  if (task.kind === "trim") {
    const lot = raw.context.trimLots?.find(row => row.flowerId === task.targetId && !row.completedAt);
    task.status = "completed";
    if (!lot || task.trimMode === undefined || task.trimWork === undefined || task.trimQualityDelta === undefined) { task.outcome = "Le lot est déjà préparé ou n’est plus disponible."; return; }
    const gain = Math.round(task.hours * 12);
    const worker = state.employees.find(row => row.id === task.employeeId);
    const actualGain = Math.min(Math.round(gain * (worker?.trait === "learner" ? 1.25 : 1)), Math.max(0, 8100 - (worker?.skills.processing ?? getKqPlayerSkills(state).processing)));
    if (worker) { worker.skills.processing = Math.min(8100, worker.skills.processing + Math.round(gain * (worker.trait === "learner" ? 1.25 : 1))); worker.completedTasks++; }
    else if (task.employeeId === "player") {
      state.playerSkills = getKqPlayerSkills(state);
      state.playerProcessingXp = Math.min(8100, state.playerSkills.processing + gain);
      state.playerSkills.processing = state.playerProcessingXp;
    }
    effects.push({ kind: "trim-work", flowerId: lot.flowerId, mode: task.trimMode, work: task.trimWork, qualityDelta: task.trimQualityDelta });
    recordResult({ xpGained: actualGain });
    task.outcome = `${task.trimMode === "manual" ? "Trim manuel" : "Trim mécanique"} : ${task.trimWork.toLocaleString("fr-FR")} unités de préparation effectuées. +${actualGain} XP en transformation.`;
    return;
  }
  const employee = state.employees.find(item => item.id === task.employeeId);
  if (!employee && task.employeeId !== "player") return;
  const level = task.skillLevel, careful = employee?.trait === "meticulous" ? 1.2 : 1;
  const gain = Math.round(task.hours * (task.kind === "training" ? 60 : 12) * (employee?.trait === "learner" ? 1.25 : 1));
  const actualGain = Math.min(gain, Math.max(0, 8100 - (employee?.skills[task.skill] ?? getKqPlayerSkills(state)[task.skill])));
  if (employee) { employee.skills[task.skill] = Math.min(8100, employee.skills[task.skill] + gain); employee.completedTasks++; }
  else {
    state.playerSkills = getKqPlayerSkills(state);
    state.playerSkills[task.skill] = Math.min(8100, state.playerSkills[task.skill] + gain);
    state.playerProcessingXp = state.playerSkills.processing;
  }
  task.status = "completed";
  recordResult({ xpGained: actualGain });
  task.outcome = `+${actualGain} XP en ${KQ_STAFF_SKILLS[task.skill].toLowerCase()}.`;
  if (task.kind === "culture") {
    if (!raw.context.activeRuns.some(run => run.id === task.targetId)) { task.outcome += " Culture déjà terminée : aucun bonus ajouté."; return; }
    effects.push({ kind: "culture", runId: task.targetId!, vitalityDelta: Math.min(10, Math.ceil(task.hours)), terpenesDelta: Math.min(5, Math.round(task.hours * level * 0.12 * careful)),
      yieldBonusDelta: Math.min(2, Math.round(task.hours * level * (employee?.role === "grower" ? 0.045 : 0.015))), cannabinoidDelta: Math.min(5, Math.round(task.hours * level * (employee?.role === "grower" ? 0.10 : 0.03))) });
    task.outcome += " Soins appliqués si la culture est toujours active ; bonus limités par son état.";
  } else if (task.kind === "processing") {
    const batch = raw.context.processingBatches.find(row => row.flowerId === task.targetId && isLegacyProcessingTarget(raw, row.flowerId) && at(row.startedAt) <= at(raw.serverNow) && at(row.readyAt) > at(raw.serverNow));
    if (!batch) { task.outcome += " Transformation déjà terminée : aucun délai à réduire."; return; }
    const secondsSaved = Math.min(3600, Math.floor(task.hours * level * 45), Math.max(0, Math.floor((at(batch.readyAt) - at(raw.serverNow)) / 1000)));
    effects.push({ kind: "processing", flowerId: batch.flowerId, secondsSaved });
    task.outcome += ` Jusqu’à ${Math.round(secondsSaved / 60)} min réelles gagnées sur le lot encore en cours.`;
  } else if (task.kind === "communication") {
    const followers = Math.min(500, Math.round(task.hours * (6 + level * 4) * (employee?.trait === "outgoing" ? 1.2 : 1)));
    effects.push({ kind: "communication", instagramFollowers: followers, reputation: Math.min(25, Math.ceil(task.hours * level / 4)) });
    recordResult({ followersOffered: followers });
    task.outcome += ` Publication terminée : jusqu’à ${followers} abonnés Instagram, dans la limite du compte.`;
  } else if (task.kind === "sales") {
    const city = KQ_STAFF_CITIES.find(row => row.id === task.cityId);
    const attempts = task.salesAttempts ?? 1;
    let contacts = 0;
    for (let attempt = 0; attempt < attempts; attempt++) {
      // Preserve the original draw for the first attempt and every legacy mission.
      if (city && randomFraction(attempt === 0 ? task.id : `${attempt}:sales:${task.id}`) * 100 < (task.successChance ?? 0)) {
        effects.push({ kind: "sales", shopPartners: 1, reputation: 5 }); contacts++;
      }
    }
    if (city && contacts) state.prospecting[city.id] = (state.prospecting[city.id] ?? 0) + contacts;
    recordResult({ salesAttempts: attempts, partnersGained: contacts, reputationGained: contacts * 5 });
    task.outcome += contacts > 0
      ? ` ${attempts} tentative${attempts > 1 ? "s" : ""} : ${contacts} boutique${contacts > 1 ? "s" : ""} partenaire${contacts > 1 ? "s" : ""} recrutée${contacts > 1 ? "s" : ""}${city ? ` à ${city.name}` : ""}.`
      : ` ${attempts} tentative${attempts > 1 ? "s" : ""} effectuée${attempts > 1 ? "s" : ""}, sans nouveau contrat cette fois.`;
  } else if (task.kind === "countryside") {
    const department = KQ_PROSPECTING_DEPARTMENTS.find(row => row.code === task.department);
    const contacts = department ? [0, 1].filter(attempt => randomFraction(`${attempt}:${task.id}`) * 100 < (task.successChance ?? 0)).length : 0;
    if (contacts) {
      effects.push({ kind: "sales", shopPartners: contacts, reputation: contacts * 5 });
      const key = `countryside-${task.department}`;
      state.prospecting[key] = (state.prospecting[key] ?? 0) + contacts;
    }
    recordResult({ salesAttempts: 2, partnersGained: contacts, reputationGained: contacts * 5 });
    task.outcome += contacts ? ` ${contacts} boutique${contacts > 1 ? "s" : ""} partenaire${contacts > 1 ? "s" : ""} recrutée${contacts > 1 ? "s" : ""} dans les campagnes : ${department!.name}.` : " Tournée des campagnes terminée, sans nouveau contrat cette fois.";
  } else if (task.kind === "administration") {
    state.supplierDiscountPercent = Math.max(state.supplierDiscountUntil && at(state.supplierDiscountUntil) > at(task.completesAt) ? state.supplierDiscountPercent : 0, Math.min(10, Math.round(level * 0.7 + (employee?.trait === "organized" ? 2 : 0))));
    state.supplierDiscountUntil = new Date(at(task.completesAt) + 7 * KQ_GAME_DAY_MS).toISOString();
    recordResult({ supplierDiscountPercent: state.supplierDiscountPercent, supplierDiscountUntil: state.supplierDiscountUntil });
    task.outcome += ` Conditions fournisseurs négociées : ${state.supplierDiscountPercent} % sur les nouvelles factures pendant 7 jours du jeu.`;
  }
}

/** Settle work already authorized, without creating a new recurring occurrence. */
function advanceKqStaffBase(raw: KqStaffRawSnapshot) {
  const state = structuredClone(raw.state ?? createKqStaffState(raw.serverNow));
  assert(isKqStaffState(state), "État du personnel incompatible. Actualise le bureau.");
  state.prospecting ??= {};
  state.trimmerOwned ??= false; state.playerWorkDays ??= {}; state.playerProcessingXp ??= 0;
  const now = at(raw.serverNow), effects: KqStaffEffect[] = [];
  assert(Number.isFinite(now) && now >= at(state.lastSettledAt), "Horloge du personnel invalide.");
  advanceKqStaffProduction(state, raw, effects);
  const finishing = state.tasks.filter(item => item.status === "running" && at(item.completesAt) <= now).sort((a, b) => at(a.completesAt) - at(b.completesAt));
  for (const task of finishing.filter(item => !item.trimQueue)) completeTask(state, task, raw, effects);
  advanceKqSharedTrim(state, raw, effects);
  for (const task of finishing.filter(item => item.trimQueue)) completeTask(state, task, raw, effects);
  for (const employee of state.employees) {
    if (employee.status === "ended" && employee.finalPaid) continue;
    const until = Math.min(now, employee.endsAt ? at(employee.endsAt) : Infinity);
    const cost = getKqStaffMonthlyCost(employee, employee.weeklyHours);
    const periods = Math.max(0, Math.floor((until - at(employee.nextPayrollAt)) / KQ_GAME_MONTH_MS) + 1);
    if (periods > 0) {
      // Each elapsed month keeps its real deadline for the accounting history.
      // All outstanding extra hours were booked before the first unpaid payday.
      for (let period = 0; period < periods; period++) {
        const dueAt = new Date(at(employee.nextPayrollAt) + period * KQ_GAME_MONTH_MS).toISOString();
        const grossCents = cost.grossCents + (period === 0 ? employee.overtimeGrossCents : 0);
        const employerCents = Math.round(grossCents * KQ_STAFF_EMPLOYER_RATE);
        state.payroll.push({ id: `${employee.id}:${dueAt}`, employeeId: employee.id, dueAt, grossCents, employerCents, indemnityCents: 0, totalCents: grossCents + employerCents, paidCents: 0 });
        employee.grossEarnedCents += grossCents;
      }
      employee.overtimeGrossCents = 0;
      const dueAt = new Date(at(employee.nextPayrollAt) + (periods - 1) * KQ_GAME_MONTH_MS).toISOString();
      employee.paidUntil = dueAt; employee.nextPayrollAt = new Date(at(dueAt) + KQ_GAME_MONTH_MS).toISOString();
    }
    if (employee.endsAt && now >= at(employee.endsAt) && !employee.finalPaid) {
      const grossCents = Math.round(cost.grossCents * Math.max(0, at(employee.endsAt) - at(employee.paidUntil)) / KQ_GAME_MONTH_MS) + employee.overtimeGrossCents;
      employee.grossEarnedCents += grossCents; employee.overtimeGrossCents = 0;
      const earnedLeave = Math.max(0, (at(employee.endsAt) - at(employee.hiredAt)) / KQ_GAME_MONTH_MS * 25 / 12);
      const remainingLeave = Math.max(0, earnedLeave - employee.leave.reduce((sum, row) => sum + row.days, 0));
      const endBonus = employee.contract === "cdd" ? Math.round(employee.grossEarnedCents * 0.10) : 0;
      const indemnityCents = endBonus + Math.round(Math.max((employee.grossEarnedCents + endBonus) * 0.10 * (earnedLeave > 0 ? remainingLeave / earnedLeave : 0), cost.grossCents / (260 / 12) * remainingLeave));
      const employerCents = Math.round((grossCents + indemnityCents) * KQ_STAFF_EMPLOYER_RATE);
      state.payroll.push({ id: `${employee.id}:end`, employeeId: employee.id, dueAt: employee.endsAt, grossCents, employerCents, indemnityCents, totalCents: grossCents + employerCents + indemnityCents, paidCents: 0 });
      employee.status = "ended"; employee.finalPaid = true;
    }
  }
  if (state.supplierDiscountUntil && at(state.supplierDiscountUntil) <= now) { state.supplierDiscountUntil = null; state.supplierDiscountPercent = 0; }
  const currentWeek = getKqStaffCalendar(raw.context.businessStartedAt, raw.serverNow).week;
  state.playerWorkDays = Object.fromEntries(Object.entries(state.playerWorkDays).filter(([day]) => Math.floor((Number(day) - 1) / 7) >= currentWeek - 1));
  for (const employee of state.employees) {
    employee.workDays = Object.fromEntries(Object.entries(employee.workDays).filter(([day]) => Math.floor((Number(day) - 1) / 7) >= currentWeek - 11));
  }
  // Once the archive is installed, SQL saves every finished row before reducing
  // the live window. Older deployments keep their existing bounded snapshot.
  if (raw.archiveCount === undefined) {
    state.tasks = [...state.tasks.filter(task => task.status === "completed").slice(-200), ...state.tasks.filter(task => task.status === "running")];
    state.payroll = [...state.payroll.filter(row => row.paidCents === row.totalCents).slice(-120), ...state.payroll.filter(row => row.paidCents < row.totalCents)];
  }
  state.lastSettledAt = raw.serverNow;
  return { state, effects };
}

function validateKqStaffContractTerms(candidate: KqStaffCandidate, command: Extract<KqStaffCommand, { action: "hire" | "rehire" }>) {
  assert([7, 14, 21, 28, 35].includes(command.weeklyHours), "Choisis 7, 14, 21, 28 ou 35 heures par semaine.");
  assert(candidate.contracts.includes(command.contract), "Ce candidat n’accepte pas ce contrat.");
  assert(candidate.role !== "grower" || command.contract === "cdi" && command.weeklyHours === 35, "Le poste de chef de culture proposé est un CDI à 35 h.");
  assert(command.contract === "cdi" ? command.reason === "permanent" && command.durationMonths === 0 : command.contract === "seasonal" ? command.reason === "harvest" && [1, 2, 3, 6].includes(command.durationMonths) : ["replacement", "temporary-increase"].includes(command.reason) && [3, 6, 12].includes(command.durationMonths), "Le contrat doit préciser un motif et une durée adaptés.");
  assert(command.expectedMonthlyCostCents === getKqStaffMonthlyCost(candidate, command.weeklyHours).totalCents, "Le coût du contrat a changé. Relis la proposition.");
}

/**
 * The backend persists settlement before these amendments. Continuous shared
 * trim must retain its own progress stamp between that read and this commit:
 * advancing it again would mix new work/effects into the contract transaction.
 */
function settledKqStaffContractState(raw: KqStaffRawSnapshot) {
  const state = structuredClone(raw.state ?? createKqStaffState(raw.serverNow));
  assert(isKqStaffState(state), "État du personnel incompatible. Actualise le bureau.");
  assert(Number.isFinite(at(raw.serverNow)) && at(raw.serverNow) >= at(state.lastSettledAt), "Horloge du personnel invalide.");
  state.lastSettledAt = raw.serverNow;
  return { state, effects: [] as KqStaffEffect[] };
}

/** IDs come from server crypto.randomUUID, independent of the client's replay key. */
function applyKqStaffManualCommand(raw: KqStaffRawSnapshot, command: KqStaffCommand, id: string) {
  const contractAction = command.action === "renew-contract" || command.action === "convert-cdi" || command.action === "rehire";
  const advanced = contractAction ? settledKqStaffContractState(raw) : advanceKqStaffBase(raw), { state, effects } = advanced;
  const calendar = getKqStaffCalendar(raw.context.businessStartedAt, raw.serverNow);
  let debitCents = 0;
  const unpaid = () => state.payroll.reduce((sum, row) => sum + row.totalCents - row.paidCents, 0);
  const employee = "employeeId" in command ? state.employees.find(row => row.id === command.employeeId && row.status === "active") : undefined;
  if ("employeeId" in command && command.employeeId !== null) assert(employee, "Ce salarié n’a plus de contrat actif.");
  function consume(hours: number) {
    assert(employee, "Salarié introuvable."); number(hours, 0.5, 10, 0.5);
    const payrollAdministration = raw.context.staffBenefitsVersion === 1 && command.action === "assign"
      && canKqStaffAssignWithOutstandingPayroll(state, employee.id, command.kind);
    assert(unpaid() === 0 || payrollAdministration, "Règle les salaires échus avant de programmer de nouvelles tâches.");
    const capacity = getKqStaffCapacity(employee, calendar);
    assert(capacity.remainingHours >= hours, calendar.weekend ? "Repos le samedi et le dimanche." : "Pas assez d’heures disponibles : vérifie le planning et les congés.");
    const record = employee.workDays[String(calendar.day)] ?? { usedHours: 0, extraHours: 0 };
    record.usedHours += hours; employee.workDays[String(calendar.day)] = record;
  }
  function consumePlayer(hours: number) {
    number(hours, 0.5, KQ_PLAYER_DAILY_HOURS, 0.5);
    const today = state.playerWorkDays[String(calendar.day)] ?? { usedHours: 0 };
    assert(today.usedHours + hours <= KQ_PLAYER_DAILY_HOURS, "Tes 12 h de travail personnel sont partagées entre toutes les activités. Reprends au prochain jour du jeu.");
    state.playerWorkDays[String(calendar.day)] = { ...today, usedHours: today.usedHours + hours };
  }
  if (command.action === "set-production-rules") {
    assert(raw.context.productionVersion === 1, "La production autonome nécessite la mise à jour de Personnel.");
    configureKqStaffProduction(state, raw, command);
  } else if (command.action === "assign-production") {
    assert(employee && raw.context.productionVersion === 1 && state.production?.facility, "Configure d’abord la production autonome.");
    number(command.hours, 0.5, 7, 0.5);
    assert(!state.tasks.some(task => task.employeeId === employee.id && task.day === calendar.day && (task.cultureShift || task.processingShift)), "Ce salarié accompagne déjà les cultures jouées aujourd’hui. Prévois la production autonome un autre jour.");
    consume(command.hours);
    const queuedUntil = Math.max(slotStartAt(raw.serverNow), ...state.tasks.filter(task => task.employeeId === employee.id && task.status === "running").map(task => slotStartAt(task.completesAt)));
    const completesAt = new Date(queuedUntil + command.hours * HOUR_MS).toISOString();
    assert(at(completesAt) <= at(calendar.nextDayAt) && (!employee.endsAt || at(completesAt) <= at(employee.endsAt)), "Le créneau dépasserait la journée ou la fin du contrat.");
    const productionSalaryCents = Math.round(getKqStaffMonthlyCost(employee, employee.weeklyHours).totalCents * 7 / (30 * employee.weeklyHours) * command.hours);
    state.production.stats.salaryCostCents += productionSalaryCents;
    state.tasks.push({ id, employeeId: employee.id, kind: "production", skill: "culture", skillLevel: effectiveLevel(employee, "culture"),
      hours: command.hours, startedAt: new Date(queuedUntil).toISOString(), completesAt, day: calendar.day, status: "running", trainingCostCents: 0,
      productionStep: command.productionStep, productionSkills: { culture: effectiveLevel(employee, "culture"), processing: effectiveLevel(employee, "processing"), sales: effectiveLevel(employee, "sales") },
      productionTrait: employee.trait, productionWorkedHours: 0, productionSalaryCents });
  } else if (command.action === "set-administration-rules") {
    assert(raw.context.staffBenefitsVersion === 1, "La gestion administrative nécessite la mise à jour de Personnel.");
    const validated = parseKqStaffCommand(command) as Extract<KqStaffCommand, { action: "set-administration-rules" }>;
    const { action: ignoredAction, ...rules } = validated;
    void ignoredAction;
    const previous = state.administrationRules;
    const changed = !previous || Object.entries(rules).some(([key, value]) => previous[key as keyof typeof rules] !== value);
    if (changed) state.administrationRules = { ...rules, updatedAt: state.lastSettledAt };
  } else if (command.action === "set-weekly-plan") {
    assert(employee, "Salarié introuvable.");
    assert(typeof command.enabled === "boolean", "Choisis la gestion à la journée ou la semaine type.");
    assert(raw.context.weeklyPlanVersion === 1, "Le planning hebdomadaire nécessite la mise à jour de Personnel.");
    const days = parseKqStaffWeeklyDays(command.days);
    validateKqStaffWeeklyDays(days, employee);
    assert(!days.flat().some(task => task.kind === "production") || raw.context.productionVersion === 1 && !!state.production?.facility, "Configure d’abord le circuit de production autonome.");
    const cost = getKqStaffWeeklyCost(days);
    assert(Number.isSafeInteger(command.expectedWeeklyCostCents) && command.expectedWeeklyCostCents === cost, "Le budget de la semaine a changé. Relis le planning.");
    assert(!command.enabled || days.some(day => day.length), "Ajoute au moins une activité avant d’activer la semaine type.");
    employee.weeklyPlan = { enabled: command.enabled, days: days.map(day => day.map(task => ({ ...task, costCents: getKqStaffPlannedTaskCost(task) }))), nextDay: calendar.day + 1, updatedAt: raw.serverNow, weeklyCostCents: cost, history: employee.weeklyPlan?.history ?? [] };
  } else if (command.action === "buy-trimmer") {
    assert(!state.trimmerOwned, "La ferme possède déjà une machine de trim.");
    assert(command.expectedCostCents === KQ_STAFF_TRIMMER_COST_CENTS, "Le prix de la machine a changé.");
    debitCents = KQ_STAFF_TRIMMER_COST_CENTS; state.trimmerOwned = true;
  } else if (command.action === "trim" && raw.context.trimQueueVersion === 2) {
    assert(command.expectedCostCents === 0, "La préparation n’a pas de frais supplémentaires hors salaires et achat de la machine.");
    assert(command.mode !== "machine" || state.trimmerOwned, "Achète d’abord la machine de trim commune.");
    const legacyTargets = new Set(state.tasks.filter(task => task.kind === "trim" && !task.trimQueue && task.status === "running").map(task => task.targetId));
    const available = getKqSharedTrimLots(raw, effects).some(lot => !lot.completedAt && lot.completedGrams < lot.totalGrams
      && !legacyTargets.has(lot.flowerId) && (lot.mode === null || lot.mode === command.mode));
    assert(available, "Aucune récolte disponible pour ce mode de trim. Les préparations déjà commencées conservent leur mode.");
    const level = employee ? effectiveLevel(employee, "processing") : getKqStaffLevel(getKqPlayerSkills(state).processing);
    const quote = getKqStaffSharedTrimQuote({ mode: command.mode, hours: command.hours, level, trait: employee?.trait });
    const workerId = employee?.id ?? "player";
    const queuedUntil = Math.max(at(raw.serverNow), ...state.tasks.filter(task => task.employeeId === workerId && task.status === "running" && !task.cultureShift && !task.processingShift).map(task => at(task.completesAt)));
    const startedAt = new Date(queuedUntil).toISOString(), completesAt = new Date(queuedUntil + quote.durationMs).toISOString();
    assert(at(completesAt) <= at(calendar.nextDayAt), "Il reste trop peu de temps aujourd’hui pour cette préparation.");
    if (employee) { assert(!employee.endsAt || at(completesAt) <= at(employee.endsAt), "Le trim dépasserait la fin du contrat."); consume(command.hours); }
    else consumePlayer(command.hours);
    state.tasks.push({ id, employeeId: workerId, kind: "trim", skill: "processing", skillLevel: level, hours: command.hours, day: calendar.day,
      startedAt, completesAt, status: "running", trainingCostCents: 0, trimQueue: true,
      trimMode: command.mode, trimRateGramsPerHour: quote.gramsPerHour, trimProgressAt: startedAt, trimGrams: 0,
      trimContributions: [], trimQualityDelta: quote.qualityDelta });
  } else if (command.action === "trim") {
    assert(command.flowerId, "Le trim commun nécessite la mise à jour de l’Atelier. Actualise avant de recommencer.");
    assert(command.expectedCostCents === 0, "La préparation n’a pas de frais supplémentaires hors salaires et achat de la machine.");
    const lot = raw.context.trimLots?.find(row => row.flowerId === command.flowerId && !row.completedAt);
    assert(lot, "Ce lot n’attend pas de trim.");
    assert(!state.tasks.some(task => task.kind === "trim" && task.targetId === lot.flowerId && task.status === "running"), "Un trim est déjà en cours sur ce lot.");
    // A newly completed task is not reflected in the pre-commit context yet.
    const pending = effects.filter(effect => effect.kind === "trim-work" && effect.flowerId === lot.flowerId);
    const completedWork = lot.completedWork + pending.reduce((sum, effect) => sum + (effect.kind === "trim-work" ? effect.work : 0), 0);
    const lockedMode = lot.mode ?? (pending.find(effect => effect.kind === "trim-work") as Extract<KqStaffEffect, { kind: "trim-work" }> | undefined)?.mode ?? null;
    assert(command.mode !== "machine" || state.trimmerOwned, "Achète d’abord la machine de trim commune.");
    const level = employee ? effectiveLevel(employee, "processing") : getKqStaffLevel(state.playerProcessingXp);
    const quote = getKqStaffTrimQuote({ lot: { ...lot, completedWork, mode: lockedMode }, mode: command.mode, hours: command.hours, level, trait: employee?.trait });
    const workerId = employee?.id ?? "player";
    const queuedUntil = Math.max(at(raw.serverNow), ...state.tasks.filter(task => task.employeeId === workerId && task.status === "running" && !task.cultureShift && !task.processingShift).map(task => at(task.completesAt)));
    const completesAt = new Date(queuedUntil + quote.durationMs).toISOString();
    assert(at(completesAt) <= at(calendar.nextDayAt), "Il reste trop peu de temps aujourd’hui pour cette préparation.");
    if (employee) { assert(!employee.endsAt || at(completesAt) <= at(employee.endsAt), "Le trim dépasserait la fin du contrat."); consume(command.hours); }
    else consumePlayer(command.hours);
    state.tasks.push({ id, employeeId: workerId, kind: "trim", skill: "processing", skillLevel: level, hours: command.hours, day: calendar.day, startedAt: new Date(queuedUntil).toISOString(), completesAt, status: "running", trainingCostCents: 0,
      targetId: lot.flowerId, trimMode: command.mode, trimWork: quote.work, trimQualityDelta: quote.qualityDelta });
  } else if (command.action === "player-assign") {
    const kind = command.kind;
    assert(kind === "countryside" || Object.hasOwn(KQ_STAFF_SKILLS, kind), "Activité personnelle inconnue.");
    consumePlayer(command.hours);
    const skill = kind === "countryside" ? "sales" : kind;
    const level = getKqStaffLevel(getKqPlayerSkills(state)[skill]);
    const queuedUntil = Math.max(at(raw.serverNow), ...state.tasks.filter(task => task.employeeId === "player" && task.status === "running" && !task.cultureShift && !task.processingShift).map(task => at(task.completesAt)));
    const completesAt = new Date(queuedUntil + command.hours * HOUR_MS).toISOString();
    assert(at(completesAt) <= at(calendar.nextDayAt), "Il reste trop peu de temps dans ce jour du jeu. Réduis la mission ou reviens à la prochaine journée.");
    const task: KqStaffTask = { id, employeeId: "player", kind, skill, skillLevel: level, hours: command.hours, day: calendar.day,
      startedAt: new Date(queuedUntil).toISOString(), completesAt, status: "running", trainingCostCents: 0 };
    if (kind === "culture") {
      assert(raw.context.activeRuns.some(run => run.id === command.targetId), "Choisis une culture active."); task.targetId = command.targetId;
    } else if (kind === "processing") {
      assert(command.targetId === undefined || isLegacyProcessingTarget(raw, command.targetId), "Les nouvelles transformations utilisent ta journée de travail depuis l’Atelier.");
      assert(raw.context.processingBatches.some(batch => batch.flowerId === command.targetId && at(batch.startedAt) <= at(raw.serverNow) && at(batch.readyAt) > at(completesAt)), "Choisis un lot déjà en transformation qui sera encore en cours à la fin de la mission."); task.targetId = command.targetId;
    } else if (kind === "sales") {
      const city = KQ_STAFF_CITIES.find(row => row.id === command.cityId);
      assert(city, "Choisis une ville dans un département breton.");
      assert(command.hours >= 2, "Une tournée de prospection demande au moins deux heures.");
      debitCents = city.travelCents; task.cityId = city.id;
      if (raw.context.staffBenefitsVersion === 1) task.salesAttempts = Math.min(6, Math.max(1, Math.floor(command.hours / 2)));
      task.successChance = Math.round(Math.min(90, getKqStaffProspectChance(level, raw.context.reputation, raw.context.instagramFollowers) + city.prospectIntensity / 2));
    } else if (kind === "countryside") {
      assert(command.hours === KQ_PLAYER_DAILY_HOURS, "Sillonner les campagnes réserve une journée entière de 12 h.");
      assert(KQ_PROSPECTING_DEPARTMENTS.some(department => department.code === command.department), "Choisis un des quatre départements bretons.");
      task.department = command.department; debitCents = KQ_PLAYER_COUNTRYSIDE_COST_CENTS;
      task.successChance = getKqStaffProspectChance(level, raw.context.reputation, raw.context.instagramFollowers);
    }
    assert(command.expectedCostCents === debitCents, "Le budget de cette activité a changé. Relis la proposition.");
    state.tasks.push(task);
  } else if (command.action === "renew-contract" || command.action === "convert-cdi") {
    assert(raw.context.contractLifecycleVersion === 1, "La gestion des contrats nécessite la mise à jour de Personnel.");
    assert(employee, "Salarié introuvable.");
    assert(employee.endsAt === command.expectedEndsAt, "La date de fin du contrat a changé. Actualise avant de confirmer.");
    assert(command.expectedMonthlyCostCents === getKqStaffMonthlyCost(employee, employee.weeklyHours).totalCents, "Le coût du contrat a changé. Relis la proposition.");
    const options = getKqStaffContractOptions(employee, raw.serverNow);
    if (command.action === "renew-contract") {
      number(command.months, 1, 18);
      assert(options.canRenew, options.reason ?? "Ce contrat ne peut plus être renouvelé.");
      assert(command.months <= options.remainingMonths, `La durée totale ne peut pas dépasser ${options.maxMonths} mois de jeu.`);
      const previousEndsAt = employee.endsAt!;
      employee.endsAt = new Date(at(previousEndsAt) + command.months * KQ_GAME_MONTH_MS).toISOString();
      employee.renewals = [...(employee.renewals ?? []), { at: raw.serverNow, previousEndsAt, endsAt: employee.endsAt }];
    } else {
      assert(options.canConvert, options.reason ?? "Cette personne n’accepte pas le CDI.");
      employee.contract = "cdi"; employee.reason = "permanent"; employee.endsAt = null; employee.convertedToCdiAt = raw.serverNow;
    }
  } else if (command.action === "rehire") {
    assert(raw.context.contractLifecycleVersion === 1, "La réembauche nécessite la mise à jour de Personnel.");
    const source = state.employees.find(row => row.id === command.sourceContractId)
      ?? (raw.context.rehireSource?.id === command.sourceContractId ? raw.context.rehireSource : undefined);
    assert(source, "Ce contrat précédent n’est pas disponible. Actualise les anciens dossiers.");
    const block = getKqStaffRehireBlock({ ...raw, state }, source, command.contract);
    assert(!block, block ?? "Réembauche indisponible.");
    validateKqStaffContractTerms(source, command);
    assert(!state.employees.some(row => row.id === id) && id !== source.id, "Le nouveau contrat doit avoir un identifiant distinct.");
    const profile: KqStaffCandidate = {
      code: source.code, name: source.name, role: source.role, trait: source.trait, biography: source.biography,
      ...(source.portraitCode !== undefined ? { portraitCode: source.portraitCode } : {}),
      hourlyCents: source.hourlyCents, classification: source.classification, skills: structuredClone(source.skills), contracts: [...source.contracts],
    };
    // Recent hours belong to the person: rehiring cannot restore today's
    // allowance or erase the rolling twelve-week overtime record.
    const workDays = structuredClone(Object.fromEntries(Object.entries(source.workDays)
      .filter(([day]) => Math.floor((Number(day) - 1) / 7) >= calendar.week - 11)));
    state.employees.push({ ...profile, id, personId: getKqStaffPersonId(source), previousContractId: source.id, renewals: [],
      contract: command.contract, weeklyHours: command.weeklyHours, reason: command.reason, hiredAt: raw.serverNow,
      endsAt: command.contract === "cdi" ? null : new Date(at(raw.serverNow) + command.durationMonths * KQ_GAME_MONTH_MS).toISOString(), status: "active",
      nextPayrollAt: new Date(at(raw.serverNow) + KQ_GAME_MONTH_MS).toISOString(), paidUntil: raw.serverNow,
      grossEarnedCents: 0, overtimeGrossCents: 0, finalPaid: false, workDays, leave: [], completedTasks: 0 });
  } else if (command.action === "hire") {
    const candidate = getKqStaffRecruitment(raw.context.businessStartedAt, raw.serverNow).candidates.find(row => row.code === command.candidateCode);
    assert(candidate && !state.employees.some(row => row.code === candidate.code), "Ce candidat n’est plus disponible. Les candidatures changent tous les 15 jours de jeu ; ferme cette proposition et actualise les dossiers.");
    assert(state.employees.filter(row => row.status === "active").length < 8, "L’équipe peut accueillir huit salariés au maximum.");
    validateKqStaffContractTerms(candidate, command);
    const block = getKqStaffRoleContractBlock({ ...raw, state }, candidate.role, command.contract);
    assert(!block, block ?? "Ce poste n’est pas disponible.");
    assert(unpaid() === 0, "Règle les salaires échus avant une nouvelle embauche.");
    state.employees.push({ ...structuredClone(candidate), id, ...(raw.context.contractLifecycleVersion === 1 ? { personId: id, renewals: [] } : {}), contract: command.contract, weeklyHours: command.weeklyHours, reason: command.reason, hiredAt: raw.serverNow,
      endsAt: command.contract === "cdi" ? null : new Date(at(raw.serverNow) + command.durationMonths * KQ_GAME_MONTH_MS).toISOString(), status: "active",
      nextPayrollAt: new Date(at(raw.serverNow) + KQ_GAME_MONTH_MS).toISOString(), paidUntil: raw.serverNow,
      grossEarnedCents: 0, overtimeGrossCents: 0, finalPaid: false, workDays: {}, leave: [], completedTasks: 0 });
  } else if (command.action === "assign" || command.action === "train") {
    assert(employee, "Salarié introuvable.");
    number(command.hours, command.action === "train" ? 2 : 0.5, 7, 0.5);
    const kind = command.action === "train" ? "training" : command.kind;
    assert((kind !== "culture" && kind !== "processing") || !state.tasks.some(task => task.employeeId === employee.id && task.day === calendar.day && task.kind === "production"), "Ce salarié est réservé à la production autonome aujourd’hui. Prévois l’accompagnement un autre jour.");
    const skill = command.action === "train" ? command.skill : command.kind;
    assert(Object.hasOwn(KQ_STAFF_SKILLS, skill), "Compétence inconnue.");
    consume(command.hours);
    const level = effectiveLevel(employee, skill);
    const cultureShift = kind === "culture" && raw.context.cultureWorkVersion === 1;
    const processingShift = kind === "processing" && raw.context.processingWorkVersion === 1;
    const reservation = cultureShift || processingShift;
    const queuedUntil = reservation ? at(raw.serverNow) : Math.max(at(raw.serverNow), ...state.tasks.filter(row => row.employeeId === employee.id && row.status === "running" && !row.cultureShift && !row.processingShift).map(row => at(row.completesAt)));
    const speed = kind === "training" ? 1 : (1 + (level - 1) * 0.025) * (employee.trait === "quick" ? 1.15 : employee.trait === "meticulous" ? 1 / 1.10 : 1);
    const completesAt = reservation ? calendar.nextDayAt : new Date(queuedUntil + command.hours * HOUR_MS / speed).toISOString();
    assert(at(completesAt) <= at(calendar.nextDayAt), "Il reste trop peu de temps aujourd’hui. Réduis la mission ou reprends au prochain jour travaillé.");
    assert(!employee.endsAt || at(completesAt) <= at(employee.endsAt), "La mission dépasserait la fin du contrat.");
    const task: KqStaffTask = { id, employeeId: employee.id, kind, skill, hours: command.hours, day: calendar.day, startedAt: new Date(queuedUntil).toISOString(), completesAt, status: "running", trainingCostCents: 0, skillLevel: level };
    if (command.action === "train") { assert(getKqStaffLevel(employee.skills[skill]) < 10, "Cette compétence est déjà au niveau maximal."); debitCents = getKqStaffTrainingCost(command.hours); assert(command.expectedCostCents === debitCents, "Le coût de formation a changé."); task.trainingCostCents = debitCents; }
    else if (kind === "culture") {
      assert(cultureShift && command.targetId === undefined || raw.context.activeRuns.some(run => run.id === command.targetId), "Choisis une culture active.");
      if (command.targetId !== undefined) task.targetId = command.targetId;
      if (cultureShift) { task.cultureShift = true; task.cultureUsedHours = 0; }
    }
    else if (kind === "processing") {
      if (processingShift) {
        assert(command.targetId === undefined || hasProcessingReservationTarget(raw, command.targetId), "Choisis une transformation active ou réserve pour toutes les transformations.");
        task.processingShift = true; task.processingUsedHours = 0;
      } else {
        assert(raw.context.processingBatches.some(batch => batch.flowerId === command.targetId && at(batch.startedAt) <= at(raw.serverNow) && at(batch.readyAt) > at(completesAt)), "Choisis un lot déjà en transformation qui sera encore en cours à la fin de la mission.");
      }
      if (command.targetId !== undefined) task.targetId = command.targetId;
    }
    else if (kind === "sales") {
      const city = KQ_STAFF_CITIES.find(row => row.id === command.cityId);
      assert(city, "Choisis une ville dans un département breton."); assert(command.hours >= 2, "Une tournée de prospection demande au moins deux heures.");
      debitCents = city.travelCents; task.cityId = city.id;
      if (raw.context.staffBenefitsVersion === 1) task.salesAttempts = Math.min(3, Math.max(1, Math.floor(command.hours / 2)));
      assert(command.expectedCostCents === debitCents, "Le budget de déplacement a changé. Relis la proposition.");
      task.successChance = Math.round(Math.min(90, getKqStaffProspectChance(level, raw.context.reputation, raw.context.instagramFollowers, employee.trait === "outgoing") + city.prospectIntensity / 2));
    }
    state.tasks.push(task);
  } else if (command.action === "extra-hours") {
    assert(employee, "Salarié introuvable.");
    const gross = getKqStaffExtraQuote(employee, calendar, command.hours);
    assert(gross === command.expectedGrossCents, "Le coût des heures en plus a changé.");
    const record = employee.workDays[String(calendar.day)] ?? { usedHours: 0, extraHours: 0 };
    record.extraHours += command.hours; employee.workDays[String(calendar.day)] = record;
    employee.overtimeGrossCents += gross;
  } else if (command.action === "leave") {
    assert(employee, "Salarié introuvable."); number(command.startDay, calendar.day + 1, calendar.day + 365); number(command.endDay, command.startDay, command.startDay + 60);
    const period = getKqStaffLeavePeriod(employee, command.startDay, command.endDay), days = period.days;
    assert(days > 0, "Un week-end de repos ne consomme aucun congé.");
    assert(days <= getKqStaffLeave(employee, raw.serverNow).availableDays, "Le solde de congés acquis est insuffisant.");
    assert(!employee.leave.some(row => row.startDay <= period.endDay && row.endDay >= command.startDay), "Ces dates recouvrent un congé déjà prévu.");
    assert(!employee.endsAt || at(raw.context.businessStartedAt) + period.endDay * KQ_GAME_DAY_MS <= at(employee.endsAt), "Le congé dépasse la fin du contrat.");
    employee.leave.push({ id, startDay: command.startDay, endDay: period.endDay, days });
  } else if (command.action === "cancel-leave") {
    assert(employee, "Salarié introuvable."); const absence = employee.leave.find(row => row.id === command.leaveId);
    assert(absence && absence.startDay > calendar.day, "Seul un congé à venir peut être replanifié.");
    employee.leave = employee.leave.filter(row => row.id !== command.leaveId);
  } else if (command.action === "payroll") {
    debitCents = unpaid(); assert(debitCents > 0 && command.expectedCents === debitCents, "Le total des salaires a changé. Actualise avant de payer.");
    for (const row of state.payroll) row.paidCents = row.totalCents;
  } else if (command.action === "pay-invoice") {
    assert(employee, "Salarié introuvable.");
    const invoice = raw.context.supplierInvoices.find(row => row.id === command.invoiceId);
    assert(invoice && invoice.remainingCents === command.expectedCents && invoice.remainingCents > 0, "La facture a changé. Actualise avant de payer.");
    assert(!state.tasks.some(task => task.employeeId === employee.id && task.status === "running" && !task.cultureShift && !task.processingShift), "Ce salarié termine d’abord sa mission en cours.");
    consume(0.5); assert(raw.cashCents >= invoice.remainingCents, "Trésorerie insuffisante pour cette facture.");
    employee.skills.administration = Math.min(8100, employee.skills.administration + 6);
    employee.completedTasks++;
    effects.push({ kind: "supplier-payment", invoiceId: invoice.id, amountCents: invoice.remainingCents });
  }
  assert(Number.isSafeInteger(debitCents) && debitCents <= raw.cashCents + getKqProductionCashDelta(effects), "Trésorerie insuffisante pour cette opération.");
  return { state, effects, debitCents };
}

/** A cursor is consumed even when its occurrence cannot run; missed work never revives later. */
export function hasDueKqStaffWeeklyWork(raw: KqStaffRawSnapshot) {
  if (!raw.state?.employees.some(employee => employee.status === "active" && employee.weeklyPlan?.enabled)) return false;
  const day = getKqStaffCalendar(raw.context.businessStartedAt, raw.serverNow).day;
  return !!raw.state?.employees.some(employee => employee.status === "active" && employee.weeklyPlan?.enabled && employee.weeklyPlan.nextDay <= day);
}

function weeklyContext(raw: KqStaffRawSnapshot, effects: KqStaffEffect[], through: string): KqStaffRawSnapshot["context"] {
  const time = at(through);
  const communication = effects.filter(effect => effect.kind === "communication");
  const sales = effects.filter(effect => effect.kind === "sales");
  return {
    ...raw.context,
    // A culture created after an occurrence cannot be assigned retroactively.
    activeRuns: raw.context.activeRuns.filter(run => run.startedAt && at(run.startedAt) <= time),
    processingJobs: raw.context.processingJobs?.filter(job => at(job.createdAt) <= time),
    processingBatches: raw.context.processingBatches.map(batch => ({ ...batch, readyAt: new Date(at(batch.readyAt) - effects.reduce((sum, effect) => sum + (effect.kind === "processing" && effect.flowerId === batch.flowerId ? effect.secondsSaved * 1000 : 0), 0)).toISOString() })).filter(batch => at(batch.startedAt) <= time && at(batch.readyAt) > at(raw.serverNow)),
    trimLots: getKqSharedTrimLots(raw, effects).filter(lot => at(lot.createdAt ?? raw.context.businessStartedAt) <= time),
    reputation: raw.context.reputation + communication.reduce((sum, effect) => sum + effect.reputation, 0) + sales.reduce((sum, effect) => sum + effect.reputation, 0),
    instagramFollowers: raw.context.instagramFollowers + communication.reduce((sum, effect) => sum + effect.instagramFollowers, 0),
    shopPartners: raw.context.shopPartners + sales.reduce((sum, effect) => sum + effect.shopPartners, 0),
  };
}

function weeklyCommand(task: KqStaffPlannedTask, employeeId: string, raw: KqStaffRawSnapshot): KqStaffCommand {
  const cost = getKqStaffPlannedTaskCost(task);
  assert(task.costCents === cost, "Le tarif a changé : vérifie et enregistre à nouveau la semaine type.");
  if (task.kind === "production") return { action: "assign-production", employeeId, hours: task.hours, productionStep: task.productionStep! };
  if (task.kind === "training") return { action: "train", employeeId, hours: task.hours, skill: task.skill!, expectedCostCents: cost };
  if (task.kind === "trim") return { action: "trim", employeeId, hours: task.hours, mode: task.trimMode!, expectedCostCents: cost };
  if (task.kind === "culture") {
    if (raw.context.cultureWorkVersion === 1 && task.targetId === undefined) return { action: "assign", employeeId, kind: task.kind, hours: task.hours };
    const target = raw.context.activeRuns.find(run => !task.targetId || run.id === task.targetId);
    assert(target, "Aucune culture disponible pour cette activité.");
    return { action: "assign", employeeId, kind: task.kind, hours: task.hours, targetId: target.id };
  }
  if (task.kind === "processing") {
    if (raw.context.processingWorkVersion === 1) {
      assert(task.targetId === undefined || hasProcessingReservationTarget(raw, task.targetId), "Aucune transformation disponible pour cette activité ciblée.");
      return { action: "assign", employeeId, kind: task.kind, hours: task.hours, ...(task.targetId !== undefined ? { targetId: task.targetId } : {}) };
    }
    const employee = raw.state!.employees.find(employee => employee.id === employeeId)!;
    const level = effectiveLevel(employee, "processing");
    const speed = (1 + (level - 1) * .025) * (employee.trait === "quick" ? 1.15 : employee.trait === "meticulous" ? 1 / 1.10 : 1);
    const queuedUntil = Math.max(at(raw.serverNow), ...raw.state!.tasks.filter(row => row.employeeId === employeeId && row.status === "running" && !row.cultureShift && !row.processingShift).map(row => at(row.completesAt)));
    const finishesAt = queuedUntil + task.hours * HOUR_MS / speed;
    const target = raw.context.processingBatches.find(batch => (!task.targetId || batch.flowerId === task.targetId) && at(batch.readyAt) > finishesAt);
    assert(target, "Aucun lot encore en transformation pour cette activité.");
    return { action: "assign", employeeId, kind: task.kind, hours: task.hours, targetId: target.flowerId };
  }
  return { action: "assign", employeeId, kind: task.kind, hours: task.hours, ...(task.kind === "sales" ? { cityId: task.cityId, expectedCostCents: cost } : {}) };
}

/**
 * Replay only explicitly enabled weekly templates. The first unpaid salary
 * stops further departures, bounding absence work to one payroll period.
 * All real debits belong to settle, keeping payroll/invoice confirmations exact.
 */
export function advanceKqStaff(raw: KqStaffRawSnapshot): { state: KqStaffState; effects: KqStaffEffect[]; debitCents: number } {
  assert(raw.state === null || isKqStaffState(raw.state), "État du personnel incompatible. Actualise le bureau.");
  assert(Number.isFinite(at(raw.serverNow)) && (!raw.state || at(raw.serverNow) >= at(raw.state.lastSettledAt)), "Horloge du personnel invalide.");
  if (!hasDueKqStaffWeeklyWork(raw)) return { ...advanceKqStaffBase(raw), debitCents: 0 };
  assert(raw.context.weeklyPlanVersion === 1, "Le planning hebdomadaire nécessite la mise à jour de Personnel.");
  let state = structuredClone(raw.state!);
  const effects: KqStaffEffect[] = [];
  let debitCents = 0;
  const currentDay = getKqStaffCalendar(raw.context.businessStartedAt, raw.serverNow).day;
  const firstDay = Math.min(...state.employees.filter(employee => employee.status === "active" && employee.weeklyPlan?.enabled).map(employee => employee.weeklyPlan!.nextDay));
  const dayStart = (day: number) => new Date(slotStartAt(raw.context.businessStartedAt) + (day - 1) * KQ_GAME_DAY_MS).toISOString();
  const contextAt = (through: string): KqStaffRawSnapshot => ({ ...raw, state, serverNow: through, cashCents: raw.cashCents - debitCents + getKqProductionCashDelta(effects), context: weeklyContext(raw, effects, through) });
  const advanceTo = (through: string) => {
    const next = advanceKqStaffBase(contextAt(through));
    state = next.state; effects.push(...next.effects);
  };
  const record = (id: string, result: KqStaffPlanDayResult, nextDay: number) => {
    const plan = state.employees.find(employee => employee.id === id)!.weeklyPlan!;
    plan.nextDay = nextDay;
    plan.history = [...plan.history.filter(row => row.day !== result.day), result].slice(-7);
  };
  for (let day = firstDay; day <= currentDay; day++) {
    const start = dayStart(day);
    // Wait for the representable start instead of advancing then rewinding time
    // during the sub-millisecond interval at the beginning of a database day.
    if (at(start) > at(raw.serverNow)) break;
    const elapsed = at(start) < at(state.lastSettledAt);
    if (!elapsed) advanceTo(start);
    const unpaid = state.payroll.some(row => row.paidCents < row.totalCents);
    const ids = state.employees.filter(employee => employee.weeklyPlan?.enabled && employee.weeklyPlan.nextDay <= day).map(employee => employee.id);
    for (const employeeId of ids) {
      const employee = state.employees.find(employee => employee.id === employeeId)!;
      const plan = employee.weeklyPlan!;
      const tasks = plan.days[(day - 1) % 7] ?? [];
      const result: KqStaffPlanDayResult = { day, started: 0, skipped: 0, reasons: [] };
      const calendar = getKqStaffCalendar(raw.context.businessStartedAt, start);
      const reason = elapsed ? "Journée déjà écoulée : aucun travail rétroactif ajouté."
        : employee.status !== "active" ? "Contrat terminé."
        : unpaid && !(raw.context.staffBenefitsVersion === 1 && canKqStaffAssignWithOutstandingPayroll(state, employeeId, "administration")) ? "Salaires échus : règle la paie pour les prochaines journées."
        : employee.leave.some(leave => leave.startDay <= day && leave.endDay >= day) ? "Congé payé."
        : calendar.weekend || calendar.weekday >= employee.weeklyHours / 7 ? "Repos prévu au contrat."
        : null;
      if (reason) { result.skipped = tasks.length; result.reasons.push(reason); }
      else for (let index = 0; index < tasks.length; index++) {
        const task = tasks[index];
        try {
          const prepared = contextAt(start);
          const command = weeklyCommand(task, employeeId, prepared);
          const id = `weekly:${employeeId}:${plan.updatedAt}:${day}:${index}`;
          const next = applyKqStaffManualCommand(prepared, command, id);
          const created = next.state.tasks.find(item => item.id === id);
          assert(created, "L’activité n’a pas pu être préparée.");
          created.weeklyPlanAt = plan.updatedAt; created.weeklySlot = index; created.weeklyCostCents = next.debitCents;
          state = next.state; effects.push(...next.effects); debitCents += next.debitCents;
          result.started++;
        } catch (error) {
          result.skipped++;
          const message = error instanceof Error ? error.message : "Activité indisponible.";
          if (!result.reasons.includes(message)) result.reasons.push(message);
        }
      }
      record(employeeId, result, day + 1);
    }
    const recurringPayrollAdministrator = raw.context.staffBenefitsVersion === 1 && state.employees.some(employee =>
      employee.status === "active" && employee.weeklyPlan?.enabled
      && canKqStaffAssignWithOutstandingPayroll(state, employee.id, "administration"));
    if (unpaid && !recurringPayrollAdministrator) {
      // Nothing can restart before an explicit payment. Consume all missed days
      // now so paying later cannot resurrect work or its charges in the past.
      for (const employee of state.employees.filter(employee => employee.weeklyPlan?.enabled)) {
        if (currentDay > day && employee.weeklyPlan!.nextDay <= currentDay) record(employee.id, { day: currentDay, started: 0, skipped: (employee.weeklyPlan!.days[(currentDay - 1) % 7] ?? []).length, reasons: [`Planning suspendu depuis le jour ${day} : salaires échus.`] }, currentDay + 1);
      }
      break;
    }
  }
  advanceTo(raw.serverNow);
  return { state, effects, debitCents };
}

/** Explicit commands never combine their payment with a recurring departure. */
export function applyKqStaffCommand(raw: KqStaffRawSnapshot, command: KqStaffCommand, id: string) {
  return command.action === "settle" ? advanceKqStaff(raw) : applyKqStaffManualCommand(raw, command, id);
}
