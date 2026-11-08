"use client";

import { useEffect, useRef } from "react";
import { KqStaffOperationsConfirmation, KqStaffOperationsStatus, KqStaffTaskList, useKqStaffOperations } from "./KqStaffOperations";
import { KqTrimWorkbench } from "./KqTrimWorkbench";
import { useKqSocialPlayer } from "./useKqSocialPlayer";
import styles from "./KqStaffDesk.module.css";

export type KqWorkshopTrimDeskProps = {
  initialFlowerId?: string;
  initialEmployeeId?: string;
  onOpenHarvests?: (flowerId: string) => void;
  onBusyChange?: (busy: boolean) => void;
  disabled?: boolean;
};

/** The workshop owns trim operations; employees keep the same shared daily hours. */
export function KqWorkshopTrimDesk({ initialFlowerId, initialEmployeeId, onOpenHarvests, onBusyChange, disabled = false }: KqWorkshopTrimDeskProps) {
  const player = useKqSocialPlayer();
  const controller = useKqStaffOperations("Atelier de trim");
  const { snapshot, snapshotReceivedAt, loading, error, busy, pending, prepare } = controller;
  const locked = busy || !!pending;
  const busyListener = useRef(onBusyChange);
  useEffect(() => { busyListener.current = onBusyChange; onBusyChange?.(locked); }, [locked, onBusyChange]);
  useEffect(() => () => { busyListener.current?.(false); }, []);
  return <section className={styles.desk} data-workshop-trim-desk>
    <KqStaffOperationsStatus controller={controller} label="Atelier de trim" disabled={disabled || locked} />
    {snapshot ? <>
      <KqTrimWorkbench key={initialEmployeeId ?? "player"} snapshot={snapshot} snapshotReceivedAt={snapshotReceivedAt} playerProfile={player.profile} prepare={prepare} initialFlowerId={initialFlowerId} initialEmployeeId={initialEmployeeId} onOpenHarvests={onOpenHarvests} disabled={disabled || locked || loading || !!error} stale={!!error} />
      <KqStaffTaskList snapshot={snapshot} tasks={snapshot.state.tasks.filter(task => task.kind === "trim" && task.status === "completed")} title="Travaux de trim terminés" />
    </> : null}
    <KqStaffOperationsConfirmation controller={controller} />
  </section>;
}
