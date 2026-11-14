"use client";
import { BOTANY_CHAPTERS, BOTANY_SOURCES, BOTANY_TERMS, BOTANY_QUESTIONS, BOTANY_LESSON_ALIASES, BOTANY_VARIETIES, VERSION } from "@/lib/kanab-quest-school-botany";
import type { KqSchoolCurriculumData } from "@/lib/kanab-quest-school-curriculum";
import { KqSchoolCurriculum, type KqCurriculumProps } from "./KqSchoolCurriculum";
import { useKqBotanyProgress } from "./useKqBotanyProgress";
import { KqBotanyDossiers } from "./KqBotanyDossiers";
import { KqBotanyVisual, hasBotanyVisual } from "./KqBotanyVisuals";
const data: KqSchoolCurriculumData = {
  id: "botany", label: "Botanique", version: VERSION, chapters: BOTANY_CHAPTERS, sources: BOTANY_SOURCES,
  terms: BOTANY_TERMS, questions: BOTANY_QUESTIONS, aliases: BOTANY_LESSON_ALIASES,
  hero: { src: "/placard/school/course-plant-v1.webp", alt: "Planche botanique de chanvre : plante, racines, feuille composée et structures florales.", title: "Observer la plante, examiner les origines", introduction: "Des organes aux filiations, apprends à distinguer ce que l’on voit, ce que l’on mesure et ce qui reste une déclaration.", caption: "Illustration botanique de synthèse ; elle ne certifie ni un cultivar ni un pedigree." },
  searchPlaceholder: "Stipule, génotype, monoécie…", quizExplanation: "Dix questions couvrant les huit chapitres, avec deux questions supplémentaires issues de chapitres différents.",
  contextTitle: "Replacer les observations dans leur contexte",
  contextLabels: { who: "Ce que l’on étudie", where: "Contexte", uses: "Fonctions et usages", transformations: "Mécanismes et changements", evidence: "Preuves et limites", labourAndTrade: "Applications et filières" },
};
export function KqSchoolBotany(props: KqCurriculumProps) {
  const progress = useKqBotanyProgress(props.ownerId);
  return <KqSchoolCurriculum {...props} data={data} progress={progress} renderVisual={lesson => hasBotanyVisual(lesson.id) ? <KqBotanyVisual key={lesson.id} lesson={lesson}/> : undefined} extraTabs={[
    { id: "dossiers", label: "Dossiers & arbres", title: "Les noms à l’épreuve des sources", accepts: passage => BOTANY_VARIETIES.some(dossier => dossier.id === passage), render: open => <KqBotanyDossiers passageId={props.focusSectionId} onPassage={props.onPassageChange} onLesson={open} onBuddy={props.onReadBuddy}/> },
  ]} renderLessonTail={lesson => lesson.id.startsWith("botany-modern-lineages") ? <button type="button" onClick={() => props.onPassageChange("botany-dossiers")}>Enquêter dans les dix dossiers variétaux</button> : lesson.id.startsWith("botany-taxonomy") ? <button type="button" onClick={() => props.onOtherCourse("history", "history-prehistory-2")}>Relier la diversité aux hypothèses de domestication</button> : null}/>;
}
