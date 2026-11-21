"use client";

import { useId, useState } from "react";
import { createPortal } from "react-dom";
import { Clock3 } from "lucide-react";
import { AppDialog } from "@/components/ui/AppDialog";
import styles from "./KqActivityDuration.module.css";

const hoursLabel = (hours: number) => `${hours.toLocaleString("fr-FR")} h`;

export function KqActivityDuration({ label, hours, availableHours, minimumHours = .5, disabled, onChange }: {
  label: string;
  hours: number;
  availableHours: number;
  minimumHours?: number;
  disabled?: boolean;
  onChange: (hours: number) => void;
}) {
  const inputId = useId();
  const [draftHours, setDraftHours] = useState<number | null>(null);
  const maximumHours = Math.floor(availableHours * 2) / 2;
  const canChoose = maximumHours >= minimumHours;
  const selectedHours = Math.max(minimumHours, Math.min(draftHours ?? hours, maximumHours));

  return <>
    <button type="button" className={styles.trigger} data-activity-duration aria-haspopup="dialog" disabled={disabled}
      onClick={event => {
        event.currentTarget.focus({ preventScroll: true });
        setDraftHours(Math.round(hours * 2) / 2);
      }}>
      <Clock3 size={18} aria-hidden="true" /><span>{label}</span>{hours > 0 && <strong>{hoursLabel(hours)}</strong>}
    </button>
    {draftHours !== null && createPortal(<AppDialog open title="Durée de l’activité" onClose={() => setDraftHours(null)}
      className={styles.dialog} bodyClassName={styles.body} dialogProps={{ "data-activity-duration-dialog": true }}>
      <p>Temps disponible <strong>{hoursLabel(availableHours)}</strong></p>
      {canChoose ? <>
        <label htmlFor={inputId}>Durée en heures de jeu <strong aria-hidden="true">{hoursLabel(selectedHours)}</strong></label>
        <input id={inputId} type="range" min={minimumHours} max={maximumHours} step={.5} value={selectedHours} disabled={disabled}
          aria-valuetext={hoursLabel(selectedHours)} onChange={event => setDraftHours(event.target.valueAsNumber)} />
        <button type="button" className={styles.apply} disabled={disabled} onClick={() => { onChange(selectedHours); setDraftHours(null); }}>Appliquer la durée</button>
      </> : <p role="status">Cette activité demande au moins {hoursLabel(minimumHours)}.</p>}
    </AppDialog>, document.fullscreenElement ?? document.body)}
  </>;
}
