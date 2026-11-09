"use client";

import { useCallback, useEffect, useId, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { ArrowUpRight, CalendarDays, Check, Clock3, ContactRound, GripVertical, Hammer, Pause, Play, UserRound } from "lucide-react";
import { KQ_STAFF_CITIES, KQ_STAFF_SKILLS, getKqStaffCapacity, canKqStaffAssignWithOutstandingPayroll } from "@/lib/kanab-quest-staff";
import { getKqPlayerWorkday } from "@/lib/kanab-quest-player-work";
import { getKqStaffStationActivity, getKqStaffTaskActivity } from "@/lib/kanab-quest-staff-activity";
import type { KqStaffEmployee, KqStaffSkill, KqStaffSnapshot, KqStaffTask } from "@/lib/kanab-quest-staff-types";
import type { KqPrintedArtKind } from "./KqPrintedArt";
import { KqStaffStationScene } from "./KqStaffStationScene";
import { useKqSceneMotion } from "./useKqSceneMotion";
import { KqProgressMeter } from "./KqVisuals";
import styles from "./KqStaffWorkPlan.module.css";

export type KqStaffStation = KqStaffSkill | "training" | "trim";
export type KqStaffWorkPlanProps = {
  snapshot: KqStaffSnapshot;
  disabled?: boolean;
  onAssign: (employeeId: string, station: KqStaffStation) => void;
  renderPortrait: (employee: KqStaffEmployee) => ReactNode;
  selectedStation?: KqStaffStation;
  renderPlayerPortrait?: ReactNode;
  renderScenePortrait?: (employee: KqStaffEmployee) => ReactNode;
  renderPlayerScenePortrait?: ReactNode;
  snapshotReceivedAt?: number;
  motionPaused?: boolean;
  onToggleMotion?: () => void;
  onSelectActor?: (employeeId: string) => void;
  onOpenEmployee?: (employeeId: string, origin: HTMLButtonElement) => void;
  onOpenPlanning?: (employeeId: string, mode: "day" | "week") => void;
  employeeSheetDisabled?: boolean;
};
const STATIONS: Array<{ id: KqStaffStation; title: string; art: KqPrintedArtKind; purpose: string }> = [
  { id: "culture", title: "Culture", art: "culture", purpose: "Préparer le travail de culture." },
  { id: "processing", title: "Transformation", art: "warehouse", purpose: "Préparer le travail de transformation." },
  { id: "communication", title: "Communication", art: "social", purpose: "Faire connaître la ferme." },
  { id: "sales", title: "Prospection", art: "commerce", purpose: "Rencontrer des boutiques en ville ou à la campagne." },
  { id: "administration", title: "Administration", art: "accounts", purpose: "Négocier auprès des fournisseurs." },
  { id: "training", title: "Formation", art: "staff", purpose: "Faire progresser une compétence." },
  { id: "trim", title: "Trim · Atelier", art: "harvest", purpose: "Rejoindre le trim commun à la main ou à la machine." },
];
const hours = (value: number) => value.toLocaleString("fr-FR") + " h";
const dateTime = (value: string) => new Date(value).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
type Gesture = { pointerId: number; employeeId: string; startX: number; startY: number; x: number; y: number; dragging: boolean; touch: boolean; source: HTMLButtonElement };
type DragPreview = { employeeId: string; x: number; y: number; station: KqStaffStation | null };

function availability(employee: KqStaffEmployee, snapshot: KqStaffSnapshot) {
  const leave = employee.leave.find(period => snapshot.calendar.day >= period.startDay && snapshot.calendar.day <= period.endDay);
  const capacity = getKqStaffCapacity(employee, snapshot.calendar);
  if (leave) return "Congé payé jusqu’au jour " + leave.endDay;
  if (snapshot.calendar.weekend) return "Repos du week-end";
  if (!capacity.baseHours) return "Repos prévu au contrat";
  if (capacity.remainingHours <= 0) return "Toutes les heures sont réservées";
  return hours(capacity.remainingHours) + " disponibles aujourd’hui";
}

function stationContext(station: KqStaffStation, snapshot: KqStaffSnapshot) {
  if (station === "culture") {
    const count = snapshot.context.activeRuns.length;
    return count ? count + (count > 1 ? " cultures" : " culture") : snapshot.context.cultureWorkVersion === 1 ? "Réserve possible avant la culture" : "Aucune culture active";
  }
  if (station === "processing") {
    const count = new Set(snapshot.context.processingBatches.map(batch => batch.flowerId)).size;
    return count ? count + (count > 1 ? " lots en préparation" : " lot en préparation") : snapshot.context.processingWorkVersion === 1 ? "Réserve possible avant le lot" : "Aucun lot en préparation";
  }
  if (station === "sales") return "Villes et campagnes";
  if (station === "training") return "Salariés";
  if (station === "trim") {
    if (!snapshot.context.trimLots) return "Récoltes à vérifier";
    const count = snapshot.context.trimLots.filter(lot => !lot.completedAt && lot.completedWork < lot.requiredWork).length;
    return count ? count + (count > 1 ? " récoltes à préparer" : " récolte à préparer") : "Aucun trim en attente";
  }
  return station === "communication" ? "Faire connaître la ferme" : "Négocier les fournitures";
}

function taskTarget(task: KqStaffTask, snapshot: KqStaffSnapshot) {
  if (task.kind === "culture") return task.cultureShift && !task.targetId ? "Toutes les cultures" : snapshot.context.activeRuns.find(run => run.id === task.targetId)?.name;
  if (task.kind === "processing") return task.processingShift && !task.targetId ? "Toutes les transformations" : snapshot.context.processingBatches.find(batch => batch.flowerId === task.targetId)?.name;
  if (task.kind === "trim") return task.trimQueue ? "Atelier commun" : snapshot.context.trimLots?.find(lot => lot.flowerId === task.targetId)?.name;
  if (task.kind === "sales") return KQ_STAFF_CITIES.find(city => city.id === task.cityId)?.name;
  if (task.kind === "countryside") return "Campagnes · " + task.department;
  if (task.kind === "training") return KQ_STAFF_SKILLS[task.skill];
  return null;
}

export function KqStaffWorkPlan({ snapshot, disabled = false, onAssign, renderPortrait, selectedStation, renderPlayerPortrait, renderScenePortrait = renderPortrait, renderPlayerScenePortrait = renderPlayerPortrait, snapshotReceivedAt, motionPaused = false, onToggleMotion, onSelectActor, onOpenEmployee, onOpenPlanning, employeeSheetDisabled = false }: KqStaffWorkPlanProps) {
  const titleId = useId(), instructionId = useId(), stationsTitleId = useId();
  const rootRef = useRef<HTMLElement>(null);
  const motion = useKqSceneMotion<HTMLElement>(motionPaused || disabled);
  const sceneRef = motion.ref;
  const setRoot = useCallback((node: HTMLElement | null) => { rootRef.current = node; sceneRef(node); }, [sceneRef]);
  const [clock, setClock] = useState<{ serverNow: string; receivedAt?: number; now: number } | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const suppressClickUntil = useRef(0);
  const knownTasks = useRef(new Set(snapshot.state.tasks.map(task => task.id)));
  const [selectedId, setSelectedId] = useState("player");
  const [drag, setDrag] = useState<DragPreview | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [arrivedTaskIds, setArrivedTaskIds] = useState<string[]>([]);
  const employees = snapshot.state.employees.filter(employee => employee.status === "active");
  const canHandlePayroll = (employeeId: string) => snapshot.context.staffBenefitsVersion === 1 && canKqStaffAssignWithOutstandingPayroll(snapshot.state, employeeId, "administration");
  const workday = getKqPlayerWorkday(snapshot);
  const people = [
    { id: "player", name: "Toi", identity: "Ton personnage", remaining: workday.remainingHours, total: workday.dailyHours, availability: workday.remainingHours > 0 ? "Ta journée, week-end compris" : "Toutes tes heures sont réservées", portrait: renderPlayerPortrait ?? <UserRound size={36} /> },
    ...employees.map(employee => {
      const capacity = getKqStaffCapacity(employee, snapshot.calendar);
      const contract = employee.contract === "cdi" ? "CDI" : employee.contract === "cdd" ? "CDD" : "Saisonnier";
      return { id: employee.id, name: employee.name, identity: `${contract} · ${hours(employee.weeklyHours)} / sem.`, remaining: capacity.remainingHours, total: capacity.baseHours + capacity.extraHours, availability: availability(employee, snapshot), portrait: renderPortrait(employee) };
    }),
  ];
  const selected = people.find(person => person.id === selectedId) ?? people[0];
  const dragged = people.find(person => person.id === drag?.employeeId);
  const activeTasks = snapshot.state.tasks.filter(task => task.status !== "completed");
  const hasActiveTasks = activeTasks.length > 0;
  const estimatedNow = clock?.serverNow === snapshot.serverNow && clock.receivedAt === snapshotReceivedAt ? clock.now : Date.parse(snapshot.serverNow);
  useEffect(() => {
    const anchor = snapshotReceivedAt ?? performance.now();
    const update = () => setClock({ serverNow: snapshot.serverNow, receivedAt: snapshotReceivedAt, now: Date.parse(snapshot.serverNow) + Math.max(0, performance.now() - anchor) });
    const frame = requestAnimationFrame(update);
    const timer = hasActiveTasks && motion.visible ? window.setInterval(update, 1000) : undefined;
    return () => { cancelAnimationFrame(frame); window.clearInterval(timer); };
  }, [snapshot.serverNow, snapshotReceivedAt, hasActiveTasks, motion.visible]);

  useEffect(() => {
    // Only a new task in a server snapshot earns arrival feedback. Opening or
    // cancelling an assignment, refreshing, and remounting never imply success.
    const arrivals = snapshot.state.tasks.filter(task => task.status !== "completed" && !knownTasks.current.has(task.id));
    knownTasks.current = new Set(snapshot.state.tasks.map(task => task.id));
    if (!arrivals.length) return;
    const frame = requestAnimationFrame(() => {
      setArrivedTaskIds(arrivals.map(task => task.id));
      setAnnouncement(arrivals.length === 1 ? "Travail enregistré. Le portrait est maintenant à son poste." : "Travaux enregistrés. Les portraits sont maintenant à leurs postes.");
    });
    return () => cancelAnimationFrame(frame);
  }, [snapshot.state.tasks]);
  useEffect(() => {
    if (!arrivedTaskIds.length) return;
    const timer = window.setTimeout(() => setArrivedTaskIds([]), 4200);
    return () => window.clearTimeout(timer);
  }, [arrivedTaskIds]);

  const stationAt = useCallback((x: number, y: number): KqStaffStation | null => {
    const element = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-staff-work-station]");
    if (!element || !rootRef.current?.contains(element)) return null;
    return STATIONS.find(station => station.id === element.dataset.staffWorkStation)?.id ?? null;
  }, []);
  const cancelGesture = useCallback((announce = false) => {
    const current = gesture.current;
    gesture.current = null;
    if (current?.source.hasPointerCapture(current.pointerId)) current.source.releasePointerCapture(current.pointerId);
    if (current?.dragging) suppressClickUntil.current = performance.now() + 400;
    setDrag(null);
    if (announce && current?.dragging) setAnnouncement("Déplacement annulé. Aucune affectation enregistrée.");
  }, []);
  useEffect(() => {
    const cancel = () => cancelGesture(true);
    const key = (event: KeyboardEvent) => { if (event.key === "Escape" && gesture.current) { event.preventDefault(); cancel(); } };
    const visibility = () => { if (document.hidden) cancel(); };
    window.addEventListener("blur", cancel);
    window.addEventListener("keydown", key);
    document.addEventListener("visibilitychange", visibility);
    return () => { window.removeEventListener("blur", cancel); window.removeEventListener("keydown", key); document.removeEventListener("visibilitychange", visibility); cancelGesture(); };
  }, [cancelGesture]);
  useEffect(() => {
    const current = gesture.current;
    const unavailable = current && current.employeeId !== "player" && !snapshot.state.employees.some(employee => employee.id === current.employeeId && employee.status === "active");
    if (!disabled && !unavailable) return;
    const frame = requestAnimationFrame(() => cancelGesture(true));
    return () => cancelAnimationFrame(frame);
  }, [disabled, snapshot.state.employees, cancelGesture]);
  const draggingId = drag?.employeeId;
  useEffect(() => {
    if (!draggingId) return;
    let frame = 0;
    const scroll = () => {
      const current = gesture.current;
      if (!current?.dragging) return;
      const edge = 64;
      const velocity = current.y < edge ? -Math.ceil((edge - current.y) / 5) : current.y > window.innerHeight - edge ? Math.ceil((current.y - window.innerHeight + edge) / 5) : 0;
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const scrollTop = Math.min(maxScroll, Math.max(0, window.scrollY + Math.max(-12, Math.min(12, velocity))));
      if (scrollTop !== window.scrollY) {
        window.scrollTo({ top: scrollTop, behavior: "instant" });
        const station = stationAt(current.x, current.y);
        setDrag(previous => previous && previous.station !== station ? { ...previous, station } : previous);
      }
      frame = requestAnimationFrame(scroll);
    };
    frame = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(frame);
  }, [draggingId, stationAt]);

  function selectActor(employeeId: string) {
    if (selected.id !== employeeId) onSelectActor?.(employeeId);
    setSelectedId(employeeId);
  }
  function prepare(employeeId: string, station: KqStaffStation) {
    const person = people.find(person => person.id === employeeId);
    if (disabled || !person) return;
    if (employeeId === "player" && station === "training") { setAnnouncement("La formation est réservée aux salariés. Tes compétences progressent avec ton travail."); return; }
    selectActor(employeeId);
    setAnnouncement("Préparation pour " + person.name + " : " + STATIONS.find(item => item.id === station)!.title + ".");
    onAssign(employeeId, station);
  }
  function pointerDown(event: PointerEvent<HTMLButtonElement>, employeeId: string) {
    if (disabled || !event.isPrimary || event.button !== 0) return;
    // The portrait is the touch handle; the rest of the pawn still allows vertical page scrolling.
    if (event.pointerType === "touch" && !(event.target as HTMLElement).closest("[data-staff-work-drag-handle]")) return;
    gesture.current = { pointerId: event.pointerId, employeeId, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, dragging: false, touch: event.pointerType === "touch", source: event.currentTarget };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function pointerMove(event: PointerEvent<HTMLButtonElement>) {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId || disabled) return;
    current.x = event.clientX; current.y = event.clientY;
    if (!current.dragging && Math.hypot(current.x - current.startX, current.y - current.startY) < (current.touch ? 12 : 8)) return;
    if (!current.dragging) { current.dragging = true; selectActor(current.employeeId); setAnnouncement("Dépose le portrait dans un poste pour préparer le travail. Échap annule."); }
    event.preventDefault();
    setDrag({ employeeId: current.employeeId, x: current.x, y: current.y, station: stationAt(current.x, current.y) });
  }
  function pointerUp(event: PointerEvent<HTMLButtonElement>) {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const station = current.dragging ? stationAt(event.clientX, event.clientY) : null;
    cancelGesture();
    if (!current.dragging) return;
    event.preventDefault();
    if (station) prepare(current.employeeId, station);
    else setAnnouncement("Déplacement annulé : choisis une pièce du plan. Aucune affectation enregistrée.");
  }
  function taskRow(task: KqStaffTask, detailed = false, recordSelector = !detailed) {
    const target = taskTarget(task, snapshot);
    const activity = getKqStaffTaskActivity(task, estimatedNow);
    const future = activity === "queued";
    const person = people.find(person => person.id === task.employeeId);
    const employee = snapshot.state.employees.find(employee => employee.id === task.employeeId);
    const reservation = task.cultureShift || task.processingShift;
    const consumed = task.processingShift ? task.processingUsedHours : task.cultureUsedHours;
    const state = activity === "completed" ? reservation ? "Réserve clôturée" : "Terminé" : future ? "À venir" : activity === "available" ? "Disponible" : activity === "waiting" ? reservation && consumed !== undefined && consumed >= task.hours ? "Réserve épuisée" : "À vérifier" : "En cours";
    const arrived = arrivedTaskIds.includes(task.id);
    return <li key={task.id} data-staff-work-task={recordSelector ? task.id : undefined} data-task-employee={task.employeeId} data-task-station={task.kind} data-task-activity={activity} data-task-arrived={arrived || undefined}>
      {!detailed ? <span className={styles.occupantPortrait} aria-hidden="true">{person?.portrait ?? (employee ? renderPortrait(employee) : <UserRound size={22} />)}</span> : null}
      <span className={styles.taskText}><strong>{person?.name ?? employee?.name ?? "Ancien employé"}</strong><span className={styles.taskState}>{activity === "queued" || activity === "waiting" ? <Clock3 size={12} aria-hidden="true" /> : activity === "working" ? <Hammer size={12} aria-hidden="true" /> : <Check size={12} aria-hidden="true" />}{reservation && consumed !== undefined ? `${hours(Math.max(0, task.hours - consumed))} / ${hours(task.hours)}` : hours(task.hours)} · {state}</span>
        {arrived && !detailed ? <span className={styles.arrivalStamp}><Check size={12} aria-hidden="true" /> Affecté</span> : null}
        {reservation ? <small>{consumed === undefined ? "Consommation à vérifier" : `${hours(consumed)} consommées`} · {task.processingShift ? "selon le volume transformé" : "0,5 h par étape"}</small> : null}
        {detailed ? <><span>{target}</span><small>{future ? "Début : " + dateTime(task.startedAt) : (reservation ? "Fin de la réserve : " : task.status === "completed" ? "Fin : " : "Fin prévue : ") + dateTime(task.completesAt)}</small></> : null}
      </span>
    </li>;
  }

  return <section ref={setRoot} className={styles.workPlan} data-staff-work-plan data-plan-motion={motion.status} aria-labelledby={titleId} aria-describedby={instructionId}>
    <header className={styles.heading}><div className={styles.headingRow}><h3 id={titleId}>Ton équipe</h3><span className={styles.teamCount}>Toi{employees.length ? ` + ${employees.length} salarié${employees.length > 1 ? "s" : ""}` : " · aucun salarié"}</span></div><p id={instructionId}>{people.some(person => person.remaining > 0 && (person.id === "player" || snapshot.outstandingCents <= 0 || canHandlePayroll(person.id))) ? "Choisis un portrait puis un poste, ou glisse-le dessus." : snapshot.context.weeklyPlanVersion === 1 ? "Consulte les fiches ou prépare la semaine type pour les prochains jours." : "Consulte les fiches ou prépare le planning pour les prochains jours."}</p></header>
    <div className={styles.employees} role="group" aria-label="Choisir qui travaille">
      {people.map(person => <div key={person.id} className={styles.employeeCard} data-staff-person-card={person.id} data-selected={selected.id === person.id || undefined} data-resting={person.total <= 0 || undefined} role="group" aria-label={"Journée de " + person.name}>
        <button type="button" className={styles.employee} data-staff-work-employee={person.id} data-no-capacity={person.remaining <= 0} data-dragging={drag?.employeeId === person.id || undefined} aria-label={`Choisir ${person.name} · ${person.availability}`} aria-pressed={selected.id === person.id} disabled={disabled} title={person.availability}
          onPointerDown={event => pointerDown(event, person.id)} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={() => cancelGesture(true)} onLostPointerCapture={() => { if (gesture.current?.employeeId === person.id) cancelGesture(true); }}
          onClick={event => { if (event.detail > 0 && performance.now() < suppressClickUntil.current) return; selectActor(person.id); setAnnouncement(person.name + " sélectionné. Choisis un poste pour préparer le travail."); }}>
          <span className={styles.portrait} data-staff-work-drag-handle aria-hidden="true">{person.portrait}<GripVertical size={13} className={styles.grip} /></span>
          {selected.id === person.id ? <Check size={15} className={styles.selectedMark} aria-hidden="true" /> : null}
        </button>
        <div className={styles.personText}><strong>{person.name}</strong><span>{person.identity}</span>{selected.id === person.id ? <span className={styles.selectionState}><Check size={12} aria-hidden="true" />Sélectionné</span> : null}</div>
        <div className={styles.employeeCapacity}>
          {person.total > 0 ? <KqProgressMeter label="Heures disponibles" value={person.remaining} max={person.total} valueLabel={hours(person.remaining) + " / " + hours(person.total)} /> : <p className={styles.restingState}><Pause size={17} aria-hidden="true" /><strong>{person.availability}</strong></p>}
          {person.total > 0 && (person.remaining <= 0 || person.id === "player") ? <p className={styles.capacityNote}>{person.availability}</p> : null}
        </div>
        {person.id !== "player" && (onOpenEmployee || onOpenPlanning) ? <div className={styles.employeeActions}>
          {onOpenEmployee ? <button type="button" className={styles.employeeSheet} data-staff-open-employee={person.id} aria-label={`Voir la fiche de ${person.name}`} aria-haspopup="dialog" disabled={employeeSheetDisabled} onClick={event => onOpenEmployee(person.id, event.currentTarget)}><ContactRound size={15} aria-hidden="true" />Voir la fiche</button> : null}
          {onOpenPlanning ? <button type="button" className={styles.employeePlanning} data-staff-open-weekly={person.id} aria-label={`Ouvrir la semaine type de ${person.name}`} disabled={disabled} onClick={() => onOpenPlanning(person.id, "week")}><CalendarDays size={15} aria-hidden="true" />Semaine type</button> : null}
        </div> : null}
      </div>)}
    </div>
    {snapshot.outstandingCents > 0 ? <p className={styles.warning}>{employees.some(employee => canHandlePayroll(employee.id)) ? "Des salaires sont échus. Le responsable autorisé peut travailler en Administration pour les régler ; les autres affectations salariées attendent le paiement." : "Des salaires sont échus. Les dossiers peuvent être consultés ; règle la paie avant de confier un nouveau travail."}</p> : null}
    <section className={styles.stations} aria-labelledby={stationsTitleId}>
      <header className={styles.heading}>
        <div className={styles.headingRow}><h3 id={stationsTitleId}>{selected.remaining > 0 && (selected.id === "player" || snapshot.outstandingCents <= 0 || canHandlePayroll(selected.id)) ? "Choisir un poste" : "Les postes de la ferme"}</h3>{onToggleMotion ? <button type="button" className={styles.motionToggle} data-staff-plan-motion-toggle aria-pressed={motionPaused} onClick={onToggleMotion}>{motionPaused ? <Play size={15} aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />}{motionPaused ? "Reprendre les animations" : "Pause des animations"}</button> : null}</div>
        <p className={styles.selectedContext}><span className={styles.contextPortrait} aria-hidden="true">{selected.portrait}</span><span><strong>{selected.name}</strong> · {selected.availability}</span></p>
        {hasActiveTasks ? <p className={styles.clockNote}>Horaires estimés. Les résultats s’affichent après confirmation.</p> : null}
      </header>
    <div className={styles.floor} aria-label="Postes de la ferme">
      {STATIONS.map(station => {
        const belongs = (task: KqStaffTask) => (task.kind === "countryside" ? "sales" : task.kind) === station.id;
        const tasks = activeTasks.filter(belongs);
        const activity = getKqStaffStationActivity(tasks, estimatedNow);
        const lead = activity.lead;
        const actor = lead ? snapshot.state.employees.find(employee => employee.id === lead.employeeId) : undefined;
        const sceneActor = lead?.employeeId === "player" ? { id: "player", portrait: renderPlayerScenePortrait ?? <UserRound size={42} /> } : actor ? { id: actor.id, portrait: renderScenePortrait(actor) } : undefined;
        const leadActivity = lead ? getKqStaffTaskActivity(lead, estimatedNow) : "idle";
        const activityLabel = [activity.working.length ? `${activity.working.length} en cours` : "", activity.available.length ? `${activity.available.length} réserve${activity.available.length > 1 ? "s" : ""} disponible${activity.available.length > 1 ? "s" : ""}` : "", activity.queued.length ? `${activity.queued.length} à venir` : "", activity.waiting.length ? `${activity.waiting.length} à vérifier` : ""].filter(Boolean).join(" · ");
        const history = snapshot.state.tasks.filter(task => belongs(task) && task.status === "completed");
        const employeeOnly = selected.id === "player" && station.id === "training";
        const hovered = !!dragged && drag?.station === station.id && !(dragged.id === "player" && station.id === "training");
        const chosen = selectedStation === station.id;
        const previewPerson = hovered ? dragged : chosen ? selected : undefined;
        const arrived = tasks.some(task => arrivedTaskIds.includes(task.id));
        return <section key={station.id} className={styles.room} data-staff-work-station={station.id} data-drop-target={hovered || undefined} data-selected={chosen || undefined} data-task-arrival={arrived || undefined} aria-label={station.title}>
          <button type="button" className={styles.stationButton} data-staff-station={station.id} disabled={disabled || employeeOnly} onClick={() => prepare(selected.id, station.id)} aria-pressed={chosen} aria-label={(station.id === "trim" ? "Ouvrir le trim dans l’Atelier" : "Préparer une tâche : " + station.title) + " avec " + selected.name + (employeeOnly ? " — réservé aux salariés" : "")} title={station.purpose}>
            <KqStaffStationScene station={station.id} art={station.art} actor={sceneActor} activity={leadActivity === "completed" ? "idle" : leadActivity === "available" ? "queued" : leadActivity} paused={motionPaused || disabled}>{previewPerson ? <span className={styles.placementPreview} data-staff-placement-preview={hovered ? "drop" : "preparing"} aria-hidden="true"><span className={styles.previewPortrait}>{previewPerson.portrait}</span><span>À préparer</span></span> : null}</KqStaffStationScene>
            <span className={styles.stationSign}>{station.title}{station.id === "trim" ? <ArrowUpRight size={15} aria-hidden="true" /> : null}</span>
          </button>
          <p className={styles.context}>{hovered ? "Déposer pour préparer" : stationContext(station.id, snapshot)}</p>
          {tasks.length ? <p className={styles.activitySummary} data-station-summary>{activityLabel}</p> : null}
          {tasks.length ? <ul className={styles.occupants}>{tasks.slice(0, 2).map(task => taskRow(task))}</ul> : null}
          {tasks.length || history.length ? <details className={styles.taskDetails}><summary>{tasks.length > 2 ? `${tasks.length - 2} autres travaux · détails` : tasks.length ? "Détails des travaux" : `${Math.min(history.length, 3)} derniers terminés`}</summary>
            <ul className={styles.tasks}>{tasks.map((task, index) => taskRow(task, true, index >= 2))}{history.slice(-3).reverse().map(task => taskRow(task, true))}</ul>
          </details> : null}
        </section>;
      })}
    </div>
    </section>
    <p className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">{announcement}</p>
    {drag && dragged ? <div className={styles.dragGhost} data-staff-drag-preview data-ready={!!drag.station && !(dragged.id === "player" && drag.station === "training")} aria-hidden="true" style={{ left: Math.max(92, Math.min(window.innerWidth - 92, drag.x)), top: Math.max(104, drag.y - 12) }}><span className={styles.ghostPortrait}>{dragged.portrait}</span><span className={styles.ghostText}><strong>{dragged.name}</strong><small>{dragged.id === "player" && drag.station === "training" ? "Réservé aux salariés" : drag.station ? STATIONS.find(station => station.id === drag.station)?.title : "Choisis un poste"}</small></span></div> : null}
  </section>;
}
