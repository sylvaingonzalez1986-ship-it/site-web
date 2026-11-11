"use client";

import { KqHelpDashboard, KqHelpGrid, KqHelpNote, KqHelpSteps } from "./KqHelpDashboard";
import { useId, useRef, useState } from "react";
import { CalendarDays, Pause, Plus, Trash2 } from "lucide-react";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { KQ_STAFF_CITIES, KQ_STAFF_SKILLS, getKqStaffLevel, getKqStaffMonthlyCost } from "@/lib/kanab-quest-staff";
import { getKqStaffPlannedTaskCost, getKqStaffWeeklyCost, KQ_STAFF_PRODUCTION_STEPS, parseKqStaffWeeklyDays, validateKqStaffWeeklyDays } from "@/lib/kanab-quest-staff-weekly";
import type { KqStaffEmployee, KqStaffPlannedTask, KqStaffSkill, KqStaffSnapshot } from "@/lib/kanab-quest-staff-types";
import type { KqStaffConfirmationDraft } from "./KqStaffOperations";
import { KqProgressMeter } from "./KqVisuals";
import { getKqStaffBenefitPreview } from "@/lib/kanab-quest-staff-benefits";
import { KqStaffBenefits } from "./KqStaffBenefits";
import desk from "./KqStaffDesk.module.css";
import styles from "./KqStaffWeeklyPlanner.module.css";

type Prepare = (confirmation: KqStaffConfirmationDraft) => void;
type Props = { employee: KqStaffEmployee; snapshot: KqStaffSnapshot; prepare: Prepare; disabled: boolean };
const weekdays = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
const skills = Object.keys(KQ_STAFF_SKILLS) as KqStaffSkill[];
const activities: Record<KqStaffPlannedTask["kind"], string> = { ...KQ_STAFF_SKILLS, training: "Formation", trim: "Trim · Atelier", production: "Production autonome" };
const hours = (value: number) => Number.isFinite(value) ? `${value.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} h` : "À préciser";
const totalHours = (tasks: KqStaffPlannedTask[]) => tasks.reduce((sum, task) => sum + task.hours, 0);
const copyDays = (days?: KqStaffPlannedTask[][]) => Array.from({ length: 5 }, (_, index) => (days?.[index] ?? []).map(task => { const copy = { ...task }; delete copy.costCents; return copy; }));

export function KqStaffWeeklyPlanStatus({ employee, available }: { employee: KqStaffEmployee; available: boolean }) {
  const plan = employee.weeklyPlan;
  return <p className={desk.muted} data-weekly-plan-status={!available ? "unavailable" : plan?.enabled ? "enabled" : plan ? "paused" : "none"}>
    {!available ? "Semaine type indisponible côté serveur." : plan ? <><strong>{plan.enabled ? "Semaine type active" : "Semaine type en pause"}</strong> · {hours(totalHours(plan.days.flat()))} prévues / semaine{plan.weeklyCostCents > 0 ? ` · jusqu’à ${formatKqCash(plan.weeklyCostCents)} de frais, hors salaires` : ""}.</> : "Organisation à la journée. Aucune semaine type enregistrée."}
  </p>;
}

/** Pauses the saved template, never an unsaved draft, and leaves reserved work intact. */
export function KqStaffWeeklyPause({ employee, snapshot, prepare, disabled }: Props) {
  const plan = employee.weeklyPlan;
  if (!plan?.enabled || snapshot.context.weeklyPlanVersion !== 1) return null;
  return <button type="button" data-weekly-pause disabled={disabled} onClick={() => prepare({
    title: "Mettre la semaine type en pause",
    description: "Les prochaines répétitions sont suspendues. Les tâches déjà réservées continuent et gardent leurs heures et leurs frais. La semaine enregistrée reste disponible pour une reprise ultérieure.",
    rows: [["Employé", employee.name], ["Organisation ensuite", "À la journée"], ["Tâches déjà réservées", "Conservées"], ["Paiement immédiat", formatKqCash(0)]],
    command: { action: "set-weekly-plan", employeeId: employee.id, enabled: false, days: copyDays(plan.days), expectedWeeklyCostCents: getKqStaffWeeklyCost(plan.days) },
    debitCents: 0, confirmLabel: "Confirmer la pause",
  })}><Pause size={16} aria-hidden="true" /> Mettre en pause</button>;
}

function taskSummary(task: KqStaffPlannedTask, snapshot: KqStaffSnapshot) {
  if (task.kind === "production") return `${KQ_STAFF_PRODUCTION_STEPS[task.productionStep ?? "auto"]} · ${hours(task.hours)} · frais selon les limites du circuit`;
  const target = task.kind === "culture" ? task.targetId ? snapshot.context.activeRuns.find(run => run.id === task.targetId)?.name ?? "culture précise indisponible" : snapshot.context.cultureWorkVersion === 1 ? "toutes les cultures" : "première culture disponible"
    : task.kind === "processing" ? task.targetId ? snapshot.context.processingBatches.find(batch => batch.flowerId === task.targetId)?.name ?? "lot précis indisponible" : snapshot.context.processingWorkVersion === 1 ? "toutes les transformations" : "premier lot disponible"
      : task.kind === "sales" ? KQ_STAFF_CITIES.find(city => city.id === task.cityId)?.name
        : task.kind === "training" && task.skill ? KQ_STAFF_SKILLS[task.skill]
          : task.kind === "trim" ? task.trimMode === "machine" ? "machine" : "manuel" : undefined;
  return `${activities[task.kind]}${target ? ` · ${target}` : ""} · ${hours(task.hours)} · ${formatKqCash(getKqStaffPlannedTaskCost(task))} par occurrence`;
}

export function KqStaffWeeklyPlanner({ employee, snapshot, prepare, disabled }: Props) {
  const [days, setDays] = useState(() => copyDays(employee.weeklyPlan?.days));
  const [selectedDay, setSelectedDay] = useState(0);
  const root = useRef<HTMLElement>(null);
  const titleId = useId(), dayId = useId();
  const supported = snapshot.context.weeklyPlanVersion === 1;
  const plan = employee.weeklyPlan;
  const working = selectedDay < employee.weeklyHours / 7;
  const dayTasks = days[selectedDay];
  const dayHours = totalHours(dayTasks);
  const weekHours = totalHours(days.flat());
  const processingBatches = snapshot.context.processingBatches.filter((batch, index, all) => all.findIndex(item => item.flowerId === batch.flowerId) === index);
  let validation = "", weeklyCost: number | null = null, parsed: KqStaffPlannedTask[][] | null = null;
  try { parsed = parseKqStaffWeeklyDays(days); validateKqStaffWeeklyDays(parsed, employee); weeklyCost = getKqStaffWeeklyCost(parsed); }
  catch (cause) { validation = cause instanceof Error ? cause.message : "Vérifie les activités de la semaine."; }
  const hasTasks = days.some(day => day.length > 0);
  const productionDays = days.filter(day => day.some(task => task.kind === "production")).length;
  const changed = JSON.stringify(days) !== JSON.stringify(copyDays(plan?.days));

  function updateSlot(index: number, update: Partial<KqStaffPlannedTask>) {
    setDays(current => current.map((day, dayIndex) => dayIndex === selectedDay ? day.map((task, slot) => slot === index ? { ...task, ...update } : task) : day));
  }
  function changeKind(index: number, kind: KqStaffPlannedTask["kind"]) {
    const task = dayTasks[index], minimum = kind === "training" || kind === "sales" ? 2 : .5;
    const next: KqStaffPlannedTask = { kind, hours: kind === "administration" ? .5 : Math.max(minimum, Number.isFinite(task.hours) ? task.hours : minimum), ...(kind === "sales" ? { cityId: "" } : kind === "training" ? { skill: "processing" as const } : kind === "trim" ? { trimMode: "manual" as const } : kind === "production" ? { productionStep: "auto" as const } : {}) };
    setDays(current => current.map((day, dayIndex) => dayIndex === selectedDay ? day.map((item, slot) => slot === index ? next : item) : day));
  }
  function addSlot() {
    if (disabled || !working || dayTasks.length >= 3 || !Number.isFinite(dayHours) || dayHours >= 7) return;
    const index = dayTasks.length;
    setDays(current => current.map((day, dayIndex) => dayIndex === selectedDay ? [...day, { kind: "culture", hours: Math.min(2, 7 - dayHours) }] : day));
    requestAnimationFrame(() => root.current?.querySelector<HTMLSelectElement>(`[data-weekly-slot="${index}"] [data-weekly-kind]`)?.focus());
  }
  function removeSlot(index: number) {
    setDays(current => current.map((day, dayIndex) => dayIndex === selectedDay ? day.filter((_, slot) => slot !== index) : day));
    requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>("[data-weekly-add]")?.focus());
  }
  function review(enabled: boolean) {
    if (disabled || !supported || !parsed || weeklyCost === null || (enabled && !hasTasks)) return;
    const continuing = enabled && plan?.enabled;
    prepare({
      title: continuing ? "Modifier la semaine type" : enabled ? "Activer la semaine type" : "Enregistrer la semaine en pause",
      description: enabled ? "Cette semaine se répète à partir du prochain jour du jeu, les jours travaillés du contrat. Les frais de formation et de déplacement sont payés au départ de chaque activité. Une activité impossible est ignorée, avec sa raison dans l’historique. Les tâches déjà réservées sont conservées." : "Ce modèle est conservé en pause. Aucune activité ne démarrera automatiquement tant que tu ne l’auras pas activé. Les tâches déjà réservées continuent.",
      rows: [["Employé", employee.name], ["Organisation", enabled ? "Semaine type répétée" : "En pause"], ...parsed.map((day, index): [string, string] => [weekdays[index], day.length ? day.map(task => taskSummary(task, snapshot)).join(" ; ") : index < employee.weeklyHours / 7 ? "Aucune activité prévue" : "Repos contractuel"]), ["Samedi et dimanche", "Repos"], ["Heures prévues par semaine", hours(weekHours)], [productionDays ? "Formation et déplacements · hors salaires" : "Frais maximum par semaine · hors salaires", formatKqCash(weeklyCost)], ...(productionDays ? [["Production · plafond commun par jour", formatKqCash(snapshot.state.production?.settings.maxDailyCostCents ?? 0)]] as [string,string][] : []), ["Paiement immédiat", formatKqCash(0)]],
      command: { action: "set-weekly-plan", employeeId: employee.id, enabled, days: parsed, expectedWeeklyCostCents: weeklyCost }, debitCents: 0,
      confirmLabel: continuing ? "Confirmer les changements" : enabled ? "Activer la semaine" : "Enregistrer en pause",
    });
  }

  return <section ref={root} className={styles.planner} aria-labelledby={titleId} data-staff-weekly-planner={employee.id}>
    <header className={styles.header}><h4 id={titleId}>Semaine type</h4><KqStaffWeeklyPause employee={employee} snapshot={snapshot} prepare={prepare} disabled={disabled} /></header>
    {!supported ? <p className={desk.callout} role="status" data-weekly-unavailable>La semaine type n’est pas encore disponible sur ce serveur. L’organisation à la journée reste accessible.</p> : <>
      <p className={styles.note}>Répétée dès le prochain jour du jeu après activation. Jusqu’à trois activités et 7 h par jour travaillé ; samedi et dimanche au repos.</p>
      {snapshot.context.productionVersion === 1 ? <><button type="button" data-weekly-production-preset disabled={disabled || !snapshot.state.production?.facility} onClick={() => setDays(weekdays.map((_, weekday) => weekday < employee.weeklyHours / 7 ? [{ kind: "production", productionStep: "auto", hours: 7 }] : []))}>Réserver toutes les heures du contrat</button><p className={styles.note}>Ce modèle remplace le brouillon par {hours(employee.weeklyHours)} de chaîne complète par semaine, soit environ {formatKqCash(Math.round(getKqStaffMonthlyCost(employee, employee.weeklyHours).totalCents * 7 / 30))} de salaire imputé. Ces heures restent payées lorsque la chaîne attend. Réduis les créneaux si la zone est petite pour garder du temps pour d’autres activités. Les frais de production s’ajoutent selon le plafond du circuit.</p></> : null}
      <div className={styles.days} role="group" aria-label="Jour de la semaine type">{weekdays.map((day, index) => <button type="button" key={day} data-weekly-day={index} aria-pressed={selectedDay === index} aria-controls={dayId} aria-label={`${day} · ${index < employee.weeklyHours / 7 ? hours(totalHours(days[index])) + " prévues" : "repos contractuel"}`} disabled={disabled} onClick={() => setSelectedDay(index)}><span>{day.slice(0, 3)}</span><strong>{index < employee.weeklyHours / 7 ? hours(totalHours(days[index])) : "Repos"}</strong></button>)}</div>
      <div id={dayId} className={styles.day} data-weekly-day-panel={selectedDay}>
        <strong>{weekdays[selectedDay]}</strong>
        {working ? Number.isFinite(dayHours) ? <KqProgressMeter label="Heures prévues" value={dayHours} max={7} valueLabel={`${hours(dayHours)} / 7 h`} /> : <p className={styles.note}>Durée à préciser.</p> : <p className={styles.note}>Repos prévu dans le contrat de {hours(employee.weeklyHours)} par semaine.</p>}
        {dayTasks.map((task, index) => {
          const minimum = task.kind === "training" || task.kind === "sales" ? 2 : .5;
          const targets = task.kind === "culture" ? snapshot.context.activeRuns.map(run => ({ id: run.id, name: run.name })) : processingBatches.map(batch => ({ id: batch.flowerId, name: batch.name }));
          const missingTarget = !!task.targetId && !targets.some(target => target.id === task.targetId);
          const reservation = task.kind === "culture" && snapshot.context.cultureWorkVersion === 1 || task.kind === "processing" && snapshot.context.processingWorkVersion === 1;
          let cost: number | null = null;
          try { if (Number.isFinite(task.hours) && task.hours >= minimum) cost = getKqStaffPlannedTaskCost(task); } catch { /* A city still has to be selected. */ }
          return <fieldset key={index} className={styles.slot} data-weekly-slot={index} disabled={disabled || !working}>
            <legend>Créneau {index + 1}</legend>
            <div className={styles.fields}><label>Activité<select data-weekly-kind value={task.kind} onChange={event => changeKind(index, event.target.value as KqStaffPlannedTask["kind"])}>{Object.entries(activities).filter(([kind]) => kind !== "production" || snapshot.context.productionVersion === 1).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}</select></label><label>Durée<input data-weekly-hours type="number" min={minimum} max={7} step={.5} value={Number.isFinite(task.hours) ? task.hours : ""} onChange={event => updateSlot(index, { hours: event.target.value === "" ? NaN : Number(event.target.value) })} /></label></div>
            {task.kind === "production" ? <><label>Poste autonome<select data-weekly-production-step value={task.productionStep ?? "auto"} onChange={event => updateSlot(index, { productionStep: event.target.value as NonNullable<KqStaffPlannedTask["productionStep"]> })}>{Object.entries(KQ_STAFF_PRODUCTION_STEPS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><p className={styles.note}>Stock commercial séparé. Gestes et attentes respectés ; travail inachevé repris au prochain créneau. Dépenses selon les règles du circuit.</p></> : null}
            {task.kind === "culture" || task.kind === "processing" ? <label>{task.kind === "culture" ? "Culture" : "Lot à accompagner"}<select data-weekly-target value={task.targetId ?? ""} onChange={event => updateSlot(index, { targetId: event.target.value || undefined })}><option value="">{task.kind === "culture" ? snapshot.context.cultureWorkVersion === 1 ? "Toutes les cultures" : "Première culture disponible · automatique" : snapshot.context.processingWorkVersion === 1 ? "Toutes les transformations" : "Premier lot disponible · automatique"}</option>{missingTarget ? <option value={task.targetId}>Cible enregistrée indisponible</option> : null}{targets.map(target => <option key={target.id} value={target.id}>{target.name}</option>)}</select></label> : null}
            {task.kind === "culture" && snapshot.context.cultureWorkVersion === 1 ? <p className={styles.note}>Réserve du jour, consommée à raison de 0,5 h par étape jouée. Les cartes et soins ne prennent pas d’heures en plus. Les heures inutilisées expirent en fin de journée.</p> : null}
            {task.kind === "processing" && snapshot.context.processingWorkVersion === 1 ? <p className={styles.note}>Réserve du jour utilisable dans l’Atelier, même avant de préparer un lot. Les heures consommées dépendent du volume et de la cadence des machines, par demi-heure. À épuisement, le lot attend une nouvelle réserve ; tes heures restent intactes.</p> : null}
            {task.kind === "sales" ? <label>Ville de prospection<select data-weekly-city value={task.cityId ?? ""} onChange={event => updateSlot(index, { cityId: event.target.value })}><option value="" disabled>Choisir une ville</option>{KQ_STAFF_CITIES.map(city => <option key={city.id} value={city.id}>{city.name} · {formatKqCash(city.travelCents)} par trajet</option>)}</select></label> : null}
            {task.kind === "training" ? <label>Compétence à apprendre<select data-weekly-skill value={task.skill ?? "processing"} onChange={event => updateSlot(index, { skill: event.target.value as KqStaffSkill })}>{skills.map(skill => <option key={skill} value={skill}>{KQ_STAFF_SKILLS[skill]} · niv. {getKqStaffLevel(employee.skills[skill])}</option>)}</select></label> : null}
            {task.kind === "trim" ? <><label>Méthode de trim<select data-weekly-trim-mode value={task.trimMode ?? "manual"} onChange={event => updateSlot(index, { trimMode: event.target.value as "manual" | "machine" })}><option value="manual">Manuel</option><option value="machine">Machine</option></select></label><p className={styles.note}>Travail dans la file commune de l’Atelier, selon les lots disponibles.</p></> : null}
            {(task.kind === "culture" || task.kind === "processing") && (missingTarget || (!task.targetId && !targets.length && !reservation)) ? <p className={styles.note}>Aucune cible disponible actuellement. Le créneau sera ignoré si elle manque encore au départ.</p> : null}
            {task.kind === "trim" && task.trimMode === "machine" && !snapshot.state.trimmerOwned ? <p className={styles.note}>Trimeuse non achetée. Ce créneau sera ignoré tant qu’elle sera indisponible.</p> : null}
            {task.kind === "training" && task.skill && getKqStaffLevel(employee.skills[task.skill]) >= 10 ? <p className={styles.note}>Compétence au niveau 10 : cette formation sera ignorée.</p> : null}
            {minimum === 2 ? <small className={styles.note}>Minimum 2 h par occurrence.</small> : null}
            {Number.isFinite(task.hours) && task.hours >= minimum && task.hours <= 7 && Number.isInteger(task.hours * 2) ? <KqStaffBenefits compact preview={getKqStaffBenefitPreview({ actor: employee, ...task, context: snapshot.context })} /> : null}
            {task.kind === "administration" ? <p className={styles.note}>0,5 h suffit pour la remise. Les occurrences renouvellent la négociation ; les paiements demandent des règles de gestion activées.</p> : null}
            <div className={styles.slotFooter}><span data-weekly-slot-cost>{task.kind === "production" ? "Frais selon le plafond du circuit" : cost === null ? "Frais à préciser" : `${formatKqCash(cost)} par occurrence`}</span><button type="button" data-weekly-remove={index} aria-label={`Retirer le créneau ${index + 1} du ${weekdays[selectedDay].toLocaleLowerCase("fr")}`} onClick={() => removeSlot(index)}><Trash2 size={15} aria-hidden="true" /> Retirer</button></div>
          </fieldset>;
        })}
        {working && !dayTasks.length ? <p className={styles.note}>Aucune activité prévue ce jour.</p> : null}
        {working ? <button type="button" data-weekly-add disabled={disabled || dayTasks.length >= 3 || !Number.isFinite(dayHours) || dayHours >= 7} onClick={addSlot}><Plus size={16} aria-hidden="true" /> Ajouter une activité</button> : null}
        {dayTasks.length >= 3 ? <small className={styles.note}>Trois activités maximum par jour.</small> : null}
      </div>
      <dl className={styles.cost}><div><dt>{productionDays ? "Formation et déplacements / semaine" : "Frais maximum par semaine"}</dt><dd data-weekly-cost>{weeklyCost === null ? "À préciser" : formatKqCash(weeklyCost)}</dd></div><div><dt>Heures prévues</dt><dd>{hours(weekHours)} / {hours(employee.weeklyHours)}</dd></div></dl>
      {productionDays ? <p className={styles.note}>Production sur {productionDays} jours : plafond commun de {formatKqCash(snapshot.state.production?.settings.maxDailyCostCents ?? 0)} par jour du jeu. Ce budget est partagé par tous les salariés, sans cumul par personne. Les dépenses réelles dépendent des cycles et transformations lancés.</p> : null}
      <p className={styles.note}>Hors salaires. Les frais de formation et de déplacement sont payés à chaque départ. Enregistrer ou activer ce planning ne débite rien immédiatement.</p>
      {validation ? <p className={desk.error} data-weekly-validation>{validation}</p> : null}
      <div className={styles.actions}>{!plan?.enabled ? <button type="button" data-weekly-save-paused disabled={disabled || !!validation} onClick={() => review(false)}>Enregistrer en pause</button> : null}<button type="button" className={desk.primary} data-weekly-activate disabled={disabled || !!validation || !hasTasks || (!!plan?.enabled && !changed)} onClick={() => review(true)}><CalendarDays size={16} aria-hidden="true" />{plan?.enabled ? "Vérifier les changements" : "Vérifier et activer"}</button></div>
      {changed ? <small className={styles.note}>Modifications non enregistrées.</small> : null}
      <details className={styles.rules}><summary>Départs, pauses et activités indisponibles</summary><KqHelpDashboard>
        <KqHelpSteps art="help-plan" steps={[
          { label: "Départs dans l’ordre", detail: "Selon les créneaux du jour.", art: "help-plan" },
          { label: "Rattrapage à ton retour", detail: "Pas besoin de revenir toutes les 4 h.", art: "help-time" },
          { label: "Passer à la journée", detail: "Mettre d’abord la semaine type en pause.", art: "help-rest" },
        ]} />
        <KqHelpGrid art="help-plan" items={[
          { label: "Pas de budget ou de cible", value: "Activité ignorée", detail: "Sans frais ni relance rétroactive.", art: "help-travel" },
          { label: "Salaires échus", value: "Départs suspendus", detail: "Reprise après règlement.", art: "help-accounts" },
          { label: "Personne indisponible", value: "Départ empêché", detail: "Congés, repos ou contrat terminé.", art: "help-rest" },
          { label: "Conditions manquantes", value: "Départ empêché", detail: "Heures déjà réservées ou prérequis absent.", art: "help-plan" },
        ]} />
        <KqHelpNote>Les tâches déjà réservées continuent après la pause : leurs heures et leurs frais restent engagés.</KqHelpNote>
      </KqHelpDashboard></details>
    </>}
    {plan?.history.length ? <details className={styles.history} data-weekly-history><summary>Exécution récente · {Math.min(7, plan.history.length)} jours évalués</summary><ul>{plan.history.slice().sort((a, b) => b.day - a.day).slice(0, 7).map(entry => <li key={entry.day}><strong>Jour {entry.day}</strong><span>{entry.started} activité{entry.started > 1 ? "s" : ""} lancée{entry.started > 1 ? "s" : ""} · {entry.skipped} non lancée{entry.skipped > 1 ? "s" : ""}</span>{entry.reasons.length ? <ul>{entry.reasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul> : null}</li>)}</ul></details> : null}
  </section>;
}
