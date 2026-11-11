import { canKqStaffAssignWithOutstandingPayroll, getKqStaffLevel } from "./kanab-quest-staff";
import { getKqStaffBenefitPreview } from "./kanab-quest-staff-benefits";
import type { KqStaffEmployee, KqStaffPlannedTask, KqStaffSkill, KqStaffSnapshot, KqStaffTask } from "./kanab-quest-staff-types";

export type KqStaffImpactMode = "day" | "week";
export type KqStaffImpactSectorId = KqStaffSkill | "trim" | "training" | "production";
export type KqStaffImpactHours = {
  total: number; completed: number; running: number;
  /** Assigned and still usable, or conditional hours in the weekly template. Never free employee time. */
  remaining: number;
  /** Closed or expired reservation that was not consumed. */
  unused: number;
  /** Reservation whose consumed hours are not recorded. */
  unknown: number;
};
export type KqStaffImpactMetric = {
  id: string; label: string; value: number | null; unit: string;
  min?: number; max?: number; note?: string;
};
export type KqStaffImpactContribution = {
  id: string; employeeId: string; name: string; hours: KqStaffImpactHours;
  actual: KqStaffImpactMetric[]; forecast: KqStaffImpactMetric[]; notes: string[]; warnings: string[];
};
export type KqStaffImpactSector = {
  id: KqStaffImpactSectorId; hours: KqStaffImpactHours;
  actual: KqStaffImpactMetric[]; forecast: KqStaffImpactMetric[];
  notes: string[]; warnings: string[]; contributions: KqStaffImpactContribution[];
};
export type KqStaffImpact = {
  mode: KqStaffImpactMode; hours: KqStaffImpactHours; sectors: KqStaffImpactSector[];
  employees: Array<{ employeeId: string; name: string; hours: KqStaffImpactHours }>;
  notes: string[]; activePlans: number; pausedPlans: number;
};

export const KQ_STAFF_IMPACT_SECTORS: KqStaffImpactSectorId[] = ["culture", "processing", "trim", "communication", "sales", "administration", "training"];
const emptyHours = (): KqStaffImpactHours => ({ total: 0, completed: 0, running: 0, remaining: 0, unused: 0, unknown: 0 });
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const rounded = (value: number) => Math.round(value * 1_000_000) / 1_000_000;
const metric = (id: string, label: string, value: number | null | undefined, unit: string, note?: string): KqStaffImpactMetric =>
  ({ id, label, value: finite(value) ? value : null, unit, ...(note ? { note } : {}) });
const unique = (values: string[]) => [...new Set(values)];
function sumHours(rows: KqStaffImpactHours[]): KqStaffImpactHours {
  const result = emptyHours();
  for (const row of rows) for (const key of Object.keys(result) as Array<keyof KqStaffImpactHours>) result[key] = rounded(result[key] + row[key]);
  return result;
}

function taskHours(task: KqStaffTask, serverNow: string): KqStaffImpactHours {
  const result = { ...emptyHours(), total: task.hours };
  if (task.kind === "production") {
    result.completed = Math.min(task.hours, task.productionWorkedHours ?? 0);
    result[task.status === "completed" ? "unused" : "remaining"] = Math.max(0, task.hours - result.completed);
    return result;
  }
  if (task.cultureShift || task.processingShift) {
    const used = task.cultureShift ? task.result?.cultureUsedHours ?? task.cultureUsedHours : task.result?.processingUsedHours ?? task.processingUsedHours;
    if (!finite(used) || used < 0 || used > task.hours) result.unknown = task.hours;
    else {
      result.completed = used;
      const expired = Date.parse(task.completesAt) <= Date.parse(serverNow);
      result[task.status === "completed" || expired ? "unused" : "remaining"] = rounded(task.hours - used);
    }
  } else result[task.status === "completed" ? "completed" : "running"] = task.hours;
  return result;
}

/** Never turn account-wide receipts into receipts for a selected employee or day. */
function taskActual(task: KqStaffTask): KqStaffImpactMetric[] {
  if (task.kind === "production") return [metric("production-hours", "Travail effectué", task.productionWorkedHours, "h", task.productionReason)];
  if (task.cultureShift) return [metric("culture-hours", "Heures de culture utilisées", task.result?.cultureUsedHours ?? task.cultureUsedHours, "h")];
  if (task.processingShift) return [metric("processing-hours", "Heures de transformation utilisées", task.result?.processingUsedHours ?? task.processingUsedHours, "h")];
  if (task.kind === "trim" && task.trimQueue) return [metric("trim-grams", "Trim effectué", task.result?.trimGrams ?? task.trimGrams, "g")];
  if (task.status !== "completed") return [];
  if (task.kind === "communication") return [
    metric("followers-gained", "Abonnés effectivement gagnés", null, "abonnés", "Le reçu global ne détaille pas le gain par salarié ou par journée."),
    metric("followers-offered", "Abonnés proposés avant plafond", task.result?.followersOffered, "abonnés", "Proposition de la mission ; ce nombre n’est pas un gain confirmé."),
  ];
  if (task.kind === "sales" || task.kind === "countryside") return [
    metric("attempts", "Tentatives effectuées", task.result?.salesAttempts, "tentatives"),
    metric("partners", "Partenaires obtenus", task.result?.partnersGained, "partenaires"),
  ];
  if (task.kind === "administration") return [
    metric("discount", "Meilleure remise après mission", task.result?.supplierDiscountPercent, "%", "La meilleure remise active est conservée ; les remises ne s’additionnent pas."),
    metric("savings", "Économies attribuables à ces missions", null, "€", "Les économies sont suivies globalement à la création des factures, sans attribution par mission."),
  ];
  if (task.kind === "training") return [metric(`xp-${task.skill}`, `Expérience en ${skillName(task.skill)}`, task.result?.xpGained, "XP")];
  return [metric("legacy-result", "Gain détaillé confirmé", null, "", "Ce type d’ancienne mission ne possède pas de reçu détaillé exploitable.")];
}

function skillName(skill: KqStaffSkill) {
  return ({ culture: "culture", processing: "transformation", communication: "communication", sales: "prospection", administration: "administration" })[skill];
}

// Only homogeneous additive counts are added. Levels, efficiency, quality and
// mission-limited culture bonuses retain a range. Discounts retain their maximum.
const sumIds = new Set(["production-hours", "production-reserved", "culture-hours", "processing-hours", "trim-grams", "followers-gained", "followers-offered", "attempts", "partners", "steps", "spared-hours", "reserved-hours", "trim-capacity", "followers-capacity"]);
function aggregate(rows: KqStaffImpactMetric[], snapshot: KqStaffSnapshot): KqStaffImpactMetric[] {
  const groups = new Map<string, KqStaffImpactMetric[]>();
  for (const row of rows) groups.set(row.id, [...groups.get(row.id) ?? [], row]);
  return [...groups.values()].map(group => {
    const first = group[0], values = group.map(row => row.value);
    if (values.some(value => value === null)) return { ...first, value: null, note: unique(group.flatMap(row => row.note ? [row.note] : [])).join(" ") || "Au moins une mission n’a pas de reçu détaillé." };
    const numbers = values as number[];
    if (first.id === "discount") return { ...first, value: Math.max(...numbers) };
    if (sumIds.has(first.id) || first.id.startsWith("xp-")) {
      const sum = numbers.reduce((total, value) => total + value, 0);
      return { ...first, value: rounded(first.id === "followers-capacity" ? Math.min(sum, Math.max(0, 50_000 - snapshot.context.instagramFollowers)) : sum) };
    }
    const min = Math.min(...numbers), max = Math.max(...numbers);
    return { ...first, value: min === max ? min : null, ...(min === max ? {} : { min, max }) };
  });
}

type Source = { employee: KqStaffEmployee; row: KqStaffPlannedTask | KqStaffTask; task?: KqStaffTask; contribution: KqStaffImpactContribution };

function forecast(source: Source, snapshot: KqStaffSnapshot, xpRemaining: Map<string, number>): KqStaffImpactMetric[] {
  const { employee, row, task, contribution } = source;
  if (row.kind === "production") return task?.status === "completed" ? [] : [metric("production-reserved", "Temps disponible dans le circuit", task ? contribution.hours.remaining : row.hours, "h", "Travail selon les lots, les délais et les capacités ; aucune recette garantie.")];
  if (task?.status === "completed") return [];
  const reservation = task?.cultureShift || task?.processingShift;
  const hours = reservation ? contribution.hours.remaining : row.hours;
  if (hours <= 0 || contribution.hours.unknown) return [];
  const skill = row.kind === "trim" ? "processing" : row.kind === "training" ? row.skill ?? "culture" : row.kind === "countryside" ? "sales" : row.kind;
  // A task's accepted effective level remains authoritative even after training.
  const actor = { ...employee, skills: { ...employee.skills } };
  if (task) actor.skills[skill] = (Math.max(1, task.skillLevel - (employee.trait === "versatile" ? 1 : 0)) - 1) ** 2 * 100;
  const context = { ...snapshot.context };
  if (task?.kind === "culture") { if (task.cultureShift) context.cultureWorkVersion = 1; else delete context.cultureWorkVersion; }
  if (task?.kind === "processing") { if (task.processingShift) context.processingWorkVersion = 1; else delete context.processingWorkVersion; }
  const preview = getKqStaffBenefitPreview({ actor, kind: row.kind, hours, context, skill, cityId: row.cityId, trimMode: row.trimMode });
  contribution.notes.push(...preview.notes);
  const value = (label: string) => preview.metrics.find(item => item.label === label)?.value;
  if (row.kind === "culture") {
    // Each played step grants the difference of rounded, capped cumulative
    // totals. Starting a fresh preview at the remaining duration would grant
    // already exhausted bonuses a second time.
    if (task?.cultureShift || !task && context.cultureWorkVersion === 1) {
      const total = getKqStaffBenefitPreview({ actor, kind: "culture", hours: row.hours, context });
      const consumed = contribution.hours.completed > 0
        ? getKqStaffBenefitPreview({ actor, kind: "culture", hours: contribution.hours.completed, context }) : null;
      const bonus = (id: string, label: string, previewLabel: string, unit: string) => {
        const maximum = total.metrics.find(item => item.label === previewLabel)?.value;
        const used = consumed ? consumed.metrics.find(item => item.label === previewLabel)?.value : 0;
        return metric(id, label, finite(maximum) && finite(used) ? Math.max(0, maximum - used) : null, unit,
          "Maximum restant par réserve, sous les plafonds de la culture et à condition de jouer les étapes. Les bonus de plusieurs réserves ne s’additionnent pas automatiquement sur une culture.");
      };
      return [metric("steps", "Étapes encore finançables", hours * 2, "étapes"), metric("spared-hours", "Temps joueur encore épargnable", hours, "h"),
        bonus("vitality", "Vitalité supplémentaire max. par réserve", "Vitalité maximale", "points"),
        bonus("terpenes", "Terpènes supplémentaires max. par réserve", "Terpènes maximaux", "points"),
        bonus("yield", "Rendement supplémentaire max. par réserve", "Rendement maximal", "%"),
        bonus("cannabinoids", "Cannabinoïdes supplémentaires max. par réserve", "Cannabinoïdes maximaux", "points")];
    }
    return [metric("vitality", "Vitalité maximale par mission", value("Vitalité maximale"), "points"), metric("terpenes", "Terpènes maximaux par mission", value("Terpènes maximaux"), "points"), metric("yield", "Rendement maximal par mission", value("Rendement maximal"), "%"), metric("cannabinoids", "Cannabinoïdes maximaux par mission", value("Cannabinoïdes maximaux"), "points")];
  }
  if (row.kind === "processing") return context.processingWorkVersion === 1 ? [
    metric("reserved-hours", "Heures encore réservées", hours, "h"), metric("efficiency", "Efficacité selon le salarié", value("Efficacité"), "%"),
  ] : [metric("seconds", "Délai réductible par mission", value("Délai réductible au maximum"), "s réelles", "Maximum par mission, limité par le même lot ; ces délais ne s’additionnent pas.")];
  if (row.kind === "trim") {
    const quality = metric("trim-quality", "Effet qualité à la fin du lot", task?.trimQualityDelta ?? value("Qualité à la fin du lot"), "points",
      "Appliqué une seule fois par lot terminé ; ni par salarié ni par mission. Le trim mécanique peut réduire la qualité.");
    if (task && !task.trimQueue) return [metric("legacy-trim-work", "Préparation prévue par mission", task.trimWork, "unités de préparation"), quality];
    const rate = task ? task.trimRateGramsPerHour : value("Cadence");
    const left = task ? Math.max(0, Math.min(task.hours, task.hours * (Date.parse(task.completesAt) - Date.parse(snapshot.serverNow)) / (Date.parse(task.completesAt) - Date.parse(task.startedAt)))) : hours;
    return [metric("trim-capacity", "Capacité de trim restante", finite(rate) && finite(left) ? rate * left : null, "g", "Capacité si des récoltes compatibles restent disponibles ; aucune quantité produite garantie."), metric("trim-rate", "Cadence selon le salarié", rate, "g/h"), quality];
  }
  if (row.kind === "communication") return [metric("followers-capacity", "Abonnés supplémentaires au maximum", value("Abonnés Instagram au maximum"), "abonnés", "Plafond partagé de 50 000 ; estimation conditionnelle, sans recette garantie."),
    metric("reputation-proposed", "Réputation proposée par mission", value("Réputation proposée"), "points", "Proposition par mission, dans les limites du compte ; ce n’est pas un gain confirmé.")];
  if (row.kind === "sales" || row.kind === "countryside") return [
    metric("attempts", "Tentatives prévues", task ? task.salesAttempts ?? (row.kind === "countryside" ? 2 : 1) : value("Tentatives"), "tentatives"),
    metric("chance", "Réussite par tentative", task ? task.successChance : value("Réussite par tentative"), "%", "Probabilité de la mission, jamais un nombre de partenaires acquis."),
  ];
  const xpKey = `${employee.id}:${skill}`;
  const availableXp = xpRemaining.get(xpKey) ?? Math.max(0, 8100 - employee.skills[skill]);
  const gain = Math.min(availableXp, Math.round(hours * (row.kind === "training" ? 60 : 12) * (employee.trait === "learner" ? 1.25 : 1)));
  xpRemaining.set(xpKey, availableXp - gain);
  if (row.kind === "administration") {
    const result = [metric("discount", "Meilleure remise négociable", value("Remise fournisseurs négociable"), "%", "Les remises ne s’additionnent pas ; économies possibles seulement sur les futures factures éligibles."),
      metric("validity", "Validité après chaque mission", 7, "jours du jeu")];
    const rules = snapshot.state.administrationRules;
    const authorized = snapshot.context.staffBenefitsVersion === 1 && rules?.enabled && rules.employeeId === employee.id
      && employee.status === "active" && (rules.paySuppliers || rules.payPayroll)
      && (!task || Date.parse(task.startedAt) >= Date.parse(rules.updatedAt)
        && (!snapshot.benefits || Date.parse(task.startedAt) >= Date.parse(snapshot.benefits.trackedSince)));
    if (authorized) result.push(metric("documents-capacity", "Documents payables au maximum par mission", Math.floor(hours / .5), "documents",
      "Sous le plafond quotidien encore disponible, la réserve de trésorerie et les documents éligibles. Paiements intégraux uniquement ; les missions partagent le même budget."));
    else {
      const warning = "Paiements délégués non autorisés pour ce salarié ou pour cette mission déjà commencée.";
      contribution.notes.push(warning); contribution.warnings.push(warning);
    }
    return result;
  }
  return [metric(`xp-${skill}`, `Expérience en ${skillName(skill)}`, gain, "XP", "Plafond partagé de 8 100 XP par salarié et compétence."),
    metric(`level-${skill}`, `Niveau en ${skillName(skill)} après chaque formation`, getKqStaffLevel(8100 - availableXp + gain), "/10")];
}

function weeklyNotes(employee: KqStaffEmployee, row: KqStaffPlannedTask, snapshot: KqStaffSnapshot): string[] {
  const notes: string[] = [];
  if (employee.leave.length) notes.push("Les jours de congé seront sautés ; cette semaine type n’est pas un calendrier daté.");
  if (employee.endsAt) notes.push("Les occurrences après la fin du contrat ne pourront pas démarrer.");
  if (snapshot.outstandingCents > 0 && !canKqStaffAssignWithOutstandingPayroll(snapshot.state, employee.id, row.kind)) notes.push("Salaires échus : cette activité ne peut pas démarrer avant régularisation.");
  if (!finite(row.costCents)) notes.push("Coût de cette occurrence indisponible ; le serveur le confirmera avant lancement.");
  else if (row.costCents > snapshot.cashCents) notes.push("Trésorerie actuelle insuffisante pour cette occurrence.");
  if (row.kind === "culture" && (!snapshot.context.activeRuns.length || row.targetId && !snapshot.context.activeRuns.some(run => run.id === row.targetId))) notes.push("Aucune culture compatible actuellement ; les bénéfices nécessitent une culture active et ses étapes jouées.");
  if (row.kind === "processing" && !snapshot.context.processingBatches.some(batch => !row.targetId || batch.flowerId === row.targetId) && !snapshot.context.processingJobs?.some(job => job.status !== "completed" && (!row.targetId || job.flowerId === row.targetId))) notes.push("Aucune transformation compatible actuellement ; les bénéfices nécessitent des tranches lancées dans l’Atelier.");
  if (row.kind === "trim") {
    if (row.trimMode === "machine" && !snapshot.state.trimmerOwned) notes.push("Le trim mécanique demande la machine commune.");
    if (!snapshot.context.trimLots?.some(lot => !lot.completedAt && (lot.mode === null || lot.mode === row.trimMode))) notes.push("Aucune récolte compatible disponible actuellement pour ce trim.");
  }
  if (row.kind === "training" && getKqStaffLevel(employee.skills[row.skill ?? "culture"]) >= 10) notes.push("Cette compétence est déjà au niveau maximal ; la formation ne peut pas démarrer.");
  return notes;
}

/** Read-only dashboard model. A weekly template is conditional, never a replay or a receipt. */
export function getKqStaffImpact(snapshot: KqStaffSnapshot, options: { mode: KqStaffImpactMode; employeeId?: string | null }): KqStaffImpact {
  const employees = snapshot.state.employees.filter(employee => !options.employeeId || employee.id === options.employeeId);
  const activeEmployees = employees.filter(employee => employee.status === "active");
  const sectorIds: KqStaffImpactSectorId[] = [...KQ_STAFF_IMPACT_SECTORS, ...(snapshot.context.productionVersion === 1 ? ["production" as const] : [])];
  const sectors: KqStaffImpactSector[] = sectorIds.map(id => ({ id, hours: emptyHours(), actual: [], forecast: [], notes: [], warnings: [], contributions: [] }));
  const sources: Source[] = [];
  const add = (employee: KqStaffEmployee, row: KqStaffPlannedTask | KqStaffTask, id: string, task?: KqStaffTask) => {
    const warnings = task || "id" in row ? [] : weeklyNotes(employee, row, snapshot);
    if (task) {
      const hours = taskHours(task, snapshot.serverNow);
      if (hours.unknown) warnings.push("Consommation de cette réservation indisponible : aucun gain ni solde ne sont reconstitués.");
      if (task.status === "running" && hours.unused) warnings.push("Réservation arrivée à échéance ; clôture serveur en attente. Son solde ne peut plus être utilisé.");
    }
    const contribution: KqStaffImpactContribution = { id, employeeId: employee.id, name: employee.name,
      hours: task ? taskHours(task, snapshot.serverNow) : { ...emptyHours(), total: row.hours, remaining: row.hours },
      actual: task ? taskActual(task) : [], forecast: [], notes: [...warnings], warnings };
    sources.push({ employee, row, task, contribution });
    sectors.find(sector => sector.id === (row.kind === "countryside" ? "sales" : row.kind))!.contributions.push(contribution);
  };
  if (options.mode === "day") {
    for (const task of snapshot.state.tasks.filter(task => task.day === snapshot.calendar.day)) {
      const employee = employees.find(employee => employee.id === task.employeeId);
      if (employee) add(employee, task, task.id, task);
    }
  } else for (const employee of activeEmployees) if (employee.weeklyPlan?.enabled) {
    employee.weeklyPlan.days.forEach((day, weekday) => day.forEach((row, index) => add(employee, row, `weekly:${employee.id}:${weekday}:${index}`)));
  }
  const xpRemaining = new Map<string, number>();
  for (const source of sources) source.contribution.forecast = forecast(source, snapshot, xpRemaining);
  for (const sector of sectors) {
    sector.hours = sumHours(sector.contributions.map(row => row.hours));
    sector.actual = aggregate(sector.contributions.flatMap(row => row.actual), snapshot);
    sector.forecast = aggregate(sector.contributions.flatMap(row => row.forecast), snapshot);
    sector.notes = unique(sector.contributions.flatMap(row => row.notes));
    sector.warnings = unique(sector.contributions.flatMap(row => row.warnings));
  }
  const notes = options.mode === "day" ? ["Tâches de la journée enregistrées par le serveur. Les réservations de culture et de transformation ne rapportent qu’à mesure de leur utilisation.", "Les missions en cours incluent celles en attente de leur créneau ou de confirmation serveur. Les gains globaux depuis le début du suivi ne sont pas attribués à cette journée."]
    : ["Semaine type complète du lundi au vendredi, pour les plannings activés et contrats actifs. Ce n’est ni la semaine déjà réalisée, ni une promesse de lancement.", "Prévisions aux niveaux actuels, sous réserve du contrat, des congés, des salaires réglés, de la trésorerie, des cibles, des stocks et des machines. Les gains restent conditionnels."];
  if (options.mode === "week" && activeEmployees.reduce((total, employee) => total + (employee.weeklyPlan?.enabled ? employee.weeklyPlan.weeklyCostCents : 0), 0) > snapshot.cashCents) notes.push("Le coût enregistré des occurrences dépasse la trésorerie actuelle, hors salaires et autres dépenses.");
  return { mode: options.mode, hours: sumHours(sectors.map(sector => sector.hours)), sectors,
    employees: employees.filter(employee => employee.status === "active" || sources.some(source => source.employee.id === employee.id)).map(employee => ({ employeeId: employee.id, name: employee.name, hours: sumHours(sources.filter(source => source.employee.id === employee.id).map(source => source.contribution.hours)) })),
    notes, activePlans: activeEmployees.filter(employee => employee.weeklyPlan?.enabled).length,
    pausedPlans: activeEmployees.filter(employee => employee.weeklyPlan && !employee.weeklyPlan.enabled).length };
}
