"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Clock3, Pause, Play, Scissors } from "lucide-react";
import type { ChanvrierAvatarProfile } from "@/lib/arena-chanvrier";
import { ChanvrierAvatar } from "../contest/ChanvrierAvatar";
import type { KqStaffSnapshot, KqStaffTrimLot, KqStaffTrimMode } from "@/lib/kanab-quest-staff-types";
import { KqStaffPortrait } from "./KqStaffPortrait";
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

const artPath = "/placard/atelier-motion/";

/** Generated cutout layers share a fixed camera; only articulated parts move. */
function TrimTool({ mode, active = false }: { mode?: KqStaffTrimMode; active?: boolean }) {
  const sizes = "(max-width: 680px) 42vw, 280px";
  if (mode === "machine") return <div className={styles.machine} aria-hidden="true" data-trim-tool-active={active}>
    <Image src={`${artPath}trimmer-body-v1.webp`} width={640} height={640} sizes={sizes} alt="" draggable={false} data-trim-static-art="machine-body" />
    <div className={styles.rotorPlane}><Image src={`${artPath}trimmer-rotor-v1.webp`} className={styles.rotor} width={640} height={640} sizes={sizes} alt="" draggable={false} data-trim-moving-part="rotor" /></div>
    <Image src={`${artPath}trimmer-body-v1.webp`} className={styles.machineFront} width={640} height={640} sizes={sizes} alt="" draggable={false} data-trim-static-art="machine-front" />
  </div>;
  if (mode === "manual") return <span data-trim-tool-active={active}>
    <Image src={`${artPath}trim-flower-v1.webp`} className={styles.flower} width={512} height={512} sizes="(max-width: 680px) 24vw, 160px" alt="" draggable={false} data-trim-static-art="flower" />
    <div className={styles.scissors} aria-hidden="true">
      <Image src={`${artPath}scissors-lower-v1.webp`} className={styles.scissorLower} width={640} height={640} sizes={sizes} alt="" draggable={false} data-trim-tool-layer="scissors-lower" data-trim-moving-part="blade-lower" />
      <Image src={`${artPath}scissors-upper-v1.webp`} className={styles.scissorBlade} width={640} height={640} sizes={sizes} alt="" draggable={false} data-trim-moving-part="blade" />
    </div>
  </span>;
  return null;
}

export function KqTrimScene({ snapshot, workerId = "player", mode = "manual", stale = false, snapshotReceivedAt, playerProfile, paused, onPausedChange }: Props) {
  const { ref: sceneRef, motionEnabled, status, reducedMotion, visible } = useKqSceneMotion<HTMLElement>(paused);
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
  const preview = actors.length ? actors.slice(0, 3).map(actor => ({ id: actor.id, mode: actor.task.trimMode })) : [{ id: workerId, mode }];
  const manual = actors.length ? actors.some(actor => actor.task.trimMode === "manual") : mode === "manual";
  const machine = actors.length ? actors.some(actor => actor.task.trimMode === "machine") : mode === "machine";
  const toolMode = manual && machine ? "mixed" : machine ? "machine" : "manual";
  const actorName = (id: string) => id === "player" ? "Toi" : snapshot.state.employees.find(employee => employee.id === id)?.name ?? "Salarié indisponible";
  const portrait = (id: string) => {
    const employee = snapshot.state.employees.find(person => person.id === id);
    return employee ? <KqStaffPortrait person={employee} view="full" /> : id === "player" && playerProfile ? <ChanvrierAvatar profile={playerProfile} view="full" /> : null;
  };
  const stateLabel = (value: string) => value === "working" ? "Au travail" : value === "queued" ? "À venir" : value === "waiting-harvest" ? "En attente de fleurs" : "Résultat à confirmer";
  return <section ref={sceneRef} className={`${styles.scene} ${styles.shared}`} aria-label="L’équipe à l’atelier" data-trim-scene data-trim-phase={phase} data-trim-mode={toolMode} data-motion-state={status} data-tools-moving={phase === "working" && motionEnabled}>
    <div className={styles.heading}><strong className={styles.phase}>{phase === "working" ? <Scissors size={17} aria-hidden="true" /> : <Clock3 size={17} aria-hidden="true" />}{stale ? "Données à actualiser" : working.length ? `${working.length} personne${working.length > 1 ? "s" : ""} au travail` : actors.length ? "Travaux réservés" : "L’atelier est prêt"}</strong><div className={styles.motionControl}><button type="button" aria-label={paused ? "Reprendre l’animation du trim" : "Mettre en pause l’animation du trim"} aria-pressed={paused} onClick={() => onPausedChange(!paused)} data-trim-motion-toggle>{paused ? <Play size={15} aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />}{paused ? "Reprendre" : "Pause"}</button>{reducedMotion ? <small>Mouvement réduit</small> : null}</div></div>
    <div className={styles.stage} data-trim-cast-size={preview.length}>
      <Image className={styles.bench} src={`${artPath}trim-bench-v1.webp`} width={1152} height={768} sizes="(max-width: 680px) 90vw, 660px" alt="" draggable={false} data-trim-static-art="bench" />
      {preview.map((actor, index) => <span key={actor.id} className={styles.portrait} data-trim-position={index} aria-hidden="true" data-trim-character={actor.id === "player" ? "player" : "employee"} data-trim-worker-id={actor.id}>{portrait(actor.id)}</span>)}
      <Image className={styles.benchFront} src={`${artPath}trim-bench-v1.webp`} width={1152} height={768} sizes="(max-width: 680px) 90vw, 660px" alt="" draggable={false} data-trim-static-art="bench-front" />
      {manual ? <TrimTool mode="manual" active={working.some(actor => actor.task.trimMode === "manual")} /> : null}
      {machine ? <TrimTool mode="machine" active={working.some(actor => actor.task.trimMode === "machine")} /> : null}
    </div>
    {actors.length > preview.length ? <p className={styles.note}>{actors.length - preview.length} autres personnes suivent le planning ci-dessous.</p> : null}
    <dl className={styles.facts}><div><dt>Cadence de l’équipe au travail</dt><dd data-trim-current-rate>{rate === null ? "À vérifier" : `${number(rate)} g / h de jeu`}</dd></div></dl>
    {actors.length ? <ul className={styles.workers}>{actors.map(actor => <li key={actor.id} data-trim-worker-row={actor.id} data-trim-worker-state={actor.phase}>
      <div><strong>{actorName(actor.id)}</strong><span>{stateLabel(actor.phase)} · {actor.task.trimMode === "machine" ? "Machine" : "Manuel"}</span></div>
      <div><span>{typeof actor.task.trimRateGramsPerHour === "number" ? `${number(actor.task.trimRateGramsPerHour)} g / h de jeu` : "Ancienne tâche · cadence en grammes non renseignée"}</span><span>{number(actor.task.hours)} h réservées</span></div>
      {typeof actor.task.trimGrams === "number" ? <small data-trim-confirmed-work>{number(actor.task.trimGrams)} g confirmés pour cette tâche</small> : null}
      <small>{actor.phase === "queued" ? `Début prévu le ${dateTime(actor.task.startedAt)}, après ses missions réservées.` : actor.phase === "working" ? `Fin prévue le ${dateTime(actor.task.completesAt)}. Temps écoulé estimé : ${minutes(now - Date.parse(actor.task.startedAt))}.` : actor.phase === "waiting-harvest" ? `Créneau réservé jusqu’au ${dateTime(actor.task.completesAt)}. Le travail pourra reprendre si des fleurs compatibles arrivent.` : "Actualise pour confirmer l’avancement ; les grammes affichés restent ceux du serveur."}</small>
      {actor.otherTasks.length ? <details><summary>{actor.otherTasks.length} autre{actor.otherTasks.length > 1 ? "s" : ""} créneau{actor.otherTasks.length > 1 ? "x" : ""} réservé{actor.otherTasks.length > 1 ? "s" : ""}</summary><ul>{actor.otherTasks.map(({ task, phase: taskPhase }) => <li key={task.id}>{stateLabel(taskPhase)} · {task.trimMode === "machine" ? "Machine" : "Manuel"} · {number(task.hours)} h · du {dateTime(task.startedAt)} au {dateTime(task.completesAt)}</li>)}</ul></details> : null}
    </li>)}</ul> : <p className={styles.note}>{actorName(workerId)} peut rejoindre l’atelier avec les réglages ci-dessous.</p>}
    <p className={styles.note}>Les grammes confirmés évoluent à l’actualisation. Une personne sans fleurs compatibles garde ses heures réservées.</p>
  </section>;
}
