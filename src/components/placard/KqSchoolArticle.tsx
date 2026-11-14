"use client";
import Image from "next/image";
import { BookOpen, Check, ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import type { HistoryLesson, HistoryBlock } from "@/lib/kanab-quest-school-history-types";
import type { KqSchoolCurriculumData } from "@/lib/kanab-quest-school-curriculum";
import { getSchoolLearningArt } from "@/lib/kanab-quest-school-learning-art";
import { HISTORY_EVIDENCE_LABELS } from "./KqHistorySources";
import { KqLessonVisual } from "./KqLessonVisual";
import styles from "./KqSchoolArticle.module.css";

function Paragraph({ block }: { block: HistoryBlock }) {
  return <div className={styles.paragraph}>
    {block.evidence !== "observation" ? <small>{HISTORY_EVIDENCE_LABELS[block.evidence]}</small> : null}
    <p>{block.text}</p>
  </div>;
}

/** A reference article can be read continuously; exercises never gate its contents. */
export function KqSchoolArticle({ lesson, hero, customVisual, activity, read, busy, onRead, nextArticle, onNext, chapterExercise }: {
  lesson: HistoryLesson; hero: KqSchoolCurriculumData["hero"]; customVisual?: ReactNode; activity: ReactNode;
  read: boolean; busy: boolean; onRead: () => void; nextArticle?: string; onNext: () => void;
  chapterExercise?: ReactNode;
}) {
  const art = getSchoolLearningArt(lesson, hero);
  return <div className={styles.article} data-library-article={lesson.id}>
    <p className={styles.question}>{lesson.question}</p>
    <div className={styles.introduction}>
      <figure className={styles.illustration}>
        <Image src={art.src} alt={art.alt} width={1200} height={800} sizes="(max-width:700px) 90vw, 35vw" unoptimized/>
        <figcaption><details><summary>À propos de l’illustration</summary><p>{art.caption}</p></details></figcaption>
      </figure>
      <section className={styles.essential} aria-labelledby={`${lesson.id}-essential`}>
        <h3 id={`${lesson.id}-essential`}>L’essentiel</h3>
        {lesson.essential.map((block, index) => <Paragraph key={index} block={block}/>)}
      </section>
    </div>
    <details className={styles.diagram} data-library-diagram>
      <summary>Explorer le schéma : {lesson.visual.title}</summary>
      {customVisual ?? <KqLessonVisual visual={lesson.visual} hero={art}/>}
    </details>
    <section className={styles.example} aria-labelledby={`${lesson.id}-example`}>
      <h3 id={`${lesson.id}-example`}>Un exemple pour comprendre</h3>
      <Paragraph block={lesson.example}/>
    </section>
    <div className={styles.readAction}><button type="button" disabled={busy || read} onClick={onRead}>
      {read ? <Check size={18} aria-hidden/> : <BookOpen size={18} aria-hidden/>}
      {read ? "Lecture enregistrée" : "Marquer comme lu"}
    </button><small>Un repère personnel dans tes lectures.</small></div>
    {activity ? <details className={styles.exercise} data-library-exercise><summary>S’entraîner sur cet article</summary>{activity}{chapterExercise}</details> : null}
    {nextArticle ? <div className={styles.next}><span>Article suivant</span><button type="button" onClick={onNext}>{nextArticle}<ArrowRight size={18} aria-hidden/></button></div> : null}
  </div>;
}
