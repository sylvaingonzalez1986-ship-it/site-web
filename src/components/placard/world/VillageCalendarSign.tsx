import { Moon, Sun, Sunrise, Sunset } from "lucide-react";
import { KqProgressMeter } from "../KqVisuals";
import type { VillageCalendar } from "./village-calendar";
import styles from "./VillagePrototype.module.css";

const seasons = { spring: "Printemps", summer: "Été", autumn: "Automne", winter: "Hiver" };
const phases = {
  dawn: { label: "Aube", Icon: Sunrise },
  day: { label: "Journée", Icon: Sun },
  dusk: { label: "Crépuscule", Icon: Sunset },
  night: { label: "Nuit", Icon: Moon },
};

export function VillageCalendarSign({ calendar }: { calendar: VillageCalendar }) {
  const { month, dayOfMonth, minuteOfDay, phase, season } = calendar;
  const { label, Icon } = phases[phase];
  const hours = Math.floor(minuteOfDay / 60);
  const minutes = String(minuteOfDay % 60).padStart(2, "0");
  return <section className={styles.calendar} aria-label="Calendrier du quartier"
    data-village-season={season} data-village-phase={phase} data-sylvain-target="quarter" tabIndex={-1}>
    <Icon className={styles.calendarIcon} size={24} aria-hidden="true" strokeWidth={1.75} />
    <div className={styles.calendarBody}>
      <div className={styles.calendarDate}><b>Mois {month} · Jour {dayOfMonth}</b><span>{seasons[season]}</span></div>
      <KqProgressMeter label={label} value={minuteOfDay} max={1440} valueLabel={`${hours} h ${minutes}`} />
    </div>
  </section>;
}
