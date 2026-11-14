import { BOTANY_FOUNDATIONS_CHAPTERS, BOTANY_FOUNDATIONS_SOURCES, BOTANY_FOUNDATIONS_TERMS, BOTANY_FOUNDATIONS_QUESTIONS } from "./kanab-quest-school-botany-foundations";
import { BOTANY_DIVERSITY_CHAPTERS, BOTANY_DIVERSITY_SOURCES, BOTANY_DIVERSITY_TERMS, BOTANY_DIVERSITY_QUESTIONS } from "./kanab-quest-school-botany-diversity";
import { BOTANY_VARIETIES, BOTANY_VARIETY_SOURCES } from "./kanab-quest-school-botany-varieties";
import { searchCurriculum } from "./kanab-quest-school-curriculum";
export { BOTANY_VARIETIES };
export const VERSION = "2026-11-12.botany1";
export const BOTANY_CHAPTERS = [...BOTANY_FOUNDATIONS_CHAPTERS, ...BOTANY_DIVERSITY_CHAPTERS];
export const BOTANY_LESSONS = BOTANY_CHAPTERS.flatMap(chapter => chapter.lessons);
export const BOTANY_SOURCES = [...BOTANY_FOUNDATIONS_SOURCES, ...BOTANY_DIVERSITY_SOURCES, ...BOTANY_VARIETY_SOURCES];
export const BOTANY_TERMS = [...BOTANY_FOUNDATIONS_TERMS, ...BOTANY_DIVERSITY_TERMS].sort((a, b) => a.term.localeCompare(b.term, "fr"));
export const BOTANY_QUESTIONS = [...BOTANY_FOUNDATIONS_QUESTIONS, ...BOTANY_DIVERSITY_QUESTIONS];
export const BOTANY_LESSON_ALIASES: Readonly<Record<string, string>> = {
  "plant-1": "botany-anatomy-1", "plant-2": "botany-sexual-expression-1", "plant-3": "botany-diversity-1", "plant-4": "botany-observation-1",
};
export const botanyLesson = (id: string) => BOTANY_LESSONS.find(lesson => lesson.id === (BOTANY_LESSON_ALIASES[id] ?? id));
export const botanySource = (id: string) => BOTANY_SOURCES.find(source => source.id === id);
export const searchBotany = (query: string) => searchCurriculum(query, BOTANY_LESSONS, BOTANY_TERMS);
