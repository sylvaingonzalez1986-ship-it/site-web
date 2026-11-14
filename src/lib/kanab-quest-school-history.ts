import { HISTORY_EARLY_CHAPTERS, HISTORY_EARLY_SOURCES, HISTORY_EARLY_EVENTS, HISTORY_EARLY_ROUTES, HISTORY_EARLY_TERMS, HISTORY_EARLY_QUESTIONS } from "./kanab-quest-school-history-early";
import { HISTORY_MODERN_CHAPTERS, HISTORY_MODERN_SOURCES, HISTORY_MODERN_EVENTS, HISTORY_MODERN_ROUTES, HISTORY_MODERN_TERMS, HISTORY_MODERN_QUESTIONS } from "./kanab-quest-school-history-modern";
import type { HistoryChapter, HistoryEvent, HistoryQuizQuestion, HistoryRoute, HistorySource, HistoryTerm } from "./kanab-quest-school-history-types";

export const VERSION = "2026-11-12.history1";
export const HISTORY_CHAPTERS: readonly HistoryChapter[] = [...HISTORY_EARLY_CHAPTERS, ...HISTORY_MODERN_CHAPTERS];
export const HISTORY_SOURCES: readonly HistorySource[] = [...HISTORY_EARLY_SOURCES, ...HISTORY_MODERN_SOURCES];
export const HISTORY_EVENTS: readonly HistoryEvent[] = [...HISTORY_EARLY_EVENTS, ...HISTORY_MODERN_EVENTS].sort((a, b) => a.startYear - b.startYear);
export const HISTORY_ROUTES: readonly HistoryRoute[] = [...HISTORY_EARLY_ROUTES, ...HISTORY_MODERN_ROUTES];
export const HISTORY_TERMS: readonly HistoryTerm[] = [...HISTORY_EARLY_TERMS, ...HISTORY_MODERN_TERMS].sort((a, b) => a.term.localeCompare(b.term, "fr"));
export const HISTORY_QUESTIONS: readonly HistoryQuizQuestion[] = [...HISTORY_EARLY_QUESTIONS, ...HISTORY_MODERN_QUESTIONS];
export const HISTORY_LESSONS = HISTORY_CHAPTERS.flatMap(chapter => chapter.lessons);
export const HISTORY_LESSON_ALIASES: Readonly<Record<string, string>> = {
  "history-1": "history-evidence-1", "history-2": "history-eurasian-antiquity-1",
  "history-3": "history-scientific-discoveries-1", "history-4": "history-contemporary-1",
};
export const historySource = (id: string) => HISTORY_SOURCES.find(source => source.id === id);
export const historyLesson = (id: string) => HISTORY_LESSONS.find(lesson => lesson.id === (HISTORY_LESSON_ALIASES[id] ?? id));
export const historyChapter = (lessonId: string) => HISTORY_CHAPTERS.find(chapter => chapter.lessons.some(lesson => lesson.id === lessonId));
export const foldHistoryText = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("fr");
export function searchHistory(query: string) {
  const words = foldHistoryText(query.trim()).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lessons = HISTORY_LESSONS.map(lesson => ({ id: lesson.id, kind: "lesson" as const, title: lesson.title, excerpt: lesson.question,
    text: [lesson.title, lesson.question, ...lesson.essential.map(block => block.text), ...lesson.deeper.map(block => block.text)].join(" ") }));
  const terms = HISTORY_TERMS.map(term => ({ id: term.id, kind: "term" as const, title: term.term, excerpt: term.definition, text: `${term.term} ${term.definition}` }));
  return [...lessons, ...terms].filter(item => words.every(word => foldHistoryText(item.text).includes(word)))
    .sort((a, b) => Number(words.every(word => foldHistoryText(b.title).includes(word))) - Number(words.every(word => foldHistoryText(a.title).includes(word))))
    .slice(0, 30).map(({ id, kind, title, excerpt }) => ({ id, kind, title, excerpt }));
}
