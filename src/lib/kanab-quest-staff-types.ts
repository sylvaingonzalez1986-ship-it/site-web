export type KqStaffSkill = "culture" | "processing" | "communication" | "sales" | "administration";
export type KqStaffRole = "worker" | "grower" | "processor" | "commercial" | "administrator";
export type KqStaffContractKind = "cdi" | "cdd" | "seasonal";
export type KqStaffTrait = "meticulous" | "quick" | "learner" | "outgoing" | "versatile" | "organized";
export type KqStaffSkills = Record<KqStaffSkill, number>;
export type KqStaffPlannedTask = {
  kind: KqStaffSkill | "training" | "trim"; hours: number;
  /** An omitted target covers every culture/processing job with its work capability, or selects the first eligible legacy target. */
  targetId?: string; cityId?: string; skill?: KqStaffSkill; trimMode?: "manual" | "machine";
  /** Server-recorded price per occurrence; client values are discarded. */
  costCents?: number;
};
export type KqStaffPlanDayResult = { day: number; started: number; skipped: number; reasons: string[] };
export type KqStaffWeeklyPlan = {
  enabled: boolean; days: KqStaffPlannedTask[][]; nextDay: number; updatedAt: string;
  weeklyCostCents: number; history: KqStaffPlanDayResult[];
};
export type KqStaffCandidate = {
  code: string; name: string; role: KqStaffRole; trait: KqStaffTrait; biography: string;
  portraitCode?: string;
  hourlyCents: number; classification: number; skills: KqStaffSkills; contracts: KqStaffContractKind[];
};
export type KqStaffEmployee = KqStaffCandidate & {
  id: string; contract: KqStaffContractKind; weeklyHours: number; hiredAt: string; endsAt: string | null;
  /** Stable person identity; a legacy employee's first contract id is its fallback. */
  personId?: string;
  previousContractId?: string;
  renewals?: Array<{ at: string; previousEndsAt: string; endsAt: string }>;
  convertedToCdiAt?: string;
  reason: "permanent" | "replacement" | "temporary-increase" | "harvest";
  status: "active" | "ended"; nextPayrollAt: string; paidUntil: string;
  grossEarnedCents: number; overtimeGrossCents: number; finalPaid: boolean;
  workDays: Record<string, { usedHours: number; extraHours: number }>;
  leave: Array<{ id: string; startDay: number; endDay: number; days: number }>;
  completedTasks: number;
  weeklyPlan?: KqStaffWeeklyPlan;
};
export type KqStaffTrimMode = "manual" | "machine";
export type KqStaffTrimLot = { flowerId: string; name: string; requiredWork: number; completedWork: number; mode: KqStaffTrimMode | null; completedAt: string | null; qualityDelta?: number; totalGrams?: number; completedGrams?: number; createdAt?: string };
export type KqStaffTaskKind = KqStaffSkill | "training" | "trim" | "countryside";
export type KqStaffTaskResult = {
  version: 1; xpGained?: number; cultureUsedHours?: number; processingUsedHours?: number;
  trimGrams?: number; salesAttempts?: number; partnersGained?: number; reputationGained?: number;
  /** Offered before authoritative account caps; never a receipt for gained followers. */
  followersOffered?: number;
  supplierDiscountPercent?: number; supplierDiscountUntil?: string;
};
export type KqStaffAdministrationRules = {
  enabled: boolean; employeeId: string | null; paySuppliers: boolean; payPayroll: boolean;
  maxDailyCents: number; cashReserveCents: number; supplierDueDays: number; updatedAt: string;
};
/** Server receipts since trackedSince; missing metrics are unavailable, never historical zeroes. */
export type KqStaffBenefits = {
  trackedSince: string; supplierSavingsCents: number; supplierBaseCents: number; supplierNetCents: number;
  discountedInvoices: number; followersGained: number; partnersGained: number;
  invoicesPaidCount: number; invoicesPaidCents: number; payrollPaidCount: number; payrollPaidCents: number;
  cultureHoursDelegated: number; processingHoursDelegated: number; processingSecondsSaved: number; trimGrams: number; lastBenefitAt: string | null;
  lastAdministration: null | { taskId: string; at: string; paidCents: number; paidCount: number;
    skippedReason: "no-eligible-documents" | "budget-or-reserve" | "capacity-reached" | null };
};
export type KqStaffTask = {
  id: string; employeeId: string; kind: KqStaffTaskKind; skill: KqStaffSkill; hours: number;
  startedAt: string; completesAt: string; day: number; status: "running" | "completed";
  targetId?: string; cityId?: string; department?: string; trainingCostCents: number; skillLevel: number;
  successChance?: number; outcome?: string;
  /** Versioned per-mission count; legacy tasks retain exactly one attempt. */
  salesAttempts?: number;
  result?: KqStaffTaskResult;
  /** Daily culture budget, consumed atomically by played stages rather than elapsed time. */
  cultureShift?: true; cultureUsedHours?: number;
  /** Daily processing budget, consumed only by work funded atomically in the workshop. */
  processingShift?: true; processingUsedHours?: number;
  trimMode?: KqStaffTrimMode; trimWork?: number; trimQualityDelta?: number;
  /** Shared shifts reserve time, never exclusive ownership of a harvest. */
  trimQueue?: true; trimRateGramsPerHour?: number; trimProgressAt?: string; trimGrams?: number;
  trimContributions?: Array<{ flowerId: string; grams: number }>;
  /** Provenance of a single occurrence of an explicitly enabled weekly plan. */
  weeklyPlanAt?: string; weeklySlot?: number; weeklyCostCents?: number;
};
export type KqStaffPayroll = { id: string; employeeId: string; dueAt: string; grossCents: number; employerCents: number; indemnityCents: number; totalCents: number; paidCents: number };
export type KqStaffState = {
  version: 1; employees: KqStaffEmployee[]; tasks: KqStaffTask[]; payroll: KqStaffPayroll[];
  lastSettledAt: string; supplierDiscountPercent: number; supplierDiscountUntil: string | null;
  prospecting: Record<string, number>;
  trimmerOwned: boolean; playerWorkDays: Record<string, { usedHours: number }>; playerProcessingXp: number;
  /** Older farms keep their existing transformation XP when this is first populated. */
  playerSkills?: KqStaffSkills;
  /** Missing means disabled, including on farms created before the capability. */
  administrationRules?: KqStaffAdministrationRules;
};
export type KqStaffContext = {
  businessStartedAt: string; reputation: number; instagramFollowers: number; shopPartners: number;
  activeRuns: Array<{ id: string; name: string; startedAt?: string }>;
  processingBatches: Array<{ id: string; flowerId: string; name: string; startedAt: string; readyAt: string }>;
  processingJobs?: Array<{ id?: string; flowerId: string; status: "running" | "blocked" | "passive" | "completed"; createdAt: string }>;
  supplierInvoices: Array<{ id: string; remainingCents: number; dueAt: string }>;
  trimLots?: KqStaffTrimLot[];
  trimQueueVersion?: 2;
  weeklyPlanVersion?: 1;
  cultureWorkVersion?: 1;
  processingWorkVersion?: 1;
  contractLifecycleVersion?: 1;
  staffBenefitsVersion?: 1;
  /** Conservative game post abstraction: one role shares the ordinary CDD waiting period. */
  contractCooldowns?: Partial<Record<KqStaffRole, string>>;
  /** Persisted owner-scoped source, hydrated on the server; never accepted from a command. */
  rehireSource?: KqStaffEmployee;
};
export type KqStaffRawSnapshot = { state: KqStaffState | null; revision: number; serverNow: string; cashCents: number; context: KqStaffContext; archiveCount?: number; benefits?: KqStaffBenefits };
export type KqStaffArchiveKind = "contract" | "payroll" | "task";
export type KqStaffArchiveCursor = { at: string; id: string };
export type KqStaffArchiveItems = { contract: KqStaffEmployee; payroll: KqStaffPayroll; task: KqStaffTask };
export type KqStaffArchivePage<Kind extends KqStaffArchiveKind = KqStaffArchiveKind> = {
  items: KqStaffArchiveItems[Kind][]; nextCursor: KqStaffArchiveCursor | null;
};
export type KqStaffRecruitment = { cycle: number; startDay: number; nextDay: number; refreshAt: string };
export type KqStaffSnapshot = KqStaffRawSnapshot & {
  state: KqStaffState; candidates: KqStaffCandidate[];
  recruitment: KqStaffRecruitment;
  calendar: { day: number; week: number; weekday: number; label: string; weekend: boolean; nextDayAt: string };
  monthlyGrossCents: number; monthlyEmployerCostCents: number; outstandingCents: number;
};
export type KqStaffCommand =
  | ({ action: "set-administration-rules" } & Omit<KqStaffAdministrationRules, "updatedAt">)
  | { action: "set-weekly-plan"; employeeId: string; enabled: boolean; days: KqStaffPlannedTask[][]; expectedWeeklyCostCents: number }
  | { action: "hire"; candidateCode: string; contract: KqStaffContractKind; weeklyHours: number; durationMonths: number; reason: KqStaffEmployee["reason"]; expectedMonthlyCostCents: number }
  | { action: "renew-contract"; employeeId: string; months: number; expectedEndsAt: string; expectedMonthlyCostCents: number }
  | { action: "convert-cdi"; employeeId: string; expectedEndsAt: string; expectedMonthlyCostCents: number }
  | { action: "rehire"; sourceContractId: string; contract: KqStaffContractKind; weeklyHours: number; durationMonths: number; reason: KqStaffEmployee["reason"]; expectedMonthlyCostCents: number }
  | { action: "assign"; employeeId: string; kind: KqStaffSkill; hours: number; targetId?: string; cityId?: string; expectedCostCents?: number }
  | { action: "player-assign"; kind: KqStaffSkill | "countryside"; hours: number; targetId?: string; cityId?: string; department?: string; expectedCostCents: number }
  | { action: "train"; employeeId: string; skill: KqStaffSkill; hours: number; expectedCostCents: number }
  | { action: "extra-hours"; employeeId: string; hours: number; expectedGrossCents: number }
  | { action: "payroll"; expectedCents: number }
  | { action: "pay-invoice"; employeeId: string; invoiceId: string; expectedCents: number }
  | { action: "leave"; employeeId: string; startDay: number; endDay: number }
  | { action: "cancel-leave"; employeeId: string; leaveId: string }
  | { action: "trim"; employeeId: string | null; flowerId?: string; mode: KqStaffTrimMode; hours: number; expectedCostCents: number }
  | { action: "buy-trimmer"; expectedCostCents: number }
  | { action: "settle" };
export type KqStaffEffect =
  | { kind: "culture"; runId: string; vitalityDelta: number; terpenesDelta: number; yieldBonusDelta: number; cannabinoidDelta: number }
  | { kind: "processing"; flowerId: string; secondsSaved: number }
  | { kind: "communication"; instagramFollowers: number; reputation: number }
  | { kind: "sales"; shopPartners: number; reputation: number }
  | { kind: "trim-work"; flowerId: string; mode: KqStaffTrimMode; work: number; qualityDelta: number; unit?: "g" }
  | { kind: "supplier-payment"; invoiceId: string; amountCents: number };
