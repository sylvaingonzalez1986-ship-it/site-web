"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import { ArrowRight, Check, Compass, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { ARENA_PLAYABLE_LESSONS, type ArenaPlayableLessonId } from "@/lib/arena-playable-learning";
import styles from "./ArenaLearningHub.module.css";

const Lesson = dynamic(() => import("./ArenaPlayableLesson").then(module => module.ArenaPlayableLesson), {
  ssr: false,
  loading: () => <p role="status">Ouverture de ton espace de jeu…</p>,
});
const STORAGE_KEY = "arena-playable-progress-v1";
function readCompleted(): ArenaPlayableLessonId[] {
  try {
    const values: unknown = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null");
    return Array.isArray(values) ? ARENA_PLAYABLE_LESSONS.filter(item => values.includes(item.id)).map(item => item.id) : [];
  } catch { return []; }
}

export function ArenaLearningHub({ onClose }: { onClose: () => void }) {
  const [lesson, setLesson] = useState<ArenaPlayableLessonId | null>(null);
  const [group, setGroup] = useState<"game" | "explore">("game");
  const [completed, setCompleted] = useState(readCompleted);
  const [warning, setWarning] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  useBodyScrollLock(true);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => { element?.close(); };
  }, []);
  const finish = useCallback((id: ArenaPlayableLessonId) => {
    setCompleted(previous => previous.includes(id) ? previous : [...previous, id]);
  }, []);
  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(completed)); }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    catch { setWarning(true); }
  }, [completed]);
  const returnToHub = () => {
    setLesson(null);
    requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }));
  };
  return <>
    <dialog ref={dialog} className={styles.dialog} data-arena-learning aria-labelledby="arena-learning-title"
      onCancel={event => { event.preventDefault(); if (!lesson) onClose(); }}>
      <header className={styles.top}>
        <span><Compass size={20} aria-hidden="true" />LE JEU EN DIDACTICIEL</span>
        <button type="button" onClick={onClose} aria-label="Fermer les ateliers"><X size={20} aria-hidden="true" /></button>
      </header>
      <div className={styles.content}>
        <span className={styles.eyebrow}>APPRENDS DANS LE JEU</span>
        <h2 id="arena-learning-title">À toi de jouer.</h2>
        <p className={styles.intro}>Les mêmes écrans, les mêmes gestes. Choisis un espace et laisse-toi guider pendant que tu joues.</p>
        <p className={styles.sandbox}>Sans compte · matériel, cartes et euros fictifs</p>
        <nav className={styles.shortcuts} aria-label="Choisir les possibilités à essayer">
          <button type="button" data-learning-group="game" aria-pressed={group === "game"} onClick={() => setGroup("game")}>Jouer une culture · 5 essais</button>
          <button type="button" data-learning-group="explore" aria-pressed={group === "explore"} onClick={() => setGroup("explore")}>Explorer l’Arène · 8 essais</button>
        </nav>
        <div className={styles.grid}>{ARENA_PLAYABLE_LESSONS.filter(item => item.group === group).map(item => <button type="button" key={item.id}
          className={`${styles.workshop} ${styles.visualCard}`} data-learning-lesson={item.id}
          data-learning-workshop={item.group === "game" ? item.id : undefined} data-learning-topic={item.group === "explore" ? item.id : undefined}
          onClick={event => { trigger.current = event.currentTarget; setLesson(item.id); }}>
          <span className={styles.thumbnail}><Image src={item.image} alt="" fill sizes="(max-width:600px) 100vw, 350px" /></span>
          <strong>{item.title}</strong><span>{item.description}</span>
          <span className={styles.cardAction}>{completed.includes(item.id) ? <><Check size={17} aria-hidden="true" />Déjà essayé · Rejouer</> : <>Jouer l’essai<ArrowRight size={17} aria-hidden="true" /></>}</span>
        </button>)}</div>
        <p className={styles.hint}>Les consignes suivent tes actions. Tu peux explorer chaque espace librement et quitter l’essai quand tu veux.</p>
        {warning ? <p role="status">Les essais restent accessibles, mais ce navigateur ne peut pas mémoriser ceux que tu as terminés.</p> : null}
      </div>
    </dialog>
    {lesson ? <Lesson key={lesson} lesson={lesson} onClose={returnToHub} onCompleted={finish} /> : null}
  </>;
}
