"use client";

import type { KqPlayerWorkAvailability } from "@/lib/kanab-quest-player-work";
import { KqProgressMeter } from "./KqVisuals";
import { KqPlayerWorkDetails } from "./KqPlayerWorkDetails";
import styles from "./KqPlayerWorkStatus.module.css";

const hours = (value: number) => `${value.toLocaleString("fr-FR")} h`;

/** Read the same workday as the Quartier team panel, including reserved hours. */
export function KqQuarterWorkHelp({ availability }: { availability: KqPlayerWorkAvailability }) {
  const workday = availability.status === "ready" ? availability.workday : null;
  return <aside className={styles.status} aria-label="Ta réserve de travail" data-player-work-status data-tutorial-ready={!!workday}>
    {workday ? <KqProgressMeter label="Temps libre aujourd’hui" value={workday.remainingHours} max={workday.dailyHours}
      valueLabel={`${hours(workday.remainingHours)} / ${hours(workday.dailyHours)}`} tone={workday.remainingHours ? "teal" : "red"} />
      : <p role="status">{availability.status === "loading" ? "Vérification du temps disponible…" : "Temps de travail indisponible."}</p>}
    <details><summary>Temps des activités et prochaine journée</summary>
      <KqPlayerWorkDetails workday={workday} skills={availability.status === "ready" ? availability.skills ?? null : null} />
    </details>
  </aside>;
}
