import { KQ_STAFF_CITIES } from "./kanab-quest-prospecting";
import type { KqStaffEmployee, KqStaffPlannedTask, KqStaffSkill, KqStaffWeeklyPlan } from "./kanab-quest-staff-types";

export const KQ_STAFF_TRAINING_HOURLY_CENTS = 3500;
export const KQ_STAFF_PRODUCTION_STEPS = { auto: "Chaîne complète", culture: "Culture autonome", trim: "Trim autonome", processing: "Transformation autonome", sell: "Vente autonome" } as const;
const skills: KqStaffSkill[] = ["culture", "processing", "communication", "sales", "administration"];
function check(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }

/** Only task choices enter a template; prices, dates and cursors belong to the server. */
export function parseKqStaffWeeklyDays(value: unknown): KqStaffPlannedTask[][] {
  check(Array.isArray(value) && value.length === 5, "La semaine type comporte cinq jours, du lundi au vendredi.");
  return value.map(day => {
    check(Array.isArray(day) && day.length <= 3, "Prévois au maximum trois activités par jour.");
    return day.map(item => {
      check(item && typeof item === "object" && !Array.isArray(item), "Activité du planning invalide.");
      const row = item as Record<string, unknown>;
      check(typeof row.kind === "string" && [...skills, "training", "trim", "production"].includes(row.kind), "Activité du planning inconnue.");
      const kind = row.kind as KqStaffPlannedTask["kind"];
      check(typeof row.hours === "number" && Number.isFinite(row.hours) && row.hours >= (kind === "sales" || kind === "training" ? 2 : .5) && row.hours <= 7 && Number.isInteger(row.hours * 2), "Choisis des demi-heures, de 0,5 à 7 h ; formation et prospection demandent au moins 2 h.");
      const task: KqStaffPlannedTask = { kind, hours: row.hours };
      if (kind === "production") {
        check(typeof row.productionStep === "string" && ["auto", "culture", "trim", "processing", "sell"].includes(row.productionStep), "Choisis une étape de production autonome.");
        task.productionStep = row.productionStep as NonNullable<KqStaffPlannedTask["productionStep"]>;
      }
      const text = (key: string) => {
        const field = row[key];
        check(typeof field === "string" && field.length > 0 && field.length <= 100 && !/[\u0000-\u001f\u007f]/.test(field), "Destination du planning invalide.");
        return field;
      };
      if ((kind === "culture" || kind === "processing") && row.targetId !== undefined) task.targetId = text("targetId");
      if (kind === "sales") { task.cityId = text("cityId"); check(KQ_STAFF_CITIES.some(city => city.id === task.cityId), "Choisis une ville bretonne disponible."); }
      if (kind === "training") { const skill = text("skill"); check(skills.includes(skill as KqStaffSkill), "Compétence de formation inconnue."); task.skill = skill as KqStaffSkill; }
      if (kind === "trim") { check(row.trimMode === "manual" || row.trimMode === "machine", "Choisis le trim manuel ou mécanique."); task.trimMode = row.trimMode; }
      return task;
    });
  });
}

export function getKqStaffPlannedTaskCost(task: KqStaffPlannedTask) {
  if (task.kind === "training") return Math.round(task.hours * KQ_STAFF_TRAINING_HOURLY_CENTS);
  if (task.kind === "sales") {
    const city = KQ_STAFF_CITIES.find(city => city.id === task.cityId);
    check(city, "Choisis une ville bretonne disponible.");
    return city.travelCents;
  }
  return 0;
}

export function getKqStaffWeeklyCost(days: KqStaffPlannedTask[][]) {
  return days.reduce((sum, day) => sum + day.reduce((cost, task) => cost + getKqStaffPlannedTaskCost(task), 0), 0);
}

export function validateKqStaffWeeklyDays(days: KqStaffPlannedTask[][], employee: Pick<KqStaffEmployee, "weeklyHours">) {
  const parsed = parseKqStaffWeeklyDays(days);
  parsed.forEach((day, weekday) => {
    check(!day.some(task => task.kind === "production") || !day.some(task => task.kind === "culture" || task.kind === "processing"), "Prévois l’accompagnement des cultures jouées et la production autonome sur des jours distincts pour ce salarié.");
    check(!day.length || weekday < employee.weeklyHours / 7, "Ce jour est au repos dans ce contrat. Les heures en plus se décident à la journée.");
    check(day.reduce((sum, task) => sum + task.hours, 0) <= 7, "La semaine type réserve au maximum 7 h par jour travaillé.");
  });
}

export function isKqStaffWeeklyPlan(value: unknown, employee: Pick<KqStaffEmployee, "weeklyHours">): value is KqStaffWeeklyPlan {
  if (!value || typeof value !== "object") return false;
  const plan = value as KqStaffWeeklyPlan;
  try {
    validateKqStaffWeeklyDays(plan.days, employee);
    return typeof plan.enabled === "boolean" && Number.isSafeInteger(plan.nextDay) && plan.nextDay >= 1
      && typeof plan.updatedAt === "string" && Number.isFinite(Date.parse(plan.updatedAt))
      && Number.isSafeInteger(plan.weeklyCostCents) && plan.weeklyCostCents >= 0
      && plan.days.flat().every(task => Number.isSafeInteger(task.costCents) && task.costCents! >= 0)
      && plan.days.flat().reduce((sum, task) => sum + task.costCents!, 0) === plan.weeklyCostCents
      && Array.isArray(plan.history) && plan.history.length <= 7
      && plan.history.every(row => row && Number.isSafeInteger(row.day) && row.day >= 1
        && Number.isSafeInteger(row.started) && row.started >= 0 && row.started <= 3
        && Number.isSafeInteger(row.skipped) && row.skipped >= 0 && row.skipped <= 3
        && Array.isArray(row.reasons) && row.reasons.length <= 3 && row.reasons.every(reason => typeof reason === "string" && reason.length <= 500));
  } catch { return false; }
}
