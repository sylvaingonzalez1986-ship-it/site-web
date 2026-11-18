"use client";

import { BellRing, LibraryBig, Trophy } from "lucide-react";
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
  return <nav className={styles.home} aria-label="Les espaces de QuizzShow" data-school-home>
    <KqQuizzShowScene mode="hall" onChoose={onChoose} />
    <div className={styles.signs}>
      {destinations.map(({ id, title, detail, icon: Icon }) =>
        <button key={id} type="button" className={styles.sign} onClick={() => onChoose(id)} data-school-destination={id}>
          <Icon size={24} strokeWidth={1.8} aria-hidden="true" />
          <span><strong>{title}</strong><small>{detail}</small></span>
        </button>
      )}
    </div>
  </nav>;
}