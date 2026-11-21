"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { KQ_GAME_DAY_MS } from "@/lib/kanab-quest-business";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { getKqPlayerWorkday, KQ_PLAYER_COUNTRYSIDE_COST_CENTS, KQ_PLAYER_DAILY_HOURS } from "@/lib/kanab-quest-player-work";
import { KQ_PROSPECTING_DEPARTMENTS } from "@/lib/kanab-quest-prospecting";
import { applyKqStaffCommand, getKqStaffCalendar, getKqStaffCapacity, KQ_STAFF_CITIES, KQ_STAFF_SKILLS } from "@/lib/kanab-quest-staff";
import type { KqStaffSkill, KqStaffSnapshot, KqStaffTaskKind, KqTeamAssignment, KqTeamDayPlan, KqTeamPlanCommand } from "@/lib/kanab-quest-staff-types";
import { KQ_STAFF_PRODUCTION_STEPS, KQ_STAFF_TRAINING_HOURLY_CENTS } from "@/lib/kanab-quest-staff-weekly";
import { KqActivityDuration } from "./KqActivityDuration";
import type { KqStaffConfirmationDraft } from "./KqStaffOperations";
import { assignmentKind, teamActivityNames, teamAssignmentText, teamHours } from "./kq-quarter-team-presentation";
import styles from "./KqQuarterTeamPanel.module.css";

type Prepare = (confirmation: KqStaffConfirmationDraft) => void;
export function teamPlanVersion(snapshot: KqStaffSnapshot) {
  return { expectedDay: snapshot.calendar.day, expectedVersion: snapshot.state.dayPlanVersion ?? 0 };
}

function freeHours(snapshot: KqStaffSnapshot, personId: string, day: number) {
  const calendar = day === snapshot.calendar.day ? snapshot.calendar : getKqStaffCalendar(snapshot.context.businessStartedAt,
    new Date(Date.parse(snapshot.calendar.nextDayAt) + (day - snapshot.calendar.day - 1) * KQ_GAME_DAY_MS + 1).toISOString());
  if (personId === "player") return getKqPlayerWorkday({ state: snapshot.state, calendar }).remainingHours;
  const employee = snapshot.state.employees.find(row => row.id === personId);
  if (!employee) return 0;
  const available = getKqStaffCapacity(employee, calendar, snapshot.state.dayPlans).remainingHours;
  const weekly = employee.weeklyPlan;
  const recurring = weekly?.enabled && weekly.nextDay <= day ? weekly.days[calendar.weekday] ?? [] : [];
  return Math.max(0, available - recurring.reduce((total, slot) => total + slot.hours, 0));
}

export function previewTeamCommand(snapshot: KqStaffSnapshot, command: KqTeamPlanCommand, assigneeId: string, day: number) {
  try {
    const preview = applyKqStaffCommand(snapshot, command, "quarter-team-preview");
    return { free: freeHours({ ...snapshot, state: preview.state }, assigneeId, day), debit: preview.debitCents, error: "" };
  } catch (cause) {
    return { free: null, debit: null, error: cause instanceof Error ? cause.message : "Cette affectation est indisponible." };
  }
}

export function KqQuarterTeamEditor({ snapshot, initialPerson, playerName, plan, disabled, prepare, close }: {
  snapshot: KqStaffSnapshot; initialPerson: string; playerName: string; plan?: KqTeamDayPlan; disabled: boolean; prepare: Prepare; close: () => void;
}) {
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  const previous = plan?.assignment;
  const [person, setPerson] = useState(initialPerson);
  const [mode, setMode] = useState<"plan" | "now">("plan");
  const [kind, setKind] = useState<KqStaffTaskKind>(previous ? assignmentKind(previous) : "communication");
  const [hourInput, setHourInput] = useState(String(previous?.hours ?? 1));
  const [day, setDay] = useState(plan?.day ?? snapshot.calendar.day);
  const [target, setTarget] = useState(previous && "targetId" in previous ? previous.targetId ?? "" : previous?.action === "trim" ? previous.flowerId ?? "" : "");
  const [cityId, setCityId] = useState(previous && "cityId" in previous ? previous.cityId ?? KQ_STAFF_CITIES[0].id : KQ_STAFF_CITIES[0].id);
  const [department, setDepartment] = useState(previous?.action === "player-assign" ? previous.department ?? "35" : "35");
  const [skill, setSkill] = useState<KqStaffSkill>(previous?.action === "train" ? previous.skill : "culture");
  const [trimMode, setTrimMode] = useState<"machine" | "manual">(previous?.action === "trim" ? previous.mode : "manual");
  const [step, setStep] = useState<keyof typeof KQ_STAFF_PRODUCTION_STEPS>(previous?.action === "assign-production" ? previous.productionStep : "auto");
  const [position, setPosition] = useState<string>("keep");
  const isPlayer = person === "player";
  const { context, state, calendar } = snapshot;
  const people = [{ id: "player", name: playerName }, ...state.employees.filter(row => row.status === "active")];
  const hours = kind === "countryside" ? KQ_PLAYER_DAILY_HOURS : Number(hourInput);
  const cost = kind === "training" ? Math.round(hours * KQ_STAFF_TRAINING_HOURLY_CENTS) : kind === "sales" ? KQ_STAFF_CITIES.find(row => row.id === cityId)!.travelCents : kind === "countryside" ? KQ_PLAYER_COUNTRYSIDE_COST_CENTS : 0;
  const legacyBatches = context.processingBatches.filter(row => !context.processingJobs?.some(job => job.flowerId === row.flowerId));
  function canAssign(activity: KqStaffTaskKind, actor: string) {
    if (activity === "countryside") return actor === "player";
    if (activity === "training") return actor !== "player";
    if (activity === "production") return actor !== "player" && !!state.production?.facility && context.productionVersion === 1;
    if (activity === "processing" && actor === "player" && context.processingWorkVersion === 1) return legacyBatches.length > 0;
    return true;
  }
  const choices = (Object.keys(teamActivityNames) as KqStaffTaskKind[]).filter(activity => canAssign(activity, person));
  const fields = kind === "culture" || kind === "processing" ? target ? { targetId: target } : {} : kind === "sales" ? { cityId } : kind === "countryside" ? { department } : {};
  let assignment: KqTeamAssignment;
  if (kind === "training") assignment = { action: "train", employeeId: person, hours, skill, expectedCostCents: cost };
  else if (kind === "production") assignment = { action: "assign-production", employeeId: person, hours, productionStep: step };
  else if (kind === "trim") assignment = { action: "trim", employeeId: isPlayer ? null : person, hours, mode: trimMode, expectedCostCents: 0, ...(context.trimQueueVersion !== 2 && target ? { flowerId: target } : {}) };
  else if (isPlayer || kind === "countryside") assignment = { action: "player-assign", kind, hours, expectedCostCents: cost, ...fields };
  else assignment = { action: "assign", employeeId: person, kind, hours, expectedCostCents: cost, ...fields };
  const taskDay = mode === "now" ? calendar.day : day;
  const free = freeHours(snapshot, person, taskDay);
  const reusableHours = plan?.assigneeId === person && plan.day === taskDay ? plan.assignment.hours : 0;
  const order = (state.dayPlans ?? []).filter(row => row.assigneeId === person && row.day === taskDay && row.id !== plan?.id);
  const command: KqTeamPlanCommand = mode === "now" ? { action: "start-team-task", assignment, ...teamPlanVersion(snapshot) } : {
    action: "save-day-plan", assignment, day, ...teamPlanVersion(snapshot), ...(plan ? { planId: plan.id } : {}),
    ...(position === "keep" ? {} : { beforeId: position === "end" ? null : position }),
  };
  const preview = previewTeamCommand(snapshot, command, person, taskDay);
  const error = !choices.includes(kind) ? "Choisis une activité disponible pour cette personne." : preview.error;
  const selected = teamAssignmentText(assignment, snapshot);
  const title = plan ? "Modifier la tâche" : mode === "now" ? "Lancer la tâche" : "Planifier la tâche";
  const openSlots = !isPlayer && (kind === "culture" && context.cultureWorkVersion === 1 || kind === "processing" && context.processingWorkVersion === 1);
  const batches = isPlayer ? legacyBatches : context.processingBatches;
  const targets = kind === "culture" ? context.activeRuns : kind === "trim" ? (context.trimLots ?? []).filter(lot => !lot.completedAt).map(lot => ({ id: lot.flowerId, name: lot.name })) :
    Array.from(new Map(batches.map(row => [row.flowerId, { id: row.flowerId, name: row.name }])).values());
  if (kind === "processing" && openSlots) for (const job of context.processingJobs ?? []) {
    if ((job.status === "running" || job.status === "blocked") && !targets.some(row => row.id === job.flowerId)) {
      targets.push({ id: job.flowerId, name: `Lot ${job.flowerId}` });
    }
  }
  const costLabel = kind === "production" && state.production ? `Plafond commun de ${formatKqCash(state.production.settings.maxDailyCostCents)} par jour` : formatKqCash(cost);
  const positions = (state.dayPlans ?? []).filter(row => row.assigneeId === person && row.day === taskDay);
  const oldIndex = plan ? positions.findIndex(row => row.id === plan.id) : -1;
  const newIndex = position === "keep" && oldIndex >= 0 ? oldIndex : order.some(row => row.id === position) ? order.findIndex(row => row.id === position) : order.length;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (disabled || error || preview.free === null || preview.debit === null) return;
    prepare({ title, description: mode === "now" ? "Le travail commence dès la confirmation." : "Les heures seront réservées. Lance la tâche depuis sa journée avant la fin du jour prévu.",
      rows: [["Personne", people.find(row => row.id === person)?.name ?? person], ["Activité", selected.name], ["Lieu ou cible", selected.place], ["Journée", `Jour ${taskDay}`], ...(mode === "plan" ? [["Ordre de lancement", `${newIndex + 1} sur ${order.length + 1}`] as [string, string]] : []), ["Durée", teamHours(hours)], ["Temps libre après", teamHours(preview.free)], [kind === "production" ? "Frais de production" : "Frais au lancement", costLabel]],
      command, debitCents: preview.debit, confirmLabel: title });
  };
  function changePerson(next: string) {
    setPerson(next); setPosition("keep");
  }
  return <form className={styles.editor} data-team-form onSubmit={submit} aria-labelledby={id}>
    <h4 id={id} ref={heading} tabIndex={-1}>{plan ? "Modifier la tâche" : "Attribuer une tâche"}</h4>
    <fieldset disabled={disabled}>
      {!plan && <div role="group" aria-label="Moment du lancement" className={styles.mode}>
        <button type="button" data-team-mode="plan" aria-pressed={mode === "plan"} onClick={() => setMode("plan")}>Planifier</button>
        <button type="button" data-team-mode="now" aria-pressed={mode === "now"} onClick={() => setMode("now")}>Lancer maintenant</button>
      </div>}
      <label>Personne<select value={person} onChange={event => changePerson(event.target.value)}>{people.map(row => {
        const compatible = canAssign(kind, row.id);
        return <option key={row.id} value={row.id} disabled={!compatible}>{row.name}{compatible ? "" : " · activité incompatible"}</option>;
      })}</select></label>
      {mode === "plan" && <label>Journée<select value={day} onChange={event => { setDay(Number(event.target.value)); setPosition("keep"); }}>
        {Array.from({ length: 8 }, (_, n) => <option key={n} value={calendar.day + n}>{n === 0 ? "Aujourd’hui" : n === 1 ? "Demain" : "Dans " + n + " jours"} · jour {calendar.day + n}</option>)}
      </select></label>}
      <label>Activité<select value={kind} onChange={event => { setKind(event.target.value as KqStaffTaskKind); setTarget(""); }}>
        {choices.map(key => <option key={key} value={key}>{teamActivityNames[key]}</option>)}
      </select></label>
      {(kind === "culture" || kind === "processing" || kind === "trim" && context.trimQueueVersion !== 2) && <label>{kind === "culture" ? "Culture" : "Lot"}<select value={target} onChange={event => setTarget(event.target.value)}>
        <option value="">{openSlots ? kind === "culture" ? "Toutes les cultures" : "Toutes les transformations" : "Choisir une cible"}</option>
        {targets.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
      </select></label>}
      {kind === "sales" && <label>Ville<select value={cityId} onChange={event => setCityId(event.target.value)}>{KQ_STAFF_CITIES.map(city => <option key={city.id} value={city.id}>{city.name}</option>)}</select></label>}
      {kind === "countryside" && <label>Département<select value={department} onChange={event => setDepartment(event.target.value)}>{KQ_PROSPECTING_DEPARTMENTS.map(row => <option key={row.code} value={row.code}>{row.name} ({row.code})</option>)}</select></label>}
      {kind === "training" && <label>Compétence<select value={skill} onChange={event => setSkill(event.target.value as KqStaffSkill)}>{Object.entries(KQ_STAFF_SKILLS).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>}
      {kind === "trim" && <label>Mode<select value={trimMode} onChange={event => setTrimMode(event.target.value as typeof trimMode)}><option value="manual">À la main</option><option value="machine" disabled={!state.trimmerOwned}>Machine{!state.trimmerOwned && " · à acquérir"}</option></select></label>}
      {kind === "production" && <label>Étape<select value={step} onChange={event => setStep(event.target.value as typeof step)}>{Object.entries(KQ_STAFF_PRODUCTION_STEPS).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>}
      {kind === "countryside" ? <p>Durée de la tournée <strong>{teamHours(KQ_PLAYER_DAILY_HOURS)}</strong></p> : isPlayer ?
        <KqActivityDuration label="Heures à réserver" hours={hours} minimumHours={kind === "sales" ? 2 : .5}
          availableHours={Math.min(KQ_PLAYER_DAILY_HOURS, free + reusableHours)} disabled={disabled} onChange={value => setHourInput(String(value))} /> :
        <label>Durée en heures de jeu<input type="number" inputMode="decimal" min={0.5} step={0.5} max={10} required value={hourInput} onChange={event => setHourInput(event.target.value)} /></label>}
      {mode === "plan" && order.length > 0 && <label>Ordre d’exécution<select value={position} onChange={event => setPosition(event.target.value)}>
        <option value="keep">{plan && plan.day === day && plan.assigneeId === person ? "Garder la position" : "Après les autres tâches"}</option>
        {order.map((row, index) => <option key={row.id} value={row.id}>Avant {index + 1}. {teamAssignmentText(row.assignment, snapshot).name}</option>)}
        {plan && <option value="end">En dernière position</option>}
      </select></label>}
      <dl className={styles.quote}><div><dt>Temps libre actuel · jour {taskDay}</dt><dd>{teamHours(free)}</dd></div>
        {preview.free !== null && <div><dt>Libre après validation</dt><dd>{teamHours(preview.free)}</dd></div>}
        <div><dt>{kind === "production" ? "Frais de production" : "Frais au lancement"}</dt><dd>{costLabel}</dd></div>
      </dl>
      {error && <p className={styles.conflict} role="status">{error}</p>}
      {mode === "plan" && <p className={styles.note}>À lancer manuellement avant la fin du jour prévu.</p>}
      <button type="submit" className={styles.primary} disabled={!!error}>Vérifier {mode === "now" ? "le lancement" : "la réservation"}</button>
      <button type="button" onClick={close}>Fermer l’édition</button>
    </fieldset>
  </form>;
}
