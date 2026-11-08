"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { KqPrintedArt, type KqPrintedArtKind } from "./KqPrintedArt";
import type { KqStaffStation } from "./KqStaffWorkPlan";
import { useKqSceneMotion } from "./useKqSceneMotion";
import styles from "./KqStaffStationScene.module.css";

type Props = {
  station: KqStaffStation;
  art: KqPrintedArtKind;
  actor?: { id: string; portrait: ReactNode };
  activity: "working" | "queued" | "waiting" | "idle";
  paused: boolean;
  children?: ReactNode;
};

const tools: Partial<Record<KqStaffStation, string>> = {
  culture: "watering-can",
  communication: "studio-phone",
  sales: "welcome-folder",
  administration: "welcome-folder",
  training: "training-book",
};

/** The parent supplies a confirmed task and its real actor; this scene only decorates it. */
export function KqStaffStationScene({ station, art, actor, activity, paused, children }: Props) {
  const { ref, motionEnabled, status } = useKqSceneMotion<HTMLSpanElement>(paused);
  const occupant = activity === "idle" ? undefined : actor;
  const tool = occupant ? tools[station] : undefined;

  return <span ref={ref} className={styles.scene} aria-hidden="true"
    data-staff-station-scene={station}
    data-station-activity={activity}
    data-station-actor={occupant?.id}
    data-station-motion={status}
    data-station-animated={!!occupant && activity === "working" && motionEnabled}>
    <KqPrintedArt kind={art} className={styles.vignette} sizes="(max-width: 600px) 115px, 190px" />
    {occupant ? <span className={styles.actor} data-station-moving-part="actor">{occupant.portrait}</span> : null}
    {tool ? <span className={styles.tool} data-station-moving-part="tool" data-station-tool={tool}>
      <Image src={`/placard/staff-motion/${tool}-v1.webp`} width={512} height={512} sizes="32px" alt="" draggable={false} />
    </span> : null}
    {children ? <span className={styles.preview}>{children}</span> : null}
  </span>;
}
