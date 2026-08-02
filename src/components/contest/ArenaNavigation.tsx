"use client";

import { BookOpen, ChevronRight, Sprout, Trophy } from "lucide-react";
import styles from "@/components/contest/ContestArena.module.css";

export type ContestArenaView = "jouer" | "carnet" | "classement";

const VIEWS = [
  { id: "carnet", label: "Carnet", Icon: BookOpen },
  { id: "jouer", label: "Jouer", Icon: Sprout },
  { id: "classement", label: "Classement", Icon: Trophy },
] as const;

export function ArenaNavigation({ activeView, onChange }: {
  activeView: ContestArenaView;
  onChange: (view: ContestArenaView) => void;
}) {
  return (
    <>
      <nav className={styles.primaryTabs} aria-label="Espaces de l'Arène">
        {VIEWS.map(({ id, label, Icon }) => (
          <button key={id} type="button" className={activeView === id ? styles.primaryTabActive : undefined}
            aria-current={activeView === id ? "page" : undefined} onClick={() => onChange(id)}>
            <Icon aria-hidden="true" /><span>{label}</span>
          </button>
        ))}
      </nav>
      <div className={styles.progressPromise} aria-label="Comment progresser dans l'Arène">
        <span><BookOpen aria-hidden="true" /><strong>Remplis ton Carnet</strong></span>
        <ChevronRight aria-hidden="true" />
        <span><Sprout aria-hidden="true" /><strong>Joue au Placard</strong></span>
        <ChevronRight aria-hidden="true" />
        <span><Trophy aria-hidden="true" /><strong>Grimpe au classement</strong></span>
      </div>
    </>
  );
}
