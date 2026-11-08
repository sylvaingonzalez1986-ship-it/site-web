import { KQ_GAME_DAY_MS, KQ_GAME_MONTH_MS } from "./kanab-quest-business";
import type { KqStaffContractKind, KqStaffEmployee, KqStaffRawSnapshot, KqStaffRole } from "./kanab-quest-staff-types";

export const KQ_STAFF_MAX_RENEWALS = 2;
export const KQ_STAFF_CDD_MAX_MONTHS = 18;
/** Existing game limit for harvest contracts, not a universal French seasonal-contract limit. */
export const KQ_STAFF_SEASONAL_MAX_MONTHS = 6;

const time = (value: unknown) => typeof value === "string" ? Date.parse(value) : NaN;
const identifier = (value: unknown) => typeof value === "string" && value.length > 0 && value.length <= 100 && !/[\u0000-\u001f\u007f]/.test(value);
export const getKqStaffPersonId = (employee: Pick<KqStaffEmployee, "id" | "personId">) => employee.personId ?? employee.id;

/** Optional metadata is checked without changing older, metadata-free contracts. */
export function isKqStaffContractHistory(employee: KqStaffEmployee): boolean {
  if (employee.personId !== undefined && !identifier(employee.personId)
    || employee.previousContractId !== undefined && (!identifier(employee.previousContractId) || employee.previousContractId === employee.id)) return false;
  if (employee.convertedToCdiAt !== undefined && (employee.contract !== "cdi" || employee.endsAt !== null
    || !Number.isFinite(time(employee.convertedToCdiAt)) || time(employee.convertedToCdiAt) < time(employee.hiredAt))) return false;
  if (employee.renewals === undefined) return true;
  if (!Array.isArray(employee.renewals) || employee.renewals.length > KQ_STAFF_MAX_RENEWALS) return false;
  let previousEnd: string | undefined, previousAt = time(employee.hiredAt);
  for (const renewal of employee.renewals) {
    if (!renewal || ![renewal.at, renewal.previousEndsAt, renewal.endsAt].every(value => Number.isFinite(time(value)))
      || time(renewal.at) < previousAt || time(renewal.at) >= time(renewal.previousEndsAt)
      || time(renewal.previousEndsAt) <= time(employee.hiredAt) || time(renewal.endsAt) <= time(renewal.previousEndsAt)
      || previousEnd !== undefined && renewal.previousEndsAt !== previousEnd) return false;
    previousEnd = renewal.endsAt; previousAt = time(renewal.at);
  }
  return previousEnd === undefined || (employee.contract === "cdi"
    ? employee.convertedToCdiAt !== undefined && time(employee.convertedToCdiAt) >= previousAt && time(employee.convertedToCdiAt) < time(previousEnd)
    : previousEnd === employee.endsAt);
}

export function getKqStaffContractOptions(employee: KqStaffEmployee, serverNow: string) {
  const renewalCount = employee.renewals?.length ?? 0;
  const maxMonths = employee.contract === "seasonal" ? KQ_STAFF_SEASONAL_MAX_MONTHS : employee.contract === "cdd" ? KQ_STAFF_CDD_MAX_MONTHS : 0;
  const hiredAt = time(employee.hiredAt), endsAt = time(employee.endsAt), now = time(serverNow);
  const totalMonths = Number.isFinite(hiredAt) && Number.isFinite(endsAt) ? Math.max(0, (endsAt - hiredAt) / KQ_GAME_MONTH_MS) : 0;
  const remainingMonths = Math.max(0, Math.floor(maxMonths - totalMonths));
  const fixed = employee.contract === "cdd" || employee.contract === "seasonal";
  const current = employee.status === "active" && !employee.finalPaid && Number.isFinite(now) && Number.isFinite(hiredAt)
    && Number.isFinite(endsAt) && hiredAt <= now && now < endsAt && isKqStaffContractHistory(employee);
  const acceptsCdi = Array.isArray(employee.contracts) && employee.contracts.includes("cdi");
  const canConvert = fixed && current && acceptsCdi;
  const canRenew = fixed && current && renewalCount < KQ_STAFF_MAX_RENEWALS && remainingMonths >= 1;
  const reason = !fixed ? "Le CDI n’a pas de date de fin à prolonger."
    : !current ? "Le renouvellement ou le passage en CDI se prépare avant la fin du contrat."
      : renewalCount >= KQ_STAFF_MAX_RENEWALS ? "Les deux renouvellements de ce contrat ont déjà été utilisés."
        : remainingMonths < 1 ? `La durée maximale de ${maxMonths} mois de jeu est atteinte.` : undefined;
  return { renewalCount, maxRenewals: KQ_STAFF_MAX_RENEWALS, totalMonths, maxMonths, remainingMonths, canRenew, canConvert, reason };
}

/**
 * Ordinary CDD only. The game uses the role as a conservative shared post and
 * Monday–Friday opening days, not a claim to model every sector exception.
 * endsAt is exclusive: an exact day boundary can be the first waiting day.
 */
export function getKqStaffContractCooldown(employee: KqStaffEmployee, businessStartedAt: string): string | null {
  if (employee.contract !== "cdd" || employee.endsAt === null) return null;
  const hiredAt = time(employee.hiredAt), endsAt = time(employee.endsAt), origin = time(businessStartedAt);
  if (![hiredAt, endsAt, origin].every(Number.isFinite) || endsAt <= hiredAt || hiredAt < origin) return null;
  const calendarDays = Math.ceil((endsAt - hiredAt) / KQ_GAME_DAY_MS);
  let remaining = Math.ceil(calendarDays / (calendarDays < 14 ? 2 : 3));
  let day = Math.ceil((endsAt - origin) / KQ_GAME_DAY_MS);
  const weekday = day % 7;
  if (weekday >= 5) day += 7 - weekday;
  const firstWeek = Math.min(remaining, 5 - day % 7);
  day += firstWeek; remaining -= firstWeek;
  if (remaining > 0) {
    day += 2;
    const fullWeeks = Math.floor((remaining - 1) / 5);
    day += fullWeeks * 7;
    remaining -= fullWeeks * 5;
    day += remaining;
  }
  const availableAt = origin + day * KQ_GAME_DAY_MS;
  return Number.isFinite(availableAt) && availableAt <= 8.64e15 ? new Date(availableAt).toISOString() : null;
}

/** Version 1 turns on the owner-scoped, server supplied role/post waiting periods. */
export function getKqStaffRoleContractBlock(raw: KqStaffRawSnapshot, role: KqStaffRole, contract: KqStaffContractKind): string | null {
  if (raw.context.contractLifecycleVersion !== 1 || contract === "cdi") return null;
  const supplied = raw.context.contractCooldowns?.[role];
  if (supplied !== undefined && !Number.isFinite(time(supplied)) || !Number.isFinite(time(raw.serverNow))) return "La disponibilité de ce poste doit être actualisée.";
  // A pure transition can just have closed a live CDD; archived predecessors
  // are supplied by the server's cooldown map, not by an unbounded client list.
  const local = (raw.state?.employees ?? []).filter(employee => employee.role === role && employee.status === "ended")
    .map(employee => getKqStaffContractCooldown(employee, raw.context.businessStartedAt)).filter((value): value is string => value !== null);
  const until = Math.max(supplied === undefined ? 0 : time(supplied), ...local.map(time));
  return time(raw.serverNow) < until ? `Délai de carence de ce poste jusqu’au ${new Date(until).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}. Le CDI reste possible.` : null;
}

export function getKqStaffRehireBlock(raw: KqStaffRawSnapshot, source: KqStaffEmployee, contract: KqStaffContractKind): string | null {
  if (raw.context.contractLifecycleVersion !== 1) return "La réembauche nécessite la mise à jour de Personnel.";
  const now = time(raw.serverNow);
  if (!source || !identifier(source.id) || !isKqStaffContractHistory(source) || !Number.isFinite(now)
    || !Number.isFinite(time(source.hiredAt)) || time(source.hiredAt) > now || source.status !== "ended" || source.finalPaid !== true
    || source.endsAt !== null && (!Number.isFinite(time(source.endsAt)) || time(source.endsAt) > now)
    || source.contract !== "cdi" && source.endsAt === null) return "Ce contrat n’est pas terminé et soldé.";
  if (!Array.isArray(source.contracts) || !source.contracts.length || !["culture", "processing", "communication", "sales", "administration"].every(skill => {
    const value = source.skills?.[skill as keyof typeof source.skills]; return Number.isFinite(value) && value >= 0;
  }) || !Number.isSafeInteger(source.hourlyCents) || source.hourlyCents < 0 || !Number.isSafeInteger(source.classification)
    || !source.workDays || typeof source.workDays !== "object" || Array.isArray(source.workDays)
    || Object.entries(source.workDays).some(([day, row]) => !/^[1-9][0-9]*$/.test(day) || !row || !Number.isFinite(row.usedHours)
      || row.usedHours < 0 || !Number.isFinite(row.extraHours) || row.extraHours < 0)) return "Le dossier de cette personne est incomplet. Actualise Personnel.";
  const employees = raw.state?.employees ?? [];
  const personId = getKqStaffPersonId(source);
  if (employees.some(employee => getKqStaffPersonId(employee) === personId && employee.status === "active")) return "Cette personne a déjà un contrat actif.";
  if (employees.some(employee => employee.id !== source.id && getKqStaffPersonId(employee) === personId
    && (employee.previousContractId === source.id || time(employee.hiredAt) > time(source.hiredAt)))) return "Un contrat plus récent existe pour cette personne. Ouvre son dernier dossier.";
  if (raw.state?.payroll.some(pay => pay.paidCents < pay.totalCents)) return "Règle les salaires échus avant une nouvelle embauche.";
  if (raw.state?.tasks.some(task => task.employeeId === source.id && task.status === "running")) return "Les tâches du précédent contrat doivent être terminées.";
  if (employees.filter(employee => employee.status === "active").length >= 8) return "L’équipe peut accueillir huit salariés au maximum.";
  return getKqStaffRoleContractBlock(raw, source.role, contract);
}
