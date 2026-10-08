"use client";

import dynamic from "next/dynamic";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, Check, RotateCcw, X } from "lucide-react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { ARENA_PLAYABLE_LESSONS, type ArenaLessonProgress, type ArenaPlayableLessonId } from "@/lib/arena-playable-learning";
import { resetKqPlayableOperationsLesson } from "@/lib/kanab-quest-operations-session";
import styles from "./ArenaPlayableLesson.module.css";

const loading = () => <p role="status" className={styles.loading}>Préparation de ton espace de jeu…</p>;
const Culture = dynamic(() => import("../placard/KqPlayableCultureLesson").then(module => module.KqPlayableCultureLesson), { ssr: false, loading });
const Operations = dynamic(() => import("../placard/KqPlayableOperationsLesson").then(module => module.KqPlayableOperationsLesson), { ssr: false, loading });
const Treasury = dynamic(() => import("../placard/KqTreasuryTutorial").then(module => module.KqTreasuryTutorial), { ssr: false, loading });
const Discovery = dynamic(() => import("./ArenaPlayableDiscovery").then(module => module.ArenaPlayableDiscovery), { ssr: false, loading });

export function ArenaPlayableLesson({ lesson, onClose, onCompleted }: { lesson: ArenaPlayableLessonId; onClose: () => void; onCompleted: (id: ArenaPlayableLessonId) => void }) {
  const definition = ARENA_PLAYABLE_LESSONS.find(item => item.id === lesson)!;
  const [progress, setProgress] = useState<ArenaLessonProgress>({ instruction: definition.instruction, complete: false });
  const [generation, setGeneration] = useState(0);
  const [coachHost, setCoachHost] = useState<HTMLElement | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const recorded = useRef(false);
  useBodyScrollLock(true);
  const updateProgress = useCallback((next: ArenaLessonProgress) => setProgress(current => current.instruction === next.instruction && current.complete === next.complete ? current : next), []);
  useEffect(() => {
    if (progress.complete && !recorded.current) { recorded.current = true; onCompleted(lesson); }
  }, [progress.complete, lesson, onCompleted]);
  useLayoutEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement;
    element?.showModal();
    return () => { element?.close(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  useEffect(() => {
    const element = dialog.current;
    // Some real game screens open their own native dialog. Keep the coach in
    // that same top layer so instructions and the exit remain reachable.
    const sync = () => {
      const inner = element?.querySelectorAll<HTMLDialogElement>("dialog[open]");
      setCoachHost(inner?.length ? inner[inner.length - 1] : element);
    };
    const observer = new MutationObserver(sync);
    if (element) observer.observe(element, { childList: true, subtree: true, attributes: true, attributeFilter: ["open"] });
    sync();
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const coachElement = coachHost?.querySelector<HTMLElement>("[data-playable-coach]");
    if (!coachElement) return;
    const resize = new ResizeObserver(() => dialog.current?.style.setProperty("--arena-lesson-coach-height", `${Math.ceil(coachElement.getBoundingClientRect().height) + 20}px`));
    resize.observe(coachElement);
    return () => resize.disconnect();
  }, [coachHost]);
  const restart = () => {
    if (lesson === "equipment" || lesson === "warehouse" || lesson === "market") {
      resetKqPlayableOperationsLesson(lesson);
    } else if (lesson === "cards" || lesson === "culture" || lesson === "jury") {
      try {
        const prefix = `kq-playable-lesson-v2:discovery-visual:${lesson}:`;
        const keys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index));
        for (const key of keys) if (key?.startsWith(prefix)) localStorage.removeItem(key);
      } catch { /* The lesson remains playable when storage is unavailable. */ }
    }
    setProgress({ instruction: definition.instruction, complete: false });
    setGeneration(value => value + 1);
  };
  const coach = <aside className={styles.coach} data-playable-coach data-complete={progress.complete || undefined} data-collapsed={collapsed || undefined}>
    <div className={styles.coachBar}><strong>DIDACTICIEL · {definition.title}</strong><button type="button" onClick={onClose} aria-label="Quitter cet essai"><X size={18} aria-hidden="true" /></button></div>
    {!collapsed ? <><p role="status">{progress.instruction}</p><small>Partie d’essai · inventaire et euros fictifs</small></> : null}
    <div className={styles.actions}>
      <button type="button" className={styles.return} onClick={onClose}>{progress.complete ? <Check size={17} aria-hidden="true" /> : <ArrowLeft size={17} aria-hidden="true" />}{progress.complete ? "Essai terminé · Explorer la suite" : "Les possibilités"}</button>
      <button type="button" onClick={() => setCollapsed(value => !value)} aria-expanded={!collapsed}>{collapsed ? "Voir la consigne" : "Réduire"}</button>
      <button type="button" onClick={restart} aria-label="Recommencer cet essai"><RotateCcw size={17} aria-hidden="true" /></button>
    </div>
  </aside>;
  return <dialog ref={dialog} className={styles.dialog} data-playable-lesson={lesson} aria-label={`Didacticiel : ${definition.title}`}
    onCancel={event => { if (event.target !== dialog.current) return; event.preventDefault(); onClose(); }}>
    <div className={styles.stage} key={generation}>
      {lesson === "cards" || lesson === "culture" || lesson === "jury" ? <Culture lesson={lesson} scope="discovery-visual" onClose={onClose} onProgress={updateProgress} />
        : lesson === "equipment" || lesson === "warehouse" || lesson === "market" ? <Operations lesson={lesson} onProgress={updateProgress} />
          : lesson === "bank" || lesson === "investments" || lesson === "business" ? <Treasury lesson={lesson} onProgress={updateProgress} />
            : <Discovery lesson={lesson} onClose={onClose} onProgress={updateProgress} />}
    </div>
    {coachHost ? createPortal(coach, coachHost) : null}
  </dialog>;
}
