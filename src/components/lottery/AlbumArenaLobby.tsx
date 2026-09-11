"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, BookOpen, Gift, Ticket } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import lobby from "@/components/contest/ArenaLobby.module.css";
import retro from "@/components/contest/ArenaRetro.module.css";
import styles from "./AlbumArena.module.css";

export type AlbumDestination = "boosters" | "cards" | "rewards";
export const ALBUM_DESTINATIONS = [
  { id: "boosters", label: "Boosters", icon: Ticket },
  { id: "cards", label: "Cartes", icon: BookOpen },
  { id: "rewards", label: "Récompenses", icon: Gift },
] as const;

export function AlbumArenaLobby({ packs, owned, total, rewards, points, onNavigate, onOpenPack, welcome }: {
  packs: number; owned: number; total: number; rewards: number; points: number;
  onNavigate: (destination: AlbumDestination) => void;
  onOpenPack: () => void;
  welcome?: React.ReactNode;
}) {
  const [selected, setSelected] = useState<AlbumDestination>("boosters");
  const descriptions = {
    boosters: { title: "Mes boosters", caption: packs ? `${packs} booster${packs > 1 ? "s" : ""} à ouvrir. La prochaine carte t’attend.` : "Ton prochain booster t’attend. Échange tes points pour l’obtenir.", action: packs ? "Ouvrir un booster" : "Obtenir des boosters" },
    cards: { title: "Ma collection", caption: `${owned} / ${total} cartes Buddies. Retrouve aussi tes cartes du Placard.`, action: "Feuilleter mon album" },
    rewards: { title: "Mes récompenses", caption: rewards ? `${rewards} page${rewards > 1 ? "s" : ""} complète${rewards > 1 ? "s" : ""} : tes récompenses sont prêtes.` : "Complète tes pages et recycle tes doublons pour débloquer tes gains.", action: "Voir mes récompenses" },
  };
  const mode = descriptions[selected];
  const keyboard = (event: KeyboardEvent<HTMLElement>) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button"));
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (index < 0) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next]?.focus();
  };

  return <div className={`${retro.surface} ${lobby.lobby} ${styles.lobby}`} data-album-lobby data-album-mode={selected}>
    <div className={styles.ambience} aria-hidden="true" />
    <header className={lobby.topBar}>
      <div className={lobby.brand}><span>Kanab Quest</span><h1>Mon album.</h1></div>
      <Link href="/arene" className={lobby.sound}><ArrowLeft aria-hidden="true" /><span>L’Arène</span></Link>
    </header>
    <div className={styles.stage} aria-hidden="true">
      <div className={styles.halo} />
      <Image src="/app/lottery/charles-booster-presentation-v2.png" alt="" width={1024} height={1536} priority sizes="(max-width: 700px) 90vw, 650px" className={styles.mascot} />
    </div>
    <div className={lobby.dock}>
      <div className={lobby.modeBrief} aria-live="polite" aria-atomic="true">
        <span>Collection · {String(ALBUM_DESTINATIONS.findIndex(item => item.id === selected) + 1).padStart(2, "0")} / 03</span>
        <h2>{mode.title}</h2><p>{mode.caption}</p>
      </div>
      <nav className={lobby.modeSelector} aria-label="Choisir un espace de l’album" onKeyDown={keyboard}>
        {ALBUM_DESTINATIONS.map(({ id, label, icon: Icon }) => <button key={id} type="button" data-album-mode-button={id} aria-pressed={selected === id} onClick={() => setSelected(id)} onFocus={() => setSelected(id)}><Icon aria-hidden="true" /><span>{label}</span></button>)}
      </nav>
      <button type="button" className={lobby.enter} data-album-enter onClick={() => selected === "boosters" && packs > 0 ? onOpenPack() : onNavigate(selected)}><span>{mode.action}</span><ArrowUpRight aria-hidden="true" /></button>
      <div className={`${lobby.help} ${styles.resources}`}>
        <span>{owned}/{total} cartes</span><span>{points} points</span>
        <button type="button" onClick={() => onNavigate("boosters")}>Obtenir des boosters <ArrowUpRight size={14} aria-hidden="true" /></button>
        {welcome}
      </div>
    </div>
  </div>;
}
