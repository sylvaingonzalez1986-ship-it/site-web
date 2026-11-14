"use client";
import { TERPENE_CHAPTERS, TERPENE_SOURCES, TERPENE_TERMS, TERPENE_QUESTIONS, TERPENE_LESSON_ALIASES, terpeneCompound, VERSION } from "@/lib/kanab-quest-school-terpenes";
import { TERPENE_CROSSWORD } from "@/lib/kanab-quest-school-terpenes-crossword";
import type { KqSchoolCurriculumData } from "@/lib/kanab-quest-school-curriculum";
import { KqSchoolCurriculum, type KqCurriculumProps } from "./KqSchoolCurriculum";
import { useKqTerpenesProgress } from "./useKqTerpenesProgress";
import { KqTerpeneEncyclopedia } from "./KqTerpeneEncyclopedia";
import { KqTerpeneVisual, KqTerpeneWheel, hasTerpeneVisual } from "./KqTerpeneVisuals";
import { Crossword } from "./KqSchoolWorkshops";
import { KqHistorySources } from "./KqHistorySources";
import styles from "./KqSchoolTerpenes.module.css";
const data: KqSchoolCurriculumData = {
  id: "terpenes", label: "Terpènes", version: VERSION, chapters: TERPENE_CHAPTERS, sources: TERPENE_SOURCES,
  terms: TERPENE_TERMS, questions: TERPENE_QUESTIONS, aliases: TERPENE_LESSON_ALIASES,
  hero: { src: "/placard/school/course-molecules-v1.webp", alt: "Planche illustrée de chanvre, loupe et évocations aromatiques.", title: "Des odeurs aux molécules", introduction: "Apprends à lire un profil, à comparer les preuves et à consulter les composés documentés. Aucun échantillon ni consommation n’est nécessaire.", caption: "Illustration de synthèse déjà présente dans l’école ; une évocation aromatique n’est pas une analyse chimique." },
  searchPlaceholder: "Seuil olfactif, mélange, chromatographie…", quizExplanation: "Dix questions, une dans chacun des dix chapitres.",
  contextTitle: "Préciser le contexte de l’observation",
  contextLabels: { who: "Objet de l’étude", where: "Milieu et conditions", uses: "Question étudiée", transformations: "Mécanismes", evidence: "Preuves et limites", labourAndTrade: "Mesures et usages des descriptions" },
};
export function KqSchoolTerpenes(props: KqCurriculumProps) {
  const progress = useKqTerpenesProgress(props.ownerId);
  const openCompound = (id: string) => props.onPassageChange(`compound-${id}`);
  return <KqSchoolCurriculum {...props} data={data} progress={progress} replaceLessonVisual
    renderVisual={lesson => hasTerpeneVisual(lesson.id) ? <KqTerpeneVisual key={lesson.id} lesson={lesson} onCompound={openCompound}/> : undefined}
    renderActivity={(lesson, activityProps) => lesson.id === "terpenes-vocabulary-2" ? <section className={styles.crossword} data-terpene-crossword><h4>Des odeurs aux preuves · mots croisés</h4><p>Évalué : reconnaître six définitions et faire correspondre les lettres aux croisements. Les aides et la correction sont disponibles ; cet exercice ne verse pas de monnaie.</p><Crossword key={`${props.ownerId}:${lesson.id}`} data={TERPENE_CROSSWORD} {...activityProps} storageKey={`${activityProps.storageKey}:crossword`}/>{activityProps.completed ? <p role="status">✓ Activité enregistrée.</p> : null}<KqHistorySources ids={[...lesson.visual.sourceIds, ...TERPENE_CROSSWORD.entries.flatMap(entry => entry.sourceIds)]}/></section> : undefined}
    extraTabs={[
      { id: "encyclopedia", label: "Encyclopédie", title: "Les composés documentés", accepts: passage => passage.startsWith("compound-") && Boolean(terpeneCompound(passage)), render: open => <KqTerpeneEncyclopedia passageId={props.focusSectionId} onPassage={props.onPassageChange} onLesson={open} onBuddy={props.onReadBuddy}/> },
      { id: "wheel", label: "Roue des odeurs", title: "Des mots pour comparer", render: () => <KqTerpeneWheel onCompound={openCompound}/> },
    ]}
    renderLessonTail={lesson => <div className={styles.wheelChoices}><button type="button" onClick={() => props.onPassageChange("terpenes-encyclopedia")}>Consulter l’encyclopédie</button>{lesson.id.startsWith("terpenes-trichomes") ? <button type="button" onClick={() => props.onOtherCourse("plant", "botany-observation-2")}>Revoir les trichomes en Botanique</button> : null}</div>}/>;
}
