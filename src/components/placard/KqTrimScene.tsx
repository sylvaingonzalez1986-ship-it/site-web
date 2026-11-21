"use client";

import { useEffect, useRef, useState } from "react";
import { Clock3, Pause, Play, Scissors } from "lucide-react";
import type { ChanvrierAvatarProfile } from "@/lib/arena-chanvrier";
import type { KqStaffSnapshot, KqStaffTrimLot, KqStaffTrimMode } from "@/lib/kanab-quest-staff-types";
import { getKqStaffAvatarProfile } from "./KqStaffPortrait";
import { KqTrimWorld } from "./KqTrimWorld";
import { useKqSceneMotion } from "./useKqSceneMotion";
import { getKqStaffTaskActivity } from "@/lib/kanab-quest-staff-activity";
import styles from "./KqTrimScene.module.css";

type Props = {
  lot?: KqStaffTrimLot;
  snapshot: KqStaffSnapshot;
  workerId?: string;
  mode?: KqStaffTrimMode;
  preparing?: boolean;
  stale?: boolean;
  snapshotReceivedAt?: number;
  playerProfile?: ChanvrierAvatarProfile | null;
  paused: boolean;
  onPausedChange: (paused: boolean) => void;
};

const number = (value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
const dateTime = (value: string) => new Date(value).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const minutes = (milliseconds: number) => `${(Math.max(0, milliseconds) / 60000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} min`;

/** This clock estimates schedule time only. It never settles a task or adds work. */
function useEstimatedServerTime(serverNow: string, snapshotReceivedAt: number | undefined, ticking: boolean) {
  const anchor = useRef<{ source: string; receivedAt: number } | null>(null);
  const [clock, setClock] = useState({ source: serverNow, time: Date.parse(serverNow) });
  useEffect(() => {
    if (anchor.current?.source !== serverNow) anchor.current = { source: serverNow, receivedAt: performance.now() };
    if (!ticking) return;
    const receivedAt = snapshotReceivedAt ?? anchor.current.receivedAt;
    const tick = () => setClock({ source: serverNow, time: Date.parse(serverNow) + performance.now() - receivedAt });
    const frame = requestAnimationFrame(tick);
    const timer = window.setInterval(tick, 1000);
    return () => { cancelAnimationFrame(frame); window.clearInterval(timer); };
  }, [serverNow, snapshotReceivedAt, ticking]);
  return clock.source === serverNow ? clock.time : Date.parse(serverNow);
}

export function KqTrimScene({ snapshot, workerId = "player", mode = "manual", stale = false, snapshotReceivedAt, playerProfile, paused, onPausedChange }: Props) {
  const { ref: sceneRef, motionEnabled, status, reducedMotion, visible } = useKqSceneMotion<HTMLDivElement>(paused);
  const tasks = snapshot.state.tasks.filter(task => task.kind === "trim" && task.status === "running");
  const now = useEstimatedServerTime(snapshot.serverNow, snapshotReceivedAt, tasks.length > 0 && !stale && visible);
  const legacyBusy = new Set(tasks.filter(task => !task.trimQueue).map(task => task.targetId));
  const activities = tasks.map(task => {
    const phase = stale ? "waiting" as const : getKqStaffTaskActivity(task, now);
    const available = snapshot.context.trimLots?.some(lot => !lot.completedAt && typeof lot.totalGrams === "number" && typeof lot.completedGrams === "number"
      && lot.completedGrams < lot.totalGrams && (!lot.mode || lot.mode === task.trimMode) && !legacyBusy.has(lot.flowerId));
    return { task, phase: phase === "working" && task.trimQueue && !available ? "waiting-harvest" as const : phase };
  });
  const actors = [...new Set(tasks.map(task => task.employeeId))].map(id => {
    const own = activities.filter(item => item.task.employeeId === id);
    const current = own.find(item => item.phase === "working") ?? own.find(item => item.phase === "waiting") ?? own.find(item => item.phase === "waiting-harvest") ?? own[0];
    return { id, ...current, otherTasks: own.filter(item => item.task.id !== current.task.id) };
  }).sort((a, b) => Number(b.phase === "working") - Number(a.phase === "working") || a.task.startedAt.localeCompare(b.task.startedAt));
  const working = actors.filter(actor => actor.phase === "working");
  const knownRates = !stale && working.every(actor => typeof actor.task.trimRateGramsPerHour === "number" && Number.isFinite(actor.task.trimRateGramsPerHour));
  const rate = knownRates ? working.reduce((total, actor) => total + actor.task.trimRateGramsPerHour!, 0) : null;
  const phase = stale ? "waiting-server" : working.length ? "working" : actors.some(actor => actor.phase === "waiting") ? "waiting-server" : actors.length ? "queued" : "preparing";
  const preview = actors.length ? actors.slice(0, 3).map(actor => ({ id: actor.id, mode: actor.task.trimMode, working: actor.phase === "working" })) : [{ id: workerId, mode, working: false }];
  const cast = preview.map(actor => {
    const { id } = actor;
    const employee = snapshot.state.employees.find(person => person.id === id);
    return { ...actor, profile: id === "player" ? playerProfile : employee ? getKqStaffAvatarProfile(employee) : null };
  });
  const manual = cast.some(actor => actor.mode !== "machine");
  const machine = cast.some(actor => actor.mode === "machine");
  const toolMode = manual && machine ? "mixed" : machine ? "machine" : "manual";
  const actorName = (id: string) => id === "player" ? "Toi" : snapshot.state.employees.find(employee => employee.id === id)?.name ?? "Salarié indisponible";
  const stateLabel = (value: string) => value === "working" ? "Au travail" : value === "queued" ? "À venir" : value === "waiting-harvest" ? "En attente de fleurs" : "Résultat à confirmer";
  return <section className={styles.scene} aria-label="L’équipe à l’atelier" data-trim-scene data-trim-phase={phase} data-trim-mode={toolMode} data-motion-state={status} data-tools-moving={phase === "working" && motionEnabled}>
    <div className={styles.heading}><strong className={styles.phase}>{phase === "working" ? <Scissors size={17} aria-hidden="true" /> : <Clock3 size={17} aria-hidden="true" />}{stale ? "Données à actualiser" : working.length ? `${working.length} personne${working.length > 1 ? "s" : ""} au travail` : actors.length ? "Travaux réservés" : "L’atelier est prêt"}</strong><div className={styles.motionControl}><button type="button" aria-label={paused ? "Reprendre l’animation du trim" : "Mettre en pause l’animation du trim"} aria-pressed={paused} onClick={() => onPausedChange(!paused)} data-trim-motion-toggle>{paused ? <Play size={15} aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />}{paused ? "Reprendre" : "Pause"}</button>{reducedMotion ? <small>Mouvement réduit</small> : null}</div></div>
    <div className={styles.layout}>
      <KqTrimWorld actors={cast} mode={toolMode} motion={motionEnabled} viewportRef={sceneRef} />
      <div className={styles.register}>
        <dl className={styles.facts}><div><dt>Cadence de l’équipe au travail</dt><dd data-trim-current-rate>{rate === null ? "À vérifier" : `${number(rate)} g / h de jeu`}</dd></div></dl>
        {actors.length > preview.length ? <p className={styles.note}>{actors.length - preview.length} autres personnes figurent dans le planning.</p> : null}
        {actors.length ? <ul className={styles.workers}>{actors.map(actor => <li key={actor.id} data-trim-worker-row={actor.id} data-trim-worker-state={actor.phase}>
          <div><strong>{actorName(actor.id)}</strong><span>{stateLabel(actor.phase)} · {actor.task.trimMode === "machine" ? "Machine" : "Manuel"}</span></div>
          <div><span>{typeof actor.task.trimRateGramsPerHour === "number" ? `${number(actor.task.trimRateGramsPerHour)} g / h de jeu` : "Ancienne tâche · cadence en grammes non renseignée"}</span><span>{number(actor.task.hours)} h réservées</span></div>
          {typeof actor.task.trimGrams === "number" ? <small data-trim-confirmed-work>{number(actor.task.trimGrams)} g confirmés pour cette tâche</small> : null}
          <small>{actor.phase === "queued" ? `Début prévu le ${dateTime(actor.task.startedAt)}, après ses missions réservées.` : actor.phase === "working" ? `Fin prévue le ${dateTime(actor.task.completesAt)}. Temps écoulé estimé : ${minutes(now - Date.parse(actor.task.startedAt))}.` : actor.phase === "waiting-harvest" ? `Créneau réservé jusqu’au ${dateTime(actor.task.completesAt)}. Le travail pourra reprendre si des fleurs compatibles arrivent.` : "Actualise pour confirmer l’avancement. Les grammes affichés restent ceux du serveur."}</small>
          {actor.otherTasks.length ? <details><summary>{actor.otherTasks.length} autre{actor.otherTasks.length > 1 ? "s" : ""} créneau{actor.otherTasks.length > 1 ? "x" : ""} réservé{actor.otherTasks.length > 1 ? "s" : ""}</summary><ul>{actor.otherTasks.map(({ task, phase: taskPhase }) => <li key={task.id}>{stateLabel(taskPhase)} · {task.trimMode === "machine" ? "Machine" : "Manuel"} · {number(task.hours)} h · du {dateTime(task.startedAt)} au {dateTime(task.completesAt)}</li>)}</ul></details> : null}
        </li>)}</ul> : <p className={styles.note}>{actorName(workerId)} peut rejoindre l’atelier avec les réglages ci-dessous.</p>}
        <p className={styles.note}>Les grammes confirmés évoluent à l’actualisation. Une personne sans fleurs compatibles garde ses heures réservées.</p>
      </div>
    </div>
  </section>;
}
