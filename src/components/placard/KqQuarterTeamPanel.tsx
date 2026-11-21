"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { ChevronDown, ChevronUp, PanelRightClose, Plus, UsersRound, X } from "lucide-react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { getKqTeamDayBudget, getKqTeamWorkEntries } from "@/lib/kanab-quest-team-day-budget";
import { getKqStaffTaskActivity } from "@/lib/kanab-quest-staff-activity";
import type { KqStaffEmployee, KqStaffSnapshot, KqTeamDayPlan } from "@/lib/kanab-quest-staff-types";
import { KqQuarterTeamEditor, previewTeamCommand, teamPlanVersion } from "./KqQuarterTeamEditor";
import { KqStaffOperationsConfirmation, KqStaffOperationsStatus, type KqStaffConfirmationDraft, type KqStaffOperationsController } from "./KqStaffOperations";
import { KqStaffPortrait } from "./KqStaffPortrait";
import { KqStaffWeeklyPlanner } from "./KqStaffWeeklyPlanner";
import { KqAllocationBar, KqProgressMeter } from "./KqVisuals";
import { teamActivityNames, teamAssignmentText, teamHours, teamTaskText, teamTime } from "./kq-quarter-team-presentation";
import styles from "./KqQuarterTeamPanel.module.css";

const phoneQuery = "(max-width: 999px)";
function subscribeScreen(callback: () => void) {
  const media = window.matchMedia(phoneQuery);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
const phone = () => window.matchMedia(phoneQuery).matches;
const serverPhone = () => true;
type WorkRow = { id: string; name: string; place: string; status: string; hours: number; from: string; to: string; instant?: boolean; reserve?: boolean; info?: string };

function teamDayRows(snapshot: KqStaffSnapshot, id: string): WorkRow[] {
  const now = Date.parse(snapshot.serverNow);
  const tasks = snapshot.state.tasks.filter(task => task.day === snapshot.calendar.day && task.employeeId === id);
  const rows: WorkRow[] = tasks.map(task => {
    const activity = getKqStaffTaskActivity(task, now);
    const reserve = !!(task.cultureShift || task.processingShift);
    const status = activity === "completed" ? "Terminée" : activity === "working" ? "En cours" : activity === "queued" ? "En file" : activity === "available" ? "Réserve ouverte" : "En attente du bilan";
    const used = task.cultureShift ? task.cultureUsedHours : task.processingUsedHours;
    const info = reserve && used !== undefined ? `${teamHours(used)} utilisées sur ${teamHours(task.hours)} réservées.` :
      activity === "queued" ? "Départ automatique. Les heures et les frais sont déjà engagés." :
      activity === "working" ? "Lancement confirmé · jusqu’à la fin de la mission." : undefined;
    return { id: task.id, ...teamTaskText(task, snapshot), status, hours: task.hours, from: task.startedAt, to: task.completesAt, reserve, info };
  });
  for (const receipt of getKqTeamWorkEntries(snapshot)) {
    if (receipt.assigneeId !== id) continue;
    rows.push({ id: receipt.id, name: receipt.label, place: receipt.place, hours: receipt.hours, from: receipt.startedAt, to: receipt.completesAt,
      status: receipt.instant || Date.parse(receipt.completesAt) <= now ? "Terminée" : Date.parse(receipt.startedAt) > now ? "En file" : "En cours", instant: receipt.instant });
  }
  return rows.sort((a, b) => Date.parse(a.from) - Date.parse(b.from) || a.id.localeCompare(b.id));
}

function nextWeekly(employee: KqStaffEmployee | undefined, today: number) {
  const plan = employee?.weeklyPlan;
  if (!plan?.enabled) return null;
  const first = Math.max(today + 1, plan.nextDay);
  for (let day = first; day < first + 7; day++) {
    const tasks = plan.days[(day - 1) % 7] ?? [];
    if (tasks.length) return { day, label: `${teamActivityNames[tasks[0].kind]} · jour ${day} (semaine type)` };
  }
  return null;
}

function TeamMember({ snapshot, id, name, portrait, employee, open, toggle, prepare, disabled, playerName }: {
  snapshot: KqStaffSnapshot; id: string; name: string; portrait: ReactNode; employee?: KqStaffEmployee; open: boolean; toggle: () => void;
  prepare: (draft: KqStaffConfirmationDraft) => void; disabled: boolean; playerName: string;
}) {
  const detailId = useId();
  const version = snapshot.state.dayPlanVersion ?? 0;
  const [editor, setEditor] = useState<{ plan?: KqTeamDayPlan; version: number; day: number } | null>(null);
  const [weekly, setWeekly] = useState(false);
  const [issue, setIssue] = useState("");
  const rows = teamDayRows(snapshot, id);
  const plans = (snapshot.state.dayPlans ?? []).filter(plan => plan.assigneeId === id).sort((a, b) => a.day - b.day);
  const budget = getKqTeamDayBudget(snapshot, id);
  const active = rows.find(row => row.status === "En cours");
  const reserve = rows.find(row => row.status === "Réserve ouverte");
  const queued = rows.find(row => row.status === "En file");
  const next = plans[0];
  const weeklyNext = nextWeekly(employee, snapshot.calendar.day);
  const leave = employee?.leave.find(period => period.startDay <= snapshot.calendar.day && period.endDay >= snapshot.calendar.day);
  const rest = leave ? "Congé payé" : employee && snapshot.calendar.weekend ? "Repos du week-end" : employee && budget.totalHours === 0 ? "Repos au contrat" : null;
  const status = active ? "Occupé" : rest || budget.remainingHours <= 0 ? "Indisponible" : "Disponible";
  const editable = snapshot.context.dayPlanVersion === 1;
  const currentEditor = editor?.version === version && editor.day === snapshot.calendar.day ? editor : null;
  function openEditor(plan?: KqTeamDayPlan) {
    setIssue(""); setEditor({ plan, version, day: snapshot.calendar.day });
  }
  function review(plan: KqTeamDayPlan, start: boolean) {
    const command = { action: start ? "start-day-plan" as const : "remove-day-plan" as const, planId: plan.id, ...teamPlanVersion(snapshot) };
    const preview = previewTeamCommand(snapshot, command, id, plan.day);
    if (preview.error || preview.free === null || preview.debit === null) { setIssue(preview.error); return; }
    setIssue("");
    const task = teamAssignmentText(plan.assignment, snapshot);
    prepare({ title: start ? "Lancer la tâche prévue" : "Retirer la tâche prévue", description: start ? "La réservation devient une tâche en cours." : "Les heures de cette réservation redeviennent disponibles.",
      rows: [["Personne", name], ["Activité", task.name], ["Lieu ou cible", task.place], ["Journée", `Jour ${plan.day}`], ["Durée", teamHours(plan.assignment.hours)], ["Temps libre après", teamHours(preview.free)], ["Paiement immédiat", formatKqCash(preview.debit)]],
      command, debitCents: preview.debit, confirmLabel: start ? "Lancer maintenant" : "Retirer la tâche" });
  }
  const end = Math.max(Date.parse(snapshot.serverNow), ...rows.filter(row => !row.reserve && !row.instant).map(row => Date.parse(row.to)));
  const dayEnd = Math.min(Date.parse(snapshot.calendar.nextDayAt), employee?.endsAt ? Date.parse(employee.endsAt) : Infinity);
  const nextStart = queued ? queued.name : weeklyNext && (!next || weeklyNext.day < next.day) ? weeklyNext.label : next ? teamAssignmentText(next.assignment, snapshot).name + (next.day === snapshot.calendar.day ? "" : ` · jour ${next.day}`) : "";
  return <article className={styles.member} data-member-id={id}>
    <button type="button" className={styles.person} data-team-person={id} aria-expanded={open} aria-controls={detailId} onClick={toggle}>
      <span className={styles.portrait} aria-hidden="true">{portrait}</span>
      <span className={styles.identity}><strong>{name}</strong><span>{id === "player" ? "Joueur" : "Salarié"} · {status}</span></span>
      {open ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
    </button>
    <div className={styles.summary}>
      <strong className={styles.free} data-team-free={id}>{teamHours(budget.remainingHours)} libres</strong>
      <span>{active ? `En cours · ${active.name}` : reserve ? `${reserve.name} ouverte` : rest ?? "Aucune tâche en cours"}</span>
      {nextStart && <span>Ensuite · {nextStart}</span>}
      <div className={styles.budget}><KqAllocationBar label={`Temps de ${name} aujourd’hui`} emptyLabel="Journée de repos." items={[
        { label: "Utilisé", value: budget.usedHours, displayValue: teamHours(budget.usedHours), tone: "ink" },
        { label: "Réservé", value: budget.reservedHours, displayValue: teamHours(budget.reservedHours), tone: "gold" },
        { label: "Libre", value: budget.remainingHours, displayValue: teamHours(budget.remainingHours), tone: "teal" },
      ]} /></div>
    </div>
    <div id={detailId} hidden={!open}>
      {open && <div className={styles.detail}>
        <h3>{id === "player" ? "Ta journée" : `Journée de ${name}`}</h3>
        {rows.length > 0 ? <ol className={styles.tasks} aria-label="Travail engagé par heure réelle">{rows.map(row => <li key={row.id} data-team-task={row.id}>
          <div className={styles.taskTop}><strong>{row.name}</strong><span>{row.status}</span></div>
          <p>{row.place}</p><p>{teamHours(row.hours)} · {row.instant ? "À " : ""}{teamTime(row.from)}{!row.instant && ` – ${teamTime(row.to)}`} (heure réelle)</p>
          {row.info && <p className={styles.note}>{row.info}</p>}
        </li>)}</ol> : <p>{budget.usedHours ? "Le registre comptabilise des heures utilisées sans détail d’activité." : "Aucun travail engagé aujourd’hui."}</p>}
        {budget.remainingHours > 0 && dayEnd > end && <p className={styles.note}>Disponible pour un départ {end === Date.parse(snapshot.serverNow) ? "dès maintenant" : `après ${teamTime(new Date(end).toISOString())}`}. Fin de journée à {teamTime(new Date(dayEnd).toISOString())} (heure réelle).</p>}
        {plans.length > 0 && <section className={styles.queue}><h4>Tâches à lancer</h4><ol className={styles.tasks}>{plans.map((plan, index) => {
          const task = teamAssignmentText(plan.assignment, snapshot);
          return <li key={plan.id} data-team-plan-id={plan.id}>
            <div className={styles.taskTop}><strong>{index - plans.findIndex(row => row.day === plan.day) + 1}. {task.name}</strong><span>Prévue</span></div>
            <p>{task.place}</p><p>{plan.day === snapshot.calendar.day ? "Aujourd’hui" : `Jour ${plan.day}`} · {teamHours(plan.assignment.hours)}</p>
            <div className={styles.actions}>
              {plan.day === snapshot.calendar.day && index === 0 && <button data-team-start type="button" disabled={disabled} onClick={() => review(plan, true)}>Lancer</button>}
              <button type="button" data-team-edit disabled={disabled} onClick={() => openEditor(plan)}>Modifier</button>
              <button type="button" data-team-remove disabled={disabled} onClick={() => review(plan, false)}>Retirer</button>
            </div>
          </li>;
        })}</ol></section>}
        {issue && <p className={styles.conflict} role="alert">{issue}</p>}
        {editable && !currentEditor && <button type="button" className={styles.primary} data-team-add disabled={disabled} onClick={() => openEditor()}><Plus size={16} aria-hidden="true" /> Attribuer une tâche</button>}
        {editable && currentEditor && <KqQuarterTeamEditor key={currentEditor.plan?.id ?? "add"} snapshot={snapshot} playerName={playerName} initialPerson={id} plan={currentEditor.plan} prepare={prepare} disabled={disabled} close={() => setEditor(null)} />}
        {!editable && <p className={styles.note}>Le planning de l’équipe attend la mise à jour du serveur.</p>}
        {employee && snapshot.context.weeklyPlanVersion === 1 && <div className={styles.weekly}><button type="button" aria-expanded={weekly} onClick={() => setWeekly(value => !value)}>{weekly ? "Replier la semaine type" : "Organiser la semaine type"}</button>
          {weekly && <KqStaffWeeklyPlanner key={employee.weeklyPlan?.updatedAt ?? "new"} employee={employee} snapshot={snapshot} prepare={prepare} disabled={disabled} />}
        </div>}
      </div>}
    </div>
  </article>;
}

export function KqQuarterTeamPanel({ controller, playerName, playerPortrait }: {
  controller: KqStaffOperationsController; playerName: string; playerPortrait?: ReactNode;
}) {
  const compact = useSyncExternalStore(subscribeScreen, phone, serverPhone);
  const [desktopOpen, setDesktopOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [person, setPerson] = useState<string | null>(null);
  const opener = useRef<HTMLButtonElement>(null), sheet = useRef<HTMLDialogElement>(null);
  const title = useId(), section = useId();
  const expanded = compact ? mobileOpen : desktopOpen;
  const { snapshot } = controller;
  const collapsedBudget = !expanded && snapshot && !controller.error && !controller.authProblem ? getKqTeamDayBudget(snapshot, "player") : null;
  const employees = snapshot?.state.employees.filter(row => row.status === "active") ?? [];
  const drying = snapshot?.state.production?.lots.filter(lot => lot.stage === "drying" && Date.parse(lot.readyAt) > Date.parse(snapshot.serverNow)) ?? [];
  const passive = snapshot?.context.processingJobs?.filter(job => job.status === "passive") ?? [];
  const disabled = controller.busy || !!(controller.pending || controller.authProblem || controller.error || controller.recovery || controller.recoveryError);
  useBodyScrollLock(compact && mobileOpen);
  useEffect(() => {
    if (!compact || !mobileOpen) return;
    const dialog = sheet.current;
    dialog?.showModal();
    return () => { dialog?.close(); };
  }, [compact, mobileOpen]);
  function close() {
    if (compact) setMobileOpen(false); else setDesktopOpen(false);
    requestAnimationFrame(() => opener.current?.focus());
  }
  const content = <div className={styles.paper}>
    <header className={styles.header}>
      <div><h2 id={title}>Mon équipe</h2>{snapshot && <p>{snapshot.calendar.label}</p>}</div>
      <button type="button" data-team-close aria-label={compact ? "Fermer mon équipe" : "Replier mon équipe"} title={compact ? "Fermer" : "Replier"} onClick={close}>
        {compact ? <X size={18} aria-hidden="true" /> : <PanelRightClose size={18} aria-hidden="true" />}
      </button>
    </header>
    <div className={styles.register}>
      {snapshot && <>
        <TeamMember key="player" id="player" name={playerName} portrait={playerPortrait ?? <UsersRound aria-hidden="true" />} snapshot={snapshot} open={person === "player"} toggle={() => setPerson(value => value === "player" ? null : "player")} prepare={controller.prepare} disabled={disabled} playerName={playerName} />
        {employees.map(employee => <TeamMember key={employee.id} id={employee.id} employee={employee} name={employee.name} portrait={<KqStaffPortrait person={employee} />} snapshot={snapshot} open={person === employee.id} toggle={() => setPerson(value => value === employee.id ? null : employee.id)} prepare={controller.prepare} disabled={disabled} playerName={playerName} />)}
        {(drying.length > 0 || passive.length > 0) && <details className={styles.passive}><summary>Délais autonomes ({drying.length + passive.length})</summary><p>Ces lots évoluent sans mobiliser d’heures de l’équipe.</p>
          <ul>{drying.map(lot => <li key={lot.id}>Séchage du lot {lot.id} · jusqu’au {new Date(lot.readyAt).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</li>)}
            {passive.map(job => <li key={job.id ?? job.flowerId}>{snapshot.context.processingBatches.find(batch => batch.flowerId === job.flowerId)?.name ?? `Lot ${job.flowerId}`} · repos à l’atelier{job.finalReadyAt && <> jusqu’au <time dateTime={job.finalReadyAt}>{new Date(job.finalReadyAt).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time></>}</li>)}</ul>
        </details>}
      </>}
      <div className={styles.connection}><KqStaffOperationsStatus controller={controller} label="Équipe" disabled={!!controller.pending} /></div>
    </div>
  </div>;
  return <aside className={styles.host} aria-label="Équipe du Quartier" data-team-panel data-team-expanded={expanded || undefined}>
    {!expanded && <div className={styles.collapsed}>
      <button className={styles.trigger} data-team-open ref={opener} type="button" aria-haspopup={compact ? "dialog" : undefined} aria-controls={section} aria-expanded={false}
        onClick={() => { if (compact) setMobileOpen(true); else setDesktopOpen(true); }}><UsersRound size={19} aria-hidden="true" /> Mon équipe{snapshot && <span>({1 + employees.length})</span>}</button>
      {collapsedBudget && <div className={`${styles.paper} ${styles.time}`} data-team-player-time>
        <KqProgressMeter label="Temps libre" value={collapsedBudget.remainingHours} max={collapsedBudget.totalHours}
          valueLabel={`${teamHours(collapsedBudget.remainingHours)} / ${teamHours(collapsedBudget.totalHours)}`} tone={collapsedBudget.remainingHours ? "teal" : "red"} />
      </div>}
    </div>}
    {compact ? mobileOpen && <dialog id={section} ref={sheet} className={styles.sheet} aria-labelledby={title} onCancel={event => { event.preventDefault(); close(); }}>{content}</dialog> :
      expanded && <section id={section} aria-labelledby={title} className={styles.desk}>{content}</section>}
    <KqStaffOperationsConfirmation controller={controller} />
  </aside>;
}
