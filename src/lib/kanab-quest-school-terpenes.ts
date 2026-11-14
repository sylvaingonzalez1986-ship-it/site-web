import { TERPENE_CHAPTERS, TERPENE_LESSON_SOURCES, TERPENE_TERMS, TERPENE_QUESTIONS } from "./kanab-quest-school-terpenes-lessons";
import { TERPENE_COMPOUNDS, TERPENE_COMPOUND_SOURCES, TERPENE_CORPUS } from "./kanab-quest-school-terpenes-compounds";
import { foldCurriculumText } from "./kanab-quest-school-curriculum";
export { TERPENE_CHAPTERS, TERPENE_TERMS, TERPENE_QUESTIONS, TERPENE_COMPOUNDS, TERPENE_CORPUS };
export { TERPENE_CROSSWORD } from "./kanab-quest-school-terpenes-crossword";
export { TERPENE_BUDDY_LINKS } from "./kanab-quest-school-terpenes-buddy-links";
export const VERSION = "2026-11-12.terpenes1";
export const TERPENE_LESSONS = TERPENE_CHAPTERS.flatMap(chapter => chapter.lessons);
export const TERPENE_SOURCES = [...TERPENE_LESSON_SOURCES, ...TERPENE_COMPOUND_SOURCES];
export const TERPENE_LESSON_ALIASES: Readonly<Record<string, string>> = {
  "molecules-1": "terpenes-chemistry-1", "molecules-2": "terpenes-trichomes-1",
  "molecules-3": "terpenes-profiles-1", "molecules-4": "terpenes-claims-1",
};
/** Greek letters and their written synonyms should lead to the same records. */
export const foldTerpeneName = (value: string) => foldCurriculumText(value)
  .replace(/α/g, "alpha").replace(/β/g, "beta").replace(/γ/g, "gamma").replace(/δ/g, "delta")
  .replace(/[-‐‑–—]/g, " ").replace(/\s+/g, " ").trim();
export const terpeneCompound = (id: string) => TERPENE_COMPOUNDS.find(compound => compound.id === id.replace(/^compound-/, ""));
