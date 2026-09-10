"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type PointerEvent, type KeyboardEvent } from "react";
import { ArrowUpRight, BookOpen, Gamepad2, Trophy, Volume2, VolumeX } from "lucide-react";
import { ArenaFirstVisitTutorial } from "@/components/contest/ArenaFirstVisitTutorial";
import { ARENA_LOBBY_MODES, ARENA_LOBBY_MODE_ORDER, type ArenaLobbyMode } from "@/lib/arena-lobby";
import { useArenaMenuSound } from "@/hooks/useArenaMenuSound";
import retro from "@/components/contest/ArenaRetro.module.css";
import styles from "./ArenaLobby.module.css";

const MODE_ICONS = { carnet: BookOpen, jouer: Gamepad2, classement: Trophy };

export function ContestArenaHub() {
  const [selected, setSelected] = useState<ArenaLobbyMode>("jouer");
  const mode = ARENA_LOBBY_MODES[selected];
  const sound = useArenaMenuSound();
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
  }, []);

  const preview = (next: ArenaLobbyMode) => {
    if (next !== selected) sound.play(ARENA_LOBBY_MODES[next].frequency);
    setSelected(next);
  };

  const navigateModes = (event: KeyboardEvent<HTMLElement>) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button[data-mode]"));
    const current = buttons.findIndex((button) => button === document.activeElement);
    if (current < 0) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1
      : (current + (["ArrowDown", "ArrowRight"].includes(event.key) ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next]?.focus();
  };

  const moveScene = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 8;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * 8;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      sceneRef.current?.style.setProperty("--scene-x", `${x}px`);
      sceneRef.current?.style.setProperty("--scene-y", `${y}px`);
      frameRef.current = null;
    });
  };

  const resetScene = () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    sceneRef.current?.style.setProperty("--scene-x", "0px");
    sceneRef.current?.style.setProperty("--scene-y", "0px");
  };

  return (
    <main data-world="arena" data-lobby-mode={selected} className={`${retro.surface} ${styles.lobby}`}
      onPointerMove={moveScene} onPointerLeave={resetScene}>
      <div className={styles.scene} ref={sceneRef}>
        {ARENA_LOBBY_MODE_ORDER.map((id) => {
          const scene = ARENA_LOBBY_MODES[id];
          return <div key={id} className={styles.sceneLayer} data-scene={id} data-active={selected === id || undefined} aria-hidden={selected !== id}>
            <div className={styles.imageFrame}>
              <Image src={scene.image} alt={scene.imageAlt} fill
                sizes="(max-width: 700px) 150vh, 100vw"
                priority={id === "jouer"} loading={id === "jouer" ? undefined : "eager"}
                fetchPriority={id === "jouer" ? "high" : "low"} />
            </div>
            <div className={styles.effects} aria-hidden="true"><i /><i /><i /></div>
          </div>;
        })}
      </div>
      <div className={styles.shade} aria-hidden="true" />

      <header className={styles.topBar}>
        <div className={styles.brand}><span>Kanab Quest</span><h1>L’Arène.</h1></div>
        <button type="button" className={styles.sound} onClick={sound.toggle} aria-pressed={sound.enabled} aria-label="Sons du menu">
          {sound.enabled ? <Volume2 aria-hidden="true" /> : <VolumeX aria-hidden="true" />}
          <span>Son {sound.enabled ? "ON" : "OFF"}</span>
        </button>
      </header>

      <div className={styles.breathingRoom} aria-hidden="true" />
      <div className={styles.dock}>
        <div className={styles.modeBrief} aria-live="polite" aria-atomic="true">
          <span>Mode {mode.number} / 03</span>
          <h2>{mode.name}</h2>
          <p>{mode.label}</p>
        </div>
        <nav className={styles.modeSelector} aria-label="Choisir un mode" onKeyDown={navigateModes}>
          {ARENA_LOBBY_MODE_ORDER.map((id) => {
            const Icon = MODE_ICONS[id];
            return <button key={id} type="button" data-mode={id} aria-pressed={selected === id}
              onClick={() => preview(id)} onFocus={() => preview(id)}>
              <Icon aria-hidden="true" /><span>{ARENA_LOBBY_MODES[id].name.replace("Le ", "")}</span>
            </button>;
          })}
        </nav>
        <Link href={mode.href} className={styles.enter} data-lobby-enter>
          <span>{mode.action}</span><ArrowUpRight aria-hidden="true" />
        </Link>
        <div className={styles.help}><ArenaFirstVisitTutorial /></div>
      </div>
    </main>
  );
}
