"use client";

import { BookOpen, ChevronRight, Sprout, Trophy } from "lucide-react";
import { type ArenaLobbyMode } from "@/lib/arena-lobby";
import { type KeyboardEvent } from "react";
import Link from "next/link";
import styles from "@/components/contest/ContestArena.module.css";
import retro from "./ArenaRetro.module.css";

export type ContestArenaView = "hub" | "jouer" | "carnet" | "classement";

const VIEWS = [
  { id: "carnet", label: "Carnet", href: "/arene/carnet/regular", Icon: BookOpen },
  { id: "jouer", label: "Jouer", href: "/arene/placard", Icon: Sprout },
  { id: "classement", label: "Classement", href: "/arene?vue=classement", Icon: Trophy },
] as const;

export function ArenaNavigation({ activeView, previewMode, onPreviewMode }: {
  activeView: ContestArenaView;
  previewMode?: ArenaLobbyMode;
  onPreviewMode?: (mode: ArenaLobbyMode) => void;
}) {
  const navigateModes = (event: KeyboardEvent<HTMLElement>) => {
    if (!onPreviewMode || !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const links = Array.from(event.currentTarget.querySelectorAll<HTMLAnchorElement>("a[data-mode]"));
    const current = links.findIndex((link) => link === document.activeElement);
    if (current < 0) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? links.length - 1
      : (current + (event.key === "ArrowDown" ? 1 : -1) + links.length) % links.length;
    links[next]?.focus();
  };
  if (activeView === "hub") {
    return (
      <nav className={retro.modeMenu} aria-label="Espaces de l'Arène" onKeyDown={navigateModes}>
        {VIEWS.map(({ id, label, href, Icon }, index) => (
          <Link key={id} href={href} className={retro.modeCard} data-featured={id === "jouer" || undefined}
            data-mode={id} data-preview={previewMode === id || undefined}
            onPointerEnter={() => onPreviewMode?.(id)} onFocus={() => onPreviewMode?.(id)}>
            <span className={retro.modeIcon}><Icon aria-hidden="true" /></span>
            <span><small>0{index + 1} · {id === "carnet" ? "Dégustation" : id === "jouer" ? "Le Placard" : "Records"}</small><strong>{label}</strong></span>
            <ChevronRight aria-hidden="true" />
          </Link>
        ))}
      </nav>
    );
  }
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
