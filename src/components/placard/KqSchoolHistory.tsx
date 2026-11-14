"use client";
import { HISTORY_CHAPTERS, HISTORY_TERMS, HISTORY_SOURCES, HISTORY_QUESTIONS, HISTORY_LESSON_ALIASES, VERSION } from "@/lib/kanab-quest-school-history";
import type { KqSchoolCurriculumData } from "@/lib/kanab-quest-school-curriculum";
import { KqSchoolCurriculum, type KqCurriculumProps } from "./KqSchoolCurriculum";
import { KqHistoryAtlas } from "./KqHistoryAtlas";
import { useKqHistoryProgress } from "./useKqHistoryProgress";

const data: KqSchoolCurriculumData = {
  id: "history", label: "Histoire", version: VERSION, chapters: HISTORY_CHAPTERS, sources: HISTORY_SOURCES,
  terms: HISTORY_TERMS, questions: HISTORY_QUESTIONS, aliases: HISTORY_LESSON_ALIASES,
  hero: { src: "/placard/school/course-history-v1.webp", alt: "Illustration pédagogique de chanvre, livre et objets de matière ; ce dessin synthétique ne reproduit pas un objet archéologique.", title: "Suivre une plante, interroger les preuves", introduction: "Des vestiges aux archives, découvre qui emploie le chanvre, dans quelles conditions et pour quels débouchés.", caption: "Image de synthèse illustrative, sans valeur de preuve archéologique." },
  searchPlaceholder: "Noyal, pollen, convention…", quizExplanation: "Dix questions issues de dix chapitres différents.",
  contextTitle: "Qui, où, pourquoi, comment : replacer la période",
  contextLabels: { who: "Qui ?", where: "Où ?", uses: "Pour quels usages ?", transformations: "Quelles transformations ?", evidence: "Quelles preuves ?", labourAndTrade: "Travail, commerce et débouchés" },
};
export function KqSchoolHistory(props: KqCurriculumProps) {
  const progress = useKqHistoryProgress(props.ownerId);
  return <KqSchoolCurriculum {...props} data={data} progress={progress} extraTabs={[
    { id: "timeline", label: "Frise", title: "Une histoire, plusieurs dates", render: open => <KqHistoryAtlas key="timeline" mode="timeline" onLesson={open}/> },
    { id: "map", label: "Carte", title: "Des circulations documentées", render: open => <KqHistoryAtlas key="map" mode="map" onLesson={open}/> },
  ]} renderLessonTail={lesson => lesson.id.startsWith("history-scientific-discoveries") ? <button type="button" onClick={() => props.onOtherCourse("molecules")}>Poursuivre avec les notions de biochimie</button> : null}/>;
}
