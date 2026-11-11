import { KQ_GAME_DAY_MS } from "./kanab-quest-business";
import { getKqWarehouseRunSnapshot, isKqWarehouseState } from "./kanab-quest-warehouse";
import { getKqProcessingMachineReference } from "./kanab-quest-processing-profiles";
import { getKqStaffSharedTrimQuote } from "./kanab-quest-staff-trim";
import type { KqStaffContext, KqStaffEffect, KqStaffRawSnapshot, KqStaffState, KqStaffTask } from "./kanab-quest-staff-types";
import type { KqProductionFacilityQuote, KqProductionJob, KqProductionLot, KqProductionRulesCommand, KqStaffProductionState } from "./kanab-quest-staff-production-types";
export type * from "./kanab-quest-staff-production-types";

export const KQ_PRODUCTION_HOUR_MS = KQ_GAME_DAY_MS / 24;
export const KQ_PRODUCTION_DRYING_MS = 6 * 60 * 60 * 1000;
export const KQ_PRODUCTION_DEMAND_GRAMS_PER_DAY = 500;
export const KQ_PRODUCTION_MAX_LOTS = 64;
const HOUR = KQ_PRODUCTION_HOUR_MS;
const EPS = .000001;
const at = (value: string) => Date.parse(value);
const stamp = (value: number) => new Date(value).toISOString();
const precise = (value: number) => Math.round(value * 1_000_000) / 1_000_000;
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
function check(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
const natural = (value: unknown, max = 1e12): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= max;
const finite = (value: unknown, max = 1e12): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= max;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const date = (value: unknown): value is string => typeof value === "string" && Number.isFinite(at(value));

/** Quotes reserve explicit parts of the shared facility, not all its free capacity. */
export function getKqProductionFacilities(context: KqStaffContext): KqProductionFacilityQuote[] {
  const input = context.productionFacility;
  if (context.productionVersion !== 1 || !input || !isKqWarehouseState(input.warehouseState)
    || !natural(input.warehouseRevision) || !finite(input.usedStorageGrams) || !finite(input.reservedDryingGrams)) return [];
  const warehouse = input.warehouseState;
  const machine = input.equipment.find(row => row.code === "SIFT-TRAY");
  const reference = machine ? getKqProcessingMachineReference(machine.code, machine.level) : null;
  return warehouse.zones.filter(zone => zone.active).map(zone => {
    const run = getKqWarehouseRunSnapshot(warehouse, input.warehouseRevision, zone.id);
    const drying = Math.max(0, run.dryingCapacityGrams - input.reservedDryingGrams);
    const storage = Math.max(0, run.storageCapacityGrams - input.usedStorageGrams);
    const reason = run.estimatedHarvestGrams <= 0 ? "Cette zone ne dispose pas d'un potentiel de récolte utilisable."
      : input.busyZoneIds.some(id => id === null || id === zone.id) ? "Cette zone est occupée par une culture."
      : drying < run.estimatedHarvestGrams ? "Le séchage disponible ne peut pas accueillir le potentiel de cette zone."
        : storage < run.estimatedHarvestGrams ? "Le stockage disponible ne peut pas accueillir le potentiel de cette zone." : null;
    return { zoneId: zone.id, name: zone.name, areaM2: run.activeAreaM2, harvestGrams: run.estimatedHarvestGrams,
      cycleCostCents: run.operatingCostCents, dryingCapacityGrams: Math.min(drying, run.estimatedHarvestGrams),
      storageCapacityGrams: Math.min(storage, run.estimatedHarvestGrams * 2),
      processingRateGramsPerHour: reference?.gramsPerHour ?? 0, processingAvailable: !!reference,
      available: !reason, reason, warehouseRevision: input.warehouseRevision };
  });
}

export function configureKqStaffProduction(state: KqStaffState, raw: KqStaffRawSnapshot, command: KqProductionRulesCommand) {
  check(raw.context.productionVersion === 1 && raw.context.productionFacility, "La production autonome est indisponible. Actualise le Personnel.");
  check(typeof command.enabled === "boolean" && (command.zoneId === null || typeof command.zoneId === "string")
    && ["flower", "dry-sift"].includes(command.route) && natural(command.maxDailyCostCents, 100_000_000)
    && natural(command.cashReserveCents, 100_000_000) && command.expectedRevision === raw.context.productionFacility.warehouseRevision,
  "Les conditions de production ont changé. Vérifie la zone et les plafonds.");
  const previous = state.production;
  const occupied = !!previous && (previous.lots.length > 0 || previous.jobs.length > 0);
  const zoneId = !command.enabled && occupied && command.zoneId === null ? previous.settings.zoneId : command.zoneId;
  check(!occupied || zoneId === previous.settings.zoneId && command.route === previous.settings.route,
    "Termine et vends les lots avant de changer la zone ou la filière.");
  const quote = zoneId ? getKqProductionFacilities(raw.context).find(row => row.zoneId === zoneId) : null;
  if (command.enabled) {
    check(quote?.available, quote?.reason ?? "Choisis une zone de culture financée et disponible.");
    check(command.route === "flower" || quote.processingAvailable, "Le tamis SIFT-TRAY doit être disponible pour cette filière.");
    check(command.maxDailyCostCents >= quote.cycleCostCents, "Le plafond quotidien doit couvrir au moins un lancement de culture.");
  }
  const facility = occupied ? previous.facility : quote ? {
    zoneId: quote.zoneId, name: quote.name, areaM2: quote.areaM2, harvestGrams: quote.harvestGrams,
    cycleCostCents: quote.cycleCostCents, dryingCapacityGrams: quote.dryingCapacityGrams,
    storageCapacityGrams: quote.storageCapacityGrams, processingAvailable: quote.processingAvailable,
    processingRateGramsPerHour: quote.processingRateGramsPerHour,
  } : null;
  state.production = { version: 1, settings: { enabled: command.enabled, zoneId, route: command.route,
    maxDailyCostCents: command.maxDailyCostCents, cashReserveCents: command.cashReserveCents,
    expectedRevision: command.expectedRevision, updatedAt: raw.serverNow }, facility,
    lots: previous?.lots ?? [], jobs: previous?.jobs ?? [], advancedAt: previous?.advancedAt ?? raw.serverNow,
    nextId: previous?.nextId ?? 1, budget: previous?.budget ?? { day: 0, spentCents: 0 }, demand: previous?.demand ?? { day: 0, reservedGrams: 0 },
    stats: previous?.stats ?? { startedAt: raw.serverNow, cycles: 0, harvestedGrams: 0, trimmedGrams: 0,
      processedInputGrams: 0, producedGrams: 0, soldGrams: 0, soldEquivalentGrams: 0,
      costCents: 0, salesCents: 0, vatCents: 0, workedHours: 0, salaryCostCents: 0 } };
}

export function getKqProductionCashDelta(effects: readonly KqStaffEffect[]) {
  return effects.reduce((sum, effect) => sum + (effect.kind !== "production" ? 0 : effect.event.type === "cost"
    ? -effect.event.amountCents : effect.event.amountCents - effect.event.vatCents), 0);
}

export function isKqStaffProductionState(value: unknown): value is KqStaffProductionState {
  if (!object(value) || value.version !== 1 || !object(value.settings) || !date(value.settings.updatedAt)
    || typeof value.settings.enabled !== "boolean" || !["flower", "dry-sift"].includes(String(value.settings.route))
    || !(value.settings.zoneId === null || typeof value.settings.zoneId === "string")
    || !["maxDailyCostCents", "cashReserveCents", "expectedRevision"].every(key => natural(value.settings && (value.settings as Record<string, unknown>)[key]))
    || !date(value.advancedAt) || !natural(value.nextId) || value.nextId < 1
    || !object(value.budget) || !natural(value.budget.day) || !natural(value.budget.spentCents)
    || !object(value.demand) || !natural(value.demand.day) || !finite(value.demand.reservedGrams, KQ_PRODUCTION_DEMAND_GRAMS_PER_DAY + EPS)
    || !object(value.stats) || !date(value.stats.startedAt)
    || !["cycles", "harvestedGrams", "trimmedGrams", "processedInputGrams", "producedGrams", "soldGrams", "soldEquivalentGrams", "costCents", "salesCents", "vatCents", "workedHours", "salaryCostCents"].every(key => finite((value.stats as Record<string, unknown>)[key]))
    || !["cycles", "costCents", "salesCents", "vatCents", "salaryCostCents"].every(key => natural((value.stats as Record<string, unknown>)[key]))
    || !Array.isArray(value.lots) || value.lots.length > KQ_PRODUCTION_MAX_LOTS || !Array.isArray(value.jobs) || value.jobs.length > KQ_PRODUCTION_MAX_LOTS) return false;
  if (value.facility !== null && (!object(value.facility) || typeof value.facility.zoneId !== "string" || typeof value.facility.name !== "string"
    || typeof value.facility.processingAvailable !== "boolean"
    || !["areaM2", "harvestGrams", "cycleCostCents", "dryingCapacityGrams", "storageCapacityGrams", "processingRateGramsPerHour"].every(key => finite((value.facility as Record<string, unknown>)[key])))) return false;
  if (value.settings.enabled && value.facility === null || value.lots.length > 0 && value.facility === null) return false;
  const ids = new Set<string>(), workers = new Set<string>();
  for (const lot of value.lots) {
    if (!object(lot) || typeof lot.id !== "string" || ids.has(lot.id) || !["flower", "dry-sift"].includes(String(lot.route))
      || !["culture", "drying", "trim", "processing", "ready"].includes(String(lot.stage)) || !date(lot.createdAt) || !date(lot.readyAt)
      || !natural(lot.cultureStage, 3) || typeof lot.processingPaid !== "boolean" || !finite(lot.quality, 100)
      || !["potentialGrams", "grams", "equivalentGrams", "quality", "remainingWork", "cultureHours", "cultureLevelHours", "trimQualityGrams", "processingEfficiencyGrams", "processingQualityGrams", "saleExactCents", "saleRoundedCents"].every(key => finite(lot[key]))) return false;
    ids.add(lot.id);
  }
  const lotJobs = new Set<string>();
  for (const job of value.jobs) {
    if (!object(job) || !["id", "lotId", "taskId", "employeeId"].every(key => typeof job[key] === "string")
      || !ids.has(String(job.lotId)) || lotJobs.has(String(job.lotId)) || workers.has(String(job.employeeId))
      || !["culture", "trim", "processing", "sell"].includes(String(job.step)) || !date(job.startedAt) || !date(job.completesAt)
      || at(job.completesAt) <= at(job.startedAt) || at(job.startedAt) > at(value.advancedAt) || at(job.completesAt) <= at(value.advancedAt)
      || !natural(job.skillLevel, 10) || Number(job.skillLevel) < 1
      || !["hours", "work", "efficiency", "qualityDelta", "equivalentGrams", "priceCentsPerGram"].every(key => finite(job[key]))) return false;
    lotJobs.add(String(job.lotId)); workers.add(String(job.employeeId));
  }
  return true;
}

/**
 * One event clock for every worker. A polling boundary is never a work boundary:
 * segments are committed until a task/operation/day boundary, and only then yield
 * material or money. Pending segments survive polls, pause, and shift handovers.
 */
export function advanceKqStaffProduction(state: KqStaffState, raw: KqStaffRawSnapshot, effects: KqStaffEffect[]) {
  const production = state.production;
  if (!production?.facility) return;
  check(raw.context.productionVersion === 1, "La production autonome est indisponible.");
  const facility = production.facility;
  const now = at(raw.serverNow), origin = at(raw.context.businessStartedAt);
  let time = at(production.advancedAt);
  check(Number.isFinite(now) && now >= time, "Horloge de production invalide.");
  const shifts = state.tasks.filter(task => task.kind === "production").sort((a, b) => a.employeeId.localeCompare(b.employeeId) || a.id.localeCompare(b.id));
  for (const task of shifts) check(task.productionSkills && Object.values(task.productionSkills).every(level => Number.isInteger(level) && level >= 1 && level <= 10)
    && ["auto", "culture", "trim", "processing", "sell"].includes(task.productionStep ?? "")
    && finite(task.productionWorkedHours ?? 0, task.hours) && at(task.completesAt) > at(task.startedAt), "Créneau de production invalide.");
  const dayOf = (t: number) => Math.floor(Math.max(0, t - origin) / KQ_GAME_DAY_MS) + 1;
  const nextDay = (t: number) => origin + dayOf(t) * KQ_GAME_DAY_MS;
  const nextId = (kind: string) => `production-${kind}-${production.nextId++}`;
  const emit = (type: "cost" | "sale", lot: KqProductionLot, task: Pick<KqStaffTask, "id" | "employeeId">, amountCents: number, grams: number) => {
    const vatCents = type === "sale" ? Math.round((production.stats.salesCents + amountCents) / 6) - production.stats.vatCents : 0;
    effects.push({ kind: "production", event: { id: nextId("event"), at: stamp(time), type, lotId: lot.id,
      taskId: task.id, employeeId: task.employeeId, amountCents, vatCents, grams } });
    if (type === "cost") { production.stats.costCents += amountCents; production.budget.spentCents += amountCents; }
    else { production.stats.salesCents += amountCents; production.stats.vatCents += vatCents; }
  };
  const canPay = (cost: number) => production.budget.spentCents + cost <= production.settings.maxDailyCostCents
    && raw.cashCents + getKqProductionCashDelta(effects) - cost >= production.settings.cashReserveCents;
  const shiftEnd = (task: KqStaffTask) => {
    const employee = state.employees.find(row => row.id === task.employeeId);
    return Math.min(at(task.completesAt), nextDay(time), employee?.endsAt ? at(employee.endsAt) : Infinity);
  };
  const availableHours = (task: KqStaffTask) => Math.max(0, Math.min(task.hours - (task.productionWorkedHours ?? 0), (shiftEnd(task) - time) / HOUR));
  function finish(job: KqProductionJob) {
    const lot = production!.lots.find(row => row.id === job.lotId)!;
    const task = state.tasks.find(row => row.id === job.taskId);
    check(task, "Le créneau actif de production doit être conservé jusqu'à sa fin.");
    task.productionWorkedHours = Math.min(task.hours, precise((task.productionWorkedHours ?? 0) + job.hours));
    task.productionReason = "Travail effectué";
    production!.stats.workedHours = precise(production!.stats.workedHours + job.hours);
    if (job.step === "culture") {
      lot.remainingWork = Math.max(0, precise(lot.remainingWork - job.work));
      lot.cultureHours = precise(lot.cultureHours + job.hours);
      lot.cultureLevelHours = precise(lot.cultureLevelHours + job.hours * job.skillLevel);
      if (lot.remainingWork <= EPS) {
        lot.cultureStage++;
        if (lot.cultureStage < 3) { lot.remainingWork = facility.areaM2; lot.readyAt = stamp(Math.max(time, at(lot.createdAt) + lot.cultureStage * 2 * KQ_GAME_DAY_MS)); }
        else {
          const level = lot.cultureLevelHours / lot.cultureHours;
          lot.grams = precise(lot.potentialGrams * (.55 + .05 * (level - 1))); lot.equivalentGrams = lot.grams;
          lot.quality = precise(50 + 4 * level); lot.stage = "drying"; lot.readyAt = stamp(time + KQ_PRODUCTION_DRYING_MS);
          lot.remainingWork = lot.grams; production!.stats.harvestedGrams = precise(production!.stats.harvestedGrams + lot.grams);
        }
      }
    } else if (job.step === "trim") {
      lot.remainingWork = Math.max(0, precise(lot.remainingWork - job.work));
      lot.trimQualityGrams = precise(lot.trimQualityGrams + job.work * job.qualityDelta);
      production!.stats.trimmedGrams = precise(production!.stats.trimmedGrams + job.work);
      if (lot.remainingWork <= EPS) {
        lot.quality = precise(clamp(lot.quality + lot.trimQualityGrams / lot.grams, 0, 100));
        lot.stage = lot.route === "dry-sift" ? "processing" : "ready"; lot.remainingWork = lot.grams; lot.readyAt = stamp(time);
      }
    } else if (job.step === "processing") {
      lot.remainingWork = Math.max(0, precise(lot.remainingWork - job.work));
      lot.processingEfficiencyGrams = precise(lot.processingEfficiencyGrams + job.work * job.efficiency);
      lot.processingQualityGrams = precise(lot.processingQualityGrams + job.work * job.qualityDelta);
      production!.stats.processedInputGrams = precise(production!.stats.processedInputGrams + job.work);
      if (lot.remainingWork <= EPS) {
        lot.quality = precise(clamp(lot.quality + lot.processingQualityGrams / lot.equivalentGrams, 0, 100));
        lot.grams = precise(lot.processingEfficiencyGrams * .18); lot.stage = "ready"; lot.remainingWork = lot.grams;
        production!.stats.producedGrams = precise(production!.stats.producedGrams + lot.grams); lot.readyAt = stamp(time);
      }
    } else {
      lot.saleExactCents = precise(lot.saleExactCents + job.work * job.priceCentsPerGram);
      const rounded = Math.round(lot.saleExactCents), receipt = rounded - lot.saleRoundedCents;
      lot.saleRoundedCents = rounded; emit("sale", lot, task, receipt, job.work);
      lot.grams = Math.max(0, precise(lot.grams - job.work)); lot.equivalentGrams = Math.max(0, precise(lot.equivalentGrams - job.equivalentGrams));
      lot.remainingWork = lot.grams;
      production!.stats.soldGrams = precise(production!.stats.soldGrams + job.work);
      production!.stats.soldEquivalentGrams = precise(production!.stats.soldEquivalentGrams + job.equivalentGrams);
      if (lot.grams <= EPS) production!.lots = production!.lots.filter(row => row.id !== lot.id);
    }
  }
  function assign(task: KqStaffTask) {
    const hours = availableHours(task);
    if (hours <= 0) return;
    const allowed = task.productionStep === "auto" ? ["sell", "culture", "processing", "trim"] : [task.productionStep];
    const free = production!.lots.filter(lot => !production!.jobs.some(job => job.lotId === lot.id) && at(lot.readyAt) <= time)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    let selected: KqProductionLot | undefined, step: KqProductionJob["step"] | undefined;
    for (const candidate of allowed) {
      selected = free.find(lot => candidate === "sell" ? lot.stage === "ready" && production!.demand.reservedGrams < KQ_PRODUCTION_DEMAND_GRAMS_PER_DAY - EPS : lot.stage === candidate);
      if (selected) { step = candidate as KqProductionJob["step"]; break; }
    }
    const prioritizeLaunch = task.productionStep === "auto" && (step === "trim" || step === "processing");
    if ((!selected || prioritizeLaunch) && allowed.includes("culture") && production!.settings.enabled) {
      const occupied = production!.lots.reduce((sum, lot) => sum + (lot.stage === "culture" ? lot.potentialGrams : lot.grams), 0);
      const drying = production!.lots.reduce((sum, lot) => sum + (lot.stage === "drying" ? lot.grams : lot.stage === "culture" ? lot.potentialGrams : 0), 0);
      if (!production!.lots.some(lot => lot.stage === "culture") && production!.lots.length < KQ_PRODUCTION_MAX_LOTS
        && occupied + facility.harvestGrams <= facility.storageCapacityGrams + EPS
        && drying + facility.harvestGrams <= facility.dryingCapacityGrams + EPS && canPay(facility.cycleCostCents)) {
        selected = { id: nextId("lot"), route: production!.settings.route, createdAt: stamp(time), stage: "culture", cultureStage: 0,
          readyAt: stamp(time), potentialGrams: facility.harvestGrams, grams: 0, equivalentGrams: 0, quality: 0,
          remainingWork: facility.areaM2, cultureHours: 0, cultureLevelHours: 0, trimQualityGrams: 0,
          processingEfficiencyGrams: 0, processingQualityGrams: 0, processingPaid: false, saleExactCents: 0, saleRoundedCents: 0 };
        production!.lots.push(selected); production!.stats.cycles++; emit("cost", selected, task, facility.cycleCostCents, 0); step = "culture";
      }
    }
    if (!selected || !step) { task.productionReason = production!.settings.enabled ? "En attente de matière, de capacité, de budget ou de commandes" : "Arrêt des nouveaux cycles ; aucun lot prêt pour ce poste"; return; }
    const skills = task.productionSkills!;
    const level = step === "culture" ? skills.culture : step === "sell" ? skills.sales : skills.processing;
    const trait = task.productionTrait;
    let rate = 1, efficiency = 1, qualityDelta = 0, ratio = 1, price = 0, remaining = selected.remainingWork;
    if (step === "trim") { const quote = getKqStaffSharedTrimQuote({ mode: "manual", hours: .5, level, trait }); rate = quote.gramsPerHour; qualityDelta = quote.qualityDelta; }
    else if (step === "processing") {
      if (!facility.processingAvailable || production!.jobs.some(job => job.step === "processing")) { task.productionReason = "Tamis indisponible ou occupé"; return; }
      const cost = Math.round(selected.equivalentGrams * 18);
      if (!selected.processingPaid && !canPay(cost)) { task.productionReason = "Budget ou réserve insuffisants pour la transformation"; return; }
      if (!selected.processingPaid) { selected.processingPaid = true; emit("cost", selected, task, cost, selected.equivalentGrams); }
      efficiency = Math.min(1, (.55 + .05 * (level - 1)) * (trait === "quick" ? 1.15 : trait === "meticulous" ? 1 / 1.10 : 1));
      qualityDelta = Math.min(3, Math.floor((level - 1) / 4) + (trait === "meticulous" ? 1 : 0));
      rate = facility.processingRateGramsPerHour * efficiency;
    } else if (step === "sell") {
      ratio = selected.equivalentGrams / selected.grams;
      rate = (250 + 25 * (level - 1)) / ratio;
      remaining = Math.min(selected.grams, (KQ_PRODUCTION_DEMAND_GRAMS_PER_DAY - production!.demand.reservedGrams) / ratio);
      price = (selected.route === "flower" ? 210 : 1600) * (.85 + .15 * selected.quality / 100) * (.8 + .02 * level);
    }
    const work = Math.min(remaining, hours * rate);
    if (work <= EPS || !Number.isFinite(rate) || rate <= 0) return;
    // Ceil the final fractional millisecond; never finish an action early.
    const duration = Math.min(shiftEnd(task) - time, Math.max(1, Math.ceil(work / rate * HOUR)));
    const job: KqProductionJob = { id: nextId("job"), lotId: selected.id, taskId: task.id, employeeId: task.employeeId,
      step, startedAt: stamp(time), completesAt: stamp(time + duration), hours: duration / HOUR, work,
      skillLevel: level, trait, efficiency, qualityDelta, equivalentGrams: step === "sell" ? work * ratio : 0, priceCentsPerGram: price };
    if (step === "sell") production!.demand.reservedGrams = precise(production!.demand.reservedGrams + job.equivalentGrams);
    production!.jobs.push(job); task.productionReason = "Travail en cours";
  }
  let iterations = 0;
  while (time <= now) {
    check(++iterations <= 100_000, "Le rattrapage de production doit être effectué par périodes plus courtes.");
    const ending = production.jobs.filter(job => at(job.completesAt) <= time).sort((a, b) => a.completesAt.localeCompare(b.completesAt) || a.id.localeCompare(b.id));
    for (const job of ending) { finish(job); production.jobs = production.jobs.filter(row => row.id !== job.id); }
    const day = dayOf(time);
    if (production.budget.day !== day) production.budget = { day, spentCents: 0 };
    if (production.demand.day !== day) production.demand = { day, reservedGrams: 0 };
    for (const lot of production.lots) if (lot.stage === "drying" && at(lot.readyAt) <= time) lot.stage = "trim";
    // Same-instant weekly occurrences are all registered before any of them
    // acquires material or a machine. Polling exactly at a boundary starts no job.
    for (const task of time < now ? shifts : []) {
      if (at(task.startedAt) > time || at(task.completesAt) <= time || production.jobs.some(job => job.employeeId === task.employeeId)) continue;
      const employee = state.employees.find(row => row.id === task.employeeId);
      if (!employee || at(employee.hiredAt) > time || employee.endsAt && at(employee.endsAt) <= time || employee.leave.some(leave => leave.startDay <= day && leave.endDay >= day)) continue;
      if ((day - 1) % 7 >= employee.weeklyHours / 7 || (day - 1) % 7 >= 5) continue;
      assign(task);
    }
    if (time === now) break;
    const future = [now, nextDay(time), ...production.jobs.map(job => at(job.completesAt)), ...production.lots.map(lot => at(lot.readyAt)),
      ...shifts.flatMap(task => [at(task.startedAt), at(task.completesAt)])].filter(t => t > time);
    time = Math.min(...future);
  }
  production.advancedAt = raw.serverNow;
  if (!production.settings.enabled && !production.lots.length && !production.jobs.length) production.facility = null;
}
