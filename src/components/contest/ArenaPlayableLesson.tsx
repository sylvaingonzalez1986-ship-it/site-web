"use client";

import dynamic from "next/dynamic";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, Check, RotateCcw } from "lucide-react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { ARENA_PLAYABLE_LESSONS, type ArenaLessonProgress, type ArenaPlayableLessonId } from "@/lib/arena-playable-learning";
import { resetKqPlayableOperationsLesson } from "@/lib/kanab-quest-operations-session";
import styles from "./ArenaPlayableLesson.module.css";
import { kqPlayableLessonPrefix } from "@/lib/kanab-quest-playable-lesson";
import { getReleveLessonGuide } from "@/lib/arena-releve-lesson-guide";
import { ArenaReleveGuide, ReleveGuideProvider } from "./ArenaReleveGuide";

const loading = () => <p role="status" className={styles.loading}>Préparation de ton espace de jeu…</p>;
const Culture = dynamic(() => import("../placard/KqPlayableCultureLesson").then(module => module.KqPlayableCultureLesson), { ssr: false, loading });
const Operations = dynamic(() => import("../placard/KqPlayableOperationsLesson").then(module => module.KqPlayableOperationsLesson), { ssr: false, loading });
const Treasury = dynamic(() => import("../placard/KqTreasuryTutorial").then(module => module.KqTreasuryTutorial), { ssr: false, loading });
const Discovery = dynamic(() => import("./ArenaPlayableDiscovery").then(module => module.ArenaPlayableDiscovery), { ssr: false, loading });

export function ArenaPlayableLesson({ lesson, onClose, onCompleted, embedded = false, coachContainer }: { lesson: ArenaPlayableLessonId; onClose: () => void; onCompleted: (id: ArenaPlayableLessonId) => void; embedded?: boolean; coachContainer?: HTMLElement | null }) {
  const definition = ARENA_PLAYABLE_LESSONS.find(item => item.id === lesson)!;
  const [progress, setProgress] = useState<ArenaLessonProgress>({ instruction: definition.instruction, complete: false });
  const [generation, setGeneration] = useState(0);
  const [acknowledgedSteps, setAcknowledgedSteps] = useState<string[]>([]);
  const [coachHost, setCoachHost] = useState<HTMLElement | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const embeddedElement = useRef<HTMLDivElement>(null);
  const recorded = useRef(false);
  useBodyScrollLock(!embedded);
  const updateProgress = useCallback((next: ArenaLessonProgress) => setProgress(current => current.instruction === next.instruction && current.complete === next.complete ? current : next), []);
  useEffect(() => {
    if (progress.complete && !recorded.current) { recorded.current = true; onCompleted(lesson); }
  }, [progress.complete, lesson, onCompleted]);
  useLayoutEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement;
    if (!embedded) element?.showModal();
    return () => { element?.close(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true }); };
  }, [embedded]);
  useEffect(() => {
    const element = embedded ? embeddedElement.current : dialog.current;
    // Some real game screens open their own native dialog. Keep the coach in
    // that same top layer so instructions and the exit remain reachable.
    const sync = () => {
      const open = Array.from(document.querySelectorAll<HTMLDialogElement>("dialog[open]"));
      const base = embedded ? element?.closest<HTMLDialogElement>('dialog[open]') : dialog.current;
      const index = base ? open.indexOf(base) : -1;
      const top = index >= 0 ? open.at(-1) : null;
      setCoachHost(top && top !== base ? top : embedded ? coachContainer ?? element : element);
    };
    const observer = new MutationObserver(sync);
    if (element) observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["open"] });
    sync();
    return () => observer.disconnect();
  }, [embedded, coachContainer]);
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
        const prefix = kqPlayableLessonPrefix("discovery-visual", lesson);
        const keys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index));
        for (const key of keys) if (key?.startsWith(prefix)) localStorage.removeItem(key);
      } catch { /* The lesson remains playable when storage is unavailable. */ }
    }
    setProgress({ instruction: definition.instruction, complete: false });
    setGeneration(value => value + 1);
    setAcknowledgedSteps([]);
  };
  const coach = <div className={embedded && coachHost === coachContainer ? undefined : styles.guideDock} data-playable-coach data-releve-floating-guide={embedded && coachHost === coachContainer ? undefined : true}>
    <ArenaReleveGuide compact paced={lesson === "notebook"} steps={getReleveLessonGuide(lesson, progress, acknowledgedSteps)} instruction={progress.instruction} complete={progress.complete}
      onAcknowledgeStep={lesson === "notebook" ? id => setAcknowledgedSteps(current => current.includes(id) ? current : [...current, id]) : undefined}>
      <button type="button" className={styles.guideReturn} data-releve-finish-lesson aria-label={lesson === "notebook" ? "Retour au carnet" : "Quitter cet essai"} onClick={onClose}>{progress.complete ? <Check size={17} aria-hidden="true" /> : <ArrowLeft size={17} aria-hidden="true" />}{lesson === "notebook" ? "Retour au carnet" : progress.complete ? "Essai terminé" : "Retour"}</button>
      <button type="button" className={styles.guideRestart} onClick={restart} aria-label="Recommencer cet essai"><RotateCcw size={17} aria-hidden="true" /></button>
    </ArenaReleveGuide>
  </div>;
  const content = <><div className={embedded ? styles.embeddedStage : styles.stage} key={generation}>
      {lesson === "cards" || lesson === "culture" || lesson === "jury" ? <Culture lesson={lesson} scope="discovery-visual" onClose={onClose} onProgress={updateProgress} />
        : lesson === "equipment" || lesson === "warehouse" || lesson === "market" ? <Operations lesson={lesson} onProgress={updateProgress} />
          : lesson === "bank" || lesson === "investments" || lesson === "business" ? <Treasury lesson={lesson} onProgress={updateProgress} />
            : <Discovery lesson={lesson} onClose={onClose} onProgress={updateProgress} />}
    </div>
    {coachHost ? createPortal(coach, coachHost) : null}</>;
  return <ReleveGuideProvider>{embedded ? <div ref={embeddedElement} data-playable-lesson={lesson} aria-label={`Didacticiel : ${definition.title}`}>{content}</div> : <dialog ref={dialog} className={styles.dialog} data-playable-lesson={lesson} aria-label={`Didacticiel : ${definition.title}`}
    onCancel={event => { if (event.target !== dialog.current) return; event.preventDefault(); onClose(); }}>{content}</dialog>}</ReleveGuideProvider>;
}
