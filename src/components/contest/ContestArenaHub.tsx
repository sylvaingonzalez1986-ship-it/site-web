"use client";

import Image from "next/image";
import Link from "@/components/navigation/NavigationLink";
import { useEffect, useRef, useState, type PointerEvent, type KeyboardEvent } from "react";
import { ArrowUpRight, Gift, BookOpen, Gamepad2, Trophy, Target, X } from "lucide-react";
import { ArenaFirstVisitTutorial } from "@/components/contest/ArenaFirstVisitTutorial";
import { ARENA_LOBBY_MODES, ARENA_LOBBY_MODE_ORDER, type ArenaLobbyMode } from "@/lib/arena-lobby";
import retro from "@/components/contest/ArenaRetro.module.css";
import styles from "./ArenaLobby.module.css";

import { ArenaPrelaunchCharacter } from "./ArenaPrelaunchCharacter";
import { ARENA_OPENING_MESSAGE } from "@/lib/arena-opening";
import opening from "./ArenaPrelaunch.module.css";

const MODE_ICONS = { carnet: BookOpen, jouer: Gamepad2, classement: Trophy };

export function ContestArenaHub({ activitiesLocked = false, initialMode = "jouer", initialNotice = false }: { activitiesLocked?: boolean; initialMode?: ArenaLobbyMode; initialNotice?: boolean }) {
  const [selected, setSelected] = useState<ArenaLobbyMode>(initialMode);
  const [notice, setNotice] = useState(initialNotice);
  const mode = ARENA_LOBBY_MODES[selected];
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
  }, []);

  const preview = (next: ArenaLobbyMode) => {
    setSelected(next);
    setNotice(false);
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
      onPointerMove={moveScene} onPointerLeave={resetScene} onKeyDown={event => { if (event.key === "Escape") setNotice(false); }}>
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
      {activitiesLocked && <ArenaPrelaunchCharacter />}
      </header>

      <div className={styles.breathingRoom} aria-hidden="true" />
      <Link href="/arene?vue=classement" className={styles.rewardInvitation} onClick={activitiesLocked ? event => { event.preventDefault(); setSelected("classement"); setNotice(true); } : undefined}>
        <Gift aria-hidden="true" />
        <span><strong>Deviens le meilleur chanvrier.</strong><small>Note les fleurs que tu as goûtées, cultive les tiennes et monte au classement pour gagner une part des fleurs redistribuées en fin de saison.</small><b>Découvrir les fleurs à gagner <ArrowUpRight size={16} aria-hidden="true" /></b></span>
      </Link>
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
        {activitiesLocked ? <div className={opening.entry}>
          {notice && <div className={opening.bubble} role="status" id="arena-opening-notice">
            <button type="button" className={opening.dismiss} aria-label="Fermer le message" onClick={() => setNotice(false)}><X size={18} aria-hidden="true" /></button>
            <small>Ouverture de l’arène</small><strong>{ARENA_OPENING_MESSAGE}</strong>
            <p>Prépare ton personnage. Le Carnet, le Placard et le Classement arrivent bientôt !</p>
          </div>}
          <button type="button" className={styles.enter} data-lobby-enter aria-describedby={notice ? "arena-opening-notice" : undefined} onClick={() => setNotice(true)}><span>{mode.action}</span><ArrowUpRight aria-hidden="true" /></button>
        </div> : <Link href={mode.href} className={styles.enter} data-lobby-enter><span>{mode.action}</span><ArrowUpRight aria-hidden="true" /></Link>}
        <div className={styles.help}>
          {!activitiesLocked && <ArenaFirstVisitTutorial />}
          {activitiesLocked ? <>
            <button type="button" className={opening.helpButton} onClick={() => setNotice(true)}><Gift size={17} aria-hidden="true" />Pack des Pionniers</button>
            <button type="button" className={opening.helpButton} onClick={() => setNotice(true)}><Target size={17} aria-hidden="true" />Mes missions · Packs La Botte</button>
          </> : <><Link href="/profil/collection#pack-pionniers"><Gift size={17} aria-hidden="true" />Pack des Pionniers</Link><Link href="/arene/placard?view=missions"><Target size={17} aria-hidden="true" />Mes missions · Packs La Botte</Link></>}
        </div>
      </div>
    </main>
  );
}
