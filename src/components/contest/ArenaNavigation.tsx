"use client";

import { BookOpen, Sprout, Trophy } from "lucide-react";
import Link from "next/link";
import styles from "@/components/contest/ContestArena.module.css";

export type ContestArenaView = "hub" | "jouer" | "carnet" | "classement";

const VIEWS = [
  { id: "carnet", label: "Carnet", href: "/arene/carnet/regular", Icon: BookOpen },
  { id: "jouer", label: "Jouer", href: "/arene/placard", Icon: Sprout },
  { id: "classement", label: "Classement", href: "/arene?vue=classement", Icon: Trophy },
] as const;

export function ArenaNavigation({ activeView }: {
  activeView: ContestArenaView;
}) {
  return (
    <div className={styles.arenaNavigation}>
      <nav className={styles.primaryTabs} aria-label="Espaces de l'Arène">
        {VIEWS.map(({ id, label, href, Icon }) => (
          <Link
            key={id}
            href={href}
            className={activeView === id ? styles.primaryTabActive : undefined}
            aria-current={activeView === id ? "page" : undefined}
          >
            <Icon aria-hidden="true" /><span>{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
