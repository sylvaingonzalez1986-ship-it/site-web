import "server-only";
import { randomUUID } from "node:crypto";
import { applyKqStaffCommand, hasDueKqStaffWeeklyWork, isKqStaffState, parseKqStaffCommand, projectKqStaffSnapshot, type KqStaffCommand, type KqStaffRawSnapshot, type KqStaffSnapshot } from "@/lib/kanab-quest-staff";
import { createSupabaseServiceClient } from "./admin";
import { getKqPlayerWorkErrorMessage } from "../kanab-quest-player-work-errors";
import type { KqStaffArchiveCursor, KqStaffArchiveKind, KqStaffArchivePage, KqStaffEmployee } from "../kanab-quest-staff-types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function assertId(value: unknown): asserts value is string { if (typeof value !== "string" || !UUID.test(value)) throw new Error("Identifiant de personnel invalide."); }
class StaffSchemaUnavailable extends Error {}
class StaffProfileUnavailable extends Error {}
function databaseError(error: { message: string; code?: string }): never {
  const workError = getKqPlayerWorkErrorMessage(error.message);
  if (workError) throw new Error(workError);
  if (error.code === "PGRST202" || error.code === "42883") throw new StaffSchemaUnavailable("[supabase:staff] staff_migration_required");
  if (error.message.includes("staff_profile")) throw new StaffProfileUnavailable("Ouvre d’abord ta ferme avant de recruter.");
  const known: Record<string, string> = {
    staff_invalid: "Demande de personnel invalide. Actualise le bureau.",
    staff_profile: "Ouvre d’abord ta ferme avant de recruter.",
    staff_changed: "Le planning ou les comptes ont changé. Actualise avant de confirmer.",
    staff_request_mismatch: "Cette confirmation a déjà servi à une autre opération.",
    staff_cash: "Trésorerie insuffisante : aucune dépense n’a été effectuée.",
    staff_payroll_changed: "La paie a changé. Actualise Personnel avant de confirmer le règlement.",
    staff_payroll_invalid: "La paie ne peut pas être validée. Actualise Personnel avant de réessayer.",
    staff_trim_required: "Termine le trim de cette récolte dans l’Atelier avant le jury ou la vente.",
    staff_trim_changed: "Le lot ou son mode de trim a changé. Actualise avant de continuer.",
    staff_trim_unavailable: "Ce lot n’est plus disponible pour le trim.",
    staff_archive_invalid: "La demande d’archives est invalide.",
    staff_archive_unavailable: "Ce dossier archivé n’est pas disponible.",
    staff_archive_changed: "Le registre ou le planning a changé. Actualise Personnel avant de continuer.",
    staff_weekly_plan_changed: "La semaine type a changé. Actualise Personnel avant de confirmer.",
    staff_contract_unavailable: "Ce contrat n’est plus disponible pour une réembauche. Actualise les dossiers.",
    staff_contract_changed: "Le contrat a changé. Actualise et vérifie à nouveau les conditions.",
    staff_contract_invalid: "Les conditions de ce contrat ne peuvent pas être validées.",
    staff_contract_cooldown: "Le délai entre deux contrats sur ce poste n’est pas encore écoulé.",
    staff_admin_invalid: "Les règles de paiement sont invalides. Vérifie le responsable et les plafonds.",
    staff_admin_changed: "Les règles ou les comptes ont changé. Actualise Personnel avant de confirmer.",
    staff_administration_invalid: "Les règles de paiement sont invalides. Vérifie le responsable et les plafonds.",
    staff_administration_changed: "Les règles ou les comptes ont changé. Actualise Personnel avant de confirmer.",
  };
  const match = Object.keys(known).find(key => error.message.includes(key));
  if (match) throw new Error(known[match]);
  throw new Error(`[supabase:staff] ${error.message}`);
}
function validBenefits(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const data = value as Record<string, unknown>;
  const last = data.lastAdministration;
  if (last !== undefined && last !== null) {
    if (typeof last !== "object" || Array.isArray(last)) return false;
    const result = last as Record<string, unknown>;
    if (typeof result.taskId !== "string" || !result.taskId || typeof result.at !== "string" || !Number.isFinite(Date.parse(result.at))
      || ![result.paidCents, result.paidCount].every(amount => Number.isSafeInteger(amount) && Number(amount) >= 0)
      || result.skippedReason !== null && !["no-eligible-documents", "budget-or-reserve", "capacity-reached"].includes(String(result.skippedReason))) return false;
  }
  const counters = ["supplierSavingsCents", "supplierBaseCents", "supplierNetCents", "discountedInvoices", "followersGained", "partnersGained", "invoicesPaidCount", "invoicesPaidCents", "payrollPaidCount", "payrollPaidCents", "processingSecondsSaved"];
  return typeof data.trackedSince === "string" && Number.isFinite(Date.parse(data.trackedSince))
    && (data.lastBenefitAt === null || typeof data.lastBenefitAt === "string" && Number.isFinite(Date.parse(data.lastBenefitAt)))
    && counters.every(key => Number.isSafeInteger(data[key]) && Number(data[key]) >= 0)
    && ["cultureHoursDelegated", "processingHoursDelegated", "trimGrams"].every(key => typeof data[key] === "number" && Number.isFinite(data[key]) && Number(data[key]) >= 0)
    && Number(data.supplierBaseCents) === Number(data.supplierNetCents) + Number(data.supplierSavingsCents);
}
function snapshot(value: unknown): KqStaffRawSnapshot {
  if (!value || typeof value !== "object") throw new Error("[supabase:staff] invalid_snapshot");
  const raw = value as KqStaffRawSnapshot;
  if (!Number.isSafeInteger(raw.revision) || raw.revision < 0 || !Number.isSafeInteger(raw.cashCents) || raw.cashCents < 0
    || !Number.isFinite(Date.parse(raw.serverNow)) || !raw.context || !Number.isFinite(Date.parse(raw.context.businessStartedAt))
    || !Array.isArray(raw.context.activeRuns) || !Array.isArray(raw.context.processingBatches) || !Array.isArray(raw.context.supplierInvoices)
    || ![raw.context.reputation, raw.context.instagramFollowers, raw.context.shopPartners].every(Number.isFinite)
    || raw.state !== null && !isKqStaffState(raw.state)
    || raw.archiveCount !== undefined && (!Number.isSafeInteger(raw.archiveCount) || raw.archiveCount < 0)
    || (raw.context.staffBenefitsVersion === 1 || raw.benefits !== undefined) && !validBenefits(raw.benefits)) throw new Error("[supabase:staff] invalid_snapshot");
  return raw;
}
async function read(userId: string) {
  const result = await createSupabaseServiceClient().rpc("rpc_kq_staff_snapshot", { p_user_id: userId });
  if (result.error) databaseError(result.error);
  return snapshot(result.data);
}
async function receipt(userId: string, requestKey: string, command: KqStaffCommand): Promise<KqStaffRawSnapshot | null> {
  const result = await createSupabaseServiceClient().rpc("rpc_kq_staff_receipt", { p_user_id: userId, p_request_key: requestKey, p_command: command });
  if (result.error) databaseError(result.error);
  return result.data ? snapshot(result.data) : null;
}
async function commit(userId: string, requestKey: string, command: KqStaffCommand, id: string, settleOnly: boolean): Promise<KqStaffRawSnapshot> {
  for (let attempt = 0; attempt < 3; attempt++) {
    let raw = await read(userId);
    const contractAction = command.action === "renew-contract" || command.action === "convert-cdi" || command.action === "rehire";
    if (!settleOnly && (hasDueKqStaffWeeklyWork(raw) || contractAction)) {
      // Freeze past scheduled departures before editing the plan, its leave,
      // or a payment. Their expense must never enter the payroll paid delta.
      await commit(userId, randomUUID(), { action: "settle" }, randomUUID(), true);
      raw = await read(userId);
      if (hasDueKqStaffWeeklyWork(raw)) continue;
    }
    if (settleOnly && !raw.state) return raw;
    let transition: ReturnType<typeof applyKqStaffCommand>;
    try {
      if (command.action === "rehire") {
        // Persist final XP and payroll first; clone only this account's source.
        const source = await readContractSource(userId, command.sourceContractId);
        raw = { ...raw, context: { ...raw.context, rehireSource: source } };
      }
      transition = applyKqStaffCommand(raw, command, id);
    }
    catch (error) {
      // The same confirmation may have committed after the first receipt lookup,
      // making its candidate or other preconditions unavailable in this snapshot.
      if (!settleOnly) {
        const replay = await receipt(userId, requestKey, command);
        if (replay) return replay;
      }
      throw error;
    }
    // A read does not generate endless revisions or receipts simply because time moved.
    if (settleOnly && JSON.stringify({ ...transition.state, lastSettledAt: raw.state?.lastSettledAt }) === JSON.stringify(raw.state)) return raw;
    const result = await createSupabaseServiceClient().rpc("rpc_kq_staff_commit", {
      p_user_id: userId, p_expected_revision: raw.revision, p_request_key: requestKey, p_command: command,
      p_state: transition.state, p_debit_cents: transition.debitCents, p_effects: transition.effects,
    });
    if (result.error && /staff_changed|player_work_changed/.test(result.error.message) && attempt < 2) continue;
    if (result.error) databaseError(result.error);
    return snapshot(result.data);
  }
  throw new Error("Le planning a changé. Actualise le bureau.");
}
export async function getKqStaffSnapshot(userId: string): Promise<KqStaffSnapshot> {
  assertId(userId);
  return projectKqStaffSnapshot(await commit(userId, randomUUID(), { action: "settle" }, randomUUID(), true));
}
export async function handleKqStaffAction(userId: string, input: unknown): Promise<KqStaffSnapshot> {
  assertId(userId);
  const command = parseKqStaffCommand(input);
  const requestKey = (input as Record<string, unknown>).requestKey;
  assertId(requestKey);
  // Replays must precede eligibility: an already hired candidate or paid invoice
  // is deliberately no longer eligible, but the original confirmation is valid.
  const replay = await receipt(userId, requestKey, command);
  if (replay) return projectKqStaffSnapshot(replay);
  return projectKqStaffSnapshot(await commit(userId, requestKey, command, randomUUID(), false));
}

async function readContractSource(userId: string, contractId: string): Promise<KqStaffEmployee> {
  assertId(contractId);
  const result = await createSupabaseServiceClient().rpc("rpc_kq_staff_contract_source", { p_user_id: userId, p_contract_id: contractId });
  if (result.error) databaseError(result.error);
  if (!isArchiveItem(result.data, "contract", null)) throw new Error("[supabase:staff] invalid_contract_source");
  const employee = result.data as KqStaffEmployee;
  if (!Array.isArray(employee.contracts) || !employee.contracts.every(kind => ["cdi", "cdd", "seasonal"].includes(kind))
    || !employee.workDays || typeof employee.workDays !== "object" || !Object.values(employee.workDays).every(day => day
      && Number.isFinite(day.usedHours) && day.usedHours >= 0 && Number.isFinite(day.extraHours) && day.extraHours >= 0)) {
    throw new Error("[supabase:staff] invalid_contract_source");
  }
  return employee;
}

/** Latest settled identity and skills for a former employee, with a fresh quote context. */
export async function getKqStaffRehireOffer(userId: string, contractId: string) {
  assertId(userId); assertId(contractId);
  const current = await getKqStaffSnapshot(userId);
  if (current.context.contractLifecycleVersion !== 1) throw new StaffSchemaUnavailable("[supabase:staff] staff_migration_required");
  return { employee: await readContractSource(userId, contractId), snapshot: current };
}
/** Optional extension for existing game routes; an unapplied staff migration cannot block old farms. */
export async function settleKqStaffIfAvailable(userId: string): Promise<void> {
  try { await getKqStaffSnapshot(userId); }
  catch (error) { if (!(error instanceof StaffSchemaUnavailable) && !(error instanceof StaffProfileUnavailable)) throw error; }
}

const ARCHIVE_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
const archiveDate = (value: unknown): value is string => typeof value === "string" && ARCHIVE_DATE.test(value) && Number.isFinite(Date.parse(value));
const archiveId = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 200 && !/[\u0000-\u001f\u007f]/.test(value);
const archiveCursor = (value: unknown): value is KqStaffArchiveCursor => !!value && typeof value === "object" && archiveDate((value as KqStaffArchiveCursor).at) && archiveId((value as KqStaffArchiveCursor).id);
type ArchiveQuery = { kind?: string | null; employeeId?: string | null; afterAt?: string | null; afterId?: string | null };

/** Read archived evidence only: never settle the simulation or create a receipt. */
export async function getKqStaffArchive(userId: string, query: ArchiveQuery = {}): Promise<KqStaffArchivePage> {
  assertId(userId);
  const kind = query.kind ?? "contract";
  const employeeId = query.employeeId ?? null;
  const afterAt = query.afterAt ?? null, afterId = query.afterId ?? null;
  const cursor = afterAt === null && afterId === null ? null : { at: afterAt, id: afterId };
  if (!["contract", "payroll", "task"].includes(kind) || (kind === "contract" ? employeeId !== null : !employeeId || !UUID.test(employeeId))
    || cursor !== null && !archiveCursor(cursor)) throw new Error("La demande d’archives est invalide.");
  const result = await createSupabaseServiceClient().rpc("rpc_kq_staff_archive", {
    p_user_id: userId, p_kind: kind, p_employee_id: employeeId, p_cursor: cursor,
  });
  if (result.error) databaseError(result.error);
  const page = result.data as KqStaffArchivePage | null;
  if (!page || !Array.isArray(page.items) || page.items.length > 20 || page.nextCursor !== null && !archiveCursor(page.nextCursor)
    || !page.items.every(item => isArchiveItem(item, kind as KqStaffArchiveKind, employeeId))) throw new Error("[supabase:staff] invalid_archive");
  return page;
}

function isArchiveItem(value: unknown, kind: KqStaffArchiveKind, employeeId: string | null): boolean {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  if (!archiveId(item.id)) return false;
  const amount = (key: string) => Number.isSafeInteger(item[key]) && (item[key] as number) >= 0;
  if (kind === "contract") return UUID.test(item.id as string) && item.status === "ended" && item.finalPaid === true && typeof item.name === "string" && item.name.length > 0
    && ["cdi", "cdd", "seasonal"].includes(item.contract as string) && ["worker", "grower", "processor", "commercial", "administrator"].includes(item.role as string)
    && archiveDate(item.hiredAt) && (item.endsAt === null || archiveDate(item.endsAt)) && amount("hourlyCents") && amount("grossEarnedCents")
    && typeof item.weeklyHours === "number" && Number.isFinite(item.weeklyHours) && item.weeklyHours > 0
    && ["permanent", "replacement", "temporary-increase", "harvest"].includes(item.reason as string) && amount("classification")
    && ["meticulous", "quick", "learner", "outgoing", "versatile", "organized"].includes(item.trait as string) && typeof item.biography === "string"
    && !!item.skills && typeof item.skills === "object" && ["culture", "processing", "communication", "sales", "administration"].every(skill => Number.isFinite((item.skills as Record<string, unknown>)[skill]))
    && Array.isArray(item.leave) && item.leave.every(leave => leave && archiveId(leave.id) && Number.isInteger(leave.startDay) && leave.startDay > 0
      && Number.isInteger(leave.endDay) && leave.endDay >= leave.startDay && Number.isFinite(leave.days) && leave.days >= 0);
  if (item.employeeId !== employeeId) return false;
  if (kind === "payroll") return archiveDate(item.dueAt) && ["grossCents", "employerCents", "indemnityCents", "totalCents", "paidCents"].every(amount)
    && item.paidCents === item.totalCents && item.totalCents === (item.grossCents as number) + (item.employerCents as number) + (item.indemnityCents as number);
  return item.status === "completed" && archiveDate(item.startedAt) && archiveDate(item.completesAt)
    && ["culture", "processing", "communication", "sales", "administration", "training", "trim", "countryside"].includes(item.kind as string)
    && ["culture", "processing", "communication", "sales", "administration"].includes(item.skill as string)
    && typeof item.hours === "number" && Number.isFinite(item.hours) && item.hours > 0 && amount("trainingCostCents")
    && (item.outcome === undefined || typeof item.outcome === "string");
}
