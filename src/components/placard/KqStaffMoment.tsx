"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { KQ_STAFF_CONTRACTS, KQ_STAFF_SKILLS } from "@/lib/kanab-quest-staff";
import type { KqStaffEmployee, KqStaffTask } from "@/lib/kanab-quest-staff-types";
import { KqStaffPortrait } from "./KqStaffPortrait";
import { useKqSceneMotion } from "./useKqSceneMotion";
import styles from "./KqStaffMoment.module.css";

/** A receipt created from a confirmed operation, never from a refreshed snapshot. */
export type KqStaffMoment = {
  id: string;
  kind: "hire" | "training";
  employee: KqStaffEmployee;
  task?: KqStaffTask;
  serverNow: string;
};

type Props = { moment: KqStaffMoment; onDismiss: () => void; onOpenEmployee: () => void; disabled?: boolean };
type Playback = { id: string; animations: Animation[]; finished: boolean };
const artPath = "/placard/staff-motion/";
const hours = (value: number) => `${value.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} h`;
const dateTime = (value: string) => new Date(value).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** One short reaction per receipt. Visibility only pauses decoration, never work. */
export function KqStaffMoment({ moment, onDismiss, onOpenEmployee, disabled = false }: Props) {
  const titleId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const { ref, motionEnabled, status, reducedMotion, visible } = useKqSceneMotion<HTMLElement>();
  const character = useRef<HTMLSpanElement>(null);
  const prop = useRef<HTMLDivElement>(null);
  const playback = useRef<Playback | null>(null);
  const [finishedId, setFinishedId] = useState<string | null>(null);
  const [deskReady, setDeskReady] = useState(false);
  const [propReady, setPropReady] = useState(false);
  const [avatarReady, setAvatarReady] = useState(false);
  const artworkReady = deskReady && propReady && avatarReady;
  const { employee } = moment;
  const task = moment.kind === "training" && moment.task?.kind === "training" && moment.task.employeeId === employee.id ? moment.task : undefined;
  const startsAt = task ? Date.parse(task.startedAt) : NaN;
  const endsAt = task ? Date.parse(task.completesAt) : NaN;
  const serverNow = Date.parse(moment.serverNow);
  const validSchedule = Number.isFinite(startsAt) && Number.isFinite(endsAt) && Number.isFinite(serverNow) && endsAt >= startsAt;
  const trainingState = !task ? "unavailable" : task.status === "completed" ? "completed" : !validSchedule || serverNow >= endsAt ? "waiting" : serverNow < startsAt ? "queued" : "in-progress";

  useEffect(() => { heading.current?.focus(); }, [moment.id]);

  useEffect(() => {
    const node = character.current;
    if (!node) return;
    const updateReady = () => {
      const state = node.querySelector("canvas")?.dataset.avatarState;
      if (state === "ready" || state === "error") setAvatarReady(true);
    };
    const observer = new MutationObserver(updateReady);
    observer.observe(node, { attributes: true, attributeFilter: ["data-avatar-state"], subtree: true });
    const frame = requestAnimationFrame(updateReady);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [moment.id]);

  useEffect(() => {
    if (playback.current && playback.current.id !== moment.id) {
      playback.current.animations.forEach(animation => animation.cancel());
      playback.current = null;
    }
    // Waiting for viewport readiness also avoids interpreting the server's safe
    // reduced-motion snapshot as the browser's actual preference on hydration.
    if (!playback.current) {
      if (!visible || !artworkReady || !character.current || !prop.current) return;
      const animations: Animation[] = [];
      if (typeof character.current.animate === "function") {
        animations.push(character.current.animate([
          { transform: "translate(-10px, 3px) rotate(-2deg)", offset: 0 },
          { transform: "translate(0, 0) rotate(0deg)", offset: .4 },
          { transform: "translate(0, 3px) rotate(1.8deg)", offset: .66 },
          { transform: "translate(0, 0) rotate(0deg)", offset: 1 },
        ], { duration: 1600, easing: "ease-in-out", iterations: 1 }));
        animations.push(prop.current.animate([
          { transform: "translateY(-7px) rotate(-6deg)", offset: 0 },
          { transform: "translateY(0) rotate(2deg)", offset: .55 },
          { transform: "translateY(-1px) rotate(-1deg)", offset: .75 },
          { transform: "translateY(0) rotate(0deg)", offset: 1 },
        ], { duration: 1800, easing: "ease-in-out", iterations: 1 }));
      }
      const current: Playback = { id: moment.id, animations, finished: false };
      playback.current = current;
      void Promise.all(animations.map(animation => animation.finished)).then(() => {
        current.finished = true;
        if (playback.current === current) setFinishedId(current.id);
      }).catch(() => { /* Replacing or dismissing a receipt cancels its decoration. */ });
    }
    const current = playback.current;
    if (current.finished) return;
    current.animations.forEach(animation => {
      if (reducedMotion) animation.finish();
      else if (motionEnabled) animation.play();
      else animation.pause();
    });
  }, [moment.id, motionEnabled, reducedMotion, visible, artworkReady]);

  useEffect(() => () => {
    playback.current?.animations.forEach(animation => animation.cancel());
    playback.current = null;
  }, []);

  return <section ref={ref} className={styles.moment} aria-labelledby={titleId} data-staff-moment={moment.kind} data-moment-id={moment.id} data-moment-ready={artworkReady} data-moment-motion={status === "running" && finishedId === moment.id ? "complete" : status}>
    <div className={styles.stage} aria-hidden="true">
      <Image className={styles.desk} src={`${artPath}staff-desk-v1.webp`} width={1152} height={768} sizes="(max-width: 600px) 250px, 300px" alt="" draggable={false} onLoad={() => setDeskReady(true)} onError={() => setDeskReady(true)} data-moment-static-art="desk" />
      <span ref={character} className={styles.character} data-moment-avatar={employee.id} data-moment-portrait={employee.portraitCode ?? employee.code} data-moment-moving-part="character"><KqStaffPortrait person={employee} view="full" /></span>
      <Image className={styles.deskFront} src={`${artPath}staff-desk-v1.webp`} width={1152} height={768} sizes="(max-width: 600px) 250px, 300px" alt="" draggable={false} data-moment-static-art="desk-front" />
      <div ref={prop} className={styles.prop} data-moment-moving-part={moment.kind === "hire" ? "folder" : "book"}><Image src={`${artPath}${moment.kind === "hire" ? "welcome-folder" : "training-book"}-v1.webp`} width={512} height={512} sizes="75px" alt="" draggable={false} onLoad={() => setPropReady(true)} onError={() => setPropReady(true)} /></div>
    </div>
    <div className={styles.content}>
      <h3 ref={heading} id={titleId} className={styles.title} tabIndex={-1}>{moment.kind === "hire" ? `${employee.name} rejoint l’équipe` : "Formation enregistrée"}</h3>
      {moment.kind === "hire" ? <dl className={styles.facts}>
        <div><dt>Contrat signé</dt><dd data-moment-contract>{KQ_STAFF_CONTRACTS[employee.contract]}</dd></div>
        <div><dt>Temps hebdomadaire</dt><dd data-moment-hours>{hours(employee.weeklyHours)} / semaine</dd></div>
        <div><dt>Tarif brut</dt><dd>{formatKqCash(employee.hourlyCents)} / h</dd></div>
      </dl> : <>
        <p className={styles.employee}>{employee.name}{task ? ` · ${KQ_STAFF_SKILLS[task.skill]}` : ""}</p>
        {task ? <dl className={styles.facts}>
          <div><dt>Temps réservé</dt><dd data-moment-hours>{hours(task.hours)}</dd></div>
          <div><dt>Paiement confirmé</dt><dd data-moment-cost>{formatKqCash(task.trainingCostCents)}</dd></div>
        </dl> : null}
        <p className={styles.note} data-moment-training-state={trainingState}>
          {trainingState === "queued" && task ? `À venir · début prévu le ${dateTime(task.startedAt)}.` : trainingState === "in-progress" && task ? `En cours · fin prévue le ${dateTime(task.completesAt)}.` : trainingState === "completed" ? "Formation terminée, résultat disponible dans le dossier." : trainingState === "waiting" ? "Horaire écoulé ou indisponible. Le résultat reste à confirmer." : "Les détails de la formation sont dans le dossier."}
        </p>
      </>}
      <div className={styles.actions}>
        <button type="button" className={styles.open} onClick={onOpenEmployee} disabled={disabled} data-moment-open-employee>Voir {employee.name}</button>
        <button type="button" className={styles.dismiss} onClick={onDismiss} disabled={disabled} data-moment-dismiss>Fermer le reçu</button>
      </div>
    </div>
  </section>;
}
