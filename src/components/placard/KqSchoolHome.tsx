"use client";

import { BellRing, LibraryBig, Pause, Play, Trophy } from "lucide-react";
import { useState } from "react";
import type { QuizzShowDestination } from "./world/quizzshow-renderer";
import { KqQuizzShowScene } from "./KqQuizzShowScene";
import styles from "./KqSchoolHome.module.css";

const destinations = [
  { id: "tournament", title: "Tournoi", detail: "Les quatre pupitres", icon: BellRing },
  { id: "ranking", title: "Classement", detail: "Scores et palmarès", icon: Trophy },
  { id: "learn", title: "Encyclopédie", detail: "La grande bibliothèque", icon: LibraryBig },
] as const;

export function KqSchoolHome({ onChoose }: {
  onChoose: (section: "tournament" | "learn" | "ranking") => void;
}) {
  const [focus, setFocus] = useState<QuizzShowDestination | null>(null);
  const [paused, setPaused] = useState(false);
  return <nav className={styles.home} aria-label="Les espaces de QuizzShow" data-school-home>
    <KqQuizzShowScene mode="hall" onChoose={onChoose} focus={focus} motion={!paused} />
    <div className={styles.signs}>
      {destinations.map(({ id, title, detail, icon: Icon }) =>
        <button key={id} type="button" className={styles.sign} onClick={() => onChoose(id)} data-school-destination={id}
          onFocus={() => setFocus(id)} onBlur={() => setFocus(null)} onPointerEnter={() => setFocus(id)}
          onPointerLeave={event => { if (!event.currentTarget.matches(":focus-visible")) setFocus(null); }}>
          <Icon size={24} strokeWidth={1.8} aria-hidden="true" />
          <span><strong>{title}</strong><small>{detail}</small></span>
        </button>
      )}
    </div>
    <button type="button" className={`${styles.sign} ${styles.motion}`} aria-pressed={paused} onClick={() => setPaused(value => !value)}>
      {paused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />} Pause des animations
    </button>
  </nav>;
}
