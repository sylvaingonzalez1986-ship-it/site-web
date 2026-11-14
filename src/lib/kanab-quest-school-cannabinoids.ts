import { CANNABINOID_CHAPTERS, CANNABINOID_LESSON_SOURCES, CANNABINOID_TERMS, CANNABINOID_QUESTIONS } from "./kanab-quest-school-cannabinoids-lessons";
import { CANNABINOID_COMPOUNDS, CANNABINOID_COMPOUND_SOURCES, CANNABINOID_CORPUS } from "./kanab-quest-school-cannabinoids-compounds";
import { CANNABINOID_STUDY_SOURCES } from "./kanab-quest-school-cannabinoids-studies";
import { foldCurriculumText } from "./kanab-quest-school-curriculum";
export { CANNABINOID_CHAPTERS, CANNABINOID_TERMS, CANNABINOID_QUESTIONS, CANNABINOID_COMPOUNDS, CANNABINOID_CORPUS };
export { CANNABINOID_STUDIES } from "./kanab-quest-school-cannabinoids-studies";
export const CANNABINOID_VERSION = "2026-11-12.cannabinoids1";
export const CANNABINOID_LESSONS = CANNABINOID_CHAPTERS.flatMap(chapter => chapter.lessons);
export const CANNABINOID_SOURCES = [...CANNABINOID_LESSON_SOURCES, ...CANNABINOID_COMPOUND_SOURCES, ...CANNABINOID_STUDY_SOURCES];
export const CANNABINOID_LESSON_ALIASES: Readonly<Record<string, string>> = {
  "evidence-1": "cannabinoids-reading-studies-1", "evidence-2": "cannabinoids-clinical-evidence-1",
  "evidence-3": "cannabinoids-clinical-evidence-2", "evidence-4": "cannabinoids-emerging-products-2",
};
export const foldCannabinoidName = (value: string) => foldCurriculumText(value).replace(/[δΔ]/g, "delta").replace(/[−–—-]/g, " ").replace(/\s+/g, " ").trim();
export const cannabinoidCompound = (id: string) => CANNABINOID_COMPOUNDS.find(compound => compound.id === id.replace(/^compound-/, ""));
