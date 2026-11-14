"use client";

import Image from "next/image";
import { ArrowLeft, ArrowRight, BookOpen, Check, GraduationCap, Puzzle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { KQ_BUDDIES } from "@/lib/kanab-quest-game";
import type { KqSchoolCourse } from "@/lib/kanab-quest-school-content";
import { getKqSchoolLessonVisual } from "@/lib/kanab-quest-school-visuals";
import { KqProgressMeter } from "./KqVisuals";
import styles from "./KqSchoolLesson.module.css";

export type KqSchoolLessonProps = {
  course: KqSchoolCourse;
  focusSectionId?: string;
  completed: boolean;
  saving?: boolean;
  disableRewards?: boolean;
  rewardLabel?: string;
  onComplete: () => void | Promise<void>;
  onQuiz: () => void;
  onWorkshop: (workshopId: string) => void;
  onReadBuddy: (buddyCode: string, sectionId?: string) => void;
  onPassageChange?: (sectionId: string) => void;
};

export function KqSchoolLesson({ course, focusSectionId, completed, saving = false, disableRewards = false, rewardLabel, onComplete, onQuiz, onWorkshop, onReadBuddy, onPassageChange }: KqSchoolLessonProps) {
  const targetKey = `${course.id}:${focusSectionId ?? ""}`;
  const requestedIndex = Math.max(0, course.sections.findIndex(section => section.id === focusSectionId));
  const [navigation, setNavigation] = useState({ key: targetKey, index: requestedIndex });
  const [failedImage, setFailedImage] = useState("");
  const sectionRef = useRef<HTMLElement>(null);
  const moveFocus = useRef(false);

  // Reset only when the requested course or revision anchor changes, not on every render.
  let index = navigation.index;
  if (navigation.key !== targetKey) {
    index = requestedIndex;
    setNavigation({ key: targetKey, index: requestedIndex });
  }
  const section = course.sections[index];
  const visual = getKqSchoolLessonVisual(course.id);
  const step = visual?.steps[index];
  const last = index === course.sections.length - 1;
  const firstWorkshop = course.workshopIds[0];

  useEffect(() => {
    if (focusSectionId || moveFocus.current) {
      sectionRef.current?.scrollIntoView({ block: "start" });
      sectionRef.current?.focus({ preventScroll: true });
      moveFocus.current = false;
    }
  }, [targetKey, index, focusSectionId]);

  const goTo = (nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= course.sections.length || nextIndex === index) return;
    moveFocus.current = true;
    setNavigation({ key: targetKey, index: nextIndex });
    onPassageChange?.(course.sections[nextIndex].id);
  };

  return <article className={styles.lesson} data-school-lesson={course.id}>
    <div className={styles.progress}>
      <KqProgressMeter label="Votre parcours dans ce cours" value={index + 1} max={course.sections.length} valueLabel={`Séquence ${index + 1} sur ${course.sections.length}`} />
      <span className={styles.duration}>{course.readingMinutes} min · à votre rythme</span>
    </div>

    <section key={section.id} ref={sectionRef} id={`school-${course.id}-${section.id}`} className={styles.sequence} tabIndex={-1} aria-labelledby={section.id}>
      {visual ? <figure className={styles.figure}>
        {failedImage === visual.image ? <div className={styles.imageUnavailable}><BookOpen size={40} aria-hidden="true" /><p>La planche ne s’affiche pas. Les repères du cours restent disponibles.</p></div> :
          <Image src={visual.image} alt={visual.imageAlt} width={960} height={640} sizes="(max-width: 700px) 100vw, 60vw" unoptimized className={styles.illustration} onError={() => setFailedImage(visual.image)} />}
        <figcaption>{step?.observe ?? visual.caption}</figcaption>
      </figure> : null}

      <div className={styles.pageCopy}>
        <h3 id={section.id}>{section.title}</h3>
        {step ? <ul className={styles.keyPoints}>{step.points.map(point => <li key={point}>{point}</li>)}</ul> : null}
        <details className={styles.more}>
          <summary><BookOpen size={17} aria-hidden="true" />En savoir plus</summary>
          <div className={styles.fullText}>{section.paragraphs.map((paragraph, paragraphIndex) => <p key={paragraphIndex}>{paragraph}</p>)}</div>
        </details>
      </div>
    </section>

    <nav className={styles.navigation} aria-label="Les séquences du cours">
      <button type="button" className={styles.pageButton} disabled={index === 0} onClick={() => goTo(index - 1)} aria-label="Séquence précédente"><ArrowLeft size={19} aria-hidden="true" /><span>Précédent</span></button>
      <div className={styles.pageNumbers}>{course.sections.map((part, partIndex) => <button key={part.id} type="button" aria-label={`Séquence ${partIndex + 1} : ${part.title}`} aria-current={partIndex === index ? "step" : undefined} onClick={() => goTo(partIndex)}>{partIndex + 1}</button>)}</div>
      <button type="button" className={styles.pageButton} disabled={last} onClick={() => goTo(index + 1)} aria-label="Séquence suivante"><span>Suivant</span><ArrowRight size={19} aria-hidden="true" /></button>
    </nav>

    {last ? <div className={styles.finish}>
      <details className={styles.practice}>
        <summary>Un exemple, puis à vous de jouer</summary>
        <div className={styles.fullText}><p>{course.observation}</p><p>{course.exercise}</p></div>
      </details>
      {course.buddyCodes.length ? <div className={styles.buddies}>{course.buddyCodes.map(code => <button key={code} type="button" onClick={() => onReadBuddy(code, section.id)}><BookOpen size={17} aria-hidden="true" /><span>Lire sa fiche · {KQ_BUDDIES.find(buddy => buddy.code === code)?.name ?? code}</span></button>)}</div> : null}
      <div className={styles.actions}>
        <button className={styles.quizButton} type="button" disabled={saving || disableRewards} onClick={onQuiz}><GraduationCap size={20} aria-hidden="true" />Passer au quiz</button>
        {firstWorkshop ? <button type="button" onClick={() => onWorkshop(firstWorkshop)}><Puzzle size={18} aria-hidden="true" />Essayer l’atelier</button> : null}
        <button type="button" disabled={completed || saving || disableRewards} onClick={() => { void onComplete(); }}>{completed ? <Check size={18} aria-hidden="true" /> : <BookOpen size={18} aria-hidden="true" />}{completed ? "Lecture enregistrée" : saving ? "Enregistrement…" : "J’ai parcouru le cours"}</button>
      </div>
      {rewardLabel ? <p className={styles.reward}>{rewardLabel}</p> : null}
      {disableRewards ? <p className={styles.availability}>Le cours et l’atelier restent en accès libre. Reconnectez votre parcours pour enregistrer la lecture ou commencer un quiz.</p> : null}
    </div> : course.buddyCodes.length ? <div className={styles.buddies}>{course.buddyCodes.map(code => <button key={code} type="button" onClick={() => onReadBuddy(code, section.id)}><BookOpen size={17} aria-hidden="true" /><span>Lire sa fiche · {KQ_BUDDIES.find(buddy => buddy.code === code)?.name ?? code}</span></button>)}</div> : null}

    <details className={styles.sources}>
      <summary>Sources et vérification</summary>
      <ul>{course.sources.map(source => <li key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a><span>{source.organization} · vérifié le {source.verifiedAt}</span>{source.note ? <p>{source.note}</p> : null}</li>)}</ul>
    </details>
  </article>;
}
