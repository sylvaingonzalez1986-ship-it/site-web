"use client";

import Image from "next/image";
import Link from "@/components/navigation/NavigationLink";
import { ArrowLeft, ArrowUpRight, BookOpen, Gift, Ticket } from "lucide-react";
import type { KeyboardEvent, ReactNode } from "react";
import { KqPrintedArt } from "@/components/placard/KqPrintedArt";
import { KqProgressMeter } from "@/components/placard/KqVisuals";
import styles from "./AlbumArena.module.css";

export type AlbumDestination = "boosters" | "cards" | "rewards";
export const ALBUM_DESTINATIONS = [
  { id: "boosters", label: "Boosters", icon: Ticket, art: "buddies-pack" },
  { id: "cards", label: "Cartes", icon: BookOpen, art: "buddies-cards" },
  { id: "rewards", label: "Récompenses", icon: Gift, art: "album-rewards" },
] as const;

export function AlbumArenaLobby({ packs, owned, total, rewards, points, onNavigate, welcome, notice }: {
  packs: number | null; owned: number; total: number; rewards: number; points: number | null;
  onNavigate: (destination: AlbumDestination) => void;
  welcome?: ReactNode;
  notice?: ReactNode;
}) {
  const descriptions = {
    boosters: packs === null ? "Packs indisponibles · actualise" : `${packs} booster${packs > 1 ? "s" : ""} à ouvrir`,
    cards: `${owned} / ${total} cartes Buddies`,
    rewards: `${rewards} page${rewards > 1 ? "s" : ""} avec un lot à récupérer`,
  };
  const keyboard = (event: KeyboardEvent<HTMLElement>) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button"));
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (index < 0) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next]?.focus();
  };

  return <div className={styles.lobby} data-album-lobby>
    <header className={styles.topBar}>
      <h1>Mon album</h1>
      <Link data-album-return href="/arene" className={styles.returnLink}><ArrowLeft aria-hidden="true" /><span>L’Arène</span></Link>
    </header>
    {notice}
    <div className={styles.lobbyBody}>
      <div className={styles.overview}>
        <KqProgressMeter label="Collection Buddies" value={owned} max={total} valueLabel={`${owned} / ${total} cartes`} />
        <p>{points === null ? "Points indisponibles" : <><strong>{points.toLocaleString("fr-FR")}</strong> points disponibles</>}</p>
      </div>
      <div className={styles.stage} aria-hidden="true">
        <Image src="/app/lottery/sylvain-booster-presentation-v3.webp" alt="" width={1024} height={1536} priority sizes="(max-width: 700px) 260px, 450px" className={styles.mascot} />
      </div>
      <nav className={styles.destinations} aria-label="Choisir un espace de l’album" onKeyDown={keyboard}>
        {ALBUM_DESTINATIONS.map(({ id, label, art }) => <button key={id} type="button" data-album-mode-button={id} onClick={() => onNavigate(id)}>
          <KqPrintedArt kind={art} className={styles.destinationArt} sizes="80px" />
          <span><strong>{label}</strong><small>{descriptions[id]}</small></span>
          <ArrowUpRight aria-hidden="true" />
        </button>)}
      </nav>
      {welcome && <div className={styles.lobbyWelcome}>{welcome}</div>}
    </div>
  </div>;
}
